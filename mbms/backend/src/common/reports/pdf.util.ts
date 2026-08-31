import PDFDocument from 'pdfkit';

// RPT-06: the PDF half of "exportable to at least PDF and Excel/CSV." A
// deliberately simple fixed-width table renderer, not a general-purpose
// PDF layout engine — long cell values are truncated with an ellipsis
// rather than wrapped, which is enough for the tabular listing/report
// shapes every report in this module produces.
export function buildPdfTable(title: string, subtitle: string | null, headers: string[], rows: (string | number | null | undefined)[][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).font('Helvetica-Bold').text(title);
    if (subtitle) {
      doc.fontSize(10).font('Helvetica').fillColor('#555').text(subtitle);
      doc.fillColor('#000');
    }
    doc.fontSize(8).font('Helvetica').text(`Generated ${new Date().toISOString()} — Morise Holdings Limited MBMS`);
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
