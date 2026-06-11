import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Trash2, Sparkles } from 'lucide-react';
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
import { cn } from '@/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: ActionChip[];
  status?: 'pending' | 'done' | 'error';
}

interface ActionChip {
  label: string;
  value: string;
  style?: 'primary' | 'success' | 'danger' | 'default';
}

// ── System prompt builder ──────────────────────────────────────────────────────
function buildSystemPrompt(context: {
  userName: string;
  spouseName: string;
  familyName: string;
  currentDate: string;
  familyMembers: { id: string; display_name: string }[];
  currency: string;
}) {
  return `You are Fin, a friendly and concise AI financial assistant for the FamilyFinance app used by ${context.familyName} (${context.userName} and ${context.spouseName}).

TODAY: ${context.currentDate}
CURRENCY: ${context.currency} (₹)
FAMILY MEMBERS: ${context.familyMembers.map(m => `${m.display_name} (id: ${m.id})`).join(', ')}

EXPENSE CATEGORIES: ${EXPENSE_CATEGORIES.join(', ')}
INCOME SOURCES: ${INCOME_SOURCES.join(', ')}
PAYMENT METHODS: personal (cash/UPI), joint_account, credit_card

YOUR JOB:
1. Add expenses, income, budgets, recurring transactions by chatting naturally
2. Answer questions about spending, income, savings
3. Give smart financial insights and tips

ACTIONS — when you need to perform an action, include a JSON block in your response like this:
\`\`\`action
{
  "type": "add_expense" | "add_income" | "add_budget" | "add_recurring" | "show_insights",
  "data": { ... }
}
\`\`\`

For add_expense data fields:
{ amount, category, description, date (YYYY-MM-DD), paid_by (member id or "unknown"), payment_method, is_shared, notes }

For add_income data fields:
{ amount, source, description, date (YYYY-MM-DD), notes }

For add_budget data fields:
{ category, monthly_limit, month (1-12), year }

For add_recurring data fields:
{ type ("income"|"expense"), amount, description, source_or_category, frequency ("daily"|"weekly"|"monthly"|"yearly"), start_date, auto_add (true/false) }

CONVERSATION STYLE:
- Be concise, warm, friendly — like a helpful family friend who knows finance
- When info is missing (like who paid), ASK before creating
- Confirm before adding: show a summary and ask "Shall I add this?"
- After confirming, output the action block
- For insights questions, answer directly with numbers from context provided
- Use ₹ for amounts, keep responses short
- Never make up data — only use what's provided in context messages

IMPORTANT: If user says "yes", "ok", "confirm", "add it", "go ahead" etc after you showed a summary, output the action block immediately.`;
}

