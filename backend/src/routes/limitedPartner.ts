import express from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();

// Get all limited partners with entity count
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const partners = db.prepare(`
      SELECT lp.*, COUNT(DISTINCT ie.id) as entity_count, COUNT(DISTINCT c.id) as contact_count
      FROM limited_partners lp
      LEFT JOIN investing_entities ie ON lp.id = ie.lp_id
      LEFT JOIN contacts c ON lp.id = c.lp_id
      GROUP BY lp.id
      ORDER BY lp.name
    `).all();
    res.json(partners);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get LP by ID with entities and contacts
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const partner = db.prepare('SELECT * FROM limited_partners WHERE id = ?').get(parseInt(req.params.id));

    if (!partner) {
      return res.status(404).json({ error: 'Limited partner not found' });
    }

    const entities = db.prepare('SELECT * FROM investing_entities WHERE lp_id = ?').all(parseInt(req.params.id));
    const contacts = db.prepare('SELECT * FROM contacts WHERE lp_id = ?').all(parseInt(req.params.id));

    res.json({ ...partner, entities, contacts });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create LP
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { name, type, aum, headquarters, relationship_owner, status, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = db.prepare(`
      INSERT INTO limited_partners (name, type, aum, headquarters, relationship_owner, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(name, type || null, aum || null, headquarters || null, relationship_owner || null, status || 'active', notes || null);

    const partner = db.prepare('SELECT * FROM limited_partners WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(partner);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update LP
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, type, aum, headquarters, relationship_owner, status, notes } = req.body;

    db.prepare(`
      UPDATE limited_partners
      SET name = ?, type = ?, aum = ?, headquarters = ?, relationship_owner = ?, status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, type || null, aum || null, headquarters || null, relationship_owner || null, status, notes || null, parseInt(req.params.id));

    const partner = db.prepare('SELECT * FROM limited_partners WHERE id = ?').get(parseInt(req.params.id));
    if (!partner) {
      return res.status(404).json({ error: 'Limited partner not found' });
    }
    res.json(partner);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete LP
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM limited_partners WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: 'Limited partner deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
