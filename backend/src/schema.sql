-- Security Master
CREATE TABLE IF NOT EXISTS firms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  aum REAL,
  founded_date TEXT,
  headquarters TEXT,
  website TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asset_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firm_id INTEGER NOT NULL REFERENCES firms(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sub_asset_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_class_id INTEGER NOT NULL REFERENCES asset_classes(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_asset_class_id INTEGER NOT NULL REFERENCES sub_asset_classes(id),
  name TEXT NOT NULL,
  vintage_year INTEGER,
  target_size REAL,
  hard_cap REAL,
  currency TEXT DEFAULT 'USD',
  domicile TEXT,
  management_fee_rate REAL,
  carried_interest_rate REAL,
  hurdle_rate REAL,
  preferred_return REAL,
  investment_period_end TEXT,
  fund_term INTEGER,
  status TEXT DEFAULT 'fundraising' CHECK(status IN ('fundraising','investing','harvesting','liquidating')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS investment_vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  name TEXT NOT NULL,
  legal_entity_type TEXT,
  domicile TEXT,
  formation_date TEXT,
  tax_id TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','closed','liquidating')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS share_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  name TEXT NOT NULL,
  management_fee_rate REAL,
  carried_interest_rate REAL,
  hurdle_rate REAL,
  preferred_return REAL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','closed')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- CRM Layer
CREATE TABLE IF NOT EXISTS limited_partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('pension','endowment','family_office','sovereign_wealth','foundation','insurance','fund_of_funds','other')),
  aum REAL,
  headquarters TEXT,
  relationship_owner TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('prospect','active','inactive')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS investing_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lp_id INTEGER NOT NULL REFERENCES limited_partners(id),
  legal_name TEXT NOT NULL,
  entity_type TEXT CHECK(entity_type IN ('LP','LLC','trust','corporation','other')),
  domicile TEXT,
  tax_id TEXT,
  aml_kyc_status TEXT DEFAULT 'pending' CHECK(aml_kyc_status IN ('pending','in_progress','approved','expired')),
  aml_kyc_date TEXT,
  subscription_doc_status TEXT DEFAULT 'not_started' CHECK(subscription_doc_status IN ('not_started','in_progress','executed')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lp_id INTEGER NOT NULL REFERENCES limited_partners(id),
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  role TEXT CHECK(role IN ('decision_maker','gatekeeper','operations','legal','tax','other')),
  relationship_strength TEXT CHECK(relationship_strength IN ('strong','moderate','weak','unknown')),
  last_interaction_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_investing_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  investing_entity_id INTEGER NOT NULL REFERENCES investing_entities(id),
  role TEXT DEFAULT 'primary' CHECK(role IN ('primary','secondary','cc_only')),
  notes TEXT,
  UNIQUE(contact_id, investing_entity_id)
);

-- Commitments & Side Letters
CREATE TABLE IF NOT EXISTS commitments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investing_entity_id INTEGER NOT NULL REFERENCES investing_entities(id),
  investment_vehicle_id INTEGER NOT NULL REFERENCES investment_vehicles(id),
  share_class_id INTEGER REFERENCES share_classes(id),
  commitment_amount REAL NOT NULL,
  close_date TEXT,
  close_number TEXT CHECK(close_number IN ('first','second','third','final')),
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'soft' CHECK(status IN ('soft','hard','executed')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS side_letters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commitment_id INTEGER NOT NULL REFERENCES commitments(id),
  investing_entity_id INTEGER NOT NULL REFERENCES investing_entities(id),
  investment_vehicle_id INTEGER NOT NULL REFERENCES investment_vehicles(id),
  executed_date TEXT,
  fee_modifications TEXT,
  other_modifications TEXT,
  document_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS investment_restrictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  side_letter_id INTEGER NOT NULL REFERENCES side_letters(id),
  investing_entity_id INTEGER NOT NULL REFERENCES investing_entities(id),
  restriction_type TEXT CHECK(restriction_type IN ('ESG','sector','geography','concentration','other')),
  description TEXT NOT NULL,
  applies_automatically INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Deal Flow
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  borrower_entity_name TEXT,
  ultimate_parent_name TEXT,
  asset_class_id INTEGER REFERENCES asset_classes(id),
  sub_asset_class_id INTEGER REFERENCES sub_asset_classes(id),
  deal_team_lead TEXT,
  status TEXT DEFAULT 'pipeline' CHECK(status IN ('pipeline','approved','funded','exited','passed')),
  decision_rationale TEXT,
  origination_date TEXT,
  description TEXT,
  instrument_type TEXT CHECK(instrument_type IN ('first_lien','second_lien','mezzanine','unitranche','equity_co_invest','other')),
  total_facility_size REAL,
  maturity_date TEXT,
  interest_rate_type TEXT CHECK(interest_rate_type IN ('floating','fixed')),
  coupon_rate REAL,
  pik_rate REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deal_opt_outs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  investing_entity_id INTEGER NOT NULL REFERENCES investing_entities(id),
  opt_out_type TEXT NOT NULL CHECK(opt_out_type IN ('sideletter_automatic','ad_hoc_gp','lp_request')),
  reason TEXT,
  decided_by TEXT,
  decided_date TEXT,
  side_letter_restriction_id INTEGER REFERENCES investment_restrictions(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Portfolio Monitoring
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  investment_vehicle_id INTEGER NOT NULL REFERENCES investment_vehicles(id),
  commitment_amount REAL,
  drawn_amount REAL DEFAULT 0,
  undrawn_amount REAL DEFAULT 0,
  fair_value REAL,
  cost_basis REAL,
  advance_rate REAL,
  levered_yield REAL,
  as_of_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS portfolio_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  period_end_date TEXT NOT NULL,
  period_type TEXT CHECK(period_type IN ('monthly','quarterly','annual')),
  revenue REAL,
  ebitda REAL,
  total_debt REAL,
  net_debt REAL,
  leverage_ratio REAL,
  interest_coverage REAL,
  metric_source TEXT CHECK(metric_source IN ('compliance_cert','financial_stmt','call_extraction','manual')),
  uploaded_by TEXT,
  upload_date TEXT,
  ai_extracted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reporting_obligations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  obligation_type TEXT CHECK(obligation_type IN ('monthly_financials','quarterly_financials','compliance_cert','annual_audit')),
  frequency TEXT CHECK(frequency IN ('monthly','quarterly','annual')),
  days_after_period_end INTEGER,
  last_received_date TEXT,
  last_received_period TEXT,
  status TEXT DEFAULT 'current' CHECK(status IN ('current','overdue','waived')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS call_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  call_date TEXT NOT NULL,
  participants TEXT,
  call_type TEXT CHECK(call_type IN ('monthly_update','quarterly_review','ad_hoc')),
  transcript_text TEXT,
  recording_url TEXT,
  summary TEXT,
  status TEXT DEFAULT 'pending_review' CHECK(status IN ('pending_review','reviewed')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_record_id INTEGER NOT NULL REFERENCES call_records(id),
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  field_updated TEXT NOT NULL,
  previous_value TEXT,
  extracted_value TEXT NOT NULL,
  confidence_score REAL,
  extraction_rationale TEXT,
  status TEXT DEFAULT 'pending_approval' CHECK(status IN ('pending_approval','approved','rejected')),
  approved_by TEXT,
  approved_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Capital Accounting
CREATE TABLE IF NOT EXISTS capital_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_vehicle_id INTEGER NOT NULL REFERENCES investment_vehicles(id),
  call_number INTEGER,
  call_date TEXT,
  due_date TEXT,
  total_amount REAL,
  purpose TEXT CHECK(purpose IN ('investment','management_fee','expenses','mixed')),
  status TEXT DEFAULT 'issued' CHECK(status IN ('issued','partially_paid','fully_paid')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS capital_call_deal_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capital_call_id INTEGER NOT NULL REFERENCES capital_calls(id),
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  amount REAL NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS capital_call_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  capital_call_id INTEGER NOT NULL REFERENCES capital_calls(id),
  investing_entity_id INTEGER NOT NULL REFERENCES investing_entities(id),
  allocated_amount REAL,
  paid_amount REAL DEFAULT 0,
  paid_date TEXT,
  wire_reference TEXT
);

CREATE TABLE IF NOT EXISTS distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_vehicle_id INTEGER NOT NULL REFERENCES investment_vehicles(id),
  distribution_date TEXT,
  total_amount REAL,
  type TEXT CHECK(type IN ('return_of_capital','income','realized_gain','mixed')),
  status TEXT DEFAULT 'issued' CHECK(status IN ('issued','partially_paid','fully_paid')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS distribution_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distribution_id INTEGER NOT NULL REFERENCES distributions(id),
  investing_entity_id INTEGER NOT NULL REFERENCES investing_entities(id),
  allocated_amount REAL,
  paid_date TEXT,
  wire_reference TEXT
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  document_type TEXT,
  file_path TEXT,
  file_size INTEGER,
  uploaded_by TEXT,
  upload_date TEXT DEFAULT (datetime('now')),
  version INTEGER DEFAULT 1,
  parent_entity_type TEXT,
  parent_entity_id INTEGER,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','executed','superseded')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Fund Performance
CREATE TABLE IF NOT EXISTS fund_nav (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_vehicle_id INTEGER NOT NULL REFERENCES investment_vehicles(id),
  period_end_date TEXT NOT NULL,
  nav REAL,
  called_capital REAL,
  distributed_capital REAL,
  unfunded_commitments REAL,
  gross_irr REAL,
  net_irr REAL,
  moic REAL,
  dpi REAL,
  tvpi REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Fundraising
CREATE TABLE IF NOT EXISTS fundraising_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  target_close_date TEXT,
  first_close_date TEXT,
  final_close_date TEXT,
  target_size REAL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','closed')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lp_prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fundraising_campaign_id INTEGER NOT NULL REFERENCES fundraising_campaigns(id),
  lp_id INTEGER NOT NULL REFERENCES limited_partners(id),
  stage TEXT DEFAULT 'identified' CHECK(stage IN ('identified','outreach','diligence','soft_circle','hard_commit','closed','passed')),
  commitment_interest_amount REAL,
  probability INTEGER,
  assigned_to TEXT,
  last_activity_date TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Interactions
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lp_id INTEGER NOT NULL REFERENCES limited_partners(id),
  contact_id INTEGER REFERENCES contacts(id),
  interaction_date TEXT NOT NULL,
  type TEXT CHECK(type IN ('call','meeting','email','conference','other')),
  summary TEXT,
  next_action TEXT,
  owner TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Firm Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT CHECK(role IN ('partner','managing_director','director','associate','analyst','admin','operations')),
  avatar_initials TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tasks (deal-level, created from call transcripts or manually)
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL REFERENCES deals(id),
  call_record_id INTEGER REFERENCES call_records(id),
  assigned_to INTEGER NOT NULL REFERENCES users(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  source_quote TEXT,
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('high','medium','low')),
  due_date TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open','in_progress','complete','cancelled')),
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_classes_firm_id ON asset_classes(firm_id);
CREATE INDEX IF NOT EXISTS idx_sub_asset_classes_asset_class_id ON sub_asset_classes(asset_class_id);
CREATE INDEX IF NOT EXISTS idx_funds_sub_asset_class_id ON funds(sub_asset_class_id);
CREATE INDEX IF NOT EXISTS idx_investment_vehicles_fund_id ON investment_vehicles(fund_id);
CREATE INDEX IF NOT EXISTS idx_limited_partners_status ON limited_partners(status);
CREATE INDEX IF NOT EXISTS idx_investing_entities_lp_id ON investing_entities(lp_id);
CREATE INDEX IF NOT EXISTS idx_contacts_lp_id ON contacts(lp_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_asset_class_id ON deals(asset_class_id);
CREATE INDEX IF NOT EXISTS idx_positions_deal_id ON positions(deal_id);
CREATE INDEX IF NOT EXISTS idx_positions_investment_vehicle_id ON positions(investment_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_commitments_investing_entity_id ON commitments(investing_entity_id);
CREATE INDEX IF NOT EXISTS idx_commitments_investment_vehicle_id ON commitments(investment_vehicle_id);
