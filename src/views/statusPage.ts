/**
 * Shared status page HTML templates.
 * Extracted from index.ts to keep the server bootstrap file clean and modular.
 */

interface StatusPageOptions {
  dbConnected: boolean;
  currentTime: string;
  environment: string;
}

const STATUS_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; color: #e2e8f0; padding: 1rem; }
  .card { background: rgba(30, 27, 75, 0.5); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 3rem 2.5rem; text-align: center; max-width: 560px; width: 100%; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.6); }
  .icon { font-size: 2.5rem; margin-bottom: 1rem; }
  h1 { font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, #f8fafc 0%, #10b981 50%, #06b6d4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; }
  .subtitle { font-size: 1rem; color: #94a3b8; margin-bottom: 1.5rem; }
  .row { display: inline-flex; align-items: center; gap: 0.75rem; padding: 0.875rem 2rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 100px; margin-bottom: 1.5rem; }
  .dot { width: 14px; height: 14px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px rgba(16,185,129,0.6); }
  .dot.red { background: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.6); }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.875rem; margin-bottom: 1.5rem; }
  .meta-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 1rem; text-align: left; }
  .meta-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; margin-bottom: 0.35rem; }
  .meta-value { font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
  .tstamp { color: #64748b; font-size: 0.85rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.06); }
`;

/** Dark-themed status card shown at /api/test, /api/v1/test, and /test */
export function renderStatusPage(options: StatusPageOptions): string {
  const { dbConnected, currentTime, environment } = options;
  const dbLabel = dbConnected ? 'Connected' : 'Disconnected';
  const dotClass = dbConnected ? 'dot' : 'dot red';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ecotec System API - Status</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${STATUS_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="icon">⚡</div>
    <h1>Ecotec System API</h1>
    <p class="subtitle">Internal Express REST API Server is Active</p>
    <div class="row"><span class="dot"></span><strong>Server API is Working!</strong></div>
    <div class="meta">
      <div class="meta-item"><div class="meta-label">Environment</div><div class="meta-value">${environment}</div></div>
      <div class="meta-item"><div class="meta-label">Database</div><div class="meta-value"><span class="${dotClass}"></span>${dbLabel}</div></div>
    </div>
    <div class="tstamp">Sri Lanka Time<br>${currentTime}</div>
  </div>
</body>
</html>`;
}

/** Landing hero page shown at / */
export function renderRootPage(options: StatusPageOptions): string {
  const { currentTime, environment } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eco System API - Online</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${STATUS_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="icon">🚀</div>
    <h1>Eco System API</h1>
    <p class="subtitle">Enterprise Shop Management System</p>
    <div class="row"><span class="dot"></span><strong>API is Working!</strong></div>
    <div class="meta">
      <div class="meta-item"><div class="meta-label">Environment</div><div class="meta-value">${environment}</div></div>
      <div class="meta-item"><div class="meta-label">Timestamp</div><div class="meta-value">${currentTime}</div></div>
    </div>
    <div class="tstamp">✨ Powered by Express.js + Prisma + MySQL</div>
  </div>
</body>
</html>`;
}