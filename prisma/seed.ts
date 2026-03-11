import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'manager@stockpilot.local' },
    update: {},
    create: {
      email: 'manager@stockpilot.local',
      name: 'Shop Manager'
    }
  });

  const shop = await prisma.location.upsert({
    where: { name: 'Shop' },
    update: {},
    create: { name: 'Shop' }
  });

  const materials = [
    { sku: 'PLY-3Q-001', name: '3/4" Birch Plywood', unit: 'sheet', quantity: 20, minQuantity: 8 },
    { sku: 'HDF-1Q-002', name: '1/4" HDF Panel', unit: 'sheet', quantity: 35, minQuantity: 10 },
    { sku: 'EDG-WHT-003', name: 'White Edge Banding', unit: 'roll', quantity: 12, minQuantity: 4 }
  ];

  for (const material of materials) {
    const upserted = await prisma.material.upsert({
      where: { sku: material.sku },
      update: {
        name: material.name,
        unit: material.unit,
        quantity: material.quantity,
        minQuantity: material.minQuantity
      },
      create: material
    });

    await prisma.inventoryTransaction.create({
      data: {
        materialId: upserted.id,
        userId: user.id,
        locationId: shop.id,
        type: TransactionType.RECEIVE,
        quantity: material.quantity,
        notes: 'Initial seed stock'
      }
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
