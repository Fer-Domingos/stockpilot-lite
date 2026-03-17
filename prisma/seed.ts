import { randomBytes, scryptSync } from 'crypto';
import { JobStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const materials = [
    {
      sku: 'PLY-3Q-001',
      name: '3/4" Birch Plywood',
      unit: 'SHEETS',
      quantity: 24,
      minStock: 8,
      notes: 'Preferred vendor: Timber Source'
    },
    {
      sku: 'HDF-1Q-002',
      name: '1/4" HDF Panel',
      unit: 'SHEETS',
      quantity: 30,
      minStock: 10,
      notes: 'Typical lead time: 2 days'
    },
    {
      sku: 'EDG-WHT-003',
      name: 'White Edge Banding',
      unit: 'UNIT',
      quantity: 12,
      minStock: 4,
      notes: 'Store in dry area'
    }
  ];

  const jobs = [
    { number: 'J-24031', name: 'Aspen Residence', status: JobStatus.OPEN },
    { number: 'J-24044', name: 'Bayside Condos', status: JobStatus.OPEN },
    { number: 'J-24051', name: 'Creekside Kitchen', status: JobStatus.CLOSED }
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

  await prisma.adminUser.upsert({
    where: { email: 'admin@stockpilot.com' },
    update: {},
    create: {
      email: 'admin@stockpilot.com',
      passwordHash: hashPassword('123456')
    }
  });

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
