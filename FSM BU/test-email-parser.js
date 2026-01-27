// Test email parser with the actual .eml file
const fs = require('fs');
const { simpleParser } = require('mailparser');

// Read the .eml file
const emailContent = fs.readFileSync('Dispatch_of_Work_Order_C2959324_-_Priority__P2-Urgent.eml', 'utf8');

console.log('=== PARSING EMAIL ===\n');

simpleParser(emailContent, (err, parsed) => {
  if (err) {
    console.error('Parse error:', err);
    return;
  }

  console.log('Subject:', parsed.subject || '(empty)');
  console.log('From:', parsed.from?.text || '(empty)');
  console.log('Date:', parsed.date || '(empty)');
  console.log('\n=== Body Length ===');
  console.log('HTML length:', parsed.html?.length || 0);
  console.log('Text length:', parsed.text?.length || 0);
  console.log('TextAsHtml length:', parsed.textAsHtml?.length || 0);
  
  console.log('\n=== First 500 chars of body ===');
  const body = parsed.html || parsed.textAsHtml || parsed.text || '';
  console.log(body.substring(0, 500));
  
  console.log('\n=== Now testing parser function ===');
  
  // This is the parser function from your code
  function parseCBREEmail(subject, body) {
    const workOrder = {
      wo_number: '',
      building: '',
      priority: 'medium',
    };

    // Extract WO number from subject
    const woMatch = (subject || '').match(/(?:PM[\s_]+)?Work[\s_]+Order[\s_]+([A-Z]?\d+)/i);
    if (woMatch) {
      workOrder.wo_number = woMatch[1];
      console.log('✓ Found WO#:', woMatch[1]);
    } else {
      console.log('✗ Could not find WO# in subject:', subject);
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
    console.log('First 200 chars:', cleanBody.substring(0, 200));

    // Extract Building
    const buildingMatch = cleanBody.match(/Building:\s*([^<\n]+?)(?=\s*Floor|\s*Area|\s*Country|$)/i);
    if (buildingMatch) {
      workOrder.building = buildingMatch[1].trim();
      console.log('✓ Found building:', workOrder.building);
    } else {
      console.log('✗ Could not find building');
    }

    return workOrder;
  }

  const result = parseCBREEmail(parsed.subject, parsed.html || parsed.text);
  
  console.log('\n=== FINAL RESULT ===');
  console.log(JSON.stringify(result, null, 2));
});
