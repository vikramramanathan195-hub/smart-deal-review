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
  ('cust-atlas',     'Atlas Manufacturing',  2024, '$890K',  100.0, 11.9);

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
  ('cust-atlas',     'Aug 2025', 13.5, 'lost');

insert into deals (id, name, customer_id, term_length, product_categories, region, status) values
  ('northwind', 'Northwind Industries — FY27 Expansion', 'cust-northwind', '24mo',
    array['Compute','Storage'], 'north_america', 'within_range'),
  ('cerulean', 'Cerulean Logistics — Competitive Displacement', 'cust-cerulean', '36mo',
    array['Networking','Services','Compute'], 'eurozone', 'needs_approval'),
  ('meridian', 'Meridian Health Systems — Annual Renewal', 'cust-meridian', '12mo',
    array['Compute','Services'], 'india', 'within_range'),
  ('atlas', 'Atlas Manufacturing — Global Rollout', 'cust-atlas', '36mo',
    array['Compute','Networking','Storage'], 'japan', 'within_range');

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
  ('line-atl-3',  'atlas',     'Storage', 98000.0);

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
  ('line-atl-3',  12.0, 'high',   86240.0);

insert into recommendation_factors (line_item_id, name, contribution_pct, positive, sort_order) values
  ('line-seed-1', 'Baseline (segment: Enterprise)', 8.0, true, 0),
  ('line-seed-1', 'Customer tenure (4 yrs)', 2.5, true, 1),
  ('line-seed-1', 'Deal size tier', 2.0, true, 2),
  ('line-seed-1', 'Regional competitive pressure', 1.5, true, 3),
  ('line-seed-1', 'Margin floor guardrail', -2.0, false, 4);

comment on table deals is 'One row per deal. status/approval_state mirror the same two-band policy check (15% blended ceiling) the API enforces in backend/app/routers/deals.py.';
comment on table recommendations is 'The AI-generated recommendation per line item; recommendation_factors holds the factor-by-factor breakdown shown in the "Why this number" panel.';
comment on table discount_change_log is 'Audit trail — every accept/propose/approve/reject, with who and why. Backs the per-deal Activity panel in the UI.';
