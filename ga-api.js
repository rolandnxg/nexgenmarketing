function gaLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
  }).format(new Date(y, m - 1, d, 12, 0, 0));
}

function gaDateParams(dateOpts, propertyId) {
  const p = new URLSearchParams();
  if (dateOpts.dateFrom && dateOpts.dateTo) {
    p.set('dateFrom', dateOpts.dateFrom);
    p.set('dateTo',   dateOpts.dateTo);
  } else {
    p.set('days', dateOpts.days);
  }
  if (propertyId) p.set('propertyId', propertyId);
  return p;
}

async function fetchGADailyInsights(dateOpts, propertyId) {
  const res  = await fetch(`/api/ga/daily?${gaDateParams(dateOpts, propertyId)}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  const daily = (json.daily || []).map(d => ({ ...d, label: gaLabel(d.dateStr) }));
  return { daily, channels: json.channels || {} };
}

async function fetchGATopPages(dateOpts, propertyId) {
  const res  = await fetch(`/api/ga/pages?${gaDateParams(dateOpts, propertyId)}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return Array.isArray(json) ? json : [];
}
