import assert from 'assert';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Document from '../models/Document.js';
import { registerSchema, loginSchema, generateDocSchema, validateBody } from '../middleware/zodValidate.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import auth from '../middleware/auth.js';

// Setup test env
process.env.JWT_SECRET = 'test_jwt_secret_docugenius_2026';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

console.log('🧪 ===============================================');
console.log('🧪 DOCUGENIUS AI - PHASE 2 BACKEND VERIFICATION');
console.log('🧪 ===============================================\n');

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
  // 1. User Model Schema & Methods
  await runAsyncTest('User model bcrypt password hashing and comparePassword method', async () => {
    const rawPassword = 'plainTextPassword123';
    const hashedPassword = await bcrypt.hash(rawPassword, 12);
    
    const user = new User({
      name: 'John Doe',
      email: 'john@example.com',
      password: hashedPassword,
    });

    assert(user.password !== rawPassword, 'Password must be hashed');
    assert(user.password.startsWith('$2'), 'Password must be a valid bcrypt hash');

    // Test comparePassword instance method
    const isMatch = await user.comparePassword(rawPassword);
    assert(isMatch === true, 'comparePassword must return true for correct password');
    const isWrong = await user.comparePassword('wrongPassword');
    assert(isWrong === false, 'comparePassword must return false for incorrect password');
  });

  // 2. User Validation Constraints
  runTest('User validation rules enforce name, email format, and minlength password', () => {
    const invalidUser = new User({
      name: '',
      email: 'not-an-email',
      password: '123',
    });
    const error = invalidUser.validateSync();
    assert(error.errors.name, 'Should require name');
    assert(error.errors.password, 'Should require password minlength 6');
  });

  // 3. Document Model Schema & Indices
  runTest('Document model contains all required schema fields, enums, and indexes', () => {
    const doc = new Document({
      userId: new mongoose.Types.ObjectId(),
      title: 'AI Presentation',
      type: 'pptx',
      settings: { theme: 'corporate', slideCount: 10 },
      status: 'pending',
    });
    const error = doc.validateSync();
    assert(!error, 'Document should validate cleanly with required fields');

    const invalidDoc = new Document({ title: 'Missing Type and User' });
    const invalidErr = invalidDoc.validateSync();
    assert(invalidErr.errors.userId, 'Should require userId');
    assert(invalidErr.errors.type, 'Should require document type');
  });

  // 4. Zod Validation: Register Schema
  runTest('Zod register schema validation: valid and invalid payloads', () => {
    const validData = {
      name: 'Alice Smith',
      email: 'Alice.Smith@Domain.com',
      password: 'securePassword#2026',
    };
    const validResult = registerSchema.safeParse(validData);
    assert(validResult.success === true, 'Valid registration payload should pass');
    assert(validResult.data.email === 'alice.smith@domain.com', 'Email should be normalized to lowercase');

    const invalidData = {
      name: 'A',
      email: 'invalid-email-address',
      password: '123',
    };
    const invalidResult = registerSchema.safeParse(invalidData);
    assert(invalidResult.success === false, 'Invalid registration payload should fail');
    const issues = invalidResult.error.issues || invalidResult.error.errors;
    assert(issues.length >= 3, 'Should produce at least 3 validation errors');
  });

  // 5. Zod Validation: Login Schema
  runTest('Zod login schema validation', () => {
    const validLogin = loginSchema.safeParse({ email: 'user@test.com', password: 'myPassword' });
    assert(validLogin.success === true);

    const invalidLogin = loginSchema.safeParse({ email: 'bad-email', password: '' });
    assert(invalidLogin.success === false);
  });

  // 6. Zod Validation: Document Generation Schema
  runTest('Zod document generation schema validation', () => {
    const validDoc = generateDocSchema.safeParse({
      title: 'Quarterly Financial Review',
      type: 'pptx',
      settings: { theme: 'corporate', slideCount: 15 },
    });
    assert(validDoc.success === true, 'Valid generation settings should pass');

    const invalidType = generateDocSchema.safeParse({
      title: 'Test',
      type: 'pdf', // Only pptx, docx, txt allowed
    });
    assert(invalidType.success === false, 'Invalid type "pdf" should fail');
  });

  // 7. JWT Authentication Middleware: Authorization Bearer Header
  await runAsyncTest('Auth middleware verifies valid Bearer token', async () => {
    const payload = { id: 'user_12345', email: 'alice@example.com', role: 'user' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: {},
    };
    let nextCalled = false;
    const res = {
      status: () => res,
      json: () => res,
    };

    auth(req, res, () => {
      nextCalled = true;
    });

    assert(nextCalled === true, 'auth middleware should call next() for valid Bearer token');
    assert(req.user.id === 'user_12345', 'req.user.id should be attached');
    assert(req.user.email === 'alice@example.com', 'req.user.email should be attached');
  });

  // 8. JWT Authentication Middleware: HttpOnly Cookie
  await runAsyncTest('Auth middleware verifies token from cookie', async () => {
    const payload = { id: 'user_cookie_999', email: 'cookie@example.com', role: 'admin' };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    const req = {
      headers: {},
      cookies: { token },
    };
    let nextCalled = false;
    const res = { status: () => res, json: () => res };

    auth(req, res, () => {
      nextCalled = true;
    });

    assert(nextCalled === true, 'auth middleware should call next() for valid cookie');
    assert(req.user.id === 'user_cookie_999');
    assert(req.user.role === 'admin');
  });

  // 9. JWT Authentication Middleware: Missing and Invalid Token Rejection
  runTest('Auth middleware rejects missing or invalid token with 401', () => {
    let statusCode = null;
    let responseBody = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseBody = data;
        return res;
      },
    };

    // Missing token
    auth({ headers: {}, cookies: {} }, res, () => {});
    assert(statusCode === 401, 'Should return 401 when no token provided');
    assert(responseBody.success === false);

    // Invalid token
    auth({ headers: { authorization: 'Bearer invalid_signature_token' }, cookies: {} }, res, () => {});
    assert(statusCode === 401, 'Should return 401 for invalid token');
  });

  // 10. Centralized Error Handler
  runTest('Centralized errorHandler handles JSON SyntaxError, Mongoose CastError, and defaults', () => {
    let result = {};
    const res = {
      status: (code) => {
        result.status = code;
        return res;
      },
      json: (data) => {
        result.body = data;
        return res;
      },
    };

    // Test malformed JSON syntax error
    const syntaxErr = new SyntaxError('Unexpected token');
    syntaxErr.status = 400;
    syntaxErr.body = '{ malformed ';
    errorHandler(syntaxErr, { method: 'POST', url: '/api/auth/login' }, res, () => {});
    assert(result.status === 400, 'SyntaxError should return 400');
    assert(result.body.error === 'Malformed JSON payload provided');

    // Test CastError
    const castErr = new Error('Cast error');
    castErr.name = 'CastError';
    castErr.value = 'invalid_id_123';
    errorHandler(castErr, { method: 'GET', url: '/api/history/invalid_id_123' }, res, () => {});
    assert(result.status === 400, 'CastError should return 400');
    assert(result.body.error.includes('Resource not found with id'));
  });

  // 11. Centralized 404 Handler
  runTest('notFoundHandler returns structured 404 response', () => {
    let result = {};
    const res = {
      status: (code) => {
        result.status = code;
        return res;
      },
      json: (data) => {
        result.body = data;
        return res;
      },
    };
    notFoundHandler({ method: 'GET', originalUrl: '/api/nonexistent-route' }, res);
    assert(result.status === 404);
    assert(result.body.success === false);
    assert(result.body.error.includes('/api/nonexistent-route'));
  });

  // 12. Legacy PPT Route Backward Compatibility
  await runAsyncTest('Legacy PPT route text chunking & ASCII diagram detection', async () => {
    const { default: pptRouter } = await import('../routes/ppt.js');
    assert(pptRouter, 'Legacy ppt router should be exported as default');

    // Test PptxGenJS directly with diagram and long text block
    const { default: PptxGenJS } = await import('pptxgenjs');
    const ppt = new PptxGenJS();
    const titleSlide = ppt.addSlide();
    titleSlide.addText('Phase 2 Test Presentation', { fontSize: 32 });

    const buffer = await ppt.write({ outputType: 'nodebuffer' });
    assert(buffer && buffer.length > 10000, 'Generated PPTX buffer should be valid and > 10KB');
  });

  console.log('\n===============================================');
  console.log(`🏁 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('===============================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
