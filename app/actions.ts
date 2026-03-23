'use server';

import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { InventoryLocationType, Prisma, PurchaseOrderAlertStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { authConfig, decodeSession } from '@/lib/session';
import { AppRole } from '@/lib/demo-data';

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

export type AlertStatus = 'OPEN' | 'TRIGGERED' | 'SEEN' | 'RESOLVED';

export type ExpectedPurchaseOrderRecord = {
  id: string;
  ownerId: string | null;
  ownerEmail: string;
  poNumber: string;
  normalizedPoNumber: string;
  jobId: string | null;
  jobLabel: string;
  note: string;
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt: string | null;
  seenAt: string | null;
  resolvedAt: string | null;
  triggerCount: number;
  latestAlertId: string | null;
  latestAlertMessage: string;
  latestAlertReceiptId: string | null;
  latestAlertInvoiceNumber: string;
  latestAlertMaterialName: string;
  latestAlertMaterialSku: string;
};

export type PurchaseOrderAlertRecord = {
  id: string;
  ownerId: string | null;
  ownerEmail: string;
  expectedPoId: string;
  poNumber: string;
  normalizedPoNumber: string;
  relatedJobLabel: string;
  note: string;
  status: AlertStatus;
  message: string;
  receivingRecordId: string;
  materialName: string;
  materialSku: string;
  invoiceNumber: string;
  createdAt: string;
  updatedAt: string;
  seenAt: string | null;
  resolvedAt: string | null;
  triggerCount: number;
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
  trackedPoAlerts: ExpectedPurchaseOrderRecord[];
  poAlerts: PurchaseOrderAlertRecord[];
  activeAlertCount: number;
};

export type ReportsInventoryRow = {
  materialId: string;
  materialSku: string;
  materialName: string;
  unit: string;
  shopQuantity: number;
  totalJobQuantity: number;
  totalQuantity: number;
};

export type TopUsedMaterialRow = {
  materialId: string;
  materialSku: string;
  materialName: string;
  unit: string;
  issueCount: number;
  issuedQuantity: number;
};

export type ReportsActivitySummary = {
  totalTransactions: number;
  receiveCount: number;
  transferCount: number;
  issueCount: number;
  adjustmentCount: number;
  receiveQuantity: number;
  issueQuantity: number;
};

export type ReportsView = {
  filters: {
    startDate: string | null;
    endDate: string | null;
    jobId: string | null;
    materialId: string | null;
  };
  filterOptions: {
    jobs: Array<{ id: string; number: string; name: string }>;
    materials: Array<{ id: string; sku: string; name: string }>;
  };
  reportMetadata: {
    mode: 'General' | 'Specific Job' | 'Specific Material' | 'Specific Job + Specific Material';
    selectedJob: { id: string; number: string; name: string } | null;
    selectedMaterial: { id: string; sku: string; name: string; unit: string } | null;
  };
  inventorySummary: {
    materialCount: number;
    rows: ReportsInventoryRow[];
  };
  topMaterials: TopUsedMaterialRow[];
  activitySummary: ReportsActivitySummary;
  recentActivity: InventoryTransactionRecord[];
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

type TransactionLocationInput = {
  locationType: InventoryLocationType | null;
  jobId: string | null;
};

type ReportsFilterInput = {
  startDate?: string;
  endDate?: string;
  jobId?: string;
  materialId?: string;
};

const statuses: JobStatus[] = ['OPEN', 'CLOSED'];
const materialUnits = ['UNIT', 'SHEETS'] as const;



async function getCurrentSession() {
  const sessionToken = cookies().get(authConfig.sessionCookieName)?.value;
  return decodeSession(sessionToken);
}

async function getCurrentRole(): Promise<AppRole> {
  const session = await getCurrentSession();
  return session?.role === 'PM' ? 'PM' : 'ADMIN';
}

async function requireRole(...allowedRoles: AppRole[]) {
  const role = await getCurrentRole();

  if (!allowedRoles.includes(role)) {
    throw new Error('You are not authorized to perform this action.');
  }

  return role;
}

function normalizeTrackedPoNumber(value: string): string {
  return value.trim().toUpperCase();
}

function serializeAlertStatus(status: PurchaseOrderAlertStatus): AlertStatus {
  return status;
}

async function getCurrentSessionUser() {
  const session = await getCurrentSession();

  if (!session?.email) {
    return null;
  }

  return prisma.adminUser.findUnique({
    where: { email: session.email.toLowerCase().trim() },
    select: { id: true, email: true }
  });
}

async function buildAlertAccessFilter(role: AppRole) {
  if (role === 'ADMIN') {
    return {};
  }

  const currentUser = await getCurrentSessionUser();

  if (!currentUser) {
    return { ownerId: '__missing_user__' };
  }

  return { ownerId: currentUser.id };
}

async function updateTrackedPurchaseOrderStatus(
  expectedPoId: string,
  status: AlertStatus,
  role: AppRole = 'ADMIN'
) {
  const currentUser = await getCurrentSessionUser();
  const trackedPo = await prisma.expectedPurchaseOrder.findUnique({
    where: { id: expectedPoId },
    select: {
      id: true,
      ownerId: true,
      seenAt: true
    }
  });

  if (!trackedPo) {
    redirect('/alerts?error=invalid-alert');
  }

  if (role === 'PM') {
    if (!currentUser || !trackedPo.ownerId || trackedPo.ownerId !== currentUser.id) {
      redirect('/alerts?error=invalid-alert');
    }
  }

  const now = new Date();
  const data: Prisma.ExpectedPurchaseOrderUpdateInput = { status };

  if (status === 'SEEN') {
    data.seenAt = trackedPo.seenAt ?? now;
    data.resolvedAt = null;
  }

  if (status === 'RESOLVED') {
    data.seenAt = trackedPo.seenAt ?? now;
    data.resolvedAt = now;
  }

  if (status === 'TRIGGERED') {
    data.resolvedAt = null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.expectedPurchaseOrder.update({
      where: { id: expectedPoId },
      data
    });

    await tx.purchaseOrderAlert.updateMany({
      where: {
        expectedPoId,
        status: {
          not: 'RESOLVED'
        }
      },
      data: {
        status,
        seenAt: status === 'SEEN' || status === 'RESOLVED' ? trackedPo.seenAt ?? now : null,
        resolvedAt: status === 'RESOLVED' ? now : null
      }
    });
  });

  revalidatePath('/alerts');
  revalidatePath('/dashboard');
  revalidatePath('/po-alerts');
  revalidatePath('/receive-materials');
}

function formatExpectedPoMutationError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return 'That PO number is already being tracked.';
    }

    if (error.code === 'P2021' || error.code === 'P2022') {
      return 'PO tracking tables are missing. Run the latest Prisma migrations and try again.';
    }
  }

  return 'Unable to save tracked PO right now.';
}

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

