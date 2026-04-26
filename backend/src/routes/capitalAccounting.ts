import express from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();

// Get capital calls summary
router.get('/summary', (req, res) => {
  try {
    const db = getDatabase();
    const summary = db.prepare(`
      SELECT
        COUNT(DISTINCT cc.id) as total_calls,
        SUM(cc.total_amount) as total_called,
        COUNT(DISTINCT CASE WHEN cc.status = 'fully_paid' THEN cc.id END) as paid_calls,
        COUNT(DISTINCT CASE WHEN cc.status = 'partially_paid' THEN cc.id END) as partial_calls
      FROM capital_calls cc
    `).get();

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all capital calls
router.get('/calls', (req, res) => {
  try {
    const db = getDatabase();
    const calls = db.prepare(`
      SELECT cc.*, iv.name as vehicle_name, f.name as fund_name
      FROM capital_calls cc
      LEFT JOIN investment_vehicles iv ON cc.investment_vehicle_id = iv.id
      LEFT JOIN funds f ON iv.fund_id = f.id
      ORDER BY cc.call_date DESC
    `).all();
    res.json(calls);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get capital call by ID with allocations
router.get('/call/:id', (req, res) => {
  try {
    const db = getDatabase();
    const call = db.prepare('SELECT * FROM capital_calls WHERE id = ?').get(parseInt(req.params.id));

    if (!call) {
      return res.status(404).json({ error: 'Capital call not found' });
    }

    const allocations = db.prepare(`
      SELECT cca.*, ie.legal_name
      FROM capital_call_allocations cca
      LEFT JOIN investing_entities ie ON cca.investing_entity_id = ie.id
      WHERE cca.capital_call_id = ?
    `).all(parseInt(req.params.id));

    res.json({ ...call, allocations });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create capital call
router.post('/call', (req, res) => {
  try {
    const db = getDatabase();
    const { investment_vehicle_id, call_number, call_date, due_date, total_amount, purpose, status } = req.body;

    if (!investment_vehicle_id) {
      return res.status(400).json({ error: 'investment_vehicle_id is required' });
    }

    const result = db.prepare(`
      INSERT INTO capital_calls (investment_vehicle_id, call_number, call_date, due_date, total_amount, purpose, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(investment_vehicle_id, call_number || null, call_date || null, due_date || null, total_amount || null, purpose || null, status || 'issued');

    const call = db.prepare('SELECT * FROM capital_calls WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(call);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get distributions summary
router.get('/distributions/summary', (req, res) => {
  try {
    const db = getDatabase();
    const summary = db.prepare(`
      SELECT
        COUNT(DISTINCT d.id) as total_distributions,
        SUM(d.total_amount) as total_distributed,
        COUNT(DISTINCT CASE WHEN d.status = 'fully_paid' THEN d.id END) as paid_distributions
      FROM distributions d
    `).get();

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all distributions
router.get('/distributions', (req, res) => {
  try {
    const db = getDatabase();
    const distributions = db.prepare(`
      SELECT d.*, iv.name as vehicle_name, f.name as fund_name
      FROM distributions d
      LEFT JOIN investment_vehicles iv ON d.investment_vehicle_id = iv.id
      LEFT JOIN funds f ON iv.fund_id = f.id
      ORDER BY d.distribution_date DESC
    `).all();
    res.json(distributions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get distribution by ID with allocations
router.get('/distribution/:id', (req, res) => {
  try {
    const db = getDatabase();
    const distribution = db.prepare('SELECT * FROM distributions WHERE id = ?').get(parseInt(req.params.id));

    if (!distribution) {
      return res.status(404).json({ error: 'Distribution not found' });
    }

    const allocations = db.prepare(`
      SELECT da.*, ie.legal_name
      FROM distribution_allocations da
      LEFT JOIN investing_entities ie ON da.investing_entity_id = ie.id
      WHERE da.distribution_id = ?
    `).all(parseInt(req.params.id));

    res.json({ ...distribution, allocations });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create distribution
router.post('/distribution', (req, res) => {
  try {
    const db = getDatabase();
    const { investment_vehicle_id, distribution_date, total_amount, type, status } = req.body;

    if (!investment_vehicle_id) {
      return res.status(400).json({ error: 'investment_vehicle_id is required' });
    }

    const result = db.prepare(`
      INSERT INTO distributions (investment_vehicle_id, distribution_date, total_amount, type, status, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(investment_vehicle_id, distribution_date || null, total_amount || null, type || null, status || 'issued');

    const distribution = db.prepare('SELECT * FROM distributions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(distribution);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get fund NAV
router.get('/nav/:vehicleId', (req, res) => {
  try {
    const db = getDatabase();
    const nav = db.prepare(`
      SELECT * FROM fund_nav
      WHERE investment_vehicle_id = ?
      ORDER BY period_end_date DESC
      LIMIT 1
    `).get(parseInt(req.params.vehicleId));

    res.json(nav || {});
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
