import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getDatabase } from '../database.js';

const FUND_EXTRACTION_PROMPT = `You are analyzing a private fund document (PPM, LPA, or similar) to extract fund terms and structure. Extract the following information and return as JSON.

For each field include:
- value: the extracted value (null if not found)
- confidence: "HIGH" (directly stated), "MEDIUM" (inferred/calculated), or "LOW" (uncertain)
- source_text: the exact text from the document supporting this extraction (null if not found)

For vehicles and share_classes, value should be an array of objects (empty array if none found).

Return this exact JSON structure:
{
  "fund_name": { "value": string|null, "confidence": string, "source_text": string|null },
  "vintage_year": { "value": number|null, "confidence": string, "source_text": string|null },
  "target_size": { "value": number|null, "confidence": string, "source_text": string|null },
  "hard_cap": { "value": number|null, "confidence": string, "source_text": string|null },
  "management_fee_rate": { "value": number|null, "confidence": string, "source_text": string|null },
  "carried_interest_rate": { "value": number|null, "confidence": string, "source_text": string|null },
  "hurdle_rate": { "value": number|null, "confidence": string, "source_text": string|null },
  "preferred_return": { "value": number|null, "confidence": string, "source_text": string|null },
  "fund_term_years": { "value": number|null, "confidence": string, "source_text": string|null },
  "investment_period_years": { "value": number|null, "confidence": string, "source_text": string|null },
  "domicile": { "value": string|null, "confidence": string, "source_text": string|null },
  "currency": { "value": string|null, "confidence": string, "source_text": string|null },
  "strategy": { "value": string|null, "confidence": string, "source_text": string|null },
  "vehicles": { "value": [{"name": string, "legal_entity_type": string, "domicile": string}], "confidence": string, "source_text": string|null },
  "share_classes": { "value": [{"name": string, "management_fee_rate": number|null, "carried_interest_rate": number|null}], "confidence": string, "source_text": string|null }
}

IMPORTANT: target_size and hard_cap should be in millions of dollars (e.g. $750M → 750). management_fee_rate, carried_interest_rate, hurdle_rate, and preferred_return should be percentages as decimals (e.g. 1.5% → 0.015). vintage_year is the year the fund was or will be formed.

Document text:
{DOCUMENT_TEXT}`;

const router = express.Router();

