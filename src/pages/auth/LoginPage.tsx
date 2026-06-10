import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wallet, Eye, EyeOff } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { biometricService } from '@/services/biometric.service';
import { useAppStore } from '@/contexts/store';
import {
  isBiometricAvailable,
  authenticateWithBiometric,
  hasBiometricSession,
  setBiometricSession,
} from '@/lib/webauthn';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type LoginForm = z.infer<typeof loginSchema>;

const fieldCls = 'w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const errorFieldCls = 'w-full rounded-lg border border-red-400 bg-white text-gray-900 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
const errorCls = 'text-xs text-red-600 mt-1';

export function LoginPage() {
  const navigate = useNavigate();
  const { addToast } = useAppStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [savedCredential, setSavedCredential] = useState<{ credentialId: string; email: string } | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    // Check if biometric is available on this device
    isBiometricAvailable().then(available => {
      if (available) {
        setBiometricAvailable(true);
        const local = biometricService.getLocalCredential();
        setSavedCredential(local);

        // If there's an active biometric session, skip to dashboard
        if (local && hasBiometricSession()) {
          navigate('/dashboard');
        }
      }
    });
  }, [navigate]);

  const handleBiometricLogin = async () => {
    if (!savedCredential) return;
    setBiometricLoading(true);
    try {
      const success = await authenticateWithBiometric({ credentialId: savedCredential.credentialId });
      if (!success) {
        addToast({ type: 'error', title: 'Biometric failed', message: 'Please use password to sign in.' });
        return;
      }
      // Biometric verified — set session cache so we skip next time
      setBiometricSession();
      await biometricService.updateLastUsed(savedCredential.credentialId);
      navigate('/dashboard');
    } catch (err) {
      addToast({ type: 'error', title: 'Biometric error', message: 'Please use password instead.' });
      console.error(err);
    } finally {
      setBiometricLoading(false);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      await authService.signIn(data);
      navigate('/dashboard');
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Login failed',
        message: error instanceof Error ? error.message : 'Invalid email or password',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: '#0284c7', borderRadius: '16px', marginBottom: '1rem' }}>
            <Wallet style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>FamilyFinance</h1>
          <p style={{ color: '#64748b', marginTop: '4px', fontSize: '0.875rem' }}>Manage your family finances together</p>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', marginTop: 0, marginBottom: '1.5rem' }}>
            Welcome back
          </h2>

          {/* Biometric button — show if device supports it and credential saved */}
          {biometricAvailable && savedCredential && (
            <div style={{ marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={biometricLoading}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  background: biometricLoading ? '#f1f5f9' : 'linear-gradient(135deg, #0f172a, #1e293b)',
                  color: biometricLoading ? '#94a3b8' : 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  cursor: biometricLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.2s',
                  boxShadow: biometricLoading ? 'none' : '0 4px 12px rgba(15,23,42,0.3)',
                }}
              >
                {biometricLoading ? (
                  <>
                    <span style={{ fontSize: '1.4rem' }}>⏳</span>
                    Verifying...
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '1.6rem' }}>
                      {/iPhone|iPad|Mac/.test(navigator.userAgent) ? '󰦬' : '🔐'}
                    </span>
                    <span>
                      {/iPhone|iPad/.test(navigator.userAgent)
                        ? 'Sign in with Face ID / Touch ID'
                        : /Mac/.test(navigator.userAgent)
                        ? 'Sign in with Touch ID'
                        : 'Sign in with Fingerprint'}
                    </span>
                  </>
                )}
              </button>

              <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.5rem' }}>
                {savedCredential.email}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0' }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>or use password</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div style={{ marginBottom: '1rem' }}>
              <label className={labelCls}>Email address</label>
              <input type="email" placeholder="prasad@example.com"
                className={errors.email ? errorFieldCls : fieldCls}
                {...register('email')} />
              {errors.email && <p className={errorCls}>{errors.email.message}</p>}
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label className={labelCls}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                  className={errors.password ? errorFieldCls : fieldCls}
                  style={{ paddingRight: '2.5rem' }}
                  {...register('password')} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                  {showPassword
                    ? <EyeOff style={{ width: '16px', height: '16px' }} />
                    : <Eye style={{ width: '16px', height: '16px' }} />}
                </button>
              </div>
              {errors.password && <p className={errorCls}>{errors.password.message}</p>}
            </div>

            <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.875rem', color: '#0284c7', textDecoration: 'none', fontWeight: '500' }}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '0.75rem', background: loading ? '#94a3b8' : '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#0284c7', fontWeight: '600', textDecoration: 'none' }}>
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
