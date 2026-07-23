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

// Route imports
import authRoutes from './routes/auth.routes';
import invoiceRoutes from './routes/invoice.routes';
import customerRoutes from './routes/customer.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import brandRoutes from './routes/brand.routes';
import shopRoutes from './routes/shop.routes';
import shopAdminRoutes from './routes/shopAdmin.routes';
import supplierRoutes from './routes/supplier.routes';
import grnRoutes from './routes/grn.routes';
import uploadRoutes from './routes/upload.routes';
import publicRoutes from './routes/public.routes';

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// ===================================
// TRUST PROXY - Required for Render.com & Contabo (behind reverse proxy)
// Enables correct client IP detection for rate limiting
// ===================================
app.set('trust proxy', 1);
console.log(`🔒 Trust proxy set to 1 (single reverse proxy hop trusted, ${isProduction ? 'production' : 'development'})`);

// ===================================
// SECURITY MIDDLEWARE - Order matters!
// ===================================

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
      scriptSrc: ["'self'", "'unsafe-inline'"], // For HTML test page
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false, // Allow embedding for HTML test page
  hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

// 3. Cookie parser - Required for refresh token cookies
app.use(cookieParser());

// 4. CORS configuration - Custom CORS middleware
function isOriginAllowed(origin?: string): boolean {
  if (!origin) return false;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) return true;
  if (/^https:\/\/ecotec\.ecosystemlk\.app\/?$/i.test(origin)) return true;
  if (/^https:\/\/api\.ecotec\.ecosystemlk\.app\/?$/i.test(origin)) return true;
  if (/\.ecosystemlk\.app$/i.test(origin)) return true;
  return false;
}

/**
 * Sets a header value cleanly, removing any prior value first (whether set by
 * an earlier middleware, an upstream proxy that leaked a header through, or
 * this same middleware firing more than once on the response). setHeader()
 * alone normally overwrites, but if anything upstream used append() or if this
 * middleware is invoked twice on the same response, values can accumulate into
 * a comma-separated duplicate (e.g. "origin, origin"). removeHeader() first
 * guarantees a single clean value every time.
 */
function setHeaderClean(res: express.Response, name: string, value: string): void {
  res.removeHeader(name);
  res.setHeader(name, value);
}

/**
 * Custom CORS Middleware - Handles dynamic origin validation and preflight requests.
 * Sets appropriate CORS headers based on the request origin.
 */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  setHeaderClean(res, 'Vary', 'Origin');

  const allowedOrigin = origin && isOriginAllowed(origin) ? origin : 'https://ecotec.ecosystemlk.app';
  setHeaderClean(res, 'Access-Control-Allow-Origin', allowedOrigin);
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
// Must be registered BEFORE body parsers and route handlers
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
if (!isProduction) {
  app.use(morgan(':method :url :status :response-time ms - :reqId'));
} else {
  app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :reqId'));
}

// 10. Add security response headers
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

// Serve static files for uploads (Local file storage replacing Supabase)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'))); // Legacy support
app.use(`${API_PREFIX}/uploads`, express.static(path.join(process.cwd(), 'uploads'))); // Proxied via NGINX

