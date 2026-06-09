import { supabase } from '@/lib/supabase';
import type { Profile, Family } from '@/types';

function toMessage(e: unknown): string {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (obj.message) return String(obj.message);
    if (obj.details) return String(obj.details);
    if (obj.hint) return String(obj.hint);
  }
  return 'Unknown error occurred';
}

function throwReadable(e: unknown, fallback: string): never {
  throw new Error(toMessage(e) || fallback);
}

export const profileService = {
  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', userId).single();
    if (error) throwReadable(error, 'Failed to load profile');
    return data;
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles').update(updates).eq('id', userId).select().single();
    if (error) throwReadable(error, 'Failed to update profile');
    return data;
  },

  async getFamilyMembers(familyId: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('family_id', familyId);
    if (error) throwReadable(error, 'Failed to load family members');
    return data || [];
  },

  async createFamily(name: string, userId: string): Promise<Family> {
    const { data: family, error: insertError } = await supabase
      .from('families')
      .insert({ name, created_by: userId })
      .select()
      .single();
    if (insertError) throwReadable(insertError, 'Failed to create family');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ family_id: family.id, role: 'primary' })
      .eq('id', userId);
    if (updateError) throwReadable(updateError, 'Family created but failed to link your profile');

    return family;
  },

  async joinFamily(inviteCode: string, userId: string): Promise<Family> {
    const code = inviteCode.trim().toLowerCase();

    // Fetch all families the user can see (RLS allows this with families_select_for_join policy)
    // Filter by invite_code client-side to avoid 406 from .single() when no match
    const { data: families, error: lookupError } = await supabase
      .from('families')
      .select('*')
      .eq('invite_code', code);

    if (lookupError) throwReadable(lookupError, 'Failed to look up family');

    if (!families || families.length === 0) {
      // Try uppercase too — invite codes are hex, case-insensitive
      const { data: familiesUpper } = await supabase
        .from('families')
        .select('*')
        .eq('invite_code', inviteCode.trim().toUpperCase());

      if (!familiesUpper || familiesUpper.length === 0) {
        throw new Error('Invalid invite code. Please check the code and try again.');
      }
      families?.push(...(familiesUpper || []));
    }

    const family = families[0];

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ family_id: family.id, role: 'spouse' })
      .eq('id', userId);
    if (updateError) throwReadable(updateError, 'Found family but failed to join it');

    return family;
  },

  async getFamily(familyId: string): Promise<Family> {
    const { data, error } = await supabase
      .from('families').select('*').eq('id', familyId).single();
    if (error) throwReadable(error, 'Failed to load family');
    return data;
  },

  async updateFamily(familyId: string, updates: Partial<Family>): Promise<Family> {
    const { data, error } = await supabase
      .from('families').update(updates).eq('id', familyId).select().single();
    if (error) throwReadable(error, 'Failed to update family');
    return data;
  },
};
