import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';

// Existing routes (Legacy preservation)
import pptRoutes from './routes/ppt.js';
import logAnalyzerRoutes from './routes/logAnalyzer.js';

// New routes
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js';
import generateRoutes from './routes/generate.js';

// Existing middleware
import { requestLogger } from './middleware/logMiddleware.js';

// Error handling middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Utils
import { scheduleTempCleanup } from './utils/fileCleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Enable trust proxy for Render / Cloud load balancers (required for secure cookies & HTTPS headers)
app.set('trust proxy', 1);

// --- Security & Parsing Middleware ---
app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server health checks)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Strict rejection in production
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error(`CORS blocked: origin ${origin} is not permitted.`), false);
      }
      // Permissive in dev/test
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '100mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(requestLogger);

// --- Health Check Endpoints (For Render, monitoring, and load balancers) ---
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'DocuGenius AI API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// --- API Routes ---
app.use('/api/ppt', pptRoutes);
app.use('/api/log-analyzer', logAnalyzerRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/generate', generateRoutes);

// --- 404 & Centralized Error Handlers ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Start Server ---
const startServer = async () => {
  await connectDB();

  // Schedule temp file cleanup (every hour, files > 24h old)
  scheduleTempCleanup();

  app.listen(PORT, HOST, () =>
    console.log(`Server running at http://${HOST}:${PORT}`)
  );
};

export default app;

const isMainModule = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMainModule && process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
