import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { getDatabase } from '../database.js';

const router = express.Router();

// GET /api/tasks — list with optional filters: deal_id, assigned_to, status
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { deal_id, assigned_to, status } = req.query;

    let query = `
      SELECT t.*,
        d.name as deal_name,
        u_a.name as assigned_to_name,
        u_a.avatar_initials as assigned_to_initials,
        u_a.role as assigned_to_role,
        u_c.name as created_by_name,
        cr.call_date
      FROM tasks t
      JOIN deals d ON t.deal_id = d.id
      JOIN users u_a ON t.assigned_to = u_a.id
      JOIN users u_c ON t.created_by = u_c.id
      LEFT JOIN call_records cr ON t.call_record_id = cr.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (deal_id) {
      query += ' AND t.deal_id = ?';
      params.push(parseInt(deal_id as string));
    }
    if (assigned_to) {
      query += ' AND t.assigned_to = ?';
      params.push(parseInt(assigned_to as string));
    }
    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    query += ' ORDER BY CASE t.priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'low\' THEN 3 END, t.due_date ASC NULLS LAST, t.created_at DESC';

    const tasks = db.prepare(query).all(...params);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/tasks/users — list all firm users
router.get('/users', (req, res) => {
  try {
    const db = getDatabase();
    const users = db.prepare('SELECT * FROM users ORDER BY name').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/tasks/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const task = db.prepare(`
      SELECT t.*,
        d.name as deal_name,
        u_a.name as assigned_to_name,
        u_a.avatar_initials as assigned_to_initials,
        u_c.name as created_by_name,
        cr.call_date, cr.summary as call_summary
      FROM tasks t
      JOIN deals d ON t.deal_id = d.id
      JOIN users u_a ON t.assigned_to = u_a.id
      JOIN users u_c ON t.created_by = u_c.id
      LEFT JOIN call_records cr ON t.call_record_id = cr.id
      WHERE t.id = ?
    `).get(parseInt(req.params.id));
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/tasks — manual task creation
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { deal_id, assigned_to, created_by, title, description, priority, due_date } = req.body;
    if (!deal_id || !assigned_to || !created_by || !title) {
      return res.status(400).json({ error: 'deal_id, assigned_to, created_by, and title are required' });
    }
    const result = db.prepare(`
      INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, description, source_quote, priority, due_date, status)
      VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, ?, 'open')
    `).run(deal_id, assigned_to, created_by, title, description || null, priority || 'medium', due_date || null);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// PUT /api/tasks/:id — update status, assignee, due date, priority
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { status, assigned_to, priority, due_date, title, description } = req.body;
    const id = parseInt(req.params.id);

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const completed_at = status === 'complete' && existing.status !== 'complete'
      ? new Date().toISOString()
      : (status !== 'complete' ? null : existing.completed_at);

    db.prepare(`
      UPDATE tasks
      SET status = ?, assigned_to = ?, priority = ?, due_date = ?, title = ?, description = ?, completed_at = ?
      WHERE id = ?
    `).run(
      status ?? existing.status,
      assigned_to ?? existing.assigned_to,
      priority ?? existing.priority,
      due_date !== undefined ? due_date : existing.due_date,
      title ?? existing.title,
      description !== undefined ? description : existing.description,
      completed_at,
      id
    );

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    db.prepare('DELETE FROM tasks WHERE id = ?').run(parseInt(req.params.id));
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/tasks/:id/send-to-admin — transition open → sent_to_admin
router.post('/:id/send-to-admin', (req, res) => {
  try {
    const db = getDatabase();
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (existing.status !== 'open') {
      return res.status(400).json({ error: `Cannot send to admin from status: ${existing.status}` });
    }
    db.prepare(`
      UPDATE tasks SET status = 'sent_to_admin', admin_sent_at = datetime('now') WHERE id = ?
    `).run(id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/tasks/:id/admin-confirm — simulate master system callback: sent_to_admin → admin_confirmed
router.post('/:id/admin-confirm', (req, res) => {
  try {
    const db = getDatabase();
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (existing.status !== 'sent_to_admin') {
      return res.status(400).json({ error: `Cannot confirm from status: ${existing.status}` });
    }
    db.prepare(`
      UPDATE tasks SET status = 'admin_confirmed', admin_confirmed_at = datetime('now'), completed_at = datetime('now') WHERE id = ?
    `).run(id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/tasks/extract — AI extract tasks from transcript
// Returns proposed tasks for user confirmation before saving
router.post('/extract', async (req, res) => {
  try {
    const { transcript, deal_id, call_record_id, participants } = req.body;
    const apiKey = req.headers['x-api-key'] as string || process.env.ANTHROPIC_API_KEY;

    if (!transcript || !deal_id) {
      return res.status(400).json({ error: 'transcript and deal_id are required' });
    }
    if (!apiKey) {
      return res.status(400).json({ error: 'Anthropic API key required' });
    }

    const db = getDatabase();
    const users = db.prepare('SELECT id, name, role, avatar_initials FROM users').all() as any[];
    const deal = db.prepare('SELECT name FROM deals WHERE id = ?').get(deal_id) as any;

    const client = new Anthropic({ apiKey });

    const prompt = `You are an investment team assistant at a private credit investment firm. Analyze this portfolio company call transcript and extract all action items and to-do tasks for the investment team.

