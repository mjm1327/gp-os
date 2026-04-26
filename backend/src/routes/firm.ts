import express, { Router } from 'express';
import { getDatabase } from '../database.js';

const router = Router();

interface Firm {
  id?: number;
  name: string;
  aum?: number;
  founded_date?: string;
  headquarters?: string;
  website?: string;
  created_at?: string;
  updated_at?: string;
}

// Get all firms
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const firms = db.prepare('SELECT * FROM firms ORDER BY name').all() as Firm[];
    res.json(firms);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get firm by ID
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const firm = db.prepare('SELECT * FROM firms WHERE id = ?').get(parseInt(req.params.id)) as Firm | undefined;
    if (!firm) {
      return res.status(404).json({ error: 'Firm not found' });
    }
    res.json(firm);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create firm
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { name, aum, founded_date, headquarters, website } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = db.prepare(`
      INSERT INTO firms (name, aum, founded_date, headquarters, website, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(name, aum || null, founded_date || null, headquarters || null, website || null);

    const firm = db.prepare('SELECT * FROM firms WHERE id = ?').get(result.lastInsertRowid) as Firm;
    res.status(201).json(firm);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update firm
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, aum, founded_date, headquarters, website } = req.body;

    db.prepare(`
      UPDATE firms
      SET name = ?, aum = ?, founded_date = ?, headquarters = ?, website = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || null,
      aum || null,
      founded_date || null,
      headquarters || null,
      website || null,
      parseInt(req.params.id)
    );

    const firm = db.prepare('SELECT * FROM firms WHERE id = ?').get(parseInt(req.params.id)) as Firm;
    if (!firm) {
      return res.status(404).json({ error: 'Firm not found' });
    }
    res.json(firm);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete firm
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const firm = db.prepare('SELECT * FROM firms WHERE id = ?').get(parseInt(req.params.id)) as Firm;
    if (!firm) {
      return res.status(404).json({ error: 'Firm not found' });
    }

    db.prepare('DELETE FROM firms WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: 'Firm deleted', id: parseInt(req.params.id) });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
