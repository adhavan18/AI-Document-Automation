// Generic PDF template filler using pdf-lib AcroForm field filling.
// Loads a base PDF from backend/templates/forms/<filename>,
// fills every field in fieldMap by name, flattens, and returns a Buffer.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FORMS_DIR = join(__dirname, '../templates/forms');

/**
 * @param {string} filename  — file inside backend/templates/forms/
 * @param {Record<string, string|boolean>} fieldMap  — { "AcroFieldName": value }
 * @param {boolean} flatten  — flatten form after filling (default true)
 * @returns {Promise<Buffer>}
 */
export async function fillPdf(filename, fieldMap, flatten = true) {
  const filePath = join(FORMS_DIR, filename);
  if (!existsSync(filePath)) {
    throw new Error(
      `Template PDF not found: backend/templates/forms/${filename}. ` +
      `Drop the PDF there and restart the server.`
    );
  }

  const templateBytes = readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  const allFields = form.getFields();

  // Log available field names once so devs can build/verify the mapping.
  console.log(`[pdf-fill] ${filename} — ${allFields.length} AcroForm fields:`);
  allFields.forEach((f) => console.log(`  [${f.constructor.name.replace('PDF', '')}] "${f.getName()}"`));

  let filled = 0;
  for (const [name, value] of Object.entries(fieldMap)) {
    try {
      const field = form.getFieldMaybe(name);
      if (!field) { console.warn(`[pdf-fill] field not found: "${name}"`); continue; }
      const type = field.constructor.name;
      if (type === 'PDFTextField') {
        field.setText(value == null ? '' : String(value));
        filled++;
      } else if (type === 'PDFCheckBox') {
        value ? field.check() : field.uncheck();
        filled++;
      } else if (type === 'PDFRadioGroup') {
        if (value) { field.select(String(value)); filled++; }
      } else if (type === 'PDFDropdown') {
        if (value) { field.select(String(value)); filled++; }
      }
    } catch (e) {
      console.warn(`[pdf-fill] error on field "${name}": ${e.message}`);
    }
  }

  console.log(`[pdf-fill] filled ${filled}/${Object.keys(fieldMap).length} mapped fields`);

  if (flatten) form.flatten();
  return Buffer.from(await pdfDoc.save());
}

/**
 * Returns all field names in a PDF template — useful for building a field map.
 */
export async function listFields(filename) {
  const filePath = join(FORMS_DIR, filename);
  if (!existsSync(filePath)) return [];
  const bytes = readFileSync(filePath);
  const doc   = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getForm().getFields().map((f) => ({
    name: f.getName(),
    type: f.constructor.name.replace('PDF', ''),
  }));
}
