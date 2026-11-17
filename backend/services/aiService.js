import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

/* ── Zod Schemas for AI-Generated Structured Output ── */
export const aiPptxSlideSchema = z.object({
  title: z.string().default('Slide'),
  bullets: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
  diagramSuggestion: z.string().optional().nullable(),
});

export const aiPptxSchema = z.object({
  title: z.string().min(1, 'Presentation title is required'),
  slides: z.array(aiPptxSlideSchema).min(1, 'Presentation must contain at least one slide'),
});

export const aiDocxSectionSchema = z.object({
  heading: z.string().default('Section'),
  level: z.number().int().min(1).max(3).default(1),
  content: z.string().optional().default(''),
  bullets: z.array(z.string()).optional().default([]),
  numberedItems: z.array(z.string()).optional().default([]),
  tableData: z
    .object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.any())),
    })
    .optional()
    .nullable(),
  diagramSuggestion: z.string().optional().nullable(),
});

export const aiDocxSchema = z.object({
  title: z.string().min(1, 'Document title is required'),
  sections: z.array(aiDocxSectionSchema).min(1, 'Document must contain at least one section'),
});

export const aiTxtSectionSchema = z.object({
  heading: z.string().default('Section'),
  content: z.string().optional().default(''),
  bullets: z.array(z.string()).optional().default([]),
  numberedItems: z.array(z.string()).optional().default([]),
});

export const aiTxtSchema = z.object({
  title: z.string().min(1, 'Document title is required'),
  sections: z.array(aiTxtSectionSchema).min(1, 'Document must contain at least one section'),
});

/**
 * Validate and sanitize structured AI output using the corresponding Zod schema.
 */
export function validateStructuredOutput(data, type) {
  let schema;
  if (type === 'pptx') schema = aiPptxSchema;
  else if (type === 'docx') schema = aiDocxSchema;
  else if (type === 'txt') schema = aiTxtSchema;
  else throw new Error(`Unsupported document type: ${type}`);

  const result = schema.safeParse(data);
  if (!result.success) {
    const errorDetails = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`AI generated invalid structured content: ${errorDetails}`);
  }
  return result.data;
}

/**
 * Stop words for topic keyword relevance validation.
 * Filters out common grammatical stop words, formatting instructions, numbers, and meta prompt vocabulary.
 */
const STOP_WORDS = new Set([
  'how', 'to', 'learn', 'a', 'an', 'the', 'in', 'on', 'at', 'by', 'for', 'with', 'about',
  'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'from', 'up', 'down', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
  'of', 'slides', 'slide', 'page', 'pages', 'section', 'sections', 'explain', 'explaining',
  'detail', 'details', 'detailed', 'presentation', 'document', 'report', 'notes',
  'comprehensive', 'overview', 'introduction', 'create', 'make', 'generate', 'brief', 'summary',
  'want', 'need', 'please', 'give', 'me', 'what', 'why', 'who', 'which', 'when', 'where',
  'step', 'steps', 'guide', 'tips', 'ways', 'simple', 'easy', 'quick', 'beginner', 'beginners',
  'advanced', 'depth', 'write', 'talk', 'discuss', 'discussing', 'describe', 'describing',
  'one', 'two', 'three', 'first', 'second', 'good', 'great', 'new', 'old', 'high', 'low', 'top', 'basic', 'basics'
]);

/**
 * Generate singular/plural variants of a keyword to avoid overly aggressive rejection.
 */
export function getWordVariants(word) {
  const variants = new Set([word]);
  // Singular to plural
  if (!word.endsWith('s')) {
    variants.add(word + 's');
  }
  // Plural to singular
  if (word.endsWith('ies') && word.length > 4) variants.add(word.slice(0, -3) + 'y');
  else if (word.endsWith('es') && word.length > 4) variants.add(word.slice(0, -2));
  else if (word.endsWith('s') && word.length > 3) variants.add(word.slice(0, -1));

  if (word.endsWith('ing') && word.length > 5) variants.add(word.slice(0, -3));
  return Array.from(variants);
}

