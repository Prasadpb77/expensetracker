import { supabase } from '@/lib/supabase';
import type { Goal, GoalFormData, GoalContribution, ContributionFormData } from '@/types';

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

export const goalsService = {
  async getAll(familyId: string): Promise<Goal[]> {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(toMessage(error));
    return data || [];
  },

  async create(familyId: string, userId: string, formData: GoalFormData): Promise<Goal> {
    const { data, error } = await supabase
      .from('goals')
      .insert({ ...formData, family_id: familyId, created_by: userId, saved_amount: 0 })
      .select()
      .single();
    if (error) throw new Error(toMessage(error));
    return data;
  },

  async update(id: string, updates: Partial<GoalFormData>): Promise<Goal> {
    const { data, error } = await supabase
      .from('goals').update(updates).eq('id', id).select().single();
    if (error) throw new Error(toMessage(error));
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) throw new Error(toMessage(error));
  },

  async addContribution(
    goalId: string,
    familyId: string,
    userId: string,
    data: ContributionFormData
  ): Promise<GoalContribution> {
    const { data: contribution, error } = await supabase
      .from('goal_contributions')
      .insert({ ...data, goal_id: goalId, family_id: familyId, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(toMessage(error));
    return contribution;
  },

  async getContributions(goalId: string): Promise<GoalContribution[]> {
    const { data, error } = await supabase
      .from('goal_contributions')
      .select('*')
      .eq('goal_id', goalId)
      .order('date', { ascending: false });
    if (error) throw new Error(toMessage(error));
    return data || [];
  },

  async deleteContribution(id: string, goalId: string, amount: number): Promise<void> {
    const { error } = await supabase
      .from('goal_contributions').delete().eq('id', id);
    if (error) throw new Error(toMessage(error));
    // Manually update saved_amount (trigger handles this but as fallback)
    await supabase.rpc('update_goal_saved_amount').catch(() => null);
    // Refetch goal to sync
    const { data: goal } = await supabase.from('goals').select('saved_amount').eq('id', goalId).single();
    if (goal) {
      const newAmount = Math.max(0, Number(goal.saved_amount) - amount);
      await supabase.from('goals').update({
        saved_amount: newAmount,
        is_completed: newAmount >= goal.saved_amount
      }).eq('id', goalId);
    }
  },
};
