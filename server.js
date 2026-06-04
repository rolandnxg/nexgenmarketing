const path    = require('path');
const fs      = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const fetch   = require('node-fetch');

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
      WHERE ${dateCond}
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
      WHERE ${dateCond}
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

/* ── Google Analytics 4 ─────────────────────────────────── */
const GA_PROPERTY_IDS = (process.env.GA_PROPERTY_IDS || process.env.GA_PROPERTY_ID || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const GA_BASE = 'https://analyticsdata.googleapis.com/v1beta';

const gaOauth = {
  clientId:     process.env.GADS_CLIENT_ID,
  clientSecret: process.env.GADS_CLIENT_SECRET,
  refreshToken: process.env.GA_REFRESH_TOKEN || process.env.GADS_REFRESH_TOKEN,
};

let _gaAccessToken = null;
let _gaTokenExpiry  = 0;

async function getGAAccessToken() {
  if (_gaAccessToken && Date.now() < _gaTokenExpiry - 60_000) return _gaAccessToken;
  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     gaOauth.clientId,
      client_secret: gaOauth.clientSecret,
      refresh_token: gaOauth.refreshToken,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`OAuth GA: ${data.error_description || data.error}`);
  _gaAccessToken = data.access_token;
  _gaTokenExpiry  = Date.now() + data.expires_in * 1000;
  return _gaAccessToken;
}

function gaDateRange({ days, dateFrom, dateTo }) {
  if (dateFrom && dateTo) return { startDate: dateFrom, endDate: dateTo };
  const presets = { 7: '7daysAgo', 30: '30daysAgo', 90: '90daysAgo' };
  return { startDate: presets[days] || '30daysAgo', endDate: 'today' };
}

