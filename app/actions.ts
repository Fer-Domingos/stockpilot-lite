'use server';

import { TransactionType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

async function getDefaultUserId() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (user) return user.id;

  const created = await prisma.user.create({
    data: {
      email: 'manager@stockpilot.local',
      name: 'Shop Manager'
    }
  });
  return created.id;
}

async function getDefaultLocationId() {
  const location = await prisma.location.findUnique({ where: { name: 'Shop' } });
  if (location) return location.id;

  const created = await prisma.location.create({ data: { name: 'Shop' } });
  return created.id;
}

export async function createMaterial(formData: FormData) {
  const sku = String(formData.get('sku') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const unit = String(formData.get('unit') ?? '').trim();
  const minQuantity = Number(formData.get('minQuantity') ?? 0);

  if (!sku || !name || !unit) {
    return;
  }

  await prisma.material.create({
    data: {
      sku,
      name,
      unit,
      minQuantity,
      quantity: 0
    }
  });

  revalidatePath('/materials');
  revalidatePath('/dashboard');
}

export async function receiveMaterial(formData: FormData) {
  const materialId = String(formData.get('materialId') ?? '');
  const quantity = Number(formData.get('quantity') ?? 0);
  const notes = String(formData.get('notes') ?? '').trim();

  if (!materialId || quantity <= 0) return;

  const [userId, locationId] = await Promise.all([getDefaultUserId(), getDefaultLocationId()]);

  await prisma.$transaction(async (tx) => {
    await tx.material.update({
      where: { id: materialId },
      data: {
        quantity: { increment: quantity }
      }
    });

    await tx.inventoryTransaction.create({
      data: {
        materialId,
        userId,
        locationId,
        quantity,
        notes,
        type: TransactionType.RECEIVE
      }
    });
  });

  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/history');
  redirect('/receive-materials');
}

export async function issueMaterial(formData: FormData) {
  const materialId = String(formData.get('materialId') ?? '');
  const quantity = Number(formData.get('quantity') ?? 0);
  const notes = String(formData.get('notes') ?? '').trim();

  if (!materialId || quantity <= 0) return;

  const [userId, locationId] = await Promise.all([getDefaultUserId(), getDefaultLocationId()]);

  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material || material.quantity < quantity) return;

  await prisma.$transaction(async (tx) => {
    await tx.material.update({
      where: { id: materialId },
      data: {
        quantity: { decrement: quantity }
      }
    });

    await tx.inventoryTransaction.create({
      data: {
        materialId,
        userId,
        locationId,
        quantity,
        notes,
        type: TransactionType.ISSUE
      }
    });
  });

  revalidatePath('/dashboard');
  revalidatePath('/materials');
  revalidatePath('/history');
  redirect('/issue-materials');
}