// Serve production frontend build assets in production mode
if (isProduction) {
  const frontendDistPath = path.join(process.cwd(), '..', 'frontend', 'dist');
  console.log(`📦 Serving static frontend from: ${frontendDistPath}`);

  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));

    // SPA wildcard fallback - All non-API routes serve index.html
    // This enables client-side React Router paths (/, /products, /system, /system/invoices, etc.)
    // to work correctly on browser refresh without 404 errors.
    app.get('*', (req, res, next) => {
      // Skip API routes - let them fall through to the 404 handler
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
// NEVER open a DB connection here. Use cached state from real queries.
app.get('/health', (_req, res) => {
  const dbConnected = isDbConnected();
  
  // Always return 200 so Render doesn't kill the service during cold start.
  res.status(200).json({ 
    status: dbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
  });
});

// ===================================
// API TEST ENDPOINT — Always accessible, bypasses DB gate middleware
// ===================================

/**
 * Renders a modern dark-theme status UI for the API test endpoint.
 * Displays server status with glassmorphism card, glowing indicators,
 * dynamic timestamp (Sri Lanka time), and live DB connection state.
 */
function renderTestPage(dbConnected: boolean): string {
  const currentTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Colombo',
    dateStyle: 'full', 
    timeStyle: 'medium' 
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ecotec System API - Status</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #e2e8f0;
      overflow: hidden;
      padding: 1rem;
    }

    /* Animated background orbs */
    .bg-orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(120px);
      pointer-events: none;
      z-index: 0;
    }

    .bg-orb-1 {
      width: 500px;
      height: 500px;
      background: linear-gradient(135deg, #10b981, #06b6d4);
      top: -200px;
      right: -200px;
      opacity: 0.3;
      animation: floatOrb 8s ease-in-out infinite alternate;
    }

    .bg-orb-2 {
      width: 400px;
      height: 400px;
      background: linear-gradient(135deg, #8b5cf6, #ec4899);
      bottom: -150px;
      left: -150px;
      opacity: 0.25;
      animation: floatOrb 10s ease-in-out infinite alternate-reverse;
    }

    @keyframes floatOrb {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(40px, 60px) scale(1.15); }
    }

    .container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 560px;
      animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeInUp {
      0% { opacity: 0; transform: translateY(40px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    /* Glassmorphism status card */
    .status-card {
      background: rgba(30, 27, 75, 0.5);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 3rem 2.5rem;
      text-align: center;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.6);
    }

    .icon-wrapper {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15));
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      animation: float 3s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    h1 {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #f8fafc 0%, #10b981 50%, #06b6d4 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.75rem;
    }

    .subtitle {
      font-size: 1rem;
      color: #94a3b8;
      margin-bottom: 2rem;
      font-weight: 500;
    }

    /* Status indicator row with glowing green dot */
    .status-row {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 2rem;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 100px;
      margin-bottom: 2rem;
    }

    .status-dot {
      width: 14px;
      height: 14px;
      background: #10b981;
      border-radius: 50%;
      position: relative;
      flex-shrink: 0;
      animation: pulseGlow 2s ease-in-out infinite;
    }

    .status-dot::after {
      content: '';
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.2);
      animation: pulseGlow 2s ease-in-out infinite;
    }

    @keyframes pulseGlow {
      0%, 100% {
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.6), 0 0 20px rgba(16, 185, 129, 0.3);
        transform: scale(1);
      }
      50% {
        box-shadow: 0 0 16px rgba(16, 185, 129, 0.8), 0 0 40px rgba(16, 185, 129, 0.4);
        transform: scale(1.08);
      }
    }

    .status-text {
      font-size: 1.25rem;
      font-weight: 700;
      color: #10b981;
    }

    /* Metadata grid */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.875rem;
      margin-bottom: 1.5rem;
    }

    .meta-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 1rem;
      text-align: left;
      transition: transform 0.25s ease, background 0.25s ease;
    }

    .meta-item:hover {
      transform: translateY(-3px);
      background: rgba(255, 255, 255, 0.06);
    }

    .meta-label {
      font-size: 0.7rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
      margin-bottom: 0.35rem;
    }

    .meta-value {
      font-size: 0.95rem;
      font-weight: 600;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .db-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .db-indicator.connected {
      background: #10b981;
      box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
    }

    .db-indicator.disconnected {
      background: #ef4444;
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
    }

    .timestamp-row {
      text-align: center;
      color: #64748b;
      font-size: 0.85rem;
      padding: 1rem 0 0;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .timestamp-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #475569;
      margin-bottom: 0.25rem;
    }

    @media (max-width: 500px) {
      .status-card { padding: 2rem 1.5rem; }
      h1 { font-size: 1.6rem; }
      .meta-grid { grid-template-columns: 1fr; }
      .status-row { padding: 0.75rem 1.25rem; }
    }
  </style>
</head>
<body>
  <div class="bg-orb bg-orb-1"></div>
  <div class="bg-orb bg-orb-2"></div>

  <div class="container">
    <div class="status-card">
      <div class="icon-wrapper">⚡</div>

      <h1>Ecotec System API</h1>
      <p class="subtitle">Internal Express REST API Server is Active</p>

      <div class="status-row">
        <span class="status-dot"></span>
        <span class="status-text">Server API is Working!</span>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <div class="meta-label">Environment</div>
          <div class="meta-value">${process.env.NODE_ENV || 'development'}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Database</div>
          <div class="meta-value">
            <span class="db-indicator ${dbConnected ? 'connected' : 'disconnected'}"></span>
            ${dbConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      <div class="timestamp-row">
        <div class="timestamp-label">Sri Lanka Time</div>
        ${currentTime}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Register BOTH /api/test and /api/v1/test BEFORE the DB gate middleware
// so they remain accessible even during cold starts or DB outages.
app.get('/api/test', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(renderTestPage(isDbConnected()));
});

app.get(`${API_PREFIX}/test`, (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(renderTestPage(isDbConnected()));
});

// ===================================
// COLD-START GATE MIDDLEWARE
// ===================================
// On Render's free tier the service sleeps after inactivity. When it wakes up,
// Render routes incoming requests to the server IMMEDIATELY — often before the
// DB connection is ready. Without this middleware, those requests get an instant
// 503 "Database connection failed".
//
// This gate holds API requests for up to 45s, waiting for the DB to connect.
// Must be >= connectWithRetry's max duration (5 attempts × 2s backoff = ~30s
// + connect_timeout overhead). 45s gives comfortable headroom.
// Health checks (above) are exempt so Render doesn't think the service is dead.
const DB_GATE_TIMEOUT_MS = 45000;

app.use(`${API_PREFIX}`, async (req, res, next) => {
  // If DB is already connected, proceed immediately (hot path — no overhead)
  if (isDbConnected()) {
    return next();
  }

  // DB not ready yet — wait for the startup connection to finish
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

// API Test endpoint - Shows at root URL (http://localhost:3001 or https://api.ecosystemlk.tech)
app.get('/', async (_req, res) => {
  const currentTime = new Date().toLocaleString('en-US', { 
    dateStyle: 'full', 
    timeStyle: 'medium' 
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eco System API - Online</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #e2e8f0;
      overflow: hidden;
    }

    .bg-glow {
      position: fixed;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      filter: blur(120px);
      opacity: 0.4;
      pointer-events: none;
      z-index: 0;
    }

    .glow-1 {
      background: linear-gradient(135deg, #10b981, #06b6d4);
      top: -150px;
      right: -150px;
    }

    .glow-2 {
      background: linear-gradient(135deg, #8b5cf6, #ec4899);
      bottom: -200px;
      left: -150px;
    }

    .container {
      text-align: center;
      z-index: 1;
      padding: 2rem;
      animation: fadeInUp 0.8s ease-out;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes pulse {
      0%, 100% { 
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
      }
      50% { 
        transform: scale(1.05);
        box-shadow: 0 0 0 20px rgba(16, 185, 129, 0);
      }
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .logo-container {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 120px;
      height: 120px;
      background: linear-gradient(135deg, #10b981, #06b6d4);
      border-radius: 32px;
      margin-bottom: 2rem;
      box-shadow: 0 25px 60px -15px rgba(16, 185, 129, 0.5);
      animation: float 3s ease-in-out infinite;
    }

    .logo-container::before {
      content: '';
      position: absolute;
      inset: -4px;
      background: linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6, #10b981);
      border-radius: 36px;
      z-index: -1;
      animation: spin 4s linear infinite;
      opacity: 0.6;
    }

    .logo {
      font-size: 4rem;
    }

    h1 {
      font-size: 3rem;
      font-weight: 800;
      background: linear-gradient(135deg, #fff 0%, #10b981 50%, #06b6d4 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      font-size: 1.25rem;
      color: #94a3b8;
      margin-bottom: 2rem;
    }

    .status-card {
      display: inline-flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 2.5rem;
      background: rgba(16, 185, 129, 0.1);
      border: 2px solid rgba(16, 185, 129, 0.3);
      border-radius: 20px;
      margin-bottom: 2rem;
      backdrop-filter: blur(10px);
    }

    .status-dot {
      position: relative;
      width: 16px;
      height: 16px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }

    .status-dot::before {
      content: '';
      position: absolute;
      inset: -4px;
      background: rgba(16, 185, 129, 0.3);
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }

    .status-text {
      font-size: 1.5rem;
      font-weight: 700;
      color: #10b981;
    }

    .version {
      display: inline-block;
      background: rgba(139, 92, 246, 0.2);
      color: #a78bfa;
      padding: 0.5rem 1rem;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
    }

    .timestamp {
      color: #64748b;
      font-size: 0.875rem;
    }

    .footer {
      margin-top: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: #64748b;
      font-size: 0.875rem;
    }

    @media (max-width: 640px) {
      h1 {
        font-size: 2rem;
      }
      
      .logo-container {
        width: 100px;
        height: 100px;
      }
      
      .logo {
        font-size: 3rem;
      }
      
      .status-card {
        padding: 1rem 1.5rem;
      }
      
      .status-text {
        font-size: 1.25rem;
      }
    }
  </style>
</head>
<body>
  <div class="bg-glow glow-1"></div>
  <div class="bg-glow glow-2"></div>
  
  <div class="container">
    <div class="logo-container">
      <span class="logo">🚀</span>
    </div>
    
    <h1>Eco System API</h1>
    <p class="subtitle">Enterprise Shop Management System</p>
    
    <div class="status-card">
      <span class="status-dot"></span>
      <span class="status-text">API is Working!</span>
    </div>
    
    <div class="version">v1.0.0 • ${process.env.NODE_ENV || 'development'}</div>
    
    <p class="timestamp">${currentTime}</p>
    
    <div class="footer">
      ✨ Powered by Express.js + Prisma + MySQL
    </div>
  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
});

// ===================================
// SYSTEM DIAGNOSTICS ENDPOINT (/test)
// ===================================
app.get('/test', async (_req, res) => {
  const currentTime = new Date().toLocaleString('en-US', { 
    dateStyle: 'full', 
    timeStyle: 'medium' 
  });
  const dbConnected = isDbConnected();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>System Status | Eco System API</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #09090b;
      --card-bg: rgba(24, 24, 27, 0.6);
      --primary: #10b981;
      --primary-glow: rgba(16, 185, 129, 0.5);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --border: rgba(255, 255, 255, 0.08);
      --error: #ef4444;
      --error-glow: rgba(239, 68, 68, 0.5);
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    /* Animated Background */
    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      z-index: 0;
      opacity: 0.5;
      animation: float 10s infinite alternate ease-in-out;
    }
    .blob-1 { top: -10%; left: -10%; width: 40vw; height: 40vw; background: rgba(16, 185, 129, 0.15); }
    .blob-2 { bottom: -10%; right: -10%; width: 35vw; height: 35vw; background: rgba(56, 189, 248, 0.15); animation-delay: -5s; }

    @keyframes float {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(30px, 50px) scale(1.1); }
    }

    .container {
      position: relative;
      z-index: 10;
      width: 90%;
      max-width: 600px;
      padding: 3rem;
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .header {
      text-align: center;
      margin-bottom: 2.5rem;
    }

    .icon-wrapper {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      background: linear-gradient(135deg, #10b98120, #38bdf820);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      box-shadow: 0 0 30px var(--primary-glow);
      animation: pulse-glow 3s infinite;
    }

    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px var(--primary-glow); }
      50% { box-shadow: 0 0 40px var(--primary-glow); }
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -1px;
      background: linear-gradient(to right, #fff, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }

    .subtitle { color: var(--text-muted); font-size: 1.1rem; }

    .status-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 2.5rem;
    }

    .status-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      padding: 1.5rem;
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: transform 0.3s ease, background 0.3s ease;
    }

    .status-item:hover {
      transform: translateY(-5px);
      background: rgba(255, 255, 255, 0.05);
    }

    .status-label {
      font-size: 0.9rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }

    .status-value {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.2rem;
      font-weight: 600;
    }

    .indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .indicator.online {
      background: var(--primary);
      box-shadow: 0 0 10px var(--primary);
      animation: blink 2s infinite;
    }
    
    .indicator.offline {
      background: var(--error);
      box-shadow: 0 0 10px var(--error);
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .footer {
      text-align: center;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.9rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .badge {
      padding: 0.4rem 0.8rem;
      background: rgba(255,255,255,0.05);
      border-radius: 20px;
      font-size: 0.8rem;
      border: 1px solid var(--border);
    }
    
    @media (max-width: 600px) {
      .status-grid { grid-template-columns: 1fr; }
      .container { padding: 2rem; width: 95%; }
    }
  </style>
</head>
<body>
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>

  <div class="container">
    <div class="header">
      <div class="icon-wrapper">🚀</div>
      <h1>System Diagnostics</h1>
      <p class="subtitle">Eco System API is operational and ready</p>
    </div>

    <div class="status-grid">
      <div class="status-item">
        <span class="status-label">API Server</span>
        <div class="status-value">
          <div class="indicator online"></div>
          Online
        </div>
      </div>
      
      <div class="status-item" style="border-color: ${dbConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}">
        <span class="status-label">Database</span>
        <div class="status-value" style="color: ${dbConnected ? '#10b981' : '#ef4444'}">
          <div class="indicator ${dbConnected ? 'online' : 'offline'}"></div>
          ${dbConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </div>

    <div class="footer">
      <span>${currentTime}</span>
      <span class="badge">v1.0.0 | ${process.env.NODE_ENV || 'development'}</span>
    </div>
  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
});

// ===================================
// ROUTE-LEVEL TIMEOUT FOR HEAVY OPERATIONS
// ===================================
// Email sending (3 SMTP attempts × 60s each) and PDF generation (Puppeteer ~30s)
// need much longer than Express's default 120s. Without this, the client gets
// a "socket hang up" or empty response before the operation completes.
const HEAVY_ROUTE_TIMEOUT_MS = 210000; // 3.5 minutes

const extendTimeout = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.setTimeout(HEAVY_ROUTE_TIMEOUT_MS);
  res.setTimeout(HEAVY_ROUTE_TIMEOUT_MS);
  next();
};

// Apply extended timeout to email and PDF routes BEFORE the route handlers
app.use(`${API_PREFIX}/invoices`, (req, res, next) => {
  // Only extend timeout for email/PDF endpoints, not regular CRUD
  if (req.path.includes('send-email') || req.path.includes('/pdf')) {
    return extendTimeout(req, res, next);
  }
  next();
});
app.use(`${API_PREFIX}/grns`, (req, res, next) => {
  if (req.path.includes('send-email') || req.path.includes('/pdf')) {
    return extendTimeout(req, res, next);
  }
  next();
});

// Routes
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/invoices`, invoiceRoutes);
app.use(`${API_PREFIX}/customers`, customerRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/brands`, brandRoutes);
app.use(`${API_PREFIX}/shops`, shopRoutes);
app.use(`${API_PREFIX}/shop-admin`, shopAdminRoutes);
app.use(`${API_PREFIX}/suppliers`, supplierRoutes);
app.use(`${API_PREFIX}/grns`, grnRoutes);
app.use(`${API_PREFIX}/public`, publicRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// ===================================
// STARTUP SEQUENCE
// ===================================
// 1. Connect to DB FIRST (with retries + backoff)
// 2. THEN start accepting HTTP requests
//
// This prevents the race condition where user requests arrive before DB
// is ready, which was the root cause of "Database connection failed" on
// Render's free tier cold starts.
//
// The cold-start gate middleware above is a safety net for requests that
// arrive during the brief window between listen() and connectWithRetry().

const startServer = async () => {
  // Start listening FIRST so Render sees the port is bound (prevents restart loop)
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 API available at http://localhost:${PORT}${API_PREFIX}`);
    console.log(`📡 API Test URL at http://localhost:${PORT}/api/test`);
  });

  // Then connect to DB (requests are held by the cold-start gate middleware)
  try {
    await connectWithRetry(5, 2000); // 5 attempts, 2s progressive backoff (2,4,6,8,10s = 30s max)
    console.log('📦 Database initialization complete');
  } catch (err) {
    console.error('⚠️ Database pre-connect failed, per-request retry is still active:', err instanceof Error ? err.message : err);
  }
};

startServer();

export default app;