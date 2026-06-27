// Jogi dokumentum szerializálók – izomorf (böngésző + Node), külső függőség nélkül.
// A PDF NEM itt készül (az Node-only `pdfkit`-et igényel) – lásd az API service-t.

import type { LegalBlock, LegalDocRecord, LegalDownloadFormat } from './types';

/** A letöltött / csatolt fájl neve egy adott formátumhoz. */
export function legalDownloadFilename(slug: string, format: LegalDownloadFormat): string {
  return `${slug}.${format}`;
}

/** Strukturált JSON export (gépi feldolgozás / backup). */
export function legalDocToJson(doc: LegalDocRecord): string {
  return JSON.stringify(
    {
      slug: doc.slug,
      category: doc.category,
      title: doc.title,
      subtitle: doc.subtitle ?? null,
      summary: doc.summary,
      updated: doc.updated,
      isPublic: doc.isPublic,
      blocks: doc.blocks,
    },
    null,
    2,
  );
}

function blockToMarkdown(block: LegalBlock): string {
  switch (block.k) {
    case 'h':
      return `## ${block.t}`;
    case 'p':
      return block.t;
    case 'ul':
      return block.items.map((it) => `- ${it}`).join('\n');
    case 'ol':
      return block.items.map((it, i) => `${i + 1}. ${it}`).join('\n');
    case 'note':
      return `> ⚖️ ${block.t}`;
    case 'table': {
      const head = `| ${block.head.join(' | ')} |`;
      const sep = `| ${block.head.map(() => '---').join(' | ')} |`;
      const rows = block.rows.map((r) => `| ${r.join(' | ')} |`);
      return [head, sep, ...rows].join('\n');
    }
    default:
      return '';
  }
}

/** Markdown export (verziókövethető, ember által olvasható). */
export function legalDocToMarkdown(doc: LegalDocRecord): string {
  const lines: string[] = [`# ${doc.title}`, ''];
  if (doc.subtitle) {
    lines.push(`_${doc.subtitle}_`, '');
  }
  lines.push(`**Ultima actualizare:** ${doc.updated}`, '');
  for (const block of doc.blocks) {
    lines.push(blockToMarkdown(block), '');
  }
  return (
    lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  );
}
