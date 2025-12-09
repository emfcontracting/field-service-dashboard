// app/api/carrier-lookup/route.js
import { NextResponse } from 'next/server';

// Map carrier names from NumVerify to our internal carrier codes
const CARRIER_MAPPING = {
  // AT&T variations
  'at&t': 'att',
  'at&t mobility': 'att',
  'at&t wireless': 'att',
  'att': 'att',
  'cingular': 'att',
  
  // Verizon variations
  'verizon': 'verizon',
  'verizon wireless': 'verizon',
  
  // T-Mobile variations
  't-mobile': 'tmobile',
  't-mobile usa': 'tmobile',
  'tmobile': 'tmobile',
  
  // Sprint (now T-Mobile)
  'sprint': 'sprint',
  'sprint pcs': 'sprint',
  'sprint wireless': 'sprint',
  
  // Boost Mobile
  'boost': 'boost',
  'boost mobile': 'boost',
  
  // Cricket
  'cricket': 'cricket',
  'cricket wireless': 'cricket',
  'cricket communications': 'cricket',
  
  // Metro PCS
  'metro': 'metro',
  'metro pcs': 'metro',
  'metropcs': 'metro',
  
  // US Cellular
  'us cellular': 'uscellular',
  'u.s. cellular': 'uscellular',
  'united states cellular': 'uscellular',
  
  // Google Fi
  'google fi': 'googlefi',
  'fi': 'googlefi',
  
  // Straight Talk
  'straight talk': 'straight_talk',
  'straighttalk': 'straight_talk',
  'tracfone': 'straight_talk',
  
  // Aerial Communications
  'aerial': 'aerial',
  'aerial communications': 'aerial',
  'voicestream': 'aerial',
  
  // Virgin Mobile
  'virgin': 'virgin',
  'virgin mobile': 'virgin',
  
  // Republic Wireless
  'republic': 'republic',
  'republic wireless': 'republic',
  
  // BellSouth
  'bellsouth': 'bellsouth',
};

// Format phone number to digits only
function formatPhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  // Handle 11-digit numbers starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  if (digits.length === 10) {
    return digits;
  }
  return null;
}

// Find matching carrier code from carrier name
function findCarrierCode(carrierName) {
  if (!carrierName) return null;
  
  const normalized = carrierName.toLowerCase().trim();
  
  // Direct match
  if (CARRIER_MAPPING[normalized]) {
    return CARRIER_MAPPING[normalized];
  }
  
  // Partial match
  for (const [key, value] of Object.entries(CARRIER_MAPPING)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  return null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get('phone');
  
  if (!phone) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
  }
  
  const formattedPhone = formatPhone(phone);
  if (!formattedPhone) {
    return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
  }
  
  const apiKey = process.env.NUMVERIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ 
      error: 'Carrier lookup not configured. Add NUMVERIFY_API_KEY to environment variables.',
      setup_url: 'https://numverify.com/'
    }, { status: 500 });
  }
  
  try {
    // NumVerify API call
    const response = await fetch(
      `http://apilayer.net/api/validate?access_key=${apiKey}&number=1${formattedPhone}&country_code=US&format=1`
    );
    
    const data = await response.json();
    
    if (!data.valid) {
      return NextResponse.json({ 
        error: 'Invalid phone number',
        details: data
      }, { status: 400 });
    }
    
    const carrierName = data.carrier || '';
    const carrierCode = findCarrierCode(carrierName);
    
    return NextResponse.json({
      success: true,
      phone: formattedPhone,
      formatted: `(${formattedPhone.slice(0,3)}) ${formattedPhone.slice(3,6)}-${formattedPhone.slice(6)}`,
      carrier_name: carrierName,
      carrier_code: carrierCode,
      line_type: data.line_type,
      location: data.location,
      country: data.country_name,
      valid: data.valid
    });
    
  } catch (error) {
    console.error('Carrier lookup error:', error);
    return NextResponse.json({ 
      error: 'Carrier lookup failed',
      details: error.message 
    }, { status: 500 });
  }
}
