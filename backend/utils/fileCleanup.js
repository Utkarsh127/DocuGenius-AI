import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(__dirname, '..', 'temp');
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Delete files in backend/temp/ older than 24 hours.
 */
function cleanTempFiles() {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;

    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile() && now - stat.mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
          console.log(`[cleanup] Deleted old temp file: ${file}`);
        }
      } catch {
        // skip files that can't be stat'd or deleted
      }
    }
  } catch (err) {
    console.error('[cleanup] Error cleaning temp files:', err.message);
  }
}

/**
 * Schedule periodic temp file cleanup (every hour).
 */
export function scheduleTempCleanup() {
  // Run once immediately
  cleanTempFiles();
  // Then every hour
  setInterval(cleanTempFiles, CLEANUP_INTERVAL_MS);
  console.log('[cleanup] Temp file cleanup scheduled (every 1h, max age 24h)');
}
