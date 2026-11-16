import express from "express";
import PptxGenJS from "pptxgenjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, "..", "temp");

const router = express.Router();

/* CHECK IF ASCII DIAGRAM */
function isDiagramBlock(block) {
  return /[│─┌┐└┘+|]/.test(block);
}

/* SPLIT TEXT USING PARAGRAPHS */
function buildBlocks(text) {
  return text.split("\n\n").map(p => p.trim()).filter(Boolean);
}

/* SPLIT LONG PARAGRAPH */
function splitLong(text, max = 650) {
  if (text.length <= max) return [text];
  let slides = [];
  let curr = "";

  for (let w of text.split(" ")) {
    if ((curr + w).length > max) {
      slides.push(curr.trim());
      curr = "";
    }
    curr += w + " ";
  }
  if (curr.trim()) slides.push(curr.trim());
  return slides;
}

router.post("/generate", async (req, res) => {
  try {
    const { text, title } = req.body;

    const ppt = new PptxGenJS();

    // TITLE SLIDE
    let titleSlide = ppt.addSlide();
    titleSlide.addText(title || "Generated PPT", {
      x: 1, y: 1.5,
      fontSize: 44,
      bold: true,
      align: "center",
      color: "004080",
    });

    const blocks = buildBlocks(text || "");

    for (let block of blocks) {

      // DIAGRAM BLOCK → SHOW AS MONOSPACE TEXT
      if (isDiagramBlock(block)) {
        let slide = ppt.addSlide();
        slide.addText(block, {
          x: 0.3,
          y: 0.3,
          w: "95%",
          h: "90%",
          fontSize: 18,
          fontFace: "Courier New",
          color: "000000",
          isTextBox: true,
          lineSpacingMultiple: 1.2,
        });
        continue;
      }

      // NORMAL PARAGRAPH BLOCK
      let chunks = splitLong(block);
      chunks.forEach((c) => {
        let slide = ppt.addSlide();
        slide.addText(c, {
          x: 0.5,
          y: 0.6,
          w: "90%",
          h: "85%",
          fontSize: 26,
          fontFace: "Calibri",
          color: "222222",
        });
      });
    }

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `ppt-${Date.now()}.pptx`;
    const filePath = path.join(tempDir, fileName);
    await ppt.writeFile({ fileName: filePath });

    return res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Download error:", err.message);
      }
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupErr) {
        console.error("Temp cleanup error:", cleanupErr.message);
      }
    });

  } catch (err) {
    console.error("ERROR in legacy PPT generator:", err);
    res.status(500).json({ error: "Failed to generate PPT" });
  }
});

export default router;