/**
 * Extract distinct subject keywords from prompt text, ignoring meta stop words and numbers.
 */
export function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  return Array.from(new Set(words));
}

/**
 * Recursively extract all whole-word tokens (lowercase) from an object/array/string into a Set.
 * Ensures token-based whole-word matching to eliminate substring false positives (e.g. 'ai' in 'training').
 */
export function extractContentTokens(val) {
  const tokens = new Set();
  function recurse(node) {
    if (!node) return;
    if (typeof node === 'string') {
      const words = node.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/);
      for (const w of words) {
        if (w) tokens.add(w);
      }
    } else if (Array.isArray(node)) {
      for (const item of node) recurse(item);
    } else if (typeof node === 'object') {
      for (const item of Object.values(node)) recurse(item);
    }
  }
  recurse(val);
  return tokens;
}

/**
 * Validate that generated structured content is genuinely relevant to the requested topic.
 * Uses token-based whole-word matching to prevent substring false positives (e.g. 'ai' in 'training').
 * Enforces meaningful body evidence so title matches alone cannot pass unrelated content.
 */
export function validateTopicRelevance(content, requestedSubject) {
  if (!content || typeof content !== 'object') return false;

  const keywords = extractKeywords(requestedSubject);
  if (keywords.length === 0) return true;

  const titleTokens = extractContentTokens(content.title || '');
  const { title: _ignored, ...bodyContent } = content;
  const bodyTokens = extractContentTokens(bodyContent);
  const allTokens = new Set([...titleTokens, ...bodyTokens]);

  const matchesTokens = (kw, tokenSet) => {
    const variants = getWordVariants(kw);
    return variants.some((v) => tokenSet.has(v));
  };

  const titleMatches = keywords.filter((kw) => matchesTokens(kw, titleTokens));
  const bodyMatches = keywords.filter((kw) => matchesTokens(kw, bodyTokens));
  const allMatches = keywords.filter((kw) => matchesTokens(kw, allTokens));

  // 1. Single-keyword request (e.g., "AI", "Kubernetes", "Handstands", "SEO"):
  // Must appear with meaningful evidence in the body content.
  if (keywords.length === 1) {
    return bodyMatches.length >= 1;
  }

  // 2. Two-keyword request (e.g., "Quantum Computing", "Deep Learning"):
  // - A single keyword appearing only in the title cannot pass unrelated body content.
  // - Requires body evidence: either both keywords in body, OR both keywords across title+body with at least 1 in body.
  if (keywords.length === 2) {
    if (bodyMatches.length === 0) return false;
    return bodyMatches.length >= 2 || (titleMatches.length >= 1 && allMatches.length >= 2);
  }

  // 3. Multi-keyword request (3+ keywords, e.g., "How to learn one arm handstand at home"):
  // - Body MUST have at least 1 keyword match; zero body matches is strictly rejected regardless of title.
  if (bodyMatches.length === 0) {
    return false;
  }

  // If body has 2+ distinct keyword matches:
  if (bodyMatches.length >= 2) {
    const bodyRatio = bodyMatches.length / keywords.length;
    return bodyRatio >= 0.35 || bodyMatches.length >= 3;
  }

  // If body has only 1 keyword match:
  // Title matches alone cannot pass unrelated body content.
  // Requires strong title representation (2+ keywords) and high overall document coverage (>= 60% and 3+ keywords).
  const allRatio = allMatches.length / keywords.length;
  return titleMatches.length >= 2 && allMatches.length >= 3 && allRatio >= 0.6;
}

const TIMEOUT_MS = 30000;
const MAX_RETRIES = 1;

let genAI = null;

function getClient() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not configured. Please set it in your .env file.');
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

/**
 * Build a system prompt based on document type and user options.
 */
