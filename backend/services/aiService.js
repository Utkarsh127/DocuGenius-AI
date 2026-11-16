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
function buildPrompt({ topic, description, type, language, tone, audience, contentLength }) {
  const lengthHint =
    contentLength === 'short' ? '5-8 slides / 3-4 sections'
    : contentLength === 'long' ? '15-20 slides / 8-12 sections'
    : '10-12 slides / 5-7 sections'; // medium default

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
`;

  const topicLine = `Topic: ${topic}${description ? `\nAdditional context: ${description}` : ''}`;

  if (type === 'pptx') {
    return `${common}
${topicLine}

Respond with ONLY valid JSON (no markdown fences) in this exact structure:
{
  "title": "Presentation Title",
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
${topicLine}

Respond with ONLY valid JSON (no markdown fences) in this exact structure:
{
  "title": "Document Title",
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
${topicLine}

Respond with ONLY valid JSON (no markdown fences) in this exact structure:
{
  "title": "Document Title",
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
 * @param {string} options.topic - The main topic
 * @param {string} [options.description] - Additional context
 * @param {string} options.type - 'pptx' | 'docx' | 'txt'
 * @param {string} [options.language] - Output language
 * @param {string} [options.tone] - Tone of content
 * @param {string} [options.audience] - Target audience
 * @param {string} [options.contentLength] - 'short' | 'medium' | 'long'
 * @returns {Promise<Object>} Structured content JSON
 */
export async function generateContent({ topic, description, type, language, tone, audience, contentLength }) {
  if (!topic) throw new Error('Topic is required for content generation.');
  if (!['pptx', 'docx', 'txt'].includes(type)) throw new Error('Invalid document type. Must be pptx, docx, or txt.');

  const prompt = buildPrompt({ topic, description, type, language, tone, audience, contentLength });
  const raw = await callGemini(prompt);
  const parsed = parseResponse(raw);

  // Validate and sanitize using Zod
  const validated = validateStructuredOutput(parsed, type);
  return validated;
}
