import PDFDocument from 'pdfkit';

// RPT-06: the PDF half of "exportable to at least PDF and Excel/CSV." A
// deliberately simple fixed-width table renderer, not a general-purpose
// PDF layout engine — long cell values are truncated with an ellipsis
// rather than wrapped, which is enough for the tabular listing/report
// shapes every report in this module produces.
export interface PdfEStamp {
  stampNumber: string;
  stampedAt: Date | string;
  recipientName?: string | null;
}

export function buildPdfTable(
  title: string,
  subtitle: string | null,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  opts?: { stamp?: PdfEStamp },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text(title);
    if (subtitle) {
      doc.fontSize(10).font('Helvetica').fillColor('#555').text(subtitle);
      doc.fillColor('#000');
    }
    doc.fontSize(8).font('Helvetica').text(`Generated ${new Date().toISOString()} — Morise Holdings Limited MBMS`);

    // Morise e-Stamp seal, top-right — drawn when the customer has confirmed
    // receipt of the goods / services in good condition.
    if (opts?.stamp) {
      drawEStamp(doc, opts.stamp);
    }

    doc.moveDown();

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / headers.length;
    const rowHeight = 16;

    const drawRow = (values: (string | number | null | undefined)[], bold: boolean) => {
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
      values.forEach((v, i) => {
        const text = v === null || v === undefined ? '' : String(v);
        doc.text(text, doc.page.margins.left + i * colWidth, y, { width: colWidth - 4, height: rowHeight, ellipsis: true });
      });
      doc.y = y + rowHeight;
      if (doc.y > doc.page.height - doc.page.margins.bottom - rowHeight) {
        doc.addPage({ margin: 40, size: 'A4', layout: 'landscape' });
      }
    };

    drawRow(headers, true);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#999').stroke();
    doc.moveDown(0.3);
    for (const row of rows) {
      drawRow(row, false);
    }
    if (rows.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(9).text('No rows.');
    }

    doc.end();
  });
}

// A small navy/amber seal bearing the Morise mark, a stamp number and the
// confirmation wording — the visible half of the "automatic Morise e-Stamp
// on a customer-acknowledged delivery" feature.
function drawEStamp(doc: any, stamp: PdfEStamp): void {
  const w = 232;
  const h = 116;
  const x = doc.page.width - doc.page.margins.right - w;
  const y = 34;
  doc.save();
  doc.rotate(-4, { origin: [x + w / 2, y + h / 2] });
  doc.roundedRect(x, y, w, h, 10).lineWidth(2).strokeColor('#1E3A5F').stroke();
  doc.roundedRect(x + 4, y + 4, w - 8, h - 8, 8).lineWidth(0.75).strokeColor('#D97706').stroke();

  // Morise "M" mark (same geometry as the app Logo) + amber apex diamond.
  doc.save();
  doc.translate(x + 12, y + 14).scale(0.44);
  doc
    .path('M32 94 V40 L64 74 L96 40 V94')
    .lineWidth(13)
    .strokeColor('#1E3A5F')
    .lineJoin('round')
    .lineCap('round')
    .stroke();
  doc.path('M64 20 L77 33 L64 46 L51 33 Z').fillColor('#D97706').fill();
  doc.restore();

  const tx = x + 66;
  doc.fillColor('#1E3A5F').font('Helvetica-Bold').fontSize(12).text('MORISE e-STAMP', tx, y + 14, { width: w - 74 });
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#333')
    .text('Goods / services received and confirmed', tx, y + 31, { width: w - 74 })
    .text('in good condition by the customer.', tx, doc.y, { width: w - 74 });

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1E3A5F').text(stamp.stampNumber, x + 12, y + h - 36, { width: w - 24 });
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#555')
    .text(
      `Confirmed ${new Date(stamp.stampedAt).toLocaleDateString()}${stamp.recipientName ? ' · ' + stamp.recipientName : ''} · Morise Holdings Limited`,
      x + 12,
      y + h - 23,
      { width: w - 24 },
    );
  doc.restore();

  // Make sure the table below starts clear of the seal.
  doc.x = doc.page.margins.left;
  doc.y = Math.max(doc.y, y + h + 8);
}
