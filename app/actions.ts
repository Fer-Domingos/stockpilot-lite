'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { jobs as seedJobs, materials as seedMaterials } from '@/lib/demo-data';
import { prisma } from '@/lib/prisma';

export type MaterialRecord = {
  id: string;
  name: string;
  sku: string;
  unit: string;
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

type ActionResult<T = undefined> = {
  ok: boolean;
  error?: string;
  data?: T;
};

type MaterialPayload = Omit<MaterialRecord, 'id'>;
type JobPayload = Omit<JobRecord, 'id'>;

const statuses: JobStatus[] = ['Open', 'In Progress', 'On Hold', 'Completed'];

function getFallbackMaterials(): MaterialRecord[] {
  return seedMaterials.map((material) => ({
    id: material.id,
    name: material.name,
    sku: material.sku,
    unit: material.unit,
    minStock: material.minQuantity,
    notes: material.supplier
  }));
}

function getFallbackJobs(): JobRecord[] {
  return seedJobs.map((job) => ({
    id: job.id,
    number: job.number,
    name: job.name,
    status: 'Open'
  }));
}

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

export async function listMaterials(): Promise<{ data: MaterialRecord[]; usingFallback: boolean }> {
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
        minStock: material.minStock,
        notes: material.notes
      })),
      usingFallback: false
    };
  } catch (error) {
    console.error('Failed to load materials from database:', error);

    return {
      data: getFallbackMaterials(),
      usingFallback: true
    };
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

export async function listJobs(): Promise<{ data: JobRecord[]; usingFallback: boolean }> {
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
      })),
      usingFallback: false
    };
  } catch (error) {
    console.error('Failed to load jobs from database:', error);

    return {
      data: getFallbackJobs(),
      usingFallback: true
    };
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

export async function receiveMaterial() {
  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/history');
  redirect('/receive-materials');
}

export async function transferMaterial() {
  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/history');
  redirect('/transfer-materials');
}

export async function issueMaterial() {
  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/history');
  redirect('/transfer-materials');
}
