import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wallet, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAppStore } from '@/contexts/store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const registerSchema = z
  .object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    display_name: z.string().min(2, 'Display name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { addToast } = useAppStore();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      await authService.signUp(data);
      addToast({
        type: 'success',
        title: 'Account created!',
        message: 'Please check your email to verify your account.',
      });
      navigate('/dashboard');
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Registration failed',
        message: error instanceof Error ? error.message : 'Something went wrong',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-blue-50/30 to-brand-50/50 dark:from-surface-950 dark:via-surface-900 dark:to-brand-950/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl shadow-lg mb-4">
            <Wallet className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-surface-900 dark:text-surface-100">
            FamilyFinance
          </h1>
          <p className="text-surface-500 mt-1 text-sm">
            Start your financial journey together
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 shadow-glass p-8">
          <h2 className="font-display text-xl font-semibold text-surface-900 dark:text-surface-100 mb-6">
            Create your account
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Full name"
              type="text"
              placeholder="Prasad Sharma"
              leftIcon={<User className="h-4 w-4" />}
              error={errors.full_name?.message}
              required
              {...register('full_name')}
            />

            <Input
              label="Display name"
              type="text"
              placeholder="Prasad"
              leftIcon={<User className="h-4 w-4" />}
              hint="This is how you'll appear to family members"
              error={errors.display_name?.message}
              required
              {...register('display_name')}
            />

            <Input
              label="Email address"
              type="email"
              placeholder="prasad@example.com"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              required
              {...register('email')}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:text-surface-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              error={errors.password?.message}
              required
              {...register('password')}
            />

            <Input
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.confirmPassword?.message}
              required
              {...register('confirmPassword')}
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
            >
              Create account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-sm text-surface-500">Already have an account? </span>
            <Link
              to="/login"
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
