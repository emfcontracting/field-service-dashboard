// app/api/email-import/imap/route.js
// Alternative: IMAP-based email import using App Password (simpler setup)
// Requires: EMAIL_IMPORT_USER and EMAIL_IMPORT_PASSWORD env vars
// Note: This requires npm install imap mailparser

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Note: IMAP requires additional npm packages
// Run: npm install imap mailparser
// This file is a placeholder for IMAP implementation

export async function GET() {
  return Response.json({
    success: false,
    error: 'IMAP route requires additional setup. Use the main /api/email-import route with Gmail OAuth instead.'
  }, { status: 501 });
}

export async function POST() {
  return Response.json({
    success: false,
    error: 'IMAP route not implemented. Use /api/email-import with Gmail OAuth.'
  }, { status: 501 });
}
