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

/* ── Generate 90 days of mock data ──────────────────────── */
const TOTAL = 90;

function toDateStr(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

const daily = Array.from({ length: TOTAL }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (TOTAL - 1 - i));
  const fbConv    = rand(15, 70);
  const gadsConv  = rand(10, 50);
  const fbSpend   = rand(180, 650);
  const gadsSpend = rand(120, 480);
  return {
    dateStr:          toDateStr(d),
    label:            d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
    email_sent:       rand(2000, 9000),
    email_opened:     rand(380, 2200),
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
let platform       = 'all';
let days           = 30;
let dateFrom       = null;
let dateTo         = null;
let charts         = {};
let fbApiDaily     = [];
let fbApiCampaigns = [];

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
    return [
      { label: 'Revenue',         value: fmt$(revenue),                      pct: randChange(5, 28),  up: true  },
      { label: 'Ad Spend',        value: fmt$(spend),                        pct: randChange(2, 18),  up: false },
      { label: 'ROAS',            value: (revenue / spend).toFixed(2) + 'x', pct: randChange(1, 15),  up: true  },
      { label: 'Traffic',         value: fmtN(traffic),                      pct: randChange(3, 30),  up: true  },
      { label: 'Conversions',     value: fmtN(conv),                         pct: randChange(4, 22),  up: true  },
      { label: 'Email Open Rate', value: fmtPct((opened / sent) * 100),      pct: randChange(1, 10),  up: true  },
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
  if (platform === 'gads') {
    const impr  = sum(s, 'gads_impressions');
    const clicks= sum(s, 'gads_clicks');
    const spend = sum(s, 'gads_spend');
    const conv  = sum(s, 'gads_conversions');
    const rev   = sum(s, 'revenue') * 0.55;
    return [
      { label: 'Impressions',  value: fmtN(impr),               pct: randChange(5, 25), up: true  },
      { label: 'Clicks',       value: fmtN(clicks),             pct: randChange(4, 28), up: true  },
      { label: 'Ad Spend',     value: fmt$(spend),              pct: randChange(2, 15), up: false },
      { label: 'Conversions',  value: fmtN(conv),               pct: randChange(5, 22), up: true  },
      { label: 'Avg CPC',      value: fmt$(spend / clicks),     pct: randChange(1, 12), up: false },
      { label: 'ROAS',         value: (rev / spend).toFixed(2) + 'x', pct: randChange(2, 18), up: true  },
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
          labels: ['Facebook Ads', 'Google Ads'],
          datasets: [{ data: [Math.round(fbTot), Math.round(gadsTot)], backgroundColor: ['#1877F2', '#FBBC05'], borderWidth: 0, hoverOffset: 4 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '72%',
          plugins: { legend: { display: false } },
        },
        legendItems: [
          { label: 'Facebook Ads', color: '#1877F2', value: fmt$(fbTot) },
          { label: 'Google Ads',   color: '#FBBC05', value: fmt$(gadsTot) },
        ],
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
    const organic  = sum(s, 'ga_organic');
    const direct   = sum(s, 'ga_direct');
    const referral = sum(s, 'ga_referral');
    const social   = sum(s, 'ga_social');
    const email    = sum(s, 'ga_email');
    const bounce   = s.map(d => d.ga_bounce);

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

  if (platform === 'gads') {
    const spend = s.map(d => d.gads_spend);
    const conv  = s.map(d => d.gads_conversions);
    const roas  = s.map((d, i) => parseFloat(((d.revenue * 0.55) / d.gads_spend).toFixed(2)));
    const clicks= s.map(d => d.gads_clicks);
    const gadsCampaigns = campaigns.filter(c => c.platform === 'gads');
    const colors = ['#FBBC05','#f6ad55','#fbd38d','#fef3c7'];

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
          datasets: [{ data: gadsCampaigns.map(c => c.spend), backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }],
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
            y: { ...baseScaleY({ ticks: { callback: v => v + 'x', color: TICK_COLOR } }) },
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

  if (platform === 'ga') {
    document.getElementById('table-title').textContent = 'Top Pages';
    badge.textContent = topPages.length + ' pages';
    head.innerHTML = '<tr>' + ['Page','Sessions','Pageviews','Bounce Rate','Avg Duration'].map(h => `<th>${h}</th>`).join('') + '</tr>';
    body.innerHTML = topPages.map(p => `
      <tr>
        <td><code style="color:#94a3b8;font-size:12px">${p.page}</code></td>
        <td>${fmtN(p.sessions)}</td>
        <td>${fmtN(p.pv)}</td>
        <td>${p.bounce}</td>
        <td>${p.dur}</td>
      </tr>`).join('');
    return;
  }

  const rows = (platform === 'fb' && fbApiCampaigns.length > 0 ? fbApiCampaigns
             : platform === 'all' ? campaigns
             : campaigns.filter(c => c.platform === platform))
             .filter(c => platform !== 'fb' || c.status === 'active');

  document.getElementById('table-title').textContent = 'Campaign Performance';
  badge.textContent = rows.length + ' campaigns';

  const isFB   = platform === 'fb';
  const isAll  = platform === 'all';

  const heads = isAll  ? ['Campaign','Platform','Spend','Revenue','ROAS','Conversions','Status']
              : isFB   ? ['Campaign','Spend','Result','Cost / Result','Revenue','ROAS','Status']
              :          ['Campaign','Spend','Revenue','ROAS','Conversions','Status'];

  head.innerHTML = '<tr>' + heads.map(h => `<th>${h}</th>`).join('') + '</tr>';
  body.innerHTML = rows.map(c => {
    const roas       = c.spend > 0 ? (c.revenue / c.spend) : 0;
    const roasCls    = roasClass(roas);
    const costPerRes = c.conv  > 0 ? fmt$(c.spend / c.conv) : '&mdash;';
    const pBadge     = `<span class="platform-badge badge-${c.platform}">${c.platform === 'fb' ? 'FB' : c.platform === 'gads' ? 'GAdS' : 'GA'}</span>`;
    const stBadge    = `<span class="status-badge status-${c.status}"><span class="status-dot-sm"></span>${c.status}</span>`;

    const base = isFB ? `
      <td>${c.name}</td>
      <td>${fmt$(c.spend)}</td>
      <td><div class="result-cell"><span class="result-pill">${fmtN(c.conv)}</span><span class="result-type">${c.resultLabel || 'Results'}</span></div></td>
      <td>${costPerRes}</td>
      <td>${fmt$(c.revenue)}</td>
      <td class="${roasCls}">${roas.toFixed(2)}x</td>
      <td>${stBadge}</td>`
    : `
      <td>${c.name}</td>
      ${isAll ? `<td>${pBadge}</td>` : ''}
      <td>${fmt$(c.spend)}</td>
      <td>${fmt$(c.revenue)}</td>
      <td class="${roasCls}">${roas.toFixed(2)}x</td>
      <td>${fmtN(c.conv)}</td>
      <td>${stBadge}</td>`;

    return `<tr>${base}</tr>`;
  }).join('');
}

/* ── Page header ────────────────────────────────────────── */
const PLATFORM_META = {
  all:  { title: 'Overview',          sub: 'All platforms combined' },
  ga:   { title: 'Google Analytics',  sub: 'Website traffic & behaviour' },
  fb:   { title: 'Facebook Ads',      sub: 'Paid social performance' },
  gads: { title: 'Google Ads',        sub: 'Search & display performance' },
};

function renderHeader() {
  const m = PLATFORM_META[platform];
  document.getElementById('page-title').textContent   = m.title;
  document.getElementById('page-subtitle').textContent = m.sub;
}

/* ── Master update ──────────────────────────────────────── */
async function update() {
  hideError();

  if (platform === 'fb') {
    showLoading(true);
    const dateOpts = { days, dateFrom, dateTo };
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

  const s = platform === 'fb' ? fbApiDaily : slice();
  renderHeader();
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
    update();
  });
});

document.querySelectorAll('.date-btn[data-days]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    days = parseInt(btn.dataset.days);
    dateFrom = null;
    dateTo   = null;
    customBtn.textContent = 'Custom';
    customPanel.classList.add('hidden');
    update();
  });
});

/* ── Custom date range ──────────────────────────────────── */
const customBtn   = document.getElementById('date-custom-btn');
const customPanel = document.getElementById('date-custom-panel');
const inputFrom   = document.getElementById('date-from');
const inputTo     = document.getElementById('date-to');
const applyBtn    = document.getElementById('date-apply');

inputFrom.min   = daily[0].dateStr;
inputFrom.max   = daily[TOTAL - 1].dateStr;
inputFrom.value = daily[TOTAL - 30].dateStr;
inputTo.min     = daily[0].dateStr;
inputTo.max     = daily[TOTAL - 1].dateStr;
inputTo.value   = daily[TOTAL - 1].dateStr;

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

  document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
  customBtn.classList.add('active');

  const fmt = str => {
    const [y, m, d] = str.split('-');
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  customBtn.textContent = `${fmt(from)} – ${fmt(to)}`;

  customPanel.classList.add('hidden');
  update();
});

document.getElementById('error-close').addEventListener('click', hideError);

/* ── Init ───────────────────────────────────────────────── */
try {
  update();
} catch (e) {
  showError(e.message);
}
