if (typeof FB_CONFIG === 'undefined') {
  throw new Error(
    'config.js is missing. Copy config.example.js → config.js and add your Facebook credentials.'
  );
}

const FB_BASE = 'https://graph.facebook.com/v19.0';

/* Maps Facebook campaign objective → { action type, display label } */
const OBJECTIVE_RESULT = {
  'OUTCOME_SALES':         { action: 'purchase',           label: 'Purchases'     },
  'OUTCOME_TRAFFIC':       { action: 'link_click',         label: 'Link Clicks'   },
  'OUTCOME_LEADS':         { action: 'lead',               label: 'Leads'         },
  'OUTCOME_ENGAGEMENT':    { action: 'post_engagement',    label: 'Engagements'   },
  'OUTCOME_APP_PROMOTION': { action: 'mobile_app_install', label: 'App Installs'  },
  'OUTCOME_AWARENESS':     { action: null,                 label: 'Reach'         },
  'CONVERSIONS':           { action: 'purchase',           label: 'Purchases'     },
  'LINK_CLICKS':           { action: 'link_click',         label: 'Link Clicks'   },
  'LEAD_GENERATION':       { action: 'lead',               label: 'Leads'         },
  'POST_ENGAGEMENT':       { action: 'post_engagement',    label: 'Engagements'   },
  'APP_INSTALLS':          { action: 'mobile_app_install', label: 'App Installs'  },
  'BRAND_AWARENESS':       { action: null,                 label: 'Reach'         },
  'REACH':                 { action: null,                 label: 'Reach'         },
  'VIDEO_VIEWS':           { action: 'video_view',         label: 'Video Views'   },
  'MESSAGES':              { action: 'onsite_conversion.messaging_conversation_started_7d', label: 'Conversations' },
};

/* Count a specific action type from the actions array */
function getActionCountByType(actions, actionType) {
  if (!Array.isArray(actions) || !actionType) return 0;
  const found = actions.find(
    a => a.action_type === actionType || a.action_type.includes(actionType)
  );
  return found ? parseFloat(found.value) : 0;
}

/* For account-level daily data: try purchase → lead → app install in order */
function getActionCount(actions) {
  if (!Array.isArray(actions)) return 0;
  const priorities = [
    'purchase',
    'offsite_conversion.fb_pixel_purchase',
    'omni_purchase',
    'lead',
    'mobile_app_install',
    'link_click',
  ];
  for (const t of priorities) {
    const found = actions.find(a => a.action_type === t || a.action_type.includes(t));
    if (found) return parseFloat(found.value);
  }
  return 0;
}

function getActionTotal(actionValues) {
  if (!Array.isArray(actionValues)) return 0;
  const types = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase'];
  for (const t of types) {
    const found = actionValues.find(a => a.action_type === t);
    if (found) return parseFloat(found.value);
  }
  return 0;
}

function setDateParams(params, { days, dateFrom, dateTo }) {
  if (dateFrom && dateTo) {
    params.set('time_range', JSON.stringify({ since: dateFrom, until: dateTo }));
  } else {
    const PRESETS = { 7: 'last_7d', 30: 'last_30d', 90: 'last_90d' };
    params.set('date_preset', PRESETS[days] || 'last_30_days');
  }
}

function dayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function fetchAllPages(firstUrl) {
  let data = [];
  let url = firstUrl;
  while (url) {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    data = data.concat(json.data || []);
    url = json.paging?.next || null;
  }
  return data;
}

async function fetchFBDailyInsights(dateOpts) {
  const params = new URLSearchParams({
    fields:         'spend,impressions,clicks,reach,cpm,cpc,actions,action_values',
    time_increment: '1',
    level:          'account',
    access_token:   FB_CONFIG.accessToken,
    limit:          '100',
  });
  setDateParams(params, dateOpts);

  const data = await fetchAllPages(
    `${FB_BASE}/${FB_CONFIG.accountId}/insights?${params}`
  );

  return data.map(d => ({
    dateStr:         d.date_start,
    label:           dayLabel(d.date_start),
    fb_impressions:  parseInt(d.impressions  || 0),
    fb_reach:        parseInt(d.reach        || 0),
    fb_clicks:       parseInt(d.clicks       || 0),
    fb_spend:        parseFloat(d.spend      || 0),
    fb_conversions:  getActionCount(d.actions),
    fb_cpc:          parseFloat(d.cpc        || 0),
    revenue:         getActionTotal(d.action_values),
  }));
}

async function fetchFBCampaignInsights(dateOpts) {
  /* 1 — Fetch campaigns to get objective + status */
  const campParams = new URLSearchParams({
    fields:       'id,name,effective_status,objective',
    access_token: FB_CONFIG.accessToken,
    limit:        '100',
  });
  const campData = await fetchAllPages(
    `${FB_BASE}/${FB_CONFIG.accountId}/campaigns?${campParams}`
  );

  const campMeta = {};
  campData.forEach(c => {
    const def = OBJECTIVE_RESULT[c.objective] || { action: 'link_click', label: 'Results' };
    campMeta[c.id] = {
      status:     c.effective_status,
      actionType: def.action,
      label:      def.label,
    };
  });

  /* 2 — Fetch campaign-level insights */
  const insParams = new URLSearchParams({
    fields:       'campaign_id,campaign_name,spend,impressions,clicks,reach,actions,action_values',
    level:        'campaign',
    access_token: FB_CONFIG.accessToken,
    limit:        '100',
  });
  setDateParams(insParams, dateOpts);
  const insData = await fetchAllPages(
    `${FB_BASE}/${FB_CONFIG.accountId}/insights?${insParams}`
  );

  return insData.map(c => {
    const meta = campMeta[c.campaign_id] || { status: 'PAUSED', actionType: 'link_click', label: 'Results' };
    const conv = meta.actionType
      ? getActionCountByType(c.actions, meta.actionType)
      : parseInt(c.reach || 0);

    return {
      name:        c.campaign_name,
      platform:    'fb',
      spend:       parseFloat(c.spend || 0),
      revenue:     getActionTotal(c.action_values),
      conv,
      resultLabel: meta.label,
      status:      meta.status === 'ACTIVE' ? 'active' : 'paused',
    };
  });
}
