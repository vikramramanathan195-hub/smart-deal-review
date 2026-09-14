-- Deal Discount Review — Postgres schema (Supabase)
-- Mirrors the Pydantic models in backend/app/models.py table-for-table, so
-- the shape here is the same shape the API already validates against.
-- Run this once in the Supabase SQL editor to create the schema and seed
-- it with the same four sample deals the live demo ships with.

create table customers (
  id              text primary key,
  name            text not null,
  partner_since   int not null,
  lifetime_value  text not null,
  renewal_rate_pct   numeric not null,
  avg_discount_pct   numeric not null
);

create table discount_history (
  id              bigint generated always as identity primary key,
  customer_id     text not null references customers(id) on delete cascade,
  date            text not null,
  discount_pct    numeric not null,
  outcome         text not null check (outcome in ('won', 'lost'))
);

create table deals (
  id                  text primary key,
  name                text not null,
  customer_id         text not null references customers(id),
  term_length         text not null check (term_length in ('12mo', '24mo', '36mo')),
  product_categories  text[] not null,
  region              text not null default 'north_america',
  status              text not null default 'within_range'
                        check (status in ('within_range', 'needs_approval')),
  approval_state      text check (approval_state in ('pending', 'approved', 'rejected')),
  approval_note       text,
  quote_sent_at       timestamptz,
  quote_sent_to       text
);

create table line_items (
  id                      text primary key,
  deal_id                 text not null references deals(id) on delete cascade,
  product_category        text not null check (product_category in
                            ('Compute', 'Storage', 'Networking', 'Services')),
  deal_value              numeric not null check (deal_value > 0),
  applied_discount_pct    numeric check (applied_discount_pct between 0 and 100),
  decision                text not null default 'pending'
                            check (decision in ('pending', 'accepted', 'adjusted', 'overridden')),
  line_approval_state     text not null default 'none'
                            check (line_approval_state in ('none', 'pending_approval', 'approved', 'rejected')),
  pending_discount_pct    numeric check (pending_discount_pct between 0 and 100),
  override_reason         text,
  decided_by              text
);

-- One row per AI recommendation — kept separate from line_items so the
-- factor breakdown (the "why this number") has its own auditable record.
create table recommendations (
  line_item_id    text primary key references line_items(id) on delete cascade,
  recommended_pct numeric not null,
  confidence      text not null check (confidence in ('low', 'medium', 'high')),
  net_value       numeric not null
);

create table recommendation_factors (
  id              bigint generated always as identity primary key,
  line_item_id    text not null references recommendations(line_item_id) on delete cascade,
  name            text not null,
  contribution_pct numeric not null,
  positive        boolean not null,
  sort_order      int not null default 0
);

-- Every accept / propose / approve / reject on a line item, with who and why
-- — the audit trail behind the Activity panel in the UI.
create table discount_change_log (
  id              bigint generated always as identity primary key,
  line_item_id    text not null references line_items(id) on delete cascade,
  at              timestamptz not null default now(),
  by              text not null,
  previous_pct    numeric,
  new_pct         numeric,
  reason          text,
  action          text not null check (action in
                    ('accepted', 'proposed_auto_applied', 'proposed_pending_approval', 'approved', 'rejected'))
);

create index on discount_history (customer_id);
create index on deals (customer_id);
create index on line_items (deal_id);
create index on recommendation_factors (line_item_id);
create index on discount_change_log (line_item_id);

-- ---------------------------------------------------------------------
-- Seed data: the same four sample deals the deployed demo runs with.
-- ---------------------------------------------------------------------

insert into customers (id, name, partner_since, lifetime_value, renewal_rate_pct, avg_discount_pct) values
  ('cust-northwind', 'Northwind Industries', 2022, '$1.24M', 100.0, 10.7),
  ('cust-cerulean',  'Cerulean Logistics',   2025, '$310K',  67.0,  13.4),
  ('cust-meridian',  'Meridian Health Systems', 2018, '$2.86M', 100.0, 8.2),
  ('cust-atlas',     'Atlas Manufacturing',  2024, '$890K',  100.0, 11.9),
  ('cust-vantage',   'Vantage Retail Group', 2021, '$1.68M', 88.0,  12.3),
  ('cust-brightfield','Brightfield Energy',  2023, '$540K',  75.0,  14.1),
  ('cust-solara',    'Solara Biotech',       2019, '$3.42M', 100.0, 9.4),
  ('cust-keystone',  'Keystone Freight',     2020, '$720K',  83.0,  13.0);

