// app/api/email-sync/test/route.js
// Diagnostic endpoint to test email sync connection and find issues
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Gmail label to CBRE status mapping
const LABEL_STATUS_MAP = {
  'escalation': 'escalation',
  'quote-approval': 'quote_approved',
  'quote-rejected': 'quote_rejected',
  'quote-submitted': 'quote_submitted',
  'reassignment-of': 'reassigned',
  'invoice-rejected': 'invoice_rejected',
  'cancellation': 'cancelled',
};

// Get a fresh access token using refresh token
async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`OAuth error: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

export async function GET(request) {
  const results = {
    timestamp: new Date().toISOString(),
    credentials: {
      gmail_client_id: process.env.GMAIL_CLIENT_ID ? '✓ Set' : '✗ Missing',
      gmail_client_secret: process.env.GMAIL_CLIENT_SECRET ? '✓ Set' : '✗ Missing',
      gmail_refresh_token: process.env.GMAIL_REFRESH_TOKEN ? '✓ Set' : '✗ Missing',
    },
    oauth: null,
    labels: [],
    labelEmails: {},
    recentEmails: [],
    errors: []
  };

  // Check if credentials exist
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
    results.errors.push('Gmail OAuth credentials not fully configured');
    return Response.json(results);
  }

  try {
    // Test OAuth
    const accessToken = await getAccessToken();
    results.oauth = '✓ Connected successfully';

    // Get list of labels
    const labelsResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const labelsData = await labelsResponse.json();

    if (labelsData.error) {
      results.errors.push(`Labels error: ${labelsData.error.message}`);
    } else {
      // Filter to show relevant labels
      results.labels = (labelsData.labels || [])
        .filter(l => {
          const name = l.name.toLowerCase();
          return Object.keys(LABEL_STATUS_MAP).some(k => name.includes(k)) || 
                 name.includes('cbre') ||
                 name.includes('dispatch');
        })
        .map(l => ({ id: l.id, name: l.name, type: l.type }));
    }

    // Check each label for unread emails
    for (const labelName of Object.keys(LABEL_STATUS_MAP)) {
      const query = encodeURIComponent(`label:${labelName}`);
      
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=5`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const listData = await listResponse.json();

      results.labelEmails[labelName] = {
        total: listData.resultSizeEstimate || 0,
        messages: listData.messages?.length || 0,
        hasUnread: false
      };

      // Check for unread specifically
      const unreadQuery = encodeURIComponent(`is:unread label:${labelName}`);
      const unreadResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${unreadQuery}&maxResults=5`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const unreadData = await unreadResponse.json();
      
      results.labelEmails[labelName].unread = unreadData.messages?.length || 0;
      results.labelEmails[labelName].hasUnread = (unreadData.messages?.length || 0) > 0;
    }

    // Get 10 most recent emails to show what's being received
    const recentResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const recentData = await recentResponse.json();

    if (recentData.messages) {
      for (const msg of recentData.messages.slice(0, 10)) {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const msgData = await msgResponse.json();

        const subject = msgData.payload?.headers?.find(h => h.name === 'Subject')?.value || '(no subject)';
        const from = msgData.payload?.headers?.find(h => h.name === 'From')?.value || '(unknown)';
        const date = msgData.payload?.headers?.find(h => h.name === 'Date')?.value || '';
        
        // Get label names
        const labelNames = [];
        if (msgData.labelIds) {
          for (const labelId of msgData.labelIds) {
            const label = labelsData.labels?.find(l => l.id === labelId);
            if (label && !['INBOX', 'IMPORTANT', 'CATEGORY_UPDATES', 'CATEGORY_PROMOTIONS', 'CATEGORY_SOCIAL', 'CATEGORY_FORUMS', 'CATEGORY_PERSONAL'].includes(label.name)) {
              labelNames.push(label.name);
            }
          }
        }

        const isUnread = msgData.labelIds?.includes('UNREAD');

        results.recentEmails.push({
          id: msg.id,
          subject: subject.substring(0, 100),
          from: from.substring(0, 50),
          date,
          labels: labelNames,
          isUnread,
          // Check if matches any status label
          matchesStatusLabel: Object.keys(LABEL_STATUS_MAP).some(l => 
            labelNames.some(ln => ln.toLowerCase().includes(l))
          )
        });
      }
    }

    // Summary
    results.summary = {
      labelsConfigured: results.labels.length,
      labelsWithUnread: Object.values(results.labelEmails).filter(l => l.hasUnread).length,
      totalUnreadInLabels: Object.values(results.labelEmails).reduce((sum, l) => sum + l.unread, 0)
    };

  } catch (error) {
    results.oauth = '✗ Failed';
    results.errors.push(error.message);
  }

  return Response.json(results);
}
