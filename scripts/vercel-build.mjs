import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const isProductionDeployment = process.env.VERCEL_ENV === 'production';
const shouldRunMigrations = process.env.RUN_PRISMA_MIGRATIONS === 'true' || isProductionDeployment;

run('npx', ['prisma', 'generate']);

if (shouldRunMigrations) {
  console.log('Running prisma migrate deploy for this deployment.');
  run('npx', ['prisma', 'migrate', 'deploy']);
} else {
  console.log('Skipping prisma migrate deploy for this deployment.');
}

run('npx', ['next', 'build']);
