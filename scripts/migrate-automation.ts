import { readFileSync } from 'node:fs';
import { prisma } from '../lib/prisma';

async function main() {
  const statements = readFileSync(new URL('./migrations/20261105-journey-automation.sql', import.meta.url), 'utf8')
    .replace(/^--.*$/gm, '').split(';').map(sql => sql.trim()).filter(Boolean);
  await prisma.$transaction(async tx => {
    for (const sql of statements) await tx.$executeRawUnsafe(sql);
  }, { maxWait: 30000, timeout: 60000 });
  console.log('Automation schema ready');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
