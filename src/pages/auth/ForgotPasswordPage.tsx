import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wallet, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { useAppStore } from '@/contexts/store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().email('Please enter a valid email'),
});

type ForgotForm = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { addToast } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: ForgotForm) => {
    setLoading(true);
    try {
      await authService.resetPassword(data.email);
      setSent(true);
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to send reset email',
        message: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-blue-50/30 to-brand-50/50 dark:from-surface-950 dark:via-surface-900 dark:to-brand-950/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl shadow-lg mb-4">
            <Wallet className="h-7 w-7 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-surface-900 dark:text-surface-100">
            FamilyFinance
          </h1>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 shadow-glass p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="font-display text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">
                Check your email
              </h2>
              <p className="text-sm text-surface-500">
                We've sent a password reset link to your email address.
              </p>
              <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">
                Reset password
              </h2>
              <p className="text-sm text-surface-500 mb-6">
                Enter your email and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="prasad@example.com"
                  leftIcon={<Mail className="h-4 w-4" />}
                  error={errors.email?.message}
                  required
                  {...register('email')}
                />

                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Send reset link
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-surface-700">
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
