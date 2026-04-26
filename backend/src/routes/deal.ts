import express from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();

// Get all deals with asset class info
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const deals = db.prepare(`
      SELECT d.*, sac.name as sub_asset_class_name, ac.name as asset_class_name
      FROM deals d
      LEFT JOIN sub_asset_classes sac ON d.sub_asset_class_id = sac.id
      LEFT JOIN asset_classes ac ON d.asset_class_id = ac.id
      ORDER BY d.origination_date DESC
    `).all();
    res.json(deals);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get deal by ID with positions and metrics
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const deal = db.prepare(`
      SELECT d.*, sac.name as sub_asset_class_name, ac.name as asset_class_name
      FROM deals d
      LEFT JOIN sub_asset_classes sac ON d.sub_asset_class_id = sac.id
      LEFT JOIN asset_classes ac ON d.asset_class_id = ac.id
      WHERE d.id = ?
    `).get(parseInt(req.params.id));

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const positions = db.prepare('SELECT * FROM positions WHERE deal_id = ?').all(parseInt(req.params.id));
    const metrics = db.prepare('SELECT * FROM portfolio_metrics WHERE deal_id = ? ORDER BY period_end_date DESC LIMIT 4').all(parseInt(req.params.id));

    res.json({ ...deal, positions, metrics });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create deal
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const {
      name, borrower_entity_name, ultimate_parent_name, asset_class_id, sub_asset_class_id,
      deal_team_lead, status, decision_rationale, origination_date, description,
      instrument_type, total_facility_size, maturity_date, interest_rate_type, coupon_rate, pik_rate
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = db.prepare(`
      INSERT INTO deals (
        name, borrower_entity_name, ultimate_parent_name, asset_class_id, sub_asset_class_id,
        deal_team_lead, status, decision_rationale, origination_date, description,
        instrument_type, total_facility_size, maturity_date, interest_rate_type, coupon_rate, pik_rate,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      name, borrower_entity_name || null, ultimate_parent_name || null, asset_class_id || null,
      sub_asset_class_id || null, deal_team_lead || null, status || 'pipeline', decision_rationale || null,
      origination_date || null, description || null, instrument_type || null, total_facility_size || null,
      maturity_date || null, interest_rate_type || null, coupon_rate || null, pik_rate || null
    );

    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(deal);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update deal
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, borrower_entity_name, ultimate_parent_name, status, coupon_rate, leverage_ratio } = req.body;

    db.prepare(`
      UPDATE deals
      SET name = ?, borrower_entity_name = ?, ultimate_parent_name = ?, status = ?, coupon_rate = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, borrower_entity_name || null, ultimate_parent_name || null, status, coupon_rate || null, parseInt(req.params.id));

    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(parseInt(req.params.id));
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete deal
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM deals WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: 'Deal deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
