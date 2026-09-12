import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// ── Ultra Smart Variable-Based Connection URL Flow ──
const rawUrl = process.env.DATABASE_URL || 'mysql://root:@localhost:3306/ecotec_db';
const parsedUrl = new URL(rawUrl);

// URL එකෙන් variables වෙන් කර ගැනීම
const dbUser = decodeURIComponent(parsedUrl.username);
const dbPassword = decodeURIComponent(parsedUrl.password);
const dbHost = parsedUrl.hostname;
const dbPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 3306;
const dbName = parsedUrl.pathname.replace(/^\//, '');

// Explicit Connection Pool Variables (VPS Stability එක සඳහා)
const connectionLimit = 5;      // Pool එකට max connections 5යි
const connectTimeout = 5000;    // 5s connection timeout
const poolTimeout = 10;         // 10s pool wait timeout

// Variables එකතු කර Dynamic Pooled Database URL එක හැදීම
const authPart = dbPassword ? `${dbUser}:${encodeURIComponent(dbPassword)}@` : (dbUser ? `${dbUser}@` : '');
const pooledDatabaseUrl = `mysql://${authPart}${dbHost}:${dbPort}/${dbName}?connection_limit=${connectionLimit}&connect_timeout=${connectTimeout / 1000}&pool_timeout=${poolTimeout}`;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: pooledDatabaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

let isConnected = false;

export function isDbConnected(): boolean {
  return isConnected;
}

// Database connection check helper
export async function connectDB() {
  try {
    await prisma.$connect();
    isConnected = true;
    console.log(`✅ MariaDB Connected successfully (Host: ${dbHost}, Port: ${dbPort}, Max Pool: ${connectionLimit})`);
  } catch (error) {
    isConnected = false;
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export default prisma;