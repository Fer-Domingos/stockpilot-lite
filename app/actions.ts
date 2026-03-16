'use server';

import { revalidatePath } from 'next/cache';
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

function normalizeMaterialPayload(payload: MaterialPayload): MaterialPayload {
  return {
    name: payload.name.trim(),
    sku: payload.sku.trim(),
    unit: payload.unit.trim(),
    minStock: Math.max(0, Math.floor(payload.minStock)),
    notes: payload.notes.trim()
  };
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
    include: {
      balances: true
    }
  });

  await prisma.$transaction(
    materials.map((material) =>
      prisma.material.update({
        where: { id: material.id },
        data: {
          quantity: material.balances.reduce((sum, balance) => sum + balance.quantity, 0)
        }
      })
    )
  );
}

export async function listMaterials(): Promise<{ data: MaterialRecord[] }> {
  try {
    const materials = await prisma.material.findMany({
      include: { balances: true },
      orderBy: { createdAt: 'asc' }
    });

    return {
      data: materials.map((material) => ({
        id: material.id,
        name: material.name,
        sku: material.sku,
        unit: material.unit,
        quantity: material.balances.reduce((sum, balance) => sum + balance.quantity, 0),
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
  try {
    const created = await prisma.material.create({
      data: normalizeMaterialPayload(payload)
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
    return { ok: false, error: 'Unable to save material right now.' };
  }
}

export async function updateMaterial(id: string, payload: MaterialPayload): Promise<ActionResult<MaterialRecord>> {
  try {
    const updated = await prisma.material.update({
      where: { id },
      data: normalizeMaterialPayload(payload)
    });
    revalidatePath('/materials');

    return {
      ok: true,
      data: {
        id: updated.id,
        name: updated.name,
        sku: updated.sku,
        unit: updated.unit,
        quantity: updated.quantity,
        minStock: updated.minStock,
        notes: updated.notes
      }
    };
  } catch (error) {
    console.error('Failed to update material:', error);
    return { ok: false, error: 'Unable to update material right now.' };
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
  const destinationType = String(formData.get('destinationType') ?? 'SHOP') as 'SHOP' | 'JOB';
  const jobId = String(formData.get('jobId') ?? '');
  const invoiceNumber = String(formData.get('invoiceNumber') ?? '').trim();
  const vendorName = String(formData.get('vendorName') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const photoUrl = String(formData.get('photoUrl') ?? '').trim();
  const quantity = Number(formData.get('quantity') ?? 0);

  if (!materialId || !Number.isFinite(quantity) || quantity <= 0 || !['SHOP', 'JOB'].includes(destinationType)) {
    redirect('/receive-materials?error=missing-required-fields');
  }

  if (destinationType === 'JOB' && !jobId) {
    redirect('/receive-materials?error=job-required-for-job-destination');
  }

  const normalizedQuantity = Math.floor(quantity);
  const receivedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      if (destinationType === 'JOB' && jobId) {
        const job = await tx.job.findUnique({ where: { id: jobId } });
        if (!job || job.status !== 'OPEN') {
          throw new Error('Destination job must be open.');
        }
      }

      await adjustInventoryBalance(tx, materialId, destinationType, destinationType === 'JOB' ? jobId : null, normalizedQuantity);

      await tx.receivingRecord.create({
        data: {
          materialId,
          quantity: normalizedQuantity,
          destinationType,
          jobId: destinationType === 'JOB' && jobId ? jobId : null,
          invoiceNumber: invoiceNumber || null,
          vendorName: vendorName || null,
          notes: notes || null,
          photoUrl: photoUrl || null,
          receivedAt
        }
      });

      await tx.inventoryTransaction.create({
        data: {
          materialId,
          transactionType: 'RECEIVE',
          quantity: normalizedQuantity,
          locationFromType: null,
          locationFromJobId: null,
          locationToType: destinationType,
          locationToJobId: destinationType === 'JOB' ? jobId : null,
          invoiceNumber: invoiceNumber || null,
          vendorName: vendorName || null,
          notes: notes || null,
          photoUrl: photoUrl || null,
          createdAt: receivedAt
        }
      });
    });

    await syncMaterialQuantitiesFromBalances();
  } catch (error) {
    console.error('Failed to receive material:', error);
    redirect('/receive-materials?error=save-failed');
  }

  revalidatePath('/dashboard');
  revalidatePath('/materials');
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
        vendorName: receipt.vendorName ?? '—',
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
      include: {
        balances: {
          include: {
            job: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return {
      data: materials.map((material) => {
        const totalQuantity = material.balances.reduce((sum, balance) => sum + balance.quantity, 0);
        const shopQuantity = material.balances
          .filter((balance) => balance.locationType === 'SHOP')
          .reduce((sum, balance) => sum + balance.quantity, 0);
        const jobQuantities = material.balances
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
        vendorName: entry.vendorName ?? '—',
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
  const [totalSku, openJobs, onHandAggregate, materialsWithBalances, balances, txns] = await Promise.all([
    prisma.material.count(),
    prisma.job.count({ where: { status: 'OPEN' } }),
    prisma.inventoryBalance.aggregate({ _sum: { quantity: true } }),
    prisma.material.findMany({
      include: { balances: true }
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

  const lowStock = materialsWithBalances.filter((material) => {
    const onHand = material.balances.reduce((sum, balance) => sum + balance.quantity, 0);
    return onHand < material.minStock;
  }).length;

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
}
