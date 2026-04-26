// Firm & Security Master Types
export interface Firm {
  id?: number;
  name: string;
  aum?: number;
  founded_date?: string;
  headquarters?: string;
  website?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssetClass {
  id?: number;
  firm_id: number;
  name: string;
  description?: string;
  sub_class_count?: number;
  sub_classes?: SubAssetClass[];
  created_at?: string;
}

export interface SubAssetClass {
  id?: number;
  asset_class_id: number;
  name: string;
  description?: string;
  created_at?: string;
}

export interface Fund {
  id?: number;
  sub_asset_class_id: number;
  sub_asset_class_name?: string;
  asset_class_name?: string;
  name: string;
  vintage_year?: number;
  target_size?: number;
  hard_cap?: number;
  currency?: string;
  domicile?: string;
  management_fee_rate?: number;
  carried_interest_rate?: number;
  hurdle_rate?: number;
  preferred_return?: number;
  investment_period_end?: string;
  fund_term?: number;
  status?: 'fundraising' | 'investing' | 'harvesting' | 'liquidating';
  vehicle_count?: number;
  share_class_count?: number;
  committed_lp_count?: number;
  total_committed?: number;
  vehicles?: InvestmentVehicle[];
  share_classes?: ShareClass[];
  documents?: Document[];
  created_at?: string;
  updated_at?: string;
}

export interface ShareClass {
  id?: number;
  fund_id: number;
  name: string;
  management_fee_rate?: number;
  carried_interest_rate?: number;
  hurdle_rate?: number;
  preferred_return?: number;
  description?: string;
  status?: 'active' | 'closed';
  created_at?: string;
}

export interface Document {
  id?: number;
  title: string;
  document_type?: string;
  file_path?: string;
  file_size?: number;
  uploaded_by?: string;
  upload_date?: string;
  version?: number;
  parent_entity_type?: string;
  parent_entity_id?: number;
  status?: 'draft' | 'executed' | 'superseded';
  created_at?: string;
}

export interface InvestmentVehicle {
  id?: number;
  fund_id: number;
  fund_name?: string;
  vintage_year?: number;
  name: string;
  legal_entity_type?: string;
  domicile?: string;
  formation_date?: string;
  tax_id?: string;
  status?: 'active' | 'closed' | 'liquidating';
  latest_nav?: FundNAV;
  created_at?: string;
}

// CRM Types
export interface LimitedPartner {
  id?: number;
  name: string;
  type?: string;
  aum?: number;
  headquarters?: string;
  relationship_owner?: string;
  status?: 'prospect' | 'active' | 'inactive';
  notes?: string;
  entity_count?: number;
  contact_count?: number;
  entities?: InvestingEntity[];
  contacts?: Contact[];
  created_at?: string;
  updated_at?: string;
}

export interface InvestingEntity {
  id?: number;
  lp_id: number;
  lp_name?: string;
  legal_name: string;
  entity_type?: string;
  domicile?: string;
  tax_id?: string;
  aml_kyc_status?: 'pending' | 'in_progress' | 'approved' | 'expired';
  aml_kyc_date?: string;
  subscription_doc_status?: 'not_started' | 'in_progress' | 'executed';
  notes?: string;
  commitments?: Commitment[];
  created_at?: string;
  updated_at?: string;
}

export interface Contact {
  id?: number;
  lp_id: number;
  lp_name?: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  role?: string;
  relationship_strength?: 'strong' | 'moderate' | 'weak' | 'unknown';
  last_interaction_date?: string;
  notes?: string;
  related_entities?: InvestingEntity[];
  created_at?: string;
}

// Deal & Portfolio Types
export interface Deal {
  id?: number;
  name: string;
  borrower_entity_name?: string;
  ultimate_parent_name?: string;
  asset_class_id?: number;
  asset_class_name?: string;
  sub_asset_class_id?: number;
  sub_asset_class_name?: string;
  deal_team_lead?: string;
  status?: 'pipeline' | 'approved' | 'funded' | 'exited' | 'passed';
  decision_rationale?: string;
  origination_date?: string;
  description?: string;
  instrument_type?: 'first_lien' | 'second_lien' | 'mezzanine' | 'unitranche' | 'equity_co_invest' | 'other';
  total_facility_size?: number;
  maturity_date?: string;
  interest_rate_type?: 'floating' | 'fixed';
  coupon_rate?: number;
  pik_rate?: number;
  positions?: Position[];
  metrics?: PortfolioMetric[];
  created_at?: string;
  updated_at?: string;
}

export interface Position {
  id?: number;
  deal_id: number;
  deal_name?: string;
  borrower_entity_name?: string;
  investment_vehicle_id: number;
  vehicle_name?: string;
  commitment_amount?: number;
  drawn_amount?: number;
  undrawn_amount?: number;
  fair_value?: number;
  cost_basis?: number;
  advance_rate?: number;
  levered_yield?: number;
  as_of_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioMetric {
  id?: number;
  deal_id: number;
  period_end_date: string;
  period_type?: 'monthly' | 'quarterly' | 'annual';
  revenue?: number;
  ebitda?: number;
  total_debt?: number;
  net_debt?: number;
  leverage_ratio?: number;
  interest_coverage?: number;
  metric_source?: string;
  uploaded_by?: string;
  upload_date?: string;
  ai_extracted?: number;
  created_at?: string;
}

// Capital Accounting Types
export interface CapitalCall {
  id?: number;
  investment_vehicle_id: number;
  vehicle_name?: string;
  fund_name?: string;
  call_number?: number;
  call_date?: string;
  due_date?: string;
  total_amount?: number;
  purpose?: 'investment' | 'management_fee' | 'expenses' | 'mixed';
  status?: 'issued' | 'partially_paid' | 'fully_paid';
  allocations?: CapitalCallAllocation[];
  created_at?: string;
}

export interface CapitalCallAllocation {
  id?: number;
  capital_call_id: number;
  investing_entity_id: number;
  allocated_amount?: number;
  paid_amount?: number;
  paid_date?: string;
  wire_reference?: string;
}

export interface Distribution {
  id?: number;
  investment_vehicle_id: number;
  vehicle_name?: string;
  fund_name?: string;
  distribution_date?: string;
  total_amount?: number;
  type?: 'return_of_capital' | 'income' | 'realized_gain' | 'mixed';
  status?: 'issued' | 'partially_paid' | 'fully_paid';
  allocations?: DistributionAllocation[];
  created_at?: string;
}

export interface DistributionAllocation {
  id?: number;
  distribution_id: number;
  investing_entity_id: number;
  allocated_amount?: number;
  paid_date?: string;
  wire_reference?: string;
}

// Fund Performance
export interface FundNAV {
  id?: number;
  investment_vehicle_id: number;
  period_end_date: string;
  nav?: number;
  called_capital?: number;
  distributed_capital?: number;
  unfunded_commitments?: number;
  gross_irr?: number;
  net_irr?: number;
  moic?: number;
  dpi?: number;
  tvpi?: number;
  created_at?: string;
}

export interface Commitment {
  id?: number;
  investing_entity_id: number;
  investment_vehicle_id: number;
  commitment_amount: number;
  close_date?: string;
  close_number?: 'first' | 'second' | 'third' | 'final';
  currency?: string;
  status?: 'soft' | 'hard' | 'executed';
  created_at?: string;
}
