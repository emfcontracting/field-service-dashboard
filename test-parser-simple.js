// Direct test of CBRE email parser
const subject = "Dispatch of Work Order C2959324 - Priority: P2-Urgent";
const htmlBody = `<HTML><STYLE>P {MARGIN: 0 0 0 0;}</STYLE><BODY><FONT face="Calibri">
<P><FONT face="Calibri"><STRONG></FONT></STRONG></P>
<P><FONT face="Calibri"><BR/></FONT></P>
<P><FONT face="Calibri">The CBRE-UPS SHARED SERVICE CENTER has assigned a work order for service to EMF Contracting LLC(Gaston). </FONT></P>
<P><FONT face="Calibri">The referenced work order number is C2959324</FONT></P>
<P><FONT face="Calibri"><BR/></FONT></P>
<P><FONT face="Calibri"><STRONG>Below are the details:</STRONG> </FONT></P>
<P><FONT face="Calibri">Date Entered: Jan  5 2026  2:48PM UTC-05 </FONT></P>
<P><FONT face="Calibri">Priority: P2 - Urgent </FONT></P>
<P><FONT face="Calibri">Target Response/On-Site Arrival: Jan  5 2026 10:48PM UTC-05 </FONT></P>
<P><FONT face="Calibri">Target Completion: Jan  6 2026  2:48PM UTC-05 </FONT></P>
<P><FONT face="Calibri">Order Status: D - Dispatched </FONT></P>
<P><FONT face="Calibri"><BR/></FONT></P>
<P><FONT face="Calibri Light"><STRONG>Service Location and Contact:</STRONG> </FONT></P>
<P><FONT face="Calibri Light">Address: 3400 EDMOND HWY, WEST COLUMBIA, SC, 29172,  </FONT></P>
<P><FONT face="Calibri Light">Country, St, City: US, SC, West Columbia </FONT></P>
<P><FONT face="Calibri Light">Building: SCCAE - WEST COLUMBIA AIR RAMP </FONT></P>
<P><FONT face="Calibri Light">Floor: All Floors (DECR-SMC Use Only) </FONT></P>
<P><FONT face="Calibri Light">Area: All Areas (DECR-SMC Use Only) </FONT></P>
<P><FONT face="Calibri Light">Location within Area: . </FONT></P>
<P><FONT face="Calibri Light"><BR/></FONT></P>
<P><FONT face="Calibri Light"></FONT><FONT face="Times New Roman"> </FONT></P>
<P><FONT face="Calibri Light"><STRONG>Contact Names and Phone Numbers (If Available):</STRONG></FONT></P>
<P><FONT face="Calibri Light">Work Order Requestor Name and Phone: Lindsay Keck, 971-940-6826</FONT></P>
<P><FONT face="Calibri Light">Problem Description: Faulty Outlet or Switch - 747117:> 10 outlets stop working located in the S203 and radio room </FONT></P>`;

console.log('=== TESTING PARSER WITH ACTUAL EMAIL ===\n');

// This is your actual parser function
function parseCBREEmail(subject, body) {
  const workOrder = {
    wo_number: '',
    building: '',
    priority: 'medium',
    work_order_description: '',
    requestor: ''
  };

  console.log('Subject received:', subject);
  console.log('Body length:', body?.length || 0);
  console.log('');

  // Extract WO number from subject
  const woMatch = (subject || '').match(/(?:PM[\s_]+)?Work[\s_]+Order[\s_]+([A-Z]?\d+)/i);
  if (woMatch) {
    workOrder.wo_number = woMatch[1];
    console.log('✓ Found WO#:', woMatch[1]);
  } else {
    console.log('✗ Could not find WO# in subject');
  }

  // Clean body
  const cleanBody = (body || '')
    .replace(/=\r?\n/g, '')
    .replace(/=3D/g, '=')
    .replace(/=20/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log('Clean body length:', cleanBody.length);
  console.log('First 300 chars:', cleanBody.substring(0, 300));
  console.log('');

  // Extract Building
  const buildingMatch = cleanBody.match(/Building:\s*([^<\n]+?)(?=\s*Floor|\s*Area|\s*Country|$)/i);
  if (buildingMatch) {
    workOrder.building = buildingMatch[1].trim();
    console.log('✓ Found building:', workOrder.building);
  } else {
    console.log('✗ Could not find building');
    console.log('  Searching for "Building:" in body...');
    if (cleanBody.includes('Building:')) {
      console.log('  Found "Building:" text in body');
      const context = cleanBody.substring(cleanBody.indexOf('Building:'), cleanBody.indexOf('Building:') + 100);
      console.log('  Context:', context);
    } else {
      console.log('  "Building:" not found in body at all');
    }
  }

  // Extract Priority
  const priorityMatch = cleanBody.match(/Priority[:\s_]*(P\d+)[\s\-_]*([^<\n]*)/i);
  if (priorityMatch) {
    console.log('✓ Found priority:', priorityMatch[1], priorityMatch[2] || '');
    const pNum = parseInt(priorityMatch[1].replace('P', ''));
    if (pNum === 1) workOrder.priority = 'emergency';
    else if (pNum === 2) workOrder.priority = 'high';
    else if (pNum === 3 || pNum === 4) workOrder.priority = 'medium';
    else workOrder.priority = 'low';
  }

  // Extract Description
  const descMatch = cleanBody.match(/Problem Description:\s*(.+?)(?=Assignment Name|Notes to Vendor|$)/is);
  if (descMatch) {
    workOrder.work_order_description = descMatch[1].replace(/\s+/g, ' ').trim();
    console.log('✓ Found description:', workOrder.work_order_description.substring(0, 100));
  }

  // Extract Requestor
  const requestorMatch = cleanBody.match(/Work Order Requestor Name and Phone:\s*([^,<\n]+),?\s*([\d\-\(\)\s]+)?/i);
  if (requestorMatch) {
    workOrder.requestor = requestorMatch[1].trim();
    console.log('✓ Found requestor:', workOrder.requestor);
  }

  return workOrder;
}

const result = parseCBREEmail(subject, htmlBody);

console.log('\n=== FINAL PARSED RESULT ===');
console.log(JSON.stringify(result, null, 2));