insert into discount_history (customer_id, date, discount_pct, outcome) values
  ('cust-northwind', 'Mar 2023', 9.0,  'won'),
  ('cust-northwind', 'Sep 2023', 11.5, 'won'),
  ('cust-northwind', 'Feb 2024', 14.0, 'lost'),
  ('cust-northwind', 'Nov 2024', 8.5,  'won'),
  ('cust-cerulean',  'Jan 2025', 12.0, 'lost'),
  ('cust-cerulean',  'Jun 2025', 14.5, 'won'),
  ('cust-cerulean',  'Dec 2025', 13.5, 'lost'),
  ('cust-cerulean',  'Feb 2026', 16.0, 'won'),
  ('cust-meridian',  'Apr 2023', 7.5,  'won'),
  ('cust-meridian',  'Apr 2024', 8.0,  'won'),
  ('cust-meridian',  'Apr 2025', 8.5,  'won'),
  ('cust-atlas',     'May 2024', 10.5, 'won'),
  ('cust-atlas',     'Nov 2024', 12.0, 'won'),
  ('cust-atlas',     'Aug 2025', 13.5, 'lost'),
  ('cust-vantage',    'Feb 2022', 11.0, 'won'),
  ('cust-vantage',    'Aug 2022', 13.0, 'won'),
  ('cust-vantage',    'Mar 2023', 15.0, 'lost'),
  ('cust-vantage',    'Oct 2023', 12.5, 'won'),
  ('cust-vantage',    'May 2024', 11.5, 'won'),
  ('cust-brightfield','Jun 2023', 13.5, 'won'),
  ('cust-brightfield','Jan 2024', 16.0, 'lost'),
  ('cust-brightfield','Sep 2024', 14.5, 'won'),
  ('cust-solara',     'Nov 2019', 8.0,  'won'),
  ('cust-solara',     'Nov 2020', 8.5,  'won'),
  ('cust-solara',     'Nov 2021', 9.0,  'won'),
  ('cust-solara',     'Nov 2022', 9.5,  'won'),
  ('cust-solara',     'Nov 2023', 9.5,  'won'),
  ('cust-solara',     'Nov 2024', 10.0, 'won'),
  ('cust-keystone',   'Apr 2021', 10.5, 'won'),
  ('cust-keystone',   'Dec 2021', 14.0, 'lost'),
  ('cust-keystone',   'Jul 2022', 12.0, 'won'),
  ('cust-keystone',   'Feb 2023', 13.5, 'won'),
  ('cust-keystone',   'Nov 2023', 14.5, 'lost'),
  ('cust-keystone',   'Jun 2024', 12.5, 'won');

insert into deals (id, name, customer_id, term_length, product_categories, region, status) values
  ('northwind', 'Northwind Industries — FY27 Expansion', 'cust-northwind', '24mo',
    array['Compute','Storage'], 'north_america', 'within_range'),
  ('cerulean', 'Cerulean Logistics — Competitive Displacement', 'cust-cerulean', '36mo',
    array['Networking','Services','Compute'], 'eurozone', 'needs_approval'),
  ('meridian', 'Meridian Health Systems — Annual Renewal', 'cust-meridian', '12mo',
    array['Compute','Services'], 'india', 'within_range'),
  ('atlas', 'Atlas Manufacturing — Global Rollout', 'cust-atlas', '36mo',
    array['Compute','Networking','Storage'], 'japan', 'within_range'),
  ('vantage', 'Vantage Retail Group — Store Systems Refresh', 'cust-vantage', '24mo',
    array['Compute','Services'], 'uk', 'within_range'),
  ('brightfield', 'Brightfield Energy — Grid Monitoring Expansion', 'cust-brightfield', '36mo',
    array['Networking','Storage','Services'], 'brazil', 'needs_approval'),
  ('solara', 'Solara Biotech — Annual Renewal', 'cust-solara', '12mo',
    array['Compute','Storage'], 'north_america', 'within_range'),
  ('keystone', 'Keystone Freight — Fleet Telemetry Rollout', 'cust-keystone', '24mo',
    array['Networking','Compute'], 'india', 'needs_approval');