function buildPrompt({ title, topic, description, type, language, tone, audience, contentLength }) {
  const lengthHint =
    contentLength === 'short' ? '5-8 slides / 3-4 sections'
    : contentLength === 'long' ? '15-20 slides / 8-12 sections'
    : '10-12 slides / 5-7 sections'; // medium default

  let cleanTitle = (title || '').trim();
  const cleanTopic = (topic || '').trim();
  const cleanDesc = (description || '').trim();

  // If title is just a generic placeholder, do not treat it as an explicit subject keyword
  if (/^(untitled presentation|untitled document|document title|presentation title)$/i.test(cleanTitle)) {
    cleanTitle = '';
  }

  let subjectBlock = '';
  if (cleanTitle && cleanTopic && cleanTitle !== cleanTopic) {
    subjectBlock = `Document / Presentation Title: "${cleanTitle}"\nTopic & Specific Instructions: ${cleanTopic}`;
  } else if (cleanTitle) {
    subjectBlock = `Document / Presentation Title & Topic: "${cleanTitle}"`;
  } else if (cleanTopic) {
    subjectBlock = `Document / Presentation Topic: "${cleanTopic}"`;
  } else {
    subjectBlock = `Document / Presentation Topic: "General Overview"`;
  }

  if (cleanDesc) {
    subjectBlock += `\nReference Content / Context: ${cleanDesc}`;
  }

  // Topic takes priority as the actual subject matter; title is used when topic is empty
  const primarySubject = cleanTopic || cleanTitle || 'General Overview';
  // User's explicit title takes priority for the document title property; falls back to topic
  const targetTitle = cleanTitle || cleanTopic || (type === 'pptx' ? 'Presentation Title' : 'Document Title');

  const strictRelevanceRule = `
CRITICAL TOPIC RELEVANCE INSTRUCTIONS:
- You MUST generate content specifically and exclusively about: ${primarySubject}.
- Under NO circumstances should you switch, hallucinate, or default to an unrelated subject (such as Artificial Intelligence, machine learning, or placeholder technology) unless that was the explicit subject requested above.
- The "title" property in the returned JSON MUST accurately match or reflect: "${targetTitle}".
`;

  const common = `
You are a professional content creator. Generate well-structured, factual content.
Rules:
- Organize content logically with clear headings and subheadings.
- Use concise bullet points where appropriate.
- Write professional summaries and transitions.
- Do NOT invent fake facts, statistics, or citations.
- Suggest a diagram (using Mermaid syntax) ONLY when it genuinely aids understanding (e.g., flowcharts for processes, hierarchy for org charts). Set diagramSuggestion to null when not needed.
- Language: ${language || 'English'}
- Tone: ${tone || 'professional'}
- Target audience: ${audience || 'general'}
- Aim for roughly ${lengthHint}.
${subjectBlock}
${strictRelevanceRule}
`;

  if (type === 'pptx') {
    return `${common}
Respond with ONLY valid JSON (no markdown fences) in this exact structure:
{
  "title": "${targetTitle.replace(/"/g, '\\"')}",
  "slides": [
    {
      "title": "Slide Title",
      "bullets": ["Bullet 1", "Bullet 2"],
      "notes": "Speaker notes for this slide",
      "diagramSuggestion": null
    }
  ]
}

For diagram suggestions use Mermaid syntax string, e.g.:
"diagramSuggestion": "graph TD\\n  A[Start] --> B[Process] --> C[End]"

Make the first slide an introduction/overview and the last slide a conclusion/summary.`;
  }

  if (type === 'docx') {
    return `${common}
Respond with ONLY valid JSON (no markdown fences) in this exact structure:
{
  "title": "${targetTitle.replace(/"/g, '\\"')}",
  "sections": [
    {
      "heading": "Section Heading",
      "level": 1,
      "content": "Paragraph text for this section.",
      "bullets": ["Point 1", "Point 2"],
      "tableData": null,
      "diagramSuggestion": null
    }
  ]
}

For tableData use: { "headers": ["Col1","Col2"], "rows": [["val1","val2"]] }
For diagram suggestions use Mermaid syntax string.
Use level 1 for major sections, 2 for sub-sections, 3 for sub-sub-sections.`;
  }

  // txt
  return `${common}
Respond with ONLY valid JSON (no markdown fences) in this exact structure:
{
  "title": "${targetTitle.replace(/"/g, '\\"')}",
  "sections": [
    {
      "heading": "Section Heading",
      "content": "Paragraph text for this section."
    }
  ]
}`;
}