function normalizeTransactionLocation(
  fieldName: 'locationFromType' | 'locationToType',
  input: TransactionLocationInput
): TransactionLocationInput {
  const { locationType, jobId } = input;

  if (locationType === null) {
    return { locationType: null, jobId: null };
  }

  if (locationType === 'SHOP') {
    return { locationType: 'SHOP', jobId: null };
  }

  if (locationType === 'JOB') {
    if (!jobId) {
      throw new Error(`${fieldName} cannot be JOB without a job id.`);
    }

    return { locationType: 'JOB', jobId };
  }

  throw new Error(`${fieldName} must be SHOP, JOB, or null.`);
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

function parseDateFilterBoundary(value: string | undefined, boundary: 'start' | 'end'): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  if (boundary === 'end') {
    parsed.setUTCDate(parsed.getUTCDate() + 1);
  }

  return parsed;
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
  try {
    await requireRole('ADMIN');
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unauthorized.' };
  }

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
  try {
    await requireRole('ADMIN');
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unauthorized.' };
  }

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
    await requireRole('ADMIN');
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
    await requireRole('ADMIN');
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
    await requireRole('ADMIN');
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
    await requireRole('ADMIN');
    await prisma.job.delete({ where: { id } });
    revalidatePath('/jobs');
    return { ok: true };
  } catch (error) {
    console.error('Failed to delete job:', error);
    return { ok: false, error: 'Unable to delete job right now.' };
  }
}


