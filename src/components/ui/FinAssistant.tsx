import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Trash2, Sparkles, X, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { useStableToast } from '@/hooks/useStableToast';
import { expenseService } from '@/services/expense.service';
import { incomeService } from '@/services/income.service';
import { budgetService } from '@/services/budget.service';
import { recurringService } from '@/services/recurring.service';
import { formatCurrency, getCurrentMonth, getLastNMonths, calculateSavingsRate } from '@/utils';
import { EXPENSE_CATEGORIES, INCOME_SOURCES } from '@/types';
import type { PaymentMethod } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'pending' | 'done' | 'error';
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(context: {
  userName: string;
  spouseName: string;
  familyName: string;
  currentDate: string;
  familyMembers: { id: string; display_name: string }[];
}) {
  const members = context.familyMembers.map(m => m.display_name + ' (id:' + m.id + ')').join(', ');
  return [
    'You are Fin, a friendly AI financial assistant for FamilyFinance.',
    'Family: ' + context.familyName + ' | Users: ' + context.userName + ' and ' + context.spouseName,
    'Today: ' + context.currentDate + ' | Currency: INR (rupees, use ₹ symbol)',
    'Family Members: ' + members,
    'Expense Categories: ' + EXPENSE_CATEGORIES.join(', '),
    'Income Sources: ' + INCOME_SOURCES.join(', '),
    'Payment Methods: personal (cash/UPI), joint_account, credit_card',
    '',
    'RULES:',
    '1. Be SHORT and friendly. Max 3-4 lines per reply.',
    '2. When asked to add something — show a quick summary and ask to confirm.',
    '3. If info is missing (who paid, description) — ask ONE question.',
    '4. When user confirms (yes/ok/sure/add/go ahead) — output the action block.',
    '5. For spending/income questions — answer directly using LIVE DATA.',
    '6. Never invent financial data.',
    '',
    'ACTION FORMAT — output this JSON block when executing:',
    '```action',
    '{"type":"ACTION_TYPE","data":{...}}',
    '```',
    '',
    'Action types and data fields:',
    '- add_expense: {amount, category, description, date (YYYY-MM-DD), paid_by (member id), payment_method, is_shared}',
    '- add_income: {amount, source, description, date}',
    '- add_budget: {category, monthly_limit, month (1-12), year}',
    '- add_recurring: {type (income/expense), amount, description, source_or_category, frequency (daily/weekly/monthly/yearly), start_date, auto_add}',
  ].join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseAction(content: string): { type: string; data: Record<string, unknown> } | null {
  const match = content.match(/```action\n([\s\S]*?)\n```/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function cleanContent(content: string): string {
  return content.replace(/```action\n[\s\S]*?\n```/g, '').trim();
}

function renderText(content: string) {
  if (!content) return null;
  return content.split('\n').map((line, i) => {
    const html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (line.startsWith('• ') || line.startsWith('- ')) {
      return <li key={i} style={{ marginLeft: '1rem', listStyle: 'disc', lineHeight: 1.5 }}
        dangerouslySetInnerHTML={{ __html: html.replace(/^[•\-] /, '') }} />;
    }
    if (line === '') return <br key={i} />;
    return <p key={i} style={{ margin: '2px 0', lineHeight: 1.5 }}
      dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

const QUICK = [
  { icon: '💸', text: 'Add an expense' },
  { icon: '💰', text: 'Add income' },
  { icon: '📊', text: 'This month summary' },
  { icon: '💡', text: 'Financial insights' },
  { icon: '🎯', text: 'Set a budget' },
  { icon: '🔁', text: 'Add recurring payment' },
];

// ── Main widget ───────────────────────────────────────────────────────────────
export function FinAssistant() {
  const { profile, family, familyMembers } = useAppStore();
  const { user } = useAuth();
  const addToast = useStableToast();

  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialised = useRef(false);

  // Initialise greeting on first open
  useEffect(() => {
    if (open && !initialised.current) {
      initialised.current = true;
      setMessages([{
        id: '0',
        role: 'assistant',
        content: `Hi ${profile?.display_name || 'there'}! 👋 I'm **Fin**.\n\nI can add expenses, income, budgets — or answer questions about your spending. What do you need?`,
        timestamp: new Date(),
        status: 'done',
      }]);
    }
    if (open) setUnread(0);
  }, [open, profile?.display_name]);

  useEffect(() => {
    if (open && !minimised) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, minimised]);

  // Build financial context
  const buildContext = useCallback(async (): Promise<string> => {
    if (!profile?.family_id) return '';
    const familyId = profile.family_id;
    const currentMonth = getCurrentMonth();
    try {
      const [expenses, incomes, budgets] = await Promise.all([
        expenseService.getAll(familyId, { dateRange: currentMonth }),
        incomeService.getAll(familyId, { dateRange: currentMonth }),
        budgetService.getAll(familyId, new Date().getMonth() + 1, new Date().getFullYear()),
      ]);
      const totalExp = expenses.reduce((s, e) => s + Number(e.amount), 0);
      const totalInc = incomes.reduce((s, e) => s + Number(e.amount), 0);
      const catMap: Record<string, number> = {};
      expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount); });
      const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([c, a]) => `${c} ₹${a.toFixed(0)}`).join(', ');
      const budgetStr = budgets.map(b => {
        const spent = catMap[b.category] || 0;
        return `${b.category}: ₹${spent}/₹${b.monthly_limit} (${Math.round(spent/b.monthly_limit*100)}%)`;
      }).join(' | ');
      return `LIVE DATA (${format(new Date(), 'MMMM yyyy')}):
Income: ₹${totalInc.toFixed(0)} | Expenses: ₹${totalExp.toFixed(0)} | Savings: ₹${(totalInc-totalExp).toFixed(0)} (${calculateSavingsRate(totalInc, totalExp)}%)
Top categories: ${topCats || 'none'}
Budgets: ${budgetStr || 'none set'}
Members: ${familyMembers.map(m => `${m.display_name} (${m.id})`).join(', ')}
Logged in: ${profile.display_name} (${user?.id})`;
    } catch { return ''; }
  }, [profile, familyMembers, user]);

  // Execute action
  const executeAction = useCallback(async (action: { type: string; data: Record<string, unknown> }): Promise<string> => {
    if (!profile?.family_id || !user) return '❌ Not authenticated';
    const familyId = profile.family_id;
    const today = format(new Date(), 'yyyy-MM-dd');
    try {
      switch (action.type) {
        case 'add_expense': {
          const d = action.data;
          const validPaidBy = familyMembers.some(m => m.id === String(d.paid_by))
            ? String(d.paid_by) : user.id;
          await expenseService.create(familyId, user.id, {
            amount: Number(d.amount),
            category: String(d.category || 'Miscellaneous'),
            description: String(d.description || 'Expense'),
            date: String(d.date || today),
            paid_by: validPaidBy,
            payment_method: (d.payment_method as PaymentMethod) || 'personal',
            is_shared: Boolean(d.is_shared || false),
            split_ratio: Number(d.split_ratio || 0.5),
            notes: d.notes ? String(d.notes) : undefined,
          });
          return `✅ Added **${d.description}** — ${formatCurrency(Number(d.amount))} in ${d.category}`;
        }
        case 'add_income': {
          const d = action.data;
          await incomeService.create(familyId, user.id, {
            amount: Number(d.amount),
            source: (d.source as 'Salary'|'Bonus'|'Freelance'|'Interest'|'Rental'|'Other') || 'Other',
            description: d.description ? String(d.description) : undefined,
            date: String(d.date || today),
            notes: d.notes ? String(d.notes) : undefined,
          });
          return `✅ Income added — ${formatCurrency(Number(d.amount))} (${d.source})`;
        }
        case 'add_budget': {
          const d = action.data;
          await budgetService.create(familyId, user.id, {
            category: String(d.category),
            monthly_limit: Number(d.monthly_limit),
            month: Number(d.month || new Date().getMonth() + 1),
            year: Number(d.year || new Date().getFullYear()),
          });
          return `✅ Budget set — ${d.category}: ${formatCurrency(Number(d.monthly_limit))}/month`;
        }
        case 'add_recurring': {
          const d = action.data;
          const isIncome = d.type === 'income';
          await recurringService.create(familyId, user.id, {
            type: isIncome ? 'income' : 'expense',
            amount: Number(d.amount),
            description: String(d.description),
            source: isIncome ? String(d.source_or_category || 'Salary') : undefined,
            category: !isIncome ? String(d.source_or_category || 'Miscellaneous') : undefined,
            payment_method: 'personal',
            is_shared: false,
            split_ratio: 0.5,
            frequency: (d.frequency as 'daily'|'weekly'|'monthly'|'yearly') || 'monthly',
            start_date: String(d.start_date || today),
            auto_add: Boolean(d.auto_add !== false),
          });
          return `✅ Recurring set — ${d.description}: ${formatCurrency(Number(d.amount))} every ${d.frequency}`;
        }
        default: return '❌ Unknown action';
      }
    } catch (e) {
      return `❌ Failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }, [profile, user, familyMembers]);

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim(), timestamp: new Date(), status: 'done' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date(), status: 'pending' }]);

    try {
      const contextData = await buildContext();
      const history = messages
        .filter(m => m.status === 'done')
        .map(m => ({ role: m.role, content: m.content }));

      const systemPrompt = buildSystemPrompt({
        userName: profile?.display_name || 'User',
        spouseName: familyMembers.find(m => m.id !== user?.id)?.display_name || 'Spouse',
        familyName: family?.name || 'Your Family',
        currentDate: format(new Date(), 'EEEE, dd MMMM yyyy'),
        familyMembers: familyMembers.map(m => ({ id: m.id, display_name: m.display_name })),
      });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          system: systemPrompt + (contextData ? '\n\n' + contextData : ''),
          messages: [...history, { role: 'user', content: text.trim() }],
        }),
      });

      const result = await response.json();
      const assistantText: string = result.content?.[0]?.text || 'Sorry, something went wrong.';
      const action = parseAction(assistantText);
      const displayText = cleanContent(assistantText);

      if (action) {
        const actionResult = await executeAction(action);
        addToast({ type: actionResult.startsWith('✅') ? 'success' : 'error', title: actionResult.replace(/\*\*/g, '') });
        const finalText = displayText + (displayText ? '\n\n' : '') + actionResult;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: finalText, status: 'done' } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: displayText, status: 'done' } : m));
      }

      // If chat is closed, bump unread count
      if (!open || minimised) setUnread(u => u + 1);
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Sorry, could not reach the assistant. Please try again.', status: 'error' } : m));
    } finally {
      setLoading(false);
    }
  }, [loading, messages, buildContext, executeAction, profile, family, familyMembers, user, addToast, open, minimised]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => {
    initialised.current = false;
    setMessages([]);
    setUnread(0);
    // Re-trigger greeting
    setTimeout(() => {
      initialised.current = false;
      setMessages([{
        id: Date.now().toString(),
        role: 'assistant',
        content: `Chat cleared! How can I help you, ${profile?.display_name || 'there'}?`,
        timestamp: new Date(),
        status: 'done',
      }]);
    }, 50);
  };

  return (
    <>
      {/* ── Floating button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => { setOpen(o => !o); setMinimised(false); setUnread(0); }}
        style={{
          position: 'fixed',
          bottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          right: 'calc(1.5rem + env(safe-area-inset-right))',
          zIndex: 9998,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          background: open
            ? '#475569'
            : 'linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)',
          boxShadow: '0 4px 20px rgba(2,132,199,0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          transform: open ? 'scale(0.92)' : 'scale(1)',
        }}
        aria-label="Open Fin AI assistant"
      >
        {open
          ? <X style={{ width: 22, height: 22, color: 'white' }} />
          : <Sparkles style={{ width: 22, height: 22, color: 'white' }} />
        }
        {/* Unread badge */}
        {!open && unread > 0 && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 18, height: 18, borderRadius: '50%',
            background: '#ef4444', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6rem', fontWeight: 700, color: 'white',
          }}>
            {unread}
          </div>
        )}
      </button>

      {/* ── Chat window ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(5rem + env(safe-area-inset-bottom))',
          right: 'calc(1.5rem + env(safe-area-inset-right))',
          zIndex: 9997,
          width: 'min(380px, calc(100vw - 2rem))',
          height: minimised ? 0 : 520,
          maxHeight: 'calc(100vh - 8rem)',
          background: 'white',
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          transformOrigin: 'bottom right',
          transform: open ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(20px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          border: '1px solid #e2e8f0',
        }}
        className="dark:bg-surface-900 dark:border-surface-700"
      >
        {/* Header */}
        <div style={{
          padding: '0.875rem 1rem',
          background: 'linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles style={{ width: 16, height: 16, color: 'white' }} />
            </div>
            <div>
              <p style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>Fin AI</p>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.7rem', margin: 0 }}>
                {loading ? 'Thinking...' : 'Your financial assistant'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button onClick={clearChat} title="Clear chat"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '0.3rem 0.4rem', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
              <Trash2 style={{ width: 13, height: 13 }} />
            </button>
            <button onClick={() => setMinimised(m => !m)} title="Minimise"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '0.3rem 0.4rem', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
              <Minus style={{ width: 13, height: 13 }} />
            </button>
            <button onClick={() => setOpen(false)} title="Close"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '0.3rem 0.4rem', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}>
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Quick prompts — show on empty chat */}
          {messages.length <= 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.25rem' }}>
              {QUICK.map(q => (
                <button key={q.text} onClick={() => sendMessage(q.text)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '0.3rem 0.6rem', borderRadius: 20,
                    border: '1px solid #e2e8f0', background: '#f8fafc',
                    cursor: 'pointer', fontSize: '0.72rem', color: '#374151',
                    transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: '0.85rem' }}>{q.icon}</span>
                  {q.text}
                </button>
              ))}
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', gap: '0.5rem', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
              {/* Avatar */}
              <div style={{
                flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: msg.role === 'assistant' ? 'linear-gradient(135deg,#0284c7,#7c3aed)' : '#1e293b',
              }}>
                {msg.role === 'assistant'
                  ? <Bot style={{ width: 13, height: 13, color: 'white' }} />
                  : <User style={{ width: 13, height: 13, color: 'white' }} />}
              </div>

              {/* Bubble */}
              <div style={{
                maxWidth: '78%',
                padding: '0.6rem 0.75rem',
                borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                background: msg.role === 'user' ? '#0284c7' : '#f1f5f9',
                color: msg.role === 'user' ? 'white' : '#1e293b',
                fontSize: '0.82rem',
                lineHeight: 1.5,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
              className={msg.role === 'assistant' ? 'dark:bg-surface-700 dark:text-surface-100' : ''}>
                {msg.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center', padding: '3px 0' }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: '50%', background: '#94a3b8',
                        animation: `fin-bounce 1.2s infinite ${i*0.2}s`,
                      }} />
                    ))}
                  </div>
                ) : (
                  renderText(msg.content)
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '0.6rem 0.75rem',
          borderTop: '1px solid #e2e8f0',
          display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
          flexShrink: 0,
        }} className="dark:border-surface-700">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add expense, check spending..."
            rows={1}
            disabled={loading}
            style={{
              flex: 1, resize: 'none', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: '0.5rem 0.65rem',
              outline: 'none', background: '#f8fafc',
              fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.5,
              maxHeight: 80, overflowY: 'auto',
              transition: 'border-color 0.15s',
            }}
            className="dark:bg-surface-800 dark:border-surface-600 dark:text-surface-100"
            onFocus={e => e.target.style.borderColor = '#0284c7'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 80) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 34, height: 34, borderRadius: 10, border: 'none', flexShrink: 0,
              background: (!input.trim() || loading) ? '#e2e8f0' : 'linear-gradient(135deg,#0284c7,#7c3aed)',
              cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
            {loading
              ? <Loader2 style={{ width: 14, height: 14, color: '#94a3b8', animation: 'fin-spin 1s linear infinite' }} />
              : <Send style={{ width: 14, height: 14, color: (!input.trim() || loading) ? '#94a3b8' : 'white' }} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fin-bounce {
          0%,80%,100%{transform:translateY(0);opacity:.4}
          40%{transform:translateY(-5px);opacity:1}
        }
        @keyframes fin-spin {
          from{transform:rotate(0deg)}
          to{transform:rotate(360deg)}
        }
      `}</style>
    </>
  );
}
