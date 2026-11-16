import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, "../logs");

export function readLogs() {
  if (!fs.existsSync(logsDir)) {
    throw new Error("Logs folder not found at: " + logsDir);
  }

  const files = fs.readdirSync(logsDir);
  let logs = [];

  for (const file of files) {
    if (!file.endsWith('.log')) continue;
    const filePath = path.join(logsDir, file);
    const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        
        // Because actual data is inside "message"
        if (parsed.message) {
          logs.push(parsed.message);
        }
      } catch (err) {
        console.error("Bad JSON:", line);
      }
    }
  }

  return logs;
}
