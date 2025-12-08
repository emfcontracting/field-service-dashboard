# Gmail Email Import Setup Guide

## Overview
The email import feature fetches CBRE dispatch emails from `wo.emfcontractingsc@gmail.com` and automatically parses them into work orders.

## Setup Options

### Option 1: Gmail OAuth (Recommended for Production)

This requires setting up Google Cloud Console credentials.

#### Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable the Gmail API:
   - Go to APIs & Services > Library
   - Search for "Gmail API"
   - Click Enable

#### Step 2: Create OAuth Credentials
1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application"
4. Add authorized redirect URI: `https://developers.google.com/oauthplayground`
5. Copy the Client ID and Client Secret

#### Step 3: Get Refresh Token
1. Go to https://developers.google.com/oauthplayground/
2. Click the gear icon (Settings) in top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In Step 1, find "Gmail API v1" and select:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
6. Click "Authorize APIs"
7. Sign in with wo.emfcontractingsc@gmail.com
8. In Step 2, click "Exchange authorization code for tokens"
9. Copy the Refresh Token

#### Step 4: Add Environment Variables
Add to `.env.local` and Vercel:

```env
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REFRESH_TOKEN=your_refresh_token_here
```

---

### Option 2: IMAP with App Password (Simpler Alternative)

If OAuth is too complex, we can implement IMAP-based email fetching.

#### Step 1: Enable IMAP in Gmail
1. Go to Gmail Settings > See all settings
2. Click "Forwarding and POP/IMAP" tab
3. Enable IMAP
4. Save changes

#### Step 2: Create App Password
1. Go to https://myaccount.google.com/apppasswords
2. (Must have 2FA enabled on the Google account)
3. Select "Mail" and "Other (Custom name)"
4. Name it "EMF Dashboard"
5. Copy the 16-character app password

#### Step 3: Add Environment Variables
```env
EMAIL_IMPORT_USER=wo.emfcontractingsc@gmail.com
EMAIL_IMPORT_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

---

## Testing

After setup:
1. Send a test CBRE-format email to wo.emfcontractingsc@gmail.com
2. Go to Dashboard > Import > Email (CBRE)
3. Click to check for new emails
4. Verify parsing is correct
5. Import the test work order

## Troubleshooting

### "Gmail API not configured"
- Check that all 3 environment variables are set
- Restart the development server after adding env vars
- In Vercel, redeploy after adding env vars

### "OAuth error: invalid_grant"
- Refresh token may have expired
- Go through OAuth Playground again to get a new refresh token

### Emails not showing up
- Make sure emails have "Dispatch of Work Order" in subject
- Only unread emails are fetched
- Check the spam folder

### Parsing issues
- The parser is designed for CBRE dispatch format
- Other email formats may need custom parsing
