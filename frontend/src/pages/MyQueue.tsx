import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/Layout';

// Hardcoded current user = Sarah Chen (id=1) — MD
const CURRENT_USER_ID = 1;
const CURRENT_USER_NAME = 'Sarah Chen';

function fmtDate(s?: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(due?: string | null, status?: string) {
  if (!due || status === 'complete') return false;
  return new Date(due) < new Date();
}

function isDueToday(due?: string | null) {
  if (!due) return false;
  const d = new Date(due);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

interface Task {
  id: number;
  deal_id: number;
  deal_name: string;
  call_record_id: number | null;
  title: string;
  description: string;
  source_quote: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  status: string;
  assigned_to_name: string;
  assigned_to_initials: string;
  created_by_name: string;
  created_at: string;
  completed_at: string | null;
}

export default function MyQueue() {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDeal, setFilterDeal] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedQuotes, setExpandedQuotes] = useState<Set<number>>(new Set());

  const { data: tasks = [], refetch } = useQuery<Task[]>({
    queryKey: ['my-tasks', CURRENT_USER_ID],
    queryFn: async () => {
      const res = await fetch(`http://localhost:3002/api/tasks?assigned_to=${CURRENT_USER_ID}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const toggleStatus = async (task: Task) => {
    const newStatus = task.status === 'complete' ? 'open' : 'complete';
    await fetch(`http://localhost:3002/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    refetch();
  };

  const toggleQuote = (id: number) => {
    setExpandedQuotes(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const openTasks = tasks.filter(t => t.status !== 'complete' && t.status !== 'cancelled');
  const completedTasks = tasks.filter(t => t.status === 'complete');

  const deals = Array.from(new Set(tasks.map(t => t.deal_name))).sort();

  const filtered = openTasks.filter(t => {
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterDeal !== 'all' && t.deal_name !== filterDeal) return false;
    return true;
  });

  const overdue = filtered.filter(t => isOverdue(t.due_date, t.status));
  const dueToday = filtered.filter(t => !isOverdue(t.due_date, t.status) && isDueToday(t.due_date));
  const upcoming = filtered.filter(t => !isOverdue(t.due_date, t.status) && !isDueToday(t.due_date));

  const TaskRow = ({ task }: { task: Task }) => (
    <div className={`px-5 py-4 border-b border-gray-100 last:border-0 flex items-start gap-3 hover:bg-gray-50 transition-colors ${task.call_record_id ? 'border-l-2 border-l-violet-300' : ''}`}>
      <button
        onClick={() => toggleStatus(task)}
        className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          task.status === 'complete' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-violet-400'
        }`}
      >
        {task.status === 'complete' && <span className="text-xs">✓</span>}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === 'complete' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Link to={`/portfolio/positions/${task.deal_id}`} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors">
            {task.deal_name}
          </Link>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${priorityColors[task.priority]}`}>{task.priority}</span>
          {task.due_date && (
            <span className={`text-xs font-medium ${isOverdue(task.due_date, task.status) ? 'text-red-600' : isDueToday(task.due_date) ? 'text-amber-600' : 'text-gray-500'}`}>
              {isOverdue(task.due_date, task.status) ? '⚠ Overdue · ' : isDueToday(task.due_date) ? '· Today · ' : ''}Due {fmtDate(task.due_date)}
            </span>
          )}
          {task.call_record_id && <span className="text-xs text-violet-600 font-medium">✦ AI extracted</span>}
        </div>
        {task.source_quote && (
          <button onClick={() => toggleQuote(task.id)} className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 italic">
            {expandedQuotes.has(task.id) ? '▼ Hide source quote' : '▶ View source quote'}
          </button>
        )}
        {task.source_quote && expandedQuotes.has(task.id) && (
          <p className="mt-1 text-xs text-gray-500 italic border-l-2 border-violet-300 pl-2">"{task.source_quote}"</p>
        )}
      </div>
    </div>
  );

  const SectionHeader = ({ label, count, color = 'gray' }: { label: string; count: number; color?: string }) => (
    <div className={`px-5 py-2.5 flex items-center gap-2 border-b border-gray-100 ${
      color === 'red' ? 'bg-red-50' : color === 'amber' ? 'bg-amber-50' : 'bg-gray-50'
    }`}>
      <span className={`text-xs font-bold uppercase tracking-wide ${
        color === 'red' ? 'text-red-600' : color === 'amber' ? 'text-amber-600' : 'text-gray-500'
      }`}>{label}</span>
      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
        color === 'red' ? 'bg-red-100 text-red-700' : color === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
      }`}>{count}</span>
    </div>
  );

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Queue</h1>
          <p className="text-gray-500 text-sm mt-1">{CURRENT_USER_NAME} · {openTasks.length} open task{openTasks.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="flex gap-2 flex-wrap justify-end">
            {overdue.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                {overdue.length} overdue
              </span>
            )}
            {dueToday.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                {dueToday.length} due today
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Priority</label>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-500">Investment</label>
          <select value={filterDeal} onChange={e => setFilterDeal(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
            <option value="all">All Investments</option>
            {deals.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Task groups */}
      {filtered.length === 0 && !showCompleted ? (
        <div className="card p-12 text-center text-gray-500">
          <p className="text-lg mb-2">All clear ✓</p>
          <p className="text-sm">No open tasks assigned to you right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Overdue */}
          {overdue.length > 0 && (
            <div className="card overflow-hidden">
              <SectionHeader label="Overdue" count={overdue.length} color="red" />
              {overdue.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          )}

          {/* Due Today */}
          {dueToday.length > 0 && (
            <div className="card overflow-hidden">
              <SectionHeader label="Due Today" count={dueToday.length} color="amber" />
              {dueToday.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="card overflow-hidden">
              <SectionHeader label="Upcoming" count={upcoming.length} />
              {upcoming.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          )}

          {/* Completed toggle */}
          {completedTasks.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(v => !v)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
              >
                <span className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`}>▶</span>
                {showCompleted ? 'Hide' : 'Show'} completed ({completedTasks.length})
              </button>
              {showCompleted && (
                <div className="card overflow-hidden opacity-70">
                  <SectionHeader label="Completed" count={completedTasks.length} />
                  {completedTasks.map(t => <TaskRow key={t.id} task={t} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
