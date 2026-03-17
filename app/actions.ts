'use server';

import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';

import { InventoryLocationType, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export type MaterialRecord = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  minStock: number;
  notes: string;
};

export type JobStatus = 'OPEN' | 'CLOSED';

export type JobRecord = {
  id: string;
  number: string;
  name: string;
  status: JobStatus;
};

export type InventoryTransactionRecord = {
  id: string;
  createdAt: string;
  type: 'RECEIVE' | 'TRANSFER' | 'ISSUE' | 'ADJUSTMENT';
  materialSku: string;
  materialName: string;
  quantity: number;
  unit: string;
  locationFrom: string;
  locationTo: string;
  invoiceNumber: string;
  vendorName: string;
  notes: string;
  hasPhoto: boolean;
};

export type InventoryBalanceView = {
  materialId: string;
  materialSku: string;
  materialName: string;
  unit: string;
  minStock: number;
  totalQuantity: number;
  shopQuantity: number;
  jobQuantities: Array<{ jobId: string; jobLabel: string; quantity: number }>;
};

export type InventoryAtGlanceRow = {
  id: string;
  materialName: string;
  materialSku: string;
  locationLabel: string;
  quantity: number;
  unit: string;
};

export type DashboardView = {
  totalSku: number;
  lowStock: number;
  openJobs: number;
  totalInventoryUnits: number;
  recentTransactions: InventoryTransactionRecord[];
  inventoryRows: InventoryAtGlanceRow[];
};

type ActionResult<T = undefined> = {
  ok: boolean;
  error?: string;
  data?: T;
};

type MaterialPayload = Omit<MaterialRecord, 'id' | 'quantity'>;
type JobPayload = Omit<JobRecord, 'id'>;

type ParsedLocation = {
  locationType: InventoryLocationType;
  jobId: string | null;
};

const statuses: JobStatus[] = ['OPEN', 'CLOSED'];
const materialUnits = ['UNIT', 'SHEETS'] as const;

function normalizeMaterialUnit(unit: string): string {
  const normalized = unit.trim().toUpperCase();

  if (normalized === 'SHEET' || normalized === 'SHEETS') {
    return 'SHEETS';
  }

  if (normalized === 'UNIT' || normalized === 'UNITS') {
    return 'UNIT';
  }

  return normalized;
}

function normalizeMaterialPayload(payload: MaterialPayload): MaterialPayload {
  return {
    name: payload.name.trim(),
    sku: payload.sku.trim(),
    unit: normalizeMaterialUnit(payload.unit),
    minStock: Math.max(0, Math.floor(payload.minStock)),
    notes: payload.notes.trim()
  };
}

function validateMaterialPayload(payload: MaterialPayload): ActionResult<MaterialRecord> {
  if (!payload.name.trim()) {
    return { ok: false, error: 'Material name is required.' };
  }

  if (!payload.sku.trim()) {
    return { ok: false, error: 'SKU is required.' };
  }

  if (!payload.unit.trim()) {
    return { ok: false, error: 'Unit is required.' };
  }

  if (!materialUnits.includes(normalizeMaterialUnit(payload.unit) as (typeof materialUnits)[number])) {
    return { ok: false, error: 'Unit must be either UNIT or SHEETS.' };
  }

  if (!Number.isFinite(payload.minStock) || payload.minStock < 0) {
    return { ok: false, error: 'Minimum stock must be a non-negative number.' };
  }

  return { ok: true };
}

function formatMaterialMutationError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return 'A material with this SKU already exists.';
    }

    if (error.code === 'P2022') {
      return 'Materials table is out of date. Run the latest Prisma migrations and try again.';
    }
  }

  return 'Unable to save material right now.';
}

function isBalanceTableUnavailable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code === 'P2021') {
    return true;
  }

  if (error.code === 'P2022') {
    return true;
  }

  return false;
}

function normalizeJobPayload(payload: JobPayload): JobPayload {
  const status = statuses.includes(payload.status) ? payload.status : 'OPEN';

  return {
    number: payload.number.trim(),
    name: payload.name.trim(),
    status
  };
}

function parseLocation(locationValue: string): ParsedLocation | null {
  if (locationValue === 'shop') {
    return { locationType: 'SHOP', jobId: null };
  }

  if (locationValue.startsWith('loc-')) {
    return { locationType: 'JOB', jobId: locationValue.replace('loc-', '') };
  }

  return null;
}

