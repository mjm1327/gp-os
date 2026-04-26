-- Seed data for GP Operating System

-- Firms
INSERT INTO firms (name, aum, founded_date, headquarters, website) VALUES
('Stonecrest Capital Management', 8000000000, '2010-03-15', 'New York, NY', 'www.stonecrest.com');

-- Asset Classes
INSERT INTO asset_classes (firm_id, name, description) VALUES
(1, 'Private Credit', 'Direct lending and mezzanine financing to middle-market companies'),
(1, 'Private Equity', 'Growth equity and buyout investments in private companies');

-- Sub Asset Classes
INSERT INTO sub_asset_classes (asset_class_id, name, description) VALUES
(1, 'Direct Lending', 'First lien and second lien direct lending facilities'),
(1, 'Mezzanine', 'Subordinated debt and quasi-equity structures'),
(2, 'Growth Equity', 'Growth stage investments in scaling companies');

-- Funds
INSERT INTO funds (sub_asset_class_id, name, vintage_year, target_size, hard_cap, currency, domicile, management_fee_rate, carried_interest_rate, hurdle_rate, preferred_return, investment_period_end, fund_term, status) VALUES
(1, 'Stonecrest Direct Lending Fund III', 2022, 1500000000, 1650000000, 'USD', 'Delaware', 0.015, 0.20, 0.08, 0.08, '2025-12-31', 10, 'investing'),
(2, 'Stonecrest Mezzanine Fund II', 2021, 500000000, 550000000, 'USD', 'Delaware', 0.02, 0.20, 0.08, 0.08, '2024-12-31', 10, 'harvesting'),
(3, 'Stonecrest Growth Equity Fund I', 2023, 750000000, 850000000, 'USD', 'Delaware', 0.02, 0.20, 0.08, 0.08, '2026-12-31', 10, 'investing');

-- Investment Vehicles
INSERT INTO investment_vehicles (fund_id, name, legal_entity_type, domicile, formation_date, tax_id, status) VALUES
(1, 'Stonecrest Direct Lending III LP', 'LP', 'Delaware', '2022-01-15', '82-1234567', 'active'),
(1, 'Stonecrest Direct Lending III (Cayman) Ltd', 'Corp', 'Cayman Islands', '2022-01-20', 'KY123456', 'active'),
(2, 'Stonecrest Mezzanine II LP', 'LP', 'Delaware', '2021-01-10', '82-2345678', 'active'),
(2, 'Stonecrest Mezzanine II (Cayman) Ltd', 'Corp', 'Cayman Islands', '2021-01-15', 'KY234567', 'active'),
(3, 'Stonecrest Growth Equity I LP', 'LP', 'Delaware', '2023-01-05', '82-3456789', 'active'),
(3, 'Stonecrest Growth Equity I (Cayman) Ltd', 'Corp', 'Cayman Islands', '2023-01-10', 'KY345678', 'active');

-- Share Classes (at fund level)
INSERT INTO share_classes (fund_id, name, management_fee_rate, carried_interest_rate, hurdle_rate, preferred_return, description) VALUES
-- Fund 1: Stonecrest Direct Lending Fund III
(1, 'Class A', 0.015, 0.20, 0.08, 0.08, 'Standard institutional terms'),
(1, 'Class B', 0.0125, 0.175, 0.07, 0.07, 'Reduced fee class for anchor investors'),
-- Fund 2: Stonecrest Mezzanine Fund II
(2, 'Class A', 0.020, 0.20, 0.08, 0.08, 'Standard terms'),
-- Fund 3: Stonecrest Growth Equity Fund I
(3, 'Class A', 0.020, 0.20, 0.08, 0.08, 'Standard institutional terms'),
(3, 'Class B', 0.015, 0.175, 0.07, 0.07, 'Preferred terms for early LPs');

