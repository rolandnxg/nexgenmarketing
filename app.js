/* ── Seeded PRNG (consistent data across reloads) ───────── */
function makePRNG(seed) {
  let s = seed;
  return function(min, max) {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    const r = ((t ^ t >>> 14) >>> 0) / 4294967296;
    return Math.floor(r * (max - min + 1)) + min;
  };
}
const rand = makePRNG(0xDEADBEEF);

/* ── Timezone ────────────────────────────────────────────── */
const TZ = 'Australia/Sydney';

const toDateStr = d =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

const toLabel = d =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }).format(d);

/* ── Generate 90 days of mock data ──────────────────────── */
const TOTAL = 90;

// Anchor "today" to Sydney date so day boundaries are correct
const _todayStr = toDateStr(new Date());
const [_ty, _tm, _td] = _todayStr.split('-').map(Number);

const daily = Array.from({ length: TOTAL }, (_, i) => {
  const d = new Date(_ty, _tm - 1, _td - (TOTAL - 1 - i), 12, 0, 0);
  const fbConv    = rand(15, 70);
  const gadsConv  = rand(10, 50);
  const fbSpend   = rand(180, 650);
  const gadsSpend = rand(120, 480);
  return {
    dateStr:          toDateStr(d),
    label:            toLabel(d),
    ga_sessions:      rand(800, 2800),
    ga_users:         rand(600, 2000),
    ga_pageviews:     rand(2000, 8000),
    ga_bounce:        rand(34, 64),
    ga_duration:      rand(88, 260),
    ga_goals:         rand(18, 90),
    ga_organic:       rand(300, 1100),
    ga_direct:        rand(200, 750),
    ga_referral:      rand(80,  420),
    ga_social:        rand(50,  320),
    ga_email:         rand(30,  210),
    fb_impressions:   rand(15000, 65000),
    fb_reach:         rand(10000, 42000),
    fb_clicks:        rand(300,  1100),
    fb_spend:         fbSpend,
    fb_conversions:   fbConv,
    gads_impressions: rand(8000, 28000),
    gads_clicks:      rand(140, 520),
    gads_spend:       gadsSpend,
    gads_conversions: gadsConv,
    revenue:          (fbConv + gadsConv) * rand(28, 62),
    email_sent:        rand(2000, 9000),
    email_opened:      rand(380, 2200),
    email_clicked:     rand(80,  620),
    email_bounced:     rand(20,  180),
    email_conversions: rand(8,   60),
    email_unsub:       rand(2,   30),
  };
});

/* ── Static mock campaigns ──────────────────────────────── */
const campaigns = [
  { name: 'Summer Sale 2025',          platform: 'fb',   spend: 3840, revenue: 15360, conv: 307, status: 'active' },
  { name: 'Brand Awareness Q2',        platform: 'gads', spend: 2190, revenue:  6570, conv: 131, status: 'active' },
  { name: 'Retargeting — Cart Abandon',platform: 'fb',   spend: 1640, revenue:  9020, conv: 180, status: 'active' },
  { name: 'Search — Product Keywords', platform: 'gads', spend: 3100, revenue: 14260, conv: 285, status: 'active' },
  { name: 'Lookalike — Purchasers',    platform: 'fb',   spend:  980, revenue:  2940, conv:  58, status: 'paused' },
  { name: 'Display — Awareness',       platform: 'gads', spend:  620, revenue:  1240, conv:  24, status: 'paused' },
  { name: 'Video — Product Demo',      platform: 'fb',   spend: 1860, revenue:  5580, conv: 111, status: 'active' },
  { name: 'Shopping — All Products',   platform: 'gads', spend: 4200, revenue: 21000, conv: 420, status: 'active' },
];

const topPages = [
  { page: '/home',          sessions: 5820, pv: 8430, bounce: '41.2%', dur: '2m 18s' },
  { page: '/products',      sessions: 4310, pv: 7960, bounce: '36.8%', dur: '3m 51s' },
  { page: '/pricing',       sessions: 2940, pv: 4120, bounce: '52.3%', dur: '2m 04s' },
  { page: '/blog',          sessions: 2180, pv: 3890, bounce: '44.7%', dur: '4m 22s' },
  { page: '/about',         sessions: 1640, pv: 2250, bounce: '61.0%', dur: '1m 38s' },
  { page: '/contact',       sessions:  980, pv: 1410, bounce: '58.4%', dur: '1m 12s' },
  { page: '/checkout',      sessions:  840, pv: 1920, bounce: '18.9%', dur: '5m 44s' },
];


/* ── State ──────────────────────────────────────────────── */
const GADS_BRANDS = [
  { id: '7066096988', name: 'NEXGEN',                 donutLabel: 'Nexgen Google Ads', gaPropertyId: '351878495'  },
  { id: '4721419174', name: 'Business Telecom',        donutLabel: 'BTEL Google Ads',   gaPropertyId: '350928719'  },
  { id: '9197029288', name: 'Compare Business Phones', donutLabel: 'CBP Google Ads',    gaPropertyId: '437764581'  },
];

let barkData              = [];
let mvfData               = [];
let overviewGadsDaily     = [];
let overviewGadsCampaigns = [];
let platform         = 'all';
let days             = 30;
let dateFrom         = null;
let dateTo           = null;
let charts           = {};
let fbApiDaily       = [];
let fbApiCampaigns   = [];
let gadsApiDaily     = [];
let gadsApiCampaigns = [];
let gadsBrand        = GADS_BRANDS[0].id;
let gaApiDaily       = [];
let gaApiPages       = [];
let gaApiChannels    = {};
let overviewGaDaily  = [];

/* ── Helpers ────────────────────────────────────────────── */
const sum  = (arr, k) => arr.reduce((a, d) => a + d[k], 0);
const avg  = (arr, k) => sum(arr, k) / arr.length;
const fmt$ = n => '$' + Math.round(n).toLocaleString();
const fmtN = n => Math.round(n).toLocaleString();
const fmtPct = n => n.toFixed(1) + '%';
const slice  = () => dateFrom && dateTo
  ? daily.filter(d => d.dateStr >= dateFrom && d.dateStr <= dateTo)
  : daily.slice(TOTAL - days);
const randChange = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

function showLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
}
function showError(msg) {
  const banner = document.getElementById('error-banner');
  document.getElementById('error-msg').textContent = msg;
  banner.classList.remove('hidden');
}
function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}

/* ── Chart defaults ─────────────────────────────────────── */
Chart.defaults.color          = '#64748b';
Chart.defaults.borderColor    = '#1e2d45';
Chart.defaults.font.family    = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size      = 11;

const GRID_COLOR  = '#1e2d45';
const TICK_COLOR  = '#64748b';

function baseScaleX(labels) {
  return {
    type: 'category',
    ticks: {
      color: TICK_COLOR,
      maxTicksLimit: 10,
      maxRotation: 0,
    },
    grid: { display: false },
  };
}
function baseScaleY(opts = {}) {
  return {
    ticks: { color: TICK_COLOR, ...opts.ticks },
    grid: { color: GRID_COLOR },
    ...opts,
  };
}

