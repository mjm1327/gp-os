import express from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();

// Get all asset classes with sub-classes
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const assetClasses = db.prepare(`
      SELECT ac.*, COUNT(sac.id) as sub_class_count
      FROM asset_classes ac
      LEFT JOIN sub_asset_classes sac ON ac.id = sac.asset_class_id
      GROUP BY ac.id
      ORDER BY ac.name
    `).all();
    res.json(assetClasses);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get asset class by ID with sub-classes
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const assetClass = db.prepare('SELECT * FROM asset_classes WHERE id = ?').get(parseInt(req.params.id));
    if (!assetClass) {
      return res.status(404).json({ error: 'Asset class not found' });
    }

    const subClasses = db.prepare('SELECT * FROM sub_asset_classes WHERE asset_class_id = ?').all(parseInt(req.params.id));
    res.json({ ...assetClass, sub_classes: subClasses });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create asset class
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { firm_id, name, description } = req.body;

    if (!firm_id || !name) {
      return res.status(400).json({ error: 'firm_id and name are required' });
    }

    const result = db.prepare(`
      INSERT INTO asset_classes (firm_id, name, description, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(firm_id, name, description || null);

    const assetClass = db.prepare('SELECT * FROM asset_classes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(assetClass);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create sub-asset class
router.post('/:id/sub-classes', (req, res) => {
  try {
    const db = getDatabase();
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = db.prepare(`
      INSERT INTO sub_asset_classes (asset_class_id, name, description, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(parseInt(req.params.id), name, description || null);

    const subClass = db.prepare('SELECT * FROM sub_asset_classes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(subClass);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update asset class
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, description } = req.body;

    db.prepare('UPDATE asset_classes SET name = ?, description = ? WHERE id = ?').run(
      name,
      description || null,
      parseInt(req.params.id)
    );

    const assetClass = db.prepare('SELECT * FROM asset_classes WHERE id = ?').get(parseInt(req.params.id));
    if (!assetClass) {
      return res.status(404).json({ error: 'Asset class not found' });
    }
    res.json(assetClass);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete asset class
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM asset_classes WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: 'Asset class deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