-- Limited Partners
INSERT INTO limited_partners (name, type, aum, headquarters, relationship_owner, status, notes) VALUES
('CalPERS', 'pension', 450000000000, 'Sacramento, CA', 'John Smith', 'active', 'Multi-billion dollar pension fund'),
('Harvard Endowment', 'endowment', 50000000000, 'Cambridge, MA', 'Sarah Johnson', 'active', 'Elite university endowment'),
('Blackstone Family Office', 'family_office', 15000000000, 'New York, NY', 'Michael Chen', 'active', 'Large multi-family office'),
('Abu Dhabi Investment Authority', 'sovereign_wealth', 250000000000, 'Abu Dhabi, UAE', 'Ahmed Al-Mansouri', 'active', 'Sovereign wealth fund'),
('Rockefeller Foundation', 'foundation', 5000000000, 'New York, NY', 'Elizabeth Davis', 'prospect', 'Historic philanthropic foundation');

-- Investing Entities
INSERT INTO investing_entities (lp_id, legal_name, entity_type, domicile, tax_id, aml_kyc_status, aml_kyc_date, subscription_doc_status) VALUES
(1, 'CalPERS Investments LP', 'LP', 'Delaware', '95-1234567', 'approved', '2022-01-15', 'executed'),
(1, 'CalPERS International Fund', 'LP', 'Cayman Islands', 'KY111111', 'approved', '2022-01-15', 'executed'),
(2, 'Harvard Endowment Capital Fund', 'LLC', 'Delaware', '04-2222222', 'approved', '2021-06-01', 'executed'),
(3, 'Blackstone Family Partners LP', 'LP', 'Delaware', '13-3333333', 'approved', '2022-03-20', 'executed'),
(4, 'ADIA Investment Co', 'Corp', 'UAE', 'AE444444', 'approved', '2022-02-10', 'executed'),
(4, 'ADIA Cayman Fund', 'Corp', 'Cayman Islands', 'KY444444', 'approved', '2022-02-10', 'executed'),
(5, 'Rockefeller Foundation Fund', 'LLC', 'Delaware', '13-5555555', 'pending', NULL, 'not_started');

-- Contacts
INSERT INTO contacts (lp_id, name, title, email, phone, role, relationship_strength, last_interaction_date, notes) VALUES
(1, 'Robert Williams', 'Head of Private Markets', 'rwilliams@calpers.org', '+1-916-555-0100', 'decision_maker', 'strong', '2026-04-15', 'Primary decision maker for alternatives'),
(1, 'Jennifer Lee', 'Private Credit Portfolio Manager', 'jlee@calpers.org', '+1-916-555-0101', 'operations', 'moderate', '2026-04-10', 'Day-to-day portfolio contact'),
(2, 'David Martinez', 'Chief Investment Officer', 'dmartinez@harvard.edu', '+1-617-555-0200', 'decision_maker', 'strong', '2026-04-18', 'Reviews all new commitments'),
(3, 'Lisa Anderson', 'Investment Director', 'landerson@blackstone-fo.com', '+1-212-555-0300', 'decision_maker', 'moderate', '2026-04-12', 'Manages credit allocations'),
(4, 'Farah Al-Rashid', 'Senior Investment Officer', 'f.alrashid@adia.ae', '+971-2-555-0400', 'decision_maker', 'moderate', '2026-04-20', 'ADIA representative'),
(5, 'Thomas Grant', 'Treasurer', 'tgrant@rockefeller.org', '+1-212-555-0500', 'gatekeeper', 'weak', '2026-03-15', 'First point of contact');