insert into line_items (id, deal_id, product_category, deal_value) values
  ('line-seed-1', 'northwind', 'Compute', 180000.0),
  ('line-seed-2', 'northwind', 'Storage', 96500.0),
  ('line-seed-3', 'northwind', 'Services', 42000.0),
  ('line-esc-1',  'cerulean',  'Networking', 220000.0),
  ('line-esc-2',  'cerulean',  'Services', 130000.0),
  ('line-esc-3',  'cerulean',  'Compute', 75000.0),
  ('line-mer-1',  'meridian',  'Compute', 145000.0),
  ('line-mer-2',  'meridian',  'Services', 38000.0),
  ('line-atl-1',  'atlas',     'Compute', 310000.0),
  ('line-atl-2',  'atlas',     'Networking', 165000.0),
  ('line-atl-3',  'atlas',     'Storage', 98000.0),
  ('line-van-1',  'vantage',   'Compute', 210000.0),
  ('line-van-2',  'vantage',   'Services', 88000.0),
  ('line-bri-1',  'brightfield','Networking', 175000.0),
  ('line-bri-2',  'brightfield','Storage', 92000.0),
  ('line-bri-3',  'brightfield','Services', 54000.0),
  ('line-sol-1',  'solara',    'Compute', 260000.0),
  ('line-sol-2',  'solara',    'Storage', 120000.0),
  ('line-key-1',  'keystone',  'Networking', 198000.0),
  ('line-key-2',  'keystone',  'Compute', 84000.0);

insert into recommendations (line_item_id, recommended_pct, confidence, net_value) values
  ('line-seed-1', 12.0, 'high',   158400.0),
  ('line-seed-2', 12.5, 'medium', 84437.5),
  ('line-seed-3', 15.0, 'low',    35700.0),
  ('line-esc-1',  18.0, 'low',    180400.0),
  ('line-esc-2',  19.5, 'low',    104650.0),
  ('line-esc-3',  16.0, 'medium', 63000.0),
  ('line-mer-1',  8.0,  'high',   133400.0),
  ('line-mer-2',  9.0,  'high',   34580.0),
  ('line-atl-1',  13.5, 'medium', 268150.0),
  ('line-atl-2',  14.5, 'medium', 141075.0),
  ('line-atl-3',  12.0, 'high',   86240.0),
  ('line-van-1',  11.5, 'high',   185850.0),
  ('line-van-2',  12.0, 'medium', 77440.0),
  ('line-bri-1',  17.0, 'low',    145250.0),
  ('line-bri-2',  15.5, 'medium', 77740.0),
  ('line-bri-3',  14.0, 'medium', 46440.0),
  ('line-sol-1',  9.5,  'high',   235300.0),
  ('line-sol-2',  10.0, 'high',   108000.0),
  ('line-key-1',  15.5, 'medium', 167310.0),
  ('line-key-2',  16.5, 'low',    70140.0);

