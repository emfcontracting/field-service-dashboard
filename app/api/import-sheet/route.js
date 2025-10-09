import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return Response.json({ 
        success: false, 
        message: 'Google API key not configured' 
      }, { status: 500 });
    }

    // Fetch directly from Google Sheets using REST API
    const sheetId = '1sm7HjR4PdZLCNbaCQkswktGKEZX61fiVdTUaA5Rg6IE';
    const range = 'A:Z';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.text();
      return Response.json({ 
        success: false, 
        message: 'Failed to fetch from Google Sheets: ' + error 
      }, { status: 500 });
    }

    const data = await response.json();
    const rows = data.values;
    
    if (!rows || rows.length === 0) {
      return Response.json({ success: false, message: 'No data found in sheet' });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of dataRows) {
      try {
        const rowData = {};
        headers.forEach((header, i) => {
          rowData[header] = row[i] || null;
        });

        const woNumber = rowData['WO#'];
        if (!woNumber) {
          skipped++;
          continue;
        }

        // Check if already exists
        const { data: existing } = await supabase
          .from('work_orders')
          .select('wo_id')
          .eq('wo_number', woNumber)
          .single();

        if (existing) {
          skipped++;
          continue;
        }

        // Map and transform data
        const workOrder = {
          wo_number: woNumber,
          building: rowData['Building'] || null,
          priority: mapPriority(rowData['Priority']),
          date_entered: parseDate(rowData['Date entered']),
          work_order_description: rowData['Work Order Description'] || 'No description',
          nte: parseDecimal(rowData['NTE']),
          requestor: rowData['CONTACT'] || null,
          status: mapStatus(rowData['Status']),
          comments: rowData['COMMENTS'] || null,
        };

        // Insert work order
        const { error: woError } = await supabase
          .from('work_orders')
          .insert(workOrder);

        if (woError) {
          console.error('Error importing:', woNumber, woError);
          errors++;
          continue;
        }

        imported++;
      } catch (error) {
        console.error('Error processing row:', error);
        errors++;
      }
    }

    return Response.json({ 
      success: true, 
      imported, 
      skipped, 
      errors,
      message: `Import complete! Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors}`
    });

  } catch (error) {
    console.error('Import failed:', error);
    return Response.json({ 
      success: false, 
      message: 'Import failed: ' + error.message 
    }, { status: 500 });
  }
}

// Helper functions
function mapPriority(priority) {
  if (!priority) return 'medium';
  const p = priority.toLowerCase();
  if (p.includes('p1') || p.includes('emerg')) return 'emergency';
  if (p.includes('p2') || p.includes('urgent')) return 'high';
  if (p.includes('p3')) return 'medium';
  return 'medium';
}

function mapStatus(status) {
  if (!status) return 'pending';
  const s = status.toLowerCase();
  if (s.includes('open')) return 'pending';
  if (s.includes('quoted')) return 'assigned';
  if (s.includes('complet')) return 'completed';
  if (s.includes('progress')) return 'in_progress';
  return 'pending';
}

function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function parseDecimal(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/[$,]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}