-- Commitments
INSERT INTO commitments (investing_entity_id, investment_vehicle_id, share_class_id, commitment_amount, close_date, close_number, currency, status) VALUES
(1, 1, 2, 250000000, '2022-01-31', 'first', 'USD', 'executed'),
(2, 2, 1, 100000000, '2022-02-15', 'first', 'USD', 'executed'),
(3, 1, 1, 150000000, '2022-03-31', 'first', 'USD', 'executed'),
(4, 3, 3, 75000000, '2022-06-30', 'first', 'USD', 'executed'),
(5, 1, 1, 200000000, '2022-02-28', 'first', 'USD', 'executed'),
(6, 2, 1, 50000000, '2022-03-15', 'first', 'USD', 'executed'),
(1, 5, 5, 100000000, '2023-03-31', 'first', 'USD', 'hard');

-- Deals
INSERT INTO deals (name, borrower_entity_name, ultimate_parent_name, asset_class_id, sub_asset_class_id, deal_team_lead, status, decision_rationale, origination_date, description, instrument_type, total_facility_size, maturity_date, interest_rate_type, coupon_rate, pik_rate) VALUES
('TechVentures Holdco - Debt Facility', 'TechVentures Inc', 'TechVentures Holdings LLC', 1, 1, 'Alex Thompson', 'funded', 'Strong management team, growing revenue', '2022-06-01', 'First lien debt facility for software company', 'first_lien', 350000000, '2027-06-01', 'floating', 0.065, 0.02),
('RetailCorp Refinancing', 'RetailCorp Services', 'RetailCorp Inc', 1, 1, 'Michelle Rodriguez', 'funded', 'Stable cash flows, market refinance', '2022-07-15', 'Refinance of existing debt with improved terms', 'first_lien', 250000000, '2027-07-15', 'fixed', 0.0725, NULL),
('HealthTech Growth Facility', 'HealthTech Solutions Inc', 'HealthTech Acquisition Co', 1, 1, 'James Wilson', 'funded', 'High growth in recurring revenue segment', '2022-08-20', 'Growth capex facility for healthcare software', 'first_lien', 200000000, '2027-08-20', 'floating', 0.062, 0.015),
('ManufacturingCo Mezz Investment', 'ManufacturingCo USA', 'ManufacturingCo Holdings', 1, 2, 'Patricia Brown', 'funded', 'Profitable with growth potential', '2022-09-10', 'Mezzanine financing for acquisition', 'mezzanine', 150000000, '2027-09-10', 'fixed', 0.115, 0.05),
('SaaS Unicorn Series D', 'CloudAnalytics Inc', 'CloudAnalytics Holdings', 2, 3, 'David Kim', 'funded', 'Unicorn valuation, strong ARR growth', '2023-03-01', 'Growth equity investment in SaaS leader', 'equity_co_invest', 200000000, NULL, 'floating', 0.0, NULL),
('ConsumerGoods Debt Facility', 'ConsumerGoods Company', 'ConsumerGoods Global', 1, 1, 'Sarah Jackson', 'approved', 'Market expansion strategy', '2023-11-01', 'First lien facility for working capital', 'first_lien', 180000000, '2028-11-01', 'floating', 0.068, 0.01),
('FinTechScale Mezzanine', 'FinTechScale Corp', 'FinTechScale Investors', 1, 2, 'Robert Martinez', 'approved', 'Rapid user growth, path to profitability', '2024-01-15', 'Mezzanine for technology platform expansion', 'mezzanine', 120000000, '2029-01-15', 'fixed', 0.12, 0.04),
('InsuranceModern Growth', 'InsuranceModern Tech', 'InsuranceModern Holdings', 2, 3, 'Emily Chen', 'pipeline', 'Disruption of legacy insurance market', '2024-02-01', 'Growth investment in insurtech platform', 'equity_co_invest', 150000000, NULL, NULL, NULL, NULL),
('LogisticsPro Facility', 'LogisticsPro Holdings', 'LogisticsPro Global', 1, 1, 'Kevin O''Brien', 'pipeline', 'Supply chain optimization opportunity', '2024-03-01', 'First lien facility for logistics network', 'first_lien', 280000000, '2029-03-01', 'floating', 0.066, NULL),
('EdTech Renaissance Equity', 'EdTech Renaissance', 'EdTech Renaissance Corp', 2, 3, 'Victoria Lee', 'passed', 'Regulatory concerns', '2024-01-10', 'Growth equity in education technology', 'equity_co_invest', 100000000, NULL, NULL, NULL, NULL);

