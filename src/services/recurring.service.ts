import { supabase } from '@/lib/supabase';
import { addDays, addWeeks, addMonths, addYears, format, parseISO, isToday, isBefore, isAfter } from 'date-fns';

function toMessage(e: unknown): string {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (obj.message) return String(obj.message);
  }
  return 'An error occurred';
}

export interface RecurringTransaction {
  id: string;
  family_id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  source?: string;
  category?: string;
  payment_method?: string;
  paid_by?: string;
  is_shared: boolean;
  split_ratio: number;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  next_due_date: string;
  end_date?: string;
  is_active: boolean;
  auto_add: boolean;
  notes?: string;
  last_added_date?: string;
  created_at: string;
  updated_at: string;
}

export interface RecurringFormData {
  type: 'income' | 'expense';
  amount: number;
  source?: string;
  category?: string;
  payment_method?: string;
  paid_by?: string;
  is_shared: boolean;
  split_ratio: number;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date?: string;
  auto_add: boolean;
  notes?: string;
}

function getNextDueDate(currentDate: string, frequency: string): string {
  const date = parseISO(currentDate);
  let next: Date;
  switch (frequency) {
    case 'daily':   next = addDays(date, 1); break;
    case 'weekly':  next = addWeeks(date, 1); break;
    case 'monthly': next = addMonths(date, 1); break;
    case 'yearly':  next = addYears(date, 1); break;
    default:        next = addMonths(date, 1);
  }
  return format(next, 'yyyy-MM-dd');
}

export const recurringService = {
  async getAll(familyId: string): Promise<RecurringTransaction[]> {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('family_id', familyId)
      .order('next_due_date', { ascending: true });
    if (error) throw new Error(toMessage(error));
    return data || [];
  },

  async create(familyId: string, userId: string, formData: RecurringFormData): Promise<RecurringTransaction> {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .insert({
        ...formData,
        family_id: familyId,
        user_id: userId,
        next_due_date: formData.start_date,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw new Error(toMessage(error));
    return data;
  },

  async update(id: string, updates: Partial<RecurringFormData>): Promise<RecurringTransaction> {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(toMessage(error));
    return data;
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('recurring_transactions')
      .update({ is_active: isActive })
      .eq('id', id);
    if (error) throw new Error(toMessage(error));
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
    if (error) throw new Error(toMessage(error));
  },

  // Add a transaction now (manual or auto)
  async addNow(recurring: RecurringTransaction, familyId: string): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd');

    if (recurring.type === 'income') {
      const { error } = await supabase.from('income').insert({
        family_id: familyId,
        user_id: recurring.user_id,
        amount: recurring.amount,
        source: recurring.source || 'Salary',
        description: recurring.description,
        date: today,
        notes: recurring.notes,
      });
      if (error) throw new Error(toMessage(error));
    } else {
      const { error } = await supabase.from('expenses').insert({
        family_id: familyId,
        user_id: recurring.user_id,
        amount: recurring.amount,
        category: recurring.category || 'Miscellaneous',
        description: recurring.description,
        date: today,
        paid_by: recurring.paid_by || recurring.user_id,
        payment_method: recurring.payment_method || 'personal',
        is_shared: recurring.is_shared,
        split_ratio: recurring.split_ratio,
        notes: recurring.notes,
      });
      if (error) throw new Error(toMessage(error));
    }

    // Advance next_due_date
    const nextDue = getNextDueDate(recurring.next_due_date, recurring.frequency);
    await supabase
      .from('recurring_transactions')
      .update({ next_due_date: nextDue, last_added_date: today })
      .eq('id', recurring.id);
  },

  // Check and auto-add any due transactions
  async processAutoAdd(familyId: string): Promise<number> {
    const all = await this.getAll(familyId);
    const today = format(new Date(), 'yyyy-MM-dd');
    let added = 0;

    for (const tx of all) {
      if (!tx.is_active || !tx.auto_add) continue;
      if (tx.end_date && isAfter(parseISO(today), parseISO(tx.end_date))) continue;
      if (isBefore(parseISO(tx.next_due_date), parseISO(today)) || isToday(parseISO(tx.next_due_date))) {
        // Skip if already added today
        if (tx.last_added_date === today) continue;
        try {
          await this.addNow(tx, familyId);
          added++;
        } catch (e) {
          console.error('Failed to auto-add recurring:', tx.description, e);
        }
      }
    }
    return added;
  },

  getDueStatus(nextDue: string): 'overdue' | 'due-today' | 'upcoming' | 'future' {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (nextDue < today) return 'overdue';
    if (nextDue === today) return 'due-today';
    const week = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    if (nextDue <= week) return 'upcoming';
    return 'future';
  },
};
