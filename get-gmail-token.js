/**
 * CalibPro Gmail Token Setup
 * Run: node get-gmail-token.js
 *
 * This opens a browser window for you to authorize Gmail access,
 * then prints your GMAIL_REFRESH_TOKEN to paste into Railway.
 */

const http = require('http');
const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  CalibPro Gmail Token Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('You need to get Client ID & Secret from Google Cloud Console.');
  console.log('Opening it now...\n');

  exec('open "https://console.cloud.google.com/apis/credentials?project=carbon-garage-497308-v9"');

  console.log('Steps in the browser:');
  console.log('  1. Click "+ CREATE CREDENTIALS" → OAuth client ID');
  console.log('  2. Application type: Web application');
  console.log('  3. Name: CalibPro');
  console.log('  4. Under "Authorized redirect URIs" → Add URI:');
  console.log('     http://localhost:3333/callback');
  console.log('  5. Click CREATE → copy the Client ID and Secret\n');
  console.log('NOTE: If prompted to configure consent screen first:');
  console.log('  - User type: External → CREATE');
  console.log('  - App name: CalibPro, User support email: your Gmail');
  console.log('  - Skip the rest, Save and Continue through all steps\n');

  const clientId = await ask('Paste your Client ID: ');
  const clientSecret = await ask('Paste your Client Secret: ');

  const scope = 'https://mail.google.com/';
  const redirectUri = 'http://localhost:3333/callback';

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId.trim())}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `access_type=offline&` +
    `prompt=consent`;

  console.log('\nOpening authorization in your browser...');
  exec(`open "${authUrl}"`);

  // Local server to capture the OAuth callback
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost:3333');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (error) {
        res.end('<h2>Error: ' + error + '</h2>');
        server.close();
        reject(new Error(error));
        return;
      }
      if (code) {
        res.end('<h2 style="font-family:sans-serif;color:green">✅ Authorized! You can close this tab and go back to the terminal.</h2>');
        server.close();
        resolve(code);
      }
    });
    server.listen(3333, () => {
      console.log('Waiting for Google authorization...');
    });
    setTimeout(() => { server.close(); reject(new Error('Timeout')); }, 120000);
  });

  // Exchange code for tokens
  console.log('\nExchanging code for refresh token...');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json();

  if (tokens.error) {
    console.error('\n❌ Error:', tokens.error_description || tokens.error);
    process.exit(1);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ SUCCESS! Add these to Railway Variables:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`GMAIL_CLIENT_ID=${clientId.trim()}`);
  console.log(`GMAIL_CLIENT_SECRET=${clientSecret.trim()}`);
  console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('\nGMAIL_USER and EMAIL_RECIPIENT are already set in Railway.');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  rl.close();
}

main().catch(e => { console.error(e.message); process.exit(1); });