insert into recommendation_factors (line_item_id, name, contribution_pct, positive, sort_order) values
  ('line-seed-1', 'Baseline (segment: Enterprise)', 8.0, true, 0),
  ('line-seed-1', 'Customer tenure (4 yrs)', 2.5, true, 1),
  ('line-seed-1', 'Deal size tier', 2.0, true, 2),
  ('line-seed-1', 'Regional competitive pressure', 1.5, true, 3),
  ('line-seed-1', 'Margin floor guardrail', -2.0, false, 4),
  ('line-seed-2', 'Baseline (segment: Enterprise)', 8.0, true, 0),
  ('line-seed-2', 'Customer tenure (4 yrs)', 2.5, true, 1),
  ('line-seed-2', 'Deal size tier', 1.0, true, 2),
  ('line-seed-2', 'Regional competitive pressure', 2.5, true, 3),
  ('line-seed-2', 'Margin floor guardrail', -1.5, false, 4),
  ('line-seed-3', 'Baseline (segment: Enterprise)', 8.0, true, 0),
  ('line-seed-3', 'Customer tenure (4 yrs)', 2.5, true, 1),
  ('line-seed-3', 'Deal size tier', 3.0, true, 2),
  ('line-seed-3', 'Regional competitive pressure', 4.0, true, 3),
  ('line-seed-3', 'Margin floor guardrail', -2.5, false, 4),
  ('line-esc-1', 'Baseline (segment: Enterprise)', 8.0, true, 0),
  ('line-esc-1', 'Competitive displacement', 6.0, true, 1),
  ('line-esc-1', 'Deal size tier', 3.0, true, 2),
  ('line-esc-1', 'Multi-year term commitment', 2.0, true, 3),
  ('line-esc-1', 'Margin floor guardrail', -1.0, false, 4),
  ('line-esc-2', 'Baseline (segment: Enterprise)', 8.0, true, 0),
  ('line-esc-2', 'Competitive displacement', 7.0, true, 1),
  ('line-esc-2', 'Deal size tier', 2.5, true, 2),
  ('line-esc-2', 'Regional competitive pressure', 4.0, true, 3),
  ('line-esc-2', 'Margin floor guardrail', -2.0, false, 4),
  ('line-esc-3', 'Baseline (segment: Enterprise)', 8.0, true, 0),
  ('line-esc-3', 'Competitive displacement', 6.0, true, 1),
  ('line-esc-3', 'Deal size tier', 3.0, true, 2),
  ('line-esc-3', 'Multi-year term commitment', 2.0, true, 3),
  ('line-esc-3', 'Margin floor guardrail', -3.0, false, 4),
  ('line-mer-1', 'Baseline (segment: Enterprise)', 6.0, true, 0),
  ('line-mer-1', 'Customer tenure (7 yrs)', 1.5, true, 1),
  ('line-mer-1', 'Deal size tier', 1.0, true, 2),
  ('line-mer-1', 'Renewal loyalty credit', 0.5, true, 3),
  ('line-mer-1', 'Margin floor guardrail', -1.0, false, 4),
  ('line-mer-2', 'Baseline (segment: Enterprise)', 6.0, true, 0),
  ('line-mer-2', 'Customer tenure (7 yrs)', 1.5, true, 1),
  ('line-mer-2', 'Deal size tier', 0.5, true, 2),
  ('line-mer-2', 'Renewal loyalty credit', 1.5, true, 3),
  ('line-mer-2', 'Margin floor guardrail', -0.5, false, 4),
  ('line-atl-1', 'Baseline (segment: Enterprise)', 9.0, true, 0),
  ('line-atl-1', 'Customer tenure (2 yrs)', 1.0, true, 1),
  ('line-atl-1', 'Deal size tier', 3.0, true, 2),
  ('line-atl-1', 'Multi-region rollout complexity', 2.5, true, 3),
  ('line-atl-1', 'Margin floor guardrail', -2.0, false, 4),
  ('line-atl-2', 'Baseline (segment: Enterprise)', 9.0, true, 0),
  ('line-atl-2', 'Customer tenure (2 yrs)', 1.0, true, 1),
  ('line-atl-2', 'Deal size tier', 2.0, true, 2),
  ('line-atl-2', 'Multi-region rollout complexity', 4.5, true, 3),
  ('line-atl-2', 'Margin floor guardrail', -2.0, false, 4),
  ('line-atl-3', 'Baseline (segment: Enterprise)', 9.0, true, 0),
  ('line-atl-3', 'Customer tenure (2 yrs)', 1.0, true, 1),
  ('line-atl-3', 'Deal size tier', 1.0, true, 2),
  ('line-atl-3', 'Multi-region rollout complexity', 3.0, true, 3),
  ('line-atl-3', 'Margin floor guardrail', -2.0, false, 4),
  ('line-van-1', 'Baseline (segment: Enterprise)', 8.0, true, 0),
  ('line-van-1', 'Customer tenure (3 yrs)', 1.0, true, 1),
  ('line-van-1', 'Deal size tier', 2.5, true, 2),
  ('line-van-1', 'Regional competitive pressure', 1.5, true, 3),
  ('line-van-1', 'Margin floor guardrail', -1.5, false, 4),
  ('line-van-2', 'Baseline (segment: Enterprise)', 8.0, true, 0),
  ('line-van-2', 'Customer tenure (3 yrs)', 1.0, true, 1),
  ('line-van-2', 'Deal size tier', 1.5, true, 2),
  ('line-van-2', 'Regional competitive pressure', 3.0, true, 3),
  ('line-van-2', 'Margin floor guardrail', -1.5, false, 4),
  ('line-bri-1', 'Baseline (segment: Mid-market)', 10.0, true, 0),
  ('line-bri-1', 'Customer tenure (2 yrs)', 1.0, true, 1),
  ('line-bri-1', 'Deal size tier', 3.0, true, 2),
  ('line-bri-1', 'Competitive displacement', 4.5, true, 3),
  ('line-bri-1', 'Margin floor guardrail', -1.5, false, 4),
  ('line-bri-2', 'Baseline (segment: Mid-market)', 10.0, true, 0),
  ('line-bri-2', 'Customer tenure (2 yrs)', 1.0, true, 1),
  ('line-bri-2', 'Deal size tier', 1.5, true, 2),
  ('line-bri-2', 'Competitive displacement', 4.5, true, 3),
  ('line-bri-2', 'Margin floor guardrail', -1.5, false, 4),
  ('line-bri-3', 'Baseline (segment: Mid-market)', 10.0, true, 0),
  ('line-bri-3', 'Customer tenure (2 yrs)', 1.0, true, 1),
  ('line-bri-3', 'Deal size tier', 1.0, true, 2),
  ('line-bri-3', 'Competitive displacement', 3.5, true, 3),
  ('line-bri-3', 'Margin floor guardrail', -1.5, false, 4),
  ('line-sol-1', 'Baseline (segment: Enterprise)', 7.0, true, 0),
  ('line-sol-1', 'Customer tenure (7 yrs)', 1.5, true, 1),
  ('line-sol-1', 'Deal size tier', 2.5, true, 2),
  ('line-sol-1', 'Renewal loyalty credit', 0.5, true, 3),
  ('line-sol-1', 'Margin floor guardrail', -2.0, false, 4),
  ('line-sol-2', 'Baseline (segment: Enterprise)', 7.0, true, 0),
  ('line-sol-2', 'Customer tenure (7 yrs)', 1.5, true, 1),
  ('line-sol-2', 'Deal size tier', 2.0, true, 2),
  ('line-sol-2', 'Renewal loyalty credit', 1.0, true, 3),
  ('line-sol-2', 'Margin floor guardrail', -1.5, false, 4),
  ('line-key-1', 'Baseline (segment: Mid-market)', 10.0, true, 0),
  ('line-key-1', 'Customer tenure (5 yrs)', 1.5, true, 1),
  ('line-key-1', 'Deal size tier', 2.5, true, 2),
  ('line-key-1', 'Multi-region rollout complexity', 3.0, true, 3),
  ('line-key-1', 'Margin floor guardrail', -1.5, false, 4),
  ('line-key-2', 'Baseline (segment: Mid-market)', 10.0, true, 0),
  ('line-key-2', 'Customer tenure (5 yrs)', 1.5, true, 1),
  ('line-key-2', 'Deal size tier', 1.5, true, 2),
  ('line-key-2', 'Multi-region rollout complexity', 4.5, true, 3),
  ('line-key-2', 'Margin floor guardrail', -1.0, false, 4);