// ── Parse action from assistant response ──────────────────────────────────────
function parseAction(content: string): { type: string; data: Record<string, unknown> } | null {
  const match = content.match(/```action\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// ── Clean content (remove action blocks for display) ──────────────────────────
function cleanContent(content: string): string {
  return content.replace(/```action\n[\s\S]*?\n```/g, '').trim();
}

// ── Quick prompts ──────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: '💸', label: 'Add expense', prompt: 'I want to add an expense' },
  { icon: '💰', label: 'Add income', prompt: 'Add my salary for this month' },
  { icon: '📊', label: 'This month', prompt: 'What is my total expense this month?' },
  { icon: '💡', label: 'Insights', prompt: 'Give me financial insights for this month' },
  { icon: '🎯', label: 'Set budget', prompt: 'Help me set a budget for Food this month' },
  { icon: '🔁', label: 'Recurring', prompt: 'Add house rent as a monthly recurring expense' },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export function AssistantPage() {
  const { profile, family, familyMembers } = useAppStore();
  const { user } = useAuth();
  const addToast = useStableToast();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Hi ${profile?.display_name || 'there'}! 👋 I'm **Fin**, your financial assistant.\n\nI can help you:\n• Add expenses, income, budgets\n• Set up recurring transactions\n• Answer questions about your spending\n• Give you financial insights\n\nWhat would you like to do today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; data: Record<string, unknown> } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Build financial context for the AI ──────────────────────────────────────
  const buildContext = useCallback(async (): Promise<string> => {
    if (!profile?.family_id) return '';
    const familyId = profile.family_id;
    const currentMonth = getCurrentMonth();
    const last3 = getLastNMonths(3);

    try {
      const [expenses, incomes, budgets] = await Promise.all([
        expenseService.getAll(familyId, { dateRange: currentMonth }),
        incomeService.getAll(familyId, { dateRange: currentMonth }),
        budgetService.getAll(familyId, new Date().getMonth() + 1, new Date().getFullYear()),
      ]);

      const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
      const totalIncome = incomes.reduce((s, e) => s + Number(e.amount), 0);
      const savings = totalIncome - totalExpenses;
      const savingsRate = calculateSavingsRate(totalIncome, totalExpenses);

      // Category breakdown
      const catMap: Record<string, number> = {};
      expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount); });
      const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

      // Budget status
      const budgetStatus = budgets.map(b => {
        const spent = catMap[b.category] || 0;
        const pct = b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
        return `${b.category}: ₹${spent} / ₹${b.monthly_limit} (${pct}%)`;
      });

      return `
CURRENT MONTH CONTEXT (${format(new Date(), 'MMMM yyyy')}):
- Total Income: ₹${totalIncome.toFixed(0)}
- Total Expenses: ₹${totalExpenses.toFixed(0)}
- Savings: ₹${savings.toFixed(0)}
- Savings Rate: ${savingsRate}%
- Recent Expenses (last 5): ${expenses.slice(0, 5).map(e => `${e.description} ₹${e.amount} (${e.category})`).join(', ')}
- Top Spending Categories: ${topCats.map(([c, a]) => `${c} ₹${a.toFixed(0)}`).join(', ')}
- Budget Status: ${budgetStatus.length > 0 ? budgetStatus.join(' | ') : 'No budgets set'}
- Family Members: ${familyMembers.map(m => `${m.display_name} (${m.id})`).join(', ')}
- Logged in user: ${profile.display_name} (${user?.id})
`;
    } catch {
      return '';
    }
  }, [profile, familyMembers, user]);

  // ── Execute action returned by AI ────────────────────────────────────────────
  const executeAction = useCallback(async (action: { type: string; data: Record<string, unknown> }): Promise<string> => {
    if (!profile?.family_id || !user) return 'Not authenticated';
    const familyId = profile.family_id;
    const today = format(new Date(), 'yyyy-MM-dd');

    try {
      switch (action.type) {
        case 'add_expense': {
          const d = action.data;
          const paidBy = String(d.paid_by || user.id);
          // Validate paid_by is a real member ID
          const validPaidBy = familyMembers.some(m => m.id === paidBy) ? paidBy : user.id;
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
          return `✅ Expense added: **${d.description}** — ${formatCurrency(Number(d.amount))} in ${d.category}`;
        }

        case 'add_income': {
          const d = action.data;
          await incomeService.create(familyId, user.id, {
            amount: Number(d.amount),
            source: (d.source as 'Salary' | 'Bonus' | 'Freelance' | 'Interest' | 'Rental' | 'Other') || 'Other',
            description: d.description ? String(d.description) : undefined,
            date: String(d.date || today),
            notes: d.notes ? String(d.notes) : undefined,
          });
          return `✅ Income added: **${d.source}** — ${formatCurrency(Number(d.amount))}`;
        }

        case 'add_budget': {
          const d = action.data;
          const month = Number(d.month || new Date().getMonth() + 1);
          const year = Number(d.year || new Date().getFullYear());
          await budgetService.create(familyId, user.id, {
            category: String(d.category),
            monthly_limit: Number(d.monthly_limit),
            month,
            year,
          });
          return `✅ Budget set: **${d.category}** — ${formatCurrency(Number(d.monthly_limit))} / month`;
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
            frequency: (d.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'monthly',
            start_date: String(d.start_date || today),
            auto_add: Boolean(d.auto_add !== false),
          });
          return `✅ Recurring ${d.type} set: **${d.description}** — ${formatCurrency(Number(d.amount))} every ${d.frequency}`;
        }

        default:
          return 'Action type not recognised';
      }
    } catch (e) {
      return `❌ Failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }, [profile, user, familyMembers]);

  // ── Send message ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Placeholder assistant message
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'pending',
    }]);

    try {
      // Build conversation history for Claude
      const contextData = await buildContext();
      const history = messages
        .filter(m => m.status !== 'pending')
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      // System prompt
      const systemPrompt = buildSystemPrompt({
        userName: profile?.display_name || 'User',
        spouseName: familyMembers.find(m => m.id !== user?.id)?.display_name || 'Spouse',
        familyName: family?.name || 'Your Family',
        currentDate: format(new Date(), 'EEEE, dd MMMM yyyy'),
        familyMembers: familyMembers.map(m => ({ id: m.id, display_name: m.display_name })),
        currency: 'INR',
      });

      // Call Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt + (contextData ? `\n\nLIVE DATA:\n${contextData}` : ''),
          messages: [
            ...history,
            { role: 'user', content: text.trim() },
          ],
        }),
      });

      const result = await response.json();
      const assistantText: string = result.content?.[0]?.text || 'Sorry, I couldn\'t process that.';

      // Check for action block
      const action = parseAction(assistantText);
      const displayText = cleanContent(assistantText);

      if (action) {
        setPendingAction(action);
        // Execute the action
        const actionResult = await executeAction(action);
        addToast({ type: actionResult.startsWith('✅') ? 'success' : 'error', title: actionResult.replace(/\*\*/g, '') });

        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: displayText + (displayText ? '\n\n' : '') + actionResult, status: 'done' }
            : m
        ));
        setPendingAction(null);
      } else {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: displayText, status: 'done' }
            : m
        ));
      }
    } catch (e) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Sorry, something went wrong. Please try again.', status: 'error' }
          : m
      ));
      console.error('Assistant error:', e);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, buildContext, executeAction, profile, family, familyMembers, user, addToast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: `Chat cleared! How can I help you, ${profile?.display_name || 'there'}?`,
      timestamp: new Date(),
    }]);
    setPendingAction(null);
  };

  // ── Render message content with markdown-like formatting ─────────────────────
  const renderContent = (content: string) => {
    if (!content) return null;
    const parts = content.split('\n');
    return parts.map((line, i) => {
      // Bold: **text**
      const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Bullet
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return <li key={i} style={{ marginLeft: '1rem', listStyle: 'disc' }}
          dangerouslySetInnerHTML={{ __html: formatted.replace(/^[•-] /, '') }} />;
      }
      if (line === '') return <br key={i} />;
      return <p key={i} style={{ margin: '2px 0' }} dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #0284c7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles style={{ width: 20, height: 20, color: 'white' }} />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-surface-900 dark:text-surface-100">Fin Assistant</h2>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>AI-powered financial assistant</p>
          </div>
        </div>
        <button onClick={clearChat}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.4rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b' }}
          className="dark:bg-surface-800 dark:border-surface-700 dark:text-surface-400 hover:bg-surface-50">
          <Trash2 style={{ width: 13, height: 13 }} />
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1" style={{ scrollbarWidth: 'thin' }}>

        {/* Quick prompts — show only at start */}
        {messages.length === 1 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick actions</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {QUICK_PROMPTS.map(q => (
                <button key={q.label} onClick={() => sendMessage(q.prompt)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.75rem', borderRadius: 20, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.8rem', color: '#374151', transition: 'all 0.15s' }}
                  className="dark:bg-surface-800 dark:border-surface-700 dark:text-surface-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                  <span>{q.icon}</span>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: '0.75rem', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
            {/* Avatar */}
            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: msg.role === 'assistant' ? 'linear-gradient(135deg, #0284c7, #7c3aed)' : '#0f172a' }}>
              {msg.role === 'assistant'
                ? <Bot style={{ width: 16, height: 16, color: 'white' }} />
                : <User style={{ width: 16, height: 16, color: 'white' }} />}
            </div>

            {/* Bubble */}
            <div style={{ maxWidth: '80%' }}>
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                background: msg.role === 'user' ? '#0284c7' : 'white',
                color: msg.role === 'user' ? 'white' : '#1e293b',
                border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
              className={msg.role === 'assistant' ? 'dark:bg-surface-800 dark:border-surface-700 dark:text-surface-100' : ''}>
                {msg.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '0.25rem 0' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8',
                        animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                ) : (
                  <div>{renderContent(msg.content)}</div>
                )}
              </div>
              <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: '3px 0 0', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                {format(msg.timestamp, 'HH:mm')}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, marginTop: '0.75rem', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 -2px 12px rgba(0,0,0,0.06)', padding: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}
        className="dark:bg-surface-800 dark:border-surface-700">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add expense 500 in food, What's my savings this month?..."
          rows={1}
          disabled={loading}
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent',
            fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.5,
            maxHeight: '120px', overflowY: 'auto',
          }}
          className="dark:text-surface-100 placeholder:text-surface-400"
          onInput={e => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = 'auto';
            t.style.height = Math.min(t.scrollHeight, 120) + 'px';
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          style={{
            width: 38, height: 38, borderRadius: 10, border: 'none', flexShrink: 0,
            background: (!input.trim() || loading) ? '#e2e8f0' : 'linear-gradient(135deg, #0284c7, #7c3aed)',
            cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}>
          {loading
            ? <Loader2 style={{ width: 16, height: 16, color: '#94a3b8', animation: 'spin 1s linear infinite' }} />
            : <Send style={{ width: 16, height: 16, color: (!input.trim() || loading) ? '#94a3b8' : 'white' }} />}
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
