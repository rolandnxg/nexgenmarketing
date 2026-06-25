
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
let gadsSubView      = 'campaigns'; // 'campaigns' | 'analysis' | 'keyword-analyzer'
let caStatusFilter   = 'all';       // 'all' | 'active' | 'paused'
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
;

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
  all:   { title: 'Dashboard',          sub: 'All platforms combined' },
  ga:    { title: 'Google Analytics',   sub: 'Website traffic & behaviour' },
  fb:    { title: 'Facebook Ads',       sub: 'Paid social performance' },
  gads:  { title: 'Google Ads',         sub: 'Search & display performance' },
  bark:  { title: 'Bark',               sub: 'Lead marketplace performance' },
  mvf:   { title: 'MVF',                sub: 'MVF lead generation performance' },
  email: { title: 'Email Marketing',    sub: 'Campaign performance & engagement' },
  leads: { title: 'Leads',             sub: 'Team lead cost & ROI' },
};

function renderHeader() {
  const m = PLATFORM_META[platform];
  document.getElementById('page-title').textContent    = m.title;
  document.getElementById('page-subtitle').textContent =
    (platform === 'gads' && gadsSubView === 'analysis')         ? 'Campaign-level insights & recommendations'
  : (platform === 'gads' && gadsSubView === 'keyword-analyzer') ? 'Negative Keyword Analyzer'
  : m.sub;
  document.getElementById('brand-select').style.display    = (platform === 'gads' || platform === 'ga') ? '' : 'none';
  document.getElementById('create-edm-btn').style.display  = platform === 'email' ? '' : 'none';
  document.getElementById('import-csv-btn').style.display = (platform === 'bark' || platform === 'mvf' || platform === 'leads') ? '' : 'none';
  document.getElementById('nka-toggle-btn').style.display  = 'none';
  document.getElementById('utm-lookup-btn').style.display  = platform === 'fb' ? '' : 'none';
  if (platform !== 'fb' && typeof window.hideUTMPanel === 'function') window.hideUTMPanel();
  const importBtn = document.getElementById('bark-import-btn');
  if (importBtn) importBtn.style.display = (platform === 'bark' && barkData.length > 0) ? '' : 'none';
  const mvfImportBtn = document.getElementById('mvf-import-btn');
  if (mvfImportBtn) mvfImportBtn.style.display = (platform === 'mvf' && mvfData.length > 0) ? '' : 'none';
}

/* ── Leads view ─────────────────────────────────────────── */
const LEADS_DEFAULT = [
  { team: 'SOHO',                  cost: 0, leadsWorked: null, roi: null, numSigned365: null, signed365: null },
  { team: 'Nexgen VIC',            cost: 0, leadsWorked: null, roi: null, numSigned365: null, signed365: null },
  { team: 'Nexgen NSW',            cost: 0, leadsWorked: null, roi: null, numSigned365: null, signed365: null },
  { team: 'Business Telecom NSW',  cost: 0, leadsWorked: null, roi: null, numSigned365: null, signed365: null },
  { team: 'Nexgen QLD',            cost: 0, leadsWorked: null, roi: null, numSigned365: null, signed365: null },
  { team: 'Nexgen SA',             cost: 0, leadsWorked: null, roi: null, numSigned365: null, signed365: null },
  { team: 'Nexgen WA',             cost: 0, leadsWorked: null, roi: null, numSigned365: null, signed365: null },
  { team: 'Business Telecom QLD',  cost: 0, leadsWorked: null, roi: null, numSigned365: null, signed365: null },
];
let leadsData = (() => {
  try { const s = localStorage.getItem('leads_data'); return s ? JSON.parse(s) : LEADS_DEFAULT; }
  catch { return LEADS_DEFAULT; }
})();

function renderLeadsView() {
  const isLeads = platform === 'leads';
  document.getElementById('leads-view').style.display = isLeads ? '' : 'none';
  document.getElementById('kpi-grid').style.display   = isLeads ? 'none' : '';
  document.querySelector('.charts-top').style.display  = isLeads ? 'none' : '';
  document.querySelector('.charts-bottom').style.display = isLeads ? 'none' : '';
  document.querySelector('.table-card').style.display  = isLeads ? 'none' : '';
  if (!isLeads) return;

  const total = leadsData.reduce((a, t) => a + t.cost, 0);
  const totalWorked    = leadsData.reduce((a, t) => a + (t.leadsWorked  ?? 0), 0);
  const totalNumSigned = leadsData.reduce((a, t) => a + (t.numSigned365 ?? 0), 0);
  document.getElementById('leads-table-body').innerHTML = [
    ...leadsData.map(t => `
      <tr>
        <td>${t.team}</td>
        <td class="lt-cost-cell">${fmt$(t.cost)}</td>
        <td class="lt-worked-cell">${t.leadsWorked != null ? t.leadsWorked : ''}</td>
        <td class="lt-roi-cell">${t.roi != null ? t.roi : ''}</td>
        <td class="lt-numsigned-cell">${t.numSigned365 != null ? t.numSigned365 : ''}</td>
        <td class="lt-signed-cell">${t.signed365 != null ? t.signed365 : ''}</td>
      </tr>`),
    `<tr class="lt-separator"><td colspan="6">GLOBAL Leads</td></tr>`,
  ].join('');

  document.getElementById('leads-table-foot').innerHTML = `
    <tr>
      <td><strong>Total</strong></td>
      <td class="lt-cost-cell">${fmt$(total)}</td>
      <td class="lt-worked-cell">${totalWorked > 0 ? totalWorked : ''}</td>
      <td class="lt-roi-cell"></td>
      <td class="lt-numsigned-cell">${totalNumSigned > 0 ? totalNumSigned : ''}</td>
      <td class="lt-signed-cell"></td>
    </tr>`;

  document.getElementById('leads-export-btn').onclick = () => {
    const rows = [['Team','Lead Cost','Total Leads Worked On','ROI','# Signed 365','Signed 365'], ...leadsData.map(t => [t.team, t.cost, t.leadsWorked ?? '', t.roi ?? '', t.numSigned365 ?? '', t.signed365 ?? ''])];
    const csv  = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = 'leads.csv';
    a.click();
  };
}