-- Positions (updated_at reflects varied staleness for demo: green < 30d, amber 30-60d, red > 60d)
INSERT INTO positions (deal_id, investment_vehicle_id, commitment_amount, drawn_amount, undrawn_amount, fair_value, cost_basis, advance_rate, levered_yield, as_of_date, updated_at) VALUES
(1, 1, 150000000, 140000000, 10000000, 142500000, 140000000, 0.90, 0.085, '2026-03-31', '2026-04-20 10:30:00'),
(1, 2, 50000000, 47000000, 3000000, 47750000, 47000000, 0.90, 0.085, '2026-03-31', '2026-04-20 10:30:00'),
(2, 1, 100000000, 98000000, 2000000, 99000000, 98000000, 0.92, 0.082, '2026-03-31', '2026-04-10 14:15:00'),
(3, 1, 80000000, 75000000, 5000000, 76500000, 75000000, 0.88, 0.088, '2026-03-31', '2026-03-15 09:00:00'),
(4, 3, 60000000, 55000000, 5000000, 58000000, 55000000, 0.85, 0.125, '2026-03-31', '2026-02-28 11:45:00'),
(5, 5, 100000000, 95000000, 5000000, 130000000, 95000000, 0.95, 0.15, '2026-03-31', '2026-04-22 16:00:00'),
(6, 1, 120000000, 0, 120000000, NULL, NULL, NULL, NULL, '2026-03-31', '2026-04-01 08:00:00'),
(7, 3, 85000000, 0, 85000000, NULL, NULL, NULL, NULL, '2026-03-31', '2026-02-01 08:00:00');

-- Portfolio Metrics (sample quarterly data)
INSERT INTO portfolio_metrics (deal_id, period_end_date, period_type, revenue, ebitda, total_debt, net_debt, leverage_ratio, interest_coverage, metric_source, uploaded_by, upload_date, ai_extracted) VALUES
(1, '2026-03-31', 'quarterly', 45000000, 18000000, 340000000, 320000000, 3.8, 2.1, 'financial_stmt', 'borrower', '2026-04-15', 0),
(2, '2026-03-31', 'quarterly', 32000000, 12000000, 248000000, 235000000, 4.1, 1.9, 'financial_stmt', 'borrower', '2026-04-12', 0),
(3, '2026-03-31', 'quarterly', 28000000, 10500000, 198000000, 185000000, 3.6, 2.3, 'compliance_cert', 'borrower', '2026-04-18', 0),
(4, '2026-03-31', 'quarterly', 22000000, 7500000, 150000000, 138000000, 3.2, 2.8, 'financial_stmt', 'borrower', '2026-04-10', 0),
(5, '2026-03-31', 'quarterly', 85000000, 22000000, 0, 0, 0.0, NULL, 'financial_stmt', 'borrower', '2026-04-20', 0);

-- Reporting Obligations
INSERT INTO reporting_obligations (deal_id, obligation_type, frequency, days_after_period_end, last_received_date, last_received_period, status) VALUES
(1, 'monthly_financials', 'monthly', 30, '2026-04-15', '2026-03-31', 'current'),
(1, 'quarterly_financials', 'quarterly', 60, '2026-04-15', '2026-03-31', 'current'),
(2, 'monthly_financials', 'monthly', 30, '2026-04-12', '2026-03-31', 'current'),
(2, 'compliance_cert', 'monthly', 15, '2026-04-10', '2026-03-31', 'current'),
(3, 'monthly_financials', 'monthly', 30, '2026-04-18', '2026-03-31', 'current'),
(4, 'quarterly_financials', 'quarterly', 60, '2026-04-10', '2026-03-31', 'current'),
(5, 'quarterly_financials', 'quarterly', 45, '2026-04-20', '2026-03-31', 'current');

