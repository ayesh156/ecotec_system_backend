import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables FIRST (before any security config)
// Try multiple paths for tsx compatibility
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'backend', '.env'),
  path.resolve(__dirname, '../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`📁 Loading .env from: ${envPath}`);
    dotenv.config({ path: envPath });
    break;
  }
}

import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { apiRateLimiter } from './middleware/rateLimiter';
import { sanitizeRequestBody } from './middleware/validation';
import { connectWithRetry, isDbConnected, dbReady } from './lib/prisma';
import { renderStatusPage, renderRootPage } from './views/statusPage';

// Route imports
import authRoutes from './routes/auth.routes';
import invoiceRoutes from './routes/invoice.routes';
import quotationRoutes from './routes/quotation.routes';
import customerRoutes from './routes/customer.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import brandRoutes from './routes/brand.routes';
import shopRoutes from './routes/shop.routes';
import shopAdminRoutes from './routes/shopAdmin.routes';
import supplierRoutes from './routes/supplier.routes';
import grnRoutes from './routes/grn.routes';
import estimateRoutes from './routes/estimate.routes';
import uploadRoutes from './routes/upload.routes';
import publicRoutes from './routes/public.routes';

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// ===================================
// TRUST PROXY - Required for Render.com & Contabo (behind reverse proxy)
// ===================================
app.set('trust proxy', 1);
console.log(`🔒 Trust proxy set to 1 (${isProduction ? 'production' : 'development'})`);

// ===================================
// SECURITY MIDDLEWARE - Order matters!
// ===================================

// 0. HEADER DE-DUPLICATION GUARD
app.use((req, res, next) => {
  const originalWriteHead = res.writeHead.bind(res) as (...args: any[]) => void;
  (res as any).writeHead = function (...args: any[]) {
    const dedupe = (name: string) => {
      const val = res.getHeader(name);
      if (val) {
        const first = Array.isArray(val) ? String(val[0]) : String(val).split(',')[0];
        res.setHeader(name, first.trim());
      }
    };
    dedupe('Access-Control-Allow-Origin');
    dedupe('Vary');
    return originalWriteHead(...args);
  };
  next();
});

// 1. Request ID for tracing (NIST AU-3)
app.use((req, _res, next) => {
  (req as any).requestId = req.headers['x-request-id'] || crypto.randomUUID();
  next();
});

// 2. Security headers (Helmet with custom config)
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

// 2a. Cross-Origin-Resource-Policy headers for static uploads (allow image rendering on other origins)
const uploadsPath = path.join(process.cwd(), 'uploads');
const setCrossOriginResourceHeaders = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
};

// 3. Cookie parser - Required for refresh token cookies
app.use(cookieParser());

// 4. CORS configuration - Custom CORS middleware
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) return true;
  if (/^https:\/\/ecotec\.ecosystemlk\.app\/?$/i.test(origin)) return true;
  if (/^https:\/\/api\.ecotec\.ecosystemlk\.app\/?$/i.test(origin)) return true;
  if (/\.ecosystemlk\.app$/i.test(origin)) return true;
  return false;
}

function setHeaderClean(res: express.Response, name: string, value: string): void {
  res.removeHeader(name);
  res.setHeader(name, value);
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  setHeaderClean(res, 'Vary', 'Origin');
  setHeaderClean(res, 'Access-Control-Allow-Origin', (origin && isOriginAllowed(origin)) ? origin : 'https://ecotec.ecosystemlk.app');
  setHeaderClean(res, 'Access-Control-Allow-Credentials', 'true');
  setHeaderClean(res, 'Access-Control-Expose-Headers', 'Set-Cookie, X-Request-ID');
  if (req.method === 'OPTIONS') {
    setHeaderClean(res, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    setHeaderClean(res, 'Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, Cache-Control, Pragma, Expires');
    setHeaderClean(res, 'Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }
  next();
});

// 5. Gzip Compression - Compresses responses > 1 KB
app.use(compression({ threshold: 1024 }));

// 6. Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 7. Input sanitization - Prevents XSS and prototype pollution
app.use(sanitizeRequestBody);

// 8. Global rate limiting (applies to all routes)
app.use(apiRateLimiter);

// 9. Logging with request ID
morgan.token('reqId', (req) => (req as any).requestId);
app.use(morgan(isProduction
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :reqId'
  : ':method :url :status :response-time ms - :reqId'));

// 10. Security response headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProduction) {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  }
  next();
});

