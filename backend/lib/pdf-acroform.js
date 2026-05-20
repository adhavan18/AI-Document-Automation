// Native AcroForm filler for USCIS forms.
// Loads a decrypted PDF, fills fields by name (no coordinates), regenerates
// appearance streams so Adobe Reader renders them, then flattens.
//
// dataMap shape: { '<acroform field name>': value }
//   • value === true       → check the checkbox
//   • value falsy / ''     → skip
//   • value string|number  → setText for TextField, select for Dropdown

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FORMS_DIR = join(__dirname, '../templates/forms');

export async function fillAcroForm(filename, dataMap) {
  const bytes  = readFileSync(join(FORMS_DIR, filename));
  const pdfDoc = await PDFDocument.load(bytes);
  const form   = pdfDoc.getForm();

  let filled = 0;
  let missed = 0;

  for (const [name, value] of Object.entries(dataMap)) {
    if (value === false || value == null || value === '') continue;

    try {
      const field = form.getField(name);
      const kind  = field.constructor.name;

      if (kind === 'PDFCheckBox') {
        if (value === true) field.check();
      } else if (kind === 'PDFDropdown') {
        // Selecting a value not in the option list throws; fall back to
        // adding the option so we still get the text into the field.
        const opts = field.getOptions();
        if (opts.includes(String(value))) {
          field.select(String(value));
        } else {
          field.addOptions([String(value)]);
          field.select(String(value));
        }
      } else {
        field.setText(String(value));
      }
      filled++;
    } catch (err) {
      missed++;
      console.warn(`[acroform] could not fill "${name}": ${err.message}`);
    }
  }

  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(helv);
  form.flatten();

  console.log(`[acroform] ${filename} — filled ${filled}, missed ${missed}`);
  return Buffer.from(await pdfDoc.save());
}
