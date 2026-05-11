require('dotenv').config();
const http  = require('http');
const fetch = require('node-fetch');
const fs    = require('fs');

const CLIENT_ID     = process.env.GADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GADS_CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost:8080';
const SCOPE         = 'https://www.googleapis.com/auth/adwords';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing GADS_CLIENT_ID or GADS_CLIENT_SECRET in .env');
  process.exit(1);
}

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id:     CLIENT_ID,
  redirect_uri:  REDIRECT_URI,
  response_type: 'code',
  scope:         SCOPE,
  access_type:   'offline',
  prompt:        'consent',
});

console.log('\n=== MarketIQ — Google Ads Auth ===\n');
console.log('Opening your browser. If it does not open, paste this URL:\n');
console.log(authUrl + '\n');

/* Try to open browser on Windows */
const { exec } = require('child_process');
exec(`start "" "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, 'http://localhost:8080');
  const code = url.searchParams.get('code');
  const err  = url.searchParams.get('error');

  if (err) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>Error: ${err}</h2>`);
    console.error('Authorization error:', err);
    server.close();
    return;
  }

  if (!code) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Waiting...</h2>');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h2>Authorized! You can close this tab.</h2><p>Check your terminal.</p>');
  server.close();

  console.log('Got authorization code, exchanging for tokens...\n');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();

    if (tokens.error) {
      console.error('Token error:', tokens.error_description || tokens.error);
      process.exit(1);
    }

    if (!tokens.refresh_token) {
      console.error('No refresh_token received. Try revoking access at https://myaccount.google.com/permissions and running auth.js again.');
      process.exit(1);
    }

    /* Update GADS_REFRESH_TOKEN in .env */
    let env = fs.readFileSync('.env', 'utf8');
    if (env.includes('GADS_REFRESH_TOKEN=')) {
      env = env.replace(/GADS_REFRESH_TOKEN=.*/, `GADS_REFRESH_TOKEN=${tokens.refresh_token}`);
    } else {
      env += `\nGADS_REFRESH_TOKEN=${tokens.refresh_token}`;
    }
    fs.writeFileSync('.env', env);

    console.log('Refresh token saved to .env\n');
    console.log('Now run:  node server.js');
    process.exit(0);
  } catch (e) {
    console.error('Fetch error:', e.message);
    process.exit(1);
  }
});

server.listen(8080, () => {
  console.log('Waiting for Google callback on http://localhost:8080 ...\n');
});
