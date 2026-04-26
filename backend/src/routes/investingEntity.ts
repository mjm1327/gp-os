import express from 'express';
import { getDatabase } from '../database.js';

const router = express.Router();

// Get all investing entities
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const entities = db.prepare(`
      SELECT ie.*, lp.name as lp_name
      FROM investing_entities ie
      LEFT JOIN limited_partners lp ON ie.lp_id = lp.id
      ORDER BY ie.legal_name
    `).all();
    res.json(entities);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get entity by ID with commitments
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const entity = db.prepare(`
      SELECT ie.*, lp.name as lp_name
      FROM investing_entities ie
      LEFT JOIN limited_partners lp ON ie.lp_id = lp.id
      WHERE ie.id = ?
    `).get(parseInt(req.params.id));

    if (!entity) {
      return res.status(404).json({ error: 'Investing entity not found' });
    }

    const commitments = db.prepare('SELECT * FROM commitments WHERE investing_entity_id = ?').all(parseInt(req.params.id));
    res.json({ ...entity, commitments });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create entity
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { lp_id, legal_name, entity_type, domicile, tax_id, aml_kyc_status, subscription_doc_status, notes } = req.body;

    if (!lp_id || !legal_name) {
      return res.status(400).json({ error: 'lp_id and legal_name are required' });
    }

    const result = db.prepare(`
      INSERT INTO investing_entities (lp_id, legal_name, entity_type, domicile, tax_id, aml_kyc_status, subscription_doc_status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(lp_id, legal_name, entity_type || null, domicile || null, tax_id || null, aml_kyc_status || 'pending', subscription_doc_status || 'not_started', notes || null);

    const entity = db.prepare('SELECT * FROM investing_entities WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(entity);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update entity
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { legal_name, entity_type, domicile, tax_id, aml_kyc_status, aml_kyc_date, subscription_doc_status, notes } = req.body;

    db.prepare(`
      UPDATE investing_entities
      SET legal_name = ?, entity_type = ?, domicile = ?, tax_id = ?, aml_kyc_status = ?, aml_kyc_date = ?, subscription_doc_status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(legal_name, entity_type || null, domicile || null, tax_id || null, aml_kyc_status, aml_kyc_date || null, subscription_doc_status, notes || null, parseInt(req.params.id));

    const entity = db.prepare('SELECT * FROM investing_entities WHERE id = ?').get(parseInt(req.params.id));
    if (!entity) {
      return res.status(404).json({ error: 'Investing entity not found' });
    }
    res.json(entity);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete entity
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM investing_entities WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: 'Investing entity deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
