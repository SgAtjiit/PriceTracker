import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import productsRouter from './routes/products.js';
import { syncCatalog } from './scraper/syncCatalog.js';

dotenv.config();

const app = express();

// CORS Configuration:
// Set FRONTEND_URL in environment variables to a comma-separated list of allowed origins
// (e.g. FRONTEND_URL=https://my-app.vercel.app,http://localhost:5173).
// In production, configure FRONTEND_URL to restrict access exclusively to trusted frontend domains.
// When FRONTEND_URL is unset, all origins are permitted for local development.
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((url) => url.trim()).filter(Boolean)
  : [];

let corsOptions;
if (allowedOrigins.length > 0) {
  corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server cron triggers)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
  };
} else {
  console.warn('CORS is running in permissive/dev mode: FRONTEND_URL is not set, allowing all origins.');
  corsOptions = { origin: true, credentials: true };
}

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ ok: true, status: 'ok' });
});

// Direct health check endpoint
app.get('/health', (req, res) =>
  res.json({
    ok: true,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  })
);

// Mount products router
app.use('/api/products', productsRouter);

// Global Express error-handling middleware (must be the last app.use)
app.use((err, req, res, next) => {
  console.error('Unhandled Express error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Process-level listeners to prevent crashes on unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing server');
  process.exit(0);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Check Playwright chromium executable availability for debugging Render deployments
  try {
    const execPath = chromium.executablePath();
    console.log(`Playwright Chromium executable path: ${execPath}`);
  } catch (err) {
    console.warn(`Playwright Chromium executable check warning: ${err.message}`);
  }

  // Fire-and-forget initial catalog sync at startup
  syncCatalog().catch((err) => {
    console.error('Initial catalog sync failed at startup:', err.message);
  });
});
