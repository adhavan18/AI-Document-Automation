// PDF text-overlay engine.
// Neither the USCIS I-765 (an XFA dynamic form) nor the flat PAF design
// expose fillable AcroForm fields, so we stamp values directly onto the
// saved PDF at fixed coordinates instead of filling form fields.
//
// pdf-lib coordinate space: origin is BOTTOM-LEFT, units are points.
// US Letter = 612 x 792 pt.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FORMS_DIR = join(__dirname, '../templates/forms');

/**
 * Stamp text onto an existing PDF.
 *
 * @param {string} filename — file inside backend/templates/forms/
 * @param {Array<{page:number,x:number,y:number,text:any,size?:number,
 *                bold?:boolean,check?:boolean}>} placements
 * @param {{calibrate?:boolean}} opts — calibrate:true overlays a coordinate grid
 * @returns {Promise<Buffer>}
 */
export async function stampPdf(filename, placements, opts = {}) {
  const filePath = join(FORMS_DIR, filename);
  if (!existsSync(filePath)) {
    throw new Error(
      `Template PDF not found: backend/templates/forms/${filename}. ` +
      `Drop the PDF there and restart the server.`
    );
  }

  const bytes  = readFileSync(filePath);
  // throwOnInvalidObject:false → tolerate the XFA object-ref warnings the
  // USCIS form produces; we never touch the form, only the page canvas.
  const pdfDoc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  });

  const helv     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages    = pdfDoc.getPages();
  const black    = rgb(0, 0, 0);

  console.log(`[pdf-stamp] ${filename} — ${pages.length} pages, ${placements.length} placements${opts.calibrate ? ' (CALIBRATION GRID)' : ''}`);

  // ── Calibration grid: ruler ticks every 50pt, light lines every 25pt ──
  if (opts.calibrate) {
    pages.forEach((page, pi) => {
      const { width, height } = page.getSize();
      for (let x = 0; x <= width; x += 25) {
        page.drawLine({ start: { x, y: 0 }, end: { x, y: height },
          thickness: x % 50 === 0 ? 0.4 : 0.15,
          color: rgb(0.6, 0.7, 1), opacity: 0.5 });
        if (x % 50 === 0) {
          page.drawText(String(x), { x: x + 1, y: 3, size: 5, font: helv, color: rgb(0, 0, 0.8) });
          page.drawText(String(x), { x: x + 1, y: height - 8, size: 5, font: helv, color: rgb(0, 0, 0.8) });
        }
      }
      for (let y = 0; y <= height; y += 25) {
        page.drawLine({ start: { x: 0, y }, end: { x: width, y },
          thickness: y % 50 === 0 ? 0.4 : 0.15,
          color: rgb(1, 0.7, 0.6), opacity: 0.5 });
        if (y % 50 === 0) {
          page.drawText(String(y), { x: 2, y: y + 1, size: 5, font: helv, color: rgb(0.8, 0, 0) });
          page.drawText(String(y), { x: width - 18, y: y + 1, size: 5, font: helv, color: rgb(0.8, 0, 0) });
        }
      }
      page.drawText(`PAGE INDEX ${pi}  (size ${Math.round(width)} x ${Math.round(height)} pt)`,
        { x: width / 2 - 80, y: height / 2, size: 9, font: helvBold, color: rgb(0.8, 0, 0.8) });
    });
  }

  // ── Stamp the actual values ──
  let stamped = 0;
  for (const p of placements) {
    const page = pages[p.page];
    if (!page) { console.warn(`[pdf-stamp] no page index ${p.page}`); continue; }

    if (p.check) {
      page.drawText('X', { x: p.x, y: p.y, size: p.size ?? 10,
        font: helvBold, color: black });
      stamped++;
      continue;
    }

    const text = p.text == null ? '' : String(p.text);
    if (!text) continue;
    page.drawText(text, {
      x: p.x, y: p.y, size: p.size ?? 9,
      font: p.bold ? helvBold : helv, color: black,
    });
    stamped++;
  }

  console.log(`[pdf-stamp] stamped ${stamped}/${placements.length} placements`);
  return Buffer.from(await pdfDoc.save());
}

/** Diagnostic — page count and per-page dimensions in points. */
export async function pdfPageSizes(filename) {
  const filePath = join(FORMS_DIR, filename);
  if (!existsSync(filePath)) return [];
  const doc = await PDFDocument.load(readFileSync(filePath), {
    ignoreEncryption: true, throwOnInvalidObject: false,
  });
  return doc.getPages().map((p, i) => {
    const { width, height } = p.getSize();
    return { page: i, width: Math.round(width), height: Math.round(height) };
  });
}
