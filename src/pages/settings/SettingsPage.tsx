import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, User, Copy, CheckCircle, Link2, LogOut } from 'lucide-react';
import { useAppStore } from '@/contexts/store';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/services/profile.service';
import { authService } from '@/services/auth.service';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { getInitials } from '@/utils';
import { useNavigate } from 'react-router-dom';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  display_name: z.string().min(2, 'Display name is required'),
});

const familySchema = z.object({
  name: z.string().min(2, 'Family name is required'),
});

const joinSchema = z.object({
  invite_code: z.string().min(6, 'Invalid invite code'),
});

type ProfileForm = z.infer<typeof profileSchema>;
type FamilyForm = z.infer<typeof familySchema>;
type JoinForm = z.infer<typeof joinSchema>;

export function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, family, familyMembers, setProfile, setFamily, setFamilyMembers, addToast } = useAppStore();

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingFamily, setSavingFamily] = useState(false);
  const [creatingFamily, setCreatingFamily] = useState(false);
  const [joiningFamily, setJoiningFamily] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      display_name: profile?.display_name ?? '',
    },
  });

  const familyForm = useForm<FamilyForm>({
    resolver: zodResolver(familySchema),
    defaultValues: { name: family?.name ?? '' },
  });

  const joinForm = useForm<JoinForm>({
    resolver: zodResolver(joinSchema),
  });

  const createFamilyForm = useForm<FamilyForm>({
    resolver: zodResolver(familySchema),
    defaultValues: { name: 'Our Family' },
  });

  const handleSaveProfile = async (data: ProfileForm) => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const updated = await profileService.updateProfile(user.id, data);
      setProfile(updated);
      addToast({ type: 'success', title: 'Profile updated successfully' });
    } catch {
      addToast({ type: 'error', title: 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveFamily = async (data: FamilyForm) => {
    if (!family) return;
    setSavingFamily(true);
    try {
      const updated = await profileService.updateFamily(family.id, data);
      setFamily(updated);
      addToast({ type: 'success', title: 'Family updated' });
    } catch {
      addToast({ type: 'error', title: 'Failed to update family' });
    } finally {
      setSavingFamily(false);
    }
  };

  const handleCreateFamily = async (data: FamilyForm) => {
    if (!user) return;
    setCreatingFamily(true);
    try {
      const newFamily = await profileService.createFamily(data.name, user.id);
      setFamily(newFamily);
      const updatedProfile = await profileService.getProfile(user.id);
      setProfile(updatedProfile);
      const members = await profileService.getFamilyMembers(newFamily.id);
      setFamilyMembers(members);
      addToast({ type: 'success', title: 'Family created!', message: 'Share your invite code with your spouse.' });
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to create family', message: String(e) });
    } finally {
      setCreatingFamily(false);
    }
  };

  const handleJoinFamily = async (data: JoinForm) => {
    if (!user) return;
    setJoiningFamily(true);
    try {
      const joinedFamily = await profileService.joinFamily(data.invite_code, user.id);
      setFamily(joinedFamily);
      const updatedProfile = await profileService.getProfile(user.id);
      setProfile(updatedProfile);
      const members = await profileService.getFamilyMembers(joinedFamily.id);
      setFamilyMembers(members);
      addToast({ type: 'success', title: 'Joined family successfully!' });
    } catch (e) {
      addToast({ type: 'error', title: 'Failed to join family', message: String(e) });
    } finally {
      setJoiningFamily(false);
    }
  };

  const copyInviteCode = () => {
    if (family?.invite_code) {
      navigator.clipboard.writeText(family.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      addToast({ type: 'success', title: 'Invite code copied!' });
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/login');
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="font-display text-2xl font-bold text-surface-900 dark:text-surface-100">Settings</h2>
        <p className="text-sm text-surface-500 mt-0.5">Manage your profile and family</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <User className="h-4 w-4 text-surface-400" />
        </CardHeader>

        <div className="flex items-center gap-4 mb-6 p-4 bg-surface-50 dark:bg-surface-900 rounded-xl">
          <div className="w-14 h-14 rounded-full bg-brand-600 flex items-center justify-center text-xl font-bold text-white">
            {getInitials(profile?.display_name ?? profile?.full_name ?? 'U')}
          </div>
          <div>
            <p className="font-semibold text-surface-900 dark:text-surface-100">
              {profile?.display_name || profile?.full_name}
            </p>
            <p className="text-sm text-surface-500">{profile?.email}</p>
            <Badge variant="info" size="sm" className="mt-1">{profile?.role}</Badge>
          </div>
        </div>

        <form onSubmit={profileForm.handleSubmit(handleSaveProfile)} className="space-y-4">
          <Input
            label="Full Name"
            error={profileForm.formState.errors.full_name?.message}
            {...profileForm.register('full_name')}
          />
          <Input
            label="Display Name"
            hint="Shown to family members"
            error={profileForm.formState.errors.display_name?.message}
            {...profileForm.register('display_name')}
          />
          <Button type="submit" loading={savingProfile}>Save Profile</Button>
        </form>
      </Card>

      {/* Family Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Family</CardTitle>
          <Users className="h-4 w-4 text-surface-400" />
        </CardHeader>

        {family ? (
          <div className="space-y-4">
            {/* Family Members */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-surface-700 dark:text-surface-300">Members</p>
              {familyMembers.map(member => (
                <div key={member.id} className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-900 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
                    {getInitials(member.display_name || member.full_name)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                      {member.display_name || member.full_name}
                      {member.id === user?.id && <span className="text-surface-400 ml-1 text-xs">(You)</span>}
                    </p>
                    <p className="text-xs text-surface-400">{member.email}</p>
                  </div>
                  <Badge variant={member.role === 'primary' ? 'info' : 'default'} size="sm">
                    {member.role}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Invite Code */}
            <div className="p-4 bg-brand-50 dark:bg-brand-950/30 rounded-xl border border-brand-100 dark:border-brand-900/50">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Invite Code</p>
              </div>
              <p className="text-xs text-surface-500 mb-3">Share this code with your spouse so they can join your family.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-lg font-bold tracking-widest text-surface-900 dark:text-surface-100 bg-white dark:bg-surface-800 px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 text-center">
                  {family.invite_code}
                </code>
                <Button variant="outline" size="sm" onClick={copyInviteCode} leftIcon={copiedCode ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}>
                  {copiedCode ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Edit Family Name */}
            <form onSubmit={familyForm.handleSubmit(handleSaveFamily)} className="flex gap-3">
              <Input
                label="Family Name"
                className="flex-1"
                error={familyForm.formState.errors.name?.message}
                {...familyForm.register('name')}
              />
              <Button type="submit" loading={savingFamily} className="mt-7">Save</Button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-surface-500">
              You're not part of a family yet. Create one or join your spouse's family.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Create Family */}
              <div className="p-4 border border-dashed border-surface-200 dark:border-surface-700 rounded-xl">
                <p className="font-medium text-surface-900 dark:text-surface-100 mb-1 text-sm">Create Family</p>
                <p className="text-xs text-surface-400 mb-3">Start a new family group</p>
                <form onSubmit={createFamilyForm.handleSubmit(handleCreateFamily)} className="space-y-2">
                  <Input placeholder="Family name" {...createFamilyForm.register('name')} />
                  <Button type="submit" loading={creatingFamily} className="w-full" size="sm">Create</Button>
                </form>
              </div>

              {/* Join Family */}
              <div className="p-4 border border-dashed border-surface-200 dark:border-surface-700 rounded-xl">
                <p className="font-medium text-surface-900 dark:text-surface-100 mb-1 text-sm">Join Family</p>
                <p className="text-xs text-surface-400 mb-3">Enter your spouse's invite code</p>
                <form onSubmit={joinForm.handleSubmit(handleJoinFamily)} className="space-y-2">
                  <Input placeholder="Invite code" {...joinForm.register('invite_code')} />
                  <Button type="submit" loading={joiningFamily} className="w-full" size="sm" variant="secondary">Join</Button>
                </form>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-100 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="text-red-700 dark:text-red-400">Account</CardTitle>
        </CardHeader>
        <Button variant="danger" onClick={handleSignOut} leftIcon={<LogOut className="h-4 w-4" />}>
          Sign Out
        </Button>
      </Card>
    </div>
  );
}
