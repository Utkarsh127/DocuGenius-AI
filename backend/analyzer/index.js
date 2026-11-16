import { readLogs } from "./parser.js";
import { getFunctionalInsights } from "./functional.js";
import { getPerformanceInsights } from "./performance.js";
import { exportJSON, exportCSV } from "./export.js";

export function analyzeLogs() {
  const logs = readLogs();

  const functional = getFunctionalInsights(logs);
  const performance = getPerformanceInsights(logs);

  const final = {
    parsedLogs: logs.length,
    functional,
    performance,
  };

  const jsonPath = exportJSON(final);
  const csvPath = exportCSV(logs);

  return {
    ...final,
    exportPaths: { json: jsonPath, csv: csvPath },
  };
}