/* ── Campaign Analysis ──────────────────────────────────── */
function renderCampaignAnalysis() {
  const el = document.getElementById('gads-analysis-cards');
  const campaigns = caStatusFilter === 'all'
    ? gadsApiCampaigns
    : gadsApiCampaigns.filter(c => c.status === caStatusFilter);

  if (gadsApiCampaigns.length === 0) {
    el.innerHTML = '<div class="ca-empty">No campaign data available. Select an account and date range first.</div>';
    return;
  }
  if (campaigns.length === 0) {
    el.innerHTML = '<div class="ca-empty">No campaigns match the selected filter.</div>';
    return;
  }

  const totalSpend = campaigns.reduce((a, c) => a + c.spend, 0);
  const totalConv  = campaigns.reduce((a, c) => a + c.conv,  0);
  const totalImpr  = campaigns.reduce((a, c) => a + c.impressions, 0);
  const totalClicks= campaigns.reduce((a, c) => a + c.clicks, 0);
  const acctCpa    = totalConv  > 0 ? totalSpend / totalConv : 0;
  const acctCtr    = totalImpr  > 0 ? (totalClicks / totalImpr) * 100 : 0;

  el.innerHTML = campaigns.map(c => {
    const roas = c.spend > 0 && c.revenue > 0 ? c.revenue / c.spend : 0;
    const ctr  = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
    const cpa  = c.conv  > 0 ? c.spend / c.conv  : 0;
    const cpc  = c.clicks > 0 ? c.spend / c.clicks : 0;
    const cvr  = c.clicks > 0 ? (c.conv / c.clicks) * 100 : 0;

    const issues = [];
    const recs   = [];

    // Zero conversions with spend
    if (c.spend > 50 && c.conv === 0) {
      issues.push({ level: 'red', title: 'Zero conversions', detail: `Spent ${fmt$(c.spend)} with no conversions recorded.` });
      recs.push('Verify conversion tracking tags are firing on the thank-you page', 'Review landing page — ensure it loads fast and matches ad intent', 'Narrow keyword match types to phrase or exact to filter irrelevant searches', 'Check for disapproved ads inside this campaign', 'Add negative keywords to block unrelated traffic');
    }

    // ROAS check
    if (c.spend > 0 && c.revenue > 0) {
      if (roas < 1) {
        issues.push({ level: 'red', title: `Negative ROAS — ${roas.toFixed(2)}x`, detail: 'Spending more than the revenue generated.' });
        recs.push('Pause or significantly reduce budget until root cause is found', 'Review bid strategy — switch to Manual CPC to control spend', 'Identify and pause the highest-spend, lowest-conversion ad groups');
      } else if (roas < 2) {
        issues.push({ level: 'amber', title: `Low ROAS — ${roas.toFixed(2)}x`, detail: 'Below the recommended 2x minimum for profitable campaigns.' });
        recs.push('Increase bids on keywords that have historically converted', 'Improve landing page conversion rate with clearer CTA and trust signals', 'Test Target ROAS bidding if enough conversion history exists (30+ conversions/month)', 'Pause ad groups with highest spend and lowest ROAS');
      }
    } else if (c.spend > 0 && c.revenue === 0) {
      if (c.conv === 0) {
        // already handled above
      }
    }

    // CTR check
    if (c.impressions >= 200) {
      if (ctr < 0.5) {
        issues.push({ level: 'red', title: `Very low CTR — ${ctr.toFixed(2)}%`, detail: `Account average is ${acctCtr.toFixed(2)}%. Ads are not compelling enough to earn clicks.` });
        recs.push('Rewrite headlines — lead with a strong benefit or unique selling point', 'Use all available ad extensions (sitelinks, callouts, structured snippets, call)', 'Ensure keywords tightly match the ad copy — improve ad relevance', 'Check Quality Score; low relevance scores cap ad delivery');
      } else if (ctr < 2) {
        issues.push({ level: 'amber', title: `Low CTR — ${ctr.toFixed(2)}%`, detail: `Below the 2% benchmark. Room to improve ad engagement.` });
        recs.push('A/B test at least 3 headline variations per ad group', 'Add promotion extensions if running offers or discounts', 'Use dynamic keyword insertion carefully to boost relevance');
      }
    }

    // CPA vs $300 target
    const CPA_TARGET = 300;
    if (c.conv > 0) {
      if (cpa > CPA_TARGET * 2) {
        issues.push({ level: 'red', title: `CPA ${fmt$(cpa)} — critically over $${CPA_TARGET} target`, detail: `More than 2× the $${CPA_TARGET} CPA target. Every lead is costing too much to be profitable.` });
        recs.push(
          `Pause the highest-spend keywords that haven't converted in the last 30 days`,
          `Run a search terms report — add irrelevant queries as exact-match negatives to stop wasted spend`,
          `Switch to Manual CPC bidding and lower bids by 20–30% to reduce cost per click`,
          `Tighten keyword match types from broad to phrase or exact to attract higher-intent searches`,
          `Rewrite ad copy to pre-qualify leads — mention price, location, or service specifics to deter non-buyers`,
          `Improve the landing page: add a clear single CTA, reduce form fields to name/phone/email only`,
          `Add trust signals to the landing page: Google reviews, number of clients served, response-time guarantee`,
          `Install call tracking — many leads may be calling directly and not being counted as conversions`,
        );
      } else if (cpa > CPA_TARGET) {
        issues.push({ level: 'red', title: `CPA ${fmt$(cpa)} — over $${CPA_TARGET} target`, detail: `Exceeds the $${CPA_TARGET} CPA target. Action needed to reduce cost per lead.` });
        recs.push(
          `Review search terms report and add negative keywords to filter low-intent traffic`,
          `Pause or reduce bids on ad groups or keywords with CPA above $${CPA_TARGET}`,
          `Test a more specific landing page — one page per service/location converts better than a generic homepage`,
          `Add lead form extensions directly in Google Ads so prospects can enquire without leaving the SERP`,
          `A/B test headlines — leads respond better to outcome-focused copy ("Get a Quote in 60 Seconds")`,
          `Set a Target CPA bid strategy at $${CPA_TARGET} and give it 2–3 weeks to learn`,
          `Review device performance — if mobile CPA is high, apply a negative mobile bid adjustment`,
        );
      } else if (cpa <= CPA_TARGET * 0.7) {
        issues.push({ level: 'green', title: `CPA ${fmt$(cpa)} — well within $${CPA_TARGET} target`, detail: `Strong cost per lead. Consider scaling budget to acquire more leads at this rate.` });
        recs.push(
          `Increase daily budget by 20–30% — CPA is healthy and there is room to scale`,
          `Expand to similar audiences or lookalike segments to reach more potential leads`,
          `Add new ad groups targeting related service keywords to grow lead volume`,
        );
      }
    } else if (c.spend > 100 && c.conv === 0) {
      // zero conv already flagged above, but add CPA target context
      recs.push(`Target CPA for all campaigns is $${CPA_TARGET} — currently no conversions are being tracked, so CPA cannot be calculated`);
    }

    // Low conversion rate (enough clicks, low CVR)
    if (c.clicks >= 50 && cvr < 1 && c.conv > 0) {
      issues.push({ level: 'amber', title: `Low conversion rate — ${cvr.toFixed(2)}%`, detail: 'Clicks are not converting well. Landing page or offer may need improvement.' });
      recs.push('Run a heatmap or session recording on the landing page', 'Simplify the conversion form — reduce required fields', 'Add social proof (reviews, case studies, trust badges)', 'Ensure page load time is under 3 seconds on mobile');
    }

    // Low impressions with spend
    if (c.spend > 0 && c.impressions < 200) {
      issues.push({ level: 'amber', title: 'Low impressions — limited reach', detail: 'Campaign may be restricted by budget, bids, or targeting.' });
      recs.push('Check if campaign is limited by budget — increase daily cap if so', 'Review keyword bids — may be too low to win auctions', 'Broaden targeting: expand geo, add broad match keywords', 'Check ad scheduling — may be missing peak hours');
    }

    // Paused with spend
    if (c.status === 'paused' && c.spend > 0) {
      issues.push({ level: 'amber', title: 'Paused with recorded spend', detail: 'Campaign was paused but recorded spend in the selected period.' });
      recs.push('Confirm the pause is intentional and not accidental', 'Before reactivating, review performance in the period it was active', 'If reactivating, reset bids and monitor closely for the first 48 hours');
    }

    const hasIssues = issues.length > 0;
    const worstLevel = issues.some(i => i.level === 'red') ? 'red' : issues.some(i => i.level === 'amber') ? 'amber' : 'green';
    const statusColor = c.status === 'active' ? 'green' : 'amber';

    const metricsHtml = `
      <div class="ca-metrics">
        <div class="ca-metric"><span class="ca-metric-val">${fmt$(c.spend)}</span><span class="ca-metric-lbl">Spend</span></div>
        <div class="ca-metric"><span class="ca-metric-val">${fmtN(c.impressions)}</span><span class="ca-metric-lbl">Impressions</span></div>
        <div class="ca-metric"><span class="ca-metric-val">${fmtN(c.clicks)}</span><span class="ca-metric-lbl">Clicks</span></div>
        <div class="ca-metric"><span class="ca-metric-val">${c.conv > 0 ? fmtN(c.conv) : '—'}</span><span class="ca-metric-lbl">Conv.</span></div>
        <div class="ca-metric"><span class="ca-metric-val">${ctr > 0 ? ctr.toFixed(2) + '%' : '—'}</span><span class="ca-metric-lbl">CTR</span></div>
        <div class="ca-metric"><span class="ca-metric-val">${roas > 0 ? roas.toFixed(2) + 'x' : '—'}</span><span class="ca-metric-lbl">ROAS</span></div>
        <div class="ca-metric ${cpa > 300 ? 'ca-metric--over' : cpa > 0 ? 'ca-metric--ok' : ''}"><span class="ca-metric-val">${cpa > 0 ? fmt$(cpa) : '—'}</span><span class="ca-metric-lbl">CPA <span class="ca-target-label">(target &lt;$300)</span></span></div>
        <div class="ca-metric"><span class="ca-metric-val">${cpc > 0 ? fmt$(cpc) : '—'}</span><span class="ca-metric-lbl">CPC</span></div>
      </div>`;

    const issuesHtml = hasIssues
      ? `<div class="ca-section-title">Issues Found</div>
         <div class="ca-issues">
           ${issues.map(i => `
             <div class="ca-issue ca-issue--${i.level}">
               <div class="ca-issue-dot ca-issue-dot--${i.level}"></div>
               <div><div class="ca-issue-title">${i.title}</div><div class="ca-issue-detail">${i.detail}</div></div>
             </div>`).join('')}
         </div>`
      : '';

    const allRecs = [...new Set(recs)];
    const recsHtml = allRecs.length > 0
      ? `<div class="ca-section-title">Recommendations</div>
         <ol class="ca-recs">
           ${allRecs.map(r => `<li>${r}</li>`).join('')}
         </ol>`
      : '';

    const healthyHtml = !hasIssues
      ? `<div class="ca-healthy"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> No issues detected — campaign looks healthy</div>`
      : '';

    return `
      <div class="ca-card ca-card--${worstLevel}">
        <div class="ca-header">
          <div class="ca-name">${c.name}</div>
          <span class="ca-status ca-status--${statusColor}">${c.status}</span>
        </div>
        ${metricsHtml}
        ${issuesHtml}
        ${recsHtml}
        ${healthyHtml}
      </div>`;
  }).join('');
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

  renderLeadsView();
  if (platform === 'leads') return;

  // Google Ads sub-views
  const isGadsAnalysis  = platform === 'gads' && gadsSubView === 'analysis';
  const isGadsKeywords  = platform === 'gads' && gadsSubView === 'keyword-analyzer';
  const isGadsSubView   = isGadsAnalysis || isGadsKeywords;
  document.getElementById('gads-analysis-panel').style.display    = isGadsAnalysis ? '' : 'none';
  document.getElementById('nka-panel').style.display              = isGadsKeywords ? '' : 'none';
  document.getElementById('keyword-analyzer-panel').style.display = 'none';
  if (isGadsSubView) {
    document.getElementById('kpi-grid').style.display = 'none';
    document.querySelector('.charts-top').style.display = 'none';
    document.querySelector('.charts-bottom').style.display = 'none';
    document.querySelector('.table-card').style.display = 'none';
    if (isGadsAnalysis) renderCampaignAnalysis();
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

/* ── Negative Keyword Analyzer ──────────────────────────── */
(function() {

  /* ---- Pattern library ---- */
  const EMPLOYMENT   = /\b(jobs?|careers?|hiring|salary|salaries|employment|resume|vacancy|vacancies|recruitment|glassdoor|indeed|work for|work at|apprentice|internship|traineeship)\b/i;
  const NAVIGATION   = /\b(login|log in|sign in|account|portal|dashboard|password|reset|my account)\b/i;
  const DIY_EDU      = /\b(how to|tutorial|diy|course|training|template|example|guide|wiki|youtube|learn|certification|exam|study)\b/i;
  const DOCUMENT     = /\b(pdf|template|worksheet|checklist|ppt|powerpoint|ebook|whitepaper|download free)\b/i;
  const FREE         = /\b(free|freeware|open source|no cost|gratis|complimentary)\b/i;
  const PRICE_RESEARCH = /\b(how much|what does|cost of|price of|average cost|cost to|pricing guide)\b/i;
  const COMPARISON   = /\bvs\.?\b|\bversus\b|\bcompare\b|\balternative\b|\bcomparison\b/i;
  const COMMERCIAL_INV = /\b(best|top|reviews?|near me|recommended|leading|#1|number one)\b/i;

  /* ---- Classify a single term ---- */
  function classify(term, opts) {
    const t     = term.toLowerCase();
    const brand = (opts.brand || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    const svc   = (opts.service || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    const all   = (opts.servicesAll || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

    // Brand protection
    if (brand.some(b => b && t.includes(b))) return { action: 'KEEP', category: 'Brand', level: 'green', confidence: 1.0, rationale: 'Contains brand term — never negate' };

    // Primary service protection
    if (svc.some(s => s && t.includes(s))) {
      if (COMMERCIAL_INV.test(t)) return { action: 'KEEP', category: 'Commercial Intent', level: 'green', confidence: 0.95, rationale: 'Primary service + buying intent signals' };
      if (COMPARISON.test(t)) return { action: 'KEEP', category: 'Comparison', level: 'green', confidence: 0.90, rationale: 'Comparison query with your service — high intent' };
    }

    // All services protection
    if (all.some(s => s && t.includes(s))) return { action: 'KEEP', category: 'Service Offered', level: 'green', confidence: 0.90, rationale: 'Matches a service you offer' };

    // Universal waste patterns
    if (EMPLOYMENT.test(t))  return { action: 'NEGATIVE', category: 'Employment Intent', level: 'red',   confidence: 0.95, rationale: 'User seeking work, not purchasing', matchType: 'BROAD',  negLevel: 'Account' };
    if (NAVIGATION.test(t))  return { action: 'NEGATIVE', category: 'Navigation/Login',  level: 'red',   confidence: 0.90, rationale: 'Existing customer accessing account', matchType: 'PHRASE', negLevel: 'Account' };
    if (DOCUMENT.test(t))    return { action: 'NEGATIVE', category: 'Document Seeking',  level: 'red',   confidence: 0.90, rationale: 'Seeking downloadable resource, not service', matchType: 'BROAD', negLevel: 'Account' };
    if (DIY_EDU.test(t))     return { action: 'NEGATIVE', category: 'DIY / Educational', level: 'amber', confidence: 0.85, rationale: 'Seeking free information, not paid service', matchType: 'PHRASE', negLevel: 'Campaign' };
    if (FREE.test(t))        return { action: 'NEGATIVE', category: 'Free Seekers',      level: 'amber', confidence: 0.80, rationale: 'User seeking free solution — poor intent match', matchType: 'PHRASE', negLevel: 'Campaign' };

    // Comparison without service = monitor
    if (COMPARISON.test(t)) return { action: 'KEEP', category: 'Comparison', level: 'green', confidence: 0.75, rationale: 'Comparison query — high commercial intent' };

    // Commercial investigation — protect
    if (COMMERCIAL_INV.test(t)) return { action: 'KEEP', category: 'Commercial Intent', level: 'green', confidence: 0.80, rationale: 'Buying intent signals — commercial investigation' };

    // Price research — monitor
    if (PRICE_RESEARCH.test(t)) return { action: 'MONITOR', category: 'Price Research', level: 'amber', confidence: 0.55, rationale: 'Mid-funnel intent — monitor conversions before negating', matchType: 'PHRASE', negLevel: 'Campaign' };

    return null; // no pattern match
  }

  /* ---- Performance-based waste ---- */
  function perfWaste(row, acctAvgCpa) {
    const { clicks, cost, conv } = row;
    if (clicks < 20) return null; // insufficient data
    if (conv === 0 && clicks >= 50) return { action: 'NEGATIVE', category: 'Zero Conversions', level: 'red', confidence: 0.75, rationale: `${clicks} clicks, 0 conversions — sufficient data to confirm poor performance`, matchType: 'PHRASE', negLevel: 'Campaign' };
    if (conv === 0 && clicks >= 20) return { action: 'MONITOR', category: 'Low Performance', level: 'amber', confidence: 0.55, rationale: `${clicks} clicks, 0 conversions — more data needed for certainty`, matchType: 'PHRASE', negLevel: 'Campaign' };
    if (conv > 0 && acctAvgCpa > 0) {
      const cpa = cost / conv;
      if (cpa > acctAvgCpa * 2) return { action: 'MONITOR', category: 'High CPA', level: 'amber', confidence: 0.60, rationale: `CPA ${fmt$(cpa)} is 2× account average (${fmt$(acctAvgCpa)}) — review bid strategy`, matchType: 'PHRASE', negLevel: 'Campaign' };
    }
    return null;
  }

  /* ---- Format match type for Google Ads ---- */
  function fmtMatch(kw, matchType) {
    if (matchType === 'PHRASE') return `"${kw}"`;
    if (matchType === 'EXACT')  return `[${kw}]`;
    return kw; // BROAD
  }

  /* ---- Parse CSV ---- */
  function parseSearchTerms(raw) {
    const lines = raw.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,'').toLowerCase());
    const iSearch = headers.findIndex(h => h.includes('search term') || h.includes('query') || h === 'term' || h === 'keyword');
    const iClicks = headers.findIndex(h => h.includes('click'));
    const iCost   = headers.findIndex(h => h.includes('cost') || h.includes('spend'));
    const iConv   = headers.findIndex(h => h.includes('conv'));
    const iImpr   = headers.findIndex(h => h.includes('impr'));
    if (iSearch === -1) throw new Error('Could not find "Search term" column. Ensure your CSV has that header.');
    return lines.slice(1).map(line => {
      const cells = line.split(',').map(c => c.trim().replace(/"/g,''));
      return {
        term:  cells[iSearch] || '',
        clicks: iClicks >= 0 ? parseFloat(cells[iClicks]) || 0 : 0,
        cost:   iCost   >= 0 ? parseFloat(cells[iCost])   || 0 : 0,
        conv:   iConv   >= 0 ? parseFloat(cells[iConv])   || 0 : 0,
        impr:   iImpr   >= 0 ? parseFloat(cells[iImpr])   || 0 : 0,
      };
    }).filter(r => r.term);
  }

  /* ---- Run analysis ---- */
  function analyze(rows, opts) {
    const totalCost = rows.reduce((a, r) => a + r.cost, 0);
    const totalConv = rows.reduce((a, r) => a + r.conv, 0);
    const totalClicks = rows.reduce((a, r) => a + r.clicks, 0);
    const acctAvgCpa = totalConv > 0 ? totalCost / totalConv : 0;

    const results = rows.map(row => {
      const pattern = classify(row.term, opts);
      const perf    = !pattern || pattern.action === 'KEEP' ? null : perfWaste(row, acctAvgCpa);
      const result  = pattern || perf || { action: 'MONITOR', category: 'Unclassified', level: 'grey', confidence: 0.40, rationale: 'No pattern match — monitor for performance signals' };
      // Override with perf if pattern says monitor but perf says negative
      const final = (pattern && pattern.action === 'NEGATIVE') ? pattern
                  : (perf   && perf.action   === 'NEGATIVE') ? perf
                  : pattern || perf || result;
      return { ...row, ...final };
    });

    return { results, totalCost, totalConv, totalClicks, acctAvgCpa };
  }

  /* ---- Group results ---- */
  function groupResults(results) {
    const groups = {};
    for (const r of results) {
      const key = `${r.action}__${r.category}`;
      if (!groups[key]) groups[key] = { action: r.action, category: r.category, level: r.level, items: [] };
      groups[key].items.push(r);
    }
    // Sort: NEGATIVE red first, NEGATIVE amber, MONITOR, KEEP
    const order = { 'NEGATIVE__red': 0, 'NEGATIVE__amber': 1, 'MONITOR__amber': 2, 'KEEP__green': 3, 'MONITOR__grey': 4 };
    return Object.values(groups).sort((a, b) => {
      const ka = `${a.action}__${a.level}`;
      const kb = `${b.action}__${b.level}`;
      return (order[ka] ?? 5) - (order[kb] ?? 5);
    });
  }

  /* ---- Render results ---- */
  function renderResults({ results, totalCost }) {
    const negatives = results.filter(r => r.action === 'NEGATIVE');
    const monitors  = results.filter(r => r.action === 'MONITOR');
    const keeps     = results.filter(r => r.action === 'KEEP');
    const flaggedSpend = negatives.reduce((a, r) => a + r.cost, 0);

    document.getElementById('nka-summary').innerHTML = `
      <div class="nka-stat"><div class="nka-stat-value">${results.length}</div><div class="nka-stat-label">Terms Analysed</div></div>
      <div class="nka-stat"><div class="nka-stat-value red">${negatives.length}</div><div class="nka-stat-label">Negative Recs</div></div>
      <div class="nka-stat"><div class="nka-stat-value amber">${monitors.length}</div><div class="nka-stat-label">Monitor</div></div>
      <div class="nka-stat"><div class="nka-stat-value green">${fmt$(flaggedSpend)}</div><div class="nka-stat-label">Flagged Spend</div></div>
    `;

    const groups = groupResults(results);
    const emojiMap = { red: '🔴', amber: '🟠', green: '🟢', grey: '⚪' };
    const actionLabel = { NEGATIVE: 'Negative', MONITOR: 'Monitor', KEEP: 'Keep' };

    document.getElementById('nka-groups').innerHTML = groups.map((g, gi) => {
      const groupSpend = g.items.reduce((a, r) => a + r.cost, 0);
      const negItems   = g.items.filter(r => r.action === 'NEGATIVE');
      const copyList   = negItems.map(r => fmtMatch(r.term, r.matchType || 'PHRASE')).join('\n');

      const rows = g.items.map(r => `
        <tr>
          <td>${r.term}</td>
          <td>${r.clicks || '—'}</td>
          <td>${r.cost > 0 ? fmt$(r.cost) : '—'}</td>
          <td>${r.conv  > 0 ? r.conv : '—'}</td>
          <td><span class="nka-badge ${r.level}">${actionLabel[r.action]}</span></td>
          <td>${r.matchType ? fmtMatch(r.term, r.matchType) : '—'}</td>
          <td>${r.negLevel || '—'}</td>
          <td class="nka-conf">${(r.confidence * 100).toFixed(0)}%</td>
          <td style="max-width:200px;font-size:11px;color:var(--text-faint)">${r.rationale}</td>
        </tr>`).join('');

      return `
        <div class="nka-group">
          <div class="nka-group-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
            <span>${emojiMap[g.level] || '⚪'}</span>
            <span class="nka-group-title">${g.category} (${g.items.length} terms${groupSpend > 0 ? ', ' + fmt$(groupSpend) + ' spend' : ''})</span>
            <span class="nka-group-meta">${g.action}</span>
          </div>
          <div class="nka-group-body" style="display:${gi < 3 ? 'block' : 'none'}">
            <div class="table-wrap"><table class="nka-term-table">
              <thead><tr><th>Search Term</th><th>Clicks</th><th>Cost</th><th>Conv</th><th>Action</th><th>Negative</th><th>Level</th><th>Conf.</th><th>Rationale</th></tr></thead>
              <tbody>${rows}</tbody>
            </table></div>
            ${copyList ? `<div class="nka-copy-block"><button class="nka-copy-btn" onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)})">Copy</button><pre>${copyList}</pre></div>` : ''}
          </div>
        </div>`;
    }).join('');

    document.getElementById('nka-context').style.display = 'none';
    document.getElementById('nka-results').style.display  = '';

    // Copy all negatives
    const allNeg = results.filter(r => r.action === 'NEGATIVE').map(r => fmtMatch(r.term, r.matchType || 'PHRASE')).join('\n');
    document.getElementById('nka-copy-all-btn').onclick = () => {
      navigator.clipboard.writeText(allNeg).then(() => {
        const btn = document.getElementById('nka-copy-all-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy All Negatives', 1500);
      });
    };
  }

  /* ---- Wire up UI ---- */
  let rawData = '';

  // Dropzone
  const dropzone = document.getElementById('nka-dropzone');
  const fileInput = document.getElementById('nka-file');
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault(); dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) { const r = new FileReader(); r.onload = ev => { rawData = ev.target.result; document.getElementById('nka-paste').value = rawData; }; r.readAsText(file); }
  });
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) { const r = new FileReader(); r.onload = ev => { rawData = ev.target.result; document.getElementById('nka-paste').value = rawData; }; r.readAsText(file); }
  });

  // Sample CSV
  document.getElementById('nka-sample-btn').addEventListener('click', () => {
    const sample = `Search term,Clicks,Cost,Conversions,Impressions
google ads management services,45,180.50,3,620
how to run google ads,22,88.00,0,310
google ads jobs sydney,18,72.00,0,240
google ads tutorial free,15,60.00,0,200
best google ads agency near me,12,48.00,1,180
google ads login,10,40.00,0,150
competitor agency name,9,36.00,0,130
google ads salary australia,8,32.00,0,120
google ads template pdf,7,28.00,0,105
ppc management cost,6,24.00,0,90
google ads training course,5,20.00,0,75
cheap google ads,4,16.00,0,60
google ads vs facebook ads,3,12.00,0,45
do it yourself google ads,3,12.00,0,45
google ads certification exam,2,8.00,0,30`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'search-terms-sample.csv'; a.click();
  });

  // Analyze
  document.getElementById('nka-analyze-btn').addEventListener('click', () => {
    const paste = document.getElementById('nka-paste').value.trim();
    const data  = paste || rawData;
    if (!data) { alert('Please upload a CSV or paste search term data first.'); return; }
    const service = document.getElementById('nka-service').value.trim();
    if (!service) { alert('Please enter your primary service keywords.'); return; }
    try {
      const rows = parseSearchTerms(data);
      if (rows.length === 0) throw new Error('No rows found. Check your CSV format.');
      const opts = {
        service:      service,
        brand:        document.getElementById('nka-brand').value,
        servicesAll:  document.getElementById('nka-services-all').value,
        compStrategy: document.getElementById('nka-competitor-strategy').value,
      };
      const analysis = analyze(rows, opts);
      renderResults(analysis);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });

  // Reset
  document.getElementById('nka-reset-btn').addEventListener('click', () => {
    rawData = '';
    document.getElementById('nka-paste').value = '';
    document.getElementById('nka-file').value  = '';
    document.getElementById('nka-context').style.display = '';
    document.getElementById('nka-results').style.display  = 'none';
  });

})();

/* ── UTM Lookup (FB tab) ────────────────────────────────── */
(function () {
  let utmRows = [];

  const isNumericId = v => /^\d{10,}$/.test(v.trim());

  function parseUTMs(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const results = [];
    let rowNum = 0;

    lines.forEach(line => {
      let rawUrl = line;
      if (!rawUrl.startsWith('http')) {
        const parts = line.split(',');
        const urlCell = parts.find(p => p.trim().startsWith('http'));
        if (urlCell) rawUrl = urlCell.trim().replace(/^"|"$/g, '');
        else return;
      }

      let url;
      try { url = new URL(rawUrl); } catch { return; }

      rowNum++;
      const p = url.searchParams;
      results.push({
        num:        rowNum,
        campaignRaw: p.get('utm_campaign') || '',
        adsetRaw:    p.get('utm_content')  || '',
        adRaw:       p.get('utm_term') || p.get('utm_ad') || '',
        source:      p.get('utm_source')   || '',
        medium:      p.get('utm_medium')   || '',
        url:         rawUrl,
        campaign:    '',
        adset:       '',
        ad:          '',
      });
    });

    return results;
  }

  /* Batch-resolve FB IDs → names using the Graph API ids= parameter */
  async function resolveIds(rows) {
    const token = FB_CONFIG.accessToken;
    if (!token) return;

    // Collect unique numeric IDs across all three fields
    const idSet = new Set();
    rows.forEach(r => {
      if (isNumericId(r.campaignRaw)) idSet.add(r.campaignRaw.trim());
      if (isNumericId(r.adsetRaw))    idSet.add(r.adsetRaw.trim());
      if (isNumericId(r.adRaw))       idSet.add(r.adRaw.trim());
    });

    if (idSet.size === 0) {
      // No IDs to resolve — values are already names
      rows.forEach(r => {
        r.campaign = r.campaignRaw;
        r.adset    = r.adsetRaw;
        r.ad       = r.adRaw;
      });
      return;
    }

    // FB Graph API allows up to 50 IDs per request
    const idArr    = [...idSet];
    const nameMap  = {};
    const CHUNK    = 50;

    for (let i = 0; i < idArr.length; i += CHUNK) {
      const chunk  = idArr.slice(i, i + CHUNK).join(',');
      const url    = `${FB_BASE}/?ids=${chunk}&fields=name&access_token=${token}`;
      try {
        const res  = await fetch(url);
        const data = await res.json();
        if (data.error) { console.warn('[UTM resolve]', data.error.message); continue; }
        Object.entries(data).forEach(([id, obj]) => {
          if (obj && obj.name) nameMap[id] = obj.name;
        });
      } catch (e) { console.warn('[UTM resolve fetch]', e.message); }
    }

    rows.forEach(r => {
      r.campaign = isNumericId(r.campaignRaw) ? (nameMap[r.campaignRaw.trim()] || r.campaignRaw) : r.campaignRaw;
      r.adset    = isNumericId(r.adsetRaw)    ? (nameMap[r.adsetRaw.trim()]    || r.adsetRaw)    : r.adsetRaw;
      r.ad       = isNumericId(r.adRaw)       ? (nameMap[r.adRaw.trim()]       || r.adRaw)       : r.adRaw;
    });
  }

  function renderUTMResults(rows) {
    utmRows = rows;
    const mismatched = rows.filter(r => !r.campaign && !r.adset && !r.ad).length;

    document.getElementById('utm-summary').innerHTML = `
      <div class="nka-stat"><div class="nka-stat-value">${rows.length}</div><div class="nka-stat-label">URLs Parsed</div></div>
      <div class="nka-stat"><div class="nka-stat-value ${rows.filter(r=>r.campaign).length>0?'green':'amber'}">${rows.filter(r=>r.campaign).length}</div><div class="nka-stat-label">Have Campaign</div></div>
      <div class="nka-stat"><div class="nka-stat-value ${rows.filter(r=>r.adset).length>0?'green':'amber'}">${rows.filter(r=>r.adset).length}</div><div class="nka-stat-label">Have Ad Set</div></div>
      <div class="nka-stat"><div class="nka-stat-value ${mismatched===0?'green':'amber'}">${mismatched}</div><div class="nka-stat-label">No UTMs Found</div></div>
    `;

    const cell = (name, rawId) => {
      if (!name) return '<span style="color:var(--text-faint)">—</span>';
      const showId = isNumericId(rawId) && name !== rawId ? `` : '';
      return `<span>${name}</span>${showId}`;
    };

    document.getElementById('utm-table-body').innerHTML = rows.map(r => `
      <tr>
        <td style="color:var(--text-faint)">${r.num}</td>
        <td>${cell(r.campaign, r.campaignRaw)}</td>
        <td>${cell(r.adset,    r.adsetRaw)}</td>
        <td>${cell(r.ad,       r.adRaw)}</td>
        <td>${r.source || '<span style="color:var(--text-faint)">—</span>'}</td>
        <td>${r.medium || '<span style="color:var(--text-faint)">—</span>'}</td>
        <td><span style="font-size:11px;color:var(--text-faint);word-break:break-all">${r.url.length > 60 ? r.url.slice(0, 60) + '…' : r.url}</span></td>
      </tr>`).join('');

    document.getElementById('utm-input-area').style.display = 'none';
    document.getElementById('utm-results').style.display    = '';
  }

  // File drop
  const dropzone  = document.getElementById('utm-dropzone');
  const fileInput = document.getElementById('utm-file');
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault(); dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) { const r = new FileReader(); r.onload = ev => { document.getElementById('utm-paste').value = ev.target.result; }; r.readAsText(file); }
  });
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) { const r = new FileReader(); r.onload = ev => { document.getElementById('utm-paste').value = ev.target.result; }; r.readAsText(file); }
  });

  // Parse + resolve
  document.getElementById('utm-analyze-btn').addEventListener('click', async () => {
    const text = document.getElementById('utm-paste').value.trim();
    if (!text) { alert('Please paste URLs or upload a file first.'); return; }
    const rows = parseUTMs(text);
    if (rows.length === 0) { alert('No valid URLs found. Make sure each line starts with http.'); return; }

    const btn = document.getElementById('utm-analyze-btn');
    btn.textContent = 'Resolving IDs…';
    btn.disabled = true;
    try {
      await resolveIds(rows);
    } finally {
      btn.textContent = 'Parse UTMs';
      btn.disabled = false;
    }
    renderUTMResults(rows);
  });

  // Clear
  document.getElementById('utm-clear-btn').addEventListener('click', () => {
    document.getElementById('utm-paste').value = '';
    document.getElementById('utm-file').value  = '';
  });

  // Reset
  document.getElementById('utm-reset-btn').addEventListener('click', () => {
    utmRows = [];
    document.getElementById('utm-paste').value = '';
    document.getElementById('utm-file').value  = '';
    document.getElementById('utm-input-area').style.display = '';
    document.getElementById('utm-results').style.display    = 'none';
  });

  // Export CSV
  document.getElementById('utm-export-btn').addEventListener('click', () => {
    const headers = ['#', 'Campaign Name', 'Ad Set Name', 'Ad Name', 'Source', 'Medium', 'URL'];
    const lines   = [headers, ...utmRows.map(r => [r.num, r.campaign, r.adset, r.ad, r.source, r.medium, r.url])];
    const csv     = lines.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = 'utm-lookup.csv';
    a.click();
  });

  window.toggleUTMPanel = function () {
    const panel = document.getElementById('utm-panel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : '';
    const btn = document.getElementById('utm-lookup-btn');
    btn.style.background = isVisible ? '' : 'var(--accent)';
    btn.style.color      = isVisible ? '' : '#fff';
  };

  window.hideUTMPanel = function () {
    document.getElementById('utm-panel').style.display = 'none';
    const btn = document.getElementById('utm-lookup-btn');
    if (btn) { btn.style.background = ''; btn.style.color = ''; }
  };
})();

/* ── Event listeners ────────────────────────────────────── */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    platform = btn.dataset.platform;
    // Show/hide gads sub-nav
    const subnav = document.getElementById('gads-subnav');
    if (subnav) subnav.style.display = platform === 'gads' ? '' : 'none';
    // Reset sub-view when switching away from gads
    if (platform !== 'gads') gadsSubView = 'campaigns';
    closeUploadModal();
    update();
  });
});

// Google Ads sub-nav
document.querySelectorAll('.sub-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sub-nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gadsSubView = btn.dataset.sub;
    caStatusFilter = 'all';
    document.querySelectorAll('.ca-filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.ca-filter-btn[data-filter="all"]').classList.add('active');
    update();
  });
});

document.querySelectorAll('.ca-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ca-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    caStatusFilter = btn.dataset.filter;
    renderCampaignAnalysis();
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

/* ── Leads CSV import ───────────────────────────────────── */
function loadLeadsCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const lines = e.target.result.trim().split('\n').filter(Boolean);
      if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const iTeam      = headers.indexOf('team');
      const iCost      = headers.indexOf('cost');
      const iWorked    = headers.indexOf('leadsworked');
      const iRoi       = headers.indexOf('roi');
      const iNumSigned = headers.indexOf('numsigned365');
      const iS365      = headers.indexOf('signed365');
      if (iTeam === -1 || iCost === -1) throw new Error('CSV must have "team" and "cost" columns.');
      const parsed = lines.slice(1).map(line => {
        const cells       = line.split(',');
        const cost        = parseFloat(cells[iCost]) || 0;
        const leadsWorked = iWorked    >= 0 && cells[iWorked]?.trim()    !== '' ? parseFloat(cells[iWorked])    : null;
        const roi         = iRoi       >= 0 && cells[iRoi]?.trim()       !== '' ? parseFloat(cells[iRoi])       : null;
        const numSigned365 = iNumSigned >= 0 && cells[iNumSigned]?.trim() !== '' ? parseFloat(cells[iNumSigned]) : null;
        const s365        = iS365      >= 0 && cells[iS365]?.trim()      !== '' ? parseFloat(cells[iS365])      : null;
        return { team: cells[iTeam].trim(), cost, leadsWorked, roi, numSigned365, signed365: s365 };
      }).filter(r => r.team);
      if (parsed.length === 0) throw new Error('No valid rows found.');
      leadsData = parsed;
      localStorage.setItem('leads_data', JSON.stringify(leadsData));
      closeUploadModal();
      update();
    } catch (err) {
      showError('Leads CSV: ' + err.message);
    }
  };
  reader.readAsText(file);
}

/* ── Shared upload modal ────────────────────────────────── */
let _uploadColor = '#06b6d4';

function openUploadModal(p) {
  _uploadColor = p === 'bark' ? '#06b6d4' : p === 'leads' ? '#10b981' : '#f97316';
  const name   = p === 'bark' ? 'Bark' : p === 'leads' ? 'Leads' : 'MVF';
  const leadsSample = [
    'team,cost,leadsWorked,roi,numSigned365,signed365',
    'SOHO,14708,45,0.65,3,12',
    'Nexgen VIC,3023,18,,2,8',
    'Nexgen NSW,1677,12,,1,5',
    'Business Telecom NSW,877,9,,1,3',
    'Nexgen QLD,210,5,34.19,1,1',
    'Nexgen SA,938,10,,1,2',
    'Nexgen WA,1152,14,,2,4',
    'Business Telecom QLD,89,3,,0,1',
  ].join('\n');
  const samples = {
    bark:  ['date,uid,size,spend,leads,revenue,category','01/05/2025,BK-001,Small,250.00,5,4500.00,Phone Systems','02/05/2025,BK-002,Medium,180.00,3,2700.00,VoIP','03/05/2025,BK-003,Large,310.00,7,6300.00,Phone Systems','04/05/2025,BK-004,Small,95.00,2,1800.00,Phone Systems','05/05/2025,BK-005,Medium,220.00,4,3600.00,VoIP'].join('\n'),
    mvf:   ['date,uid,size,spend,leads,revenue,category','01/05/2025,MV-001,Medium,320.00,8,7200.00,Business Phones','02/05/2025,MV-002,Small,210.00,5,4500.00,VoIP','03/05/2025,MV-003,Large,450.00,11,9900.00,Business Phones','04/05/2025,MV-004,Small,130.00,3,2700.00,Broadband','05/05/2025,MV-005,Medium,280.00,7,6300.00,Business Phones'].join('\n'),
    leads: leadsSample,
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
  if (file) (platform === 'leads' ? loadLeadsCSV : platform === 'bark' ? loadBarkCSV : loadMVFCSV)(file);
});
uploadDropzone.addEventListener('click', () => uploadFile.click());
uploadFile.addEventListener('change', e => {
  if (e.target.files[0]) (platform === 'leads' ? loadLeadsCSV : platform === 'bark' ? loadBarkCSV : loadMVFCSV)(e.target.files[0]);
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
document.getElementById('utm-lookup-btn').addEventListener('click', () => {
  if (typeof window.toggleUTMPanel === 'function') window.toggleUTMPanel();
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

/* ── AI Context Snapshot ─────────────────────────────────── */
window.__getAIContext = function () {
  var ctx = { platform: platform };

  // Date range
  var df = document.getElementById('date-from');
  var dt = document.getElementById('date-to');
  if (df && dt && df.value && dt.value) ctx.dateRange = df.value + ' to ' + dt.value;

  // KPI cards (what's currently on screen)
  var kpis = [];
  document.querySelectorAll('#kpi-grid .kpi-card').forEach(function (c) {
    var label  = c.querySelector('.kpi-label');
    var value  = c.querySelector('.kpi-value');
    var change = c.querySelector('.kpi-change');
    if (label && value) {
      var entry = label.textContent.trim() + ': ' + value.textContent.trim();
      if (change) entry += ' (' + change.textContent.trim() + ')';
      kpis.push(entry);
    }
  });
  if (kpis.length) ctx.kpis = kpis;

  // Table data (what's currently rendered in the campaign table)
  var thead = document.getElementById('table-head');
  var tbody = document.getElementById('table-body');
  if (thead && tbody) {
    var headers = Array.from(thead.querySelectorAll('th')).map(function (th) { return th.textContent.trim(); });
    var rows = Array.from(tbody.querySelectorAll('tr')).slice(0, 50).map(function (tr) {
      var cells = Array.from(tr.querySelectorAll('td')).map(function (td) { return td.textContent.trim(); });
      if (!cells.length) return null;
      if (headers.length === cells.length) {
        var obj = {};
        headers.forEach(function (h, i) { if (h) obj[h] = cells[i]; });
        return obj;
      }
      return cells;
    }).filter(Boolean);
    var titleEl = document.getElementById('table-title');
    if (titleEl) ctx.tableTitle = titleEl.textContent.trim();
    if (rows.length) ctx.tableData = rows;
  }

  // Raw platform data (always available regardless of current view)
  function fmtNum(n) { return Math.round((n || 0) * 100) / 100; }

  if (fbApiCampaigns.length > 0) {
    ctx.facebookCampaigns = fbApiCampaigns.slice(0, 30).map(function (c) {
      return {
        name: c.name, status: c.status,
        spend: fmtNum(c.spend), impressions: c.impressions, clicks: c.clicks,
        conversions: fmtNum(c.conversions), cpc: fmtNum(c.cpc), ctr: fmtNum(c.ctr),
        cpa: fmtNum(c.cpa), revenue: fmtNum(c.revenue || 0)
      };
    });
    if (fbApiDaily.length > 0) {
      ctx.facebookTotals = {
        spend:       fmtNum(sum(fbApiDaily, 'fb_spend')),
        impressions: Math.round(sum(fbApiDaily, 'fb_impressions')),
        clicks:      Math.round(sum(fbApiDaily, 'fb_clicks')),
        conversions: fmtNum(sum(fbApiDaily, 'fb_conversions')),
        reach:       Math.round(sum(fbApiDaily, 'fb_reach'))
      };
    }
  }

  if (gadsApiCampaigns.length > 0) {
    ctx.googleAdsCampaigns = gadsApiCampaigns.slice(0, 30).map(function (c) {
      return {
        name: c.name, status: c.status,
        spend: fmtNum(c.spend), impressions: c.impressions, clicks: c.clicks,
        conversions: fmtNum(c.conv), revenue: fmtNum(c.revenue || 0)
      };
    });
    if (gadsApiDaily.length > 0) {
      ctx.googleAdsTotals = {
        spend:       fmtNum(sum(gadsApiDaily, 'gads_spend')),
        impressions: Math.round(sum(gadsApiDaily, 'gads_impressions')),
        clicks:      Math.round(sum(gadsApiDaily, 'gads_clicks')),
        conversions: fmtNum(sum(gadsApiDaily, 'gads_conversions'))
      };
    }
  }

  if (gaApiDaily.length > 0) {
    ctx.googleAnalyticsTotals = {
      sessions:  Math.round(sum(gaApiDaily, 'ga_sessions')),
      users:     Math.round(sum(gaApiDaily, 'ga_users')),
      pageviews: Math.round(sum(gaApiDaily, 'ga_pageviews')),
      goals:     fmtNum(sum(gaApiDaily, 'ga_goals'))
    };
  }
  if (Object.keys(gaApiChannels).length > 0) ctx.gaChannels = gaApiChannels;

  if (barkData.length > 0) {
    ctx.barkTotals = {
      rows:    barkData.length,
      spend:   fmtNum(sum(barkData, 'spend')),
      leads:   Math.round(sum(barkData, 'leads') || 0),
      revenue: fmtNum(sum(barkData, 'revenue') || 0)
    };
  }
  if (mvfData.length > 0) {
    ctx.mvfTotals = {
      rows:    mvfData.length,
      spend:   fmtNum(sum(mvfData, 'spend')),
      leads:   Math.round(sum(mvfData, 'leads') || 0),
      revenue: fmtNum(sum(mvfData, 'revenue') || 0)
    };
  }

  return ctx;
};
