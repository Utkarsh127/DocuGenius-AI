import { exec } from 'child_process';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

/**
 * Try to render Mermaid code to PNG using @mermaid-js/mermaid-cli (mmdc).
 * Falls back to a text-based diagram if mmdc is unavailable or fails.
 */
export async function generateDiagramImage(mermaidCode, options = {}) {
  if (!mermaidCode || typeof mermaidCode !== 'string') {
    return null;
  }

  const { width = 800, height = 600 } = options;

  // Fast Path 1: Generate lightweight SVG-based vector diagram
  try {
    const svgBuffer = generateSvgFallback(mermaidCode, width, height);
    if (svgBuffer) return svgBuffer;
  } catch {
    // Continue to mmdc
  }

  // Path 2: Try mmdc CLI if enabled in environment or installed locally
  if (process.env.ENABLE_MMDC === 'true') {
    try {
      const result = await renderWithMmdc(mermaidCode, width, height);
      if (result) return result;
    } catch {
      // Fallback
    }
  }

  return null;
}

/**
 * Generate a clean text representation of a diagram for embedding as text in slides.
 */
export function getDiagramTextFallback(mermaidCode) {
  if (!mermaidCode) return null;

  const lines = mermaidCode.trim().split('\n');
  const cleaned = [];
  const nodeLabels = {};

  // First pass: extract node labels like A[Start Process]
  for (const line of lines) {
    const nodeMatches = line.matchAll(/(\w+)\[([^\]]+)\]/g);
    for (const match of nodeMatches) {
      nodeLabels[match[1]] = match[2].trim();
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    // Directive headers
    if (/^(graph|flowchart|sequenceDiagram|mindmap|timeline|classDiagram|erDiagram)\b/i.test(trimmed)) {
      const type = trimmed.split(/\s+/)[0].toUpperCase();
      cleaned.push(`[${type}]`);
      continue;
    }

    // Sequence diagram: Alice ->> Bob: Message
    const seqMatch = trimmed.match(/^(\w+)\s*->>?\+?\s*(\w+)\s*:\s*(.+)/);
    if (seqMatch) {
      const sender = nodeLabels[seqMatch[1]] || seqMatch[1];
      const receiver = nodeLabels[seqMatch[2]] || seqMatch[2];
      cleaned.push(`  ${sender} ──► ${receiver}: ${seqMatch[3].trim()}`);
      continue;
    }

    // Flowchart arrows (handles single & chained: A --> B --> C)
    if (trimmed.includes('-->') || trimmed.includes('->')) {
      const parts = trimmed.split(/\s*-->(?:\|[^|]*\|)?\s*|\s*->\s*/);
      if (parts.length > 1) {
        const readableParts = parts.map((part) => {
          const match = part.match(/^(\w+)(?:\[([^\]]+)\])?/);
          if (match) {
            return match[2] || nodeLabels[match[1]] || match[1];
          }
          return part.trim();
        });
        cleaned.push(`  ${readableParts.join('  ──►  ')}`);
        continue;
      }
    }

    // Standalone node with brackets
    const singleNodeMatch = trimmed.match(/^(\w+)\[([^\]]+)\]$/);
    if (singleNodeMatch) {
      cleaned.push(`  [${singleNodeMatch[2]}]`);
      continue;
    }

    // Default clean line
    cleaned.push(`  ${trimmed}`);
  }

  return cleaned.join('\n');
}

/**
 * Render Mermaid via mmdc CLI.
 */