/* ── KPI cards ──────────────────────────────────────────── */
function buildKPIs(s) {
  if (platform === 'all') {
    const revenue  = sum(s, 'revenue');
    const spend    = sum(s, 'fb_spend') + sum(s, 'gads_spend');
    const traffic  = sum(s, 'ga_sessions');
    const conv     = sum(s, 'fb_conversions') + sum(s, 'gads_conversions');
    const sent     = sum(s, 'email_sent');
    const opened   = sum(s, 'email_opened');
    const sixthKPI = sent > 0
      ? { label: 'Email Open Rate', value: fmtPct((opened / sent) * 100), pct: randChange(1, 10), up: true }
      : { label: 'Impressions', value: fmtN(sum(s, 'fb_impressions') + sum(s, 'gads_impressions')), pct: randChange(3, 20), up: true };
    return [
      { label: 'Revenue',     value: fmt$(revenue),                                              pct: randChange(5, 28), up: true  },
      { label: 'Ad Spend',    value: fmt$(spend),                                                pct: randChange(2, 18), up: false },
      { label: 'ROAS',        value: spend > 0 ? (revenue / spend).toFixed(2) + 'x' : '—',     pct: randChange(1, 15), up: true  },
      { label: 'Conversions', value: fmtN(conv),                                                 pct: randChange(4, 22), up: true  },
      { label: 'Traffic',     value: traffic > 0 ? fmtN(traffic) : '—',                         pct: randChange(3, 30), up: true  },
      sixthKPI,
    ];
  }
  if (platform === 'ga') {
    const sessions = sum(s, 'ga_sessions');
    const users    = sum(s, 'ga_users');
    const pv       = sum(s, 'ga_pageviews');
    const bounce   = avg(s, 'ga_bounce');
    const dur      = avg(s, 'ga_duration');
    const goals    = sum(s, 'ga_goals');
    const m = Math.floor(dur / 60), sc = Math.round(dur % 60);
    return [
      { label: 'Sessions',      value: fmtN(sessions),           pct: randChange(3, 25), up: true  },
      { label: 'Users',         value: fmtN(users),              pct: randChange(2, 20), up: true  },
      { label: 'Pageviews',     value: fmtN(pv),                 pct: randChange(5, 30), up: true  },
      { label: 'Bounce Rate',   value: fmtPct(bounce),           pct: randChange(1,  8), up: false },
      { label: 'Avg Duration',  value: `${m}m ${sc < 10 ? '0'+sc : sc}s`, pct: randChange(1, 12), up: true  },
      { label: 'Goals',         value: fmtN(goals),              pct: randChange(5, 25), up: true  },
    ];
  }
  if (platform === 'fb') {
    const impr  = sum(s, 'fb_impressions');
    const reach = sum(s, 'fb_reach');
    const clicks= sum(s, 'fb_clicks');
    const spend = sum(s, 'fb_spend');
    const conv  = sum(s, 'fb_conversions');
    const cpc   = spend / clicks;
    return [
      { label: 'Impressions',  value: fmtN(impr),    pct: randChange(5, 25), up: true  },
      { label: 'Reach',        value: fmtN(reach),   pct: randChange(3, 18), up: true  },
      { label: 'Clicks',       value: fmtN(clicks),  pct: randChange(4, 28), up: true  },
      { label: 'Ad Spend',     value: fmt$(spend),   pct: randChange(2, 15), up: false },
      { label: 'Conversions',  value: fmtN(conv),    pct: randChange(5, 22), up: true  },
      { label: 'Avg CPC',      value: fmt$(cpc),     pct: randChange(1, 12), up: false },
    ];
  }
  if (platform === 'bark') {
    const spend  = sum(s, 'spend');
    const leads  = sum(s, 'leads');
    const rev    = sum(s, 'revenue');
    const cpl    = leads > 0 ? spend / leads : 0;
    const roas   = spend > 0 && rev > 0 ? rev / spend : null;
    return [
      { label: 'Total Spend',    value: fmt$(spend),                             pct: randChange(2, 18), up: false },
      { label: 'Total Leads',    value: fmtN(leads),                             pct: randChange(5, 25), up: true  },
      { label: 'Cost / Lead',    value: cpl > 0 ? fmt$(cpl) : '—',              pct: randChange(1, 12), up: false },
      { label: 'Revenue',        value: rev > 0 ? fmt$(rev) : '—',              pct: randChange(3, 20), up: true  },
      { label: 'ROAS',           value: roas ? roas.toFixed(2) + 'x' : '—',    pct: randChange(2, 15), up: true  },
      { label: 'Days Imported',  value: fmtN(s.length),                         pct: 0,                 up: true  },
    ];
  }

  if (platform === 'mvf') {
    const spend  = sum(s, 'spend');
    const leads  = sum(s, 'leads');
    const rev    = sum(s, 'revenue');
    const cpl    = leads > 0 ? spend / leads : 0;
    const roas   = spend > 0 && rev > 0 ? rev / spend : null;
    return [
      { label: 'Total Spend',    value: fmt$(spend),                             pct: randChange(2, 18), up: false },
      { label: 'Total Leads',    value: fmtN(leads),                             pct: randChange(5, 25), up: true  },
      { label: 'Cost / Lead',    value: cpl > 0 ? fmt$(cpl) : '—',              pct: randChange(1, 12), up: false },
      { label: 'Revenue',        value: rev > 0 ? fmt$(rev) : '—',              pct: randChange(3, 20), up: true  },
      { label: 'ROAS',           value: roas ? roas.toFixed(2) + 'x' : '—',    pct: randChange(2, 15), up: true  },
      { label: 'Days Imported',  value: fmtN(s.length),                         pct: 0,                 up: true  },
    ];
  }

  if (platform === 'email') {
    const sent   = sum(s, 'email_sent');
    const opened = sum(s, 'email_opened');
    const clicked= sum(s, 'email_clicked');
    const conv   = sum(s, 'email_conversions');
    const bounced= sum(s, 'email_bounced');
    const unsub  = sum(s, 'email_unsub');
    const openRate  = sent   > 0 ? (opened  / sent)   * 100 : 0;
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;
    return [
      { label: 'Emails Sent',  value: fmtN(sent),       pct: randChange(3, 18), up: true  },
      { label: 'Open Rate',    value: fmtPct(openRate), pct: randChange(1, 10), up: true  },
      { label: 'Click Rate',   value: fmtPct(clickRate),pct: randChange(1,  8), up: true  },
      { label: 'Conversions',  value: fmtN(conv),       pct: randChange(4, 22), up: true  },
      { label: 'Bounces',      value: fmtN(bounced),    pct: randChange(1,  8), up: false },
      { label: 'Unsubscribes', value: fmtN(unsub),      pct: randChange(1,  6), up: false },
    ];
  }

  if (platform === 'gads') {
    const impr   = sum(s, 'gads_impressions');
    const clicks = sum(s, 'gads_clicks');
    const spend  = sum(s, 'gads_spend');
    const conv   = sum(s, 'gads_conversions');
    const isReal = gadsApiDaily.length > 0;
    const rev    = isReal ? sum(s, 'revenue') : sum(s, 'revenue') * 0.55;
    const roas   = spend > 0 && rev > 0 ? (rev / spend).toFixed(2) + 'x' : '—';
    return [
      { label: 'Impressions',  value: fmtN(impr),            pct: randChange(5, 25), up: true  },
      { label: 'Clicks',       value: fmtN(clicks),          pct: randChange(4, 28), up: true  },
      { label: 'Ad Spend',     value: fmt$(spend),           pct: randChange(2, 15), up: false },
      { label: 'Conversions',  value: fmtN(conv),            pct: randChange(5, 22), up: true  },
      { label: 'Avg CPC',      value: clicks > 0 ? fmt$(spend / clicks) : '—', pct: randChange(1, 12), up: false },
      { label: 'ROAS',         value: roas,                  pct: randChange(2, 18), up: true  },
    ];
  }
}

function renderKPIs(s) {
  const kpis = buildKPIs(s);
  const grid = document.getElementById('kpi-grid');
  grid.innerHTML = kpis.map(k => {
    const sign    = k.up ? '+' : '-';
    const cls     = k.up ? 'up' : 'down';
    const arrow   = k.up ? '&#8599;' : '&#8600;';
    const fillPct = Math.min(100, (k.pct / 30) * 100);
    return `
      <div class="kpi-card">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-change ${cls}">${arrow} ${sign}${k.pct}% vs prev</div>
        <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${fillPct}%"></div></div>
      </div>`;
  }).join('');
}

/* ── Chart data builders ────────────────────────────────── */
function gradient(ctx, color, alpha = .25) {
  const g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0,   color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
  g.addColorStop(1,   color.replace(')', ', 0)').replace('rgb', 'rgba'));
  return g;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgb(${r},${g},${b})`;
}

function makeGradient(ctx, hexColor, alpha = .3) {
  const rgb = hexToRgb(hexColor);
  const gr = ctx.createLinearGradient(0, 0, 0, 260);
  gr.addColorStop(0, rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`));
  gr.addColorStop(1, rgb.replace('rgb(', 'rgba(').replace(')', ', 0)'));
  return gr;
}

