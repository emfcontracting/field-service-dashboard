import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

export async function POST(request) {
  try {
    const data = await request.json();
    const {
      invoiceNumber,
      fromName,
      fromAddress,
      fromEmail,
      toName,
      toAddress,
      toCity,
      toState,
      toZip,
      toEmail,
      lineItems,
      total
    } = data;

    // Create PDF
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    
    // Collect PDF chunks
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    // Header background
    doc.rect(50, 50, 512, 80).fill('#1f2937');
    
    // Invoice title
    doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text('INVOICE', 70, 70);
    doc.fillColor('#9ca3af').fontSize(12).font('Helvetica').text(invoiceNumber, 70, 100);
    
    // Date
    doc.fillColor('#9ca3af').fontSize(10).text('Date', 450, 70, { align: 'right', width: 92 });
    doc.fillColor('#ffffff').fontSize(12).text(new Date().toLocaleDateString(), 450, 85, { align: 'right', width: 92 });
    
    // Reset position
    let y = 160;
    
    // From section
    doc.fillColor('#6b7280').fontSize(9).font('Helvetica-Bold').text('FROM', 70, y);
    y += 15;
    doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text(fromName, 70, y);
    y += 18;
    if (fromAddress) {
      doc.fillColor('#4b5563').fontSize(11).font('Helvetica').text(fromAddress, 70, y);
      y += 15;
    }
    doc.fillColor('#4b5563').fontSize(11).text(fromEmail, 70, y);
    
    // To section (right side)
    let yTo = 160;
    doc.fillColor('#6b7280').fontSize(9).font('Helvetica-Bold').text('TO', 350, yTo, { align: 'right', width: 192 });
    yTo += 15;
    doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text(toName, 350, yTo, { align: 'right', width: 192 });
    yTo += 18;
    if (toAddress) {
      doc.fillColor('#4b5563').fontSize(11).font('Helvetica').text(toAddress, 350, yTo, { align: 'right', width: 192 });
      yTo += 15;
    }
    const cityStateZip = [toCity, toState, toZip].filter(Boolean).join(', ');
    if (cityStateZip) {
      doc.fillColor('#4b5563').fontSize(11).text(cityStateZip, 350, yTo, { align: 'right', width: 192 });
      yTo += 15;
    }
    if (toEmail) {
      doc.fillColor('#4b5563').fontSize(11).text(toEmail, 350, yTo, { align: 'right', width: 192 });
    }
    
    // Table header
    y = Math.max(y, yTo) + 40;
    doc.rect(50, y, 512, 25).fill('#f3f4f6');
    
    doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 60, y + 8);
    doc.text('Qty', 350, y + 8, { width: 50, align: 'right' });
    doc.text('Rate', 410, y + 8, { width: 60, align: 'right' });
    doc.text('Amount', 480, y + 8, { width: 70, align: 'right' });
    
    y += 25;
    
    // Line items
    doc.font('Helvetica').fontSize(10);
    lineItems.forEach(item => {
      doc.fillColor('#111827').text(item.description || '', 60, y + 8, { width: 280 });
      doc.text(item.quantity.toFixed(1), 350, y + 8, { width: 50, align: 'right' });
      doc.text('$' + item.rate.toFixed(2), 410, y + 8, { width: 60, align: 'right' });
      doc.fillColor('#111827').font('Helvetica-Bold').text('$' + item.amount.toFixed(2), 480, y + 8, { width: 70, align: 'right' });
      doc.font('Helvetica');
      
      // Line separator
      doc.strokeColor('#e5e7eb').moveTo(50, y + 30).lineTo(562, y + 30).stroke();
      y += 35;
    });
    
    // Total box
    y += 20;
    doc.rect(50, y, 512, 50).fill('#f9fafb');
    doc.fillColor('#111827').fontSize(16).font('Helvetica-Bold');
    doc.text('TOTAL DUE', 70, y + 17);
    doc.fillColor('#059669').text('$' + total.toFixed(2), 400, y + 17, { width: 142, align: 'right' });
    
    // Footer
    y += 80;
    doc.fillColor('#9ca3af').fontSize(10).font('Helvetica').text('Thank you for your business!', 50, y, { align: 'center', width: 512 });
    
    // Finalize PDF
    doc.end();
    
    // Wait for PDF to finish
    const pdfBuffer = await new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
    
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"`
      }
    });
    
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