function formatLocationLabel(
  locationType: InventoryLocationType | null,
  job: { number: string; name: string } | null | undefined
): string {
  if (!locationType) {
    return 'N/A';
  }

  if (locationType === 'SHOP') {
    return 'Shop';
  }

  if (job) {
    return `${job.number} — ${job.name}`;
  }

  return 'Job';
}

async function adjustInventoryBalance(
  tx: Prisma.TransactionClient,
  materialId: string,
  locationType: InventoryLocationType,
  jobId: string | null,
  delta: number
) {
  if (delta === 0) {
    return;
  }

  const existing = await tx.inventoryBalance.findFirst({
    where: {
      materialId,
      locationType,
      jobId: jobId ?? null
    }
  });

  if (!existing && delta < 0) {
    throw new Error('Insufficient stock for this location.');
  }

  if (existing && existing.quantity + delta < 0) {
    throw new Error('Insufficient stock for this location.');
  }

  if (!existing) {
    await tx.inventoryBalance.create({
      data: {
        materialId,
        locationType,
        jobId,
        quantity: delta
      }
    });
    return;
  }

  await tx.inventoryBalance.update({
    where: { id: existing.id },
    data: {
      quantity: { increment: delta }
    }
  });
}

async function syncMaterialQuantitiesFromBalances() {
  const materials = await prisma.material.findMany({
    select: {
      id: true
    }
  });

  if (materials.length === 0) {
    return;
  }

  const balanceSums = await prisma.inventoryBalance.groupBy({
    by: ['materialId'],
    _sum: { quantity: true }
  });

  const quantityByMaterialId = new Map(balanceSums.map((entry) => [entry.materialId, entry._sum.quantity ?? 0]));

  await prisma.$transaction(
    materials.map((material) =>
      prisma.material.update({
        where: { id: material.id },
        data: {
          quantity: quantityByMaterialId.get(material.id) ?? 0
        }
      })
    )
  );
}

export async function listMaterials(): Promise<{ data: MaterialRecord[] }> {
  noStore();

  try {
    const materials = await prisma.material.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        quantity: true,
        minStock: true,
        notes: true
      },
      orderBy: { createdAt: 'asc' }
    });

    if (materials.length === 0) {
      return { data: [] };
    }

    let quantityByMaterialId = new Map<string, number>();

    try {
      const balanceSums = await prisma.inventoryBalance.groupBy({
        by: ['materialId'],
        _sum: { quantity: true },
        where: {
          materialId: { in: materials.map((material) => material.id) }
        }
      });

      quantityByMaterialId = new Map(balanceSums.map((entry) => [entry.materialId, entry._sum.quantity ?? 0]));
    } catch (error) {
      if (!isBalanceTableUnavailable(error)) {
        throw error;
      }

      console.warn('InventoryBalance table unavailable, falling back to Material.quantity.');
    }

    return {
      data: materials.map((material) => ({
        id: material.id,
        name: material.name,
        sku: material.sku,
        unit: material.unit,
        quantity: quantityByMaterialId.get(material.id) ?? material.quantity,
        minStock: material.minStock,
        notes: material.notes
      }))
    };
  } catch (error) {
    console.error('Failed to load materials from database:', error);

    return { data: [] };
  }
}

export async function createMaterial(payload: MaterialPayload): Promise<ActionResult<MaterialRecord>> {
  const validation = validateMaterialPayload(payload);
  if (!validation.ok) {
    return validation;
  }

  try {
    const created = await prisma.material.create({
      data: normalizeMaterialPayload(payload),
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        quantity: true,
        minStock: true,
        notes: true
      }
    });
    revalidatePath('/materials');

    return {
      ok: true,
      data: {
        id: created.id,
        name: created.name,
        sku: created.sku,
        unit: created.unit,
        quantity: created.quantity,
        minStock: created.minStock,
        notes: created.notes
      }
    };
  } catch (error) {
    console.error('Failed to create material:', error);
    return { ok: false, error: formatMaterialMutationError(error) };
  }
}

