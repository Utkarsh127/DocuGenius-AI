import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { protect } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimiter.js';
import { generateContent } from '../services/aiService.js';
import { generatePPTX } from '../services/pptService.js';
import { generateDOCX } from '../services/docxService.js';
import { generateTXT } from '../services/txtService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '..', 'temp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const router = express.Router();

// All routes require authentication
router.use(protect);

const MIME_TYPES = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain'
};

const EXTENSIONS = { pptx: '.pptx', docx: '.docx', txt: '.txt' };

/**
 * POST /generate — Full document generation
 */
router.post('/', apiLimiter, async (req, res) => {
  let document = null;
  try {
    const { title, topic, description, type, language, tone, audience, contentLength, slideCount, theme } = req.body;

    const resolvedTitle = (title || topic || '').trim();
    const resolvedTopic = (topic || title || '').trim();

    // Validate required fields
    if (!resolvedTitle && !resolvedTopic && !description) {
      return res.status(400).json({ success: false, message: 'Title, topic, or reference text is required.' });
    }
    if (!['pptx', 'docx', 'txt'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be pptx, docx, or txt.' });
    }

    // Check if MongoDB is connected
    let Document = null;
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        Document = (await import('../models/Document.js')).default;
      }
    } catch {
      // Model/DB not available — proceed without DB persistence
    }

    // Create document record if DB is connected
    if (Document) {
      document = await Document.create({
        userId: req.user.id,
        title: resolvedTitle,
        topic: resolvedTopic,
        description,
        type,
        settings: { language, tone, audience, contentLength, slideCount, theme },
        status: 'generating'
      });
    }

    // Generate AI content
    const structuredContent = await generateContent({
      title: (title || '').trim(),
      topic: (topic || '').trim(),
      description,
      type,
      language,
      tone,
      audience,
      contentLength
    });

    // Generate file based on type
    let fileBuffer;
    const settings = { theme, slideCount };

    if (type === 'pptx') {
      fileBuffer = await generatePPTX(structuredContent, settings);
    } else if (type === 'docx') {
      fileBuffer = await generateDOCX(structuredContent, settings);
    } else {
      const textContent = generateTXT(structuredContent);
      fileBuffer = Buffer.from(textContent, 'utf-8');
    }

    // Save file
    const fileId = uuidv4();
    const fileName = `${fileId}${EXTENSIONS[type]}`;
    const filePath = path.join(TEMP_DIR, fileName);
    fs.writeFileSync(filePath, fileBuffer);

    // Update document record
    if (Document && document) {
      document.fileName = fileName;
      document.fileSize = fileBuffer.length;
      document.content = structuredContent;
      document.status = 'completed';
      await document.save();
    }

    return res.status(201).json({
      success: true,
      data: {
        id: document?._id || fileId,
        title: document?.title || resolvedTitle || structuredContent.title,
        type,
        fileName,
        fileSize: fileBuffer.length,
        content: structuredContent,
        downloadUrl: `/generate/${document?._id || fileId}/download`,
        createdAt: document?.createdAt || new Date()
      }
    });
  } catch (err) {
    console.error('Generation error:', err.message);

    // Update document status to failed
    if (document) {
      try {
        document.status = 'failed';
        document.errorMessage = err.message;
        await document.save();
      } catch { /* ignore db error */ }
    }

    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to generate document. Please try again.'
    });
  }
});

/**
 * POST /preview — Generate structured content only (no file)
 */
router.post('/preview', async (req, res) => {
  try {
    const { title, topic, description, type, language, tone, audience, contentLength } = req.body;

    const resolvedTitle = (title || topic || '').trim();
    const resolvedTopic = (topic || title || '').trim();

    if (!resolvedTitle && !resolvedTopic && !description) {
      return res.status(400).json({ success: false, message: 'Valid title, topic, or reference text is required.' });
    }

    if (!type || !['pptx', 'docx', 'txt'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Valid type (pptx/docx/txt) is required.' });
    }

    const structuredContent = await generateContent({
      title: (title || '').trim(),
      topic: (topic || '').trim(),
      description,
      type,
      language,
      tone,
      audience,
      contentLength
    });

    return res.json({ success: true, data: structuredContent });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to generate preview.'
    });
  }
});

/**
 * POST /:id/regenerate — Regenerate from existing document settings
 */
