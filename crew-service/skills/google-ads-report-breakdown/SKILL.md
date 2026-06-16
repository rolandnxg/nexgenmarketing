---
name: google-ads-report-breakdown
description: "Use whenever generating any Google Ads report or performance breakdown (daily report, period comparison, ad-hoc analysis, keyword research with campaign context, consolidation/optimization recommendation plans). Enforces the required reporting hierarchy: Account name → Campaign name → Ad Groups → Ads + Keywords. Never present bare customer IDs or campaign IDs without names, and never stop the breakdown at campaign level."
metadata:
  version: 1.2.0
---

# Google Ads Report Breakdown

Every Google Ads report MUST break performance down through the full account hierarchy, top to bottom:

```
Account (descriptive name + customer ID)
└── Campaign (name, not just ID)
    └── Ad Group (name)
        ├── Ads (name/type + headline summary)
        └── Keywords (text + match type) + search-term check
```

Stopping at campaign level is not acceptable for a report. IDs without human-readable names are not acceptable anywhere in report output.

## Rules

1. **Account names, not bare customer IDs.** Resolve `customer.descriptive_name` for every account queried. Format headings as `Account: <Name> (<customer ID>)`. Known Nexgen accounts:
   - `7066096988` = NEXGEN
   - `9197029288` = Compare Business Phones
   - `4721419174` = manager/MCC (API access currently denied — note its exclusion in the report)
2. **Campaign names always.** Never reference a campaign by resource name or numeric ID alone. ID may be shown in parentheses after the name.
3. **Ad group breakdown is mandatory.** Under each campaign, show its ad groups with metrics.
4. **Ads breakdown is mandatory.** Under each ad group, list the ads (type, status, headline summary for RSAs) with metrics. For Performance Max campaigns (which have asset groups, not ad groups), break down by asset group instead and note this.
5. **Keyword breakdown is mandatory for deep-dive campaigns.** For every campaign covered at full depth (see Scope control), include a keyword table per ad group — keyword text, match type, status, spend, clicks, CTR, CPC, conversions — plus a search-term waste check (top spending search terms with 0 conversions). Keywords are always shown with their match type in brackets, e.g. `voip australia [BROAD]`, and attributed to campaign **and** ad group by name. Search/keyword data doesn't apply to Performance Max — say so instead of omitting silently.
6. **Order everything by spend descending** at each level. Levels with zero impressions in the period may be omitted, but say so.
7. **Long-tail compression is allowed, not omission.** If a level has many low-spend rows, show the top rows and aggregate the rest into a single "Other (n)" row — never silently truncate.

## How to fetch each level (GAQL via `mcp__google-ads__run_gaql`)

**Account name:**
```sql
SELECT customer.descriptive_name, customer.id, customer.currency_code FROM customer
```

**Campaigns:**
```sql
SELECT campaign.name, campaign.id, campaign.status,
       metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
FROM campaign
WHERE segments.date BETWEEN '<start>' AND '<end>' AND metrics.impressions > 0
ORDER BY metrics.cost_micros DESC
```

**Ad groups:**
```sql
SELECT campaign.name, ad_group.name, ad_group.id, ad_group.status,
       metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
FROM ad_group
WHERE segments.date BETWEEN '<start>' AND '<end>' AND metrics.impressions > 0
ORDER BY metrics.cost_micros DESC
```

**Ads:**
```sql
SELECT campaign.name, ad_group.name,
       ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.status,
       ad_group_ad.ad.responsive_search_ad.headlines,
       metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
FROM ad_group_ad
WHERE segments.date BETWEEN '<start>' AND '<end>' AND metrics.impressions > 0
ORDER BY metrics.cost_micros DESC
```

For an RSA, label the ad with its first 2–3 headlines joined by " | " (e.g. `RSA: "Business Phone Systems | NBN Ready | Free Quote"`). For Performance Max, query `asset_group` instead of `ad_group_ad`.

**Keywords:**
```sql
SELECT campaign.name, ad_group.name,
       ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
       ad_group_criterion.status,
       metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.ctr,
       metrics.average_cpc, metrics.conversions
FROM keyword_view
WHERE segments.date BETWEEN '<start>' AND '<end>' AND metrics.impressions > 0
ORDER BY metrics.cost_micros DESC
```

**Search terms (waste check):**
```sql
SELECT campaign.name, ad_group.name,
       search_term_view.search_term,
       metrics.cost_micros, metrics.clicks, metrics.conversions
FROM search_term_view
WHERE segments.date BETWEEN '<start>' AND '<end>' AND metrics.cost_micros > 0
ORDER BY metrics.cost_micros DESC
```

Use a 60–90 day window for keyword/search-term analysis where the campaign has that much history — 30 days is usually too thin to judge keywords.

Notes:
- `metrics.cost_micros` ÷ 1,000,000 = AUD.
- Run the per-account queries in parallel; run levels per account in parallel too once the date range is fixed.

## Report section template

```markdown
## Account: NEXGEN (7066096988)

| Campaign | Spend | Clicks | Conv. | CPA |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

### Campaign: <Campaign Name> (<id>)

| Ad Group | Spend | Clicks | Conv. | CPA |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

#### Ad Group: <Ad Group Name>

| Ad | Type | Status | Spend | Clicks | Conv. |
|---|---|---|---|---|---|
| RSA: "Headline 1 | Headline 2" | RSA | ENABLED | ... | ... | ... |

| Keyword | Status | Spend | Clicks | CTR | Avg CPC | Conv. |
|---|---|---|---|---|---|---|
| `voip phone system [PHRASE]` | ENABLED | ... | ... | ... | ... | ... |
```

