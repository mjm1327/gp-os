import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/Layout';

const API = 'https://gp-os-production.up.railway.app';
const CURRENT_USER_ID = 1; // Sarah Chen — logged-in user

const TASK_TYPE_LABELS: Record<string, string> = {
  portfolio_update: 'Portfolio Update',
  covenant_review: 'Covenant Review',
  data_entry: 'Data Entry',
  follow_up: 'Follow-Up',
  valuation: 'Valuation',
  general: 'General',
};

const TASK_TYPE_COLORS: Record<string, string> = {
  portfolio_update: 'bg-blue-100 text-blue-800',
  covenant_review: 'bg-purple-100 text-purple-800',
  data_entry: 'bg-orange-100 text-orange-800',
  follow_up: 'bg-cyan-100 text-cyan-800',
  valuation: 'bg-indigo-100 text-indigo-800',
  general: 'bg-gray-100 text-gray-600',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  open: {
    label: 'Open',
    color: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-400',
  },
  sent_to_admin: {
    label: 'Sent to Admin',
    color: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  admin_confirmed: {
    label: 'Admin Confirmed',
    color: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
  },
  complete: {
    label: 'Complete',
    color: 'bg-green-100 text-green-700',
    dot: 'bg-green-400',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700',
    dot: 'bg-red-400',
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['open'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-500',
    medium: 'bg-amber-400',
    low: 'bg-gray-300',
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[priority] || colors.medium}`}
      title={priority}
    />
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dueDateStr: string | null | undefined, status: string): boolean {
  if (!dueDateStr || ['admin_confirmed', 'complete', 'cancelled'].includes(status)) return false;
  return new Date(dueDateStr) < new Date(new Date().toDateString());
}

export default function Tasks() {
  const queryClient = useQueryClient();
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [dealFilter, setDealFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Fetch all tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetch(`${API}/api/tasks`).then(r => r.json()),
  });

  // Fetch users for filter dropdown
  const { data: users = [] } = useQuery({
    queryKey: ['task-users'],
    queryFn: () => fetch(`${API}/api/tasks/users`).then(r => r.json()),
  });

  // Fetch deals for filter dropdown
  const { data: deals = [] } = useQuery({
    queryKey: ['deals-list'],
    queryFn: () => fetch(`${API}/api/deals`).then(r => r.json()),
  });

  // Send to admin mutation
  const sendToAdmin = useMutation({
    mutationFn: (taskId: number) =>
      fetch(`${API}/api/tasks/${taskId}/send-to-admin`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (selectedTask) {
        setSelectedTask((prev: any) => ({ ...prev, status: 'sent_to_admin' }));
      }
    },
  });

  // Admin confirm mutation
  const adminConfirm = useMutation({
    mutationFn: (taskId: number) =>
      fetch(`${API}/api/tasks/${taskId}/admin-confirm`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (selectedTask) {
        setSelectedTask((prev: any) => ({ ...prev, status: 'admin_confirmed' }));
      }
    },
  });

  // Filter logic
  const filtered = tasks.filter((t: any) => {
    if (myTasksOnly && t.assigned_to !== CURRENT_USER_ID) return false;
    if (dealFilter && String(t.deal_id) !== dealFilter) return false;
    if (assigneeFilter && String(t.assigned_to) !== assigneeFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (typeFilter && (t.task_type || 'general') !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        t.deal_name?.toLowerCase().includes(q) ||
        t.assigned_to_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Counts for summary chips
  const openCount = tasks.filter((t: any) => t.status === 'open').length;
  const sentCount = tasks.filter((t: any) => t.status === 'sent_to_admin').length;
  const confirmedCount = tasks.filter((t: any) => t.status === 'admin_confirmed').length;
  const overdueCount = tasks.filter((t: any) => isOverdue(t.due_date, t.status)).length;

  return (
    <Layout>
      <div className="flex h-full">
        {/* Main panel */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all ${selectedTask ? 'mr-80' : ''}`}>
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
                <p className="text-sm text-gray-500 mt-0.5">Action items across all deals</p>
              </div>
              {/* My Tasks toggle */}
              <button
                onClick={() => setMyTasksOnly(v => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  myTasksOnly
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                <span>My Tasks</span>
                {myTasksOnly && <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded">ON</span>}
              </button>
            </div>

            {/* Summary chips */}
            <div className="flex gap-3 mt-4">
              <SummaryChip
                label="Open"
                count={openCount}
                color="gray"
                active={statusFilter === 'open'}
                onClick={() => setStatusFilter(s => s === 'open' ? '' : 'open')}
              />
              <SummaryChip
                label="Sent to Admin"
                count={sentCount}
                color="amber"
                active={statusFilter === 'sent_to_admin'}
                onClick={() => setStatusFilter(s => s === 'sent_to_admin' ? '' : 'sent_to_admin')}
              />
              <SummaryChip
                label="Confirmed"
                count={confirmedCount}
                color="green"
                active={statusFilter === 'admin_confirmed'}
                onClick={() => setStatusFilter(s => s === 'admin_confirmed' ? '' : 'admin_confirmed')}
              />
              {overdueCount > 0 && (
                <SummaryChip label="Overdue" count={overdueCount} color="red" active={false} onClick={() => {}} />
              )}
            </div>
          </div>

          {/* Filter bar */}
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Search tasks, deals, people…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56"
            />
            <select
              value={dealFilter}
              onChange={e => setDealFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Deals</option>
              {deals.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Assignees</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Types</option>
              {Object.entries(TASK_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="sent_to_admin">Sent to Admin</option>
              <option value="admin_confirmed">Admin Confirmed</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
            {(search || dealFilter || assigneeFilter || statusFilter || typeFilter || myTasksOnly) && (
              <button
                onClick={() => { setSearch(''); setDealFilter(''); setAssigneeFilter(''); setStatusFilter(''); setTypeFilter(''); setMyTasksOnly(false); }}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading tasks…</div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No tasks match your filters</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Task</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Deal</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Assigned To</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Created</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Due</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((task: any) => {
                    const overdue = isOverdue(task.due_date, task.status);
                    const isSelected = selectedTask?.id === task.id;
                    const typeKey = task.task_type || 'general';
                    return (
                      <tr
                        key={task.id}
                        onClick={() => setSelectedTask(isSelected ? null : task)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        {/* Task title + priority */}
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex items-start gap-2">
                            <PriorityDot priority={task.priority} />
                            <span className={`font-medium text-gray-900 leading-snug line-clamp-2 ${overdue ? 'text-red-700' : ''}`}>
                              {task.title}
                            </span>
                          </div>
                        </td>
                        {/* Type badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TASK_TYPE_COLORS[typeKey] || TASK_TYPE_COLORS.general}`}>
                            {TASK_TYPE_LABELS[typeKey] || 'General'}
                          </span>
                        </td>
                        {/* Deal */}
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                          {task.deal_name}
                        </td>
                        {/* Assigned to */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center">
                              {task.assigned_to_initials}
                            </span>
                            <span className="text-gray-700">{task.assigned_to_name}</span>
                          </div>
                        </td>
                        {/* Created */}
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                          {formatDate(task.created_at)}
                        </td>
                        {/* Due */}
                        <td className={`px-4 py-3 whitespace-nowrap font-medium ${overdue ? 'text-red-600' : 'text-gray-700'}`}>
                          {overdue && <span className="mr-1">⚠</span>}
                          {formatDate(task.due_date)}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={task.status} />
                        </td>
                        {/* Action button */}
                        <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          {task.status === 'open' && (
                            <button
                              onClick={() => sendToAdmin.mutate(task.id)}
                              disabled={sendToAdmin.isPending}
                              className="text-xs px-2.5 py-1 rounded border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              Send to Admin
                            </button>
                          )}
                          {task.status === 'sent_to_admin' && (
                            <button
                              onClick={() => adminConfirm.mutate(task.id)}
                              disabled={adminConfirm.isPending}
                              className="text-xs px-2.5 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                            >
                              Admin Confirm
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Detail drawer */}
        {selectedTask && (
          <TaskDrawer
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onSendToAdmin={() => sendToAdmin.mutate(selectedTask.id)}
            onAdminConfirm={() => adminConfirm.mutate(selectedTask.id)}
            sendPending={sendToAdmin.isPending}
            confirmPending={adminConfirm.isPending}
          />
        )}
      </div>
    </Layout>
  );
}

function SummaryChip({
  label, count, color, active, onClick,
}: {
  label: string; count: number; color: string; active: boolean; onClick: () => void;
}) {
  const colorMap: Record<string, string> = {
    gray: active ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400',
    amber: active ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400',
    green: active ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-700 border-green-200 hover:border-green-400',
    red: 'bg-white text-red-700 border-red-200',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${colorMap[color]}`}
    >
      <span>{label}</span>
      <span className={`text-xs font-bold ${active ? 'opacity-90' : ''}`}>{count}</span>
    </button>
  );
}

function TaskDrawer({
  task, onClose, onSendToAdmin, onAdminConfirm, sendPending, confirmPending,
}: {
  task: any;
  onClose: () => void;
  onSendToAdmin: () => void;
  onAdminConfirm: () => void;
  sendPending: boolean;
  confirmPending: boolean;
}) {
  const typeKey = task.task_type || 'general';

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl flex flex-col z-20 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-3">
          <h2 className="text-sm font-semibold text-gray-900 leading-snug">{task.title}</h2>
          <p className="text-xs text-gray-500 mt-1">{task.deal_name}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none flex-shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status workflow */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Status Workflow</p>
          <WorkflowSteps status={task.status} />
        </div>

        {/* Action buttons */}
        {task.status === 'open' && (
          <button
            onClick={onSendToAdmin}
            disabled={sendPending}
            className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Send to Admin →
          </button>
        )}
        {task.status === 'sent_to_admin' && (
          <button
            onClick={onAdminConfirm}
            disabled={confirmPending}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            ✓ Admin Confirm
          </button>
        )}

        {/* Details */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Details</p>

          <DetailRow label="Type">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${TASK_TYPE_COLORS[typeKey] || TASK_TYPE_COLORS.general}`}>
              {TASK_TYPE_LABELS[typeKey] || 'General'}
            </span>
          </DetailRow>

          <DetailRow label="Priority">
            <span className="capitalize text-gray-700">{task.priority}</span>
          </DetailRow>

          <DetailRow label="Assigned To">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center">
                {task.assigned_to_initials}
              </span>
              <span className="text-gray-700">{task.assigned_to_name}</span>
            </div>
          </DetailRow>

          <DetailRow label="Created">
            <span className="text-gray-700">{formatDate(task.created_at)}</span>
          </DetailRow>

          <DetailRow label="Due Date">
            <span className={`${isOverdue(task.due_date, task.status) ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
              {formatDate(task.due_date)}
            </span>
          </DetailRow>

          {task.admin_sent_at && (
            <DetailRow label="Sent to Admin">
              <span className="text-gray-700">{formatDate(task.admin_sent_at)}</span>
            </DetailRow>
          )}

          {task.admin_confirmed_at && (
            <DetailRow label="Admin Confirmed">
              <span className="text-gray-700">{formatDate(task.admin_confirmed_at)}</span>
            </DetailRow>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</p>
            <p className="text-sm text-gray-700 leading-relaxed">{task.description}</p>
          </div>
        )}

        {/* Source quote */}
        {task.source_quote && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Source Quote</p>
            <blockquote className="border-l-2 border-indigo-300 pl-3 text-sm text-gray-600 italic leading-relaxed">
              "{task.source_quote}"
            </blockquote>
            {task.call_date && (
              <p className="text-xs text-gray-400 mt-1">Call: {formatDate(task.call_date)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowSteps({ status }: { status: string }) {
  const steps = [
    { key: 'open', label: 'Open' },
    { key: 'sent_to_admin', label: 'Sent to Admin' },
    { key: 'admin_confirmed', label: 'Admin Confirmed' },
  ];

  const statusOrder: Record<string, number> = {
    open: 0, sent_to_admin: 1, admin_confirmed: 2,
    in_progress: 0, complete: 2, cancelled: -1,
  };
  const currentIdx = statusOrder[status] ?? 0;

  // If status is not in the 3-step workflow, show simple badge
  if (!['open', 'sent_to_admin', 'admin_confirmed'].includes(status)) {
    return <StatusBadge status={status} />;
  }

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, idx) => {
        const isComplete = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                isComplete ? 'bg-green-500 border-green-500 text-white' :
                isCurrent ? 'bg-indigo-600 border-indigo-600 text-white' :
                'bg-white border-gray-300 text-gray-400'
              }`}>
                {isComplete ? '✓' : idx + 1}
              </div>
              <span className={`text-xs mt-1 text-center leading-tight ${isCurrent ? 'text-indigo-700 font-semibold' : isComplete ? 'text-green-700' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 ${idx < currentIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}
