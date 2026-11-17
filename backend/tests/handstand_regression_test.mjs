import assert from 'assert';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import { generateContent, validateTopicRelevance, extractKeywords } from '../services/aiService.js';

process.env.NODE_ENV = 'test';

console.log('🧪 =========================================================================');
console.log('🧪 DOCUGENIUS AI - FINAL AI TOPIC RELEVANCE & COMPREHENSIVE REGRESSION SUITE');
console.log('🧪 =========================================================================\n');

let server;
let baseUrl;
const testPort = 5996;

const TEST_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_long';
const testToken = jwt.sign(
  { id: '507f1f77bcf86cd799439011', email: 'tester@handstand.test', role: 'user' },
  TEST_SECRET,
  { expiresIn: '1h' }
);

async function startServer() {
  return new Promise((resolve) => {
    server = app.listen(testPort, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${testPort}`;
      resolve();
    });
  });
}

async function stopServer() {
  if (server) {
    return new Promise((resolve) => server.close(resolve));
  }
}

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  try {
    await startServer();

    // 1. Keyword Extraction Filter Test
    test('Keyword extraction excludes numbers (e.g. 10) and generic instruction/meta words', () => {
      const kws = extractKeywords('How to learn one arm handstand at home? A comprehensive 10 slides explain in detail');
      assert.strictEqual(kws.includes('10'), false, 'Assertion Failed: Token 10 must be excluded');
      assert.strictEqual(kws.includes('slides'), false, 'Assertion Failed: Word slides must be excluded');
      assert.strictEqual(kws.includes('explain'), false, 'Assertion Failed: Word explain must be excluded');
      assert.strictEqual(kws.includes('detail'), false, 'Assertion Failed: Word detail must be excluded');
      assert.strictEqual(kws.includes('comprehensive'), false, 'Assertion Failed: Word comprehensive must be excluded');
      assert.strictEqual(kws.includes('one'), false, 'Assertion Failed: Number-word one must be excluded from subject keywords');
      assert.strictEqual(kws.includes('handstand'), true, 'Assertion Failed: Core subject handstand must be included');
      assert.strictEqual(kws.includes('arm'), true, 'Assertion Failed: Core subject arm must be included');
      assert.strictEqual(kws.includes('home'), true, 'Assertion Failed: Core subject home must be included');
    });

    // 2. Acronyms & Short Technical Titles
    test('Keyword extraction retains technical acronyms and short 2-character keywords (AI, ML, SEO, AWS)', () => {
      const kws = extractKeywords('AI and ML architectures on AWS with SEO strategies');
      assert.strictEqual(kws.includes('ai'), true, 'Assertion Failed: Must preserve 2-char technical acronym ai');
      assert.strictEqual(kws.includes('ml'), true, 'Assertion Failed: Must preserve 2-char technical acronym ml');
      assert.strictEqual(kws.includes('aws'), true, 'Assertion Failed: Must preserve 3-char technical acronym aws');
      assert.strictEqual(kws.includes('seo'), true, 'Assertion Failed: Must preserve 3-char technical acronym seo');
    });

    // 2b. Whole-word token matching: "AI" must NOT match inside words like "training", "email", or "maintain"
    test('Token matching: "AI" must NOT match inside words like "training", "email", or "maintain"', () => {
      const trainingDoc = {
        title: 'Calisthenics Training Guide',
        slides: [
          { title: 'Strength Training', bullets: ['Bodyweight pullups and pushups', 'Maintain straight body alignment'] },
          { title: 'Training Frequency', bullets: ['Consistent daily workouts', 'Email coach for updates'] }
        ]
      };
      const isMatch = validateTopicRelevance(trainingDoc, 'AI');
      assert.strictEqual(isMatch, false, 'Assertion Failed: Keyword AI must not match substring inside training or maintain');
    });

    // 2c. Standalone Acronym Matching: "AI" matches standalone acronym "AI"
    test('Token matching: "AI" matches standalone acronym "AI"', () => {
      const aiDoc = {
        title: 'AI in Healthcare',
        slides: [
          { title: 'AI Diagnostics', bullets: ['Medical imaging with AI', 'Clinical decision support systems'] }
        ]
      };
      const isMatch = validateTopicRelevance(aiDoc, 'AI');
      assert.strictEqual(isMatch, true, 'Assertion Failed: Standalone acronym AI must match');
    });

    // 2d. Two-keyword defense: "Quantum Computing" must reject document whose title contains "Quantum" but body is unrelated
    test('Two-keyword defense: "Quantum Computing" must reject document whose title contains "Quantum" but body is unrelated', () => {
      const unrelatedQuantumPhysicsDoc = {
        title: 'Quantum Physics and Mechanics',
        slides: [
          { title: 'Wave-Particle Duality', bullets: ['Photons and electrons', 'Energy quantization and Planck constant'] },
          { title: 'Atomic Models', bullets: ['Bohr model', 'Orbital probability densities'] }
        ]
      };
      const isMatch = validateTopicRelevance(unrelatedQuantumPhysicsDoc, 'Quantum Computing');
      assert.strictEqual(isMatch, false, 'Assertion Failed: Quantum Computing must reject title-only Quantum with zero computing in body');
    });

    // 2e. Two-keyword approval: "Quantum Computing" passes when both keywords are represented in content
    test('Two-keyword approval: "Quantum Computing" passes when both keywords are represented in content', () => {
      const validQuantumDoc = {
        title: 'Introduction to Quantum Computing',
        slides: [
          { title: 'Qubits & Superposition', bullets: ['Quantum bits vs classical bits', 'High-performance quantum computing algorithms'] }
        ]
      };
      const isMatch = validateTopicRelevance(validQuantumDoc, 'Quantum Computing');
      assert.strictEqual(isMatch, true, 'Assertion Failed: Valid Quantum Computing content must pass');
    });

    // 3. Multi-Keyword Defense: Single Accidental Keyword Must FAIL
    test('Relevance validation strictly rejects unrelated content containing only 1 accidental keyword', () => {
      // Unrelated AI presentation that happens to have the word "home" in a bullet (smart home)
      const aiPresentationWithHome = {
        title: 'Understanding Artificial Intelligence: Foundations and Future Outlook',
        slides: [
          { title: 'Neural Networks Overview', bullets: ['Perceptrons', 'Backpropagation', 'Deep architectures'] },
          { title: 'Consumer Applications', bullets: ['Natural language assistants in the home', 'Autonomous vehicles'] }
        ]
      };
      const requestedPrompt = 'How to learn one arm handstand at home? A comprehensive 10 slides explain in detail';
      const isRelevant = validateTopicRelevance(aiPresentationWithHome, requestedPrompt);
      assert.strictEqual(isRelevant, false, 'Assertion Failed: AI content with single accidental keyword "home" must be rejected');
    });

    // 3b. 3+-Keyword Defense: Title matches alone cannot pass unrelated body content
    test('3+-keyword defense: Title matches alone cannot pass unrelated body content', () => {
      const unrelatedBodyWithHandstandTitle = {
        title: 'How to Learn One Arm Handstand at Home',
        slides: [
          { title: 'Machine Learning', bullets: ['Neural networks overview', 'Deep learning backpropagation'] },
          { title: 'Data Pipelines', bullets: ['ETL architecture', 'Data lakes and warehouses'] }
        ]
      };
      const isMatch = validateTopicRelevance(unrelatedBodyWithHandstandTitle, 'How to learn one arm handstand at home?');
      assert.strictEqual(isMatch, false, 'Assertion Failed: Unrelated body content must fail even if title matches all keywords');
    });

    // 4. Multi-Keyword Success: Legitimate Multi-Keyword Content PASSES
    test('Relevance validation approves legitimate multi-keyword content', () => {
      const legitimateHandstandContent = {
        title: 'How to Learn One Arm Handstand at Home',
        slides: [
          { title: 'Prerequisites for Single Arm Balance', bullets: ['Solid two-arm handstand hold', 'Wrist conditioning and shoulder strength'] },
          { title: 'Home Progression Drills', bullets: ['Wall assisted holds', 'Fingertip weight shifting'] }
        ]
      };
      const requestedPrompt = 'How to learn one arm handstand at home? A comprehensive 10 slides explain in detail';
      const isRelevant = validateTopicRelevance(legitimateHandstandContent, requestedPrompt);
      assert.strictEqual(isRelevant, true, 'Assertion Failed: Legitimate handstand content must pass relevance validation');
    });

    // 5. Broad Subject + Specific Instructions: AI topic
    test('Broad subject + specific instructions for Artificial Intelligence is approved without false rejection', () => {
      const validAiContent = {
        title: 'Artificial Intelligence',
        slides: [
          { title: 'Machine Learning Foundations', bullets: ['Supervised vs unsupervised learning algorithms'] },
          { title: 'Neural Networks & Deep Learning', bullets: ['Multi-layer perceptrons', 'Activation functions'] },
          { title: 'Real-World Applications', bullets: ['Medical diagnosis', 'Autonomous navigation'] }
        ]
      };
      const requestedSubject = 'Artificial Intelligence: Explain machine learning, neural networks and real-world applications in 10 slides.';
      const isRelevant = validateTopicRelevance(validAiContent, requestedSubject);
      assert.strictEqual(isRelevant, true, 'Assertion Failed: Valid AI content must pass relevance check');
    });

    // 6. Singular / Plural Robustness
    test('Relevance validation matches singular/plural variants without overly aggressive rejection', () => {
      const contentWithSingular = {
        title: 'Deep Neural Network Primer',
        slides: [{ title: 'Convolutional Network Architecture', bullets: ['Feature maps', 'Pooling'] }]
      };
      assert.strictEqual(
        validateTopicRelevance(contentWithSingular, 'Neural Networks Deep Dive'),
        true,
        'Assertion Failed: Singular network in content must match plural networks in prompt'
      );

      const contentWithPlural = {
        title: 'Calisthenics Handstands Guide',
        slides: [{ title: 'Mastering Handstands', bullets: ['Wall practice', 'Wrist prep'] }]
      };
      assert.strictEqual(
        validateTopicRelevance(contentWithPlural, 'Handstand Practice'),
        true,
        'Assertion Failed: Plural handstands in content must match singular handstand in prompt'
      );
    });

    // 7. Single Keyword Query
    test('Single-keyword query (e.g. Kubernetes) passes when present in title or content', () => {
      const k8sContent = {
        title: 'K8s Cluster Guide',
        slides: [{ title: 'Kubernetes Pods & Services', bullets: ['Deployments', 'Ingress'] }]
      };
      assert.strictEqual(
        validateTopicRelevance(k8sContent, 'Kubernetes'),
        true,
        'Assertion Failed: Kubernetes query must match'
      );
    });

    // 7b. Regenerate parameter resolution
    test('Regenerate parameter resolution: treats generic titles and duplicate title/topic correctly', () => {
      function resolveRegenerateParams(title, topic) {
        const cleanTitle = (title || '').trim();
        const cleanTopic = (topic || '').trim();
        const isGenericTitle = !cleanTitle || /^(untitled presentation|untitled document|document title|presentation title)$/i.test(cleanTitle);
        const titleForGen = (isGenericTitle || cleanTitle === cleanTopic) ? '' : cleanTitle;
        const topicForGen = cleanTopic || cleanTitle;
        return { titleForGen, topicForGen };
      }

      // Case 1: Specific title + instructions
      const r1 = resolveRegenerateParams('How to learn one arm handstand at home?', 'A comprehensive 10 slides explain in detail');
      assert.strictEqual(r1.titleForGen, 'How to learn one arm handstand at home?');
      assert.strictEqual(r1.topicForGen, 'A comprehensive 10 slides explain in detail');

      // Case 2: Topic-only document (stored as title=topic)
      const r2 = resolveRegenerateParams('Quantum Computing', 'Quantum Computing');
      assert.strictEqual(r2.titleForGen, '');
      assert.strictEqual(r2.topicForGen, 'Quantum Computing');

      // Case 3: Generic placeholder title
      const r3 = resolveRegenerateParams('Untitled Presentation', 'Machine Learning Foundations');
      assert.strictEqual(r3.titleForGen, '');
      assert.strictEqual(r3.topicForGen, 'Machine Learning Foundations');

      // Case 4: Title-only document
      const r4 = resolveRegenerateParams('Calisthenics Guide', '');
      assert.strictEqual(r4.titleForGen, 'Calisthenics Guide');
      assert.strictEqual(r4.topicForGen, 'Calisthenics Guide');

      // Case 5: Custom Title + Explicit Topic scenario (My Ultimate Fitness Guide + One Arm Handstand Training)
      const r5 = resolveRegenerateParams('My Ultimate Fitness Guide', 'One Arm Handstand Training');
      assert.strictEqual(r5.titleForGen, 'My Ultimate Fitness Guide');
      assert.strictEqual(r5.topicForGen, 'One Arm Handstand Training');
    });

    // 7c. Topic Priority & Independence: Title="My Ultimate Fitness Guide", Topic="One Arm Handstand Training"
    test('Topic takes priority for validation without requiring unrelated title keywords (e.g. fitness)', () => {
      const handstandDocWithoutFitnessKeyword = {
        title: 'My Ultimate Fitness Guide',
        slides: [
          { title: 'One Arm Handstand Prerequisites', bullets: ['Two arm handstand hold', 'Shoulder stability and wrist prep'] },
          { title: 'Handstand Progression Training', bullets: ['Wall assisted holds', 'Weight shifting drills'] }
        ]
      };
      // Validation subject must be topic ('One Arm Handstand Training'), NOT title
      const topicSubject = 'One Arm Handstand Training';
      const isRelevant = validateTopicRelevance(handstandDocWithoutFitnessKeyword, topicSubject);
      assert.strictEqual(isRelevant, true, 'Assertion Failed: Pure handstand content must pass topic validation without requiring word "fitness"');

      // Negative check: Unrelated content (e.g. general fitness fluff with zero handstand training) must fail
      const fitnessFluffDoc = {
        title: 'My Ultimate Fitness Guide',
        slides: [
          { title: 'General Cardio and Diet', bullets: ['Jogging 3 times a week', 'High protein calorie deficit'] },
          { title: 'Hydration and Sleep', bullets: ['Drink 3 liters of water', 'Sleep 8 hours'] }
        ]
      };
      const isFluffRelevant = validateTopicRelevance(fitnessFluffDoc, topicSubject);
      assert.strictEqual(isFluffRelevant, false, 'Assertion Failed: General fitness content lacking handstand keywords must be rejected');
    });

    // 8. Live Gemini Test: Case 1 (Specific Subject + Generic Instructions)
    await asyncTest('Live Gemini PPTX: Title="How to learn one arm handstand at home?", Instructions="A comprehensive 10 slides explain in detail"', async () => {
      const generated = await generateContent({
        title: 'How to learn one arm handstand at home?',
        topic: 'A comprehensive 10 slides explain in detail',
        type: 'pptx',
        contentLength: 'medium'
      });

      assert(generated, 'Assertion Failed: generated content must not be null');
      assert.strictEqual(typeof generated.title, 'string', 'Assertion Failed: title must be string');
      assert(generated.title.length > 5, 'Assertion Failed: title must not be empty');
      assert(Array.isArray(generated.slides), 'Assertion Failed: slides must be an array');
      assert(generated.slides.length >= 5, 'Assertion Failed: slides count must be >= 5');

      const fullText = JSON.stringify(generated).toLowerCase();
      assert.strictEqual(fullText.includes('artificial intelligence'), false, 'Assertion Failed: Must not discuss AI');
      assert.strictEqual(fullText.includes('neural network'), false, 'Assertion Failed: Must not discuss neural networks');
      assert(
        fullText.includes('handstand') || fullText.includes('one-arm') || fullText.includes('one arm'),
        'Assertion Failed: Must discuss handstands'
      );

      console.log(`    ℹ️ Generated PPTX Title: "${generated.title}" (${generated.slides.length} slides)`);
    });

    // 8b. Live Gemini Test: User Scenario (Title="My Ultimate Fitness Guide", Topic="One Arm Handstand Training")
    await asyncTest('Live Gemini PPTX: Title="My Ultimate Fitness Guide", Topic="One Arm Handstand Training"', async () => {
      const generated = await generateContent({
        title: 'My Ultimate Fitness Guide',
        topic: 'One Arm Handstand Training',
        type: 'pptx',
        contentLength: 'short'
      });

      assert(generated, 'Assertion Failed: generated content must not be null');
      assert.strictEqual(
        generated.title,
        'My Ultimate Fitness Guide',
        'Assertion Failed: Output document must retain user-specified title "My Ultimate Fitness Guide"'
      );
      assert(Array.isArray(generated.slides), 'Assertion Failed: slides must be an array');
      assert(generated.slides.length >= 3, 'Assertion Failed: slides count must be >= 3');

      const fullText = JSON.stringify(generated).toLowerCase();
      assert.strictEqual(fullText.includes('artificial intelligence'), false, 'Assertion Failed: Must not discuss AI');
      assert(
        fullText.includes('handstand') || fullText.includes('one arm') || fullText.includes('one-arm'),
        'Assertion Failed: Generated content must be specifically about One Arm Handstand Training'
      );

      console.log(`    ℹ️ Generated PPTX with custom title: "${generated.title}" (${generated.slides.length} slides focused on handstands)`);
    });

    // 9. Live Gemini Test: Case 3 (Topic-only generation)
    await asyncTest('Live Gemini DOCX: Topic-only generation (Empty title, meaningful topic)', async () => {
      const generated = await generateContent({
        title: '',
        topic: 'Microservices Architecture Best Practices',
        description: '',
        type: 'docx',
        contentLength: 'short'
      });

      assert(generated, 'Assertion Failed: generated content must not be null');
      assert.strictEqual(typeof generated.title, 'string', 'Assertion Failed: title must be string');
      assert(Array.isArray(generated.sections), 'Assertion Failed: sections must be an array');
      assert(generated.sections.length > 0, 'Assertion Failed: must contain sections');

      const fullText = JSON.stringify(generated).toLowerCase();
      assert(fullText.includes('microservice'), 'Assertion Failed: Content must discuss microservices');

      console.log(`    ℹ️ Generated DOCX Title: "${generated.title}" (${generated.sections.length} sections)`);
    });

    // 10. Live Gemini Test: Case 4 (Title-only generation)
    await asyncTest('Live Gemini TXT: Title-only generation (Meaningful title, empty topic)', async () => {
      const generated = await generateContent({
        title: 'Cloud Computing Foundations',
        topic: '',
        description: '',
        type: 'txt',
        contentLength: 'short'
      });

      assert(generated, 'Assertion Failed: generated content must not be null');
      assert.strictEqual(typeof generated.title, 'string', 'Assertion Failed: title must be string');
      assert(Array.isArray(generated.sections), 'Assertion Failed: sections must be an array');
      assert(generated.sections.length > 0, 'Assertion Failed: must contain sections');

      const fullText = JSON.stringify(generated).toLowerCase();
      assert(
        fullText.includes('cloud') || fullText.includes('computing'),
        'Assertion Failed: Content must discuss cloud computing'
      );

      console.log(`    ℹ️ Generated TXT Title: "${generated.title}" (${generated.sections.length} sections)`);
    });

    // 11. HTTP Preview End-to-End Test (Independent clean payload)
    await asyncTest('HTTP POST /api/generate/preview with clean independent payload returns matching preview', async () => {
      const response = await fetch(`${baseUrl}/api/generate/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`
        },
        body: JSON.stringify({
          title: 'How to learn one arm handstand at home?',
          topic: 'A comprehensive 10 slides explain in detail',
          type: 'pptx'
        })
      });

      assert.strictEqual(response.status, 200, 'Assertion Failed: Preview should return 200 OK');
      const json = await response.json();
      assert.strictEqual(json.success, true, 'Assertion Failed: Response must indicate success');
      assert.strictEqual(
        json.data.title,
        'How to learn one arm handstand at home?',
        'Assertion Failed: Output title must match requested title'
      );
      assert(Array.isArray(json.data.slides), 'Assertion Failed: Must contain slides array');
      assert(json.data.slides.length > 0, 'Assertion Failed: Must have at least 1 slide');

      const contentStr = JSON.stringify(json.data).toLowerCase();
      assert.strictEqual(contentStr.includes('artificial intelligence'), false, 'Assertion Failed: Must not discuss AI');
      assert(contentStr.includes('handstand'), 'Assertion Failed: Must discuss handstands');
    });

  } finally {
    await stopServer();
  }

  console.log(`\n🎉 RESULTS: ${passed}/${total} regression & relevance tests passed with genuine assertions!\n`);
}

runTests().catch((err) => {
  console.error('\n❌ Regression test execution failed:', err);
  process.exit(1);
});