export async function updateMaterial(id: string, payload: MaterialPayload): Promise<ActionResult<MaterialRecord>> {
  const validation = validateMaterialPayload(payload);
  if (!validation.ok) {
    return validation;
  }

  try {
    const updated = await prisma.material.update({
      where: { id },
      data: normalizeMaterialPayload(payload),
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        quantity: true,
        minStock: true,
        notes: true
      }
    });

    let quantity = updated.quantity;

    try {
      const balance = await prisma.inventoryBalance.aggregate({
        where: { materialId: id },
        _sum: { quantity: true }
      });

      quantity = balance._sum.quantity ?? 0;
    } catch (error) {
      if (!isBalanceTableUnavailable(error)) {
        throw error;
      }

      console.warn('InventoryBalance table unavailable, falling back to Material.quantity.');
    }

    revalidatePath('/materials');

    return {
      ok: true,
      data: {
        id: updated.id,
        name: updated.name,
        sku: updated.sku,
        unit: updated.unit,
        quantity,
        minStock: updated.minStock,
        notes: updated.notes
      }
    };
  } catch (error) {
    console.error('Failed to update material:', error);
    return { ok: false, error: formatMaterialMutationError(error) };
  }
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  try {
    await prisma.material.delete({ where: { id } });
    revalidatePath('/materials');
    return { ok: true };
  } catch (error) {
    console.error('Failed to delete material:', error);
    return { ok: false, error: 'Unable to delete material right now.' };
  }
}

export async function listJobs(): Promise<{ data: JobRecord[] }> {
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: 'asc' }
    });

    return {
      data: jobs.map((job) => ({
        id: job.id,
        number: job.number,
        name: job.name,
        status: statuses.includes(job.status as JobStatus) ? (job.status as JobStatus) : 'OPEN'
      }))
    };
  } catch (error) {
    console.error('Failed to load jobs from database:', error);

    return { data: [] };
  }
}

export async function createJob(payload: JobPayload): Promise<ActionResult<JobRecord>> {
  try {
    const created = await prisma.job.create({
      data: normalizeJobPayload(payload)
    });
    revalidatePath('/jobs');

    return {
      ok: true,
      data: {
        id: created.id,
        number: created.number,
        name: created.name,
        status: statuses.includes(created.status as JobStatus) ? (created.status as JobStatus) : 'OPEN'
      }
    };
  } catch (error) {
    console.error('Failed to create job:', error);
    return { ok: false, error: 'Unable to save job right now.' };
  }
}

export async function updateJob(id: string, payload: JobPayload): Promise<ActionResult<JobRecord>> {
  try {
    const updated = await prisma.job.update({
      where: { id },
      data: normalizeJobPayload(payload)
    });
    revalidatePath('/jobs');

    return {
      ok: true,
      data: {
        id: updated.id,
        number: updated.number,
        name: updated.name,
        status: statuses.includes(updated.status as JobStatus) ? (updated.status as JobStatus) : 'OPEN'
      }
    };
  } catch (error) {
    console.error('Failed to update job:', error);
    return { ok: false, error: 'Unable to update job right now.' };
  }
}

export async function deleteJob(id: string): Promise<ActionResult> {
  try {
    await prisma.job.delete({ where: { id } });
    revalidatePath('/jobs');
    return { ok: true };
  } catch (error) {
    console.error('Failed to delete job:', error);
    return { ok: false, error: 'Unable to delete job right now.' };
  }
}