/**
 * Call Gemini with timeout and retry.
 */
async function callGemini(prompt, retryCount = 0) {
  const client = getClient();
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const model = client.getGenerativeModel({ model: modelName });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const result = await model.generateContent(prompt, { signal: controller.signal });
    clearTimeout(timer);

    const text = result.response.text();
    return text;
  } catch (err) {
    clearTimeout(timer);

    // Retry once on transient errors
    const isTransient =
      err.name === 'AbortError' ||
      err.message?.includes('503') ||
      err.message?.includes('429') ||
      err.message?.includes('RESOURCE_EXHAUSTED') ||
      err.message?.includes('UNAVAILABLE');

    if (isTransient && retryCount < MAX_RETRIES) {
      // wait 2s before retry
      await new Promise(r => setTimeout(r, 2000));
      return callGemini(prompt, retryCount + 1);
    }

    if (err.name === 'AbortError') {
      throw new Error('AI content generation timed out. Please try again.');
    }
    if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('401')) {
      throw new Error('Invalid Gemini API key. Please check your configuration.');
    }
    throw new Error(`AI generation failed: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Parse JSON from Gemini response, stripping markdown fences if present.
 */
function parseResponse(text) {
  let cleaned = text.trim();
  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid content structure. Please try again.');
  }
}

/**
 * Generate structured content using Gemini.
 *
 * @param {Object} options
 * @param {string} [options.title] - Document / Presentation title
 * @param {string} [options.topic] - The main topic or instructions
 * @param {string} [options.description] - Additional context or reference material
 * @param {string} options.type - 'pptx' | 'docx' | 'txt'
 * @param {string} [options.language] - Output language
 * @param {string} [options.tone] - Tone of content
 * @param {string} [options.audience] - Target audience
 * @param {string} [options.contentLength] - 'short' | 'medium' | 'long'
 * @returns {Promise<Object>} Structured content JSON
 */
export async function generateContent({ title, topic, description, type, language, tone, audience, contentLength }) {
  let cleanTitle = (title || '').trim();
  const cleanTopic = (topic || '').trim();
  const cleanDesc = (description || '').trim();

  // If title is just a generic placeholder, do not treat it as an explicit subject keyword
  if (/^(untitled presentation|untitled document|document title|presentation title)$/i.test(cleanTitle)) {
    cleanTitle = '';
  }

  // Topic takes priority as the actual subject matter; title is used when topic is empty
  const primarySubject = cleanTopic || cleanTitle || cleanDesc;
  if (!primarySubject) throw new Error('Topic or title is required for content generation.');
  if (!['pptx', 'docx', 'txt'].includes(type)) throw new Error('Invalid document type. Must be pptx, docx, or txt.');

  const prompt = buildPrompt({ title: cleanTitle, topic: cleanTopic, description: cleanDesc, type, language, tone, audience, contentLength });
  const raw = await callGemini(prompt);
  const parsed = parseResponse(raw);

  // Validate and sanitize using Zod
  const validated = validateStructuredOutput(parsed, type);

  // Retain user's requested title if provided; otherwise ensure non-generic title
  if (cleanTitle) {
    validated.title = cleanTitle;
  } else if (!validated.title || /^(untitled presentation|untitled document|presentation title|document title)$/i.test(validated.title.trim())) {
    validated.title = cleanTopic || (type === 'pptx' ? 'Untitled Presentation' : 'Untitled Document');
  }

  // Validate topic relevance to ensure user's requested subject is present in output.
  // Topic takes priority as the actual subject matter; title is used when topic is empty.
  const subjectForValidation = cleanTopic || cleanTitle;
  if (!validateTopicRelevance(validated, subjectForValidation)) {
    throw new Error('AI generated content was not relevant to the requested topic. Please refine your instructions and try again.');
  }

  return validated;
}
