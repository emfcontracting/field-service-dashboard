import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Force Node.js runtime
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

    // Create PDF with pdf-lib
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    
    // Colors
    const darkGray = rgb(0.12, 0.16, 0.22); // #1f2937
    const white = rgb(1, 1, 1);
    const lightGray = rgb(0.42, 0.45, 0.49); // #6b7280
    const textGray = rgb(0.29, 0.33, 0.39); // #4b5563
    const green = rgb(0.02, 0.59, 0.40); // #059669
    const orange = rgb(0.92, 0.34, 0.05); // #ea580c

    // Header background
    page.drawRectangle({
      x: 0,
      y: height - 100,
      width: width,
      height: 100,
      color: darkGray,
    });

    // Header text
    page.drawText('INVOICE', {
      x: 50,
      y: height - 45,
      size: 28,
      font: helveticaBold,
      color: white,
    });

    page.drawText(invoice.invoice_number, {
      x: 50,
      y: height - 70,
      size: 12,
      font: helvetica,
      color: rgb(0.61, 0.64, 0.69),
    });

    // Period (right side)
    page.drawText('Period', {
      x: width - 150,
      y: height - 40,
      size: 10,
      font: helvetica,
      color: rgb(0.61, 0.64, 0.69),
    });

    page.drawText(`${formatDateLocal(invoice.period_start)} - ${formatDateLocal(invoice.period_end)}`, {
      x: width - 200,
      y: height - 55,
      size: 11,
      font: helvetica,
      color: white,
    });

    let yPos = height - 130;

    // FROM section
    page.drawText('FROM', {
      x: 50,
      y: yPos,
      size: 9,
      font: helveticaBold,
      color: lightGray,
    });

    yPos -= 15;
    page.drawText(businessName, {
      x: 50,
      y: yPos,
      size: 12,
      font: helveticaBold,
      color: textGray,
    });

    if (businessAddress) {
      yPos -= 14;
      // Split address into lines
      const addressLines = businessAddress.split('\n');
      for (const line of addressLines) {
        page.drawText(line.substring(0, 50), {
          x: 50,
          y: yPos,
          size: 10,
          font: helvetica,
          color: textGray,
        });
        yPos -= 12;
      }
    }

    page.drawText(userEmail, {
      x: 50,
      y: yPos,
      size: 10,
      font: helvetica,
      color: textGray,
    });

    // TO section
    let toY = height - 130;
    page.drawText('TO', {
      x: 350,
      y: toY,
      size: 9,
      font: helveticaBold,
      color: lightGray,
    });

    toY -= 15;
    page.drawText('EMF Contracting LLC', {
      x: 350,
      y: toY,
      size: 12,
      font: helveticaBold,
      color: textGray,
    });

    toY -= 14;
    page.drawText('565 Pine Plain Rd', {
      x: 350,
      y: toY,
      size: 10,
      font: helvetica,
      color: textGray,
    });

    toY -= 12;
    page.drawText('Gaston, SC 29075', {
      x: 350,
      y: toY,
      size: 10,
      font: helvetica,
      color: textGray,
    });

    toY -= 14;
    page.drawText('emfcontractingsc2@gmail.com', {
      x: 350,
      y: toY,
      size: 10,
      font: helvetica,
      color: textGray,
    });

    // Rates box
    yPos = Math.min(yPos, toY) - 30;
    page.drawRectangle({
      x: 50,
      y: yPos - 25,
      width: width - 100,
      height: 30,
      color: rgb(0.95, 0.96, 0.96),
    });

    page.drawText(
      `Rates: $${parseFloat(invoice.hourly_rate_used || 0).toFixed(2)}/hr regular | $${parseFloat(invoice.ot_rate_used || 0).toFixed(2)}/hr OT | $${parseFloat(invoice.mileage_rate_used || 0).toFixed(4)}/mile`,
      {
        x: 60,
        y: yPos - 15,
        size: 10,
        font: helvetica,
        color: textGray,
      }
    );

    yPos -= 50;

    // Helper to draw section
    function drawSection(title, items, columns, isOrange = false) {
      if (items.length === 0) return;

      // Check if we need a new page
      if (yPos < 150) {
        page = pdfDoc.addPage([612, 792]);
        yPos = height - 50;
      }

      // Section title
      page.drawText(title, {
        x: 50,
        y: yPos,
        size: 11,
        font: helveticaBold,
        color: isOrange ? orange : textGray,
      });

      yPos -= 5;
      page.drawLine({
        start: { x: 50, y: yPos },
        end: { x: width - 50, y: yPos },
        thickness: 1,
        color: rgb(0.9, 0.91, 0.92),
      });

      yPos -= 18;

      // Column headers
      let xPos = 50;
      for (const col of columns) {
        page.drawText(col.header, {
          x: xPos,
          y: yPos,
          size: 9,
          font: helvetica,
          color: lightGray,
        });
        xPos += col.width;
      }

      yPos -= 16;

      // Rows
      for (const item of items) {
        if (yPos < 100) {
          page = pdfDoc.addPage([612, 792]);
          yPos = height - 50;
        }

        xPos = 50;
        for (const col of columns) {
          const value = col.getValue(item);
          page.drawText(value.substring(0, 40), {
            x: xPos,
            y: yPos,
            size: 9,
            font: col.bold ? helveticaBold : helvetica,
            color: col.color || textGray,
          });
          xPos += col.width;
        }
        yPos -= 14;
      }

      yPos -= 10;
    }

    // Labor section
    drawSection('Labor', hoursItems, [
      { header: 'Date', width: 80, getValue: (i) => i.work_date ? formatDateLocal(i.work_date) : '-' },
      { header: 'Description', width: 220, getValue: (i) => (i.description || '').substring(0, 35) },
      { header: 'Hours', width: 60, getValue: (i) => parseFloat(i.quantity || 0).toFixed(1) },
      { header: 'Rate', width: 70, getValue: (i) => '$' + parseFloat(i.rate || 0).toFixed(2) },
      { header: 'Amount', width: 80, getValue: (i) => '$' + parseFloat(i.amount || 0).toFixed(2), bold: true }
    ]);

    // Mileage section
    drawSection('Mileage', mileageItems, [
      { header: 'Date', width: 80, getValue: (i) => i.work_date ? formatDateLocal(i.work_date) : '-' },
      { header: 'Description', width: 220, getValue: (i) => i.description || 'Mileage' },
      { header: 'Miles', width: 60, getValue: (i) => parseFloat(i.quantity || 0).toFixed(0) },
      { header: 'Rate', width: 70, getValue: (i) => '$' + parseFloat(i.rate || 0).toFixed(4) },
      { header: 'Amount', width: 80, getValue: (i) => '$' + parseFloat(i.amount || 0).toFixed(2), bold: true }
    ]);

    // Material Reimbursement section
    drawSection('Material Reimbursement', materialItems, [
      { header: 'Date', width: 100, getValue: (i) => i.work_date ? formatDateLocal(i.work_date) : '-' },
      { header: 'Description', width: 310, getValue: (i) => i.description || '' },
      { header: 'Amount', width: 100, getValue: (i) => '$' + parseFloat(i.amount || 0).toFixed(2), bold: true, color: orange }
    ], true);

    // Custom Items section
    drawSection('Additional Items', customItems, [
      { header: 'Description', width: 280, getValue: (i) => i.description || '' },
      { header: 'Qty', width: 60, getValue: (i) => parseFloat(i.quantity || 0).toFixed(1) },
      { header: 'Rate', width: 80, getValue: (i) => '$' + parseFloat(i.rate || 0).toFixed(2) },
      { header: 'Amount', width: 90, getValue: (i) => '$' + parseFloat(i.amount || 0).toFixed(2), bold: true }
    ]);

    // Check if we need a new page for totals
    if (yPos < 180) {
      page = pdfDoc.addPage([612, 792]);
      yPos = height - 50;
    }

    // Totals box
    yPos -= 10;
    page.drawRectangle({
      x: 50,
      y: yPos - 120,
      width: width - 100,
      height: 130,
      color: rgb(0.98, 0.98, 0.98),
    });

    yPos -= 20;

    // Total rows
    const drawTotalRow = (label, value, isOrangeRow = false) => {
      page.drawText(label, {
        x: 60,
        y: yPos,
        size: 10,
        font: helvetica,
        color: isOrangeRow ? orange : textGray,
      });
      page.drawText(value, {
        x: width - 110,
        y: yPos,
        size: 10,
        font: helvetica,
        color: isOrangeRow ? orange : textGray,
      });
      yPos -= 16;
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
    yPos -= 5;
    page.drawLine({
      start: { x: 60, y: yPos },
      end: { x: width - 60, y: yPos },
      thickness: 2,
      color: rgb(0.82, 0.83, 0.86),
    });

    yPos -= 20;

    // Grand total
    page.drawText('TOTAL DUE', {
      x: 60,
      y: yPos,
      size: 16,
      font: helveticaBold,
      color: textGray,
    });

    page.drawText('$' + parseFloat(invoice.grand_total || 0).toFixed(2), {
      x: width - 130,
      y: yPos,
      size: 16,
      font: helveticaBold,
      color: green,
    });

    // Generate PDF
    const pdfBytes = await pdfDoc.save();

    // Return PDF as downloadable file
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
        'Content-Length': pdfBytes.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF: ' + error.message }, { status: 500 });
  }
}
