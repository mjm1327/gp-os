import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getDatabase } from '../database.js';

const router = Router();

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_portfolio_summary',
    description: 'Get high-level portfolio statistics: total drawn, undrawn, fair value, position count, breakdown by instrument type and fund.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'query_positions',
    description: 'Query funded portfolio positions with optional filters. Returns deal name, borrower, instrument type, sector, fund, drawn amount, fair value, levered yield, advance rate, leverage ratio, interest coverage, maturity date.',
    input_schema: {
      type: 'object' as const,
      properties: {
        instrument_type: { type: 'string', enum: ['first_lien', 'second_lien', 'mezzanine', 'equity_co_invest'] },
        fund_name: { type: 'string', description: 'Partial fund name match' },
        min_leverage: { type: 'number' },
        max_leverage: { type: 'number' },
        min_drawn_M: { type: 'number', description: 'Minimum drawn amount in $M' },
        maturity_before: { type: 'string', description: 'ISO date string — positions maturing before this date' },
        sort_by: { type: 'string', enum: ['drawn_amount', 'fair_value', 'leverage_ratio', 'maturity_date', 'levered_yield'] },
        sort_dir: { type: 'string', enum: ['asc', 'desc'] },
        limit: { type: 'number', description: 'Max results (default 15, max 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_deal_detail',
    description: 'Get detailed data for a specific deal — terms, latest metrics, reporting obligations, and recent call records.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'number' },
        deal_name: { type: 'string', description: 'Partial deal/borrower name to search for' },
      },
      required: [],
    },
  },
  {
    name: 'get_covenant_data',
    description: 'Query covenant status across the portfolio. Returns leverage ratio, interest coverage, overall covenant status, and reporting obligation status per deal.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['breach', 'warning', 'current'], description: 'Filter by overall covenant status' },
        deal_id: { type: 'number' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_lp_data',
    description: 'Query limited partner relationships — name, type, AUM, status, headquarters, relationship owner.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['prospect', 'active', 'inactive'] },
        lp_type: { type: 'string', description: 'e.g. pension, endowment, family_office, sovereign_wealth, foundation' },
        relationship_owner: { type: 'string', description: 'Filter by relationship owner name' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_tasks',
    description: 'Query action items and tasks across the portfolio.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'open | sent_to_admin | admin_confirmed' },
        deal_id: { type: 'number' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        overdue_only: { type: 'boolean' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_deal_flow',
    description: 'Query the deal pipeline — deals in prospecting, due_diligence, term_sheet, closing, funded, or passed stages.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by deal stage' },
        limit: { type: 'number' },
      },
      required: [],
    },
  },
  {
    name: 'get_metrics_history',
    description: 'Get historical financial metrics (leverage, coverage, EBITDA, revenue) for a specific position over time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        deal_id: { type: 'number' },
        deal_name: { type: 'string' },
        limit: { type: 'number', description: 'Number of periods to return (default 8)' },
      },
      required: [],
    },
  },
];

// ─── Tool Execution ───────────────────────────────────────────────────────────