async function renderWithMmdc(mermaidCode, width, height) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'mermaid-'));
  const inputPath = path.join(tempDir, 'input.mmd');
  const outputPath = path.join(tempDir, 'output.png');

  await writeFile(inputPath, mermaidCode, 'utf-8');

  return new Promise((resolve, reject) => {
    const cmd = `npx --yes @mermaid-js/mermaid-cli -i "${inputPath}" -o "${outputPath}" -w ${width} -H ${height} --puppeteerConfigFile "" 2>&1`;

    const child = exec(cmd, { timeout: 20000, cwd: process.cwd() }, async (error) => {
      try {
        if (error) {
          await cleanup(inputPath, outputPath);
          return reject(error);
        }
        const buffer = await readFile(outputPath);
        await cleanup(inputPath, outputPath);
        resolve(buffer);
      } catch (e) {
        await cleanup(inputPath, outputPath);
        reject(e);
      }
    });
  });
}

/**
 * Generate a simple SVG-based diagram as a Buffer.
 * This creates a basic representation for flowcharts.
 */
function generateSvgFallback(mermaidCode, width, height) {
  const nodes = [];
  const edges = [];
  const lines = mermaidCode.trim().split('\n');

  // Parse nodes and edges from simple flowchart syntax
  for (const line of lines) {
    const trimmed = line.trim();
    const arrowMatch = trimmed.match(/^(\w+)(?:\[([^\]]+)\])?\s*-->\s*(?:\|([^|]*)\|\s*)?(\w+)(?:\[([^\]]+)\])?/);
    if (arrowMatch) {
      const fromId = arrowMatch[1];
      const fromLabel = arrowMatch[2] || fromId;
      const edgeLabel = arrowMatch[3] || '';
      const toId = arrowMatch[4];
      const toLabel = arrowMatch[5] || toId;

      if (!nodes.find(n => n.id === fromId)) nodes.push({ id: fromId, label: fromLabel });
      if (!nodes.find(n => n.id === toId)) nodes.push({ id: toId, label: toLabel });
      edges.push({ from: fromId, to: toId, label: edgeLabel });
    } else {
      const nodeMatch = trimmed.match(/^\s*(\w+)\[([^\]]+)\]/);
      if (nodeMatch && !nodes.find(n => n.id === nodeMatch[1])) {
        nodes.push({ id: nodeMatch[1], label: nodeMatch[2] });
      }
    }
  }

  if (nodes.length === 0) return null;

  // Layout: vertical stack
  const nodeWidth = 160;
  const nodeHeight = 40;
  const gapY = 60;
  const startX = width / 2 - nodeWidth / 2;
  const startY = 30;

  const positions = {};
  nodes.forEach((node, i) => {
    positions[node.id] = { x: startX, y: startY + i * (nodeHeight + gapY) };
  });

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.max(height, nodes.length * (nodeHeight + gapY) + 60)}" style="background:#ffffff">`;
  svgContent += `<style>text{font-family:Arial,sans-serif;font-size:13px;fill:#333}rect{fill:#e8f0fe;stroke:#4285f4;stroke-width:2;rx:8}line{stroke:#666;stroke-width:2;marker-end:url(#arrow)}</style>`;
  svgContent += `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#666"/></marker></defs>`;

  // Draw edges
  for (const edge of edges) {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (from && to) {
      svgContent += `<line x1="${from.x + nodeWidth / 2}" y1="${from.y + nodeHeight}" x2="${to.x + nodeWidth / 2}" y2="${to.y}"/>`;
      if (edge.label) {
        const midY = (from.y + nodeHeight + to.y) / 2;
        svgContent += `<text x="${from.x + nodeWidth / 2 + 10}" y="${midY + 4}" font-size="11" fill="#888">${escapeXml(edge.label)}</text>`;
      }
    }
  }

  // Draw nodes
  for (const node of nodes) {
    const pos = positions[node.id];
    svgContent += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}"/>`;
    svgContent += `<text x="${pos.x + nodeWidth / 2}" y="${pos.y + nodeHeight / 2 + 5}" text-anchor="middle">${escapeXml(node.label)}</text>`;
  }

  svgContent += '</svg>';

  return Buffer.from(svgContent, 'utf-8');
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function cleanup(...files) {
  for (const f of files) {
    try { await unlink(f); } catch { /* ignore */ }
  }
}