async function gaRunReport(body, token, propertyId) {
  if (!propertyId) throw new Error('GA property ID not specified');
  const res  = await fetch(`${GA_BASE}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(`[${propertyId}] ${data.error.message}`);
  return data;
}

async function gaFetchOneProperty(propertyId, dateRange, token) {
  const [dailyData, chanData] = await Promise.all([
    gaRunReport({
      dimensions:  [{ name: 'date' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'conversions' },
      ],
      dateRanges: [dateRange],
      orderBys:   [{ dimension: { dimensionName: 'date' } }],
    }, token, propertyId),
    gaRunReport({
      dimensions:  [{ name: 'sessionDefaultChannelGroup' }],
      metrics:     [{ name: 'sessions' }],
      dateRanges:  [dateRange],
      orderBys:    [{ metric: { metricName: 'sessions' }, desc: true }],
    }, token, propertyId),
  ]);
  return { dailyData, chanData };
}

function mergeGAResults(results) {
  const byDate   = {};
  const channels = {};

  for (const { dailyData, chanData } of results) {
    for (const r of (dailyData.rows || [])) {
      const raw     = r.dimensionValues[0].value;
      const dateStr = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
      if (!byDate[dateStr]) byDate[dateStr] = { dateStr, ga_sessions: 0, ga_users: 0, ga_pageviews: 0, _bounceSum: 0, _bounceN: 0, _durSum: 0, ga_goals: 0 };
      byDate[dateStr].ga_sessions  += parseInt(r.metricValues[0].value  || 0);
      byDate[dateStr].ga_users     += parseInt(r.metricValues[1].value  || 0);
      byDate[dateStr].ga_pageviews += parseInt(r.metricValues[2].value  || 0);
      byDate[dateStr]._bounceSum   += parseFloat(r.metricValues[3].value || 0) * 100;
      byDate[dateStr]._bounceN     += 1;
      byDate[dateStr]._durSum      += parseFloat(r.metricValues[4].value || 0);
      byDate[dateStr].ga_goals     += parseFloat(r.metricValues[5].value || 0);
    }
    for (const r of (chanData.rows || [])) {
      const key = r.dimensionValues[0].value.toLowerCase();
      channels[key] = (channels[key] || 0) + parseInt(r.metricValues[0].value || 0);
    }
  }

  const daily = Object.values(byDate).map(d => ({
    dateStr:      d.dateStr,
    ga_sessions:  d.ga_sessions,
    ga_users:     d.ga_users,
    ga_pageviews: d.ga_pageviews,
    ga_bounce:    d._bounceN > 0 ? d._bounceSum / d._bounceN : 0,
    ga_duration:  d._bounceN > 0 ? d._durSum    / d._bounceN : 0,
    ga_goals:     d.ga_goals,
  })).sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  return { daily, channels };
}

app.get('/api/ga/daily', async (req, res) => {
  try {
    const { days = '30', dateFrom, dateTo, propertyId } = req.query;
    if (GA_PROPERTY_IDS.length === 0) return res.status(400).json({ error: 'GA_PROPERTY_IDS not configured' });
    const token     = await getGAAccessToken();
    const dateRange = gaDateRange({ days: parseInt(days), dateFrom: dateFrom || null, dateTo: dateTo || null });

    const ids = propertyId && GA_PROPERTY_IDS.includes(propertyId) ? [propertyId] : GA_PROPERTY_IDS;
    const results = await Promise.all(
      ids.map(id => gaFetchOneProperty(id, dateRange, token).catch(e => { console.error('[GA]', e.message); return null; }))
    );

    res.json(mergeGAResults(results.filter(Boolean)));
  } catch (err) {
    console.error('[GA daily]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ga/pages', async (req, res) => {
  try {
    const { days = '30', dateFrom, dateTo, propertyId } = req.query;
    if (GA_PROPERTY_IDS.length === 0) return res.status(400).json({ error: 'GA_PROPERTY_IDS not configured' });
    const token     = await getGAAccessToken();
    const dateRange = gaDateRange({ days: parseInt(days), dateFrom: dateFrom || null, dateTo: dateTo || null });

    const ids = propertyId && GA_PROPERTY_IDS.includes(propertyId) ? [propertyId] : GA_PROPERTY_IDS;
    const allData = await Promise.all(
      ids.map(id => gaRunReport({
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
        dateRanges: [dateRange],
        orderBys:   [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 25,
      }, token, id).catch(e => { console.error('[GA pages]', e.message); return null; }))
    );

    const byPath = {};
    for (const data of allData.filter(Boolean)) {
      for (const r of (data.rows || [])) {
        const page = r.dimensionValues[0].value;
        if (!byPath[page]) byPath[page] = { page, title: r.dimensionValues[1].value, pv: 0, sessions: 0, _bounceSum: 0, _bounceN: 0, _durSum: 0 };
        byPath[page].pv         += parseInt(r.metricValues[0].value  || 0);
        byPath[page].sessions   += parseInt(r.metricValues[1].value  || 0);
        byPath[page]._bounceSum += parseFloat(r.metricValues[2].value || 0) * 100;
        byPath[page]._bounceN   += 1;
        byPath[page]._durSum    += parseFloat(r.metricValues[3].value || 0);
      }
    }

    const pages = Object.values(byPath)
      .sort((a, b) => b.pv - a.pv)
      .slice(0, 25)
      .map(p => {
        const dur = p._bounceN > 0 ? p._durSum / p._bounceN : 0;
        const m   = Math.floor(dur / 60);
        const sc  = Math.round(dur % 60);
        return {
          page:     p.page,
          title:    p.title,
          pv:       p.pv,
          sessions: p.sessions,
          bounce:   (p._bounceN > 0 ? p._bounceSum / p._bounceN : 0).toFixed(1) + '%',
          dur:      `${m}m ${sc < 10 ? '0' + sc : sc}s`,
        };
      });

    res.json(pages);
  } catch (err) {
    console.error('[GA pages]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Google OAuth setup flow (GA + GAdS combined) ────────── */
const GOOGLE_OAUTH_REDIRECT = process.env.GOOGLE_OAUTH_REDIRECT ||
  `http://localhost:${process.env.PORT || 3000}/auth/google/callback`;

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/adwords',
].join(' ');

app.get('/auth/google', (req, res) => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id',     gaOauth.clientId);
  url.searchParams.set('redirect_uri',  GOOGLE_OAUTH_REDIRECT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope',         GOOGLE_SCOPES);
  url.searchParams.set('access_type',   'offline');
  url.searchParams.set('prompt',        'consent');
  res.redirect(url.toString());
});

/* Keep old /auth/ga path working as an alias */
app.get('/auth/ga', (req, res) => res.redirect('/auth/google'));

app.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send(`<h2>Auth error: ${error}</h2>`);
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     gaOauth.clientId,
        client_secret: gaOauth.clientSecret,
        redirect_uri:  GOOGLE_OAUTH_REDIRECT,
        grant_type:    'authorization_code',
      }),
    });
    const data = await resp.json();
    if (data.error) return res.send(`<h2>Token error: ${data.error_description || data.error}</h2>`);

    const token = data.refresh_token;

    /* Update .env if it exists (local dev only — Railway uses env vars) */
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      const setEnvVar = (content, key, val) =>
        content.includes(`${key}=`)
          ? content.replace(new RegExp(`${key}=.*`), `${key}=${val}`)
          : content + `\n${key}=${val}`;
      envContent = setEnvVar(envContent, 'GADS_REFRESH_TOKEN', token);
      envContent = setEnvVar(envContent, 'GA_REFRESH_TOKEN',   token);
      fs.writeFileSync(envPath, envContent);
    }

    /* Update in-memory — both services share the same token */
    oauth.refreshToken    = token;
    gaOauth.refreshToken  = token;
    _accessToken          = data.access_token;
    _tokenExpiry          = Date.now() + (data.expires_in || 3600) * 1000;
    _gaAccessToken        = data.access_token;
    _gaTokenExpiry        = Date.now() + (data.expires_in || 3600) * 1000;

    res.send(`
      <h2 style="font-family:sans-serif;color:green">✓ Google connected (GA + GAdS)!</h2>
      <p>Refresh token saved. Copy the token below and update your Railway variables:</p>
      <pre style="background:#f4f4f4;padding:12px;word-break:break-all">${token}</pre>
      <p style="font-family:sans-serif;font-size:13px;color:#555">
        Set both <strong>GADS_REFRESH_TOKEN</strong> and <strong>GA_REFRESH_TOKEN</strong>
        in Railway to this value, then redeploy.
      </p>
    `);
  } catch (err) {
    res.send(`<h2>Error: ${err.message}</h2>`);
  }
});

