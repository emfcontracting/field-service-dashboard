// app/api/extract-invoice/route.js
// Uses Claude AI to extract invoice data from PDFs and images

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function POST(request) {
  try {
    const { file, fileType, mimeType } = await request.json();

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    // Determine media type for Claude
    let mediaType = mimeType;
    if (fileType === 'pdf') {
      mediaType = 'application/pdf';
    } else if (!mediaType || mediaType === 'application/octet-stream') {
      mediaType = 'image/jpeg'; // Default for images
    }

    // Build the message for Claude
    const content = [
      {
        type: fileType === 'pdf' ? 'document' : 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: file
        }
      },
      {
        type: 'text',
        text: `Extract the following information from this contractor invoice:

1. Invoice Number (if visible)
2. Period/Date Range (start and end dates in YYYY-MM-DD format)
3. Total Regular Hours worked
4. Total Overtime (OT) Hours worked
5. Total Miles/Mileage
6. Total Dollar Amount

Also extract individual line items if present (date, description, regular hours, OT hours, miles, amount for each).

Respond in this exact JSON format:
{
  "invoiceNumber": "string or null",
  "periodStart": "YYYY-MM-DD or null",
  "periodEnd": "YYYY-MM-DD or null",
  "regularHours": number,
  "otHours": number,
  "miles": number,
  "total": number,
  "lineItems": [
    {
      "date": "string",
      "description": "string",
      "regularHours": number,
      "otHours": number,
      "miles": number,
      "amount": number
    }
  ],
  "rawText": "Brief summary of what you found in the invoice"
}

If you cannot find a value, use 0 for numbers and null for strings. Only respond with valid JSON, no other text.`
      }
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: content
        }
      ]
    });

    // Extract the text response
    const textResponse = response.content.find(c => c.type === 'text')?.text || '';

    // Try to parse JSON from response
    let extractedData;
    try {
      // Find JSON in response (in case there's extra text)
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textResponse);
      return Response.json({
        error: 'Failed to parse invoice data',
        rawText: textResponse.substring(0, 500)
      });
    }

    return Response.json(extractedData);

  } catch (error) {
    console.error('Extract invoice error:', error);
    return Response.json({ 
      error: error.message || 'Failed to process invoice'
    }, { status: 500 });
  }
}
