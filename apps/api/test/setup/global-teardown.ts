import { PrismaClient } from '@prisma/client';
import { withDatabase, workerDatabaseName } from './test-db';

export default async function globalTeardown(globalConfig: { maxWorkers: number }): Promise<void> {
  const base = process.env.TEST_BASE_DATABASE_URL;
  if (!base) return;
  const admin = new PrismaClient({ datasourceUrl: withDatabase(base, 'postgres') });
  try {
    for (let i = 1; i <= globalConfig.maxWorkers; i++) {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${workerDatabaseName(base, i)}" WITH (FORCE)`);
    }
  } finally {
    await admin.$disconnect();
  }
}
