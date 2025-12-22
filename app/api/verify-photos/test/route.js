// app/api/verify-photos/test/route.js
// Diagnostic endpoint to test IMAP connection and search
import Imap from 'imap';

export const dynamic = 'force-dynamic';

// Simple IMAP test that lists recent emails and searches for a WO
function testImapConnection(woNumber = null) {
  return new Promise((resolve) => {
    const results = {
      success: false,
      step: 'init',
      config: {
        user: process.env.SMTP_USER || 'NOT SET',
        passwordSet: !!process.env.SMTP_PASSWORD
      },
      recentEmails: [],
      searchResults: [],
      error: null
    };

    // Timeout after 15 seconds
    const timeout = setTimeout(() => {
      results.error = 'Connection timed out after 15 seconds';
      results.step = 'timeout';
      resolve(results);
    }, 15000);

    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      clearTimeout(timeout);
      results.error = 'SMTP_USER or SMTP_PASSWORD not set';
      resolve(results);
      return;
    }

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
      results.step = 'connected';
      
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          results.step = 'mailbox_error';
          results.error = err.message;
          cleanup();
          resolve(results);
          return;
        }

        results.step = 'mailbox_opened';
        results.mailboxInfo = {
          name: box.name,
          totalMessages: box.messages?.total || 0
        };

        // First, get the 10 most recent emails to see what's there
        if (box.messages?.total > 0) {
          const start = Math.max(1, box.messages.total - 9);
          const end = box.messages.total;
          
          const fetchRecent = imap.seq.fetch(`${start}:${end}`, {
            bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
            struct: false
          });

          fetchRecent.on('message', (msg, seqno) => {
            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
              stream.on('end', () => {
                const subjectMatch = buffer.match(/Subject:\s*(.+?)(?:\r\n|\r|\n)/i);
                const fromMatch = buffer.match(/From:\s*(.+?)(?:\r\n|\r|\n)/i);
                const dateMatch = buffer.match(/Date:\s*(.+?)(?:\r\n|\r|\n)/i);
                
                results.recentEmails.push({
                  seqno,
                  subject: subjectMatch ? subjectMatch[1].trim() : '(no subject)',
                  from: fromMatch ? fromMatch[1].trim() : '(no from)',
                  date: dateMatch ? dateMatch[1].trim() : '(no date)'
                });
              });
            });
          });

          fetchRecent.once('end', () => {
            // Sort by seqno descending (most recent first)
            results.recentEmails.sort((a, b) => b.seqno - a.seqno);
            
            // Now search for specific WO if provided
            if (woNumber) {
              searchForWO(woNumber);
            } else {
              // Search for any "Photos" emails
              searchForPhotos();
            }
          });

          fetchRecent.once('error', (err) => {
            results.error = 'Fetch error: ' + err.message;
            if (woNumber) {
              searchForWO(woNumber);
            } else {
              searchForPhotos();
            }
          });
        } else {
          results.recentEmails = [];
          if (woNumber) {
            searchForWO(woNumber);
          } else {
            searchForPhotos();
          }
        }

        function searchForPhotos() {
          // Search for emails with "Photos" in subject
          imap.search([['SUBJECT', 'Photos']], (err, uids) => {
            if (err) {
              results.searchError = err.message;
            } else {
              results.photosEmailCount = uids?.length || 0;
              results.photoEmailIds = uids?.slice(-10) || [];
            }
            
            results.success = true;
            results.step = 'complete';
            cleanup();
            resolve(results);
          });
        }

        function searchForWO(wo) {
          results.searchingFor = wo;
          
          // Try multiple search strategies
          const searches = [
            { name: 'exact_wo', criteria: [['SUBJECT', wo]] },
            { name: 'photos_wo', criteria: [['SUBJECT', `Photos - ${wo}`]] },
            { name: 'fotos_wo', criteria: [['SUBJECT', `Fotos - ${wo}`]] }
          ];

          let completed = 0;
          results.searchAttempts = [];

          searches.forEach(search => {
            imap.search(search.criteria, (err, uids) => {
              results.searchAttempts.push({
                name: search.name,
                criteria: JSON.stringify(search.criteria),
                error: err?.message || null,
                found: uids?.length || 0,
                uids: uids?.slice(-5) || []
              });

              completed++;
              if (completed === searches.length) {
                // Check if any search found results
                const anyFound = results.searchAttempts.some(s => s.found > 0);
                results.photosFound = anyFound;
                
                // If found, fetch the email details
                const foundSearch = results.searchAttempts.find(s => s.found > 0);
                if (foundSearch && foundSearch.uids.length > 0) {
                  fetchMatchingEmails(foundSearch.uids);
                } else {
                  results.success = true;
                  results.step = 'complete';
                  cleanup();
                  resolve(results);
                }
              }
            });
          });
        }

        function fetchMatchingEmails(uids) {
          results.matchingEmails = [];
          
          const fetch = imap.fetch(uids, {
            bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
            struct: false
          });

          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
              stream.on('end', () => {
                const subjectMatch = buffer.match(/Subject:\s*(.+?)(?:\r\n|\r|\n)/i);
                const fromMatch = buffer.match(/From:\s*(.+?)(?:\r\n|\r|\n)/i);
                const dateMatch = buffer.match(/Date:\s*(.+?)(?:\r\n|\r|\n)/i);
                
                results.matchingEmails.push({
                  subject: subjectMatch ? subjectMatch[1].trim() : '(no subject)',
                  from: fromMatch ? fromMatch[1].trim() : '(no from)',
                  date: dateMatch ? dateMatch[1].trim() : '(no date)'
                });
              });
            });
          });

          fetch.once('end', () => {
            results.success = true;
            results.step = 'complete';
            cleanup();
            resolve(results);
          });

          fetch.once('error', (err) => {
            results.fetchError = err.message;
            results.success = true;
            results.step = 'complete';
            cleanup();
            resolve(results);
          });
        }
      });
    });

    imap.once('error', (err) => {
      results.step = 'connection_error';
      results.error = err.message;
      cleanup();
      resolve(results);
    });

    try {
      imap.connect();
    } catch (e) {
      results.step = 'connect_exception';
      results.error = e.message;
      cleanup();
      resolve(results);
    }
  });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const woNumber = searchParams.get('wo');

    console.log('=== IMAP TEST ===');
    console.log('WO Number:', woNumber || '(none - will list recent and search for Photos)');
    console.log('SMTP_USER:', process.env.SMTP_USER);
    console.log('SMTP_PASSWORD set:', !!process.env.SMTP_PASSWORD);

    const result = await testImapConnection(woNumber);

    return Response.json({
      timestamp: new Date().toISOString(),
      testWO: woNumber || null,
      ...result
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
