/**
 * Generate clean plain-text document from structured content.
 *
 * @param {Object} structuredContent - AI-generated content
 * @param {string} structuredContent.title - Document title
 * @param {Array}  structuredContent.sections - Array of {heading, content, bullets}
 * @returns {string} Formatted plain text
 */
export function generateTXT(structuredContent) {
  const { title, sections = [] } = structuredContent;
  const lines = [];

  // Title with === underline
  if (title) {
    lines.push(title);
    lines.push('='.repeat(title.length));
    lines.push('');
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    // Section heading with --- underline
    if (section.heading) {
      lines.push(section.heading);
      lines.push('-'.repeat(section.heading.length));
      lines.push('');
    }

    // Content paragraphs
    if (section.content) {
      const paragraphs = section.content.split('\n').filter(Boolean);
      for (const para of paragraphs) {
        lines.push(para.trim());
        lines.push('');
      }
    }

    // Bullet points
    if (section.bullets && Array.isArray(section.bullets) && section.bullets.length > 0) {
      for (const bullet of section.bullets) {
        lines.push(`  \u2022 ${bullet}`);
      }
      lines.push('');
    }

    // Numbered items (if provided as numberedItems)
    if (section.numberedItems && Array.isArray(section.numberedItems) && section.numberedItems.length > 0) {
      section.numberedItems.forEach((item, idx) => {
        lines.push(`  ${idx + 1}. ${item}`);
      });
      lines.push('');
    }

    // Add extra spacing between sections
    if (i < sections.length - 1) {
      lines.push('');
    }
  }

  return lines.join('\n');
}