export async function getActiveAlertCount(role: AppRole = 'ADMIN'): Promise<number> {
  noStore();

  try {
    const accessFilter = await buildAlertAccessFilter(role);

    return await prisma.expectedPurchaseOrder.count({
      where: {
        ...accessFilter,
        status: {
          in: ['OPEN', 'TRIGGERED']
        }
      }
    });
  } catch (error) {
    console.error('Failed to load active alert count:', error);
    return 0;
  }
}

export async function listExpectedPurchaseOrders(role: AppRole = 'ADMIN'): Promise<{ data: ExpectedPurchaseOrderRecord[] }> {
  noStore();

  try {
    const accessFilter = await buildAlertAccessFilter(role);

    const rows = await prisma.expectedPurchaseOrder.findMany({
      where: accessFilter,
      include: {
        owner: {
          select: {
            email: true
          }
        },
        job: {
          select: {
            number: true,
            name: true
          }
        },
        alerts: {
          include: {
            receivingRecord: {
              include: {
                material: {
                  select: {
                    name: true,
                    sku: true
                  }
                }
              }
            }
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1
        }
      },
      orderBy: [{ createdAt: 'desc' }, { poNumber: 'asc' }]
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        ownerId: row.ownerId,
        ownerEmail: row.owner?.email ?? 'Unassigned',
        poNumber: row.poNumber,
        normalizedPoNumber: row.normalizedPoNumber,
        jobId: row.jobId,
        jobLabel: row.job ? `${row.job.number} — ${row.job.name}` : '—',
        note: row.note ?? '',
        status: serializeAlertStatus(row.status),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lastTriggeredAt: row.lastTriggeredAt?.toISOString() ?? null,
        seenAt: row.seenAt?.toISOString() ?? null,
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        triggerCount: row.triggerCount,
        latestAlertId: row.alerts[0]?.id ?? null,
        latestAlertMessage: row.alerts[0]?.message ?? '',
        latestAlertReceiptId: row.alerts[0]?.receivingRecordId ?? null,
        latestAlertInvoiceNumber: row.alerts[0]?.receivingRecord.invoiceNumber ?? '—',
        latestAlertMaterialName: row.alerts[0]?.receivingRecord.material.name ?? '—',
        latestAlertMaterialSku: row.alerts[0]?.receivingRecord.material.sku ?? '—'
      }))
    };
  } catch (error) {
    console.error('Failed to load tracked PO numbers:', error);
    return { data: [] };
  }
}

