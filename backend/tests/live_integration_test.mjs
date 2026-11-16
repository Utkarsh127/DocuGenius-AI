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

// Load environment from backend/.env
dotenv.config({ path: path.join(backendDir, '.env') });

import app from '../server.js';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Document from '../models/Document.js';

console.log('🧪 =================================================================');
console.log('🧪 DOCUGENIUS AI - LIVE END-TO-END INTEGRATION TEST SUITE');
console.log('🧪 =================================================================\n');

let passedTests = 0;
let totalTests = 0;
let failedTests = 0;

function logPass(name, detail = '') {
  totalTests++;
  passedTests++;
  console.log(`✅ [PASS] Test ${totalTests}: ${name}`);
  if (detail) console.log(`    ↳ ${detail}`);
}

function logFail(name, err) {
  totalTests++;
  failedTests++;
  console.error(`❌ [FAIL] Test ${totalTests}: ${name}`);
  console.error(`    ↳ Error: ${err.message || err}`);
}

async function run() {
  const modelUsed = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  console.log(`ℹ️  Active AI Model: ${modelUsed}`);
  console.log(`ℹ️  Node Version: ${process.version}\n`);

  // --- Step 1: Connect to MongoDB & Verify Isolated Database ---
  console.log('--- Step 1: Database Safety & Isolation Verification ---');
  await connectDB();
  const dbName = mongoose.connection.name;
  console.log(`ℹ️  Connected MongoDB database name: "${dbName}"`);
  
  if (dbName !== 'test') {
    throw new Error(`SAFETY ABORT: Expected isolated test database "test", but connected to "${dbName}".`);
  }
  console.log('✅ Isolated test database verified ("test"). Safe to proceed.\n');

  // Start test server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`ℹ️  Ephemeral test server listening at ${baseUrl}\n`);

  // Tracking for cleanup
  const createdUserIds = [];
  const createdDocIds = [];
  const createdTempFiles = [];

  const timestamp = Date.now();
  const primaryEmail = `docugenius_qa_user_${timestamp}@testmail.local`;
  const secondaryEmail = `docugenius_qa_iso_${timestamp}@testmail.local`;
  const primaryPassword = `TestPass!#${timestamp}`;

  let primaryToken = null;
  let primaryUserId = null;
  let secondaryToken = null;
  let secondaryUserId = null;

  let pptxDoc = null;
  let docxDoc = null;
  let txtDoc = null;

  try {
    // -------------------------------------------------------------
    // Test 1: User Registration and MongoDB Persistence
    // -------------------------------------------------------------
    try {
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'QA Test User',
          email: primaryEmail,
          password: primaryPassword,
        }),
      });

      const regData = await regRes.json();
      assert.strictEqual(regRes.status, 201, `Register HTTP status should be 201, got ${regRes.status}`);
      assert.strictEqual(regData.success, true, 'Register success flag must be true');
      assert(regData.data.token, 'Response must return JWT token');
      assert.strictEqual(regData.data.user.email, primaryEmail.toLowerCase());

      primaryToken = regData.data.token;
      primaryUserId = regData.data.user.id;
      createdUserIds.push(primaryUserId);

      // Verify persistence in MongoDB
      const dbUser = await User.findById(primaryUserId).select('+password');
      assert(dbUser, 'User record must exist in MongoDB User collection');
      assert.strictEqual(dbUser.email, primaryEmail.toLowerCase());
      assert(dbUser.password.startsWith('$2'), 'Password in DB must be bcrypt hashed');

      logPass(
        'User registration and MongoDB persistence',
        `User ID: ${primaryUserId}, email normalized & bcrypt hashed in DB`
      );
    } catch (err) {
      logFail('User registration and MongoDB persistence', err);
    }

    // -------------------------------------------------------------
    // Test 2: Login, Password Verification and JWT
    // -------------------------------------------------------------
    try {
      // 2a: Valid credentials
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: primaryEmail,
          password: primaryPassword,
        }),
      });
      const loginData = await loginRes.json();
      assert.strictEqual(loginRes.status, 200, 'Login status must be 200');
      assert.strictEqual(loginData.success, true);
      assert(loginData.data.token, 'Login must issue JWT token');

      // Verify JWT payload
      const decoded = jwt.decode(loginData.data.token);
      assert.strictEqual(decoded.id, primaryUserId);
      assert.strictEqual(decoded.email, primaryEmail.toLowerCase());

      // 2b: Invalid password rejection
      const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: primaryEmail,
          password: 'IncorrectPassword999',
        }),
      });
      assert.strictEqual(badLoginRes.status, 401, 'Bad password must be rejected with 401');

      logPass(
        'Login, password verification and JWT token issuance',
        'Valid credentials authenticated; invalid password correctly rejected with 401'
      );
    } catch (err) {
      logFail('Login, password verification and JWT token issuance', err);
    }

    // -------------------------------------------------------------
    // Test 3: Real Gemini AI PPTX Generation & File Validity
    // -------------------------------------------------------------
    try {
      console.log('    ⏳ Generating PPTX presentation via Gemini AI...');
      const pptxRes = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${primaryToken}`,
        },
        body: JSON.stringify({
          title: `Cloud Scalability ${timestamp}`,
          topic: 'Cloud Scalability Patterns',
          description: 'Key architectural patterns for auto-scaling microservices',
          type: 'pptx',
          theme: 'technology',
          contentLength: 'short',
        }),
      });

      const pptxData = await pptxRes.json();
      assert.strictEqual(pptxRes.status, 201, `PPTX generate status should be 201, got ${pptxRes.status}: ${JSON.stringify(pptxData)}`);
      assert.strictEqual(pptxData.success, true);
      assert(pptxData.data.id, 'Response must return document id');
      assert(pptxData.data.fileName, 'Response must return fileName');

      pptxDoc = pptxData.data;
      createdDocIds.push(pptxDoc.id);
      createdTempFiles.push(pptxDoc.fileName);

      // Validate file on disk
      const filePath = path.join(TEMP_DIR, pptxDoc.fileName);
      assert(fs.existsSync(filePath), `Generated file ${filePath} must exist on disk`);
      const buffer = fs.readFileSync(filePath);
      assert(buffer.length > 20000, `PPTX file size (${buffer.length} bytes) must be > 20KB`);
      // Verify ZIP/OpenXML magic bytes: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
      assert.strictEqual(buffer[0], 0x50);
      assert.strictEqual(buffer[1], 0x4b);
      assert.strictEqual(buffer[2], 0x03);
      assert.strictEqual(buffer[3], 0x04);

      // Verify AI structured content
      assert(pptxDoc.content.title, 'AI content must have a title');
      assert(Array.isArray(pptxDoc.content.slides) && pptxDoc.content.slides.length > 0, 'AI content must have slides');

      logPass(
        'PPTX generation using real Gemini AI output',
        `File: ${pptxDoc.fileName} (${buffer.length} bytes, valid OpenXML/ZIP header, ${pptxDoc.content.slides.length} slides)`
      );
    } catch (err) {
      logFail('PPTX generation using real Gemini AI output', err);
    }

    // -------------------------------------------------------------
    // Test 4: Real Gemini AI DOCX Generation & File Validity
    // -------------------------------------------------------------
    try {
      console.log('    ⏳ Generating DOCX document via Gemini AI...');
      const docxRes = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${primaryToken}`,
        },
        body: JSON.stringify({
          title: `Kubernetes Architecture ${timestamp}`,
          topic: 'Kubernetes Container Orchestration',
          description: 'Control plane and worker node responsibilities',
          type: 'docx',
          contentLength: 'short',
        }),
      });

      const docxData = await docxRes.json();
      assert.strictEqual(docxRes.status, 201, `DOCX generate status should be 201, got ${docxRes.status}: ${JSON.stringify(docxData)}`);
      assert.strictEqual(docxData.success, true);
      assert(docxData.data.id, 'Response must return document id');
      assert(docxData.data.fileName, 'Response must return fileName');

      docxDoc = docxData.data;
      createdDocIds.push(docxDoc.id);
      createdTempFiles.push(docxDoc.fileName);

      // Validate file on disk
      const filePath = path.join(TEMP_DIR, docxDoc.fileName);
      assert(fs.existsSync(filePath), `Generated file ${filePath} must exist on disk`);
      const buffer = fs.readFileSync(filePath);
      assert(buffer.length > 8000, `DOCX file size (${buffer.length} bytes) must be > 8KB`);
      // Verify ZIP/OpenXML magic bytes
      assert.strictEqual(buffer[0], 0x50);
      assert.strictEqual(buffer[1], 0x4b);
      assert.strictEqual(buffer[2], 0x03);
      assert.strictEqual(buffer[3], 0x04);

      // Verify AI structured content
      assert(docxDoc.content.title, 'AI content must have a title');
      assert(Array.isArray(docxDoc.content.sections) && docxDoc.content.sections.length > 0, 'AI content must have sections');

      logPass(
        'DOCX generation using real Gemini AI output',
        `File: ${docxDoc.fileName} (${buffer.length} bytes, valid OpenXML/ZIP header, ${docxDoc.content.sections.length} sections)`
      );
    } catch (err) {
      logFail('DOCX generation using real Gemini AI output', err);
    }

    // -------------------------------------------------------------
    // Test 5: Real Gemini AI TXT Generation & File Validity
    // -------------------------------------------------------------
    try {
      console.log('    ⏳ Generating TXT document via Gemini AI...');
      const txtRes = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${primaryToken}`,
        },
        body: JSON.stringify({
          title: `REST API Guidelines ${timestamp}`,
          topic: 'RESTful API Design Standards',
          description: 'HTTP status codes and idempotency conventions',
          type: 'txt',
          contentLength: 'short',
        }),
      });

      const txtData = await txtRes.json();
      assert.strictEqual(txtRes.status, 201, `TXT generate status should be 201, got ${txtRes.status}: ${JSON.stringify(txtData)}`);
      assert.strictEqual(txtData.success, true);
      assert(txtData.data.id, 'Response must return document id');
      assert(txtData.data.fileName, 'Response must return fileName');

      txtDoc = txtData.data;
      createdDocIds.push(txtDoc.id);
      createdTempFiles.push(txtDoc.fileName);

      // Validate file on disk
      const filePath = path.join(TEMP_DIR, txtDoc.fileName);
      assert(fs.existsSync(filePath), `Generated file ${filePath} must exist on disk`);
      const text = fs.readFileSync(filePath, 'utf-8');
      assert(text.length > 100, `TXT file length (${text.length} chars) must be > 100`);
      assert(text.includes('==='), 'TXT file should contain formatted title underline');

      logPass(
        'TXT generation using real Gemini AI output',
        `File: ${txtDoc.fileName} (${text.length} chars formatted text with section dividers)`
      );
    } catch (err) {
      logFail('TXT generation using real Gemini AI output', err);
    }

    // -------------------------------------------------------------
    // Test 6: Document Metadata and Status Lifecycle in MongoDB
    // -------------------------------------------------------------
    try {
      for (const docInfo of [pptxDoc, docxDoc, txtDoc]) {
        if (!docInfo) continue;
        const dbDoc = await Document.findById(docInfo.id);
        assert(dbDoc, `Document ${docInfo.id} must exist in MongoDB`);
        assert.strictEqual(dbDoc.status, 'completed', `Document ${docInfo.id} status must be "completed"`);
        assert.strictEqual(dbDoc.userId.toString(), primaryUserId.toString(), 'Document userId must match owner');
        assert.strictEqual(dbDoc.fileName, docInfo.fileName);
        assert(dbDoc.fileSize > 0, 'Document fileSize must be stored');
        assert(dbDoc.content, 'Document AI structured content must be stored in DB');
      }

      logPass(
        'Document metadata and status lifecycle in MongoDB',
        'All 3 documents transitioned to status: "completed" with full metadata & owner ID'
      );
    } catch (err) {
      logFail('Document metadata and status lifecycle in MongoDB', err);
    }

    // -------------------------------------------------------------
    // Test 7: History Retrieval and Per-User Isolation
    // -------------------------------------------------------------
    try {
      // Create secondary user
      const secReg = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Isolation Test User',
          email: secondaryEmail,
          password: primaryPassword,
        }),
      });
      const secData = await secReg.json();
      secondaryToken = secData.data.token;
      secondaryUserId = secData.data.user.id;
      createdUserIds.push(secondaryUserId);

      // Primary user history: should have exactly 3 documents
      const primaryHistRes = await fetch(`${baseUrl}/api/history`, {
        headers: { Authorization: `Bearer ${primaryToken}` },
      });
      const primaryHist = await primaryHistRes.json();
      assert.strictEqual(primaryHistRes.status, 200);
      assert.strictEqual(primaryHist.data.documents.length, 3, 'Primary user should see exactly 3 generated documents');
      assert.strictEqual(primaryHist.data.pagination.total, 3);

      // Secondary user history: must have 0 documents (isolation check!)
      const secHistRes = await fetch(`${baseUrl}/api/history`, {
        headers: { Authorization: `Bearer ${secondaryToken}` },
      });
      const secHist = await secHistRes.json();
      assert.strictEqual(secHistRes.status, 200);
      assert.strictEqual(secHist.data.documents.length, 0, 'Secondary user must see 0 documents (strict isolation)');

      // Primary user stats check
      const statsRes = await fetch(`${baseUrl}/api/history/stats`, {
        headers: { Authorization: `Bearer ${primaryToken}` },
      });
      const statsData = await statsRes.json();
      assert.strictEqual(statsRes.status, 200);
      assert.strictEqual(statsData.data.total, 3);
      assert.strictEqual(statsData.data.byType.pptx, 1);
      assert.strictEqual(statsData.data.byType.docx, 1);
      assert.strictEqual(statsData.data.byType.txt, 1);

      logPass(
        'History retrieval and per-user isolation',
        'Primary user sees 3 documents; secondary user sees 0; type breakdown verified'
      );
    } catch (err) {
      logFail('History retrieval and per-user isolation', err);
    }

    // -------------------------------------------------------------
    // Test 8: Authenticated File Downloads and File Validity
    // -------------------------------------------------------------
    try {
      // 8a: Download PPTX
      const pptxDlRes = await fetch(`${baseUrl}/api/generate/${pptxDoc.id}/download`, {
        headers: { Authorization: `Bearer ${primaryToken}` },
      });
      assert.strictEqual(pptxDlRes.status, 200);
      assert(pptxDlRes.headers.get('content-type')?.includes('presentationml'));
      const pptxBlob = await pptxDlRes.arrayBuffer();
      assert.strictEqual(pptxBlob.byteLength, fs.readFileSync(path.join(TEMP_DIR, pptxDoc.fileName)).length);

      // 8b: Download DOCX
      const docxDlRes = await fetch(`${baseUrl}/api/generate/${docxDoc.id}/download`, {
        headers: { Authorization: `Bearer ${primaryToken}` },
      });
      assert.strictEqual(docxDlRes.status, 200);
      assert(docxDlRes.headers.get('content-type')?.includes('wordprocessingml'));
      const docxBlob = await docxDlRes.arrayBuffer();
      assert.strictEqual(docxBlob.byteLength, fs.readFileSync(path.join(TEMP_DIR, docxDoc.fileName)).length);

      // 8c: Download TXT
      const txtDlRes = await fetch(`${baseUrl}/api/generate/${txtDoc.id}/download`, {
        headers: { Authorization: `Bearer ${primaryToken}` },
      });
      assert.strictEqual(txtDlRes.status, 200);
      assert.strictEqual(txtDlRes.headers.get('content-type'), 'text/plain');
      const txtContent = await txtDlRes.text();
      assert.strictEqual(txtContent, fs.readFileSync(path.join(TEMP_DIR, txtDoc.fileName), 'utf-8'));

      // 8d: Cross-user download security rejection
      const crossDlRes = await fetch(`${baseUrl}/api/generate/${pptxDoc.id}/download`, {
        headers: { Authorization: `Bearer ${secondaryToken}` },
      });
      assert.strictEqual(crossDlRes.status, 404, 'Unauthorized user download must return 404/not found');

      logPass(
        'Authenticated file downloads and file validity',
        'PPTX, DOCX, and TXT stream valid byte-for-byte binaries; cross-user download strictly blocked'
      );
    } catch (err) {
      logFail('Authenticated file downloads and file validity', err);
    }

  } finally {
    // -------------------------------------------------------------
    // Clean up ONLY created test records and temp files
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Isolated Cleanup (Zero Impact on Existing Data) ---');
    try {
      if (createdDocIds.length > 0) {
        const docDel = await Document.deleteMany({ _id: { $in: createdDocIds } });
        console.log(`🧹 Deleted ${docDel.deletedCount} temporary test document record(s).`);
      }
      if (createdUserIds.length > 0) {
        const userDel = await User.deleteMany({ _id: { $in: createdUserIds } });
        console.log(`🧹 Deleted ${userDel.deletedCount} temporary test user account(s).`);
      }
      for (const fileName of createdTempFiles) {
        const fPath = path.join(TEMP_DIR, fileName);
        if (fs.existsSync(fPath)) {
          fs.unlinkSync(fPath);
          console.log(`🧹 Removed temporary file: ${fileName}`);
        }
      }
    } catch (cleanupErr) {
      console.error('⚠️  Cleanup error:', cleanupErr.message);
    }

    server.close();
    await mongoose.disconnect();
    console.log('🔌 Ephemeral server stopped & MongoDB connection closed cleanly.\n');
  }

  console.log('=================================================================');
  console.log(`🏁 LIVE INTEGRATION TEST SUMMARY:`);
  console.log(`   Passed:     ${passedTests}`);
  console.log(`   Failed:     ${failedTests}`);
  console.log(`   Total:      ${totalTests}`);
  console.log('=================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
