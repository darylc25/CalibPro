const { google } = require('googleapis');

function createGmailClient() {
  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail OAuth2 not configured');
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3333/callback');
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

function buildRaw({ from, to, subject, html }) {
  const lines = [
    `From: ${from}`,
    `To: ${Array.isArray(to) ? to.join(', ') : to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    html,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

async function sendMail({ to, subject, html }) {
  const gmailUser = process.env.GMAIL_USER;
  if (!gmailUser) throw new Error('GMAIL_USER not set');
  const gmail = createGmailClient();
  const raw = buildRaw({ from: `Diatec Tech & Support <${gmailUser}>`, to, subject, html });
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}

module.exports = { sendMail };
