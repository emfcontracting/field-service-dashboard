// app/api/email-import/debug/route.js
// Debug tool to see what IMAP actually finds
import Imap from 'imap';
import { simpleParser } from 'mailparser';

function connectIMAP() {
  const email = process.env.EMAIL_IMPORT_USER;
  const password = process.env.EMAIL_IMPORT_PASSWORD;

  if (!email || !password) {
    throw new Error('IMAP credentials not configured');
  }

  return new Imap({
    user: email,
    password: password,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });
}

// Search all recent CBRE emails
async function searchRecentCBRE(days = 7) {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();
    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        // Search for ALL emails from CBRE in last N days
        imap.search([
          ['SINCE', sinceDate],
          ['FROM', 'UPSHelp@cbre.com']
        ], (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || results.length === 0) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(results, {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
            struct: true
          });

          fetch.on('message', (msg, seqno) => {
            let emailData = { seqno };

            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.once('end', () => {
                simpleParser(buffer, (err, parsed) => {
                  if (!err) {
                    emailData.from = parsed.from?.text || '';
                    emailData.subject = parsed.subject || '';
                    emailData.date = parsed.date || new Date();
                  }
                });
              });
            });

            msg.once('attributes', (attrs) => {
              emailData.uid = attrs.uid;
              emailData.flags = attrs.flags;
              emailData.isUnread = !attrs.flags.includes('\\Seen');
            });

            msg.once('end', () => {
              emails.push(emailData);
            });
          });

          fetch.once('error', (err) => {
            imap.end();
            reject(err);
          });

          fetch.once('end', () => {
            imap.end();
            resolve(emails);
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days')) || 7;
  const woFilter = searchParams.get('wo');

  try {
    const emails = await searchRecentCBRE(days);

    // Sort by date descending
    emails.sort((a, b) => new Date(b.date) - new Date(a.date));

    let filtered = emails;
    if (woFilter) {
      filtered = emails.filter(e => 
        e.subject && e.subject.toLowerCase().includes(woFilter.toLowerCase())
      );
    }

    return Response.json({
      success: true,
      totalFound: emails.length,
      filtered: filtered.length,
      emails: filtered.map(e => ({
        subject: e.subject,
        date: e.date,
        isUnread: e.isUnread,
        flags: e.flags,
        uid: e.uid
      })),
      allEmails: woFilter ? undefined : emails.map(e => ({
        subject: e.subject,
        date: e.date,
        isUnread: e.isUnread
      }))
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