/* ── Build all chart configs ────────────────────────────── */
function getChartConfigs(s) {
  const labels = s.map(d => d.label);

  if (platform === 'all') {
    const revenue = s.map(d => d.revenue);
    const spend   = s.map(d => d.fb_spend + d.gads_spend);
    const fbClicks= s.map(d => d.fb_clicks);
    const gaSesSrc= s.map(d => d.ga_sessions);
    const gadsClk = s.map(d => d.gads_clicks);
    const conv    = s.map(d => d.fb_conversions + d.gads_conversions);
    const fbTot   = sum(s, 'fb_spend');
    const gadsTot = sum(s, 'gads_spend');

    // Per-brand GAdS spend from campaign data
    const BRAND_COLORS = { '7066096988': '#FBBC05', '4721419174': '#f59e0b', '9197029288': '#b45309' };
    const brandSpend   = {};
    for (const c of overviewGadsCampaigns) {
      if (c.customerId) brandSpend[c.customerId] = (brandSpend[c.customerId] || 0) + c.spend;
    }
    const hasBrandData   = GADS_BRANDS.some(b => (brandSpend[b.id] || 0) > 0);
    const gadsDonutItems = hasBrandData
      ? GADS_BRANDS.map(b => ({ label: b.donutLabel, color: BRAND_COLORS[b.id], value: Math.round(brandSpend[b.id] || 0) })).filter(e => e.value > 0)
      : gadsTot > 0 ? [{ label: 'Google Ads', color: '#FBBC05', value: Math.round(gadsTot) }] : [];

    const barkTot = sum(barkData, 'spend');
    const mvfTot  = sum(mvfData,  'spend');

    const allDonutItems = [
      { label: 'Facebook Ads', color: '#1877F2', value: Math.round(fbTot) },
      ...gadsDonutItems,
      ...(barkTot > 0 ? [{ label: 'Bark', color: '#06b6d4', value: Math.round(barkTot) }] : []),
      ...(mvfTot  > 0 ? [{ label: 'MVF',  color: '#f97316', value: Math.round(mvfTot)  }] : []),
    ].filter(e => e.value > 0);

    return {
      mainTitle:  'Revenue & Ad Spend',
      mainSub:    'Daily trend',
      donutTitle: 'Budget Split',
      barTitle:   'Traffic by Platform',
      lineTitle:  'Total Conversions',

      main: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Revenue',
              data: revenue,
              borderColor: '#6366f1',
              backgroundColor: makeGradient(ctx, '#6366f1', .25),
              fill: true,
              tension: .4,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 4,
              yAxisID: 'y',
            },
            {
              label: 'Ad Spend',
              data: spend,
              borderColor: '#f59e0b',
              backgroundColor: 'transparent',
              fill: false,
              tension: .4,
              borderWidth: 2,
              borderDash: [4, 3],
              pointRadius: 0,
              pointHoverRadius: 4,
              yAxisID: 'y',
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: '#64748b', boxWidth: 12, font: { size: 11 } } } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { callback: v => '$' + (v/1000).toFixed(0) + 'k', color: TICK_COLOR } }) },
          },
        },
      }),

      donut: () => ({
        type: 'doughnut',
        data: {
          labels: allDonutItems.map(e => e.label),
          datasets: [{ data: allDonutItems.map(e => e.value), backgroundColor: allDonutItems.map(e => e.color), borderWidth: 0, hoverOffset: 4 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '72%',
          plugins: { legend: { display: false } },
        },
        legendItems: allDonutItems.map(e => ({ label: e.label, color: e.color, value: fmt$(e.value) })),
      }),

      bar: (ctx) => ({
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'GA Sessions', data: gaSesSrc, backgroundColor: 'rgba(66,133,244,.7)',  borderRadius: 3 },
            { label: 'FB Clicks',   data: fbClicks,  backgroundColor: 'rgba(24,119,242,.5)',  borderRadius: 3 },
            { label: 'GAdS Clicks', data: gadsClk,  backgroundColor: 'rgba(251,188,5,.6)',  borderRadius: 3 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: '#64748b', boxWidth: 10, font: { size: 10 } } } },
          scales: {
            x: { ...baseScaleX(labels), stacked: true },
            y: { ...baseScaleY({ stacked: true, ticks: { callback: v => fmtN(v), color: TICK_COLOR } }) },
          },
        },
      }),

      line: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Conversions',
            data: conv,
            borderColor: '#10b981',
            backgroundColor: makeGradient(ctx, '#10b981', .2),
            fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { color: TICK_COLOR } }) },
          },
        },
      }),
    };
  }

  if (platform === 'ga') {
    const sessions = s.map(d => d.ga_sessions);
    const bounce   = s.map(d => d.ga_bounce);
    const hasRealChannels = Object.keys(gaApiChannels).length > 0;
    let organic, direct, referral, social, email;
    if (hasRealChannels) {
      organic  = gaApiChannels['organic search']  || 0;
      direct   = gaApiChannels['direct']           || 0;
      referral = gaApiChannels['referral']         || 0;
      social   = (gaApiChannels['organic social']  || 0) + (gaApiChannels['paid social'] || 0);
      email    = gaApiChannels['email']            || 0;
    } else {
      organic  = sum(s, 'ga_organic');
      direct   = sum(s, 'ga_direct');
      referral = sum(s, 'ga_referral');
      social   = sum(s, 'ga_social');
      email    = sum(s, 'ga_email');
    }

    return {
      mainTitle:  'Sessions Over Time',
      mainSub:    'Daily sessions',
      donutTitle: 'Traffic Sources',
      barTitle:   'Pageviews',
      lineTitle:  'Bounce Rate',

      main: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Sessions',
            data: sessions,
            borderColor: '#4285F4',
            backgroundColor: makeGradient(ctx, '#4285F4', .25),
            fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { callback: v => fmtN(v), color: TICK_COLOR } }) },
          },
        },
      }),

      donut: () => ({
        type: 'doughnut',
        data: {
          labels: ['Organic', 'Direct', 'Referral', 'Social', 'Email'],
          datasets: [{ data: [organic, direct, referral, social, email], backgroundColor: ['#4285F4','#34a853','#ea4335','#fbbc05','#a142f4'], borderWidth: 0, hoverOffset: 4 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '72%',
          plugins: { legend: { display: false } },
        },
        legendItems: [
          { label: 'Organic',  color: '#4285F4', value: fmtN(organic) },
          { label: 'Direct',   color: '#34a853', value: fmtN(direct) },
          { label: 'Referral', color: '#ea4335', value: fmtN(referral) },
          { label: 'Social',   color: '#fbbc05', value: fmtN(social) },
          { label: 'Email',    color: '#a142f4', value: fmtN(email) },
        ],
      }),

      bar: () => ({
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Pageviews',
            data: s.map(d => d.ga_pageviews),
            backgroundColor: 'rgba(66,133,244,.6)',
            borderRadius: 3,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { callback: v => fmtN(v), color: TICK_COLOR } }) },
          },
        },
      }),

      line: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Bounce Rate %',
            data: bounce,
            borderColor: '#f43f5e',
            backgroundColor: makeGradient(ctx, '#f43f5e', .15),
            fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { callback: v => v + '%', color: TICK_COLOR } }) },
          },
        },
      }),
    };
  }

  if (platform === 'email') {
    const sent    = s.map(d => d.email_sent);
    const opened  = s.map(d => d.email_opened);
    const clicked = s.map(d => d.email_clicked);
    const openRates = s.map(d => d.email_sent > 0 ? parseFloat(((d.email_opened / d.email_sent) * 100).toFixed(1)) : 0);
    const totSent   = sum(s, 'email_sent');
    const totOpened = sum(s, 'email_opened');
    const totClicked= sum(s, 'email_clicked');
    const totConv   = sum(s, 'email_conversions');

    return {
      mainTitle:  'Sends & Opens',
      mainSub:    'Daily email performance',
      donutTitle: 'Engagement Breakdown',
      barTitle:   'Daily Clicks',
      lineTitle:  'Open Rate Trend',

      main: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Sent',
              data: sent,
              borderColor: '#a855f7',
              backgroundColor: makeGradient(ctx, '#a855f7', .18),
              fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
              yAxisID: 'y',
            },
            {
              label: 'Opened',
              data: opened,
              borderColor: '#10b981',
              backgroundColor: 'transparent',
              fill: false, tension: .4, borderWidth: 2, borderDash: [4, 3], pointRadius: 0, pointHoverRadius: 4,
              yAxisID: 'y',
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: '#64748b', boxWidth: 12, font: { size: 11 } } } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { callback: v => fmtN(v), color: TICK_COLOR } }) },
          },
        },
      }),

      donut: () => ({
        type: 'doughnut',
        data: {
          labels: ['Opened', 'Clicked', 'Converted', 'No Engagement'],
          datasets: [{ data: [totOpened, totClicked, totConv, Math.max(0, totSent - totOpened)], backgroundColor: ['#10b981','#a855f7','#f59e0b','#1e2d45'], borderWidth: 0, hoverOffset: 4 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '72%',
          plugins: { legend: { display: false } },
        },
        legendItems: [
          { label: 'Opened',        color: '#10b981', value: fmtN(totOpened)  },
          { label: 'Clicked',       color: '#a855f7', value: fmtN(totClicked) },
          { label: 'Converted',     color: '#f59e0b', value: fmtN(totConv)    },
          { label: 'No Engagement', color: '#1e2d45', value: fmtN(Math.max(0, totSent - totOpened)) },
        ],
      }),

      bar: () => ({
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Clicks', data: clicked, backgroundColor: 'rgba(168,85,247,.65)', borderRadius: 3 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { callback: v => fmtN(v), color: TICK_COLOR } }) },
          },
        },
      }),

      line: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Open Rate %',
            data: openRates,
            borderColor: '#a855f7',
            backgroundColor: makeGradient(ctx, '#a855f7', .15),
            fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { callback: v => v + '%', color: TICK_COLOR } }) },
          },
        },
      }),
    };
  }

  if (platform === 'fb') {
    const spend  = s.map(d => d.fb_spend);
    const impr   = s.map(d => d.fb_impressions);
    const conv   = s.map(d => d.fb_conversions);
    const clicks = s.map(d => d.fb_clicks);
    const fbCampaigns = fbApiCampaigns.length > 0 ? fbApiCampaigns : campaigns.filter(c => c.platform === 'fb');
    const spendTot = sum(s, 'fb_spend');

    return {
      mainTitle:  'Spend & Impressions',
      mainSub:    'Daily trend',
      donutTitle: 'Campaign Spend',
      barTitle:   'Clicks per Day',
      lineTitle:  'Conversions',

      main: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Spend',
              data: spend,
              borderColor: '#1877F2',
              backgroundColor: makeGradient(ctx, '#1877F2', .2),
              fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
              yAxisID: 'y',
            },
            {
              label: 'Impressions (k)',
              data: impr.map(v => Math.round(v / 1000)),
              borderColor: '#60a5fa',
              backgroundColor: 'transparent',
              fill: false, tension: .4, borderWidth: 2, borderDash: [4,3], pointRadius: 0, pointHoverRadius: 4,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: '#64748b', boxWidth: 12, font: { size: 11 } } } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ position: 'left', ticks: { callback: v => '$' + v, color: TICK_COLOR } }) },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => v + 'k', color: TICK_COLOR } },
          },
        },
      }),

      donut: () => {
        const colors = ['#1877F2','#4299e1','#63b3ed','#90cdf4'];
        return {
          type: 'doughnut',
          data: {
            labels: fbCampaigns.map(c => c.name),
            datasets: [{ data: fbCampaigns.map(c => c.spend), backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }],
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '72%',
            plugins: { legend: { display: false } },
          },
          legendItems: fbCampaigns.map((c, i) => ({ label: c.name, color: colors[i], value: fmt$(c.spend) })),
        };
      },

      bar: () => ({
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Clicks', data: clicks, backgroundColor: 'rgba(24,119,242,.65)', borderRadius: 3 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { color: TICK_COLOR } }) },
          },
        },
      }),

      line: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Conversions',
            data: conv,
            borderColor: '#10b981',
            backgroundColor: makeGradient(ctx, '#10b981', .2),
            fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { color: TICK_COLOR } }) },
          },
        },
      }),
    };
  }

  if (platform === 'bark') {
    const spend  = s.map(d => d.spend);
    const leads  = s.map(d => d.leads);
    const cpl    = s.map(d => d.leads > 0 ? parseFloat((d.spend / d.leads).toFixed(2)) : 0);
    const totSpend = sum(s, 'spend');
    const totLeads = sum(s, 'leads');

    return {
      mainTitle:  'Daily Spend',
      mainSub:    'Bark lead marketplace',
      donutTitle: 'Summary',
      barTitle:   'Leads per Day',
      lineTitle:  'Cost per Lead',

      main: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Spend',
            data: spend,
            borderColor: '#06b6d4',
            backgroundColor: makeGradient(ctx, '#06b6d4', .2),
            fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ min: 0, ticks: { callback: v => '$' + v, color: TICK_COLOR } }) },
          },
        },
      }),

      donut: () => ({
        type: 'doughnut',
        data: {
          labels: ['Spend', 'Leads (×$10)'],
          datasets: [{ data: [Math.round(totSpend), totLeads * 10], backgroundColor: ['#06b6d4','#0e7490'], borderWidth: 0, hoverOffset: 4 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '72%',
          plugins: { legend: { display: false } },
        },
        legendItems: [
          { label: 'Total Spend', color: '#06b6d4', value: fmt$(totSpend) },
          { label: 'Total Leads', color: '#0e7490', value: fmtN(totLeads) },
        ],
      }),

      bar: () => ({
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Leads', data: leads, backgroundColor: 'rgba(6,182,212,.65)', borderRadius: 3 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ min: 0, ticks: { color: TICK_COLOR } }) },
          },
        },
      }),

      line: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Cost / Lead',
            data: cpl,
            borderColor: '#06b6d4',
            backgroundColor: makeGradient(ctx, '#06b6d4', .15),
            fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ min: 0, ticks: { callback: v => '$' + v, color: TICK_COLOR } }) },
          },
        },
      }),
    };
  }

  if (platform === 'mvf') {
    const spend  = s.map(d => d.spend);
    const leads  = s.map(d => d.leads);
    const cpl    = s.map(d => d.leads > 0 ? parseFloat((d.spend / d.leads).toFixed(2)) : 0);
    const totSpend = sum(s, 'spend');
    const totLeads = sum(s, 'leads');

    return {
      mainTitle:  'Daily Spend',
      mainSub:    'MVF lead generation',
      donutTitle: 'Summary',
      barTitle:   'Leads per Day',
      lineTitle:  'Cost per Lead',

      main: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Spend',
            data: spend,
            borderColor: '#f97316',
            backgroundColor: makeGradient(ctx, '#f97316', .2),
            fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ min: 0, ticks: { callback: v => '$' + v, color: TICK_COLOR } }) },
          },
        },
      }),

      donut: () => ({
        type: 'doughnut',
        data: {
          labels: ['Spend', 'Leads (×$10)'],
          datasets: [{ data: [Math.round(totSpend), totLeads * 10], backgroundColor: ['#f97316','#c2410c'], borderWidth: 0, hoverOffset: 4 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '72%',
          plugins: { legend: { display: false } },
        },
        legendItems: [
          { label: 'Total Spend', color: '#f97316', value: fmt$(totSpend) },
          { label: 'Total Leads', color: '#c2410c', value: fmtN(totLeads) },
        ],
      }),

      bar: () => ({
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Leads', data: leads, backgroundColor: 'rgba(249,115,22,.65)', borderRadius: 3 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ min: 0, ticks: { color: TICK_COLOR } }) },
          },
        },
      }),

      line: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Cost / Lead',
            data: cpl,
            borderColor: '#f97316',
            backgroundColor: makeGradient(ctx, '#f97316', .15),
            fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ min: 0, ticks: { callback: v => '$' + v, color: TICK_COLOR } }) },
          },
        },
      }),
    };
  }

  if (platform === 'gads') {
    const spend = s.map(d => d.gads_spend);
    const conv  = s.map(d => d.gads_conversions);
    const isReal = gadsApiDaily.length > 0;
    const roas  = s.map(d => d.gads_spend > 0
      ? parseFloat(((isReal ? d.revenue : d.revenue * 0.55) / d.gads_spend).toFixed(2))
      : 0
    );
    const clicks= s.map(d => d.gads_clicks);
    const gadsCampaigns = gadsApiCampaigns.length > 0 ? gadsApiCampaigns : campaigns.filter(c => c.platform === 'gads');
    const baseColors = ['#FBBC05','#f6ad55','#fbd38d','#fef3c7','#facc15','#fde68a'];
    const colors = gadsCampaigns.map((_, i) => baseColors[i % baseColors.length]);

    return {
      mainTitle:  'Spend & Conversions',
      mainSub:    'Daily trend',
      donutTitle: 'Campaign Spend',
      barTitle:   'Clicks per Day',
      lineTitle:  'ROAS Trend',

      main: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Spend',
              data: spend,
              borderColor: '#FBBC05',
              backgroundColor: makeGradient(ctx, '#FBBC05', .2),
              fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
              yAxisID: 'y',
            },
            {
              label: 'Conversions',
              data: conv,
              borderColor: '#10b981',
              backgroundColor: 'transparent',
              fill: false, tension: .4, borderWidth: 2, borderDash: [4,3], pointRadius: 0, pointHoverRadius: 4,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: '#64748b', boxWidth: 12, font: { size: 11 } } } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ position: 'left', ticks: { callback: v => '$' + v, color: TICK_COLOR } }) },
            y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: TICK_COLOR } },
          },
        },
      }),

      donut: () => ({
        type: 'doughnut',
        data: {
          labels: gadsCampaigns.map(c => c.name),
          datasets: [{ data: gadsCampaigns.map(c => Math.round(c.spend)), backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '72%',
          plugins: { legend: { display: false } },
        },
        legendItems: gadsCampaigns.map((c, i) => ({ label: c.name, color: colors[i], value: fmt$(c.spend) })),
      }),

      bar: () => ({
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Clicks', data: clicks, backgroundColor: 'rgba(251,188,5,.65)', borderRadius: 3 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ ticks: { color: TICK_COLOR } }) },
          },
        },
      }),

      line: (ctx) => ({
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'ROAS',
            data: roas,
            borderColor: '#FBBC05',
            backgroundColor: makeGradient(ctx, '#FBBC05', .15),
            fill: true, tension: .4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ...baseScaleX(labels) },
            y: { ...baseScaleY({ min: 0, ticks: { callback: v => v + 'x', color: TICK_COLOR } }) },
          },
        },
      }),
    };
  }
}

