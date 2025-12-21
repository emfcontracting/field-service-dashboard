import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OAuthClient from 'intuit-oauth';

// Lazy initialization to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function refreshToken(oauthClient, refreshToken) {
  const authResponse = await oauthClient.refreshUsingToken(refreshToken);
  const token = authResponse.getJson();

  await getSupabase()
    .from('quickbooks_settings')
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString()
    })
    .eq('is_active', true);

  return token.access_token;
}

export async function POST(request) {
  try {
    const { invoice_id } = await request.json();
    const supabase = getSupabase();

    // Get QuickBooks settings
    const { data: qbSettings, error: qbError } = await supabase
      .from('quickbooks_settings')
      .select('*')
      .eq('is_active', true)
      .single();

    if (qbError || !qbSettings) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 });
    }

    // Get invoice data
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select(`
        *,
        work_order:work_orders(
          wo_number,
          building,
          requestor,
          lead_tech:users!lead_tech_id(first_name, last_name)
        )
      `)
      .eq('invoice_id', invoice_id)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get line items
    const { data: lineItems } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('line_item_id');

    // Initialize OAuth client
    const oauthClient = new OAuthClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
      environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI
    });

    // Check if token needs refresh
    let accessToken = qbSettings.access_token;
    if (new Date(qbSettings.token_expires_at) < new Date()) {
      accessToken = await refreshToken(oauthClient, qbSettings.refresh_token);
    }

    // Build QuickBooks invoice
    const qbInvoice = {
      CustomerRef: {
        name: invoice.work_order?.building || 'Unknown Customer'
      },
      Line: lineItems
        .filter(item => item.line_type !== 'description')
        .map(item => ({
          Description: item.description,
          Amount: item.amount,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            Qty: item.quantity,
            UnitPrice: item.unit_price
          }
        })),
      TxnDate: new Date(invoice.invoice_date).toISOString().split('T')[0],
      DueDate: new Date(invoice.due_date).toISOString().split('T')[0]
    };

    // Send to QuickBooks
    const companyID = qbSettings.realm_id;
    const url = `https://${process.env.QUICKBOOKS_ENVIRONMENT === 'production' ? 'quickbooks' : 'sandbox-quickbooks'}.api.intuit.com/v3/company/${companyID}/invoice`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(qbInvoice)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.Fault?.Error?.[0]?.Message || 'QuickBooks API error');
    }

    // Update invoice with QuickBooks ID
    await supabase
      .from('invoices')
      .update({
        quickbooks_invoice_id: result.Invoice.Id,
        quickbooks_synced_at: new Date().toISOString(),
        quickbooks_sync_error: null
      })
      .eq('invoice_id', invoice_id);

    // Update last sync time
    await supabase
      .from('quickbooks_settings')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('is_active', true);

    return NextResponse.json({ 
      success: true, 
      quickbooks_id: result.Invoice.Id 
    });

  } catch (error) {
    console.error('QuickBooks sync error:', error);

    // Save error to invoice
    if (request.invoice_id) {
      await getSupabase()
        .from('invoices')
        .update({ quickbooks_sync_error: error.message })
        .eq('invoice_id', request.invoice_id);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
