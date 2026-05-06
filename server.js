require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => { console.log(req.method, req.path); next(); });

/* ── JSON file data store ────────────────────────────── */
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const ALLOWED = ['bark', 'mvf'];

function readData(platform) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${platform}.json`), 'utf8')); }
  catch { return []; }
}
function writeData(platform, data) {
  fs.writeFileSync(path.join(DATA_DIR, `${platform}.json`), JSON.stringify(data));
}

app.get('/api/data/:platform', (req, res) => {
  const { platform } = req.params;
  if (!ALLOWED.includes(platform)) return res.status(400).json({ error: 'Invalid platform' });
  res.json(readData(platform));
});

app.post('/api/data/:platform', (req, res) => {
  const { platform } = req.params;
  if (!ALLOWED.includes(platform)) return res.status(400).json({ error: 'Invalid platform' });
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected array' });
  try {
    writeData(platform, req.body);
    res.json({ ok: true, rows: req.body.length });
  } catch (err) {
    console.error('[Data save]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/data/:platform', (req, res) => {
  const { platform } = req.params;
  if (!ALLOWED.includes(platform)) return res.status(400).json({ error: 'Invalid platform' });
  writeData(platform, []);
  res.json({ ok: true });
});

const CUSTOMER_IDS  = (process.env.GADS_CUSTOMER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const DEVELOPER_TOKEN = process.env.GADS_DEVELOPER_TOKEN;
const GADS_BASE       = 'https://googleads.googleapis.com/v24';

const oauth = {
  clientId:     process.env.GADS_CLIENT_ID,
  clientSecret: process.env.GADS_CLIENT_SECRET,
  refreshToken: process.env.GADS_REFRESH_TOKEN,
};

let _accessToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry - 60_000) return _accessToken;
  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     oauth.clientId,
      client_secret: oauth.clientSecret,
      refresh_token: oauth.refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`OAuth: ${data.error_description || data.error}`);
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _accessToken;
}

function buildDateCondition({ days, dateFrom, dateTo }) {
  if (dateFrom && dateTo) return `segments.date BETWEEN '${dateFrom}' AND '${dateTo}'`;
  const presets = { 7: 'LAST_7_DAYS', 30: 'LAST_30_DAYS', 90: 'LAST_90_DAYS' };
  return `segments.date DURING ${presets[days] || 'LAST_30_DAYS'}`;
}

async function gaqlSearch(customerId, query, token) {
  const url     = `${GADS_BASE}/customers/${customerId}/googleAds:search`;
  let results   = [];
  let pageToken = null;

  do {
    const body = { query };
    if (pageToken) body.pageToken = pageToken;

    const res  = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization':   `Bearer ${token}`,
        'developer-token': DEVELOPER_TOKEN,
        'Content-Type':    'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(`[${customerId}] ${data.error.message}`);
    results   = results.concat(data.results || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return results;
}

/* Query one or all customer IDs */
async function gaqlAll(query, token, customerId) {
  const ids = customerId && CUSTOMER_IDS.includes(customerId) ? [customerId] : CUSTOMER_IDS;
  const all = await Promise.all(
    ids.map(id => gaqlSearch(id, query, token)
      .then(rows => rows.map(r => { r._customerId = id; return r; }))
      .catch(e => { console.error(e.message); return []; }))
  );
  return all.flat();
}

/* ── Daily insights (all accounts combined) ───────────── */
app.get('/api/gads/daily', async (req, res) => {
  try {
    const { days = '30', dateFrom, dateTo, customerId } = req.query;
    const dateCond = buildDateCondition({ days: parseInt(days), dateFrom: dateFrom || null, dateTo: dateTo || null });
    const token    = await getAccessToken();

    const query = `
      SELECT segments.date, metrics.cost_micros, metrics.impressions,
             metrics.clicks, metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE campaign.status = 'ENABLED' AND ${dateCond}
      ORDER BY segments.date ASC
    `;

    const results = await gaqlAll(query, token, customerId);

    const byDate = {};
    for (const r of results) {
      const d = r.segments.date;
      if (!byDate[d]) byDate[d] = { dateStr: d, gads_impressions: 0, gads_clicks: 0, gads_spend: 0, gads_conversions: 0, revenue: 0 };
      byDate[d].gads_impressions += parseInt(r.metrics.impressions            || 0);
      byDate[d].gads_clicks      += parseInt(r.metrics.clicks                 || 0);
      byDate[d].gads_spend       += parseInt(r.metrics.costMicros            || 0) / 1_000_000;
      byDate[d].gads_conversions += parseFloat(r.metrics.conversions      || 0);
      byDate[d].revenue          += parseFloat(r.metrics.conversionsValue || 0);
    }

    res.json(Object.values(byDate).sort((a, b) => a.dateStr.localeCompare(b.dateStr)));
  } catch (err) {
    console.error('[GAdS daily]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Campaigns (all accounts combined) ────────────────── */
app.get('/api/gads/campaigns', async (req, res) => {
  try {
    const { days = '30', dateFrom, dateTo, customerId } = req.query;
    const dateCond = buildDateCondition({ days: parseInt(days), dateFrom: dateFrom || null, dateTo: dateTo || null });
    const token    = await getAccessToken();

    const query = `
      SELECT campaign.id, campaign.name, campaign.status,
             metrics.cost_micros, metrics.impressions, metrics.clicks,
             metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE campaign.status = 'ENABLED' AND ${dateCond}
      ORDER BY metrics.cost_micros DESC
    `;

    const results = await gaqlAll(query, token, customerId);

    res.json(results.map(r => ({
      name:        r.campaign.name,
      platform:    'gads',
      customerId:  r._customerId,
      spend:       parseInt(r.metrics.costMicros            || 0) / 1_000_000,
      revenue:     parseFloat(r.metrics.conversionsValue || 0),
      impressions: parseInt(r.metrics.impressions           || 0),
      clicks:      parseInt(r.metrics.clicks                || 0),
      conv:        parseFloat(r.metrics.conversions         || 0),
      status:      r.campaign.status === 'ENABLED' ? 'active' : 'paused',
    })).sort((a, b) => b.spend - a.spend));
  } catch (err) {
    console.error('[GAdS campaigns]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Serve config.js from env vars (for hosted deployments) ── */
app.get('/config.js', (req, res) => {
  const accountId   = process.env.FB_ACCOUNT_ID   || '';
  const accessToken = process.env.FB_ACCESS_TOKEN  || '';
  res.type('application/javascript');
  res.send(`const FB_CONFIG = { accountId: '${accountId}', accessToken: '${accessToken}' };`);
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`NXG Analytics running at http://localhost:${PORT}`);
  console.log(`Accounts: ${CUSTOMER_IDS.join(', ')}`);
});
