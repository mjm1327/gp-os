import express from 'express';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { getDatabase } from '../database.js';

const router = express.Router();

function ensureTable() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS fund_access_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fund_id INTEGER NOT NULL REFERENCES funds(id),
      recipient_email TEXT,
      token TEXT NOT NULL UNIQUE,
      created_by TEXT,
      created_at TEXT NOT NULL,
      last_accessed_at TEXT
    )
  `);
}

// POST /api/investor-access — generate a shareable token for a fund
router.post('/', (req: any, res: any) => {
  try {
    ensureTable();
    const db = getDatabase();
    const { fund_id, recipient_email, created_by } = req.body;

    if (!fund_id) {
      return res.status(400).json({ error: 'fund_id is required' });
    }

    const fund = db.prepare('SELECT id, name FROM funds WHERE id = ?').get(parseInt(fund_id));
    if (!fund) {
      return res.status(404).json({ error: 'Fund not found' });
    }

    const token = crypto.randomUUID().replace(/-/g, '');

    db.prepare(`
      INSERT INTO fund_access_tokens (fund_id, recipient_email, token, created_by, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(parseInt(fund_id), recipient_email || null, token, created_by || null);

    res.json({
      token,
      fund_id: parseInt(fund_id),
      fund_name: (fund as any).name,
      recipient_email: recipient_email || null,
      link: `/investor/${token}`,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/investor-access — list tokens (optionally filter by fund_id) — IR use
router.get('/', (req: any, res: any) => {
  try {
    ensureTable();
    const db = getDatabase();
    const { fund_id } = req.query;

    let sql = `
      SELECT fat.id, fat.fund_id, fat.recipient_email, fat.token, fat.created_by,
             fat.created_at, fat.last_accessed_at, f.name as fund_name
      FROM fund_access_tokens fat
      JOIN funds f ON fat.fund_id = f.id
    `;
    const params: any[] = [];

    if (fund_id) {
      sql += ' WHERE fat.fund_id = ?';
      params.push(parseInt(fund_id as string));
    }

    sql += ' ORDER BY fat.created_at DESC';
    const tokens = db.prepare(sql).all(...params);
    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/investor-access/:token — public LP-facing endpoint; returns fund data
router.get('/:token', (req: any, res: any) => {
  try {
    ensureTable();
    const db = getDatabase();
    const { token } = req.params;

    const access: any = db.prepare('SELECT * FROM fund_access_tokens WHERE token = ?').get(token);
    if (!access) {
      return res.status(404).json({ error: 'Invalid or expired access link' });
    }

    // Track access
    db.prepare(`UPDATE fund_access_tokens SET last_accessed_at = datetime('now') WHERE token = ?`).run(token);

    // Fund overview
    const fund: any = db.prepare(`
      SELECT f.*, sac.name as sub_asset_class_name, ac.name as asset_class_name
      FROM funds f
      LEFT JOIN sub_asset_classes sac ON f.sub_asset_class_id = sac.id
      LEFT JOIN asset_classes ac ON sac.asset_class_id = ac.id
      WHERE f.id = ?
    `).get(access.fund_id);

    if (!fund) {
      return res.status(404).json({ error: 'Fund not found' });
    }

    const share_classes = db.prepare(`
      SELECT name, management_fee_rate, carried_interest_rate, hurdle_rate, preferred_return, description
      FROM share_classes WHERE fund_id = ? AND status = 'active' ORDER BY name
    `).all(access.fund_id);

    const vehicles = db.prepare(`
      SELECT name, legal_entity_type, domicile FROM investment_vehicles
      WHERE fund_id = ? AND status = 'active' ORDER BY name
    `).all(access.fund_id);

    const documents = db.prepare(`
      SELECT title, document_type, upload_date FROM documents
      WHERE parent_entity_type = 'fund' AND parent_entity_id = ?
      ORDER BY upload_date DESC
    `).all(access.fund_id);

    res.json({
      fund,
      share_classes,
      vehicles,
      documents,
      access: {
        recipient_email: access.recipient_email,
        created_at: access.created_at,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/investor-access/:token/ask — AI Q&A about the fund (LP-facing)
router.post('/:token/ask', async (req: any, res: any): Promise<void> => {
  try {
    ensureTable();
    const db = getDatabase();
    const { token } = req.params;
    const { question } = req.body;

    if (!question?.trim()) {
      res.status(400).json({ error: 'question is required' });
      return;
    }

    // Validate token
    const access: any = db.prepare('SELECT * FROM fund_access_tokens WHERE token = ?').get(token);
    if (!access) {
      res.status(404).json({ error: 'Invalid or expired access link' });
      return;
    }

    // API key: header first, then env var
    const apiKey = (req.headers['x-api-key'] as string) || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(400).json({ error: 'AI Q&A requires an Anthropic API key. Please configure ANTHROPIC_API_KEY on the server.' });
      return;
    }

    // Gather fund context
    const fund: any = db.prepare(`
      SELECT f.*, sac.name as sub_asset_class_name, ac.name as asset_class_name
      FROM funds f
      LEFT JOIN sub_asset_classes sac ON f.sub_asset_class_id = sac.id
      LEFT JOIN asset_classes ac ON sac.asset_class_id = ac.id
      WHERE f.id = ?
    `).get(access.fund_id);

    if (!fund) {
      res.status(404).json({ error: 'Fund not found' });
      return;
    }

    const share_classes: any[] = db.prepare(
      'SELECT name, management_fee_rate, carried_interest_rate, hurdle_rate, preferred_return, description FROM share_classes WHERE fund_id = ? AND status = \'active\' ORDER BY name'
    ).all(access.fund_id);

    const vehicles: any[] = db.prepare(
      'SELECT name, legal_entity_type, domicile FROM investment_vehicles WHERE fund_id = ? AND status = \'active\' ORDER BY name'
    ).all(access.fund_id);

    const pct = (v: number | null) => v != null ? `${(v * 100).toFixed(2)}%` : 'N/A';
    const $M = (v: number | null) => v != null ? `$${(v / 1_000_000).toFixed(0)}M` : 'N/A';

    const scText = share_classes.length
      ? share_classes.map(sc => `  • ${sc.name}: ${pct(sc.management_fee_rate)} mgmt fee / ${pct(sc.carried_interest_rate)} carry / ${pct(sc.hurdle_rate)} hurdle${sc.description ? ` — ${sc.description}` : ''}`).join('\n')
      : '  Not yet specified';

    const vehicleText = vehicles.length
      ? vehicles.map(v => `  • ${v.name}${v.legal_entity_type ? ` (${v.legal_entity_type})` : ''}${v.domicile ? `, ${v.domicile}` : ''}`).join('\n')
      : '  Not yet specified';

    const systemPrompt = `You are a knowledgeable AI assistant for ${fund.name}, a ${fund.asset_class_name} (${fund.sub_asset_class_name}) fund managed by Stonecrest Capital Management.

Your role is to answer investor questions about this specific fund clearly and accurately, based only on the fund information provided below. Do not invent details not present in this data. For questions outside the scope of the fund terms (e.g., specific market predictions, legal advice, tax implications), acknowledge the limitation and suggest the investor contact the IR team directly.

== FUND OVERVIEW ==
Name: ${fund.name}
Asset Class: ${fund.asset_class_name} / ${fund.sub_asset_class_name}
Status: ${fund.status}
Vintage Year: ${fund.vintage_year || 'TBD'}
Domicile: ${fund.domicile || 'N/A'}
Currency: ${fund.currency || 'USD'}

== FUND SIZE ==
Target Size: ${$M(fund.target_size)}
Hard Cap: ${$M(fund.hard_cap)}

== ECONOMICS ==
Management Fee: ${pct(fund.management_fee_rate)}
Carried Interest: ${pct(fund.carried_interest_rate)}
Hurdle Rate: ${pct(fund.hurdle_rate)}
Preferred Return: ${pct(fund.preferred_return)}

== TIMELINE ==
Fund Term: ${fund.fund_term ? `${fund.fund_term} years` : 'N/A'}
Investment Period End: ${fund.investment_period_end || 'N/A'}

== SHARE CLASSES ==
${scText}

== INVESTMENT VEHICLES ==
${vehicleText}

Keep answers concise and professional. Use plain language appropriate for a sophisticated investor. If the investor seems to be expressing interest in committing to the fund, encourage them to use the "Express Interest" form on this page or reach out to the IR team.`;

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    });

    const answer = message.content[0].type === 'text' ? message.content[0].text : 'Unable to generate response.';
    res.json({ answer });
  } catch (error) {
    console.error('Investor Q&A error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/investor-access/:id — revoke access
router.delete('/:id', (req: any, res: any) => {
  try {
    ensureTable();
    const db = getDatabase();
    db.prepare('DELETE FROM fund_access_tokens WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: 'Access revoked' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
