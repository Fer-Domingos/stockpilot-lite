'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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

export type JobStatus = 'Open' | 'In Progress' | 'On Hold' | 'Completed';

export type JobRecord = {
  id: string;
  number: string;
  name: string;
  status: JobStatus;
};

export type InventoryTransactionRecord = {
  id: string;
  createdAt: string;
  type: 'RECEIVE' | 'TRANSFER';
  materialSku: string;
  materialName: string;
  quantity: number;
  unit: string;
  locationFrom: string;
  locationTo: string;
};

type ActionResult<T = undefined> = {
  ok: boolean;
  error?: string;
  data?: T;
};

type MaterialPayload = Omit<MaterialRecord, 'id' | 'quantity'>;
type JobPayload = Omit<JobRecord, 'id'>;

const statuses: JobStatus[] = ['Open', 'In Progress', 'On Hold', 'Completed'];

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
  const status = statuses.includes(payload.status) ? payload.status : 'Open';

  return {
    number: payload.number.trim(),
    name: payload.name.trim(),
    status
  };
}

function formatLocationLabel(locationValue: string, jobsById: Map<string, JobRecord>) {
  if (locationValue === 'shop') {
    return 'Shop';
  }

  if (locationValue.startsWith('loc-')) {
    const jobId = locationValue.replace('loc-', '');
    const job = jobsById.get(jobId);
    return job ? `${job.number} — ${job.name}` : locationValue;
  }

  return locationValue;
}

export async function listMaterials(): Promise<{ data: MaterialRecord[] }> {
  try {
    const materials = await prisma.material.findMany({
      orderBy: { createdAt: 'asc' }
    });

    return {
      data: materials.map((material) => ({
        id: material.id,
        name: material.name,
        sku: material.sku,
        unit: material.unit,
        quantity: material.quantity,
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
        status: statuses.includes(job.status as JobStatus) ? (job.status as JobStatus) : 'Open'
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
        status: statuses.includes(created.status as JobStatus) ? (created.status as JobStatus) : 'Open'
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
        status: statuses.includes(updated.status as JobStatus) ? (updated.status as JobStatus) : 'Open'
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
  const destinationType = String(formData.get('destinationType') ?? 'SHOP');
  const jobId = String(formData.get('jobId') ?? '');
  const quantity = Number(formData.get('quantity') ?? 0);

  if (!materialId || !Number.isFinite(quantity) || quantity <= 0) {
    redirect('/receive-materials');
  }

  const normalizedQuantity = Math.floor(quantity);

  await prisma.$transaction(async (tx) => {
    await tx.material.update({
      where: { id: materialId },
      data: { quantity: { increment: normalizedQuantity } }
    });

    const locationTo = destinationType === 'JOB' && jobId ? `loc-${jobId}` : 'shop';
    await tx.inventoryTransaction.create({
      data: {
        materialId,
        jobId: destinationType === 'JOB' && jobId ? jobId : null,
        quantity: normalizedQuantity,
        type: 'RECEIVE',
        locationFrom: null,
        locationTo
      }
    });
  });

  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/history');
  redirect('/receive-materials');
}

export async function transferMaterial(formData: FormData) {
  const materialId = String(formData.get('materialId') ?? '');
  const fromLocation = String(formData.get('fromLocation') ?? '');
  const toLocation = String(formData.get('toLocation') ?? '');
  const quantity = Number(formData.get('quantity') ?? 0);

  if (!materialId || !fromLocation || !toLocation || !Number.isFinite(quantity) || quantity <= 0 || fromLocation === toLocation) {
    redirect('/transfer-materials');
  }

  const normalizedQuantity = Math.floor(quantity);
  const toJobId = toLocation.startsWith('loc-') ? toLocation.replace('loc-', '') : null;

  await prisma.$transaction(async (tx) => {
    if (fromLocation === 'shop') {
      const material = await tx.material.findUnique({ where: { id: materialId } });
      if (!material || material.quantity < normalizedQuantity) {
        throw new Error('Insufficient stock for transfer.');
      }

      await tx.material.update({
        where: { id: materialId },
        data: { quantity: { decrement: normalizedQuantity } }
      });
    }

    await tx.inventoryTransaction.create({
      data: {
        materialId,
        jobId: toJobId,
        quantity: normalizedQuantity,
        type: 'TRANSFER',
        locationFrom: fromLocation,
        locationTo: toLocation
      }
    });
  });

  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/history');
  redirect('/transfer-materials');
}

export async function listInventoryTransactions(): Promise<{ data: InventoryTransactionRecord[] }> {
  try {
    const [jobsResult, transactions] = await Promise.all([
      listJobs(),
      prisma.inventoryTransaction.findMany({
        include: {
          material: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const jobsById = new Map(jobsResult.data.map((job) => [job.id, job]));

    return {
      data: transactions.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        type: entry.type,
        materialSku: entry.material.sku,
        materialName: entry.material.name,
        quantity: entry.quantity,
        unit: entry.material.unit,
        locationFrom: entry.locationFrom ? formatLocationLabel(entry.locationFrom, jobsById) : 'Vendor',
        locationTo: entry.locationTo ? formatLocationLabel(entry.locationTo, jobsById) : 'N/A'
      }))
    };
  } catch (error) {
    console.error('Failed to load inventory history:', error);
    return { data: [] };
  }
}

export async function issueMaterial() {
  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/history');
  redirect('/transfer-materials');
}
