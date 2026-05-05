require('dotenv').config();
const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

const GADS = {
  customerId:    process.env.GADS_CUSTOMER_ID,
  developerToken: process.env.GADS_DEVELOPER_TOKEN,
  clientId:      process.env.GADS_CLIENT_ID,
  clientSecret:  process.env.GADS_CLIENT_SECRET,
  refreshToken:  process.env.GADS_REFRESH_TOKEN,
};

const GADS_BASE = 'https://googleads.googleapis.com/v17';

let _accessToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry - 60_000) return _accessToken;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     GADS.clientId,
      client_secret: GADS.clientSecret,
      refresh_token: GADS.refreshToken,
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
  if (dateFrom && dateTo) {
    return `segments.date BETWEEN '${dateFrom}' AND '${dateTo}'`;
  }
  const presets = { 7: 'LAST_7_DAYS', 30: 'LAST_30_DAYS', 90: 'LAST_90_DAYS' };
  return `segments.date DURING ${presets[days] || 'LAST_30_DAYS'}`;
}

async function gaqlSearch(query) {
  const token = await getAccessToken();
  const url   = `${GADS_BASE}/customers/${GADS.customerId}/googleAds:search`;

  let results   = [];
  let pageToken = null;

  do {
    const body = { query };
    if (pageToken) body.pageToken = pageToken;

    const res  = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization':   `Bearer ${token}`,
        'developer-token': GADS.developerToken,
        'Content-Type':    'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    results   = results.concat(data.results || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return results;
}

/* ── Daily account-level insights ─────────────────────── */
app.get('/api/gads/daily', async (req, res) => {
  try {
    const { days = '30', dateFrom, dateTo } = req.query;
    const dateCondition = buildDateCondition({
      days: parseInt(days),
      dateFrom: dateFrom || null,
      dateTo:   dateTo   || null,
    });

    const query = `
      SELECT
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.all_conversions_value
      FROM campaign
      WHERE campaign.status != 'REMOVED'
        AND ${dateCondition}
      ORDER BY segments.date ASC
    `;

    const results = await gaqlSearch(query);

    /* Aggregate all campaigns into one row per day */
    const byDate = {};
    for (const r of results) {
      const date = r.segments.date;
      if (!byDate[date]) {
        byDate[date] = { dateStr: date, gads_impressions: 0, gads_clicks: 0, gads_spend: 0, gads_conversions: 0, revenue: 0 };
      }
      byDate[date].gads_impressions += parseInt(r.metrics.impressions       || 0);
      byDate[date].gads_clicks      += parseInt(r.metrics.clicks             || 0);
      byDate[date].gads_spend       += parseInt(r.metrics.costMicros        || 0) / 1_000_000;
      byDate[date].gads_conversions += parseFloat(r.metrics.conversions     || 0);
      byDate[date].revenue          += parseFloat(r.metrics.allConversionsValue || 0);
    }

    const data = Object.values(byDate).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    res.json(data);
  } catch (err) {
    console.error('[GAdS daily]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── Campaign-level insights ───────────────────────────── */
app.get('/api/gads/campaigns', async (req, res) => {
  try {
    const { days = '30', dateFrom, dateTo } = req.query;
    const dateCondition = buildDateCondition({
      days: parseInt(days),
      dateFrom: dateFrom || null,
      dateTo:   dateTo   || null,
    });

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.all_conversions_value
      FROM campaign
      WHERE campaign.status != 'REMOVED'
        AND ${dateCondition}
      ORDER BY metrics.cost_micros DESC
    `;

    const results = await gaqlSearch(query);

    const data = results.map(r => ({
      name:        r.campaign.name,
      platform:    'gads',
      spend:       parseInt(r.metrics.costMicros        || 0) / 1_000_000,
      revenue:     parseFloat(r.metrics.allConversionsValue || 0),
      impressions: parseInt(r.metrics.impressions       || 0),
      clicks:      parseInt(r.metrics.clicks             || 0),
      conv:        parseFloat(r.metrics.conversions     || 0),
      status:      r.campaign.status === 'ENABLED' ? 'active' : 'paused',
    }));

    res.json(data);
  } catch (err) {
    console.error('[GAdS campaigns]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`MarketIQ running at http://localhost:${PORT}`);
});
