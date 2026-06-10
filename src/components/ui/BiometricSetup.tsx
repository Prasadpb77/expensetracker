import { useState, useEffect } from 'react';
import { Fingerprint, Smartphone, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/contexts/store';
import { biometricService, type StoredCredential } from '@/services/biometric.service';
import { isBiometricAvailable, registerBiometric } from '@/lib/webauthn';
import { format } from 'date-fns';

export function BiometricSetup() {
  const { user } = useAuth();
  const { profile, addToast } = useAppStore();

  const [available, setAvailable] = useState(false);
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [deviceName, setDeviceName] = useState(() => {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android Phone';
    if (/Mac/.test(ua)) return 'MacBook';
    if (/Windows/.test(ua)) return 'Windows PC';
    return 'My Device';
  });

  useEffect(() => {
    isBiometricAvailable().then(setAvailable);
    if (user) loadCredentials();
  }, [user]);

  const loadCredentials = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await biometricService.getCredentials(user.id);
      setCredentials(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!user || !profile) return;
    setRegistering(true);
    try {
      const { credentialId, publicKey } = await registerBiometric({
        userId: user.id,
        userEmail: profile.email,
        displayName: profile.display_name || profile.full_name,
      });

      await biometricService.saveCredential(user.id, credentialId, publicKey, deviceName);
      biometricService.saveLocalCredential(credentialId, profile.email);

      addToast({ type: 'success', title: '🔐 Biometric login enabled!', message: 'You can now sign in with Face ID / fingerprint.' });
      loadCredentials();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('cancelled')) {
        addToast({ type: 'warning', title: 'Setup cancelled', message: 'Biometric setup was cancelled.' });
      } else {
        addToast({ type: 'error', title: 'Setup failed', message: msg });
      }
    } finally { setRegistering(false); }
  };

  const handleDelete = async (cred: StoredCredential) => {
    try {
      await biometricService.deleteCredential(cred.id);
      // Clear local storage if this was the active credential
      const local = biometricService.getLocalCredential();
      if (local?.credentialId === cred.credential_id) {
        biometricService.clearLocalCredential();
      }
      addToast({ type: 'success', title: 'Biometric removed' });
      loadCredentials();
    } catch {
      addToast({ type: 'error', title: 'Failed to remove biometric' });
    }
  };

  const cardCls = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6';
  const inputCls = 'flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className={cardCls}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }} className="text-gray-900 dark:text-gray-100">
          Biometric Login
        </h3>
        <Fingerprint style={{ width: 18, height: 18 }} className="text-gray-400" />
      </div>

      {!available ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <AlertCircle style={{ width: 18, height: 18, color: '#ea580c', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#9a3412', margin: 0 }}>Not available on this device</p>
            <p style={{ fontSize: '0.75rem', color: '#c2410c', margin: '3px 0 0' }}>
              Requires iOS 16+ (Safari), Android Chrome, or macOS Safari with Touch ID.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Info banner */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.875rem', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <CheckCircle style={{ width: 18, height: 18, color: '#16a34a', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#15803d', margin: 0 }}>
                {/iPhone|iPad/.test(navigator.userAgent) ? 'Face ID / Touch ID' : /Mac/.test(navigator.userAgent) ? 'Touch ID' : 'Fingerprint'} is available
              </p>
              <p style={{ fontSize: '0.75rem', color: '#16a34a', margin: '3px 0 0' }}>
                Skip the password every time you open the app.
              </p>
            </div>
          </div>

          {/* Registered devices */}
          {loading ? (
            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Loading...</p>
          ) : credentials.length > 0 ? (
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Registered Devices
              </p>
              <div className="space-y-2">
                {credentials.map(cred => (
                  <div key={cred.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Smartphone style={{ width: 16, height: 16, color: '#2563eb' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }} className="text-gray-900 dark:text-gray-100">
                        {cred.device_name}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0 }}>
                        Added {format(new Date(cred.created_at), 'dd MMM yyyy')}
                        {cred.last_used_at && ` · Last used ${format(new Date(cred.last_used_at), 'dd MMM')}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(cred)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.3rem', borderRadius: 6, color: '#94a3b8' }}
                      title="Remove this device"
                    >
                      <Trash2 style={{ width: 15, height: 15 }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Add new device */}
          <div>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {credentials.length > 0 ? 'Add Another Device' : 'Set Up Biometric Login'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
                placeholder="Device name"
                className={inputCls}
              />
              <Button onClick={handleRegister} loading={registering} size="sm"
                leftIcon={<Fingerprint style={{ width: 14, height: 14 }} />}>
                Enable
              </Button>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>
              Your biometric data never leaves your device. Only a secure key is stored.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