-- Call Records
INSERT INTO call_records (deal_id, call_date, participants, call_type, transcript_text, summary, status) VALUES
(1, '2026-04-15', 'CFO, Treasurer, Deal Team', 'monthly_update', 'Discussion of Q1 performance...', 'Strong revenue growth continues. EBITDA up 12% YoY. Debt reduction on track.', 'reviewed'),
(2, '2026-04-12', 'CFO, COO, Deal Team Lead', 'monthly_update', 'Monthly update on operations...', 'Stable performance. Pricing remains firm. Interest coverage strong at 1.9x.', 'reviewed'),
(3, '2026-04-18', 'CFO, Treasurer, Sponsor', 'monthly_update', 'Healthcare software update...', 'Recurring revenue increased 18% YoY. Customer retention at 96%.', 'pending_review'),
(4, '2026-04-10', 'CEO, CFO, Deal Team', 'quarterly_review', 'Q1 comprehensive review...', 'Acquisition integration progressing. EBITDA margins improving. Debt reduction ahead of schedule.', 'reviewed'),
(5, '2026-04-20', 'CEO, Sponsor Partners', 'quarterly_review', 'SaaS platform quarterly update...', 'ARR growth 28% YoY. Net dollar retention 125%. Strong unit economics.', 'pending_review');

-- Capital Calls
INSERT INTO capital_calls (investment_vehicle_id, call_number, call_date, due_date, total_amount, purpose, status) VALUES
(1, 1, '2022-02-01', '2022-02-15', 400000000, 'investment', 'fully_paid'),
(1, 2, '2022-06-15', '2022-07-01', 250000000, 'investment', 'fully_paid'),
(1, 3, '2022-11-01', '2022-11-15', 180000000, 'investment', 'fully_paid'),
(1, 4, '2023-03-01', '2023-03-15', 200000000, 'mixed', 'fully_paid'),
(1, 5, '2024-01-15', '2024-02-01', 150000000, 'investment', 'fully_paid'),
(1, 6, '2026-02-01', '2026-02-15', 120000000, 'investment', 'partially_paid');

-- Capital Call Allocations
INSERT INTO capital_call_allocations (capital_call_id, investing_entity_id, allocated_amount, paid_amount, paid_date, wire_reference) VALUES
(1, 1, 200000000, 200000000, '2022-02-14', 'WIRE-20220214-001'),
(1, 2, 50000000, 50000000, '2022-02-14', 'WIRE-20220214-002'),
(1, 3, 100000000, 100000000, '2022-02-14', 'WIRE-20220214-003'),
(1, 4, 50000000, 50000000, '2022-02-14', 'WIRE-20220214-004'),
(6, 1, 60000000, 45000000, '2026-02-14', 'WIRE-20260214-001'),
(6, 2, 30000000, 22500000, '2026-02-14', 'WIRE-20260214-002'),
(6, 3, 30000000, 22500000, '2026-02-14', 'WIRE-20260214-003');

-- Distributions
INSERT INTO distributions (investment_vehicle_id, distribution_date, total_amount, type, status) VALUES
(3, '2024-06-15', 50000000, 'return_of_capital', 'fully_paid'),
(3, '2024-12-15', 75000000, 'mixed', 'fully_paid'),
(4, '2025-03-15', 25000000, 'income', 'fully_paid'),
(1, '2026-02-15', 45000000, 'realized_gain', 'partially_paid');

