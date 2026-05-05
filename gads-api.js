async function fetchGAdsDailyInsights(dateOpts) {
  const { days, dateFrom, dateTo } = dateOpts;
  const params = new URLSearchParams();
  if (dateFrom && dateTo) {
    params.set('dateFrom', dateFrom);
    params.set('dateTo', dateTo);
  } else {
    params.set('days', days);
  }

  const res  = await fetch(`/api/gads/daily?${params}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);

  return json.map(d => {
    const [y, m, day] = d.dateStr.split('-').map(Number);
    return {
      dateStr:          d.dateStr,
      label:            new Intl.DateTimeFormat('en-US', {
                          timeZone: TZ, month: 'short', day: 'numeric',
                        }).format(new Date(y, m - 1, day, 12, 0, 0)),
      gads_impressions: d.gads_impressions,
      gads_clicks:      d.gads_clicks,
      gads_spend:       d.gads_spend,
      gads_conversions: d.gads_conversions,
      revenue:          d.revenue,
    };
  });
}

async function fetchGAdsCampaigns(dateOpts) {
  const { days, dateFrom, dateTo } = dateOpts;
  const params = new URLSearchParams();
  if (dateFrom && dateTo) {
    params.set('dateFrom', dateFrom);
    params.set('dateTo', dateTo);
  } else {
    params.set('days', days);
  }

  const res  = await fetch(`/api/gads/campaigns?${params}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}
