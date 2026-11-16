import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Document from '../models/Document.js';
import { success, error } from '../utils/responseHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '..', 'temp');

const MIME_TYPES = {
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

/**
 * GET / — List user's documents with optional filtering, search, and pagination.
 */
export const listDocuments = async (req, res) => {
  try {
    const { type, search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    const filter = { userId: req.user.id };

    if (type && ['pptx', 'docx', 'txt'].includes(type)) {
      filter.type = type;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { topic: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const [documents, total] = await Promise.all([
      Document.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select('-content'), // exclude large content field from listing
      Document.countDocuments(filter),
    ]);

    return success(res, {
      documents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[historyController] listDocuments error:', err.message);
    return error(res, 'Failed to fetch documents.');
  }
};

/**
 * GET /stats — Document statistics for the authenticated user.
 */
export const getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const [total, typeBreakdown] = await Promise.all([
      Document.countDocuments({ userId }),
      Document.aggregate([
        { $match: { userId: (await import('mongoose')).default.Types.ObjectId.createFromHexString(userId) } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    const byType = {};
    for (const item of typeBreakdown) {
      byType[item._id] = item.count;
    }

    return success(res, { total, byType });
  } catch (err) {
    console.error('[historyController] getStats error:', err.message);
    return error(res, 'Failed to fetch document stats.');
  }
};

/**
 * GET /:id — Get a single document (verify ownership).
 */
export const getDocument = async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!doc) {
      return error(res, 'Document not found.', 404);
    }

    return success(res, doc);
  } catch (err) {
    console.error('[historyController] getDocument error:', err.message);
    return error(res, 'Failed to fetch document.');
  }
};

/**
 * DELETE /:id — Delete a document (verify ownership, remove file too).
 */
export const deleteDocument = async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!doc) {
      return error(res, 'Document not found.', 404);
    }

    // Delete associated file if it exists
    if (doc.fileName) {
      const filePath = path.join(TEMP_DIR, doc.fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await Document.deleteOne({ _id: doc._id });

    return success(res, { message: 'Document deleted successfully.' });
  } catch (err) {
    console.error('[historyController] deleteDocument error:', err.message);
    return error(res, 'Failed to delete document.');
  }
};

/**
 * GET /:id/download — Re-download the generated file.
 */
export const downloadDocument = async (req, res) => {
  try {
    const doc = await Document.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!doc) {
      return error(res, 'Document not found.', 404);
    }

    if (!doc.fileName) {
      return error(res, 'No file associated with this document.', 404);
    }

    const filePath = path.join(TEMP_DIR, doc.fileName);

    if (!fs.existsSync(filePath)) {
      return error(res, 'File no longer exists on the server.', 404);
    }

    const mimeType = MIME_TYPES[doc.type] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${doc.fileName}"`
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('[historyController] downloadDocument error:', err.message);
    return error(res, 'Failed to download document.');
  }
};
