import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const materials = [
    {
      sku: 'PLY-3Q-001',
      name: '3/4" Birch Plywood',
      unit: 'sheet',
      quantity: 24,
      minStock: 8,
      notes: 'Preferred vendor: Timber Source'
    },
    {
      sku: 'HDF-1Q-002',
      name: '1/4" HDF Panel',
      unit: 'sheet',
      quantity: 30,
      minStock: 10,
      notes: 'Typical lead time: 2 days'
    },
    {
      sku: 'EDG-WHT-003',
      name: 'White Edge Banding',
      unit: 'roll',
      quantity: 12,
      minStock: 4,
      notes: 'Store in dry area'
    }
  ];

  const jobs = [
    { number: 'J-24031', name: 'Aspen Residence', status: 'OPEN' },
    { number: 'J-24044', name: 'Bayside Condos', status: 'OPEN' },
    { number: 'J-24051', name: 'Creekside Kitchen', status: 'CLOSED' }
  ];

  for (const material of materials) {
    await prisma.material.upsert({
      where: { sku: material.sku },
      update: {
        name: material.name,
        unit: material.unit,
        quantity: material.quantity,
        minStock: material.minStock,
        notes: material.notes
      },
      create: material
    });
  }

  for (const job of jobs) {
    await prisma.job.upsert({
      where: { number: job.number },
      update: {
        name: job.name,
        status: job.status
      },
      create: job
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
