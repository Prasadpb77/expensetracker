import { supabase } from '@/lib/supabase';
import type { Profile, Family } from '@/types';

// Extract a readable message from any error type (Supabase PostgrestError, Error, string, etc.)
function toMessage(e: unknown): string {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    // Supabase PostgrestError shape
    if (obj.message) return String(obj.message);
    if (obj.details) return String(obj.details);
    if (obj.hint) return String(obj.hint);
    if (obj.error_description) return String(obj.error_description);
  }
  return 'Unknown error occurred';
}

function throwReadable(e: unknown, fallback: string): never {
  throw new Error(toMessage(e) || fallback);
}

export const profileService = {
  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throwReadable(error, 'Failed to load profile');
    return data;
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throwReadable(error, 'Failed to update profile');
    return data;
  },

  async getFamilyMembers(familyId: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('family_id', familyId);
    if (error) throwReadable(error, 'Failed to load family members');
    return data || [];
  },

  async createFamily(name: string, userId: string): Promise<Family> {
    // Step 1: Insert family
    const { data: family, error: insertError } = await supabase
      .from('families')
      .insert({ name, created_by: userId })
      .select()
      .single();

    if (insertError) throwReadable(insertError, 'Failed to create family');

    // Step 2: Link user profile to family
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ family_id: family.id, role: 'primary' })
      .eq('id', userId);

    if (updateError) throwReadable(updateError, 'Family created but failed to link your profile');

    return family;
  },

  async joinFamily(inviteCode: string, userId: string): Promise<Family> {
    // Step 1: Look up family by invite code
    const { data: family, error: lookupError } = await supabase
      .from('families')
      .select('*')
      .eq('invite_code', inviteCode.trim())
      .single();

    if (lookupError || !family) {
      throw new Error('Invalid invite code. Please check and try again.');
    }

    // Step 2: Link user to that family
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ family_id: family.id, role: 'spouse' })
      .eq('id', userId);

    if (updateError) throwReadable(updateError, 'Found family but failed to join it');

    return family;
  },

  async getFamily(familyId: string): Promise<Family> {
    const { data, error } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .single();
    if (error) throwReadable(error, 'Failed to load family');
    return data;
  },

  async updateFamily(familyId: string, updates: Partial<Family>): Promise<Family> {
    const { data, error } = await supabase
      .from('families')
      .update(updates)
      .eq('id', familyId)
      .select()
      .single();
    if (error) throwReadable(error, 'Failed to update family');
    return data;
  },
};
