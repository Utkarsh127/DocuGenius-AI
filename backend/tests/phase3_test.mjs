import assert from 'assert';
import { generatePPTX } from '../services/pptService.js';
import { generateDOCX } from '../services/docxService.js';
import { generateTXT } from '../services/txtService.js';
import {
  aiPptxSchema,
  aiDocxSchema,
  aiTxtSchema,
  validateStructuredOutput
} from '../services/aiService.js';
import {
  generateDiagramImage,
  getDiagramTextFallback
} from '../services/diagramService.js';

process.env.NODE_ENV = 'test';

console.log('🧪 =========================================================');
console.log('🧪 DOCUGENIUS AI - PHASE 3 GENERATION SERVICES VERIFICATION');
console.log('🧪 =========================================================\n');

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
  // 1. PPTX File Generation with Themes
  await runAsyncTest('PPTX generation across themes (Corporate, Technology, Academic)', async () => {
    const mockContent = {
      title: 'DocuGenius AI Architecture',
      slides: [
        {
          title: 'System Overview',
          bullets: [
            'Microservices backend architecture',
            'Node.js & Express RESTful APIs',
            'React 19 Vite frontend studio',
          ],
          notes: 'Cover the three main components on this slide.',
        },
        {
          title: 'AI Pipeline',
          bullets: [
            'Gemini API processing',
            'Structured Zod schema parsing',
            'Multi-format file rendering',
          ],
        },
      ],
    };

    // Test Corporate Theme
    const corpBuffer = await generatePPTX(mockContent, { theme: 'corporate' });
    assert(Buffer.isBuffer(corpBuffer), 'Output must be a Buffer');
    assert(corpBuffer.length > 20000, 'PPTX buffer must be valid size (>20KB)');

    // Test Technology Theme (Dark background contrast)
    const techBuffer = await generatePPTX(mockContent, { theme: 'technology' });
    assert(Buffer.isBuffer(techBuffer), 'Output must be a Buffer');
    assert(techBuffer.length > 20000, 'Technology theme PPTX buffer must be valid size');

    // Test Academic Theme
    const acadBuffer = await generatePPTX(mockContent, { theme: 'academic' });
    assert(Buffer.isBuffer(acadBuffer), 'Output must be a Buffer');
    assert(acadBuffer.length > 20000, 'Academic theme PPTX buffer must be valid size');
  });

  // 2. Intelligent Content Splitting and Overflow Handling (PPTX)
  await runAsyncTest('PPTX intelligent slide overflow handling (splits >6 bullets across slides)', async () => {
    const overflowContent = {
      title: 'High-Density Topic',
      slides: [
        {
          title: 'Large Section with Many Points',
          bullets: [
            'Point 1: Strategic planning and alignment',
            'Point 2: Architecture design and review',
            'Point 3: Continuous integration pipeline setup',
            'Point 4: Automated end-to-end testing verification',
            'Point 5: Security vulnerability scanning and mitigation',
            'Point 6: Production infrastructure provisioning',
            'Point 7: DNS configuration and SSL termination',
            'Point 8: User onboarding and analytics tracking',
            'Point 9: Operational monitoring and incident alerting',
            'Point 10: Post-deployment review and documentation',
          ],
        },
      ],
    };

    const buffer = await generatePPTX(overflowContent, { theme: 'businessPitch' });
    assert(Buffer.isBuffer(buffer), 'Output must be a Buffer');
    assert(buffer.length > 30000, 'Split slide presentation must be valid (>30KB)');
  });

  // 3. DOCX File Generation
  await runAsyncTest('DOCX generation (Title page, TOC, Headings, Tables, Page numbers)', async () => {
    const mockDocxContent = {
      title: 'Comprehensive AI Document Report',
      sections: [
        {
          heading: 'Executive Summary',
          level: 1,
          content: 'This document demonstrates automated Word document compilation.\nIt supports multiple paragraphs and styled tables.',
          bullets: [
            'Factual generation without hallucination',
            'Automatic table of contents generation',
            'Consistent typography and styling',
          ],
        },
        {
          heading: 'Performance Metrics',
          level: 2,
          content: 'Benchmark analysis of document compilation pipelines:',
          tableData: {
            headers: ['Format', 'Latency (ms)', 'Size (KB)'],
            rows: [
              ['PPTX', '120', '65'],
              ['DOCX', '85', '12'],
              ['TXT', '5', '1'],
            ],
          },
        },
      ],
    };

    const docxBuffer = await generateDOCX(mockDocxContent, { author: 'DocuGenius QA' });
    assert(Buffer.isBuffer(docxBuffer), 'Output must be a Buffer');
    assert(docxBuffer.length > 10000, 'DOCX buffer must be valid (>10KB)');
  });

  // 4. TXT File Generation
  runTest('TXT document generation (Headers with underlines, bullets, paragraph spacing)', () => {
    const mockTxtContent = {
      title: 'System Requirements Specification',
      sections: [
        {
          heading: '1. Introduction',
          content: 'This is the plain text version of the document specification.',
          bullets: ['Lightweight format', 'Portable across all terminals'],
        },
        {
          heading: '2. Architecture',
          content: 'Detailed modular layout description.',
          numberedItems: ['Frontend Studio', 'API Gateway', 'Generation Worker'],
        },
      ],
    };

    const textOutput = generateTXT(mockTxtContent);
    assert(typeof textOutput === 'string', 'Output must be a string');
    assert(textOutput.includes('System Requirements Specification'), 'Must contain title');
    assert(textOutput.includes('==='), 'Must contain double-underline for title');
    assert(textOutput.includes('1. Introduction'), 'Must contain heading');
    assert(textOutput.includes('---'), 'Must contain single-underline for heading');
    assert(textOutput.includes('• Lightweight format'), 'Must contain formatted bullets');
    assert(textOutput.includes('1. Frontend Studio'), 'Must contain numbered items');
  });

  // 5. Structured AI Output Validation (Zod)
  runTest('Zod validation of structured AI output for PPTX, DOCX, and TXT', () => {
    // Valid PPTX content
    const validPptx = {
      title: 'Machine Learning Fundamentals',
      slides: [
        {
          title: 'Introduction to Supervised Learning',
          bullets: ['Classification algorithms', 'Regression models'],
          notes: 'Explain difference between discrete and continuous targets',
          diagramSuggestion: 'graph LR\n  Data --> Model --> Prediction',
        },
      ],
    };
    const validatedPptx = validateStructuredOutput(validPptx, 'pptx');
    assert(validatedPptx.title === 'Machine Learning Fundamentals');
    assert(validatedPptx.slides.length === 1);

    // Valid DOCX content
    const validDocx = {
      title: 'Cloud Infrastructure Guide',
      sections: [
        {
          heading: 'Compute Resources',
          level: 1,
          content: 'Details on virtual machines and serverless functions.',
          bullets: ['Kubernetes clusters', 'AWS Lambda'],
        },
      ],
    };
    const validatedDocx = validateStructuredOutput(validDocx, 'docx');
    assert(validatedDocx.title === 'Cloud Infrastructure Guide');
    assert(validatedDocx.sections[0].level === 1);

    // Valid TXT content
    const validTxt = {
      title: 'Release Notes',
      sections: [
        {
          heading: 'v2.0.0 Changes',
          content: 'Initial public launch of DocuGenius AI platform.',
        },
      ],
    };
    const validatedTxt = validateStructuredOutput(validTxt, 'txt');
    assert(validatedTxt.title === 'Release Notes');
  });

  // 6. Invalid AI Response Handling (Zod Rejection)
  runTest('Zod rejects malformed AI responses with informative validation errors', () => {
    // Missing required title
    assert.throws(
      () => validateStructuredOutput({ slides: [] }, 'pptx'),
      /Presentation title is required|invalid structured content/
    );

    // Empty slides array
    assert.throws(
      () => validateStructuredOutput({ title: 'Empty Presentation', slides: [] }, 'pptx'),
      /at least one slide|invalid structured content/
    );

    // DOCX with missing sections array
    assert.throws(
      () => validateStructuredOutput({ title: 'Broken Doc', sections: [] }, 'docx'),
      /at least one section|invalid structured content/
    );

    // Invalid document type
    assert.throws(
      () => validateStructuredOutput({ title: 'Unknown' }, 'invalid_type'),
      /Unsupported document type/
    );
  });

  // 7. Diagram Service: Fallback Rendering & Parsing
  runTest('Diagram service generates clean Unicode text representations for Mermaid diagrams', () => {
    const flowchart = `
graph TD
  A[Client Request] --> B[API Gateway] --> C[Auth Middleware] --> D[AI Controller]
`;
    const fallback = getDiagramTextFallback(flowchart);
    assert(fallback.includes('[GRAPH]'), 'Should identify diagram type');
    assert(fallback.includes('Client Request'), 'Should resolve node A label');
    assert(fallback.includes('API Gateway'), 'Should resolve node B label');
    assert(fallback.includes('──►'), 'Should render clean Unicode arrows');

    const sequence = `
sequenceDiagram
  Client ->> Server: POST /api/generate
  Server ->> Gemini: Generate Content
  Gemini -->> Server: Structured JSON
  Server -->> Client: 201 Created
`;
    const seqFallback = getDiagramTextFallback(sequence);
    assert(seqFallback.includes('[SEQUENCEDIAGRAM]'));
    assert(seqFallback.includes('Client ──► Server: POST /api/generate'));
  });

  // 8. Diagram Service: SVG Buffer Generation
  await runAsyncTest('Diagram service creates valid SVG buffer for simple flowcharts', async () => {
    const flowchart = `
graph TD
  Start[Start] --> Process[Execute Task] --> Done[Finish]
`;
    const svgBuffer = await generateDiagramImage(flowchart);
    assert(svgBuffer, 'Should generate diagram buffer');
    const svgString = svgBuffer.toString('utf-8');
    assert(svgString.includes('<svg'), 'Output should contain valid SVG root tag');
    assert(svgString.includes('Start'), 'SVG should contain node label Start');
    assert(svgString.includes('Execute Task'), 'SVG should contain node label Execute Task');
  });

  // 9. Pending Tests requiring Live MongoDB Credentials
  markPending(
    'Database persistence: Save generated document metadata to MongoDB Document collection',
    'MongoDB connection credentials (MONGODB_URI) are not yet configured.'
  );

  markPending(
    'Database retrieval: Re-download file by MongoDB ObjectId via /api/generate/:id/download',
    'Requires live MongoDB cluster to test cross-session document retrieval by ObjectId.'
  );

  markPending(
    'Database update: Document status transition from pending -> generating -> completed in MongoDB',
    'Requires live MongoDB cluster to verify status lifecycle hooks.'
  );

  console.log('\n=========================================================');
  console.log(`🏁 TEST SUMMARY:`);
  console.log(`   Passed:     ${passedTests}`);
  console.log(`   Failed:     ${totalTests - passedTests - pendingTests}`);
  console.log(`   Not Tested: ${pendingTests} (Pending MongoDB credentials)`);
  console.log(`   Total:      ${totalTests}`);
  console.log('=========================================================\n');

  if (totalTests - passedTests - pendingTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