/* ── Render charts ──────────────────────────────────────── */
function renderCharts(s) {
  const cfg = getChartConfigs(s);

  document.getElementById('chart-main-title').textContent  = cfg.mainTitle;
  document.getElementById('chart-main-sub').textContent    = cfg.mainSub;
  document.getElementById('chart-donut-title').textContent = cfg.donutTitle;
  document.getElementById('chart-bar-title').textContent   = cfg.barTitle;
  document.getElementById('chart-line-title').textContent  = cfg.lineTitle;

  ['main','donut','bar','line'].forEach(id => {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  });

  const ctxMain  = document.getElementById('chart-main').getContext('2d');
  const ctxDonut = document.getElementById('chart-donut').getContext('2d');
  const ctxBar   = document.getElementById('chart-bar').getContext('2d');
  const ctxLine  = document.getElementById('chart-line').getContext('2d');

  charts.main  = new Chart(ctxMain,  cfg.main(ctxMain));
  const donutCfg = cfg.donut(ctxDonut);
  charts.donut = new Chart(ctxDonut, donutCfg);
  charts.bar   = new Chart(ctxBar,   cfg.bar(ctxBar));
  charts.line  = new Chart(ctxLine,  cfg.line(ctxLine));

  const legend = document.getElementById('donut-legend');
  legend.innerHTML = (donutCfg.legendItems || []).map(item => `
    <div class="legend-item">
      <div class="legend-left">
        <div class="legend-dot" style="background:${item.color}"></div>
        <span class="legend-label">${item.label}</span>
      </div>
      <span class="legend-value">${item.value}</span>
    </div>`).join('');
}

/* ── Render table ───────────────────────────────────────── */
function roasClass(r) {
  if (r >= 4) return 'roas-good';
  if (r >= 2) return 'roas-ok';
  return 'roas-low';
}

function renderTable() {
  const head = document.getElementById('table-head');
  const body = document.getElementById('table-body');
  const badge = document.getElementById('table-badge');

  if (platform === 'email') {
    const allCampaigns = [...customEmailCampaigns];
    document.getElementById('table-title').textContent = 'Campaign Performance';
    badge.textContent = allCampaigns.length + ' campaigns';
    head.innerHTML = '<tr>' + ['Campaign','Type','Sent','Opens','Open Rate','Clicks','CTR','Conversions','Unsub','Status',''].map(h => `<th>${h}</th>`).join('') + '</tr>';
    body.innerHTML = allCampaigns.map(c => {
      const openRate  = c.sent   > 0 ? fmtPct((c.opens  / c.sent)   * 100) : '—';
      const ctr       = c.opens  > 0 ? fmtPct((c.clicks / c.opens)  * 100) : '—';
      const stClass   = c.status === 'active' || c.status === 'scheduled' ? 'active' : c.status === 'sent' ? 'paused' : 'paused';
      const stLabel   = c.status === 'draft' ? 'draft' : c.status === 'scheduled' ? 'scheduled' : c.status === 'sent' ? 'sent' : c.status;
      const stBadge   = `<span class="status-badge status-${stClass}"><span class="status-dot-sm"></span>${stLabel}</span>`;
      const typeBadge = `<span class="email-type-badge type-${c.type.toLowerCase().replace(/\s+/g,'-')}">${c.type}</span>`;
      const actions   = `<div class="edm-actions">
        <button class="edm-action-btn edit" onclick="openEDMModal('${c.id}')">Edit</button>
        <button class="edm-action-btn dup"  onclick="duplicateEDM('${c.id}')">Dup</button>
        <button class="edm-action-btn delete" onclick="deleteEDM('${c.id}')">Delete</button>
      </div>`;
      return `<tr>
        <td><div style="display:flex;flex-direction:column;gap:2px"><span>${c.name}</span>${c.subject ? `<span style="font-size:11px;color:#64748b">${c.subject}</span>` : ''}</div></td>
        <td>${typeBadge}</td>
        <td>${fmtN(c.sent)}</td>
        <td>${fmtN(c.opens)}</td>
        <td>${openRate}</td>
        <td>${fmtN(c.clicks)}</td>
        <td>${ctr}</td>
        <td>${fmtN(c.conv)}</td>
        <td>${fmtN(c.unsub)}</td>
        <td>${stBadge}</td>
        <td>${actions}</td>
      </tr>`;
    }).join('');
    return;
  }

  if (platform === 'ga') {
    const pages = gaApiPages.length > 0 ? gaApiPages : topPages;
    document.getElementById('table-title').textContent = 'Top Pages';
    badge.textContent = pages.length + ' pages';
    head.innerHTML = '<tr>' + ['Page','Sessions','Pageviews','Bounce Rate','Avg Duration'].map(h => `<th>${h}</th>`).join('') + '</tr>';
    body.innerHTML = pages.map(p => `
      <tr>
        <td><code style="color:#94a3b8;font-size:12px">${p.page}</code></td>
        <td>${fmtN(p.sessions)}</td>
        <td>${fmtN(p.pv)}</td>
        <td>${p.bounce}</td>
        <td>${p.dur}</td>
      </tr>`).join('');
    return;
  }

  if (platform === 'mvf') {
    document.getElementById('table-title').textContent = 'MVF — Imported Data';
    badge.textContent = mvfData.length + ' rows';
    const hasUid = mvfData.some(d => d.uid != null);
    const hasSize= mvfData.some(d => d.size);
    const hasCat = mvfData.some(d => d.category);
    const hasRev = mvfData.some(d => d.revenue > 0);
    const cols   = ['Date', ...(hasUid ? ['UID Count'] : []), 'Spend', 'Leads', 'Cost / Lead',
                    ...(hasRev ? ['Revenue'] : []), ...(hasSize ? ['Size'] : []), ...(hasCat ? ['Category'] : [])];
    head.innerHTML = '<tr>' + cols.map(h => `<th>${h}</th>`).join('') + '</tr>';
    body.innerHTML = mvfData.map(d => {
      const cpl = d.leads > 0 ? fmt$(d.spend / d.leads) : '&mdash;';
      return `<tr>
        <td>${d.label}</td>
        ${hasUid ? `<td>${d.uid != null ? fmtN(d.uid) : '&mdash;'}</td>` : ''}
        <td>${fmt$(d.spend)}</td>
        <td>${fmtN(d.leads)}</td>
        <td>${cpl}</td>
        ${hasRev  ? `<td>${d.revenue > 0 ? fmt$(d.revenue) : '&mdash;'}</td>` : ''}
        ${hasSize ? `<td>${d.size || '&mdash;'}</td>` : ''}
        ${hasCat  ? `<td>${d.category || '&mdash;'}</td>` : ''}
      </tr>`;
    }).join('');
    return;
  }

  if (platform === 'bark') {
    document.getElementById('table-title').textContent = 'Bark — Imported Data';
    badge.textContent = barkData.length + ' rows';
    const hasUid = barkData.some(d => d.uid != null);
    const hasSize= barkData.some(d => d.size);
    const hasCat = barkData.some(d => d.category);
    const hasRev = barkData.some(d => d.revenue > 0);
    const cols   = ['Date', ...(hasUid ? ['UID Count'] : []), 'Spend', 'Leads', 'Cost / Lead',
                    ...(hasRev ? ['Revenue'] : []), ...(hasSize ? ['Size'] : []), ...(hasCat ? ['Category'] : [])];
    head.innerHTML = '<tr>' + cols.map(h => `<th>${h}</th>`).join('') + '</tr>';
    body.innerHTML = barkData.map(d => {
      const cpl = d.leads > 0 ? fmt$(d.spend / d.leads) : '&mdash;';
      return `<tr>
        <td>${d.label}</td>
        ${hasUid ? `<td>${d.uid != null ? fmtN(d.uid) : '&mdash;'}</td>` : ''}
        <td>${fmt$(d.spend)}</td>
        <td>${fmtN(d.leads)}</td>
        <td>${cpl}</td>
        ${hasRev  ? `<td>${d.revenue > 0 ? fmt$(d.revenue) : '&mdash;'}</td>` : ''}
        ${hasSize ? `<td>${d.size || '&mdash;'}</td>` : ''}
        ${hasCat  ? `<td>${d.category || '&mdash;'}</td>` : ''}
      </tr>`;
    }).join('');
    return;
  }

  const rows = (platform === 'fb'   && fbApiCampaigns.length     > 0 ? fbApiCampaigns
             : platform === 'gads' && gadsApiCampaigns.length   > 0 ? gadsApiCampaigns
             : platform === 'all'  && (overviewGadsCampaigns.length > 0 || fbApiCampaigns.length > 0)
               ? [...overviewGadsCampaigns, ...fbApiCampaigns]
             : platform === 'all' ? campaigns
             : campaigns.filter(c => c.platform === platform))
             .filter(c => platform !== 'fb' || c.status === 'active');

  document.getElementById('table-title').textContent = 'Campaign Performance';
  badge.textContent = rows.length + ' campaigns';

  const isFB   = platform === 'fb';
  const isGads = platform === 'gads';
  const isAll  = platform === 'all';

  const heads = isAll  ? ['Campaign','Platform','Spend','Revenue','ROAS','Conversions','Status']
              : isFB   ? ['Campaign','Spend','Impressions','Reach','Result','Cost / Result','Status']
              : isGads ? ['Campaign','Spend','Impressions','Clicks','Conversions','Cost / Conv','ROAS','Status']
              :          ['Campaign','Spend','Revenue','ROAS','Conversions','Status'];

  head.innerHTML = '<tr>' + heads.map(h => `<th>${h}</th>`).join('') + '</tr>';
  body.innerHTML = rows.map(c => {
    const roas       = c.spend > 0 && c.revenue > 0 ? (c.revenue / c.spend) : null;
    const roasCls    = roas !== null && roas >= 0.01 ? roasClass(roas) : '';
    const costPerRes = c.conv > 0 ? fmt$(c.spend / c.conv) : '&mdash;';
    const pBadge     = `<span class="platform-badge badge-${c.platform}">${c.platform === 'fb' ? 'FB' : c.platform === 'gads' ? 'GAdS' : 'GA'}</span>`;
    const stBadge    = `<span class="status-badge status-${c.status}"><span class="status-dot-sm"></span>${c.status}</span>`;

    const base = isFB ? `
      <td>${c.name}</td>
      <td>${fmt$(c.spend)}</td>
      <td>${fmtN(c.impressions ?? 0)}</td>
      <td>${fmtN(c.reach       ?? 0)}</td>
      <td><div class="result-cell"><span class="result-pill">${fmtN(c.conv)}</span><span class="result-type">${c.resultLabel || 'Results'}</span></div></td>
      <td>${costPerRes}</td>
      <td>${stBadge}</td>`
    : isGads ? `
      <td>${c.name}</td>
      <td>${fmt$(c.spend)}</td>
      <td>${fmtN(c.impressions ?? 0)}</td>
      <td>${fmtN(c.clicks      ?? 0)}</td>
      <td>${fmtN(c.conv)}</td>
      <td>${costPerRes}</td>
      <td class="${roasCls}">${roas !== null && roas >= 0.01 ? roas.toFixed(2) + 'x' : '&mdash;'}</td>
      <td>${stBadge}</td>`
    : `
      <td>${c.name}</td>
      ${isAll ? `<td>${pBadge}</td>` : ''}
      <td>${fmt$(c.spend)}</td>
      <td>${fmt$(c.revenue)}</td>
      <td class="${roasCls}">${roas !== null && roas >= 0.01 ? roas.toFixed(2) + 'x' : '&mdash;'}</td>
      <td>${fmtN(c.conv)}</td>
      <td>${stBadge}</td>`;

    return `<tr>${base}</tr>`;
  }).join('');
}