router.post('/:id/regenerate', async (req, res) => {
  try {
    let Document;
    try {
      Document = (await import('../models/Document.js')).default;
    } catch {
      return res.status(503).json({ success: false, message: 'Document storage not available.' });
    }

    const original = await Document.findOne({ _id: req.params.id, userId: req.user.id });
    if (!original) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    // Re-generate using original settings
    const { title, topic, description, type } = original;
    const settings = original.settings || {};

    const cleanTitle = (title || '').trim();
    const cleanTopic = (topic || '').trim();
    const isGenericTitle = !cleanTitle || /^(untitled presentation|untitled document|document title|presentation title)$/i.test(cleanTitle);

    // Resolve clean title and topic for generation:
    // Prevent generic placeholder titles or duplicate title===topic from distorting prompt semantics
    const titleForGen = (isGenericTitle || cleanTitle === cleanTopic) ? '' : cleanTitle;
    const topicForGen = cleanTopic || cleanTitle;

    const structuredContent = await generateContent({
      title: titleForGen,
      topic: topicForGen,
      description,
      type,
      language: settings.language,
      tone: settings.tone,
      audience: settings.audience,
      contentLength: settings.contentLength
    });

    let fileBuffer;
    if (type === 'pptx') {
      fileBuffer = await generatePPTX(structuredContent, settings);
    } else if (type === 'docx') {
      fileBuffer = await generateDOCX(structuredContent, settings);
    } else {
      const textContent = generateTXT(structuredContent);
      fileBuffer = Buffer.from(textContent, 'utf-8');
    }

    const fileId = uuidv4();
    const fileName = `${fileId}${EXTENSIONS[type]}`;
    const filePath = path.join(TEMP_DIR, fileName);
    fs.writeFileSync(filePath, fileBuffer);

    // Delete old file if it exists
    if (original.fileName) {
      const oldPath = path.join(TEMP_DIR, original.fileName);
      try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
    }

    original.fileName = fileName;
    original.fileSize = fileBuffer.length;
    original.content = structuredContent;
    original.status = 'completed';
    original.errorMessage = undefined;
    await original.save();

    return res.json({
      success: true,
      data: {
        id: original._id,
        title: original.title,
        type: original.type,
        fileName,
        fileSize: fileBuffer.length,
        content: structuredContent,
        downloadUrl: `/generate/${original._id}/download`,
        updatedAt: original.updatedAt
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to regenerate document.'
    });
  }
});

/**
 * GET /:id/download — Download generated file
 */
router.get('/:id/download', async (req, res) => {
  try {
    let filePath = null;
    let mimeType = 'application/octet-stream';
    let downloadName = 'document';

    // 1. Try DB lookup if connected
    let doc = null;
    try {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const Document = (await import('../models/Document.js')).default;
        doc = await Document.findOne({ _id: req.params.id, userId: req.user.id });
      }
    } catch {
      /* DB offline */
    }

    if (doc) {
      mimeType = MIME_TYPES[doc.type] || 'application/octet-stream';
      downloadName = `${(doc.title || 'document').replace(/[^a-zA-Z0-9-_ ]/g, '')}${EXTENSIONS[doc.type] || ''}`;

      if (doc.fileName) {
        filePath = path.join(TEMP_DIR, doc.fileName);
      }

      // 1a. File exists on disk: stream directly
      if (filePath && fs.existsSync(filePath)) {
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        return res.sendFile(filePath);
      }

      // 1b. Fallback: File missing from temp (Render restart/ephemeral disk wipe/24h purge)
      // Recompile on-demand from stored structured AI content without re-calling Gemini
      if (doc.content) {
        const settings = doc.settings || {};
        let recompiledBuffer;

        if (doc.type === 'pptx') {
          recompiledBuffer = await generatePPTX(doc.content, settings);
        } else if (doc.type === 'docx') {
          recompiledBuffer = await generateDOCX(doc.content, settings);
        } else if (doc.type === 'txt') {
          const textContent = generateTXT(doc.content);
          recompiledBuffer = Buffer.from(textContent, 'utf-8');
        }

        if (recompiledBuffer) {
          // Re-cache to temp directory if possible
          const fileName = doc.fileName || `${uuidv4()}${EXTENSIONS[doc.type] || ''}`;
          const newPath = path.join(TEMP_DIR, fileName);
          try {
            fs.writeFileSync(newPath, recompiledBuffer);
            if (!doc.fileName || doc.fileName !== fileName) {
              doc.fileName = fileName;
              doc.fileSize = recompiledBuffer.length;
              await doc.save();
            }
          } catch {
            // Non-critical if caching fails; we still stream buffer
          }

          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
          return res.send(recompiledBuffer);
        }
      }
    } else {
      // 2. Fallback: check if :id matches an existing file in TEMP_DIR
      if (fs.existsSync(TEMP_DIR)) {
        const files = fs.readdirSync(TEMP_DIR);
        const match = files.find((f) => f.startsWith(req.params.id));
        if (match) {
          filePath = path.join(TEMP_DIR, match);
          const ext = path.extname(match).replace('.', '');
          mimeType = MIME_TYPES[ext] || 'application/octet-stream';
          downloadName = match;
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
          return res.sendFile(filePath);
        }
      }
    }

    return res.status(404).json({ success: false, message: 'File not found or has expired.' });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to download file.',
    });
  }
});

export default router;
