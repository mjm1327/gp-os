import express from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();

interface DashboardFund {
  fund_id: number;
  fund_name: string;
  vintage_year: number | null;
  fund_status: string;
  asset_class: string;
  sub_asset_class: string;
  campaign_status: string;
  vehicle_count: number;
  committed_lp_count: number;
  total_committed: number;
  lps_in_pipeline: number;
  funded_deals: number;
  pipeline_deals: number;
  total_drawn: number;
  total_undrawn: number;
}

interface DashboardFundResponse extends DashboardFund {
  lifecycle_stage: string;
}

// Get dashboard funds
router.get('/funds', (req, res) => {
  try {
    const db = getDatabase();
    const funds = db.prepare(`
      SELECT
        f.id as fund_id,
        f.name as fund_name,
        f.vintage_year,
        f.status as fund_status,
        ac.name as asset_class,
        sac.name as sub_asset_class,
        COALESCE(fc.status, 'closed') as campaign_status,
        COUNT(DISTINCT iv.id) as vehicle_count,
        COUNT(DISTINCT CASE WHEN c.status = 'executed' THEN ie.lp_id END) as committed_lp_count,
        COALESCE(SUM(CASE WHEN c.status = 'executed' THEN c.commitment_amount ELSE 0 END), 0) as total_committed,
        COALESCE(MAX(pipeline.prospect_count), 0) as lps_in_pipeline,
        COALESCE(MAX(ds.funded_deals), 0) as funded_deals,
        COALESCE(MAX(ds.pipeline_deals), 0) as pipeline_deals,
        COALESCE(SUM(p.drawn_amount), 0) as total_drawn,
        COALESCE(SUM(p.undrawn_amount), 0) as total_undrawn
      FROM funds f
      JOIN sub_asset_classes sac ON f.sub_asset_class_id = sac.id
      JOIN asset_classes ac ON sac.asset_class_id = ac.id
      LEFT JOIN investment_vehicles iv ON iv.fund_id = f.id
      LEFT JOIN commitments c ON c.investment_vehicle_id = iv.id
      LEFT JOIN investing_entities ie ON c.investing_entity_id = ie.id
      LEFT JOIN fundraising_campaigns fc ON fc.fund_id = f.id
      LEFT JOIN (
        SELECT fc2.fund_id, COUNT(*) as prospect_count
        FROM lp_prospects lpp
        JOIN fundraising_campaigns fc2 ON lpp.fundraising_campaign_id = fc2.id
        WHERE lpp.stage NOT IN ('closed', 'passed')
        GROUP BY fc2.fund_id
      ) pipeline ON pipeline.fund_id = f.id
      LEFT JOIN (
        SELECT d.sub_asset_class_id,
          COUNT(CASE WHEN d.status = 'funded' THEN 1 END) as funded_deals,
          COUNT(CASE WHEN d.status IN ('pipeline', 'approved') THEN 1 END) as pipeline_deals
        FROM deals d
        GROUP BY d.sub_asset_class_id
      ) ds ON ds.sub_asset_class_id = f.sub_asset_class_id
      LEFT JOIN positions p ON p.investment_vehicle_id = iv.id
      GROUP BY f.id, f.name, f.vintage_year, f.status, ac.name, sac.name, fc.status
      ORDER BY f.vintage_year DESC
    `).all() as DashboardFund[];

    // Add lifecycle_stage to each fund
    const fundsWithLifecycle: DashboardFundResponse[] = funds.map(fund => {
      let lifecycle_stage: string;

      if (fund.fund_status === 'fundraising') {
        lifecycle_stage = 'Capital Raising';
      } else if (fund.fund_status === 'investing' && fund.campaign_status === 'active') {
        lifecycle_stage = 'Capital Raising & Investing';
      } else if (fund.fund_status === 'investing' && fund.campaign_status === 'closed') {
        lifecycle_stage = 'Closed & Investing';
      } else if (fund.fund_status === 'harvesting') {
        lifecycle_stage = 'Closed & Harvesting';
      } else if (fund.fund_status === 'liquidating') {
        lifecycle_stage = 'Liquidating';
      } else {
        lifecycle_stage = 'Unknown';
      }

      return {
        ...fund,
        lifecycle_stage,
      };
    });

    res.json(fundsWithLifecycle);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