/* ── Page header ────────────────────────────────────────── */
const PLATFORM_META = {
  all:   { title: 'Overview',           sub: 'All platforms combined' },
  ga:    { title: 'Google Analytics',   sub: 'Website traffic & behaviour' },
  fb:    { title: 'Facebook Ads',       sub: 'Paid social performance' },
  gads:  { title: 'Google Ads',         sub: 'Search & display performance' },
  bark:  { title: 'Bark',               sub: 'Lead marketplace performance' },
  mvf:   { title: 'MVF',                sub: 'MVF lead generation performance' },
  email: { title: 'Email Marketing',    sub: 'Campaign performance & engagement' },
};

function renderHeader() {
  const m = PLATFORM_META[platform];
  document.getElementById('page-title').textContent    = m.title;
  document.getElementById('page-subtitle').textContent = m.sub;
  document.getElementById('brand-select').style.display    = (platform === 'gads' || platform === 'ga') ? '' : 'none';
  document.getElementById('create-edm-btn').style.display  = platform === 'email' ? '' : 'none';
  document.getElementById('import-csv-btn').style.display = (platform === 'bark' || platform === 'mvf') ? '' : 'none';
  const importBtn = document.getElementById('bark-import-btn');
  if (importBtn) importBtn.style.display = (platform === 'bark' && barkData.length > 0) ? '' : 'none';
  const mvfImportBtn = document.getElementById('mvf-import-btn');
  if (mvfImportBtn) mvfImportBtn.style.display = (platform === 'mvf' && mvfData.length > 0) ? '' : 'none';
}

/* ── Overview data builder ──────────────────────────────── */
function buildOverviewData(gadsDaily, fbDaily, gaDaily) {
  const byDate = {};
  const blank = () => ({
    gads_impressions: 0, gads_clicks: 0, gads_spend: 0, gads_conversions: 0, revenue: 0,
    fb_impressions: 0, fb_reach: 0, fb_clicks: 0, fb_spend: 0, fb_conversions: 0,
    ga_sessions: 0, email_sent: 0, email_opened: 0,
  });

  for (const d of gadsDaily) {
    byDate[d.dateStr] = {
      dateStr: d.dateStr, label: d.label, ...blank(),
      gads_impressions: d.gads_impressions, gads_clicks: d.gads_clicks,
      gads_spend: d.gads_spend, gads_conversions: d.gads_conversions,
      revenue: d.revenue,
    };
  }
  for (const d of fbDaily) {
    if (!byDate[d.dateStr]) byDate[d.dateStr] = { dateStr: d.dateStr, label: d.label, ...blank() };
    byDate[d.dateStr].fb_impressions += d.fb_impressions;
    byDate[d.dateStr].fb_reach       += d.fb_reach;
    byDate[d.dateStr].fb_clicks      += d.fb_clicks;
    byDate[d.dateStr].fb_spend       += d.fb_spend;
    byDate[d.dateStr].fb_conversions += d.fb_conversions;
    byDate[d.dateStr].revenue        += d.revenue;
  }
  for (const d of (gaDaily || [])) {
    if (!byDate[d.dateStr]) byDate[d.dateStr] = { dateStr: d.dateStr, label: d.label || d.dateStr, ...blank() };
    byDate[d.dateStr].ga_sessions += d.ga_sessions;
  }
  return Object.values(byDate).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

/* ── Master update ──────────────────────────────────────── */
async function update() {
  hideError();

  const dateOpts = { days, dateFrom, dateTo };

  if (platform === 'all') {
    document.getElementById('loading-msg').textContent = 'Fetching all brands data…';
    showLoading(true);
    const [gadsRes, fbRes, gaRes] = await Promise.allSettled([
      Promise.all([fetchGAdsDailyInsights(dateOpts, null), fetchGAdsCampaigns(dateOpts, null)]),
      Promise.all([fetchFBDailyInsights(dateOpts), fetchFBCampaignInsights(dateOpts)]),
      fetchGADailyInsights(dateOpts, null),
    ]);
    showLoading(false);
    const errs = [];
    if (gadsRes.status === 'fulfilled') [overviewGadsDaily, overviewGadsCampaigns] = gadsRes.value;
    else errs.push('GAdS: ' + gadsRes.reason.message);
    if (fbRes.status === 'fulfilled') [fbApiDaily, fbApiCampaigns] = fbRes.value;
    else errs.push('FB: ' + fbRes.reason.message);
    if (gaRes.status === 'fulfilled') overviewGaDaily = gaRes.value.daily || [];
    else errs.push('GA: ' + gaRes.reason.message);
    if (errs.length) showError(errs.join(' | '));
  }

  if (platform === 'fb') {
    document.getElementById('loading-msg').textContent = 'Fetching Facebook Ads data…';
    showLoading(true);
    try {
      [fbApiDaily, fbApiCampaigns] = await Promise.all([
        fetchFBDailyInsights(dateOpts),
        fetchFBCampaignInsights(dateOpts),
      ]);
    } catch (err) {
      showLoading(false);
      showError('Facebook API: ' + err.message);
      return;
    }
    showLoading(false);
  }

  if (platform === 'gads') {
    document.getElementById('loading-msg').textContent = 'Fetching Google Ads data…';
    showLoading(true);
    try {
      [gadsApiDaily, gadsApiCampaigns] = await Promise.all([
        fetchGAdsDailyInsights(dateOpts, gadsBrand),
        fetchGAdsCampaigns(dateOpts, gadsBrand),
      ]);
    } catch (err) {
      showLoading(false);
      showError('Google Ads: ' + err.message);
      return;
    }
    showLoading(false);
  }

  if (platform === 'ga') {
    const gaBrand     = GADS_BRANDS.find(b => b.id === gadsBrand);
    const propertyId  = gaBrand ? gaBrand.gaPropertyId : null;
    document.getElementById('loading-msg').textContent = 'Fetching Google Analytics data…';
    showLoading(true);
    try {
      const [gaResult, gaPages] = await Promise.all([
        fetchGADailyInsights(dateOpts, propertyId),
        fetchGATopPages(dateOpts, propertyId),
      ]);
      gaApiDaily    = gaResult.daily    || [];
      gaApiChannels = gaResult.channels || {};
      gaApiPages    = gaPages;
    } catch (err) {
      showLoading(false);
      showError('Google Analytics: ' + err.message);
      return;
    }
    showLoading(false);
  }

  renderHeader();

  const showUpload    = platform === 'bark' && barkData.length === 0;
  const showMvfUpload = platform === 'mvf'  && mvfData.length  === 0;

  if (showUpload || showMvfUpload) {
    document.getElementById('kpi-grid').innerHTML = '';
    ['main','donut','bar','line'].forEach(id => { if (charts[id]) { charts[id].destroy(); delete charts[id]; } });
    document.getElementById('donut-legend').innerHTML = '';
    document.getElementById('table-head').innerHTML = '';
    document.getElementById('table-body').innerHTML = '';
    document.getElementById('table-badge').textContent = '';
    showLoading(false);
    return;
  }

  const s = platform === 'fb'   ? fbApiDaily
          : platform === 'gads' && gadsApiDaily.length > 0 ? gadsApiDaily
          : platform === 'ga'   && gaApiDaily.length  > 0 ? gaApiDaily
          : platform === 'bark' ? barkData
          : platform === 'mvf'  ? mvfData
          : platform === 'all' && overviewGadsDaily.length > 0
            ? buildOverviewData(overviewGadsDaily, fbApiDaily, overviewGaDaily)
          : slice();
  if (platform === 'email' && s.length === 0) { renderKPIs([]); renderCharts([]); renderTable(); return; }
  renderKPIs(s);
  renderCharts(s);
  renderTable();
}

/* ── Event listeners ────────────────────────────────────── */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    platform = btn.dataset.platform;
    closeUploadModal();
    update();
  });
});


