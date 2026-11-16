import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { logger } from '../middleware/logger.js';
import app from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const logsDir = path.resolve(backendDir, 'logs');
function getActiveLogFile() {
  const auditPath = path.join(logsDir, '.audit.json');
  if (fs.existsSync(auditPath)) {
    try {
      const audit = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
      if (audit.files && audit.files.length > 0) {
        return audit.files[audit.files.length - 1].name;
      }
    } catch {}
  }
  // Fallback to most recent app-*.log
  const logFiles = fs.readdirSync(logsDir)
    .filter((f) => f.startsWith('app-') && f.endsWith('.log'))
    .map((f) => path.join(logsDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return logFiles[0];
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_docugenius_2026';

console.log('🧪 =================================================================');
console.log('🧪 DOCUGENIUS AI - LOGGING SECURITY & PRIVACY VERIFICATION SUITE');
console.log('🧪 =================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] Test ${totalTests}: ${name}`);
    console.error(`   Error: ${err.message}\n`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] Test ${totalTests}: ${name}`);
    console.error(`   Error: ${err.message}\n`);
  }
}

async function main() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // -----------------------------------------------------------------
    // 1. Logger Rotation, MaxSize, ZippedArchive & Audit Manifest Config
    // -----------------------------------------------------------------
    runTest('Winston DailyRotateFile has hardened 20m maxSize, 30d retention, zippedArchive & explicit auditFile', () => {
      const rotateTransport = logger.transports.find(
        (t) => t.constructor && t.constructor.name === 'DailyRotateFile'
      );
      assert(rotateTransport, 'DailyRotateFile transport must be registered on logger');
      assert.strictEqual(rotateTransport.options.maxSize, '20m', 'maxSize must be 20m');
      assert.strictEqual(rotateTransport.options.maxFiles, '30d', 'maxFiles must be 30d');
      assert.strictEqual(rotateTransport.options.zippedArchive, true, 'zippedArchive must be enabled');
      assert(rotateTransport.options.auditFile.endsWith('.audit.json'), 'auditFile must be explicitly configured as .audit.json');
      assert(path.isAbsolute(rotateTransport.options.filename), 'filename must use absolute path resolution');
    });

    // -----------------------------------------------------------------
    // 2. Normal Request Logging (Anonymous)
    // -----------------------------------------------------------------
    await runAsyncTest('Normal request logging captures method, url, status, and userId: "anonymous"', async () => {
      const testRoute = `/api/test-anonymous-${Date.now()}`;
      await fetch(`${baseUrl}${testRoute}`);

      // Allow winston to flush
      await new Promise((r) => setTimeout(r, 150));

      // Read current log file
      const logFile = getActiveLogFile();
      assert(logFile && fs.existsSync(logFile), `Current daily log file ${logFile} must exist`);

      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.trim().split('\n');
      const match = lines
        .map((l) => {
          try { return JSON.parse(l); } catch { return null; }
        })
        .filter(Boolean)
        .find((entry) => entry.message?.url === testRoute);

      assert(match, `Log entry for ${testRoute} must be found in daily log`);
      assert.strictEqual(match.message.userId, 'anonymous', 'userId must be anonymous for unauthenticated requests');
      assert.strictEqual(match.message.status, 404);
      assert.strictEqual(match.message.type, 'API');
    });

    // -----------------------------------------------------------------
    // 3. Authenticated Request Logging without Email / Secret Exposure
    // -----------------------------------------------------------------
    await runAsyncTest('Authenticated request logging records userId without exposing user email or JWT token', async () => {
      const sensitiveEmail = `private_user_${Date.now()}@secret-domain.org`;
      const testUserId = `user_privacy_verified_${Date.now()}`;
      const token = jwt.sign(
        { id: testUserId, email: sensitiveEmail, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const targetRoute = `/api/auth/me?test_req=${Date.now()}&token=secret_in_query_123`;
      const res = await fetch(`${baseUrl}${targetRoute}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Allow winston to flush
      await new Promise((r) => setTimeout(r, 150));

      const logFile = getActiveLogFile();
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.trim().split('\n');

      const match = lines
        .map((l) => {
          try { return JSON.parse(l); } catch { return null; }
        })
        .filter(Boolean)
        .find((entry) => entry.message?.userId === testUserId);

      assert(match, `Log entry with userId "${testUserId}" must exist`);
      assert.strictEqual(match.message.userId, testUserId);
      assert.strictEqual(match.message.user, testUserId);

      // STRICT PRIVACY VERIFICATIONS
      assert(
        !JSON.stringify(match).includes(sensitiveEmail),
        `SECURITY VIOLATION: User email "${sensitiveEmail}" must NOT appear in log entry!`
      );
      assert(
        !JSON.stringify(match).includes(token),
        'SECURITY VIOLATION: JWT token must NOT appear in log entry!'
      );
      assert(
        !match.message.url.includes('secret_in_query_123'),
        'SECURITY VIOLATION: Sensitive query parameter must be redacted from URL!'
      );
      assert(
        match.message.url.includes('token=%5BREDACTED%5D') || match.message.url.includes('token=[REDACTED]'),
        'Sanitized URL must have token parameter redacted'
      );
    });

    // -----------------------------------------------------------------
    // 4. Error Redaction Verification
    // -----------------------------------------------------------------
    await runAsyncTest('Error handler sanitization redacts MongoDB connection URIs, Bearer tokens and API keys', async () => {
      // Import errorHandler to test secret redaction behavior
      const { errorHandler } = await import('../middleware/errorHandler.js');

      let loggedError = '';
      const originalConsoleError = console.error;
      console.error = (...args) => {
        loggedError += args.join(' ');
      };

      try {
        const testErr = new Error(
          'Failed connection to mongodb+srv://mockTestUser:mockTestPassword999@mock-cluster.mongodb.net/test with Bearer mockTokenHeader.mockTokenPayload.mockTokenSig and key=mockTestApiKey123'
        );

        // Temporarily set NODE_ENV to production to activate errorHandler console logging
        const prevEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const mockReq = { method: 'POST', url: '/api/generate' };
        const mockRes = {
          status: () => mockRes,
          json: () => mockRes,
        };

        errorHandler(testErr, mockReq, mockRes, () => {});
        process.env.NODE_ENV = prevEnv;

        assert(!loggedError.includes('mockTestPassword999'), 'Password in MongoDB URI must be redacted');
        assert(loggedError.includes('[REDACTED]'), 'Redaction placeholder must be present');
        assert(!loggedError.includes('mockTokenPayload'), 'Bearer token must be redacted');
        assert(loggedError.includes('[REDACTED_JWT]'), 'Bearer token placeholder must be present');
        assert(!loggedError.includes('mockTestApiKey123'), 'API key in error message must be redacted');
      } finally {
        console.error = originalConsoleError;
      }
    });

    // -----------------------------------------------------------------
    // 5. Root and Backend .gitignore Protection Verification
    // -----------------------------------------------------------------
    runTest('Root .gitignore strictly protects .env, logs, temp, and analyzer exports', () => {
      const rootGitignore = path.resolve(backendDir, '..', '.gitignore');
      assert(fs.existsSync(rootGitignore), 'Root .gitignore must exist');
      const content = fs.readFileSync(rootGitignore, 'utf-8');

      const requiredPatterns = [
        '.env',
        'backend/.env',
        'logs/',
        'backend/logs/',
        '*.log',
        '*.log.gz',
        '*-audit.json',
        '.audit.json',
        'backend/temp/',
        'logs_analysis.csv',
        'logs_analysis.json',
      ];

      for (const pattern of requiredPatterns) {
        assert(content.includes(pattern), `Root .gitignore must include pattern: ${pattern}`);
      }
    });

  } finally {
    server.close();
  }

  console.log('\n=================================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('=================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
