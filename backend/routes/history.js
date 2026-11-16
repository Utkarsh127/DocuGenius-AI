import { Router } from 'express';
import auth from '../middleware/auth.js';
import {
  listDocuments,
  getStats,
  getDocument,
  deleteDocument,
  downloadDocument,
} from '../controllers/historyController.js';

const router = Router();

// All routes are protected
router.use(auth);

// GET /api/history — list documents with pagination, filter, search
router.get('/', listDocuments);

// GET /api/history/stats — totals and type breakdown
router.get('/stats', getStats);

// GET /api/history/:id — single document
router.get('/:id', getDocument);

// DELETE /api/history/:id — delete document and file
router.delete('/:id', deleteDocument);

// GET /api/history/:id/download — re-download file
router.get('/:id/download', downloadDocument);

export default router;
