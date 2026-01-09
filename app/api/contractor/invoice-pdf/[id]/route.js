import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';

// Force Node.js runtime for pdfkit compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper function to format date without timezone shift
function formatDateLocal(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1]} ${day}, ${year}`;
}

export async function GET(request, { params }) {
  const { id } = params;

  try {
    // Get invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from('subcontractor_invoices')
      .select('*')
      .eq('invoice_id', id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get user data
    const { data: userData } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('user_id', invoice.user_id)
      .single();

    // Get subcontractor profile
    const { data: profile } = await supabase
      .from('subcontractor_profiles')
      .select('business_name, business_address')
      .eq('user_id', invoice.user_id)
      .single();

    // Get line items
    const { data: lineItems } = await supabase
      .from('subcontractor_invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('work_date', { ascending: true });

    const businessName = profile?.business_name || `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || 'Unknown';
    const businessAddress = profile?.business_address || '';
    const userEmail = userData?.email || '';

    const hoursItems = (lineItems || []).filter(i => i.item_type === 'hours');
    const mileageItems = (lineItems || []).filter(i => i.item_type === 'mileage');
    const materialItems = (lineItems || []).filter(i => i.item_type === 'material');
    const customItems = (lineItems || []).filter(i => i.item_type === 'custom');

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));

    // Header
    doc.rect(0, 0, 612, 100).fill('#1f2937');
    doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text('INVOICE', 50, 35);
    doc.fontSize(12).font('Helvetica').fillColor('#9ca3af').text(invoice.invoice_number, 50, 65);
    
    doc.fontSize(10).fillColor('#9ca3af').text('Period', 450, 35, { align: 'right' });
    doc.fontSize(11).fillColor('#ffffff').text(
      `${formatDateLocal(invoice.period_start)} - ${formatDateLocal(invoice.period_end)}`,
      450, 50, { align: 'right' }
    );

    // Reset position after header
    doc.y = 120;

    // From / To section
    doc.fillColor('#666666').fontSize(9).font('Helvetica-Bold').text('FROM', 50, 120);
    doc.fillColor('#333333').fontSize(12).font('Helvetica-Bold').text(businessName, 50, 135);
    if (businessAddress) {
      doc.fontSize(10).font('Helvetica').fillColor('#4b5563').text(businessAddress, 50, 152);
    }
    doc.fontSize(10).font('Helvetica').fillColor('#4b5563').text(userEmail, 50, businessAddress ? 167 : 152);

    doc.fillColor('#666666').fontSize(9).font('Helvetica-Bold').text('TO', 350, 120);
    doc.fillColor('#333333').fontSize(12).font('Helvetica-Bold').text('EMF Contracting LLC', 350, 135);
    doc.fontSize(10).font('Helvetica').fillColor('#4b5563')
      .text('565 Pine Plain Rd', 350, 152)
      .text('Gaston, SC 29075', 350, 165)
      .text('emfcontractingsc2@gmail.com', 350, 178);

    // Rates box
    doc.y = 210;
    doc.rect(50, 210, 512, 30).fill('#f3f4f6');
    doc.fillColor('#4b5563').fontSize(10).font('Helvetica')
      .text(
        `Rates: $${parseFloat(invoice.hourly_rate_used || 0).toFixed(2)}/hr regular | $${parseFloat(invoice.ot_rate_used || 0).toFixed(2)}/hr OT | $${parseFloat(invoice.mileage_rate_used || 0).toFixed(4)}/mile`,
        60, 220
      );

    let yPos = 260;

    // Helper function to draw a section
    function drawSection(title, items, columns, isOrange = false) {
      if (items.length === 0) return;

      // Section header
      doc.fillColor(isOrange ? '#ea580c' : '#374151').fontSize(11).font('Helvetica-Bold').text(title, 50, yPos);
      yPos += 5;
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, yPos + 10).lineTo(562, yPos + 10).stroke();
      yPos += 20;

      // Column headers
      doc.fillColor('#6b7280').fontSize(9).font('Helvetica');
      let xPos = 50;
      columns.forEach(col => {
        doc.text(col.header, xPos, yPos, { width: col.width, align: col.align || 'left' });
        xPos += col.width;
      });
      yPos += 18;

      // Rows
      doc.font('Helvetica').fillColor('#333333').fontSize(9);
      items.forEach(item => {
        // Check if we need a new page
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        xPos = 50;
        columns.forEach(col => {
          const value = col.getValue(item);
          const color = col.color || '#333333';
          doc.fillColor(color).text(value, xPos, yPos, { width: col.width, align: col.align || 'left' });
          xPos += col.width;
        });
        yPos += 16;
      });

      yPos += 15;
    }

    // Labor section
    drawSection('Labor', hoursItems, [
      { header: 'Date', width: 80, getValue: (i) => i.work_date ? formatDateLocal(i.work_date) : '-' },
      { header: 'Description', width: 220, getValue: (i) => (i.description || '').substring(0, 40) },
      { header: 'Hours', width: 60, align: 'right', getValue: (i) => parseFloat(i.quantity || 0).toFixed(1) },
      { header: 'Rate', width: 70, align: 'right', getValue: (i) => '$' + parseFloat(i.rate || 0).toFixed(2) },
      { header: 'Amount', width: 80, align: 'right', getValue: (i) => '$' + parseFloat(i.amount || 0).toFixed(2) }
    ]);

    // Mileage section
    drawSection('Mileage', mileageItems, [
      { header: 'Date', width: 80, getValue: (i) => i.work_date ? formatDateLocal(i.work_date) : '-' },
      { header: 'Description', width: 220, getValue: (i) => i.description || 'Mileage' },
      { header: 'Miles', width: 60, align: 'right', getValue: (i) => parseFloat(i.quantity || 0).toFixed(0) },
      { header: 'Rate', width: 70, align: 'right', getValue: (i) => '$' + parseFloat(i.rate || 0).toFixed(4) },
      { header: 'Amount', width: 80, align: 'right', getValue: (i) => '$' + parseFloat(i.amount || 0).toFixed(2) }
    ]);

    // Material Reimbursement section
    drawSection('Material Reimbursement', materialItems, [
      { header: 'Date', width: 100, getValue: (i) => i.work_date ? formatDateLocal(i.work_date) : '-' },
      { header: 'Description', width: 310, getValue: (i) => i.description || '' },
      { header: 'Amount', width: 100, align: 'right', getValue: (i) => '$' + parseFloat(i.amount || 0).toFixed(2), color: '#ea580c' }
    ], true);

    // Custom Items section
    drawSection('Additional Items', customItems, [
      { header: 'Description', width: 280, getValue: (i) => i.description || '' },
      { header: 'Qty', width: 60, align: 'right', getValue: (i) => parseFloat(i.quantity || 0).toFixed(1) },
      { header: 'Rate', width: 80, align: 'right', getValue: (i) => '$' + parseFloat(i.rate || 0).toFixed(2) },
      { header: 'Amount', width: 90, align: 'right', getValue: (i) => '$' + parseFloat(i.amount || 0).toFixed(2) }
    ]);

    // Check if we need a new page for totals
    if (yPos > 620) {
      doc.addPage();
      yPos = 50;
    }

    // Totals box
    doc.rect(50, yPos, 512, 120).fill('#f9fafb');
    yPos += 15;

    const drawTotalRow = (label, value, isOrange = false, isBold = false) => {
      doc.fillColor(isOrange ? '#ea580c' : '#4b5563').fontSize(10).font(isBold ? 'Helvetica-Bold' : 'Helvetica')
        .text(label, 60, yPos);
      doc.fillColor(isOrange ? '#ea580c' : (isBold ? '#059669' : '#333333'))
        .text(value, 450, yPos, { align: 'right', width: 100 });
      yPos += 18;
    };

    drawTotalRow(
      `Labor (${parseFloat(invoice.total_regular_hours || 0).toFixed(1)}h reg + ${parseFloat(invoice.total_ot_hours || 0).toFixed(1)}h OT)`,
      '$' + parseFloat(invoice.total_hours_amount || 0).toFixed(2)
    );
    drawTotalRow(
      `Mileage (${parseFloat(invoice.total_miles || 0).toFixed(0)} miles)`,
      '$' + parseFloat(invoice.total_mileage_amount || 0).toFixed(2)
    );

    if (parseFloat(invoice.total_tech_material || 0) > 0) {
      drawTotalRow('Material Reimbursement', '$' + parseFloat(invoice.total_tech_material || 0).toFixed(2), true);
    }

    if (parseFloat(invoice.total_line_items_amount || 0) > 0) {
      drawTotalRow('Additional Items', '$' + parseFloat(invoice.total_line_items_amount || 0).toFixed(2));
    }

    // Divider line
    doc.strokeColor('#d1d5db').lineWidth(2).moveTo(60, yPos).lineTo(550, yPos).stroke();
    yPos += 10;

    // Grand total
    doc.fillColor('#333333').fontSize(16).font('Helvetica-Bold').text('TOTAL DUE', 60, yPos);
    doc.fillColor('#059669').text('$' + parseFloat(invoice.grand_total || 0).toFixed(2), 450, yPos, { align: 'right', width: 100 });

    // Finalize PDF
    doc.end();

    // Wait for PDF to be generated
    const pdfBuffer = await new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // Return PDF as downloadable file
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF: ' + error.message }, { status: 500 });
  }
}
