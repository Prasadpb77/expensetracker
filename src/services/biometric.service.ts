import { supabase } from '@/lib/supabase';

function toMessage(e: unknown): string {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    if (obj.message) return String(obj.message);
  }
  return 'Unknown error occurred';
}

export interface StoredCredential {
  id: string;
  credential_id: string;
  public_key: string;
  device_name: string;
  created_at: string;
  last_used_at?: string;
}

export const biometricService = {
  async getCredentials(userId: string): Promise<StoredCredential[]> {
    const { data, error } = await supabase
      .from('biometric_credentials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(toMessage(error));
    return data || [];
  },

  async saveCredential(
    userId: string,
    credentialId: string,
    publicKey: string,
    deviceName: string
  ): Promise<void> {
    const { error } = await supabase
      .from('biometric_credentials')
      .insert({ user_id: userId, credential_id: credentialId, public_key: publicKey, device_name: deviceName });
    if (error) throw new Error(toMessage(error));
  },

  async updateLastUsed(credentialId: string): Promise<void> {
    await supabase
      .from('biometric_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('credential_id', credentialId);
  },

  async deleteCredential(id: string): Promise<void> {
    const { error } = await supabase
      .from('biometric_credentials')
      .delete()
      .eq('id', id);
    if (error) throw new Error(toMessage(error));
  },

  // Store credential ID in localStorage for quick lookup on login screen
  saveLocalCredential(credentialId: string, userEmail: string): void {
    localStorage.setItem('ff_credential_id', credentialId);
    localStorage.setItem('ff_credential_email', userEmail);
  },

  getLocalCredential(): { credentialId: string; email: string } | null {
    const credentialId = localStorage.getItem('ff_credential_id');
    const email = localStorage.getItem('ff_credential_email');
    if (!credentialId || !email) return null;
    return { credentialId, email };
  },

  clearLocalCredential(): void {
    localStorage.removeItem('ff_credential_id');
    localStorage.removeItem('ff_credential_email');
  },
};
