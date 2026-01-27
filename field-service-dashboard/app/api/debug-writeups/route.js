// app/api/debug-writeups/route.js
// Debug endpoint to see PMI write-up emails in emfcbre@gmail.com inbox
import Imap from 'imap';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wo = searchParams.get('wo');

  const results = {
    timestamp: new Date().toISOString(),
    account: process.env.SMTP_USER || 'NOT SET',
    password_set: process.env.SMTP_PASSWORD ? '✓ Yes' : '✗ No',
    connection: null,
    inbox_count: 0,
    recent_emails: [],
    writeup_emails: [],
    wo_search: wo ? { searching_for: wo, found: [] } : null,
    search_terms: ['PMI', 'Write-up', 'Writeup', 'Informe'],
    error: null
  };

  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    results.error = 'SMTP credentials not configured';
    return Response.json(results);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      results.error = 'Connection timed out after 15 seconds';
      resolve(Response.json(results));
    }, 15000);

    const imap = new Imap({
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 10000
    });

    function cleanup() {
      clearTimeout(timeout);
      try { imap.end(); } catch (e) {}
    }

    imap.once('ready', () => {
      results.connection = '✓ Connected';

      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          results.error = 'Failed to open inbox: ' + err.message;
          cleanup();
          resolve(Response.json(results));
          return;
        }

        results.inbox_count = box.messages?.total || 0;

        const total = box.messages?.total || 0;
        if (total === 0) {
          results.error = 'Inbox is empty';
          cleanup();
          resolve(Response.json(results));
          return;
        }

        const start = Math.max(1, total - 49);
        const range = `${start}:${total}`;

        const fetch = imap.seq.fetch(range, {
          bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
          struct: false
        });

        const emails = [];

        fetch.on('message', (msg, seqno) => {
          msg.on('body', (stream) => {
            let buffer = '';
            stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
            stream.on('end', () => {
              const subjectMatch = buffer.match(/Subject:\s*(.+?)(?:\r\n|\n)/i);
              const fromMatch = buffer.match(/From:\s*(.+?)(?:\r\n|\n)/i);
              const dateMatch = buffer.match(/Date:\s*(.+?)(?:\r\n|\n)/i);

              const subject = subjectMatch ? subjectMatch[1].trim() : '(no subject)';
              const from = fromMatch ? fromMatch[1].trim() : '(unknown)';
              const date = dateMatch ? dateMatch[1].trim() : '';

              emails.push({ seqno, subject, from, date });
            });
          });
        });

        fetch.once('end', () => {
          emails.sort((a, b) => b.seqno - a.seqno);
          
          results.recent_emails = emails.slice(0, 20).map(e => ({
            subject: e.subject.substring(0, 100),
            from: e.from.substring(0, 50),
            date: e.date
          }));

          results.writeup_emails = emails.filter(e => {
            const subjectLower = e.subject.toLowerCase();
            return subjectLower.includes('pmi') || 
                   subjectLower.includes('write-up') || 
                   subjectLower.includes('writeup') ||
                   subjectLower.includes('informe');
          }).map(e => ({
            subject: e.subject,
            from: e.from,
            date: e.date
          }));

          if (wo) {
            results.wo_search.found = emails.filter(e =>
              e.subject.toUpperCase().includes(wo.toUpperCase())
            ).map(e => ({
              subject: e.subject,
              from: e.from,
              date: e.date
            }));
          }

          cleanup();
          resolve(Response.json(results));
        });

        fetch.once('error', (fetchErr) => {
          results.error = 'Fetch error: ' + fetchErr.message;
          cleanup();
          resolve(Response.json(results));
        });
      });
    });

    imap.once('error', (err) => {
      results.connection = '✗ Failed';
      results.error = 'IMAP error: ' + err.message;
      cleanup();
      resolve(Response.json(results));
    });

    try {
      imap.connect();
    } catch (e) {
      results.error = 'Connect error: ' + e.message;
      cleanup();
      resolve(Response.json(results));
    }
  });
}