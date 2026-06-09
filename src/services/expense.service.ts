import { supabase } from '@/lib/supabase';
import type { Expense, ExpenseFormData, DateRange, CategoryData } from '@/types';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/types';

function toMessage(e: unknown): string {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (obj.message) return String(obj.message);
    if (obj.details) return String(obj.details);
  }
  return 'An unexpected error occurred';
}

export const expenseService = {
  async getAll(
    familyId: string,
    filters?: { dateRange?: DateRange; category?: string; userId?: string; isShared?: boolean; search?: string }
  ): Promise<Expense[]> {
    // No profile join — avoids schema cache errors
    let query = supabase
      .from('expenses')
      .select('*')
      .eq('family_id', familyId)
      .order('date', { ascending: false });

    if (filters?.dateRange) {
      query = query.gte('date', filters.dateRange.from).lte('date', filters.dateRange.to);
    }
    if (filters?.category) query = query.eq('category', filters.category);
    if (filters?.userId) query = query.eq('paid_by', filters.userId);
    if (filters?.isShared !== undefined) query = query.eq('is_shared', filters.isShared);
    if (filters?.search) query = query.ilike('description', `%${filters.search}%`);

    const { data, error } = await query;
    if (error) throw new Error(toMessage(error));
    return data || [];
  },

  async getById(id: string): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses').select('*').eq('id', id).single();
    if (error) throw new Error(toMessage(error));
    return data;
  },

  async create(familyId: string, userId: string, formData: ExpenseFormData): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...formData, family_id: familyId, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(toMessage(error));
    return data;
  },

  async update(id: string, formData: Partial<ExpenseFormData>): Promise<Expense> {
    const { data, error } = await supabase
      .from('expenses').update(formData).eq('id', id).select().single();
    if (error) throw new Error(toMessage(error));
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(toMessage(error));
  },

  async getTotalByDateRange(familyId: string, from: string, to: string): Promise<number> {
    const { data, error } = await supabase
      .from('expenses').select('amount')
      .eq('family_id', familyId).gte('date', from).lte('date', to);
    if (error) throw new Error(toMessage(error));
    return (data || []).reduce((sum, row) => sum + Number(row.amount), 0);
  },

  async getCategoryBreakdown(familyId: string, from: string, to: string): Promise<CategoryData[]> {
    const { data, error } = await supabase
      .from('expenses').select('category, amount')
      .eq('family_id', familyId).gte('date', from).lte('date', to);
    if (error) throw new Error(toMessage(error));

    const categoryMap: Record<string, number> = {};
    let total = 0;
    (data || []).forEach(row => {
      categoryMap[row.category] = (categoryMap[row.category] || 0) + Number(row.amount);
      total += Number(row.amount);
    });

    return Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category, amount,
        percentage: total > 0 ? Math.round((amount / total) * 100 * 10) / 10 : 0,
        color: CATEGORY_COLORS[category] || '#64748b',
        icon: CATEGORY_ICONS[category] || '📦',
      }))
      .sort((a, b) => b.amount - a.amount);
  },

  async getMonthlyTotals(familyId: string, months = 12): Promise<{ month: string; total: number }[]> {
    const from = new Date();
    from.setMonth(from.getMonth() - months + 1);
    from.setDate(1);

    const { data, error } = await supabase
      .from('expenses').select('amount, date')
      .eq('family_id', familyId)
      .gte('date', from.toISOString().split('T')[0])
      .order('date', { ascending: true });
    if (error) throw new Error(toMessage(error));

    const monthlyMap: Record<string, number> = {};
    (data || []).forEach(row => {
      const key = row.date.slice(0, 7);
      monthlyMap[key] = (monthlyMap[key] || 0) + Number(row.amount);
    });
    return Object.entries(monthlyMap).map(([month, total]) => ({ month, total }));
  },

  async getByUser(familyId: string, from: string, to: string): Promise<{ userId: string; total: number }[]> {
    const { data, error } = await supabase
      .from('expenses').select('paid_by, amount')
      .eq('family_id', familyId).gte('date', from).lte('date', to);
    if (error) throw new Error(toMessage(error));

    const userMap: Record<string, number> = {};
    (data || []).forEach(row => {
      if (row.paid_by) userMap[row.paid_by] = (userMap[row.paid_by] || 0) + Number(row.amount);
    });
    return Object.entries(userMap).map(([userId, total]) => ({ userId, total }));
  },
};
