import fs from "fs";

export function exportJSON(data) {
  const file = "logs_analysis.json";
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export function exportCSV(data) {
  const file = "logs_analysis.csv";

  const arr = Array.isArray(data) ? data : [data];

  
  if (!arr.length || typeof arr[0] !== "object" || arr[0] === null) {
    fs.writeFileSync(file, "no_data");
    return file;
  }

  const keys = Object.keys(arr[0]);
  
  const csv = [
    keys.join(","),
    ...arr.map(row => keys.map(k => JSON.stringify(row[k] ?? "")).join(","))
  ].join("\n");

  fs.writeFileSync(file, csv);
  return file;
}