export async function createExpectedPurchaseOrder(formData: FormData) {
  await requireRole('ADMIN', 'PM');

  const poNumber = String(formData.get('poNumber') ?? '').trim();
  const normalizedPoNumber = normalizeTrackedPoNumber(poNumber);
  const jobIdValue = String(formData.get('jobId') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  const jobId = jobIdValue || null;

  if (!poNumber) {
    redirect('/po-alerts?error=missing-po-number');
  }

  if (jobId) {
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
    if (!job) {
      redirect('/po-alerts?error=invalid-job');
    }
  }

  try {
    const currentUser = await getCurrentSessionUser();

    await prisma.expectedPurchaseOrder.create({
      data: {
        poNumber,
        normalizedPoNumber,
        jobId,
        note: note || null,
        ownerId: currentUser?.id ?? null
      }
    });
  } catch (error) {
    console.error('Failed to create tracked PO:', error);
    redirect(`/po-alerts?error=save-failed&message=${encodeURIComponent(formatExpectedPoMutationError(error))}`);
  }

  revalidatePath('/po-alerts');
  revalidatePath('/alerts');
  revalidatePath('/dashboard');
  revalidatePath('/receive-materials');
  redirect('/po-alerts?success=1');
}

export async function markPurchaseOrderAlertSeen(formData: FormData) {
  await requireRole('ADMIN');

  const expectedPoId = String(formData.get('expectedPoId') ?? '').trim();
  const role = await getCurrentRole();

  if (!expectedPoId) {
    redirect('/alerts?error=invalid-alert');
  }

  await updateTrackedPurchaseOrderStatus(expectedPoId, 'SEEN', role);

  redirect(`/alerts?role=${encodeURIComponent(role)}&success=seen`);
}

export async function markPurchaseOrderAlertResolved(formData: FormData) {
  await requireRole('ADMIN');

  const expectedPoId = String(formData.get('expectedPoId') ?? '').trim();
  const role = await getCurrentRole();

  if (!expectedPoId) {
    redirect('/alerts?error=invalid-alert');
  }

  await updateTrackedPurchaseOrderStatus(expectedPoId, 'RESOLVED', role);

  redirect(`/alerts?role=${encodeURIComponent(role)}&success=resolved`);
}

export async function listPurchaseOrderAlerts(limit = 10, role: AppRole = 'ADMIN'): Promise<{ data: PurchaseOrderAlertRecord[] }> {
  noStore();

  try {
    const accessFilter = await buildAlertAccessFilter(role);

    const alerts = await prisma.purchaseOrderAlert.findMany({
      where: {
        expectedPo: accessFilter
      },
      include: {
        owner: {
          select: {
            email: true
          }
        },
        expectedPo: {
          include: {
            owner: {
              select: { email: true }
            },
            job: {
              select: { number: true, name: true }
            }
          }
        },
        receivingRecord: {
          include: {
            material: { select: { name: true, sku: true } }
          }
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit
    });

    return {
      data: alerts.map((alert) => ({
        id: alert.id,
        ownerId: alert.ownerId ?? alert.expectedPo.ownerId,
        ownerEmail: alert.owner?.email ?? alert.expectedPo.owner?.email ?? 'Unassigned',
        expectedPoId: alert.expectedPoId,
        poNumber: alert.expectedPo.poNumber,
        normalizedPoNumber: alert.expectedPo.normalizedPoNumber,
        relatedJobLabel: alert.expectedPo.job ? `${alert.expectedPo.job.number} — ${alert.expectedPo.job.name}` : '—',
        note: alert.expectedPo.note ?? '',
        status: serializeAlertStatus(alert.status),
        message: alert.message,
        receivingRecordId: alert.receivingRecordId,
        materialName: alert.receivingRecord.material.name,
        materialSku: alert.receivingRecord.material.sku,
        invoiceNumber: alert.receivingRecord.invoiceNumber ?? '—',
        createdAt: alert.createdAt.toISOString(),
        updatedAt: alert.updatedAt.toISOString(),
        seenAt: alert.seenAt?.toISOString() ?? null,
        resolvedAt: alert.resolvedAt?.toISOString() ?? null,
        triggerCount: alert.triggerCount
      }))
    };
  } catch (error) {
    console.error('Failed to load PO alerts:', error);
    return { data: [] };
  }
}

export async function receiveMaterial(formData: FormData) {
  try {
    await requireRole('ADMIN');
  } catch (error) {
    redirect(`/receive-materials?error=save-failed&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unauthorized.')}`);
  }

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
      const normalizedToLocation = normalizeTransactionLocation('locationToType', {
        locationType: destinationType,
        jobId: destinationJobId
      });

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

      const matchedExpectedPo = await tx.expectedPurchaseOrder.findUnique({
        where: {
          normalizedPoNumber: normalizeTrackedPoNumber(invoiceNumber)
        },
        include: {
          job: {
            select: {
              number: true,
              name: true
            }
          }
        }
      });

      if (matchedExpectedPo) {
        const relatedJobLabel = matchedExpectedPo.job
          ? `${matchedExpectedPo.job.number} — ${matchedExpectedPo.job.name}`
          : 'no related job';
        const message = `Tracked PO ${matchedExpectedPo.poNumber} matched receipt ${invoiceNumber} for ${normalizedQuantity} unit(s). Related job: ${relatedJobLabel}.`;
        const openNotification = await tx.purchaseOrderAlert.findFirst({
          where: {
            expectedPoId: matchedExpectedPo.id,
            status: {
              not: 'RESOLVED'
            }
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
        });

        if (openNotification) {
          await tx.purchaseOrderAlert.update({
            where: { id: openNotification.id },
            data: {
              receivingRecordId: receipt.id,
              ownerId: matchedExpectedPo.ownerId,
              message,
              status: 'TRIGGERED',
              seenAt: null,
              resolvedAt: null,
              triggerCount: {
                increment: 1
              }
            }
          });
        } else {
          await tx.purchaseOrderAlert.create({
            data: {
              expectedPoId: matchedExpectedPo.id,
              receivingRecordId: receipt.id,
              ownerId: matchedExpectedPo.ownerId,
              message,
              status: 'TRIGGERED',
              triggerCount: 1
            }
          });
        }

        await tx.expectedPurchaseOrder.update({
          where: { id: matchedExpectedPo.id },
          data: {
            status: 'TRIGGERED',
            lastTriggeredAt: receivedAt,
            seenAt: null,
            resolvedAt: null,
            triggerCount: {
              increment: 1
            }
          }
        });
      }

      await adjustInventoryBalance(tx, materialId, destinationType, destinationJobId, normalizedQuantity);

      await tx.inventoryTransaction.create({
        data: {
          materialId,
          transactionType: 'RECEIVE',
          quantity: normalizedQuantity,
          locationFromType: null,
          locationFromJobId: null,
          locationToType: normalizedToLocation.locationType,
          locationToJobId: normalizedToLocation.jobId,
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
      } else if (error.code === 'P2021') {
        message = `Database schema is out of date (missing table: ${String(error.meta?.table ?? 'unknown')}). Run Prisma migrations.`;
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
  revalidatePath('/po-alerts');
  revalidatePath('/alerts');
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
  try {
    await requireRole('ADMIN');
  } catch (error) {
    redirect('/transfer-materials?error=save-failed');
  }

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
      const normalizedFromLocation = normalizeTransactionLocation('locationFromType', {
        locationType: source.locationType,
        jobId: source.jobId
      });
      const normalizedToLocation = normalizeTransactionLocation('locationToType', {
        locationType: destination.locationType,
        jobId: destination.jobId
      });

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
          locationFromType: normalizedFromLocation.locationType,
          locationFromJobId: normalizedFromLocation.jobId,
          locationToType: normalizedToLocation.locationType,
          locationToJobId: normalizedToLocation.jobId,
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
  try {
    await requireRole('ADMIN');
  } catch (error) {
    redirect('/issue-materials?error=save-failed');
  }

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
      const normalizedFromLocation = normalizeTransactionLocation('locationFromType', {
        locationType: source.locationType,
        jobId: source.jobId
      });

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
          locationFromType: normalizedFromLocation.locationType,
          locationFromJobId: normalizedFromLocation.jobId,
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

export async function getDashboardData(role: AppRole = 'ADMIN'): Promise<DashboardView> {
  try {
    const [totalSku, openJobs, onHandAggregate, materials, balanceSums, balances, txns, trackedPoAlerts, poAlerts, activeAlertCount] = await Promise.all([
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
      listInventoryTransactions(),
      listExpectedPurchaseOrders(role),
      listPurchaseOrderAlerts(6, role),
      getActiveAlertCount(role)
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
      inventoryRows,
      trackedPoAlerts: trackedPoAlerts.data,
      poAlerts: poAlerts.data,
      activeAlertCount
    };
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    return {
      totalSku: 0,
      lowStock: 0,
      openJobs: 0,
      totalInventoryUnits: 0,
      recentTransactions: [],
      inventoryRows: [],
      trackedPoAlerts: [],
      poAlerts: [],
      activeAlertCount: 0
    };
  }
}

export async function getReportsData(filters: ReportsFilterInput = {}): Promise<{ data: ReportsView }> {
  noStore();

  const normalizedStartDate = filters.startDate?.trim() || null;
  const normalizedEndDate = filters.endDate?.trim() || null;
  const normalizedJobId = filters.jobId?.trim() || null;
  const normalizedMaterialId = filters.materialId?.trim() || null;
  const startDate = parseDateFilterBoundary(normalizedStartDate ?? undefined, 'start');
  const endDateExclusive = parseDateFilterBoundary(normalizedEndDate ?? undefined, 'end');

  const createdAtFilter: Prisma.DateTimeFilter = {};

  if (startDate) {
    createdAtFilter.gte = startDate;
  }

  if (endDateExclusive) {
    createdAtFilter.lt = endDateExclusive;
  }

  const transactionWhere: Prisma.InventoryTransactionWhereInput = {};

  if (Object.keys(createdAtFilter).length > 0) {
    transactionWhere.createdAt = createdAtFilter;
  }

  if (normalizedMaterialId) {
    transactionWhere.materialId = normalizedMaterialId;
  }

  if (normalizedJobId) {
    transactionWhere.OR = [
      { locationFromJobId: normalizedJobId },
      { locationToJobId: normalizedJobId }
    ];
  }

  const resolvedTransactionWhere = Object.keys(transactionWhere).length > 0 ? transactionWhere : undefined;

  try {
    const [materials, jobs, balances, transactions, issueGroups, activityCounts] = await Promise.all([
      prisma.material.findMany({
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true
        },
        orderBy: { name: 'asc' }
      }),
      prisma.job.findMany({
        select: {
          id: true,
          number: true,
          name: true
        },
        orderBy: [{ number: 'asc' }, { name: 'asc' }]
      }),
      prisma.inventoryBalance.findMany({
        include: {
          material: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true
            }
          },
          job: {
            select: {
              id: true,
              number: true,
              name: true
            }
          }
        },
        orderBy: [{ material: { name: 'asc' } }, { locationType: 'asc' }, { job: { number: 'asc' } }]
      }),
      prisma.inventoryTransaction.findMany({
        where: resolvedTransactionWhere,
        include: {
          material: true,
          locationFromJob: true,
          locationToJob: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      prisma.inventoryTransaction.groupBy({
        by: ['materialId'],
        where: {
          transactionType: 'ISSUE',
          ...(resolvedTransactionWhere ?? {})
        },
        _sum: { quantity: true },
        _count: { _all: true },
        orderBy: {
          _sum: {
            quantity: 'desc'
          }
        },
        take: 5
      }),
      prisma.inventoryTransaction.groupBy({
        by: ['transactionType'],
        where: resolvedTransactionWhere,
        _count: { _all: true },
        _sum: { quantity: true }
      })
    ]);

    const selectedJob = jobs.find((job) => job.id === normalizedJobId) ?? null;
    const selectedMaterial = materials.find((material) => material.id === normalizedMaterialId) ?? null;

    const reportMode: ReportsView['reportMetadata']['mode'] =
      selectedJob && selectedMaterial
        ? 'Specific Job + Specific Material'
        : selectedJob
          ? 'Specific Job'
          : selectedMaterial
            ? 'Specific Material'
            : 'General';

    const selectedJobMaterialIds = selectedJob
      ? new Set(
          balances
            .filter(
              (balance) =>
                balance.locationType === 'JOB' &&
                balance.jobId === selectedJob.id &&
                (!selectedMaterial || balance.materialId === selectedMaterial.id)
            )
            .map((balance) => balance.materialId)
        )
      : null;

    const visibleBalances = balances.filter((balance) => {
      if (selectedMaterial && balance.materialId !== selectedMaterial.id) {
        return false;
      }

      if (!selectedJob) {
        return true;
      }

      if (balance.locationType === 'JOB') {
        return balance.jobId === selectedJob.id;
      }

      return selectedJobMaterialIds?.has(balance.materialId) ?? false;
    });

    const inventorySummaryByMaterial = new Map<string, ReportsInventoryRow>();

    for (const balance of visibleBalances) {
      const existing = inventorySummaryByMaterial.get(balance.materialId) ?? {
        materialId: balance.materialId,
        materialSku: balance.material.sku,
        materialName: balance.material.name,
        unit: balance.material.unit,
        shopQuantity: 0,
        totalJobQuantity: 0,
        totalQuantity: 0
      };

      if (balance.locationType === 'SHOP') {
        existing.shopQuantity += balance.quantity;
      } else {
        existing.totalJobQuantity += balance.quantity;
      }

      existing.totalQuantity += balance.quantity;
      inventorySummaryByMaterial.set(balance.materialId, existing);
    }

    const inventoryRows = Array.from(inventorySummaryByMaterial.values()).sort((a, b) =>
      a.materialName.localeCompare(b.materialName)
    );

    const issueMaterialIds = issueGroups.map((entry) => entry.materialId);
    const issueMaterialMap = new Map(materials.filter((material) => issueMaterialIds.includes(material.id)).map((material) => [material.id, material]));

    const topMaterials: TopUsedMaterialRow[] = issueGroups
      .map((entry) => {
        const material = issueMaterialMap.get(entry.materialId);

        if (!material) {
          return null;
        }

        return {
          materialId: material.id,
          materialSku: material.sku,
          materialName: material.name,
          unit: material.unit,
          issueCount: entry._count._all,
          issuedQuantity: Math.abs(entry._sum.quantity ?? 0)
        };
      })
      .filter((entry): entry is TopUsedMaterialRow => entry !== null);

    const recentActivity: InventoryTransactionRecord[] = transactions.map((entry) => ({
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
    }));

    const summaryByType = new Map(activityCounts.map((entry) => [entry.transactionType, entry]));

    return {
      data: {
        filters: {
          startDate: normalizedStartDate,
          endDate: normalizedEndDate,
          jobId: selectedJob?.id ?? null,
          materialId: selectedMaterial?.id ?? null
        },
        filterOptions: {
          jobs,
          materials: materials.map((material) => ({
            id: material.id,
            sku: material.sku,
            name: material.name
          }))
        },
        reportMetadata: {
          mode: reportMode,
          selectedJob,
          selectedMaterial
        },
        inventorySummary: {
          materialCount: inventoryRows.length,
          rows: inventoryRows
        },
        topMaterials,
        activitySummary: {
          totalTransactions: activityCounts.reduce((sum, entry) => sum + entry._count._all, 0),
          receiveCount: summaryByType.get('RECEIVE')?._count._all ?? 0,
          transferCount: summaryByType.get('TRANSFER')?._count._all ?? 0,
          issueCount: summaryByType.get('ISSUE')?._count._all ?? 0,
          adjustmentCount: summaryByType.get('ADJUSTMENT')?._count._all ?? 0,
          receiveQuantity: summaryByType.get('RECEIVE')?._sum.quantity ?? 0,
          issueQuantity: Math.abs(summaryByType.get('ISSUE')?._sum.quantity ?? 0)
        },
        recentActivity
      }
    };
  } catch (error) {
    console.error('Failed to load reports data:', error);

    return {
      data: {
        filters: {
          startDate: normalizedStartDate,
          endDate: normalizedEndDate,
          jobId: normalizedJobId,
          materialId: normalizedMaterialId
        },
        filterOptions: {
          jobs: [],
          materials: []
        },
        reportMetadata: {
          mode: normalizedJobId && normalizedMaterialId
            ? 'Specific Job + Specific Material'
            : normalizedJobId
              ? 'Specific Job'
              : normalizedMaterialId
                ? 'Specific Material'
                : 'General',
          selectedJob: null,
          selectedMaterial: null
        },
        inventorySummary: {
          materialCount: 0,
          rows: []
        },
        topMaterials: [],
        activitySummary: {
          totalTransactions: 0,
          receiveCount: 0,
          transferCount: 0,
          issueCount: 0,
          adjustmentCount: 0,
          receiveQuantity: 0,
          issueQuantity: 0
        },
        recentActivity: []
      }
    };
  }
}
