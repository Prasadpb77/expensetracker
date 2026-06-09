import { supabase } from '@/lib/supabase';
import type { Budget, BudgetFormData } from '@/types';

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

export const budgetService = {
  async getAll(familyId: string, month: number, year: number): Promise<Budget[]> {
    const { data, error } = await supabase
      .from('budgets').select('*').eq('family_id', familyId)
      .eq('month', month).eq('year', year).order('category', { ascending: true });
    if (error) throw new Error(toMessage(error));
    return data || [];
  },

  async getById(id: string): Promise<Budget> {
    const { data, error } = await supabase.from('budgets').select('*').eq('id', id).single();
    if (error) throw new Error(toMessage(error));
    return data;
  },

  async create(familyId: string, userId: string, formData: BudgetFormData): Promise<Budget> {
    const { data, error } = await supabase
      .from('budgets')
      .insert({ ...formData, family_id: familyId, created_by: userId })
      .select().single();
    if (error) throw new Error(toMessage(error));
    return data;
  },

  async update(id: string, formData: Partial<BudgetFormData>): Promise<Budget> {
    const { data, error } = await supabase
      .from('budgets').update(formData).eq('id', id).select().single();
    if (error) throw new Error(toMessage(error));
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) throw new Error(toMessage(error));
  },

  async getBudgetsWithSpent(familyId: string, month: number, year: number): Promise<Budget[]> {
    const budgets = await this.getAll(familyId, month, year);

    const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const { data: expenses, error } = await supabase
      .from('expenses').select('category, amount').eq('family_id', familyId)
      .gte('date', fromDate).lte('date', toDate);
    if (error) throw new Error(toMessage(error));

    const spentByCategory: Record<string, number> = {};
    (expenses || []).forEach(exp => {
      spentByCategory[exp.category] = (spentByCategory[exp.category] || 0) + Number(exp.amount);
    });

    return budgets.map(budget => {
      const spent = spentByCategory[budget.category] || 0;
      const percentage = budget.monthly_limit > 0
        ? Math.round((spent / budget.monthly_limit) * 100 * 10) / 10 : 0;
      const remaining = budget.monthly_limit - spent;
      const status: Budget['status'] = percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'good';
      return { ...budget, spent, percentage, remaining, status };
    });
  },
};