/* Keep old callback path working */
app.get('/auth/ga/callback', (req, res) => {
  res.redirect('/auth/google/callback?' + new URLSearchParams(req.query));
});

/* ── Serve config.js from env vars (for hosted deployments) ── */
app.get('/config.js', (req, res) => {
  const accountId   = process.env.FB_ACCOUNT_ID   || '';
  const accessToken = process.env.FB_ACCESS_TOKEN  || '';
  res.type('application/javascript');
  res.send(`const FB_CONFIG = { accountId: '${accountId}', accessToken: '${accessToken}' };`);
});

app.use(express.static(__dirname));

/* ── AI Chat ─────────────────────────────────────────────── */
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { message, history = [], context = {} } = req.body;
    if (!message || typeof message !== 'string' || message.length > 2000)
      return res.status(400).json({ error: 'Invalid message' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI not configured — set OPENAI_API_KEY' });

    const contextLines = [
      context.platform  ? `The user is currently viewing the ${context.platform} section of the dashboard.` : '',
      context.dateRange ? `Selected date range: ${context.dateRange}.` : '',
      context.kpis      ? `Visible KPI metrics: ${context.kpis}.` : '',
    ].filter(Boolean).join('\n');

    const system = `You are an AI analytics assistant embedded in the NXG Marketing Analytics Portal.
You help marketing teams understand performance across Google Ads, Facebook Ads, and Google Analytics 4.
${contextLines}
Be concise and practical. Reference specific numbers when provided. Use light markdown (bold, bullet points, short paragraphs). Keep responses under 300 words unless more detail is explicitly requested. Do not make up data you have not been given.`;

    const messages = [
      { role: 'system', content: system },
      ...(history || []).slice(-10),
      { role: 'user', content: message },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:      'gpt-4o-mini',
        max_tokens: 1024,
        messages,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'OpenAI error');

    const answer = data.choices?.[0]?.message?.content || '';
    res.json({ answer });
  } catch (err) {
    console.error('[AI Chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`NXG Analytics running at http://localhost:${PORT}`);
  console.log(`Accounts: ${CUSTOMER_IDS.join(', ')}`);
});
