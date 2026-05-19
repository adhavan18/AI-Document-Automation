// PDF text-overlay engine.
// Stamps text/checkmarks onto the saved PDF canvas at fixed coordinates.
// XFA PDFs (like the USCIS I-765) are automatically flattened via Ghostscript
// before loading — the flattened copy is cached as <name>_flat.pdf.
//
// pdf-lib coordinate space: origin = BOTTOM-LEFT, units = points (pt).
// US Letter = 612 x 792 pt. At 72 DPI: 1 pixel = 1 pt.
// Rendering formula: PDF_y = page_height - image_y_from_top

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { PDFDocument, StandardFonts, rgb, PDFName } from 'pdf-lib';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FORMS_DIR = join(__dirname, '../templates/forms');

function flattenPath(filename) {
  const base = filename.replace(/\.pdf$/i, '');
  return join(FORMS_DIR, `${base}_flat.pdf`);
}

// Run Ghostscript to convert XFA / incompatible PDFs to static pdfwrite output.
function flattenWithGs(inputPath, outputPath) {
  console.log(`[pdf-stamp] flattening XFA with Ghostscript: ${inputPath}`);
  execSync(
    `gs -dBATCH -dNOPAUSE -dQUIET -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -sOutputFile="${outputPath}" "${inputPath}"`,
    { stdio: 'inherit' }
  );
}

// Load the PDF, auto-flattening with Ghostscript if the page tree is unreadable.
async function loadPdfDoc(filename) {
  const filePath = join(FORMS_DIR, filename);
  if (!existsSync(filePath)) {
    throw new Error(
      `Template PDF not found: backend/templates/forms/${filename}. ` +
      `Drop the PDF there and restart the server.`
    );
  }

  let bytes = readFileSync(filePath);
  let doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });

  // Try getPages() — XFA forms throw "Expected instance of PDFDict" here.
  try {
    doc.getPages();
    return doc;
  } catch {
    // Flatten with Ghostscript and reload.
    const flat = flattenPath(filename);
    if (!existsSync(flat)) {
      flattenWithGs(filePath, flat);
      // Strip page annotations so our content-stream stamps aren't painted over.
      const flatBytes = readFileSync(flat);
      const flatDoc = await PDFDocument.load(flatBytes, { ignoreEncryption: true, throwOnInvalidObject: false });
      for (const page of flatDoc.getPages()) page.node.delete(PDFName.of('Annots'));
      writeFileSync(flat, await flatDoc.save());
    }
    bytes = readFileSync(flat);
    doc   = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
    return doc;
  }
}

/**
 * Stamp text/checkmarks onto an existing PDF.
 *
 * @param {string} filename — file inside backend/templates/forms/
 * @param {Array<{page:number, x:number, y:number, text?:any,
 *                size?:number, bold?:boolean, check?:boolean}>} placements
 * @param {{calibrate?:boolean}} opts
 * @returns {Promise<Buffer>}
 */
export async function stampPdf(filename, placements, opts = {}) {
  const pdfDoc   = await loadPdfDoc(filename);
  const helv     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages    = pdfDoc.getPages();
  const black    = rgb(0, 0, 0);

  console.log(`[pdf-stamp] ${filename} — ${pages.length} pages, ${placements.length} placements${opts.calibrate ? ' [CALIBRATION]' : ''}`);

  // ── Calibration grid ──────────────────────────────────────────────────────
  if (opts.calibrate) {
    pages.forEach((page, pi) => {
      const { width, height } = page.getSize();
      for (let x = 0; x <= width; x += 25) {
        page.drawLine({ start: { x, y: 0 }, end: { x, y: height },
          thickness: x % 50 === 0 ? 0.5 : 0.2, color: rgb(0.55, 0.7, 1), opacity: 0.6 });
        if (x % 50 === 0)
          page.drawText(String(x), { x: x + 1, y: 3, size: 5, font: helv, color: rgb(0, 0, 0.8) });
      }
      for (let y = 0; y <= height; y += 25) {
        page.drawLine({ start: { x: 0, y }, end: { x: width, y },
          thickness: y % 50 === 0 ? 0.5 : 0.2, color: rgb(1, 0.7, 0.55), opacity: 0.6 });
        if (y % 50 === 0)
          page.drawText(String(y), { x: 2, y: y + 1, size: 5, font: helv, color: rgb(0.8, 0, 0) });
      }
      page.drawText(`p${pi}  ${Math.round(width)}×${Math.round(height)}pt`,
        { x: width / 2 - 40, y: height / 2, size: 10, font: helvBold, color: rgb(0.7, 0, 0.8) });
    });
  }

  // ── Stamp values ──────────────────────────────────────────────────────────
  let stamped = 0;
  for (const p of placements) {
    const page = pages[p.page];
    if (!page) { console.warn(`[pdf-stamp] no page[${p.page}]`); continue; }

    // Whiteout: draw a filled white rectangle to erase pre-existing template text.
    if (p.whiteout) {
      page.drawRectangle({ x: p.x, y: p.y, width: p.width ?? 200, height: p.height ?? 14, color: rgb(1, 1, 1), borderWidth: 0 });
      continue;
    }

    if (p.check) {
      page.drawText('X', { x: p.x, y: p.y, size: p.size ?? 8, font: helvBold, color: black });
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

  console.log(`[pdf-stamp] stamped ${stamped}/${placements.filter(p => p.check || (p.text != null && String(p.text))).length}`);
  return Buffer.from(await pdfDoc.save());
}
