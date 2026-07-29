import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import { resetPassword } from '../api/auth';
import { ApiError } from '../api/client';
import AuthLayout from '../components/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import AlertBanner from '../components/ui/AlertBanner';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No reset token provided. Please use the link from your email.');
    }
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 8) {
      setStatus('error');
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      setStatus('loading');
      setErrorMessage('');
      await resetPassword(token, password);
      setStatus('success');
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof ApiError ? err.message : 'Failed to reset password. The token may be expired or invalid.');
    }
  };

  return (
    <AuthLayout title="Set new password" subtitle="Enter your new password below.">
      {status === 'success' ? (
        <AlertBanner tone="success">
          Password has been reset successfully. Redirecting to login...
        </AlertBanner>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <AnimatePresence>
            {status === 'error' && (
              <AlertBanner tone="error">
                {errorMessage}
                {errorMessage.includes('token') && (
                  <div className="mt-1">
                    <Link to="/forgot-password" className="font-medium underline hover:no-underline">
                      Request a new reset link
                    </Link>
                  </div>
                )}
              </AlertBanner>
            )}
          </AnimatePresence>

          <Input
            id="new-password"
            name="password"
            type="password"
            label="New Password"
            required
            icon={<Lock />}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={status === 'loading' || !token}
          />

          <Input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            label="Confirm Password"
            required
            icon={<Lock />}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={status === 'loading' || !token}
          />

          <Button type="submit" isLoading={status === 'loading'} disabled={!token} fullWidth>
            {status === 'loading' ? 'Resetting...' : 'Reset Password'}
          </Button>

          <p className="text-center text-sm">
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400">
              Cancel
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