export async function receiveMaterial(formData: FormData) {
  const materialId = String(formData.get('materialId') ?? '');
  const destinationValue = String(formData.get('destination') ?? '').trim();
  const legacyDestinationType = String(formData.get('destinationType') ?? '').trim();
  const legacyJobId = String(formData.get('jobId') ?? '').trim();
  const invoiceNumber = String(formData.get('invoiceNumber') ?? '').trim();
  const vendor = String(formData.get('vendorName') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const photoUrl = String(formData.get('photoUrl') ?? '').trim();
  const quantity = Number(formData.get('quantity') ?? 0);

  const missingFields: string[] = [];

  let destinationType: 'SHOP' | 'JOB' = 'SHOP';
  let jobId: string | null = null;
  let hasValidDestination = true;

  if (destinationValue) {
    if (destinationValue === 'SHOP') {
      destinationType = 'SHOP';
    } else if (destinationValue.startsWith('JOB:')) {
      destinationType = 'JOB';
      jobId = destinationValue.slice(4).trim() || null;
    } else {
      hasValidDestination = false;
    }
  } else if (legacyDestinationType === 'JOB') {
    destinationType = 'JOB';
    jobId = legacyJobId || null;
  }

  if (!materialId) {
    missingFields.push('material');
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    missingFields.push('quantity');
  }

  if (!hasValidDestination || !['SHOP', 'JOB'].includes(destinationType)) {
    missingFields.push('destination');
  }

  if (!invoiceNumber) {
    missingFields.push('invoice number');
  }

  if (!vendor) {
    missingFields.push('vendor');
  }

  if (missingFields.length > 0) {
    const message = encodeURIComponent(`Missing required fields: ${missingFields.join(', ')}.`);
    redirect(`/receive-materials?error=missing-required-fields&message=${message}`);
  }

  if (destinationType === 'JOB' && !jobId) {
    redirect('/receive-materials?error=job-required-for-job-destination');
  }

  const normalizedQuantity = Math.floor(quantity);
  const receivedAt = new Date();

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { id: true }
  });

  if (!material) {
    redirect('/receive-materials?error=invalid-material&message=Selected%20material%20was%20not%20found.');
  }

  if (destinationType === 'JOB' && jobId) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      redirect('/receive-materials?error=invalid-job&message=Destination%20job%20was%20not%20found.');
    }
    if (job.status !== 'OPEN') {
      redirect('/receive-materials?error=invalid-job&message=Destination%20job%20must%20be%20open.');
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const destinationJobId = destinationType === 'JOB' ? jobId : null;

      const receipt = await tx.receivingRecord.create({
        data: {
          materialId,
          quantity: normalizedQuantity,
          destinationType,
          jobId: destinationJobId,
          invoiceNumber: invoiceNumber || null,
          vendor: vendor || null,
          notes: notes || null,
          photoUrl: photoUrl || null,
          receivedAt
        }
      });

      await adjustInventoryBalance(tx, materialId, destinationType, destinationJobId, normalizedQuantity);

      await tx.inventoryTransaction.create({
        data: {
          materialId,
          transactionType: 'RECEIVE',
          quantity: normalizedQuantity,
          locationFromType: null,
          locationFromJobId: null,
          locationToType: destinationType,
          locationToJobId: destinationJobId,
          invoiceNumber: invoiceNumber || null,
          vendor: vendor || null,
          notes: notes || null,
          photoUrl: photoUrl || null,
          receivingRecordId: receipt.id,
          createdAt: receivedAt
        }
      });
    });

    await syncMaterialQuantitiesFromBalances();
  } catch (error) {
    let message = 'Unable to save receipt right now.';

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        message = 'Receipt references a missing material or job record.';
      } else if (error.code === 'P2011') {
        message = `A required receive field is missing in the database write (${error.meta?.constraint ?? 'unknown constraint'}).`;
      } else if (error.code === 'P2022') {
        message = `Database schema is out of date (missing column: ${String(error.meta?.column ?? 'unknown')}). Run Prisma migrations.`;
      }
    } else if (error instanceof Error && error.message) {
      message = error.message;
    }

    console.error('Failed to receive material:', {
      materialId,
      destinationType,
      jobId: destinationType === 'JOB' ? jobId : null,
      quantity: normalizedQuantity,
      invoiceNumber,
      vendor,
      prismaCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null,
      prismaMeta: error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : null,
      message,
      stack: error instanceof Error ? error.stack : null,
      error
    });
    redirect(`/receive-materials?error=save-failed&message=${encodeURIComponent(message)}`);
  }

  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/inventory');
  revalidatePath('/history');
  revalidatePath('/receive-materials');
  revalidatePath('/issue-materials');
  redirect('/receive-materials?success=1');
}

export async function listReceivingRecords() {
  try {
    const receipts = await prisma.receivingRecord.findMany({
      include: { material: true, job: true },
      orderBy: { receivedAt: 'desc' },
      take: 20
    });

    return {
      data: receipts.map((receipt) => ({
        id: receipt.id,
        receivedAt: receipt.receivedAt.toISOString(),
        materialName: receipt.material.name,
        materialSku: receipt.material.sku,
        quantity: receipt.quantity,
        destinationType: receipt.destinationType,
        destinationLabel:
          receipt.destinationType === 'JOB' && receipt.job ? `${receipt.job.number} — ${receipt.job.name}` : 'Shop',
        invoiceNumber: receipt.invoiceNumber ?? '—',
        vendorName: receipt.vendor ?? '—',
        notes: receipt.notes ?? '—'
      }))
    };
  } catch (error) {
    console.error('Failed to load receiving records:', error);
    return { data: [] };
  }
}

