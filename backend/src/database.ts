import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database.Database;

export function initializeDatabase(): Database.Database {
  const dbPath = join(__dirname, '../data/gp-os.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Read and execute schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  const schemaStatements = schema.split(';').filter(s => s.trim());

  for (const statement of schemaStatements) {
    if (statement.trim()) {
      try {
        db.exec(statement);
      } catch (error) {
        // Table might already exist, which is fine
        console.log('Schema execution info:', (error as Error).message);
      }
    }
  }

  // Check if data already seeded
  const firmCount = db.prepare('SELECT COUNT(*) as count FROM firms').get() as { count: number };

  if (firmCount.count === 0) {
    console.log('Seeding database with initial data...');
    const seed = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
    const seedStatements = seed.split(';').filter(s => s.trim());

    for (const statement of seedStatements) {
      if (statement.trim()) {
        try {
          db.exec(statement);
        } catch (error) {
          console.error('Seed error:', (error as Error).message);
        }
      }
    }
    console.log('Database seeded successfully');
  } else {
    console.log('Database already contains data, skipping seed');
  }

  // Migration: seed users + tasks if not yet present
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count === 0) {
      console.log('Seeding users and tasks...');
      const usersSeed = [
        `INSERT INTO users (name, email, role, avatar_initials) VALUES ('Sarah Chen', 'schen@stonecrest.com', 'managing_director', 'SC')`,
        `INSERT INTO users (name, email, role, avatar_initials) VALUES ('Alex Thompson', 'athompson@stonecrest.com', 'director', 'AT')`,
        `INSERT INTO users (name, email, role, avatar_initials) VALUES ('Michelle Rodriguez', 'mrodriguez@stonecrest.com', 'director', 'MR')`,
        `INSERT INTO users (name, email, role, avatar_initials) VALUES ('James Wilson', 'jwilson@stonecrest.com', 'associate', 'JW')`,
        `INSERT INTO users (name, email, role, avatar_initials) VALUES ('Patricia Brown', 'pbrown@stonecrest.com', 'associate', 'PB')`,
        `INSERT INTO users (name, email, role, avatar_initials) VALUES ('Michael Chang', 'mchang@stonecrest.com', 'admin', 'MC')`,
      ];
      for (const s of usersSeed) db.exec(s);

      const tasksSeed = [
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (1, 1, 2, 1, 'Request updated financial model from CFO', '"We should have the updated model ready by end of the month, happy to share it with the team"', 'high', '2026-04-30', 'open')`,
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (1, 1, 6, 1, 'Update advance rate in source system to 0.90', '"The advance rate remains at 90 basis points as agreed in the credit agreement"', 'high', '2026-04-28', 'open')`,
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (1, 1, 4, 1, 'Review covenant compliance certificate', '"We will have the compliance certificate over to you within the next two weeks"', 'medium', '2026-05-10', 'open')`,
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (1, NULL, 2, 1, 'Schedule Q2 board call', NULL, 'low', '2026-05-15', 'complete')`,
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (2, 2, 3, 1, 'Follow up on covenant waiver documentation', '"Yes the waiver was executed last month, I can get you a copy of that documentation"', 'high', '2026-05-05', 'open')`,
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (2, 2, 6, 1, 'Confirm Q1 interest payment received', '"The Q1 interest payment was sent last Friday, standard wire"', 'medium', '2026-04-26', 'in_progress')`,
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (3, 3, 4, 1, 'Validate recurring revenue figure against financials', '"Our recurring revenue is up 18% year over year, we are very pleased with retention"', 'medium', '2026-05-02', 'open')`,
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (3, 3, 6, 1, 'Update EBITDA and revenue in system for Q1', '"EBITDA for Q1 came in at 10.8 million, revenue was 29.2 million"', 'high', '2026-04-27', 'open')`,
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (4, 4, 5, 1, 'Track integration milestones against acquisition plan', '"Integration is tracking ahead of our original 18-month plan, we should be done by Q3"', 'medium', '2026-05-15', 'open')`,
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (5, 5, 2, 1, 'Request net dollar retention supporting data', '"Net dollar retention came in at 125% which we are really proud of this quarter"', 'high', '2026-05-01', 'open')`,
        `INSERT INTO tasks (deal_id, call_record_id, assigned_to, created_by, title, source_quote, priority, due_date, status) VALUES (5, NULL, 2, 1, 'Prepare fair value memo for Q2 valuation committee', NULL, 'high', '2026-05-20', 'open')`,
      ];
      for (const s of tasksSeed) db.exec(s);
      console.log('Users and tasks seeded successfully');
    }
  } catch (err) {
    console.log('Migration info:', (err as Error).message);
  }

  // Migration: add task_type, admin_sent_at, admin_confirmed_at to tasks; remove status CHECK constraint
  try {
    const taskCols = db.prepare('PRAGMA table_info(tasks)').all() as any[];
    const hasTaskType = taskCols.some(c => c.name === 'task_type');
    if (!hasTaskType) {
      console.log('Migrating tasks table: adding task_type and admin tracking columns...');
      db.exec(`
        CREATE TABLE tasks_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          deal_id INTEGER NOT NULL REFERENCES deals(id),
          call_record_id INTEGER REFERENCES call_records(id),
          assigned_to INTEGER NOT NULL REFERENCES users(id),
          created_by INTEGER NOT NULL REFERENCES users(id),
          title TEXT NOT NULL,
          description TEXT,
          source_quote TEXT,
          task_type TEXT DEFAULT 'general',
          priority TEXT DEFAULT 'medium',
          due_date TEXT,
          status TEXT DEFAULT 'open',
          admin_sent_at TEXT,
          admin_confirmed_at TEXT,
          completed_at TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      db.exec(`
        INSERT INTO tasks_new (id, deal_id, call_record_id, assigned_to, created_by, title, description, source_quote, priority, due_date, status, completed_at, created_at)
        SELECT id, deal_id, call_record_id, assigned_to, created_by, title, description, source_quote, priority, due_date, status, completed_at, created_at FROM tasks
      `);
      db.exec(`DROP TABLE tasks`);
      db.exec(`ALTER TABLE tasks_new RENAME TO tasks`);
      // Backfill task_type based on title keywords
      db.exec(`
        UPDATE tasks SET task_type = 'portfolio_update' WHERE title LIKE '%EBITDA%' OR title LIKE '%revenue%' OR title LIKE '%financial%' OR title LIKE '%model%' OR title LIKE '%update%';
        UPDATE tasks SET task_type = 'covenant_review' WHERE title LIKE '%covenant%' OR title LIKE '%compliance%' OR title LIKE '%waiver%';
        UPDATE tasks SET task_type = 'data_entry' WHERE title LIKE '%system%' OR title LIKE '%advance rate%' OR title LIKE '%entry%';
        UPDATE tasks SET task_type = 'follow_up' WHERE task_type = 'general' AND (title LIKE '%follow%' OR title LIKE '%request%' OR title LIKE '%confirm%');
        UPDATE tasks SET task_type = 'valuation' WHERE title LIKE '%value%' OR title LIKE '%valuation%' OR title LIKE '%fair value%'
      `);
      console.log('Tasks table migrated successfully');
    }
  } catch (err) {
    console.log('Tasks migration info:', (err as Error).message);
  }

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