function executeTool(name: string, input: any): any {
  const db = getDatabase();

  try {
    switch (name) {

      case 'get_portfolio_summary': {
        const stats = db.prepare(`
          SELECT
            COUNT(*) as total_positions,
            ROUND(SUM(p.drawn_amount) / 1e6, 1) as total_drawn_M,
            ROUND(SUM(p.undrawn_amount) / 1e6, 1) as total_undrawn_M,
            ROUND(SUM(p.fair_value) / 1e6, 1) as total_fair_value_M,
            ROUND(SUM(p.commitment_amount) / 1e6, 1) as total_commitment_M,
            ROUND(AVG(m.leverage_ratio), 2) as avg_leverage,
            ROUND(AVG(m.interest_coverage), 2) as avg_coverage,
            ROUND(AVG(p.levered_yield) * 100, 2) as avg_yield_pct,
            ROUND(AVG(p.advance_rate) * 100, 1) as avg_advance_rate_pct
          FROM portfolio_positions p
          JOIN deals d ON d.id = p.deal_id
          LEFT JOIN (
            SELECT position_id, leverage_ratio, interest_coverage,
              ROW_NUMBER() OVER (PARTITION BY position_id ORDER BY period_end_date DESC) as rn
            FROM portfolio_metrics
          ) m ON m.position_id = p.id AND m.rn = 1
          WHERE d.status = 'funded' AND p.drawn_amount > 0
        `).get();

        const byType = db.prepare(`
          SELECT
            p.instrument_type,
            COUNT(*) as count,
            ROUND(SUM(p.drawn_amount) / 1e6, 1) as drawn_M
          FROM portfolio_positions p
          JOIN deals d ON d.id = p.deal_id
          WHERE d.status = 'funded'
          GROUP BY p.instrument_type
          ORDER BY drawn_M DESC
        `).all();

        const byFund = db.prepare(`
          SELECT
            f.name as fund_name,
            COUNT(*) as count,
            ROUND(SUM(p.drawn_amount) / 1e6, 1) as drawn_M,
            ROUND(SUM(p.fair_value) / 1e6, 1) as fair_value_M
          FROM portfolio_positions p
          JOIN deals d ON d.id = p.deal_id
          JOIN funds f ON f.id = d.fund_id
          WHERE d.status = 'funded'
          GROUP BY f.id
          ORDER BY drawn_M DESC
        `).all();

        return { summary: stats, by_instrument_type: byType, by_fund: byFund };
      }

      case 'query_positions': {
        const limit = Math.min(input.limit || 15, 50);
        const sortField = {
          drawn_amount: 'p.drawn_amount',
          fair_value: 'p.fair_value',
          leverage_ratio: 'm.leverage_ratio',
          maturity_date: 'p.maturity_date',
          levered_yield: 'p.levered_yield',
        }[input.sort_by as string] || 'p.drawn_amount';
        const sortDir = input.sort_dir === 'asc' ? 'ASC' : 'DESC';

        let where = "WHERE d.status = 'funded' AND p.drawn_amount > 0";
        const params: any[] = [];

        if (input.instrument_type) { where += ' AND p.instrument_type = ?'; params.push(input.instrument_type); }
        if (input.fund_name) { where += ' AND f.name LIKE ?'; params.push(`%${input.fund_name}%`); }
        if (input.min_leverage != null) { where += ' AND m.leverage_ratio >= ?'; params.push(input.min_leverage); }
        if (input.max_leverage != null) { where += ' AND m.leverage_ratio <= ?'; params.push(input.max_leverage); }
        if (input.min_drawn_M != null) { where += ' AND p.drawn_amount >= ?'; params.push(input.min_drawn_M * 1e6); }
        if (input.maturity_before) { where += ' AND p.maturity_date <= ?'; params.push(input.maturity_before); }

        const rows = db.prepare(`
          SELECT
            d.id as deal_id, d.name as deal_name,
            be.name as borrower,
            p.instrument_type,
            f.name as fund,
            ROUND(p.drawn_amount / 1e6, 1) as drawn_M,
            ROUND(p.undrawn_amount / 1e6, 1) as undrawn_M,
            ROUND(p.fair_value / 1e6, 1) as fair_value_M,
            ROUND(p.levered_yield * 100, 2) as yield_pct,
            ROUND(p.advance_rate * 100, 1) as advance_rate_pct,
            ROUND(p.coupon_rate * 100, 2) as coupon_pct,
            p.maturity_date,
            ROUND(m.leverage_ratio, 2) as leverage_ratio,
            ROUND(m.interest_coverage, 2) as interest_coverage,
            m.period_end_date as metrics_as_of
          FROM portfolio_positions p
          JOIN deals d ON d.id = p.deal_id
          LEFT JOIN business_entities be ON be.id = d.borrower_entity_id
          LEFT JOIN funds f ON f.id = d.fund_id
          LEFT JOIN (
            SELECT position_id, leverage_ratio, interest_coverage, period_end_date,
              ROW_NUMBER() OVER (PARTITION BY position_id ORDER BY period_end_date DESC) as rn
            FROM portfolio_metrics
          ) m ON m.position_id = p.id AND m.rn = 1
          ${where}
          ORDER BY ${sortField} ${sortDir}
          LIMIT ?
        `).all(...params, limit);

        return { count: rows.length, positions: rows };
      }

      case 'get_deal_detail': {
        let dealId = input.deal_id;
        if (!dealId && input.deal_name) {
          const found: any = db.prepare(
            `SELECT d.id FROM deals d LEFT JOIN business_entities be ON be.id = d.borrower_entity_id
             WHERE d.name LIKE ? OR be.name LIKE ? LIMIT 1`
          ).get(`%${input.deal_name}%`, `%${input.deal_name}%`);
          dealId = found?.id;
        }
        if (!dealId) return { error: 'Deal not found' };

        const deal: any = db.prepare(`
          SELECT d.id, d.name, d.status, d.description, d.decision_rationale,
            be.name as borrower, f.name as fund, iv.name as vehicle,
            p.instrument_type,
            ROUND(p.drawn_amount / 1e6, 1) as drawn_M,
            ROUND(p.undrawn_amount / 1e6, 1) as undrawn_M,
            ROUND(p.fair_value / 1e6, 1) as fair_value_M,
            ROUND(p.commitment_amount / 1e6, 1) as commitment_M,
            ROUND(p.levered_yield * 100, 2) as yield_pct,
            ROUND(p.advance_rate * 100, 1) as advance_rate_pct,
            ROUND(p.coupon_rate * 100, 2) as coupon_pct,
            ROUND(p.pik_rate * 100, 2) as pik_pct,
            p.maturity_date, p.origination_date, p.interest_rate_type,
            d.deal_team_lead
          FROM deals d
          LEFT JOIN business_entities be ON be.id = d.borrower_entity_id
          LEFT JOIN funds f ON f.id = d.fund_id
          LEFT JOIN investment_vehicles iv ON iv.id = d.vehicle_id
          LEFT JOIN portfolio_positions p ON p.deal_id = d.id
          WHERE d.id = ?
        `).get(dealId);

        const latestMetrics: any = db.prepare(`
          SELECT
            ROUND(leverage_ratio, 2) as leverage_ratio,
            ROUND(interest_coverage, 2) as interest_coverage,
            ROUND(ebitda / 1e6, 1) as ebitda_M,
            ROUND(revenue / 1e6, 1) as revenue_M,
            ROUND(total_debt / 1e6, 1) as total_debt_M,
            period_end_date, metric_source, period_type
          FROM portfolio_metrics
          WHERE position_id = (SELECT id FROM portfolio_positions WHERE deal_id = ?)
          ORDER BY period_end_date DESC LIMIT 1
        `).get(dealId);

        const obligations: any[] = db.prepare(`
          SELECT obligation_type, frequency, status, last_received_date, days_after_period_end
          FROM portfolio_reporting_obligations
          WHERE position_id = (SELECT id FROM portfolio_positions WHERE deal_id = ?)
        `).all(dealId) as any[];

        const recentCalls: any[] = db.prepare(`
          SELECT call_date, call_type, summary, participants, status
          FROM call_records
          WHERE position_id = (SELECT id FROM portfolio_positions WHERE deal_id = ?)
          ORDER BY call_date DESC LIMIT 3
        `).all(dealId) as any[];

        return { deal, latest_metrics: latestMetrics, reporting_obligations: obligations, recent_calls: recentCalls };
      }

      case 'get_covenant_data': {
        const limit = input.limit || 25;
        let where = "WHERE d.status = 'funded' AND p.drawn_amount > 0";
        const params: any[] = [];
        if (input.deal_id) { where += ' AND d.id = ?'; params.push(input.deal_id); }

        const rows: any[] = db.prepare(`
          SELECT
            d.id as deal_id, d.name as deal_name,
            be.name as borrower,
            ROUND(p.drawn_amount / 1e6, 1) as drawn_M,
            ROUND(m.leverage_ratio, 2) as leverage_ratio,
            ROUND(m.interest_coverage, 2) as interest_coverage,
            ROUND(m.ebitda / 1e6, 1) as ebitda_M,
            m.period_end_date,
            CASE
              WHEN m.leverage_ratio > 5.25 OR m.interest_coverage < 1.75 THEN 'breach'
              WHEN m.leverage_ratio > 4.5 OR m.interest_coverage < 2.0 THEN 'warning'
              WHEN m.leverage_ratio IS NOT NULL OR m.interest_coverage IS NOT NULL THEN 'current'
              ELSE 'n/a'
            END as covenant_status,
            (SELECT COUNT(*) FROM portfolio_reporting_obligations ro
             WHERE ro.position_id = p.id AND ro.status = 'overdue') as overdue_reports
          FROM portfolio_positions p
          JOIN deals d ON d.id = p.deal_id
          LEFT JOIN business_entities be ON be.id = d.borrower_entity_id
          LEFT JOIN (
            SELECT position_id, leverage_ratio, interest_coverage, ebitda, period_end_date,
              ROW_NUMBER() OVER (PARTITION BY position_id ORDER BY period_end_date DESC) as rn
            FROM portfolio_metrics
          ) m ON m.position_id = p.id AND m.rn = 1
          ${where}
          ORDER BY
            CASE WHEN m.leverage_ratio > 5.25 OR m.interest_coverage < 1.75 THEN 0
                 WHEN m.leverage_ratio > 4.5 OR m.interest_coverage < 2.0 THEN 1
                 ELSE 2 END,
            p.drawn_amount DESC
          LIMIT ?
        `).all(...params, limit) as any[];

        const filtered = input.status
          ? rows.filter((r: any) => r.covenant_status === input.status)
          : rows;

        const breaches = filtered.filter((r: any) => r.covenant_status === 'breach').length;
        const warnings = filtered.filter((r: any) => r.covenant_status === 'warning').length;
        const current = filtered.filter((r: any) => r.covenant_status === 'current').length;

        return { summary: { breach: breaches, warning: warnings, current, na: filtered.length - breaches - warnings - current }, covenants: filtered };
      }

      case 'get_lp_data': {
        const limit = input.limit || 20;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (input.status) { where += ' AND status = ?'; params.push(input.status); }
        if (input.lp_type) { where += ' AND type = ?'; params.push(input.lp_type); }
        if (input.relationship_owner) { where += ' AND relationship_owner LIKE ?'; params.push(`%${input.relationship_owner}%`); }

        const rows = db.prepare(`
          SELECT
            id, name, type, status,
            ROUND(aum / 1e9, 1) as aum_B,
            headquarters, relationship_owner, notes,
            (SELECT COUNT(*) FROM investing_entities ie WHERE ie.limited_partner_id = lp.id) as entity_count,
            (SELECT COUNT(*) FROM contacts c WHERE c.limited_partner_id = lp.id) as contact_count
          FROM limited_partners lp
          ${where}
          ORDER BY aum DESC NULLS LAST
          LIMIT ?
        `).all(...params, limit);

        return { count: (rows as any[]).length, limited_partners: rows };
      }

      case 'get_tasks': {
        const limit = input.limit || 20;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (input.status) { where += ' AND t.status = ?'; params.push(input.status); }
        if (input.deal_id) { where += ' AND t.deal_id = ?'; params.push(input.deal_id); }
        if (input.priority) { where += ' AND t.priority = ?'; params.push(input.priority); }
        if (input.overdue_only) { where += " AND t.due_date < date('now') AND t.status NOT IN ('admin_confirmed','cancelled')"; }

        const rows = db.prepare(`
          SELECT
            t.id, t.title, t.status, t.priority, t.due_date, t.task_type,
            t.admin_sent_at, t.admin_confirmed_at,
            u.name as assigned_to_name,
            d.name as deal_name,
            t.deal_id
          FROM tasks t
          LEFT JOIN users u ON u.id = t.assigned_to
          LEFT JOIN deals d ON d.id = t.deal_id
          ${where}
          ORDER BY
            CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
            t.due_date ASC NULLS LAST
          LIMIT ?
        `).all(...params, limit);

        return { count: (rows as any[]).length, tasks: rows };
      }

      case 'get_deal_flow': {
        const limit = input.limit || 20;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (input.status) { where += ' AND d.status = ?'; params.push(input.status); }

        const rows = db.prepare(`
          SELECT
            d.id, d.name, d.status, d.origination_date,
            be.name as borrower,
            f.name as fund,
            ROUND(p.commitment_amount / 1e6, 1) as commitment_M,
            d.deal_team_lead, d.description
          FROM deals d
          LEFT JOIN business_entities be ON be.id = d.borrower_entity_id
          LEFT JOIN funds f ON f.id = d.fund_id
          LEFT JOIN portfolio_positions p ON p.deal_id = d.id
          ${where}
          ORDER BY d.created_at DESC NULLS LAST
          LIMIT ?
        `).all(...params, limit);

        return { count: (rows as any[]).length, deals: rows };
      }

      case 'get_metrics_history': {
        let dealId = input.deal_id;
        if (!dealId && input.deal_name) {
          const found: any = db.prepare(
            `SELECT d.id FROM deals d LEFT JOIN business_entities be ON be.id = d.borrower_entity_id
             WHERE d.name LIKE ? OR be.name LIKE ? LIMIT 1`
          ).get(`%${input.deal_name}%`, `%${input.deal_name}%`);
          dealId = found?.id;
        }
        if (!dealId) return { error: 'Deal not found' };

        const limit = input.limit || 8;
        const rows = db.prepare(`
          SELECT
            period_end_date, period_type,
            ROUND(leverage_ratio, 2) as leverage_ratio,
            ROUND(interest_coverage, 2) as interest_coverage,
            ROUND(ebitda / 1e6, 1) as ebitda_M,
            ROUND(revenue / 1e6, 1) as revenue_M,
            ROUND(total_debt / 1e6, 1) as total_debt_M,
            metric_source, ai_extracted
          FROM portfolio_metrics
          WHERE position_id = (SELECT id FROM portfolio_positions WHERE deal_id = ?)
          ORDER BY period_end_date DESC
          LIMIT ?
        `).all(dealId, limit);

        return { deal_id: dealId, metrics: rows };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    console.error(`Tool error [${name}]:`, err.message);
    return { error: err.message };
  }
}

// ─── System Prompt Builder ────────────────────────────────────────────────────

function buildSystemPrompt(context: any): string {
  const contextLines: string[] = [];

  if (context?.page) contextLines.push(`Current page: ${context.page}`);
  if (context?.dealId) contextLines.push(`Viewing deal ID: ${context.dealId}`);
  if (context?.dealName) contextLines.push(`Viewing deal: ${context.dealName}`);
  if (context?.activeTab) contextLines.push(`Active tab: ${context.activeTab}`);
  if (context?.fund) contextLines.push(`Filtered to fund: ${context.fund}`);

  const contextBlock = contextLines.length > 0
    ? `\n\nCurrent user context:\n${contextLines.map(l => `• ${l}`).join('\n')}`
    : '';

  return `You are the GP OS Intelligence Assistant for Stonecrest Capital, a private credit and equity investment manager. You have access to real portfolio data via tool calls.

Your role is to help portfolio managers, analysts, and IR professionals quickly find answers about the portfolio, deal terms, LP relationships, covenants, and action items.

Guidelines:
- Be concise and data-driven. Lead with the answer, then provide supporting data.
- Always use tools to get real numbers — never invent figures.
- Format currency as $42.5M or $1.2B. Format ratios as 3.8x. Format percentages as 8.5%.
- When showing multiple items, use a simple table or numbered list.
- If a question relates to the current page context, use the relevant deal/entity ID directly.
- Covenant thresholds: Leverage warning > 4.5x, breach > 5.25x. Coverage warning < 2.0x, breach < 1.75x.
- Be direct. No filler phrases. No "Great question!". No unnecessary disclaimers.${contextBlock}`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post('/chat', async (req: Request, res: Response) => {
  const { messages, context, api_key } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const key = api_key || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(400).json({ error: 'No API key provided. Add your Anthropic API key in the chat panel.' });
  }

  const client = new Anthropic({ apiKey: key });
  const systemPrompt = buildSystemPrompt(context);

  // Agentic loop — resolve all tool calls server-side before responding
  const claudeMessages: Anthropic.MessageParam[] = messages.map((m: any) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  let finalText = '';
  let toolCallLog: { tool: string; input: any; result: any }[] = [];
  const MAX_ITER = 6;

  for (let i = 0; i < MAX_ITER; i++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      tools: TOOLS,
      messages: claudeMessages,
    });

    if (response.stop_reason === 'end_turn') {
      finalText = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('');
      break;
    }

    if (response.stop_reason === 'tool_use') {
      // Add assistant's tool_use blocks to history
      claudeMessages.push({ role: 'assistant', content: response.content });

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`[Intelligence] Tool call: ${block.name}`, block.input);
          const result = executeTool(block.name, block.input);
          toolCallLog.push({ tool: block.name, input: block.input, result });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }

      claudeMessages.push({ role: 'user', content: toolResults });
      continue;
    }

    // stop_sequence or other
    finalText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('');
    break;
  }

  return res.json({
    response: finalText || 'I was unable to generate a response.',
    tool_calls: toolCallLog.map(t => ({ tool: t.tool, input: t.input })),
  });
});

export default router;
