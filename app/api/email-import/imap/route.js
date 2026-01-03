// app/api/email-import/imap/route.js
// IMAP diagnostic tool - lists all folders and checks Dispatch folder contents
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

// List all IMAP folders
async function listFolders() {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();

    imap.once('ready', () => {
      imap.getBoxes((err, boxes) => {
        imap.end();
        if (err) return reject(err);
        resolve(boxes);
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

// Get folder status
async function getFolderStatus(folderName) {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();

    imap.once('ready', () => {
      imap.openBox(folderName, true, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        const status = {
          folderName,
          totalMessages: box.messages.total,
          newMessages: box.messages.new,
          unseenMessages: box.messages.unseen,
          flags: box.flags,
          permFlags: box.permFlags
        };

        imap.end();
        resolve(status);
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

// Search for emails in a folder
async function searchFolder(folderName, searchCriteria = ['ALL']) {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();
    const emails = [];

    imap.once('ready', () => {
      imap.openBox(folderName, true, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        imap.search(searchCriteria, (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || results.length === 0) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(results.slice(0, 10), {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
            struct: true
          });

          fetch.on('message', (msg, seqno) => {
            let headers = {};

            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.once('end', () => {
                simpleParser(buffer, (err, parsed) => {
                  if (!err) {
                    headers = {
                      from: parsed.from?.text || '',
                      to: parsed.to?.text || '',
                      subject: parsed.subject || '',
                      date: parsed.date || new Date()
                    };
                  }
                });
              });
            });

            msg.once('attributes', (attrs) => {
              emails.push({
                seqno,
                uid: attrs.uid,
                flags: attrs.flags,
                ...headers
              });
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

// Format box tree for display
function formatBoxTree(boxes, indent = 0) {
  let result = [];
  for (const [name, box] of Object.entries(boxes)) {
    const prefix = '  '.repeat(indent);
    const delimiter = box.delimiter || '/';
    const attribs = box.attribs || [];
    result.push(`${prefix}${name} ${attribs.length > 0 ? `[${attribs.join(', ')}]` : ''}`);
    
    if (box.children) {
      result = result.concat(formatBoxTree(box.children, indent + 1));
    }
  }
  return result;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'folders';
  const folder = searchParams.get('folder') || 'INBOX';
  const search = searchParams.get('search') || 'UNSEEN';

  try {
    if (action === 'folders') {
      // List all folders
      const boxes = await listFolders();
      const formatted = formatBoxTree(boxes);
      
      return Response.json({
        success: true,
        message: 'IMAP folders retrieved',
        folders: formatted,
        raw: boxes
      });
    }

    if (action === 'status') {
      // Get folder status
      const status = await getFolderStatus(folder);
      
      return Response.json({
        success: true,
        ...status
      });
    }

    if (action === 'search') {
      // Search folder
      let searchCriteria;
      if (search === 'UNSEEN') {
        searchCriteria = ['UNSEEN'];
      } else if (search === 'ALL') {
        searchCriteria = ['ALL'];
      } else if (search === 'RECENT') {
        searchCriteria = ['RECENT'];
      } else {
        // Parse as JSON array
        try {
          searchCriteria = JSON.parse(search);
        } catch {
          searchCriteria = [search];
        }
      }

      const emails = await searchFolder(folder, searchCriteria);
      
      return Response.json({
        success: true,
        folder,
        searchCriteria,
        count: emails.length,
        emails: emails.slice(0, 20)
      });
    }

    // Default: comprehensive diagnostic
    const inboxStatus = await getFolderStatus('INBOX');
    const dispatchStatus = await getFolderStatus('Dispatch').catch(e => ({ error: e.message }));
    const unseenInbox = await searchFolder('INBOX', ['UNSEEN']);
    const unseenDispatch = await searchFolder('Dispatch', ['UNSEEN']).catch(() => []);

    return Response.json({
      success: true,
      diagnostic: {
        inbox: {
          status: inboxStatus,
          unseenCount: unseenInbox.length,
          recentUnseen: unseenInbox.slice(0, 5).map(e => ({
            subject: e.subject,
            from: e.from,
            flags: e.flags
          }))
        },
        dispatch: {
          status: dispatchStatus,
          unseenCount: unseenDispatch.length,
          recentUnseen: unseenDispatch.slice(0, 5).map(e => ({
            subject: e.subject,
            from: e.from,
            flags: e.flags
          }))
        }
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
