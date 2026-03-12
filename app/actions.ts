'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createMaterial() {
  revalidatePath('/materials');
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
