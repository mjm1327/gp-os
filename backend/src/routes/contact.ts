import express from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();

// Get all contacts
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const contacts = db.prepare(`
      SELECT c.*, lp.name as lp_name
      FROM contacts c
      LEFT JOIN limited_partners lp ON c.lp_id = lp.id
      ORDER BY c.name
    `).all();
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get contact by ID with related entities
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const contact = db.prepare(`
      SELECT c.*, lp.name as lp_name
      FROM contacts c
      LEFT JOIN limited_partners lp ON c.lp_id = lp.id
      WHERE c.id = ?
    `).get(parseInt(req.params.id));

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const entities = db.prepare(`
      SELECT ie.* FROM investing_entities ie
      JOIN contact_investing_entities cie ON ie.id = cie.investing_entity_id
      WHERE cie.contact_id = ?
    `).all(parseInt(req.params.id));

    res.json({ ...contact, related_entities: entities });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create contact
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { lp_id, name, title, email, phone, role, relationship_strength, last_interaction_date, notes } = req.body;

    if (!lp_id || !name) {
      return res.status(400).json({ error: 'lp_id and name are required' });
    }

    const result = db.prepare(`
      INSERT INTO contacts (lp_id, name, title, email, phone, role, relationship_strength, last_interaction_date, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(lp_id, name, title || null, email || null, phone || null, role || null, relationship_strength || null, last_interaction_date || null, notes || null);

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update contact
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, title, email, phone, role, relationship_strength, last_interaction_date, notes } = req.body;

    db.prepare(`
      UPDATE contacts
      SET name = ?, title = ?, email = ?, phone = ?, role = ?, relationship_strength = ?, last_interaction_date = ?, notes = ?
      WHERE id = ?
    `).run(name, title || null, email || null, phone || null, role || null, relationship_strength || null, last_interaction_date || null, notes || null, parseInt(req.params.id));

    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(parseInt(req.params.id));
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete contact
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM contacts WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: 'Contact deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