-- Distribution Allocations
INSERT INTO distribution_allocations (distribution_id, investing_entity_id, allocated_amount, paid_date, wire_reference) VALUES
(1, 1, 30000000, '2024-06-15', 'DIST-20240615-001'),
(1, 2, 20000000, '2024-06-15', 'DIST-20240615-002'),
(2, 1, 45000000, '2024-12-15', 'DIST-20241215-001'),
(2, 2, 30000000, '2024-12-15', 'DIST-20241215-002'),
(3, 3, 15000000, '2025-03-15', 'DIST-20250315-001'),
(3, 4, 10000000, '2025-03-15', 'DIST-20250315-002'),
(4, 1, 22500000, '2026-02-15', 'DIST-20260215-001'),
(4, 2, 15000000, NULL, NULL),
(4, 3, 7500000, NULL, NULL);

-- Fund NAV
INSERT INTO fund_nav (investment_vehicle_id, period_end_date, nav, called_capital, distributed_capital, unfunded_commitments, gross_irr, net_irr, moic, dpi, tvpi) VALUES
(1, '2026-03-31', 1425000000, 1080000000, 125000000, 420000000, 0.14, 0.115, 1.32, 0.12, 1.44),
(2, '2026-03-31', 485000000, 320000000, 95000000, 180000000, 0.10, 0.082, 1.19, 0.30, 1.49),
(3, '2026-03-31', 210000000, 95000000, 0, 105000000, 0.25, 0.22, 2.20, 0.0, 2.20),
(4, '2026-03-31', 195000000, 75000000, 40000000, 75000000, 0.12, 0.095, 1.25, 0.53, 1.78),
(5, '2026-03-31', 1320000000, 640000000, 85000000, 360000000, 0.16, 0.135, 1.42, 0.13, 1.55),
(6, '2026-03-31', 155000000, 50000000, 15000000, 50000000, 0.14, 0.115, 1.28, 0.30, 1.58);

-- Fundraising Campaigns
INSERT INTO fundraising_campaigns (fund_id, target_close_date, first_close_date, final_close_date, target_size, status) VALUES
(1, '2023-06-30', '2022-01-31', '2023-03-31', 1500000000, 'closed'),
(2, '2022-06-30', '2021-01-15', '2022-02-28', 500000000, 'closed'),
(3, '2024-12-31', '2023-03-31', NULL, 750000000, 'active');

-- LP Prospects
INSERT INTO lp_prospects (fundraising_campaign_id, lp_id, stage, commitment_interest_amount, probability, assigned_to, last_activity_date, notes) VALUES
(3, 1, 'closed', 100000000, 100, 'John Smith', '2023-03-30', 'CalPERS committed'),
(3, 2, 'soft_circle', 75000000, 85, 'Sarah Johnson', '2026-04-18', 'Positive signals from Harvard'),
(3, 3, 'diligence', 50000000, 70, 'Michael Chen', '2026-04-15', 'Blackstone in active diligence'),
(3, 4, 'hard_commit', 150000000, 95, 'Ahmed Al-Mansouri', '2026-04-20', 'ADIA likely to commit'),
(3, 5, 'identified', 50000000, 30, 'Elizabeth Davis', '2026-03-15', 'Rockefeller Foundation interested');

-- Interactions
INSERT INTO interactions (lp_id, contact_id, interaction_date, type, summary, next_action, owner) VALUES
(1, 1, '2026-04-15', 'call', 'Quarterly update on fund performance and pipeline', 'Send updated fund summary', 'Alex Thompson'),
(2, 3, '2026-04-18', 'meeting', 'In-person meeting at offices to discuss Growth Fund', 'Follow up with presentation', 'Sarah Johnson'),
(3, 4, '2026-04-12', 'email', 'Follow-up regarding due diligence questions', 'Schedule call to address concerns', 'Michael Chen'),
(4, 5, '2026-04-20', 'call', 'Confirmation of commitment for Growth Equity Fund', 'Send commitment letter', 'Ahmed Al-Mansouri'),
(5, 6, '2026-03-15', 'email', 'Initial outreach regarding Growth Equity Fund', 'Send fund PPM and one-pager', 'Elizabeth Davis');