insert into discount_change_log (line_item_id, by, previous_pct, new_pct, reason, action) values
  ('line-seed-1', 'rep@dealreview.dev', null, 12.0, null, 'accepted'),
  ('line-mer-1',  'rep@dealreview.dev', null, 8.0,  null, 'accepted'),
  ('line-sol-1',  'rep@dealreview.dev', null, 9.5,  null, 'accepted'),
  ('line-sol-2',  'rep@dealreview.dev', null, 10.0, null, 'accepted'),
  ('line-bri-1',  'rep@dealreview.dev', 17.0, 19.0, 'Champion asked for parity with last year''s renewal rate', 'proposed_pending_approval'),
  ('line-bri-1',  'manager@dealreview.dev', 19.0, 19.0, 'Approved given 3-year term and account growth trajectory', 'approved'),
  ('line-key-1',  'rep@dealreview.dev', 15.5, 17.5, 'Multi-region rollout adds onboarding risk, requesting buffer', 'proposed_pending_approval');

comment on table deals is 'One row per deal. status/approval_state mirror the same two-band policy check (15% blended ceiling) the API enforces in backend/app/routers/deals.py.';
comment on table recommendations is 'The AI-generated recommendation per line item; recommendation_factors holds the factor-by-factor breakdown shown in the "Why this number" panel.';
comment on table discount_change_log is 'Audit trail — every accept/propose/approve/reject, with who and why. Backs the per-deal Activity panel in the UI.';