Repeat per account. The hierarchy sections sit inside the standard ads report structure (Executive Summary, Alerts, platform breakdowns, Recommendations, Attribution Note) — this skill governs the "platform breakdown" section for Google Ads.

After each campaign's ad-group/ad tables, add a short **"Read-through:"** prose paragraph interpreting the numbers (which ad group carries the performance, where the cost leak is, which ad is the proven winner). Tables show the data; the read-through says what it means.

## Recommendation / action-plan reports

When the report **recommends changes** (campaign consolidation, pause/scale decisions, restructure plans) rather than only describing performance, the breakdown above is necessary but not sufficient. The reference example is `ads-reports/nexgen-google-ads-campaign-consolidation-plan-2026-06-11.md` — match its format. Required elements:

1. **Header block** stating: prepared date, who approves, objective, explicit scope (which accounts are in/out and why), currency, and the data window. Follow with a blockquote stating this is a recommendation only and nothing has been mutated.
2. **Action tags on every row.** Tag each campaign, ad group, and ad with exactly one of:
   - **KEEP** — exists, stays enabled (qualify if needed: "KEEP (trim)", "KEEP (anchor)")
   - **PAUSE** — exists, to be paused (pause, never remove — keeps decisions reversible and retains learning; state this)
   - **NEW / CREATE** — to be created (for new RSAs: give the messaging angle and 3–5 proposed headlines; for new ad groups: name + keyword themes; for new campaigns: name, objective, planned ad-group themes, and starting budget)
   - **REMEDIATE** — keep enabled but change bids/keywords/creative (state the concrete changes and a re-evaluate threshold/date). Usable at any level, most commonly ad group.

   In Keep/Pause/Create tables, carry the same key metrics (Spend, Conv., CPA) as evidence wherever the entity already exists; NEW rows have no metrics.
3. **Executive Summary decision table** up front: Decision | Campaign (id) | key metrics (Spend, Conv., CPA, CTR, CPC) | Role — one row per keep, one aggregate row for the pause list. If the user/manager stated a belief or constraint (e.g. "only 1 good campaign"), verify it against the data explicitly and say where it holds and where it doesn't.
4. **Keep / Pause / Create sections at each level** — three separate sections (Campaign level, Ad Group level, Ad level), each a table with Action and Reason columns. Order the pause list by priority (biggest waste first) with spend/conv/CPA evidence per row.
5. **Keyword Review section** — mandatory for any report that recommends changes to a Search campaign. The reference example is the "Keyword Review" section of `ads-reports/nexgen-google-ads-report-2026-06-12.md` — match its format. Four lists, each a table, each row carrying the metric evidence that justifies it:
   - **Keywords to PAUSE / REMOVE** — ordered by wasted spend descending, with spend / clicks / conversions / CPC per row.
   - **Keywords to KEEP** — with any match-type change flagged inline (e.g. "BROAD → PHRASE") and the supporting metrics.
   - **Negative keywords to ADD** — mined from actual search-term waste (never invented), with match type and level (campaign / ad group / shared list), ordered by spend blocked.
   - **New keywords to ADD** — with suggested match type and the named ad group each belongs in (existing or NEW/CREATE ad groups from this same report).
   End the section with a one-line total of estimated 30-day waste addressed by the removals + negatives, and flag any cross-ad-group duplicate keywords found.
6. **Final-State Table: Campaign × Ad Group × Ads** — the complete target structure after execution: every surviving campaign, every ad group under it, every ad under each ad group (existing and new), each row tagged. Collapse all fully-paused campaigns into a single summary row at the bottom (e.g. "_(all n other campaigns)_ | _(all ad groups)_ | _(all ads)_ | PAUSE") — do not expand their hierarchy. End with a **"Net target footprint:"** summary line (n campaigns, n ad groups, n new ads, n pauses).
7. **Budget plan** driven by actual recent spend, not configured ceilings: per-survivor starting daily budget + an explicit scale rule ("step to $X if CPA holds < $Y against validated conversions"). Flag that large budget jumps reset learning.
8. **Execution checklist** — numbered steps to perform only after approval, ordered by priority/safety (validation prerequisites first, biggest-waste pauses next, creative builds later). Include keyword actions (pauses, negatives, additions) as their own checklist steps. Include a fallback option if the recommendation has a leaner alternative the approver might prefer.
9. **Risks & Caveats section**, always including the conversion-tracking reliability caveat for Nexgen, plus the standard Attribution Note.

## Scope control

For large date ranges or accounts, full ads-level tables for every campaign can get enormous. Default depth:

- Full Account → Campaign → Ad Group → Ads + Keywords detail for the **top 3 campaigns by spend per account**.
- For remaining campaigns: Account → Campaign → Ad Group tables, with ads aggregated to one summary row per ad group and keywords omitted (state that they were).
- Keyword tables follow the long-tail compression rule: top rows by spend + an "Other (n)" aggregate. The search-term waste check can be limited to the top 10–15 wasted terms.
- State this depth rule in the report so readers know what was compressed.

If the user asks for a specific campaign, give full depth for that campaign regardless of rank.

For recommendation reports: full depth (including the Keyword Review lists) for every **kept/remediated** campaign (these are the ones being acted on), campaign-level summary for the pause list — keyword work on campaigns about to be paused is wasted effort; skip it and say so. Always state the depth rule used in the report.