export async function transferMaterial(formData: FormData) {
  const materialId = String(formData.get('materialId') ?? '');
  const fromLocation = String(formData.get('fromLocation') ?? '');
  const toLocation = String(formData.get('toLocation') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const quantity = Number(formData.get('quantity') ?? 0);

  const source = parseLocation(fromLocation);
  const destination = parseLocation(toLocation);

  if (!materialId || !source || !destination || !Number.isFinite(quantity) || quantity <= 0 || fromLocation === toLocation) {
    redirect('/transfer-materials?error=invalid-transfer');
  }

  const normalizedQuantity = Math.floor(quantity);

  try {
    await prisma.$transaction(async (tx) => {
      if (source.locationType === 'JOB' && source.jobId) {
        const sourceJob = await tx.job.findUnique({ where: { id: source.jobId } });
        if (!sourceJob || sourceJob.status !== 'OPEN') {
          throw new Error('Source job must be open.');
        }
      }

      if (destination.locationType === 'JOB' && destination.jobId) {
        const destinationJob = await tx.job.findUnique({ where: { id: destination.jobId } });
        if (!destinationJob || destinationJob.status !== 'OPEN') {
          throw new Error('Destination job must be open.');
        }
      }

      await adjustInventoryBalance(tx, materialId, source.locationType, source.jobId, -normalizedQuantity);
      await adjustInventoryBalance(tx, materialId, destination.locationType, destination.jobId, normalizedQuantity);

      await tx.inventoryTransaction.create({
        data: {
          materialId,
          transactionType: 'TRANSFER',
          quantity: normalizedQuantity,
          locationFromType: source.locationType,
          locationFromJobId: source.jobId,
          locationToType: destination.locationType,
          locationToJobId: destination.jobId,
          notes: notes || null
        }
      });
    });

    await syncMaterialQuantitiesFromBalances();
  } catch (error) {
    console.error('Failed to transfer material:', error);
    redirect('/transfer-materials?error=save-failed');
  }

  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/history');
  revalidatePath('/transfer-materials');
  revalidatePath('/issue-materials');
  redirect('/transfer-materials?success=1');
}

export async function issueMaterial(formData: FormData) {
  const materialId = String(formData.get('materialId') ?? '');
  const fromLocation = String(formData.get('fromLocation') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();
  const quantity = Number(formData.get('quantity') ?? 0);
  const source = parseLocation(fromLocation);

  if (!materialId || !source || !Number.isFinite(quantity) || quantity <= 0) {
    redirect('/issue-materials?error=invalid-issue');
  }

  const normalizedQuantity = Math.floor(quantity);

  try {
    await prisma.$transaction(async (tx) => {
      if (source.locationType === 'JOB' && source.jobId) {
        const sourceJob = await tx.job.findUnique({ where: { id: source.jobId } });
        if (!sourceJob || sourceJob.status !== 'OPEN') {
          throw new Error('Source job must be open.');
        }
      }

      await adjustInventoryBalance(tx, materialId, source.locationType, source.jobId, -normalizedQuantity);

      await tx.inventoryTransaction.create({
        data: {
          materialId,
          transactionType: 'ISSUE',
          quantity: normalizedQuantity,
          locationFromType: source.locationType,
          locationFromJobId: source.jobId,
          locationToType: null,
          locationToJobId: null,
          notes: notes || null
        }
      });
    });

    await syncMaterialQuantitiesFromBalances();
  } catch (error) {
    console.error('Failed to issue material:', error);
    redirect('/issue-materials?error=save-failed');
  }

  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/history');
  revalidatePath('/issue-materials');
  redirect('/issue-materials?success=1');
}

export async function listInventoryBalances(): Promise<{ data: InventoryBalanceView[] }> {
  try {
    const materials = await prisma.material.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        minStock: true
      },
      orderBy: { name: 'asc' }
    });

    if (materials.length === 0) {
      return { data: [] };
    }

    const balances = await prisma.inventoryBalance.findMany({
      where: {
        materialId: { in: materials.map((material) => material.id) }
      },
      select: {
        materialId: true,
        locationType: true,
        jobId: true,
        quantity: true,
        job: {
          select: {
            number: true,
            name: true
          }
        }
      }
    });

    const balancesByMaterialId = new Map<string, typeof balances>();

    for (const balance of balances) {
      const existing = balancesByMaterialId.get(balance.materialId);
      if (existing) {
        existing.push(balance);
      } else {
        balancesByMaterialId.set(balance.materialId, [balance]);
      }
    }

    return {
      data: materials.map((material) => {
        const materialBalances = balancesByMaterialId.get(material.id) ?? [];
        const totalQuantity = materialBalances.reduce((sum, balance) => sum + balance.quantity, 0);
        const shopQuantity = materialBalances
          .filter((balance) => balance.locationType === 'SHOP')
          .reduce((sum, balance) => sum + balance.quantity, 0);
        const jobQuantities = materialBalances
          .filter((balance) => balance.locationType === 'JOB' && balance.job)
          .map((balance) => ({
            jobId: balance.jobId as string,
            jobLabel: `${balance.job?.number} — ${balance.job?.name}`,
            quantity: balance.quantity
          }))
          .sort((a, b) => a.jobLabel.localeCompare(b.jobLabel));

        return {
          materialId: material.id,
          materialSku: material.sku,
          materialName: material.name,
          unit: material.unit,
          minStock: material.minStock,
          totalQuantity,
          shopQuantity,
          jobQuantities
        };
      })
    };
  } catch (error) {
    console.error('Failed to load inventory balances:', error);
    return { data: [] };
  }
}