// Extract fund data from document (AI-powered)
router.post('/extract', async (req: any, res: any): Promise<void> => {
  try {
    const { document_text } = req.body;
    if (!document_text) {
      res.status(400).json({ error: 'document_text is required' });
      return;
    }
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      res.status(400).json({ error: 'Anthropic API key required in x-api-key header' });
      return;
    }
    const client = new Anthropic({ apiKey });
    const prompt = FUND_EXTRACTION_PROMPT.replace('{DOCUMENT_TEXT}', document_text);
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: 'Failed to parse AI response', raw_response: responseText });
      return;
    }
    const extracted = JSON.parse(jsonMatch[0]);
    res.json({ extracted });
  } catch (error) {
    console.error('Fund extraction error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get all funds with summary stats
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const funds = db.prepare(`
      SELECT
        f.id, f.name, f.vintage_year, f.status, f.target_size, f.hard_cap,
        f.management_fee_rate, f.carried_interest_rate, f.hurdle_rate,
        f.investment_period_end, f.fund_term, f.currency, f.domicile,
        ac.name as asset_class, ac.id as asset_class_id,
        sac.name as sub_asset_class, sac.id as sub_asset_class_id,
        COUNT(DISTINCT iv.id) as vehicle_count,
        COUNT(DISTINCT sc.id) as share_class_count,
        COUNT(DISTINCT CASE WHEN c.status='executed' THEN ie.lp_id END) as committed_lp_count,
        COALESCE(SUM(CASE WHEN c.status='executed' THEN c.commitment_amount END), 0) as total_committed
      FROM funds f
      JOIN sub_asset_classes sac ON f.sub_asset_class_id = sac.id
      JOIN asset_classes ac ON sac.asset_class_id = ac.id
      LEFT JOIN investment_vehicles iv ON iv.fund_id = f.id
      LEFT JOIN share_classes sc ON sc.fund_id = f.id
      LEFT JOIN commitments c ON c.investment_vehicle_id = iv.id
      LEFT JOIN investing_entities ie ON c.investing_entity_id = ie.id
      GROUP BY f.id ORDER BY f.vintage_year DESC
    `).all();
    res.json(funds);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get fund by ID with vehicles, share classes, and documents
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const fundId = parseInt(req.params.id);

    const fund = db.prepare(`
      SELECT f.*, sac.name as sub_asset_class_name, ac.name as asset_class_name
      FROM funds f
      LEFT JOIN sub_asset_classes sac ON f.sub_asset_class_id = sac.id
      LEFT JOIN asset_classes ac ON sac.asset_class_id = ac.id
      WHERE f.id = ?
    `).get(fundId);

    if (!fund) {
      return res.status(404).json({ error: 'Fund not found' });
    }

    // Get share classes
    const share_classes = db.prepare(`
      SELECT * FROM share_classes WHERE fund_id = ? ORDER BY name
    `).all(fundId);

    // Get vehicles with commitment stats
    const vehicles = db.prepare(`
      SELECT iv.*,
        COUNT(DISTINCT c.id) as commitment_count,
        COUNT(DISTINCT CASE WHEN c.status='executed' THEN ie.lp_id END) as lp_count,
        COALESCE(SUM(CASE WHEN c.status='executed' THEN c.commitment_amount END), 0) as total_committed
      FROM investment_vehicles iv
      LEFT JOIN commitments c ON c.investment_vehicle_id = iv.id
      LEFT JOIN investing_entities ie ON c.investing_entity_id = ie.id
      WHERE iv.fund_id = ?
      GROUP BY iv.id
    `).all(fundId);

    // Get documents
    const documents = db.prepare(`
      SELECT * FROM documents WHERE parent_entity_type='fund' AND parent_entity_id=? ORDER BY upload_date DESC
    `).all(fundId);

    res.json({ ...fund, share_classes, vehicles, documents });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create fund
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const {
      sub_asset_class_id, name, vintage_year, target_size, hard_cap, currency,
      domicile, management_fee_rate, carried_interest_rate, hurdle_rate,
      preferred_return, investment_period_end, fund_term, status
    } = req.body;

    if (!sub_asset_class_id || !name) {
      return res.status(400).json({ error: 'sub_asset_class_id and name are required' });
    }

    const result = db.prepare(`
      INSERT INTO funds (
        sub_asset_class_id, name, vintage_year, target_size, hard_cap, currency, domicile,
        management_fee_rate, carried_interest_rate, hurdle_rate, preferred_return,
        investment_period_end, fund_term, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      sub_asset_class_id, name, vintage_year || null, target_size || null, hard_cap || null,
      currency || 'USD', domicile || null, management_fee_rate || null,
      carried_interest_rate || null, hurdle_rate || null, preferred_return || null,
      investment_period_end || null, fund_term || null, status || 'fundraising'
    );

    const fund = db.prepare('SELECT * FROM funds WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(fund);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update fund
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, vintage_year, target_size, hard_cap, status } = req.body;

    db.prepare(`
      UPDATE funds
      SET name = ?, vintage_year = ?, target_size = ?, hard_cap = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, vintage_year || null, target_size || null, hard_cap || null, status, parseInt(req.params.id));

    const fund = db.prepare('SELECT * FROM funds WHERE id = ?').get(parseInt(req.params.id));
    if (!fund) {
      return res.status(404).json({ error: 'Fund not found' });
    }
    res.json(fund);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete fund
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM funds WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: 'Fund deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create share class
router.post('/:fundId/share-classes', (req, res) => {
  try {
    const db = getDatabase();
    const fundId = parseInt(req.params.fundId);
    const { name, management_fee_rate, carried_interest_rate, hurdle_rate, preferred_return, description, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = db.prepare(`
      INSERT INTO share_classes (
        fund_id, name, management_fee_rate, carried_interest_rate, hurdle_rate,
        preferred_return, description, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      fundId,
      name,
      management_fee_rate || null,
      carried_interest_rate || null,
      hurdle_rate || null,
      preferred_return || null,
      description || null,
      status || 'active'
    );

    const shareClass = db.prepare('SELECT * FROM share_classes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(shareClass);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update share class
router.put('/:fundId/share-classes/:scId', (req, res) => {
  try {
    const db = getDatabase();
    const { name, management_fee_rate, carried_interest_rate, hurdle_rate, preferred_return, description, status } = req.body;
    const scId = parseInt(req.params.scId);

    db.prepare(`
      UPDATE share_classes
      SET name = ?, management_fee_rate = ?, carried_interest_rate = ?, hurdle_rate = ?,
          preferred_return = ?, description = ?, status = ?
      WHERE id = ?
    `).run(name, management_fee_rate || null, carried_interest_rate || null, hurdle_rate || null,
           preferred_return || null, description || null, status || 'active', scId);

    const shareClass = db.prepare('SELECT * FROM share_classes WHERE id = ?').get(scId);
    if (!shareClass) {
      return res.status(404).json({ error: 'Share class not found' });
    }
    res.json(shareClass);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create investment vehicle
router.post('/:fundId/vehicles', (req, res) => {
  try {
    const db = getDatabase();
    const fundId = parseInt(req.params.fundId);
    const { name, legal_entity_type, domicile, formation_date, tax_id, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = db.prepare(`
      INSERT INTO investment_vehicles (
        fund_id, name, legal_entity_type, domicile, formation_date, tax_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(fundId, name, legal_entity_type || null, domicile || null, formation_date || null, tax_id || null, status || 'active');

    const vehicle = db.prepare('SELECT * FROM investment_vehicles WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(vehicle);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Upload fund document
router.post('/:fundId/documents', (req, res) => {
  try {
    const db = getDatabase();
    const fundId = parseInt(req.params.fundId);
    const { title, document_type, version, status } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const result = db.prepare(`
      INSERT INTO documents (
        title, document_type, version, status, parent_entity_type, parent_entity_id, upload_date, created_at
      ) VALUES (?, ?, ?, ?, 'fund', ?, datetime('now'), datetime('now'))
    `).run(title, document_type || null, version || 1, status || 'draft', fundId);

    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
