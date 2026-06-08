import { supabase } from '@/lib/supabase';
import type { Income, IncomeFormData, DateRange } from '@/types';

export const incomeService = {
  async getAll(
    familyId: string,
    filters?: { dateRange?: DateRange; source?: string; userId?: string }
  ): Promise<Income[]> {
    let query = supabase
      .from('income')
      .select(`
        *,
        profile:profiles!income_user_id_fkey(id, display_name, full_name)
      `)
      .eq('family_id', familyId)
      .order('date', { ascending: false });

    if (filters?.dateRange) {
      query = query
        .gte('date', filters.dateRange.from)
        .lte('date', filters.dateRange.to);
    }

    if (filters?.source) {
      query = query.eq('source', filters.source);
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<Income> {
    const { data, error } = await supabase
      .from('income')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(
    familyId: string,
    userId: string,
    formData: IncomeFormData
  ): Promise<Income> {
    const { data, error } = await supabase
      .from('income')
      .insert({
        ...formData,
        family_id: familyId,
        user_id: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, formData: Partial<IncomeFormData>): Promise<Income> {
    const { data, error } = await supabase
      .from('income')
      .update(formData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('income').delete().eq('id', id);
    if (error) throw error;
  },

  async getTotalByDateRange(familyId: string, from: string, to: string): Promise<number> {
    const { data, error } = await supabase
      .from('income')
      .select('amount')
      .eq('family_id', familyId)
      .gte('date', from)
      .lte('date', to);

    if (error) throw error;
    return (data || []).reduce((sum, row) => sum + Number(row.amount), 0);
  },

  async getMonthlyTotals(
    familyId: string,
    months: number = 12
  ): Promise<{ month: string; total: number }[]> {
    const from = new Date();
    from.setMonth(from.getMonth() - months + 1);
    from.setDate(1);

    const { data, error } = await supabase
      .from('income')
      .select('amount, date')
      .eq('family_id', familyId)
      .gte('date', from.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    const monthlyMap: Record<string, number> = {};
    (data || []).forEach(row => {
      const monthKey = row.date.slice(0, 7); // YYYY-MM
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + Number(row.amount);
    });

    return Object.entries(monthlyMap).map(([month, total]) => ({ month, total }));
  },
};