/* ── Custom date range ──────────────────────────────────── */
const customBtn   = document.getElementById('date-custom-btn');
const customPanel = document.getElementById('date-custom-panel');
const inputFrom   = document.getElementById('date-from');
const inputTo     = document.getElementById('date-to');
const applyBtn    = document.getElementById('date-apply');

const today2yr    = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return toDateStr(d); })();
const _todayFull  = toDateStr(new Date());
const _monthStart = _todayFull.slice(0, 8) + '01';   // YYYY-MM-01

dateFrom = _monthStart;
dateTo   = _todayFull;

inputFrom.min   = today2yr;
inputFrom.max   = _todayFull;
inputFrom.value = _monthStart;
inputTo.min     = today2yr;
inputTo.max     = _todayFull;
inputTo.value   = _todayFull;

const _fmtLabel = str => { const [y, m, d] = str.split('-'); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
customBtn.textContent = `${_fmtLabel(_monthStart)} – ${_fmtLabel(_todayFull)}`;

customBtn.addEventListener('click', e => {
  e.stopPropagation();
  customPanel.classList.toggle('hidden');
});

document.addEventListener('click', e => {
  if (!customPanel.contains(e.target) && e.target !== customBtn) {
    customPanel.classList.add('hidden');
  }
});

applyBtn.addEventListener('click', () => {
  const from = inputFrom.value;
  const to   = inputTo.value;

  const errEl = customPanel.querySelector('.dcp-error');
  if (errEl) errEl.remove();

  if (!from || !to) return;
  if (from > to) {
    const err = document.createElement('span');
    err.className = 'dcp-error';
    err.textContent = '"From" must be before "To"';
    customPanel.appendChild(err);
    return;
  }

  dateFrom = from;
  dateTo   = to;

  const fmt = str => {
    const [y, m, d] = str.split('-');
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  customBtn.textContent = `${fmt(from)} – ${fmt(to)}`;

  customPanel.classList.add('hidden');
  update();
});

document.getElementById('brand-select').addEventListener('change', e => {
  gadsBrand = e.target.value;
  gadsApiDaily     = [];
  gadsApiCampaigns = [];
  update();
});

/* ── Bark CSV import ────────────────────────────────────── */
function normalizeDateStr(raw) {
  if (!raw) return null;
  raw = raw.trim().replace(/['"]/g, '');
  /* ISO: 2024-01-15 */
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  /* DD/MM/YYYY or D/M/YYYY (Australian) */
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  /* MM/DD/YYYY */
  const mdy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  /* Try native parse as fallback */
  const dt = new Date(raw);
  if (!isNaN(dt)) return toDateStr(dt);
  return null;
}

function parseCSVLine(line) {
  const cells = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map(c => c.trim().replace(/^"|"$/g, ''));
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row.');

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const col = name => headers.findIndex(h => h.includes(name));

  const iDate   = col('date') >= 0 ? col('date') : col('day');
  const iSpend  = col('spend') >= 0 ? col('spend') : col('cost') >= 0 ? col('cost') : col('amount') >= 0 ? col('amount') : col('credit');
  const iLeads  = col('lead') >= 0 ? col('lead') : col('conversion') >= 0 ? col('conversion') : col('enquir');
  const iRev    = col('revenue') >= 0 ? col('revenue') : col('value') >= 0 ? col('value') : col('sale');
  const iCat    = col('category') >= 0 ? col('category') : col('type');
  const iUid    = col('uid') >= 0 ? col('uid') : col('id');
  const iSize   = col('size');

  if (iDate < 0)  throw new Error('No date column found. Add a "date" column.');
  if (iSpend < 0) throw new Error('No spend/cost column found. Add a "spend" column.');

  const byDate  = {};
  const uidSets = {};
  lines.slice(1).forEach(line => {
    const cells   = parseCSVLine(line);
    const dateStr = normalizeDateStr(cells[iDate]);
    if (!dateStr) return;
    if (!byDate[dateStr]) {
      byDate[dateStr] = { dateStr, spend: 0, leads: 0, revenue: 0, category: '', size: '' };
      uidSets[dateStr] = new Set();
    }
    byDate[dateStr].spend   += parseFloat((cells[iSpend]  || '0').replace(/[$,]/g, '')) || 0;
    if (iLeads >= 0) byDate[dateStr].leads += parseInt(cells[iLeads] || 0) || 0;
    else             byDate[dateStr].leads += 1; // no leads column — each row = 1 lead
    if (iRev   >= 0) byDate[dateStr].revenue  += parseFloat((cells[iRev]  || '0').replace(/[$,]/g, '')) || 0;
    if (iCat   >= 0 && cells[iCat]?.trim())  byDate[dateStr].category = cells[iCat].trim();
    if (iSize  >= 0 && cells[iSize]?.trim()) byDate[dateStr].size     = cells[iSize].trim();
    if (iUid   >= 0 && cells[iUid]?.trim())  uidSets[dateStr].add(cells[iUid].trim());
  });

  // Store unique UID count per date
  for (const d of Object.keys(byDate)) {
    byDate[d].uid = uidSets[d].size > 0 ? uidSets[d].size : null;
  }

  return Object.values(byDate)
    .map(d => {
      const [y, m, day] = d.dateStr.split('-').map(Number);
      return { ...d, label: new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short', day: 'numeric' }).format(new Date(y, m - 1, day, 12)) };
    })
    .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

function saveToLocal(platform, data) {
  try { localStorage.setItem(`nxg_${platform}`, JSON.stringify(data)); }
  catch { showError('Save failed: storage full'); }
}
function clearFromLocal(platform) {
  localStorage.removeItem(`nxg_${platform}`);
}
function loadFromLocal(platform) {
  try { const d = localStorage.getItem(`nxg_${platform}`); return d ? JSON.parse(d) : []; }
  catch { return []; }
}

function loadBarkCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      barkData = parseCSV(e.target.result);
      if (barkData.length === 0) throw new Error('No valid rows found in CSV.');
      saveToLocal('bark', barkData);
      closeUploadModal();
      update();
    } catch (err) {
      showError('Bark CSV: ' + err.message);
    }
  };
  reader.readAsText(file);
}

document.getElementById('bark-import-btn').addEventListener('click', () => { barkData = []; clearFromLocal('bark'); update(); });

/* ── MVF CSV import ─────────────────────────────────────── */
function loadMVFCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      mvfData = parseCSV(e.target.result);
      if (mvfData.length === 0) throw new Error('No valid rows found in CSV.');
      saveToLocal('mvf', mvfData);
      closeUploadModal();
      update();
    } catch (err) {
      showError('MVF CSV: ' + err.message);
    }
  };
  reader.readAsText(file);
}

document.getElementById('mvf-import-btn').addEventListener('click', () => { mvfData = []; clearFromLocal('mvf'); update(); });

/* ── Shared upload modal ────────────────────────────────── */
let _uploadColor = '#06b6d4';

function openUploadModal(p) {
  _uploadColor = p === 'bark' ? '#06b6d4' : '#f97316';
  const name   = p === 'bark' ? 'Bark' : 'MVF';
  const samples = {
    bark: ['date,uid,size,spend,leads,revenue,category','01/05/2025,BK-001,Small,250.00,5,4500.00,Phone Systems','02/05/2025,BK-002,Medium,180.00,3,2700.00,VoIP','03/05/2025,BK-003,Large,310.00,7,6300.00,Phone Systems','04/05/2025,BK-004,Small,95.00,2,1800.00,Phone Systems','05/05/2025,BK-005,Medium,220.00,4,3600.00,VoIP'].join('\n'),
    mvf:  ['date,uid,size,spend,leads,revenue,category','01/05/2025,MV-001,Medium,320.00,8,7200.00,Business Phones','02/05/2025,MV-002,Small,210.00,5,4500.00,VoIP','03/05/2025,MV-003,Large,450.00,11,9900.00,Business Phones','04/05/2025,MV-004,Small,130.00,3,2700.00,Broadband','05/05/2025,MV-005,Medium,280.00,7,6300.00,Business Phones'].join('\n'),
  };
  document.getElementById('upload-modal-title').textContent = `Import ${name} CSV`;
  document.getElementById('upload-drop-title').textContent  = `Import your ${name} CSV`;
  document.getElementById('upload-file-label').style.color  = _uploadColor;
  const sampleBtn = document.getElementById('upload-sample-btn');
  sampleBtn.style.color = _uploadColor;
  sampleBtn._csv  = samples[p];
  sampleBtn._name = `${p}-sample.csv`;
  document.getElementById('upload-modal').style.display = 'flex';
  document.getElementById('upload-file').value = '';
}

function closeUploadModal() {
  document.getElementById('upload-modal').style.display = 'none';
}

const uploadDropzone = document.getElementById('upload-dropzone');
const uploadFile     = document.getElementById('upload-file');

