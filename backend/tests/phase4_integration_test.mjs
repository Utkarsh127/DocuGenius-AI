import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../server.js';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '..', 'temp');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_docugenius_2026';

console.log('🧪 ===============================================================');
console.log('🧪 DOCUGENIUS AI - PHASE 4 FRONTEND & API CONTRACT VERIFICATION');
console.log('🧪 ===============================================================\n');

let passedTests = 0;
let totalTests = 0;
let pendingTests = 0;

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

function markPending(name, reason) {
  totalTests++;
  pendingTests++;
  console.log(`⏸️  [NOT TESTED] Test ${totalTests}: ${name}`);
  console.log(`    ↳ Reason: ${reason}`);
}

async function main() {
  // Start server on dynamic port for testing
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Health / 404 Contract
    await runAsyncTest('404 Handler returns standard JSON structure for unknown routes', async () => {
      const res = await fetch(`${baseUrl}/api/unknown-route-check`);
      assert.strictEqual(res.status, 404);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert(data.error.includes('/api/unknown-route-check'));
    });

    // 2. Legacy Direct PPT Generation API Contract (Preserved Endpoint)
    await runAsyncTest('Legacy /api/ppt/generate produces binary PPTX blob stream', async () => {
      const payload = {
        title: 'Legacy Compatibility Test',
        text: 'This is paragraph 1 of the presentation.\n\nThis is paragraph 2 explaining architecture.',
      };

      const res = await fetch(`${baseUrl}/api/ppt/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 200);
      assert(
        res.headers.get('content-type')?.includes('presentationml') ||
        res.headers.get('content-type')?.includes('octet-stream'),
        'Content-Type must indicate PPTX binary data'
      );

      const arrayBuf = await res.arrayBuffer();
      assert(arrayBuf.byteLength > 20000, 'PPTX stream must be > 20KB of valid zip/pptx binary data');
    });

    // 3. Protected Route Rejection without JWT
    await runAsyncTest('Protected /api/generate rejects unauthenticated requests with 401', async () => {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test', type: 'pptx' }),
      });
      assert.strictEqual(res.status, 401, 'Should reject unauthenticated calls with 401');
      const data = await res.json();
      assert.strictEqual(data.success, false);
    });

    // 4. Authenticated File Download with FileId Streaming Contract
    await runAsyncTest('Authenticated file download streams binary with proper headers', async () => {
      // Create a test file in temp
      const testFileId = 'test-contract-file-123';
      const testFileName = `${testFileId}.txt`;
      const testFilePath = path.join(TEMP_DIR, testFileName);
      fs.writeFileSync(testFilePath, 'DocuGenius AI Contract Test File Content', 'utf-8');

      // Generate a valid JWT
      const token = jwt.sign(
        { id: 'contract_user_1', email: 'contract@docugenius.ai', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await fetch(`${baseUrl}/api/generate/${testFileId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('content-type'), 'text/plain');
      assert(res.headers.get('content-disposition')?.includes(testFileName));

      const text = await res.text();
      assert.strictEqual(text, 'DocuGenius AI Contract Test File Content');

      // Clean up test file
      try { fs.unlinkSync(testFilePath); } catch {}
    });

    // 5. Frontend Production Build Artifacts Verification
    runTest('Frontend Vite build artifacts exist in frontend/dist', () => {
      const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
      assert(fs.existsSync(distDir), 'frontend/dist directory must exist');
      assert(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html must exist');
      assert(fs.existsSync(path.join(distDir, 'assets')), 'dist/assets must exist');

      const assets = fs.readdirSync(path.join(distDir, 'assets'));
      const hasJs = assets.some((f) => f.endsWith('.js'));
      const hasCss = assets.some((f) => f.endsWith('.css'));
      assert(hasJs, 'dist/assets must contain built JavaScript bundle');
      assert(hasCss, 'dist/assets must contain built CSS bundle');
    });

    // 6. Responsive UI & Pages Verification
    runTest('Frontend pages and components are properly mapped and exported', () => {
      const srcPages = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages');
      const requiredPages = [
        'Landing.jsx',
        'Login.jsx',
        'Register.jsx',
        'Dashboard.jsx',
        'Generator.jsx',
        'History.jsx',
        'Profile.jsx',
        'Settings.jsx',
      ];

      for (const page of requiredPages) {
        assert(fs.existsSync(path.join(srcPages, page)), `${page} must exist in frontend/src/pages`);
      }
    });

    // 7. Marked Pending Tests (Requiring MongoDB)
    markPending(
      'Live user registration via POST /api/auth/register and database persistence',
      'Requires active MongoDB cluster connection string (MONGODB_URI).'
    );

    markPending(
      'Live user authentication via POST /api/auth/login and password match verification',
      'Requires active MongoDB cluster connection string (MONGODB_URI).'
    );

    markPending(
      'Document history retrieval via GET /api/history and per-user isolation',
      'Requires active MongoDB cluster connection string (MONGODB_URI).'
    );

    console.log('\n===============================================================');
    console.log(`🏁 TEST SUMMARY:`);
    console.log(`   Passed:     ${passedTests}`);
    console.log(`   Failed:     ${totalTests - passedTests - pendingTests}`);
    console.log(`   Not Tested: ${pendingTests} (Pending MongoDB credentials)`);
    console.log(`   Total:      ${totalTests}`);
    console.log('===============================================================\n');

  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