-- Firm Users
INSERT INTO users (name, email, role, avatar_initials) VALUES
('Sarah Chen', 'schen@stonecrest.com', 'managing_director', 'SC'),
('Alex Thompson', 'athompson@stonecrest.com', 'director', 'AT'),
('Michelle Rodriguez', 'mrodriguez@stonecrest.com', 'director', 'MR'),
('James Wilson', 'jwilson@stonecrest.com', 'associate', 'JW'),
('Patricia Brown', 'pbrown@stonecrest.com', 'associate', 'PB'),
('Michael Chang', 'mchang@stonecrest.com', 'admin', 'MC');

-- Tasks (seed across deals 1-5, linked to call records 1-5 plus some manual)
INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, description, source_quote, priority, due_date, status) VALUES
-- Deal 1 (TechVentures) — from call record 1, created by Sarah
(1, 1, 2, 1, 'Request updated financial model from CFO', 'CFO mentioned updated model would be available by end of April. Follow up to obtain and validate against Q1 metrics.', '"We should have the updated model ready by end of the month, happy to share it with the team"', 'high', '2026-04-30', 'open'),
(1, 1, 6, 1, 'Update advance rate in source system to 0.90', 'Advance rate confirmed at 0.90 on call. Admin to update in source system.', '"The advance rate remains at 90 basis points as agreed in the credit agreement"', 'high', '2026-04-28', 'open'),
(1, 1, 4, 1, 'Review covenant compliance certificate', 'Borrower mentioned cert will be submitted in 2 weeks. Review upon receipt.', '"We will have the compliance certificate over to you within the next two weeks"', 'medium', '2026-05-10', 'open'),
(1, NULL, 2, 1, 'Schedule Q2 board call', 'Coordinate with CFO office for Q2 board date', NULL, 'low', '2026-05-15', 'complete'),
-- Deal 2 (RetailCorp) — from call record 2
(2, 2, 3, 1, 'Follow up on covenant waiver documentation', 'COO referenced waiver on the prior period coverage ratio. Need executed waiver document on file.', '"Yes the waiver was executed last month, I can get you a copy of that documentation"', 'high', '2026-05-05', 'open'),
(2, 2, 6, 1, 'Confirm Q1 interest payment received', 'Admin to verify wire receipt matches expected interest amount.', '"The Q1 interest payment was sent last Friday, standard wire"', 'medium', '2026-04-26', 'in_progress'),
-- Deal 3 (HealthTech) — from call record 3
(3, 3, 4, 1, 'Validate recurring revenue figure against financials', 'Borrower stated recurring revenue increased 18% YoY. Cross-check against submitted financials.', '"Our recurring revenue is up 18% year over year, we are very pleased with retention"', 'medium', '2026-05-02', 'open'),
(3, 3, 6, 1, 'Update EBITDA and revenue in system for Q1', 'New figures provided on call. Admin to enter into portfolio system.', '"EBITDA for Q1 came in at 10.8 million, revenue was 29.2 million"', 'high', '2026-04-27', 'open'),
-- Deal 4 (ManufacturingCo) — from call record 4
(4, 4, 5, 1, 'Track integration milestones against acquisition plan', 'CEO noted integration is ahead of schedule. Request formal milestone tracker from management.', '"Integration is tracking ahead of our original 18-month plan, we should be done by Q3"', 'medium', '2026-05-15', 'open'),
-- Deal 5 (SaaS Unicorn) — from call record 5, manual
(5, 5, 2, 1, 'Request net dollar retention supporting data', 'Sponsor cited 125% NDR. Obtain underlying cohort analysis.', '"Net dollar retention came in at 125% which we are really proud of this quarter"', 'high', '2026-05-01', 'open'),
(5, NULL, 2, 1, 'Prepare fair value memo for Q2 valuation committee', 'Equity position — need updated valuation memo ahead of Q2 committee', NULL, 'high', '2026-05-20', 'open');
