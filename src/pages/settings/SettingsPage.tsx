import { useState } from 'react';
import { Copy, CheckCircle, Link2, LogOut, Users, User, Trash2, AlertTriangle, Database } from 'lucide-react';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/services/profile.service';
import { authService } from '@/services/auth.service';
import { Badge } from '@/components/ui/Badge';
import { getInitials } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { BiometricSetup } from '@/components/ui/BiometricSetup';


// ── Data Cleanup Component ────────────────────────────────────────────────────
function DataCleanup() {
  const { profile, addToast } = useAppStore();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<null | Record<string, unknown>>(null);
  const [confirmed, setConfirmed] = useState(false);

  const cardCls = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6';
  const btnDanger = 'px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed';
  const btnSecondary = 'px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg transition-colors cursor-pointer';

  const handleCleanup = async () => {
    if (!profile?.family_id) return;
    setRunning(true);
    setResult(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/cleanup-old-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ years_old: 2 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Cleanup failed');
      setResult(data.result);
      addToast({ type: 'success', title: '🗑️ Old data cleaned up successfully!' });
      setConfirmed(false);
    } catch (e) {
      addToast({ type: 'error', title: 'Cleanup failed', message: String(e) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={cardCls}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }} className="text-gray-900 dark:text-gray-100">
          Data Management
        </h3>
        <Database style={{ width: 16, height: 16 }} className="text-gray-400" />
      </div>

      <div style={{ padding: '0.875rem', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <AlertTriangle style={{ width: 16, height: 16, color: '#d97706', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
              Delete records older than 2 years
            </p>
            <p style={{ fontSize: '0.75rem', color: '#b45309', margin: '3px 0 0' }}>
              This permanently deletes expenses, income and goal contributions older than 2 years. Budgets and goals are kept. This cannot be undone.
            </p>
          </div>
        </div>
      </div>

      {result && (
        <div style={{ padding: '0.75rem', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: '1rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.8rem', color: '#15803d', margin: '0 0 6px' }}>Cleanup complete ✅</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[
              { label: 'Expenses deleted', value: result.deleted_expenses },
              { label: 'Income deleted', value: result.deleted_income },
              { label: 'Contributions deleted', value: result.deleted_goal_contributions },
              { label: 'Cutoff date', value: String(result.cutoff_date) },
            ].map(r => (
              <div key={r.label} style={{ fontSize: '0.75rem' }}>
                <span style={{ color: '#64748b' }}>{r.label}: </span>
                <span style={{ fontWeight: 700, color: '#15803d' }}>{String(r.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!confirmed ? (
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className={btnSecondary}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Trash2 style={{ width: 15, height: 15 }} />
          Clean up old data
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <p style={{ fontSize: '0.8rem', color: '#dc2626', margin: 0, fontWeight: 600 }}>
            Are you sure? This is permanent.
          </p>
          <button type="button" onClick={() => setConfirmed(false)} className={btnSecondary} style={{ padding: '0.4rem 0.75rem' }}>
            Cancel
          </button>
          <button type="button" onClick={handleCleanup} disabled={running} className={btnDanger} style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 style={{ width: 14, height: 14 }} />
            {running ? 'Deleting...' : 'Yes, delete'}
          </button>
        </div>
      )}
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, family, familyMembers, setProfile, setFamily, setFamilyMembers, addToast } = useAppStore();

  // Profile form state
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<{ full_name?: string; display_name?: string }>({});

  // Family form state
  const [familyName, setFamilyName] = useState(family?.name ?? 'Our Family');
  const [newFamilyName, setNewFamilyName] = useState('Our Family');
  const [inviteCode, setInviteCode] = useState('');
  const [creatingFamily, setCreatingFamily] = useState(false);
  const [joiningFamily, setJoiningFamily] = useState(false);
  const [savingFamily, setSavingFamily] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof profileErrors = {};
    if (!fullName || fullName.trim().length < 2) errs.full_name = 'Full name must be at least 2 characters';
    if (!displayName || displayName.trim().length < 2) errs.display_name = 'Display name must be at least 2 characters';
    if (Object.keys(errs).length > 0) { setProfileErrors(errs); return; }
    setProfileErrors({});

    if (!user) return;
    setSavingProfile(true);
    try {
      const updated = await profileService.updateProfile(user.id, {
        full_name: fullName.trim(),
        display_name: displayName.trim(),
      });
      setProfile(updated);
      addToast({ type: 'success', title: 'Profile updated successfully' });
    } catch {
      addToast({ type: 'error', title: 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;
    if (!user) return;
    setCreatingFamily(true);
    try {
      const created = await profileService.createFamily(newFamilyName.trim(), user.id);
      const updatedProfile = await profileService.getProfile(user.id);
      const members = await profileService.getFamilyMembers(created.id);
      setFamily(created);
      setProfile(updatedProfile);
      setFamilyMembers(members);
      setFamilyName(created.name);
      addToast({ type: 'success', title: '🎉 Family created!', message: 'Share the invite code below with your spouse.' });
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to create family', message: String(e) });
    } finally {
      setCreatingFamily(false);
    }
  };

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) { addToast({ type: 'error', title: 'Please enter an invite code' }); return; }
    if (!user) return;
    setJoiningFamily(true);
    try {
      const joined = await profileService.joinFamily(inviteCode.trim(), user.id);
      const updatedProfile = await profileService.getProfile(user.id);
      const members = await profileService.getFamilyMembers(joined.id);
      setFamily(joined);
      setProfile(updatedProfile);
      setFamilyMembers(members);
      addToast({ type: 'success', title: '🎉 Joined family successfully!' });
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to join family', message: 'Invalid invite code. Please check and try again.' });
      console.error(e);
    } finally {
      setJoiningFamily(false);
    }
  };

  const handleSaveFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !familyName.trim()) return;
    setSavingFamily(true);
    try {
      const updated = await profileService.updateFamily(family.id, { name: familyName.trim() });
      setFamily(updated);
      addToast({ type: 'success', title: 'Family name updated' });
    } catch {
      addToast({ type: 'error', title: 'Failed to update family' });
    } finally {
      setSavingFamily(false);
    }
  };

  const copyInviteCode = () => {
    const code = family?.invite_code;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
      addToast({ type: 'success', title: 'Invite code copied to clipboard!' });
    });
  };

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/login');
  };

  // Shared styles
  const inputClass = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const errorInputClass = 'w-full rounded-lg border border-red-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const cardClass = 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6';
  const btnPrimary = 'px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed';
  const btnSecondary = 'px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-lg transition-colors cursor-pointer';
  const btnDanger = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer';

  return (
    <div style={{ maxWidth: '672px', margin: '0 auto' }} className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">Settings</h2>
        <p className="text-sm text-surface-500 mt-0.5">Manage your profile and family</p>
      </div>

      {/* ── PROFILE CARD ── */}
      <div className={cardClass}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }} className="text-gray-900 dark:text-gray-100">Profile</h3>
          <User style={{ width: 16, height: 16 }} className="text-gray-400" />
        </div>

        {/* Avatar row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem' }} className="bg-gray-50 dark:bg-gray-900">
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {getInitials(profile?.display_name ?? profile?.full_name ?? 'U')}
          </div>
          <div>
            <p style={{ fontWeight: 600, margin: 0 }} className="text-gray-900 dark:text-gray-100">
              {profile?.display_name || profile?.full_name || '—'}
            </p>
            <p style={{ fontSize: '0.875rem', margin: '2px 0 0' }} className="text-gray-500">{profile?.email}</p>
            {profile?.role && (
              <Badge variant="info" size="sm" className="mt-1">{profile.role}</Badge>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveProfile} noValidate>
          <div style={{ marginBottom: '1rem' }}>
            <label className={labelClass}>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setProfileErrors(p => ({ ...p, full_name: undefined })); }}
              placeholder="Prasad Bhavsar"
              className={profileErrors.full_name ? errorInputClass : inputClass}
            />
            {profileErrors.full_name && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>{profileErrors.full_name}</p>}
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label className={labelClass}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setProfileErrors(p => ({ ...p, display_name: undefined })); }}
              placeholder="Prasad"
              className={profileErrors.display_name ? errorInputClass : inputClass}
            />
            {profileErrors.display_name && <p style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 4 }}>{profileErrors.display_name}</p>}
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>Shown to family members</p>
          </div>

          <button type="submit" disabled={savingProfile} className={btnPrimary}>
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* ── FAMILY CARD ── */}
      <div className={cardClass}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }} className="text-gray-900 dark:text-gray-100">Family</h3>
          <Users style={{ width: 16, height: 16 }} className="text-gray-400" />
        </div>

        {family ? (
          <div className="space-y-5">
            {/* Members list */}
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }} className="text-gray-600 dark:text-gray-400">Members</p>
              <div className="space-y-2">
                {familyMembers.map(member => (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '10px' }} className="bg-gray-50 dark:bg-gray-900">
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: member.id === user?.id ? '#0284c7' : '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {getInitials(member.display_name || member.full_name || 'U')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: '0.875rem' }} className="text-gray-900 dark:text-gray-100">
                        {member.display_name || member.full_name}
                        {member.id === user?.id && <span style={{ fontWeight: 400, fontSize: '0.75rem', marginLeft: 4 }} className="text-gray-400">(You)</span>}
                      </p>
                      <p style={{ fontSize: '0.75rem', margin: 0 }} className="text-gray-400">{member.email}</p>
                    </div>
                    <Badge variant={member.role === 'primary' ? 'info' : 'default'} size="sm">{member.role}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite code box */}
            <div style={{ padding: '1rem', borderRadius: '12px', border: '1px solid #bfdbfe', background: '#eff6ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Link2 style={{ width: 16, height: 16, color: '#2563eb' }} />
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1d4ed8', margin: 0 }}>Invite Code</p>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>Share this code with your spouse so they can join your family.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <code style={{ flex: 1, fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.2em', textAlign: 'center', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem 1rem', display: 'block' }} className="text-gray-900">
                  {family.invite_code}
                </code>
                <button type="button" onClick={copyInviteCode} className={btnSecondary} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', whiteSpace: 'nowrap' }}>
                  {copiedCode ? <CheckCircle style={{ width: 14, height: 14, color: '#16a34a' }} /> : <Copy style={{ width: 14, height: 14 }} />}
                  {copiedCode ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Edit family name */}
            <form onSubmit={handleSaveFamily} noValidate style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className={labelClass}>Family Name</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={e => setFamilyName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button type="submit" disabled={savingFamily} className={btnPrimary} style={{ marginBottom: 0, flexShrink: 0 }}>
                {savingFamily ? 'Saving...' : 'Save'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }} className="text-gray-500">
              You're not part of a family yet. Create one or join your spouse's family.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Create */}
              <div style={{ padding: '1rem', border: '2px dashed #e2e8f0', borderRadius: '12px' }} className="dark:border-gray-600">
                <p style={{ fontWeight: 700, fontSize: '0.875rem', margin: '0 0 4px' }} className="text-gray-900 dark:text-gray-100">Create Family</p>
                <p style={{ fontSize: '0.75rem', margin: '0 0 12px' }} className="text-gray-400">Start a new family group</p>
                <form onSubmit={handleCreateFamily} noValidate>
                  <input
                    type="text"
                    value={newFamilyName}
                    onChange={e => setNewFamilyName(e.target.value)}
                    placeholder="e.g. Prasad and Bhagya"
                    className={inputClass}
                    style={{ marginBottom: '0.5rem' }}
                  />
                  <button type="submit" disabled={creatingFamily} className={btnPrimary} style={{ width: '100%' }}>
                    {creatingFamily ? 'Creating...' : 'Create'}
                  </button>
                </form>
              </div>

              {/* Join */}
              <div style={{ padding: '1rem', border: '2px dashed #e2e8f0', borderRadius: '12px' }} className="dark:border-gray-600">
                <p style={{ fontWeight: 700, fontSize: '0.875rem', margin: '0 0 4px' }} className="text-gray-900 dark:text-gray-100">Join Family</p>
                <p style={{ fontSize: '0.75rem', margin: '0 0 12px' }} className="text-gray-400">Enter your spouse's invite code</p>
                <form onSubmit={handleJoinFamily} noValidate>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    placeholder="Invite code"
                    className={inputClass}
                    style={{ marginBottom: '0.5rem', fontFamily: 'monospace', letterSpacing: '0.1em' }}
                  />
                  <button type="submit" disabled={joiningFamily} className={btnSecondary} style={{ width: '100%' }}>
                    {joiningFamily ? 'Joining...' : 'Join'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BIOMETRIC LOGIN ── */}
      <BiometricSetup />

      {/* ── DATA CLEANUP ── */}
      <DataCleanup />

      {/* ── SIGN OUT ── */}
      <div className={cardClass}>
        <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 1rem', color: '#dc2626' }}>Account</h3>
        <button type="button" onClick={handleSignOut} className={btnDanger} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LogOut style={{ width: 16, height: 16 }} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
