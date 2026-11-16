import express from "express";
import { analyzeLogs } from "../analyzer/index.js";

const router = express.Router();

router.get("/", (req, res) => {
  try {
    const result = analyzeLogs();
    res.json({ success: true, results: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
