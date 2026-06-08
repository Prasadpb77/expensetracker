import { supabase } from '@/lib/supabase';
import type { Profile, Family } from '@/types';

export const profileService = {
  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getFamilyMembers(familyId: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('family_id', familyId);
    if (error) throw error;
    return data || [];
  },

  async createFamily(name: string, userId: string): Promise<Family> {
    const { data, error } = await supabase
      .from('families')
      .insert({ name, created_by: userId })
      .select()
      .single();
    if (error) throw error;

    // Update user profile with family_id and role
    await supabase
      .from('profiles')
      .update({ family_id: data.id, role: 'primary' })
      .eq('id', userId);

    return data;
  },

  async joinFamily(inviteCode: string, userId: string): Promise<Family> {
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('*')
      .eq('invite_code', inviteCode)
      .single();

    if (familyError || !family) throw new Error('Invalid invite code');

    const { error } = await supabase
      .from('profiles')
      .update({ family_id: family.id, role: 'spouse' })
      .eq('id', userId);

    if (error) throw error;
    return family;
  },

  async getFamily(familyId: string): Promise<Family> {
    const { data, error } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateFamily(familyId: string, updates: Partial<Family>): Promise<Family> {
    const { data, error } = await supabase
      .from('families')
      .update(updates)
      .eq('id', familyId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