export async function listInventoryTransactions(): Promise<{ data: InventoryTransactionRecord[] }> {
  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      include: {
        material: true,
        locationFromJob: true,
        locationToJob: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      data: transactions.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        type: entry.transactionType,
        materialSku: entry.material.sku,
        materialName: entry.material.name,
        quantity: entry.quantity,
        unit: entry.material.unit,
        locationFrom: formatLocationLabel(entry.locationFromType, entry.locationFromJob),
        locationTo:
          entry.transactionType === 'ISSUE'
            ? 'Production / Consumption'
            : formatLocationLabel(entry.locationToType, entry.locationToJob),
        invoiceNumber: entry.invoiceNumber ?? '—',
        vendorName: entry.vendor ?? '—',
        notes: entry.notes ?? '—',
        hasPhoto: Boolean(entry.photoUrl)
      }))
    };
  } catch (error) {
    console.error('Failed to load inventory history:', error);
    return { data: [] };
  }
}

export async function getDashboardData(): Promise<DashboardView> {
  try {
    const [totalSku, openJobs, onHandAggregate, materials, balanceSums, balances, txns] = await Promise.all([
      prisma.material.count(),
      prisma.job.count({ where: { status: 'OPEN' } }),
      prisma.inventoryBalance.aggregate({ _sum: { quantity: true } }),
      prisma.material.findMany({
        select: {
          id: true,
          minStock: true
        }
      }),
      prisma.inventoryBalance.groupBy({
        by: ['materialId'],
        _sum: { quantity: true }
      }),
      prisma.inventoryBalance.findMany({
        include: {
          material: true,
          job: true
        },
        orderBy: [{ material: { name: 'asc' } }, { locationType: 'asc' }, { job: { number: 'asc' } }]
      }),
      listInventoryTransactions()
    ]);

    const quantityByMaterialId = new Map(balanceSums.map((entry) => [entry.materialId, entry._sum.quantity ?? 0]));

    const lowStock = materials.filter((material) => (quantityByMaterialId.get(material.id) ?? 0) < material.minStock).length;

    const inventoryRows: InventoryAtGlanceRow[] = balances.map((balance) => ({
      id: balance.id,
      materialName: balance.material.name,
      materialSku: balance.material.sku,
      locationLabel: balance.locationType === 'SHOP' ? 'SHOP' : `${balance.job?.number} — ${balance.job?.name}`,
      quantity: balance.quantity,
      unit: balance.material.unit
    }));

    return {
      totalSku,
      lowStock,
      openJobs,
      totalInventoryUnits: onHandAggregate._sum.quantity ?? 0,
      recentTransactions: txns.data.slice(0, 10),
      inventoryRows
    };
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    return {
      totalSku: 0,
      lowStock: 0,
      openJobs: 0,
      totalInventoryUnits: 0,
      recentTransactions: [],
      inventoryRows: []
    };
  }
}
