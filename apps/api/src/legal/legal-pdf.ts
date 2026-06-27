import * as path from 'node:path';
import PDFDocument from 'pdfkit';
import type { LegalBlock, LegalDocRecord } from '@valloreg/shared';

// Szerver-oldali PDF a jogi dokumentumokból (pdfkit + beágyazott DejaVu Sans,
// hogy a román ékezetek – ș, ț, ă, î, â – helyesen jelenjenek meg). A pdfkit
// beépített fontjai (WinAnsi) NEM fednék le ezeket.

let fonts: { regular: string; bold: string } | null = null;

/** A beágyazott TTF-fontok elérési útja (lazy, hogy a boot ne bukjon el). */
function resolveFonts(): { regular: string; bold: string } {
  if (!fonts) {
    // A csomag package.json-ján át oldjuk fel (a subpath-resolve a pnpm szigorú
    // node_modules elrendezésénél megbízhatatlan).
    const dir = path.dirname(require.resolve('dejavu-fonts-ttf/package.json'));
    fonts = {
      regular: path.join(dir, 'ttf', 'DejaVuSans.ttf'),
      bold: path.join(dir, 'ttf', 'DejaVuSans-Bold.ttf'),
    };
  }
  return fonts;
}

function renderBlock(pdf: PDFKit.PDFDocument, block: LegalBlock): void {
  switch (block.k) {
    case 'h':
      pdf.moveDown(0.6).font('bold').fontSize(13).fillColor('#111').text(block.t);
      pdf.moveDown(0.2).font('regular').fontSize(10).fillColor('#222');
      return;
    case 'p':
      pdf.font('regular').fontSize(10).fillColor('#222').text(block.t, {
        align: 'left',
      });
      pdf.moveDown(0.3);
      return;
    case 'ul':
      pdf.font('regular').fontSize(10).fillColor('#222');
      for (const it of block.items) {
        pdf.text(`•  ${it}`, { indent: 10 });
      }
      pdf.moveDown(0.3);
      return;
    case 'ol':
      pdf.font('regular').fontSize(10).fillColor('#222');
      block.items.forEach((it, i) => {
        pdf.text(`${i + 1}.  ${it}`, { indent: 10 });
      });
      pdf.moveDown(0.3);
      return;
    case 'note':
      pdf.moveDown(0.2).font('regular').fontSize(9).fillColor('#555').text(`⚖  ${block.t}`, {
        indent: 8,
      });
      pdf.moveDown(0.3).fillColor('#222');
      return;
    case 'table': {
      // pdfkitben nincs natív tábla – fejléc + soronként „oszlop: érték" formában.
      pdf.font('bold').fontSize(9).fillColor('#111').text(block.head.join('  |  '));
      pdf.font('regular').fontSize(9).fillColor('#333');
      for (const row of block.rows) {
        const line = row
          .map((cell, i) => (block.head[i] ? `${block.head[i]}: ${cell}` : cell))
          .join('  —  ');
        pdf.text(line, { indent: 6 });
      }
      pdf.moveDown(0.4).fillColor('#222');
      return;
    }
    default:
      return;
  }
}

/** Egy jogi dokumentum PDF-buffere (A4, beágyazott Unicode-fonttal). */
export function legalDocToPdf(doc: LegalDocRecord): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const { regular, bold } = resolveFonts();
      const pdf = new PDFDocument({ size: 'A4', margin: 56 });
      pdf.registerFont('regular', regular);
      pdf.registerFont('bold', bold);

      const chunks: Buffer[] = [];
      pdf.on('data', (c: Buffer) => chunks.push(c));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      pdf.font('bold').fontSize(20).fillColor('#111').text(doc.title);
      pdf.moveDown(0.3);
      if (doc.subtitle) {
        pdf.font('regular').fontSize(11).fillColor('#666').text(doc.subtitle);
      }
      pdf.font('regular').fontSize(9).fillColor('#888').text(`Ultima actualizare: ${doc.updated}`);
      pdf.moveDown(0.8).fillColor('#222');

      for (const block of doc.blocks) {
        renderBlock(pdf, block);
      }

      pdf.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