// API version prefix
const API_PREFIX = '/api/v1';

// ===================================
// STATIC FILE SERVING
// ===================================
app.use('/uploads', setCrossOriginResourceHeaders, express.static(uploadsPath)); // Legacy support
app.use(`${API_PREFIX}/uploads`, setCrossOriginResourceHeaders, express.static(uploadsPath)); // Proxied via NGINX

// Serve production frontend build assets in production mode
if (isProduction) {
  const frontendDistPath = path.join(process.cwd(), '..', 'frontend', 'dist');
  console.log(`📦 Serving static frontend from: ${frontendDistPath}`);

  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    // SPA wildcard fallback - All non-API routes serve index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path === '/health' || req.path === '/test') {
        return next();
      }
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  } else {
    console.warn(`⚠️ Frontend build not found at: ${frontendDistPath}`);
    console.warn('   Run `npm run build` in the frontend directory first.');
  }
}

// Health check — MUST be instant. Render sends these every 5s from multiple IPs.
app.get('/health', (_req, res) => {
  const dbConnected = isDbConnected();
  res.status(200).json({
    status: dbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
  });
});

// ===================================
// STATUS PAGES — Always accessible, bypasses DB gate middleware
// ===================================
const getStatusOptions = () => ({
  dbConnected: isDbConnected(),
  currentTime: new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Colombo',
    dateStyle: 'full',
    timeStyle: 'medium',
  }),
  environment: process.env.NODE_ENV || 'development',
});

app.get(['/api/test', `${API_PREFIX}/test`, '/test'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(renderStatusPage(getStatusOptions()));
});

app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(renderRootPage(getStatusOptions()));
});

// ===================================
// COLD-START GATE MIDDLEWARE
// ===================================
const DB_GATE_TIMEOUT_MS = 45000;

app.use(`${API_PREFIX}`, async (req, res, next) => {
  if (isDbConnected()) return next();

  console.log(`⏳ Request waiting for DB: ${req.method} ${req.originalUrl}`);

  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), DB_GATE_TIMEOUT_MS)
  );
  const result = await Promise.race([dbReady, timeout]);

  if (result === 'timeout' && !isDbConnected()) {
    console.error(`🚫 DB gate timeout for ${req.method} ${req.originalUrl}`);
    return res.status(503).json({
      success: false,
      message: 'Service is starting up. Please try again in a few seconds.',
    });
  }
  next();
});

// ===================================
// ROUTE-LEVEL TIMEOUT FOR HEAVY OPERATIONS
// ===================================
const HEAVY_ROUTE_TIMEOUT_MS = 210000; // 3.5 minutes

const extendTimeout = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.setTimeout(HEAVY_ROUTE_TIMEOUT_MS);
  res.setTimeout(HEAVY_ROUTE_TIMEOUT_MS);
  next();
};

app.use(`${API_PREFIX}/invoices`, (req, res, next) => {
  if (req.path.includes('send-email') || req.path.includes('/pdf')) return extendTimeout(req, res, next);
  next();
});
app.use(`${API_PREFIX}/grns`, (req, res, next) => {
  if (req.path.includes('send-email') || req.path.includes('/pdf')) return extendTimeout(req, res, next);
  next();
});

// Routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/invoices`, invoiceRoutes);
app.use(`${API_PREFIX}/quotations`, quotationRoutes);
app.use(`${API_PREFIX}/customers`, customerRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/brands`, brandRoutes);
app.use(`${API_PREFIX}/shops`, shopRoutes);
app.use(`${API_PREFIX}/shop-admin`, shopAdminRoutes);
app.use(`${API_PREFIX}/suppliers`, supplierRoutes);
app.use(`${API_PREFIX}/grns`, grnRoutes);
app.use(`${API_PREFIX}/estimates`, estimateRoutes);
app.use(`${API_PREFIX}/public`, publicRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// ===================================
// STARTUP SEQUENCE
// ===================================
const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 API available at http://localhost:${PORT}${API_PREFIX}`);
    console.log(`📡 API Test URL at http://localhost:${PORT}/api/test`);
  });

  try {
    await connectWithRetry(5, 2000);
    console.log('📦 Database initialization complete');
  } catch (err) {
    console.error('⚠️ Database pre-connect failed, per-request retry is still active:', err instanceof Error ? err.message : err);
  }
};

startServer();

export default app;