uploadDropzone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadDropzone.style.borderColor = _uploadColor;
  uploadDropzone.classList.add('drag-over');
});
uploadDropzone.addEventListener('dragleave', () => {
  uploadDropzone.style.borderColor = '';
  uploadDropzone.classList.remove('drag-over');
});
uploadDropzone.addEventListener('drop', e => {
  e.preventDefault();
  uploadDropzone.style.borderColor = '';
  uploadDropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) (platform === 'bark' ? loadBarkCSV : loadMVFCSV)(file);
});
uploadDropzone.addEventListener('click', () => uploadFile.click());
uploadFile.addEventListener('change', e => {
  if (e.target.files[0]) (platform === 'bark' ? loadBarkCSV : loadMVFCSV)(e.target.files[0]);
});

document.getElementById('upload-sample-btn').addEventListener('click', e => {
  e.stopPropagation();
  const btn  = document.getElementById('upload-sample-btn');
  const blob = new Blob([btn._csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = btn._name; a.click();
  URL.revokeObjectURL(url);
});
document.getElementById('upload-modal-close').addEventListener('click', closeUploadModal);
document.getElementById('upload-backdrop').addEventListener('click', closeUploadModal);
document.getElementById('import-csv-btn').addEventListener('click', () => {
  openUploadModal(platform);
});
document.getElementById('error-close').addEventListener('click', hideError);

/* ── EDM Campaign Management ────────────────────────────── */
const EDM_KEY = 'nxg_email_campaigns';
let customEmailCampaigns = JSON.parse(localStorage.getItem(EDM_KEY) || '[]');

function saveCustomCampaigns() {
  localStorage.setItem(EDM_KEY, JSON.stringify(customEmailCampaigns));
}

let edmEditId = null;

function openEDMModal(id = null) {
  edmEditId = id;
  const modal = document.getElementById('edm-modal');
  const err   = document.getElementById('edm-error');
  err.style.display = 'none';

  if (id) {
    const c = customEmailCampaigns.find(x => x.id === id);
    if (!c) return;
    document.getElementById('edm-modal-title').textContent  = 'Edit Campaign';
    document.getElementById('edm-name').value               = c.name        || '';
    document.getElementById('edm-type').value               = c.type        || 'Newsletter';
    document.getElementById('edm-subject').value            = c.subject     || '';
    document.getElementById('edm-preview-text').value       = c.previewText || '';
    document.getElementById('edm-from-name').value          = c.fromName    || '';
    document.getElementById('edm-from-email').value         = c.fromEmail   || '';
    document.getElementById('edm-recipients').value         = c.recipients  || '';
    document.getElementById('edm-date').value               = c.sendDate    || '';
    document.getElementById('edm-time').value               = c.sendTime    || '09:00';
    document.getElementById('edm-status').value             = c.status      || 'draft';
    document.getElementById('edm-body').value               = c.body        || '';
  } else {
    document.getElementById('edm-modal-title').textContent = 'Create Campaign';
    document.getElementById('edm-name').value          = '';
    document.getElementById('edm-type').value          = 'Newsletter';
    document.getElementById('edm-subject').value       = '';
    document.getElementById('edm-preview-text').value  = '';
    document.getElementById('edm-from-name').value     = '';
    document.getElementById('edm-from-email').value    = '';
    document.getElementById('edm-recipients').value    = '';
    document.getElementById('edm-date').value          = toDateStr(new Date());
    document.getElementById('edm-time').value          = '09:00';
    document.getElementById('edm-status').value        = 'draft';
    document.getElementById('edm-body').value          = '';
  }

  updateSubjectCount();
  showEDMEditor();
  modal.style.display = 'flex';
}

function closeEDMModal() {
  document.getElementById('edm-modal').style.display = 'none';
  edmEditId = null;
}

function updateSubjectCount() {
  const input = document.getElementById('edm-subject');
  const counter = document.getElementById('edm-subject-count');
  const len = input.value.length;
  counter.textContent = `${len} / 60`;
  counter.className = 'edm-char-count' + (len > 55 ? ' over' : len > 45 ? ' warn' : '');
}

function showEDMEditor() {
  document.getElementById('edm-body').style.display         = '';
  document.getElementById('edm-preview-pane').style.display = 'none';
  document.getElementById('edm-preview-toggle').textContent = '👁 Preview';
}

function saveEDM(status) {
  const name    = document.getElementById('edm-name').value.trim();
  const subject = document.getElementById('edm-subject').value.trim();
  const err     = document.getElementById('edm-error');

  if (!name)    { err.textContent = 'Campaign name is required.'; err.style.display = ''; return; }
  if (!subject) { err.textContent = 'Subject line is required.';  err.style.display = ''; return; }
  err.style.display = 'none';

  const campaign = {
    id:          edmEditId || Date.now().toString(),
    name,
    type:        document.getElementById('edm-type').value,
    subject,
    previewText: document.getElementById('edm-preview-text').value.trim(),
    fromName:    document.getElementById('edm-from-name').value.trim(),
    fromEmail:   document.getElementById('edm-from-email').value.trim(),
    recipients:  parseInt(document.getElementById('edm-recipients').value) || 0,
    sendDate:    document.getElementById('edm-date').value,
    sendTime:    document.getElementById('edm-time').value,
    status:      status || document.getElementById('edm-status').value,
    body:        document.getElementById('edm-body').value,
    created:     edmEditId ? (customEmailCampaigns.find(x => x.id === edmEditId)?.created || toDateStr(new Date())) : toDateStr(new Date()),
    // stats default to 0 for new campaigns
    sent: 0, opens: 0, clicks: 0, conv: 0, unsub: 0,
  };

  if (edmEditId) {
    const idx = customEmailCampaigns.findIndex(x => x.id === edmEditId);
    if (idx >= 0) {
      const existing = customEmailCampaigns[idx];
      campaign.sent  = existing.sent  || 0;
      campaign.opens = existing.opens || 0;
      campaign.clicks= existing.clicks|| 0;
      campaign.conv  = existing.conv  || 0;
      campaign.unsub = existing.unsub || 0;
      customEmailCampaigns[idx] = campaign;
    }
  } else {
    customEmailCampaigns.unshift(campaign);
  }

  saveCustomCampaigns();
  closeEDMModal();
  renderTable();
}

function deleteEDM(id) {
  if (!confirm('Delete this campaign?')) return;
  customEmailCampaigns = customEmailCampaigns.filter(x => x.id !== id);
  saveCustomCampaigns();
  renderTable();
}

function duplicateEDM(id) {
  const c = customEmailCampaigns.find(x => x.id === id);
  if (!c) return;
  const copy = { ...c, id: Date.now().toString(), name: c.name + ' (Copy)', status: 'draft', sent: 0, opens: 0, clicks: 0, conv: 0, unsub: 0, created: toDateStr(new Date()) };
  customEmailCampaigns.unshift(copy);
  saveCustomCampaigns();
  renderTable();
}

/* Toolbar insert helpers */
document.getElementById('edm-body').addEventListener('keydown', () => {});
document.querySelectorAll('.edm-fmt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const ta   = document.getElementById('edm-body');
    const tag  = btn.dataset.tag;
    const ins  = btn.dataset.insert;
    const start= ta.selectionStart, end = ta.selectionEnd;
    const sel  = ta.value.slice(start, end);
    let replacement = '';
    if (tag)  replacement = `<${tag}>${sel || 'text'}</${tag}>`;
    if (ins === 'h2') replacement = `<h2>${sel || 'Heading'}</h2>`;
    if (ins === 'h3') replacement = `<h3>${sel || 'Subheading'}</h3>`;
    if (ins === 'p')  replacement = `<p>${sel || 'Paragraph text'}</p>`;
    if (ins === 'a')  replacement = `<a href="https://">${sel || 'Click here'}</a>`;
    if (ins === 'img')replacement = `<img src="https://" alt="${sel || 'image'}" style="max-width:100%">`;
    ta.setRangeText(replacement, start, end, 'end');
    ta.focus();
  });
});

document.getElementById('edm-subject').addEventListener('input', updateSubjectCount);

document.getElementById('edm-preview-toggle').addEventListener('click', () => {
  const pane   = document.getElementById('edm-preview-pane');
  const ta     = document.getElementById('edm-body');
  const btn    = document.getElementById('edm-preview-toggle');
  const showing = pane.style.display !== 'none';
  if (showing) {
    pane.style.display = 'none';
    ta.style.display   = '';
    btn.textContent    = '👁 Preview';
  } else {
    pane.innerHTML     = ta.value || '<p style="color:#888">No content yet.</p>';
    pane.style.display = '';
    ta.style.display   = 'none';
    btn.textContent    = '✏ Edit';
  }
});

document.getElementById('create-edm-btn').addEventListener('click', () => openEDMModal());
document.getElementById('edm-modal-close').addEventListener('click', closeEDMModal);
document.getElementById('edm-cancel-btn').addEventListener('click',  closeEDMModal);
document.getElementById('edm-backdrop').addEventListener('click',    closeEDMModal);
document.getElementById('edm-save-draft').addEventListener('click',    () => saveEDM('draft'));
document.getElementById('edm-save-schedule').addEventListener('click', () => saveEDM('scheduled'));

/* ── Auth & User management ─────────────────────────────── */
const SESSION_KEY = 'nxg_auth';
const USERS_KEY   = 'nxg_users';

let currentUser    = null;
let _pendingMFAUser = null;   // user awaiting TOTP verification at login
let _mfaSetupState  = null;   // { username, secret } during setup flow

function loadUsers() {
  try {
    const d = localStorage.getItem(USERS_KEY);
    if (d) return JSON.parse(d);
  } catch {}
  return [{ username: 'admin', password: 'marketiq2025', role: 'admin', mfaSecret: null }];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function applyRoleUI() {
  const isAdmin = currentUser && currentUser.role === 'admin';
  document.getElementById('manage-users-btn').style.display = isAdmin ? '' : 'none';
  document.getElementById('clear-data-btn').style.display   = isAdmin ? '' : 'none';
}

const loginScreen = document.getElementById('login-screen');

function doLogin(user) {
  currentUser = user;
  loginScreen.classList.add('hidden');
  applyRoleUI();
  const barkSaved = loadFromLocal('bark');
  const mvfSaved  = loadFromLocal('mvf');
  if (barkSaved.length > 0) barkData = barkSaved;
  if (mvfSaved.length  > 0) mvfData  = mvfSaved;
  try { update(); } catch (e) { showError(e.message); }
}

function doLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  currentUser     = null;
  _pendingMFAUser = null;
  loginScreen.classList.remove('hidden');
  showLoginForm();
  Object.values(charts).forEach(c => c.destroy());
  charts = {};
}

/* ── MFA helpers ─────────────────────────────────────────── */
function generateTOTPSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => chars[b % 32]).join('');
}

function verifyTOTP(secret, token) {
  try {
    const totp  = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
    return totp.validate({ token: token.replace(/\s/g, ''), window: 1 }) !== null;
  } catch { return false; }
}

