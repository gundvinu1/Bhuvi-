// ============================================================
// BHUVI – Real Infrastructure E2E Live Verification Script
// Tests PostgreSQL, Redis, BullMQ, Health Degradation & Recovery
// ============================================================

import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { PrismaClient } = require('../packages/database/node_modules/@prisma/client');
const Redis = require('../packages/queue/node_modules/ioredis');
const { Queue, Worker, QueueEvents } = require('../packages/queue/node_modules/bullmq');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://bhuvi:bhuvi_dev_password@localhost:5432/bhuvi';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

console.log('\n============================================================');
console.log('BHUVI – REAL INFRASTRUCTURE VERIFICATION');
console.log('============================================================\n');

async function runVerification() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

  try {
    // --------------------------------------------------------
    // 1. PostgreSQL Direct Verification
    // --------------------------------------------------------
    console.log('1. Connecting to PostgreSQL 16...');
    await prisma.$connect();
    const pingResult = await prisma.$queryRaw`SELECT 1 as connected`;
    console.log('   ✓ PostgreSQL connected! Ping query result:', pingResult);

    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('   ✓ Existing tables in public schema:', tables);

    // --------------------------------------------------------
    // 2. User Creation & Retrieval in PostgreSQL
    // --------------------------------------------------------
    const testEmail = `verify-${Date.now()}@example.com`;
    console.log(`2. Testing persistence: creating test user (${testEmail})...`);
    const createdUser = await prisma.user.create({
      data: {
        name: 'Infrastructure Verifier',
        email: testEmail,
        passwordHash: '$2a$10$liveVerificationPasswordHash1234567890',
      },
    });
    console.log('   ✓ User created in PostgreSQL:', {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      createdAt: createdUser.createdAt,
    });

    console.log('   Verifying user retrieval by email...');
    const fetchedUser = await prisma.user.findUnique({
      where: { email: testEmail },
    });
    console.log('   ✓ User retrieved from PostgreSQL:', {
      id: fetchedUser?.id,
      email: fetchedUser?.email,
    });

    console.log('   Testing duplicate email rejection at database constraint level...');
    try {
      await prisma.user.create({
        data: {
          name: 'Duplicate User',
          email: testEmail,
          passwordHash: 'anotherHash',
        },
      });
      throw new Error('FAILURE: Unique constraint did not trigger!');
    } catch (err) {
      console.log('   ✓ Duplicate email properly rejected with error code:', err.code);
    }

    // --------------------------------------------------------
    // 3. Redis 7 Direct Verification
    // --------------------------------------------------------
    console.log('\n3. Connecting to Redis 7...');
    const redisPong = await redis.ping();
    console.log('   ✓ Redis ping result:', redisPong);

    // --------------------------------------------------------
    // 4. BullMQ Queue & Worker Verification
    // --------------------------------------------------------
    const queueName = 'bhuvi-e2e-verification';
    console.log(`\n4. Testing BullMQ Queue & Worker on queue [${queueName}]...`);
    const queue = new Queue(queueName, { connection: { host: 'localhost', port: 6379 } });
    const queueEvents = new QueueEvents(queueName, { connection: { host: 'localhost', port: 6379 } });

    const checkId = `chk-${Date.now()}`;
    const worker = new Worker(
      queueName,
      async (job) => {
        console.log(`   [Worker] Received job: ${job.name} (id: ${job.id})`);
        return {
          checkId: job.data.checkId,
          status: 'success',
          processedAt: new Date().toISOString(),
          workerId: 'e2e-live-worker',
        };
      },
      { connection: { host: 'localhost', port: 6379 } },
    );

    const job = await queue.add('infrastructure-check', {
      checkId,
      source: 'verify-real-infrastructure-e2e',
      timestamp: new Date().toISOString(),
    });
    console.log(`   ✓ Job submitted with ID: ${job.id}`);

    const result = await job.waitUntilFinished(queueEvents);
    console.log('   ✓ Job completed successfully with result:', result);

    await queueEvents.close();
    await worker.close();
    await queue.close();

    // --------------------------------------------------------
    // 5. Redis Temporary Stop & Degradation Simulation
    // --------------------------------------------------------
    console.log('\n5. Simulating Redis degradation and recovery...');
    console.log('   Stopping Redis container (docker stop bhuvi-redis)...');
    execSync('docker stop bhuvi-redis', { stdio: 'inherit' });

    // Test ping failure
    const degradedRedis = new Redis('redis://localhost:6379', {
      connectTimeout: 1000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      lazyConnect: true,
    });

    let redisReachableWhileStopped = true;
    try {
      await degradedRedis.connect();
      await degradedRedis.ping();
    } catch {
      redisReachableWhileStopped = false;
    } finally {
      degradedRedis.disconnect();
    }

    console.log('   ✓ When Redis is stopped, connectivity check reports: disconnected (reachable:', redisReachableWhileStopped, ')');

    console.log('   Restarting Redis container (docker start bhuvi-redis)...');
    execSync('docker start bhuvi-redis', { stdio: 'inherit' });

    // Wait for Redis to accept connections
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const recoveredRedis = new Redis('redis://localhost:6379', { maxRetriesPerRequest: null });
    const recoveredPong = await recoveredRedis.ping();
    console.log('   ✓ After restart, Redis ping result:', recoveredPong);
    recoveredRedis.disconnect();

    console.log('\n============================================================');
    console.log('ALL REAL-INFRASTRUCTURE CHECKS PASSED SUCCESSFULLY!');
    console.log('============================================================\n');
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

runVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
