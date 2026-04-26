import express from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();

// Get all investment vehicles
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const vehicles = db.prepare(`
      SELECT iv.*, f.name as fund_name, f.vintage_year
      FROM investment_vehicles iv
      LEFT JOIN funds f ON iv.fund_id = f.id
      ORDER BY iv.name
    `).all();
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get vehicle by ID with fund and NAV info
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const vehicle = db.prepare(`
      SELECT iv.*, f.name as fund_name, f.vintage_year
      FROM investment_vehicles iv
      LEFT JOIN funds f ON iv.fund_id = f.id
      WHERE iv.id = ?
    `).get(parseInt(req.params.id));

    if (!vehicle) {
      return res.status(404).json({ error: 'Investment vehicle not found' });
    }

    const nav = db.prepare('SELECT * FROM fund_nav WHERE investment_vehicle_id = ? ORDER BY period_end_date DESC LIMIT 1').get(parseInt(req.params.id));
    res.json({ ...vehicle, latest_nav: nav });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create vehicle
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { fund_id, name, legal_entity_type, domicile, formation_date, tax_id, status } = req.body;

    if (!fund_id || !name) {
      return res.status(400).json({ error: 'fund_id and name are required' });
    }

    const result = db.prepare(`
      INSERT INTO investment_vehicles (fund_id, name, legal_entity_type, domicile, formation_date, tax_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(fund_id, name, legal_entity_type || null, domicile || null, formation_date || null, tax_id || null, status || 'active');

    const vehicle = db.prepare('SELECT * FROM investment_vehicles WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(vehicle);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update vehicle
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, legal_entity_type, domicile, formation_date, tax_id, status } = req.body;

    db.prepare(`
      UPDATE investment_vehicles
      SET name = ?, legal_entity_type = ?, domicile = ?, formation_date = ?, tax_id = ?, status = ?
      WHERE id = ?
    `).run(name, legal_entity_type || null, domicile || null, formation_date || null, tax_id || null, status, parseInt(req.params.id));

    const vehicle = db.prepare('SELECT * FROM investment_vehicles WHERE id = ?').get(parseInt(req.params.id));
    if (!vehicle) {
      return res.status(404).json({ error: 'Investment vehicle not found' });
    }
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete vehicle
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM investment_vehicles WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: 'Investment vehicle deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
