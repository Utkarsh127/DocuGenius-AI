import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists via reliable absolute path resolution
const logsDir = path.resolve(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Explicit audit manifest file path
const auditFilePath = path.join(logsDir, '.audit.json');

// File rotation transport: JSON format, daily rotation, 20m max size, 30-day retention, gzipped
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  zippedArchive: true,
  auditFile: auditFilePath,
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
});

const loggerTransports = [fileRotateTransport];

// Deployment / Production Console Logging
// In non-test environments, stream to console for container / cloud log aggregation
if (process.env.NODE_ENV !== 'test') {
  loggerTransports.push(
    new transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? format.combine(format.timestamp(), format.json())
        : format.combine(
            format.colorize(),
            format.timestamp({ format: 'HH:mm:ss' }),
            format.printf(({ level, message, timestamp }) => {
              const text = typeof message === 'object' ? JSON.stringify(message) : message;
              return `[${timestamp}] ${level}: ${text}`;
            })
          ),
    })
  );
}

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: loggerTransports,
  exitOnError: false,
});
