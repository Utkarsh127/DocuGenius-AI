import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const TEMP_DIR = path.join(backendDir, 'temp');

dotenv.config({ path: path.join(backendDir, '.env') });

import app from '../server.js';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Document from '../models/Document.js';

console.log('🧪 =================================================================');
console.log('🧪 DOCUGENIUS AI - PRODUCTION READINESS & RECOMPILATION TEST SUITE');
console.log('🧪 =================================================================\n');

let passedTests = 0;
let totalTests = 0;

function logPass(name, detail = '') {
  totalTests++;
  passedTests++;
  console.log(`✅ [PASS] Test ${totalTests}: ${name}`);
  if (detail) console.log(`    ↳ ${detail}`);
}

function logFail(name, err) {
  totalTests++;
  console.error(`❌ [FAIL] Test ${totalTests}: ${name}`);
  console.error(`    ↳ Error: ${err.message || err}`);
}

async function main() {
  await connectDB();
  const dbName = mongoose.connection.name;
  assert.strictEqual(dbName, 'test', 'SAFETY CHECK: Must be connected to test database');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const createdUserIds = [];
  const createdDocIds = [];
  const createdTempFiles = [];

  const timestamp = Date.now();
  const testEmail = `docugenius_prod_qa_${timestamp}@testmail.local`;
  const otherUserEmail = `docugenius_other_${timestamp}@testmail.local`;
  const testPassword = `TestPass!#${timestamp}`;

  try {
    // -------------------------------------------------------------
    // Test 1: Health Check Endpoints
    // -------------------------------------------------------------
    try {
      const h1 = await fetch(`${baseUrl}/health`);
      assert.strictEqual(h1.status, 200);
      const d1 = await h1.json();
      assert.strictEqual(d1.status, 'ok');
      assert.strictEqual(d1.service, 'DocuGenius AI API');
      assert(typeof d1.uptime === 'number');

      const h2 = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(h2.status, 200);
      const d2 = await h2.json();
      assert.strictEqual(d2.status, 'ok');

      logPass('Health Check Endpoints (/health and /api/health)', 'Both return HTTP 200 with service status & uptime');
    } catch (err) {
      logFail('Health Check Endpoints (/health and /api/health)', err);
    }

    // -------------------------------------------------------------
    // Test 2: Reverse Proxy Trust Configuration
    // -------------------------------------------------------------
    try {
      const trustProxy = app.get('trust proxy');
      assert(trustProxy === 1 || trustProxy === true, 'app.set("trust proxy", 1) must be active for Render / Cloud load balancers');
      logPass('Reverse proxy trust configuration', 'app.set("trust proxy", 1) confirmed active');
    } catch (err) {
      logFail('Reverse proxy trust configuration', err);
    }

    // -------------------------------------------------------------
    // Test 3: Strict Production CORS Enforcement
    // -------------------------------------------------------------
    try {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // 3a. Disallowed external origin should be blocked in production
      const blockedRes = await fetch(`${baseUrl}/health`, {
        headers: { Origin: 'https://unauthorized-malicious-domain.com' },
      });
      // In Express with cors(), rejected origins either receive 500/CORS error or lack Access-Control-Allow-Origin
      const allowHeader = blockedRes.headers.get('access-control-allow-origin');
      assert(!allowHeader || allowHeader !== 'https://unauthorized-malicious-domain.com', 'Disallowed origin must not receive Access-Control-Allow-Origin');

      // 3b. Request with no origin (mobile app, server curl) allowed
      const noOriginRes = await fetch(`${baseUrl}/health`);
      assert.strictEqual(noOriginRes.status, 200);

      process.env.NODE_ENV = prevEnv;
      logPass('Strict production CORS enforcement', 'Disallowed origin blocked; no-origin requests permitted');
    } catch (err) {
      logFail('Strict production CORS enforcement', err);
    }

    // -------------------------------------------------------------
    // Setup Test User & Secondary User
    // -------------------------------------------------------------
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Prod QA User', email: testEmail, password: testPassword }),
    });
    const regData = await regRes.json();
    const token = regData.data.token;
    const userId = regData.data.user.id;
    createdUserIds.push(userId);

    const otherRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Other User', email: otherUserEmail, password: testPassword }),
    });
    const otherRegData = await otherRegRes.json();
    const otherToken = otherRegData.data.token;
    const otherUserId = otherRegData.data.user.id;
    createdUserIds.push(otherUserId);

    // -------------------------------------------------------------
    // Test 4: On-Demand Recompilation Fallback for Missing PPTX
    // -------------------------------------------------------------
    try {
      const pptxDoc = await Document.create({
        userId,
        title: `Recompilation PPTX Test ${timestamp}`,
        type: 'pptx',
        fileName: `missing_ephemeral_${timestamp}.pptx`,
        fileSize: 105000,
        settings: { theme: 'technology', slideCount: 3 },
        content: {
          title: `Recompiled PPTX ${timestamp}`,
          slides: [
            { title: 'Slide 1', bullets: ['Bullet A', 'Bullet B'], notes: 'Note' },
            { title: 'Slide 2', bullets: ['Bullet C', 'Bullet D'] },
          ],
        },
        status: 'completed',
      });
      createdDocIds.push(pptxDoc._id);

      // Verify the file does NOT exist on disk
      const missingFilePath = path.join(TEMP_DIR, pptxDoc.fileName);
      assert(!fs.existsSync(missingFilePath), 'Pre-condition: temp file must NOT exist on disk');

      // Request download
      const dlRes = await fetch(`${baseUrl}/api/generate/${pptxDoc._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.strictEqual(dlRes.status, 200, `Expected status 200, got ${dlRes.status}`);
      assert(dlRes.headers.get('content-type')?.includes('presentationml'));
      const blob = await dlRes.arrayBuffer();
      const buf = Buffer.from(blob);

      assert(buf.length > 20000, `Recompiled PPTX size (${buf.length}) must be > 20KB`);
      assert.strictEqual(buf[0], 0x50);
      assert.strictEqual(buf[1], 0x4b);
      assert.strictEqual(buf[2], 0x03);
      assert.strictEqual(buf[3], 0x04);

      if (fs.existsSync(missingFilePath)) createdTempFiles.push(pptxDoc.fileName);

      logPass(
        'On-demand recompilation fallback: Missing PPTX',
        `Recompiled binary on-the-fly (${buf.length} bytes, valid OpenXML/ZIP magic bytes)`
      );
    } catch (err) {
      logFail('On-demand recompilation fallback: Missing PPTX', err);
    }

    // -------------------------------------------------------------
    // Test 5: On-Demand Recompilation Fallback for Missing DOCX
    // -------------------------------------------------------------
    try {
      const docxDoc = await Document.create({
        userId,
        title: `Recompilation DOCX Test ${timestamp}`,
        type: 'docx',
        fileName: `missing_ephemeral_${timestamp}.docx`,
        fileSize: 13000,
        settings: { tone: 'professional' },
        content: {
          title: `Recompiled DOCX ${timestamp}`,
          sections: [
            { heading: 'Section 1', level: 1, content: 'Text content paragraph.', bullets: ['P1', 'P2'] },
            { heading: 'Section 2', level: 2, content: 'Second paragraph.' },
          ],
        },
        status: 'completed',
      });
      createdDocIds.push(docxDoc._id);

      const missingFilePath = path.join(TEMP_DIR, docxDoc.fileName);
      assert(!fs.existsSync(missingFilePath));

      const dlRes = await fetch(`${baseUrl}/api/generate/${docxDoc._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.strictEqual(dlRes.status, 200);
      assert(dlRes.headers.get('content-type')?.includes('wordprocessingml'));
      const blob = await dlRes.arrayBuffer();
      const buf = Buffer.from(blob);

      assert(buf.length > 8000, `Recompiled DOCX size (${buf.length}) must be > 8KB`);
      assert.strictEqual(buf[0], 0x50);
      assert.strictEqual(buf[1], 0x4b);

      if (fs.existsSync(missingFilePath)) createdTempFiles.push(docxDoc.fileName);

      logPass(
        'On-demand recompilation fallback: Missing DOCX',
        `Recompiled binary on-the-fly (${buf.length} bytes, valid OpenXML/ZIP magic bytes)`
      );
    } catch (err) {
      logFail('On-demand recompilation fallback: Missing DOCX', err);
    }

    // -------------------------------------------------------------
    // Test 6: On-Demand Recompilation Fallback for Missing TXT
    // -------------------------------------------------------------
    try {
      const txtDoc = await Document.create({
        userId,
        title: `Recompilation TXT Test ${timestamp}`,
        type: 'txt',
        fileName: `missing_ephemeral_${timestamp}.txt`,
        fileSize: 500,
        settings: {},
        content: {
          title: `Recompiled TXT ${timestamp}`,
          sections: [
            { heading: 'Introduction', content: 'Plain text specifications.' },
          ],
        },
        status: 'completed',
      });
      createdDocIds.push(txtDoc._id);

      const missingFilePath = path.join(TEMP_DIR, txtDoc.fileName);
      assert(!fs.existsSync(missingFilePath));

      const dlRes = await fetch(`${baseUrl}/api/generate/${txtDoc._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.strictEqual(dlRes.status, 200);
      assert.strictEqual(dlRes.headers.get('content-type'), 'text/plain');
      const text = await dlRes.text();
      assert(text.includes('Recompiled TXT'));
      assert(text.includes('Plain text specifications.'));

      if (fs.existsSync(missingFilePath)) createdTempFiles.push(txtDoc.fileName);

      logPass(
        'On-demand recompilation fallback: Missing TXT',
        `Recompiled text on-the-fly (${text.length} chars formatted text)`
      );
    } catch (err) {
      logFail('On-demand recompilation fallback: Missing TXT', err);
    }

    // -------------------------------------------------------------
    // Test 7: Unauthorized Access & Demo Mode Protection
    // -------------------------------------------------------------
    try {
      // 7a. Demo guest token must be rejected with 401
      const demoRes = await fetch(`${baseUrl}/api/history`, {
        headers: { Authorization: 'Bearer demo-guest-token' },
      });
      assert.strictEqual(demoRes.status, 401, 'Mock/demo guest tokens must be rejected by backend API with 401');

      // 7b. Cross-user download attempt must be rejected with 404
      const crossRes = await fetch(`${baseUrl}/api/generate/${createdDocIds[0]}/download`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      assert.strictEqual(crossRes.status, 404, 'Cross-user file download must be blocked with 404');

      logPass(
        'Unauthorized access and demo token protection',
        'demo-guest-token rejected with 401; cross-user data access blocked with 404'
      );
    } catch (err) {
      logFail('Unauthorized access and demo token protection', err);
    }

    // -------------------------------------------------------------
    // Test 8: Frontend Vercel SPA Configuration Check
    // -------------------------------------------------------------
    try {
      const vercelJsonPath = path.resolve(backendDir, '..', 'frontend', 'vercel.json');
      assert(fs.existsSync(vercelJsonPath), 'frontend/vercel.json must exist');
      const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
      assert(
        Array.isArray(vercelConfig.rewrites) &&
        vercelConfig.rewrites.some((r) => r.source === '/(.*)' && r.destination === '/index.html'),
        'frontend/vercel.json must include SPA rewrite to /index.html'
      );

      logPass(
        'Frontend Vercel SPA configuration (vercel.json)',
        'Vercel rewrite rule verified for client-side routing'
      );
    } catch (err) {
      logFail('Frontend Vercel SPA configuration (vercel.json)', err);
    }

  } finally {
    // Isolated Cleanup
    try {
      if (createdDocIds.length > 0) {
        await Document.deleteMany({ _id: { $in: createdDocIds } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      for (const f of createdTempFiles) {
        const fp = path.join(TEMP_DIR, f);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    } catch {}

    server.close();
    await mongoose.disconnect();
  }

  console.log('\n=================================================================');
  console.log(`🏁 PRODUCTION READINESS TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('=================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

