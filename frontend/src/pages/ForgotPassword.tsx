import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Mail } from 'lucide-react';
import { requestPasswordReset } from '../api/auth';
import { ApiError } from '../api/client';
import AuthLayout from '../components/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import AlertBanner from '../components/ui/AlertBanner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setStatus('loading');
      setErrorMessage('');
      await requestPasswordReset(email);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email address and we'll send you a link to reset your password."
    >
      {status === 'success' ? (
        <>
          <AlertBanner tone="success">
            If that email is registered, you will receive a reset link shortly.
          </AlertBanner>
          <p className="text-center text-sm">
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400">
              Back to login
            </Link>
          </p>
        </>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <AnimatePresence>{status === 'error' && <AlertBanner tone="error">{errorMessage}</AlertBanner>}</AnimatePresence>

          <Input
            id="email-address"
            name="email"
            type="email"
            autoComplete="email"
            required
            icon={<Mail />}
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading'}
          />

          <Button type="submit" isLoading={status === 'loading'} fullWidth>
            {status === 'loading' ? 'Sending...' : 'Send reset link'}
          </Button>

          <p className="text-center text-sm">
            <Link to="/login" className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