function getTOTPUri(secret, username) {
  return new OTPAuth.TOTP({
    issuer: 'NXG Analytics',
    label:  username,
    secret: OTPAuth.Secret.fromBase32(secret),
    digits: 6,
    period: 30,
  }).toString();
}

/* ── Login form / MFA step toggle ───────────────────────── */
function showLoginForm() {
  document.getElementById('login-form').style.display  = '';
  document.getElementById('mfa-step').style.display    = 'none';
  document.getElementById('login-title').textContent   = 'Sign in';
  document.getElementById('login-sub').textContent     = 'Analytics Portal';
  document.getElementById('mfa-code').value            = '';
  document.getElementById('mfa-error').classList.add('hidden');
}

function showMFAStep() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('mfa-step').style.display   = 'flex';
  document.getElementById('login-title').textContent  = 'Two-factor auth';
  document.getElementById('login-sub').textContent    = `Signed in as ${_pendingMFAUser.username}`;
  document.getElementById('mfa-code').focus();
}

/* ── Login submit ────────────────────────────────────────── */
document.getElementById('login-form').addEventListener('submit', e => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const users    = loadUsers();
  const user     = users.find(u => u.username === username && u.password === password);

  if (user) {
    errEl.classList.add('hidden');
    if (user.mfaSecret) {
      _pendingMFAUser = user;
      showMFAStep();
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: user.username, role: user.role }));
      doLogin(user);
    }
  } else {
    errEl.textContent = 'Invalid username or password.';
    errEl.classList.remove('hidden');
    document.getElementById('login-password').value = '';
  }
});

/* ── MFA verify on login ─────────────────────────────────── */
function verifyMFALogin() {
  const code  = document.getElementById('mfa-code').value.trim();
  const errEl = document.getElementById('mfa-error');
  if (!verifyTOTP(_pendingMFAUser.mfaSecret, code)) {
    errEl.textContent = 'Invalid code. Please try again.';
    errEl.classList.remove('hidden');
    document.getElementById('mfa-code').value = '';
    document.getElementById('mfa-code').focus();
    return;
  }
  const user = _pendingMFAUser;
  _pendingMFAUser = null;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: user.username, role: user.role }));
  showLoginForm();
  doLogin(user);
}

document.getElementById('mfa-verify-btn').addEventListener('click', verifyMFALogin);
document.getElementById('mfa-code').addEventListener('keydown', e => { if (e.key === 'Enter') verifyMFALogin(); });
document.getElementById('mfa-back-btn').addEventListener('click', () => { _pendingMFAUser = null; showLoginForm(); });

document.getElementById('logout-btn').addEventListener('click', doLogout);

document.getElementById('clear-data-btn').addEventListener('click', async () => {
  if (!confirm('Clear all imported data (Bark & MVF)? This cannot be undone.')) return;
  clearFromLocal('bark');
  clearFromLocal('mvf');
  barkData = [];
  mvfData  = [];
  update();
});

/* ── User modal ─────────────────────────────────────────── */
function openUserModal() {
  renderUserList();
  document.getElementById('user-modal').style.display = 'flex';
}
function closeUserModal_users() {
  document.getElementById('user-modal').style.display = 'none';
}

function renderUserList() {
  const users = loadUsers();
  const list  = document.getElementById('user-list');
  list.innerHTML = users.map((u, i) => `
    <div class="user-row">
      <div class="user-row-info">
        <span class="user-row-name">${u.username}</span>
        <span class="role-badge role-${u.role}">${u.role}</span>
        ${u.mfaSecret ? '<span class="mfa-badge">2FA</span>' : ''}
      </div>
      <div class="user-row-actions">
        <button class="mfa-toggle-btn ${u.mfaSecret ? 'disable' : 'enable'}" data-username="${u.username}">
          ${u.mfaSecret ? 'Disable 2FA' : 'Enable 2FA'}
        </button>
        ${u.username === currentUser.username
          ? '<span class="user-self-tag">You</span>'
          : `<button class="user-delete-btn" data-index="${i}">Delete</button>`}
      </div>
    </div>`).join('');

  list.querySelectorAll('.user-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const all = loadUsers();
      all.splice(parseInt(btn.dataset.index), 1);
      saveUsers(all);
      renderUserList();
    });
  });

  list.querySelectorAll('.mfa-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => openMFASetup(btn.dataset.username));
  });
}

document.getElementById('manage-users-btn').addEventListener('click', openUserModal);
document.getElementById('user-modal-close').addEventListener('click', closeUserModal_users);
document.getElementById('user-backdrop').addEventListener('click', closeUserModal_users);

document.getElementById('add-user-form').addEventListener('submit', e => {
  e.preventDefault();
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  const role     = document.getElementById('new-role').value;
  const errEl    = document.getElementById('add-user-error');

  if (!username || !password) {
    errEl.textContent = 'Username and password are required.';
    errEl.style.display = 'block';
    return;
  }
  const users = loadUsers();
  if (users.find(u => u.username === username)) {
    errEl.textContent = 'Username already exists.';
    errEl.style.display = 'block';
    return;
  }
  users.push({ username, password, role, mfaSecret: null });
  saveUsers(users);
  errEl.style.display = 'none';
  document.getElementById('new-username').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('new-role').value = 'user';
  renderUserList();
});

/* ── MFA setup modal ─────────────────────────────────────── */
function openMFASetup(username) {
  const users = loadUsers();
  const user  = users.find(u => u.username === username);
  _mfaSetupState = null;
  document.getElementById('mfa-setup-modal').style.display = 'flex';
  document.getElementById('mfa-setup-title').textContent = `2FA — ${username}`;

  if (user.mfaSecret) {
    renderMFADisable(username);
  } else {
    const secret = generateTOTPSecret();
    _mfaSetupState = { username, secret };
    renderMFAEnable(username, secret);
  }
}

function closeMFASetup() {
  document.getElementById('mfa-setup-modal').style.display = 'none';
  _mfaSetupState = null;
}

function renderMFAEnable(username, secret) {
  const body = document.getElementById('mfa-setup-body');
  body.innerHTML = `
    <div class="mfa-setup-steps">
      <div class="mfa-setup-step">
        <span class="mfa-step-num">Step 1 — Scan QR code</span>
        <p class="mfa-step-text">Open <strong>Google Authenticator</strong> or <strong>Authy</strong> and scan this code.</p>
        <div class="mfa-qr-box"><div id="mfa-qr-div"></div></div>
      </div>
      <div class="mfa-setup-step">
        <span class="mfa-step-num">Step 2 — Manual entry (alternative)</span>
        <p class="mfa-step-text">Or enter this key manually in your app:</p>
        <div class="mfa-secret-code">${secret.match(/.{1,4}/g).join(' ')}</div>
      </div>
      <div class="mfa-setup-step">
        <span class="mfa-step-num">Step 3 — Verify</span>
        <p class="mfa-step-text">Enter the 6-digit code from your app to confirm setup.</p>
        <div class="mfa-verify-row">
          <input type="text" id="mfa-setup-code" class="add-user-input" placeholder="000 000" maxlength="6" inputmode="numeric" autocomplete="off">
          <button type="button" class="add-user-btn" id="mfa-confirm-btn">Confirm</button>
        </div>
        <div class="mfa-setup-error" id="mfa-setup-error"></div>
      </div>
    </div>`;

  try {
    new QRCode(document.getElementById('mfa-qr-div'), {
      text:         getTOTPUri(secret, username),
      width:        180,
      height:       180,
      colorDark:    '#000000',
      colorLight:   '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch (err) { console.error('QR render failed:', err); }

  document.getElementById('mfa-confirm-btn').addEventListener('click', confirmMFAEnable);
  document.getElementById('mfa-setup-code').addEventListener('keydown', e => { if (e.key === 'Enter') confirmMFAEnable(); });
}

function confirmMFAEnable() {
  if (!_mfaSetupState) return;
  const code   = document.getElementById('mfa-setup-code').value.trim();
  const errEl  = document.getElementById('mfa-setup-error');
  if (!verifyTOTP(_mfaSetupState.secret, code)) {
    errEl.textContent = 'Code is incorrect — check your authenticator app and try again.';
    errEl.style.display = 'block';
    document.getElementById('mfa-setup-code').value = '';
    return;
  }
  const users = loadUsers();
  const user  = users.find(u => u.username === _mfaSetupState.username);
  if (user) { user.mfaSecret = _mfaSetupState.secret; saveUsers(users); }
  _mfaSetupState = null;
  closeMFASetup();
  renderUserList();
}

function renderMFADisable(username) {
  const body = document.getElementById('mfa-setup-body');
  body.innerHTML = `
    <div class="mfa-disable-box">
      <div class="mfa-enabled-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
        Two-factor authentication is enabled
      </div>
      <p class="mfa-step-text" style="color:var(--text-muted);font-size:13px">
        Enter the current 6-digit code from your authenticator app to disable 2FA.
      </p>
      <div class="mfa-verify-row">
        <input type="text" id="mfa-disable-code" class="add-user-input" placeholder="000 000" maxlength="6" inputmode="numeric" autocomplete="off">
        <button type="button" class="add-user-btn" id="mfa-disable-btn" style="background:var(--red)">Disable 2FA</button>
      </div>
      <div class="mfa-setup-error" id="mfa-setup-error"></div>
    </div>`;

  const doDisable = () => {
    const code  = document.getElementById('mfa-disable-code').value.trim();
    const errEl = document.getElementById('mfa-setup-error');
    const users = loadUsers();
    const user  = users.find(u => u.username === username);
    if (!user || !verifyTOTP(user.mfaSecret, code)) {
      errEl.textContent = 'Invalid code. Please try again.';
      errEl.style.display = 'block';
      document.getElementById('mfa-disable-code').value = '';
      return;
    }
    user.mfaSecret = null;
    saveUsers(users);
    closeMFASetup();
    renderUserList();
  };
  document.getElementById('mfa-disable-btn').addEventListener('click', doDisable);
  document.getElementById('mfa-disable-code').addEventListener('keydown', e => { if (e.key === 'Enter') doDisable(); });
}

document.getElementById('mfa-setup-close').addEventListener('click', closeMFASetup);
document.getElementById('mfa-setup-backdrop').addEventListener('click', closeMFASetup);

/* ── Init ───────────────────────────────────────────────── */
const _savedSession = sessionStorage.getItem(SESSION_KEY);
if (_savedSession) {
  try { doLogin(JSON.parse(_savedSession)); }
  catch { sessionStorage.removeItem(SESSION_KEY); }
}
// else: login screen stays visible, update() called after successful login