Investment: ${deal?.name || 'Unknown'}

Firm team members:
${users.map(u => `- ${u.name} (${u.role}, id: ${u.id})`).join('\n')}
${participants ? `\nCall participants: ${participants}` : ''}

TRANSCRIPT:
${transcript}

Extract all action items mentioned, implied, or committed to during this call. For each task:
- Assign to the most appropriate firm team member based on their role (admin/operations handle system updates and data entry; associates/analysts handle research and document requests; directors/MDs handle relationship and strategic items)
- Include the exact quote from the transcript that implies or states the action
- Set priority based on urgency mentioned or implied
- Extract due date if mentioned (convert relative dates like "by end of month" to approximate absolute dates, today is ${new Date().toISOString().split('T')[0]})

Return a JSON object:
{
  "tasks": [
    {
      "title": "Brief imperative action item (max 10 words)",
      "description": "1-2 sentence context",
      "assigned_to_id": <user id from list above>,
      "source_quote": "verbatim quote from transcript",
      "priority": "high" | "medium" | "low",
      "due_date": "YYYY-MM-DD or null"
    }
  ],
  "summary": "2-3 sentence summary of the call"
}

Return only valid JSON, no markdown fences.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return res.status(500).json({ error: 'Unexpected response format' });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content.text);
    } catch {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(500).json({ error: 'Could not parse AI response' });
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Enrich with user details
    const enriched = (parsed.tasks || []).map((t: any) => {
      const user = users.find(u => u.id === t.assigned_to_id);
      return { ...t, assigned_to_name: user?.name, assigned_to_initials: user?.avatar_initials };
    });

    res.json({ tasks: enriched, summary: parsed.summary });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/tasks/confirm — save confirmed tasks after user review
router.post('/confirm', (req, res) => {
  try {
    const db = getDatabase();
    const { tasks, deal_id, call_record_id, created_by } = req.body;

    if (!tasks?.length || !deal_id || !created_by) {
      return res.status(400).json({ error: 'tasks, deal_id, and created_by are required' });
    }

    const insertTask = db.prepare(`
      INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, description, source_quote, priority, due_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
    `);

    const insertMany = db.transaction((taskList: any[]) => {
      const results = [];
      for (const t of taskList) {
        const r = insertTask.run(
          deal_id,
          call_record_id || null,
          t.assigned_to_id,
          created_by,
          t.title,
          t.description || null,
          t.source_quote || null,
          t.priority || 'medium',
          t.due_date || null
        );
        results.push(r.lastInsertRowid);
      }
      return results;
    });

    const ids = insertMany(tasks);
    res.status(201).json({ created: ids.length, task_ids: ids });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
