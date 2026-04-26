import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getDatabase } from '../database.js';

const router = express.Router();

// GET /api/portfolio/overview — portfolio-level summary stats + per-fund breakdown
router.get('/overview', (req, res) => {
  try {
    const db = getDatabase();

    const summary = db.prepare(`
      SELECT
        COUNT(DISTINCT d.id) as total_positions,
        COUNT(DISTINCT CASE WHEN p.drawn_amount > 0 THEN d.id END) as funded_positions,
        COUNT(DISTINCT CASE WHEN p.undrawn_amount > 0 THEN d.id END) as positions_with_undrawn,
        SUM(p.commitment_amount) as total_commitment,
        SUM(p.drawn_amount) as total_drawn,
        SUM(p.undrawn_amount) as total_undrawn,
        SUM(p.fair_value) as total_fair_value,
        AVG(CASE WHEN p.levered_yield IS NOT NULL THEN p.levered_yield END) as wa_yield,
        AVG(CASE WHEN p.advance_rate IS NOT NULL THEN p.advance_rate END) as wa_advance_rate
      FROM positions p
      JOIN deals d ON p.deal_id = d.id
    `).get() as any;

    const byFund = db.prepare(`
      SELECT
        f.id as fund_id,
        f.name as fund_name,
        f.status as fund_status,
        COUNT(DISTINCT d.id) as position_count,
        SUM(p.commitment_amount) as total_commitment,
        SUM(p.drawn_amount) as total_drawn,
        SUM(p.undrawn_amount) as total_undrawn,
        SUM(p.fair_value) as total_fair_value,
        AVG(CASE WHEN p.levered_yield IS NOT NULL THEN p.levered_yield END) as wa_yield,
        AVG(CASE WHEN p.advance_rate IS NOT NULL THEN p.advance_rate END) as wa_advance_rate
      FROM positions p
      JOIN deals d ON p.deal_id = d.id
      JOIN investment_vehicles iv ON p.investment_vehicle_id = iv.id
      JOIN funds f ON iv.fund_id = f.id
      GROUP BY f.id
      ORDER BY f.name
    `).all();

    res.json({ summary, by_fund: byFund });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/portfolio — all positions with rich credit data, optional ?fund_id= filter
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const fundId = req.query.fund_id ? parseInt(req.query.fund_id as string) : null;

    const positions = db.prepare(`
      SELECT
        p.id,
        p.commitment_amount,
        p.drawn_amount,
        p.undrawn_amount,
        p.fair_value,
        p.cost_basis,
        p.advance_rate,
        p.levered_yield,
        p.as_of_date,
        p.updated_at,
        d.id as deal_id,
        d.name as deal_name,
        d.borrower_entity_name,
        d.ultimate_parent_name,
        d.instrument_type,
        d.coupon_rate,
        d.interest_rate_type,
        d.maturity_date,
        d.status as deal_status,
        d.total_facility_size,
        d.deal_team_lead,
        iv.id as vehicle_id,
        iv.name as vehicle_name,
        f.id as fund_id,
        f.name as fund_name,
        -- Latest metrics (correlated subquery)
        (SELECT pm.leverage_ratio FROM portfolio_metrics pm WHERE pm.deal_id = d.id ORDER BY pm.period_end_date DESC LIMIT 1) as latest_leverage,
        (SELECT pm.interest_coverage FROM portfolio_metrics pm WHERE pm.deal_id = d.id ORDER BY pm.period_end_date DESC LIMIT 1) as latest_coverage,
        (SELECT pm.ebitda FROM portfolio_metrics pm WHERE pm.deal_id = d.id ORDER BY pm.period_end_date DESC LIMIT 1) as latest_ebitda,
        (SELECT pm.period_end_date FROM portfolio_metrics pm WHERE pm.deal_id = d.id ORDER BY pm.period_end_date DESC LIMIT 1) as metrics_period,
        -- Reporting status
        (SELECT ro.status FROM reporting_obligations ro WHERE ro.deal_id = d.id ORDER BY ro.id DESC LIMIT 1) as reporting_status,
        (SELECT ro.last_received_date FROM reporting_obligations ro WHERE ro.deal_id = d.id ORDER BY ro.id DESC LIMIT 1) as last_reported_date
      FROM positions p
      JOIN deals d ON p.deal_id = d.id
      JOIN investment_vehicles iv ON p.investment_vehicle_id = iv.id
      JOIN funds f ON iv.fund_id = f.id
      WHERE (? IS NULL OR f.id = ?)
      ORDER BY p.drawn_amount DESC NULLS LAST, p.commitment_amount DESC
    `).all(fundId, fundId);

    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/portfolio/summary — legacy summary endpoint
router.get('/summary', (req, res) => {
  try {
    const db = getDatabase();
    const summary = db.prepare(`
      SELECT
        COUNT(DISTINCT d.id) as total_deals,
        SUM(p.drawn_amount) as total_drawn,
        SUM(p.undrawn_amount) as total_undrawn,
        SUM(p.fair_value) as total_fair_value,
        COUNT(DISTINCT CASE WHEN d.status = 'funded' THEN d.id END) as funded_deals
      FROM positions p
      JOIN deals d ON p.deal_id = d.id
    `).get();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/portfolio/positions/:id — position detail with metrics history, obligations, call records
router.get('/positions/:id', (req, res) => {
  try {
    const db = getDatabase();
    const positionId = parseInt(req.params.id);

    const position = db.prepare(`
      SELECT
        p.*,
        d.id as deal_id,
        d.name as deal_name,
        d.borrower_entity_name,
        d.ultimate_parent_name,
        d.instrument_type,
        d.coupon_rate,
        d.pik_rate,
        d.interest_rate_type,
        d.maturity_date,
        d.status as deal_status,
        d.total_facility_size,
        d.deal_team_lead,
        d.decision_rationale,
        d.origination_date,
        d.description as deal_description,
        iv.name as vehicle_name,
        f.id as fund_id,
        f.name as fund_name
      FROM positions p
      JOIN deals d ON p.deal_id = d.id
      JOIN investment_vehicles iv ON p.investment_vehicle_id = iv.id
      JOIN funds f ON iv.fund_id = f.id
      WHERE p.id = ?
    `).get(positionId) as any;

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    // Metrics history
    const metrics = db.prepare(`
      SELECT * FROM portfolio_metrics
      WHERE deal_id = ?
      ORDER BY period_end_date DESC
    `).all(position.deal_id);

    // Reporting obligations
    const obligations = db.prepare(`
      SELECT * FROM reporting_obligations
      WHERE deal_id = ?
      ORDER BY id
    `).all(position.deal_id);

    // Call records
    const calls = db.prepare(`
      SELECT * FROM call_records
      WHERE deal_id = ?
      ORDER BY call_date DESC
    `).all(position.deal_id);

    res.json({ ...position, metrics, obligations, calls });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/portfolio/deal/:dealId — positions for a specific deal
router.get('/deal/:dealId', (req, res) => {
  try {
    const db = getDatabase();
    const positions = db.prepare(`
      SELECT p.*, iv.name as vehicle_name
      FROM positions p
      LEFT JOIN investment_vehicles iv ON p.investment_vehicle_id = iv.id
      WHERE p.deal_id = ?
    `).all(parseInt(req.params.dealId));
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/portfolio/analyze — AI portfolio analyst (Claude)
router.post('/analyze', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    return res.status(400).json({ error: 'Anthropic API key required in x-api-key header' });
  }

  const { question, fund_id } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    const db = getDatabase();
    const fundId = fund_id ? parseInt(fund_id) : null;

    // Gather all portfolio context for the AI
    const positions = db.prepare(`
      SELECT
        p.id,
        p.commitment_amount,
        p.drawn_amount,
        p.undrawn_amount,
        p.fair_value,
        p.advance_rate,
        p.levered_yield,
        p.as_of_date,
        d.name as deal_name,
        d.borrower_entity_name,
        d.instrument_type,
        d.coupon_rate,
        d.interest_rate_type,
        d.maturity_date,
        d.status as deal_status,
        iv.name as vehicle_name,
        f.name as fund_name,
        (SELECT pm.leverage_ratio FROM portfolio_metrics pm WHERE pm.deal_id = d.id ORDER BY pm.period_end_date DESC LIMIT 1) as leverage_ratio,
        (SELECT pm.interest_coverage FROM portfolio_metrics pm WHERE pm.deal_id = d.id ORDER BY pm.period_end_date DESC LIMIT 1) as interest_coverage,
        (SELECT pm.ebitda FROM portfolio_metrics pm WHERE pm.deal_id = d.id ORDER BY pm.period_end_date DESC LIMIT 1) as ebitda,
        (SELECT pm.revenue FROM portfolio_metrics pm WHERE pm.deal_id = d.id ORDER BY pm.period_end_date DESC LIMIT 1) as revenue,
        (SELECT ro.status FROM reporting_obligations ro WHERE ro.deal_id = d.id ORDER BY ro.id DESC LIMIT 1) as reporting_status
      FROM positions p
      JOIN deals d ON p.deal_id = d.id
      JOIN investment_vehicles iv ON p.investment_vehicle_id = iv.id
      JOIN funds f ON iv.fund_id = f.id
      WHERE (? IS NULL OR f.id = ?)
      ORDER BY p.drawn_amount DESC NULLS LAST
    `).all(fundId, fundId) as any[];

    const fundInfo = fundId ? db.prepare('SELECT * FROM funds WHERE id = ?').get(fundId) as any : null;

    // Build the portfolio context string
    const portfolioContext = positions.map(p => {
      const drawnM = p.drawn_amount ? (p.drawn_amount / 1000000).toFixed(1) : '0';
      const commitM = p.commitment_amount ? (p.commitment_amount / 1000000).toFixed(1) : '0';
      const undrawnM = p.undrawn_amount ? (p.undrawn_amount / 1000000).toFixed(1) : '0';
      const fvM = p.fair_value ? (p.fair_value / 1000000).toFixed(1) : 'N/A';
      const yield_ = p.levered_yield ? (p.levered_yield * 100).toFixed(2) + '%' : 'N/A';
      const advRate = p.advance_rate ? (p.advance_rate * 100).toFixed(0) + '%' : 'N/A';
      const coupon = p.coupon_rate ? (p.coupon_rate * 100).toFixed(2) + '%' : 'N/A';
      const leverage = p.leverage_ratio ? p.leverage_ratio + 'x' : 'N/A';
      const coverage = p.interest_coverage ? p.interest_coverage + 'x' : 'N/A';
      const maturity = p.maturity_date ? p.maturity_date.substring(0, 7) : 'N/A';

      return `- ${p.deal_name} (${p.borrower_entity_name})
    Fund: ${p.fund_name} | Vehicle: ${p.vehicle_name}
    Instrument: ${p.instrument_type} | Coupon: ${coupon} | Maturity: ${maturity}
    Commitment: $${commitM}M | Drawn: $${drawnM}M | Undrawn: $${undrawnM}M | Fair Value: $${fvM}M
    Levered Yield: ${yield_} | Advance Rate: ${advRate}
    Leverage: ${leverage} | Interest Coverage: ${coverage}
    Reporting Status: ${p.reporting_status || 'N/A'}`;
    }).join('\n\n');

    const totalDrawn = positions.reduce((s, p) => s + (p.drawn_amount || 0), 0);
    const totalUndrawn = positions.reduce((s, p) => s + (p.undrawn_amount || 0), 0);
    const totalFV = positions.reduce((s, p) => s + (p.fair_value || 0), 0);
    const yieldsWithData = positions.filter(p => p.levered_yield);
    const waYield = yieldsWithData.length
      ? yieldsWithData.reduce((s, p) => s + p.levered_yield, 0) / yieldsWithData.length
      : 0;

    const systemPrompt = `You are an expert private credit portfolio analyst at ${fundInfo?.name ? fundInfo.name.split(' ').slice(0, 2).join(' ') : 'Stonecrest Capital'}, an alternative asset manager. You have deep expertise in direct lending, mezzanine financing, and private credit portfolio management.

You are analyzing the portfolio and answering questions for the investment team. Be quantitative, specific, and actionable. When asked about trimming positions, advance rates, levered yields, or portfolio optimization, provide specific position names and calculations.

Current Portfolio Summary:
- Total Positions: ${positions.length}
- Total Drawn Capital: $${(totalDrawn / 1000000000).toFixed(2)}B
- Total Undrawn Commitments: $${(totalUndrawn / 1000000).toFixed(0)}M
- Total Fair Value: $${totalFV ? (totalFV / 1000000000).toFixed(2) + 'B' : 'N/A'}
- Weighted Average Levered Yield: ${(waYield * 100).toFixed(2)}%

Portfolio Positions (as of most recent quarter):
${portfolioContext}

Format your response clearly. Use specific numbers and position names. When making recommendations, explain the rationale in terms of yield, leverage, advance rates, and portfolio construction.`;

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: question }],
    });

    const analysis = message.content[0].type === 'text' ? message.content[0].text : '';
    res.json({ analysis, positions_analyzed: positions.length });
  } catch (error: any) {
    if (error?.status === 401) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create position
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { deal_id, investment_vehicle_id, commitment_amount, drawn_amount, undrawn_amount, fair_value, cost_basis, advance_rate, levered_yield, as_of_date } = req.body;

    if (!deal_id || !investment_vehicle_id) {
      return res.status(400).json({ error: 'deal_id and investment_vehicle_id are required' });
    }

    const result = db.prepare(`
      INSERT INTO positions (deal_id, investment_vehicle_id, commitment_amount, drawn_amount, undrawn_amount, fair_value, cost_basis, advance_rate, levered_yield, as_of_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(deal_id, investment_vehicle_id, commitment_amount || null, drawn_amount || 0, undrawn_amount || null, fair_value || null, cost_basis || null, advance_rate || null, levered_yield || null, as_of_date || null);

    const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(position);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update position
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { drawn_amount, undrawn_amount, fair_value, advance_rate, levered_yield, as_of_date } = req.body;

    db.prepare(`
      UPDATE positions
      SET drawn_amount = ?, undrawn_amount = ?, fair_value = ?, advance_rate = ?, levered_yield = ?, as_of_date = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(drawn_amount || null, undrawn_amount || null, fair_value || null, advance_rate || null, levered_yield || null, as_of_date || null, parseInt(req.params.id));

    const position = db.prepare('SELECT * FROM positions WHERE id = ?').get(parseInt(req.params.id));
    if (!position) return res.status(404).json({ error: 'Position not found' });
    res.json(position);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/portfolio/positions/:id/ingest-call — AI extraction from call transcript
router.post('/positions/:id/ingest-call', async (req: any, res: any): Promise<void> => {
  const apiKey = (req.headers['x-api-key'] as string) || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(400).json({ error: 'Anthropic API key required in x-api-key header or ANTHROPIC_API_KEY env var' });
    return;
  }

  const { transcript, call_type, call_date, participants } = req.body;
  if (!transcript?.trim()) {
    res.status(400).json({ error: 'transcript is required' });
    return;
  }

  try {
    const db = getDatabase();
    const positionId = parseInt(req.params.id);

    const position: any = db.prepare(`
      SELECT p.*, d.id as deal_id, d.name as deal_name, d.borrower_entity_name, d.instrument_type
      FROM positions p JOIN deals d ON p.deal_id = d.id
      WHERE p.id = ?
    `).get(positionId);

    if (!position) {
      res.status(404).json({ error: 'Position not found' });
      return;
    }

    const extractionPrompt = `You are a private credit analyst reviewing notes or a transcript from an investment monitoring call for: ${position.deal_name} (${position.borrower_entity_name}), a ${position.instrument_type} position.

Your task is to extract key financial metrics and observations from the call transcript/notes below. Return a JSON object with these fields:

{
  "leverage_ratio": { "value": <number or null>, "confidence": "HIGH"|"MEDIUM"|"LOW", "source_text": "<exact quote>" },
  "interest_coverage": { "value": <number or null>, "confidence": "HIGH"|"MEDIUM"|"LOW", "source_text": "<exact quote>" },
  "ebitda": { "value": <number in dollars or null>, "confidence": "HIGH"|"MEDIUM"|"LOW", "source_text": "<exact quote>" },
  "revenue": { "value": <number in dollars or null>, "confidence": "HIGH"|"MEDIUM"|"LOW", "source_text": "<exact quote>" },
  "fair_value": { "value": <number in dollars or null>, "confidence": "HIGH"|"MEDIUM"|"LOW", "source_text": "<exact quote>" },
  "advance_rate": { "value": <decimal 0-1 or null>, "confidence": "HIGH"|"MEDIUM"|"LOW", "source_text": "<exact quote>" },
  "levered_yield": { "value": <decimal 0-1 or null>, "confidence": "HIGH"|"MEDIUM"|"LOW", "source_text": "<exact quote>" },
  "key_developments": { "value": "<string summary of notable business developments, risks, or positives>", "confidence": "HIGH"|"MEDIUM"|"LOW", "source_text": "<exact quote>" },
  "summary": { "value": "<2-3 sentence overall call summary>", "confidence": "HIGH", "source_text": "" }
}

Rules:
- Set value to null if the metric is not mentioned in the transcript
- confidence HIGH = explicitly stated with a number, MEDIUM = implied or estimated, LOW = uncertain or inferred
- For ebitda/revenue/fair_value: store the raw dollar amount (e.g., $45M EBITDA → 45000000)
- For advance_rate/levered_yield: store as decimal (e.g., 85% → 0.85, 12.5% → 0.125)
- For leverage_ratio and interest_coverage: store as a multiple (e.g., 3.5x → 3.5)
- key_developments should capture strategic updates, covenant status, risk factors, or management changes
- Return ONLY the JSON object, no other text

TRANSCRIPT / CALL NOTES:
${transcript}`;

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: 'AI did not return valid JSON', raw: responseText });
      return;
    }

    const extracted = JSON.parse(jsonMatch[0]);
    res.json({
      extracted,
      deal_name: position.deal_name,
      deal_id: position.deal_id,
      position_id: positionId,
    });
  } catch (error: any) {
    console.error('Call ingestion error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/portfolio/positions/:id/calls — save confirmed call record + metrics + ai_extractions
router.post('/positions/:id/calls', (req: any, res: any) => {
  try {
    const db = getDatabase();
    const positionId = parseInt(req.params.id);

    const position: any = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
    if (!position) return res.status(404).json({ error: 'Position not found' });

    const {
      transcript, call_type, call_date, participants,
      summary, key_developments,
      leverage_ratio, interest_coverage, ebitda, revenue, fair_value, advance_rate, levered_yield,
      extractions, // array of { field, extracted_value, confidence_score, extraction_rationale, approved }
    } = req.body;

    // 1. Insert call_record
    const callResult = db.prepare(`
      INSERT INTO call_records (deal_id, call_date, call_type, participants, summary, transcript_text, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'reviewed', datetime('now'))
    `).run(
      position.deal_id,
      call_date || new Date().toISOString().substring(0, 10),
      call_type || 'monthly_update',
      participants || null,
      summary || null,
      transcript || null,
    );

    const callId = callResult.lastInsertRowid;

    // 2. Insert portfolio_metrics if any numeric metrics were provided
    const hasMetrics = [leverage_ratio, interest_coverage, ebitda, revenue, fair_value, advance_rate, levered_yield]
      .some(v => v !== null && v !== undefined && v !== '');

    if (hasMetrics) {
      db.prepare(`
        INSERT INTO portfolio_metrics (
          deal_id, period_end_date, leverage_ratio, interest_coverage, ebitda, revenue,
          fair_value_estimate, advance_rate, levered_yield,
          metric_source, ai_extracted, notes, upload_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'call_extraction', 1, ?, date('now'))
      `).run(
        position.deal_id,
        call_date || new Date().toISOString().substring(0, 10),
        leverage_ratio || null,
        interest_coverage || null,
        ebitda || null,
        revenue || null,
        fair_value || null,
        advance_rate || null,
        levered_yield || null,
        key_developments || null,
      );
    }

    // 3. Insert ai_extractions records
    if (Array.isArray(extractions) && extractions.length > 0) {
      const insertExtraction = db.prepare(`
        INSERT INTO ai_extractions (call_record_id, deal_id, field_updated, extracted_value, confidence_score, extraction_rationale, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      for (const ex of extractions) {
        insertExtraction.run(
          callId,
          position.deal_id,
          ex.field,
          ex.extracted_value !== null && ex.extracted_value !== undefined ? String(ex.extracted_value) : null,
          ex.confidence_score || null,
          ex.extraction_rationale || null,
          ex.approved ? 'approved' : 'pending_approval',
        );
      }
    }

    // 4. Update position's updated_at (and fair_value / advance_rate / levered_yield if provided)
    const updateFields: string[] = ["updated_at = datetime('now')"];
    const updateParams: any[] = [];
    if (fair_value !== null && fair_value !== undefined && fair_value !== '') {
      updateFields.push('fair_value = ?');
      updateParams.push(fair_value);
    }
    if (advance_rate !== null && advance_rate !== undefined && advance_rate !== '') {
      updateFields.push('advance_rate = ?');
      updateParams.push(advance_rate);
    }
    if (levered_yield !== null && levered_yield !== undefined && levered_yield !== '') {
      updateFields.push('levered_yield = ?');
      updateParams.push(levered_yield);
    }
    updateParams.push(positionId);
    db.prepare(`UPDATE positions SET ${updateFields.join(', ')} WHERE id = ?`).run(...updateParams);

    res.status(201).json({ call_record_id: callId, message: 'Call logged successfully' });
  } catch (error) {
    console.error('Save call error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get portfolio metrics for a deal
router.get('/metrics/:dealId', (req, res) => {
  try {
    const db = getDatabase();
    const metrics = db.prepare(`
      SELECT * FROM portfolio_metrics
      WHERE deal_id = ?
      ORDER BY period_end_date DESC
    `).all(parseInt(req.params.dealId));
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/portfolio/covenants — covenant compliance dashboard across all funded deals
// Optional query param: ?deal_id=X to filter to a single deal
router.get('/covenants', (req, res) => {
  try {
    const db = getDatabase();
    const { deal_id } = req.query;

    // Covenant thresholds (standard direct lending conventions)
    const LEV_WARN = 4.5;   // leverage > 4.5x = warning
    const LEV_BREACH = 5.25; // leverage > 5.25x = breach
    const ICOV_WARN = 2.0;  // interest coverage < 2.0x = warning
    const ICOV_BREACH = 1.75; // interest coverage < 1.75x = breach

    let dealFilter = 'WHERE d.status = \'funded\' AND p.drawn_amount > 0';
    const params: any[] = [];
    if (deal_id) {
      dealFilter += ' AND d.id = ?';
      params.push(parseInt(deal_id as string));
    }

    const deals = db.prepare(`
      SELECT
        d.id,
        d.name as deal_name,
        d.borrower_entity_name,
        d.instrument_type,
        d.maturity_date,
        d.deal_team_lead,
        p.drawn_amount,
        p.fair_value,
        p.advance_rate,
        pm.period_end_date,
        pm.period_type,
        pm.revenue,
        pm.ebitda,
        pm.total_debt,
        pm.net_debt,
        pm.leverage_ratio,
        pm.interest_coverage,
        pm.metric_source,
        pm.upload_date
      FROM deals d
      JOIN positions p ON p.deal_id = d.id
      LEFT JOIN portfolio_metrics pm ON pm.deal_id = d.id
        AND pm.period_end_date = (
          SELECT MAX(pm2.period_end_date) FROM portfolio_metrics pm2 WHERE pm2.deal_id = d.id
        )
      ${dealFilter}
      ORDER BY d.name
    `).all(...params) as any[];

    const reportingByDeal = db.prepare(`
      SELECT
        deal_id,
        obligation_type,
        frequency,
        last_received_date,
        last_received_period,
        status
      FROM reporting_obligations
    `).all() as any[];

    const reportingMap: Record<number, any[]> = {};
    for (const r of reportingByDeal) {
      if (!reportingMap[r.deal_id]) reportingMap[r.deal_id] = [];
      reportingMap[r.deal_id].push(r);
    }

    const covenants = deals.map((d: any) => {
      const lev = d.leverage_ratio;
      const icov = d.interest_coverage;
      const isEquity = d.instrument_type === 'equity_co_invest';

      // Financial covenant status
      let levStatus = 'n/a';
      if (!isEquity && lev != null) {
        levStatus = lev > LEV_BREACH ? 'breach' : lev > LEV_WARN ? 'warning' : 'current';
      }

      let icovStatus = 'n/a';
      if (!isEquity && icov != null) {
        icovStatus = icov < ICOV_BREACH ? 'breach' : icov < ICOV_WARN ? 'warning' : 'current';
      }

      // Reporting status
      const reps = reportingMap[d.id] || [];
      const hasOverdueRep = reps.some((r: any) => r.status === 'overdue');
      const reportingStatus = hasOverdueRep ? 'breach' : reps.length === 0 ? 'n/a' : 'current';

      // Overall status (worst of the three)
      const statuses = [levStatus, icovStatus, reportingStatus];
      const overallStatus = statuses.includes('breach') ? 'breach'
        : statuses.includes('warning') ? 'warning'
        : statuses.every(s => s === 'n/a') ? 'n/a'
        : 'current';

      return {
        deal_id: d.id,
        deal_name: d.deal_name,
        borrower: d.borrower_entity_name,
        instrument_type: d.instrument_type,
        deal_team_lead: d.deal_team_lead,
        drawn_amount: d.drawn_amount,
        fair_value: d.fair_value,
        period_end_date: d.period_end_date,
        revenue: d.revenue,
        ebitda: d.ebitda,
        leverage_ratio: lev,
        leverage_threshold: isEquity ? null : LEV_BREACH,
        leverage_status: levStatus,
        interest_coverage: icov,
        icov_threshold: isEquity ? null : ICOV_BREACH,
        icov_status: icovStatus,
        reporting_obligations: reps,
        reporting_status: reportingStatus,
        overall_status: overallStatus,
        metric_source: d.metric_source,
        last_updated: d.upload_date,
      };
    });

    const summary = {
      total: covenants.length,
      breach: covenants.filter((c: any) => c.overall_status === 'breach').length,
      warning: covenants.filter((c: any) => c.overall_status === 'warning').length,
      current: covenants.filter((c: any) => c.overall_status === 'current').length,
    };

    res.json({ summary, covenants });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
