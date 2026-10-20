import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldAlert, ShieldCheck, Lock, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MIN_PASSWORD_LENGTH = 4;

export interface FirstLoginPasswordModalProps {
  onSuccess?: () => void;
  targetUser?: {
    username: string;
    name?: string;
    role?: string;
  };
  onClose?: () => void;
}

const inputClass =
  'w-full h-12 px-4 text-sm bg-slate-50 text-slate-900 font-medium placeholder:text-slate-400 border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all';

export const FirstLoginPasswordModal: React.FC<FirstLoginPasswordModalProps> = ({
  onSuccess,
  targetUser,
  onClose,
}) => {
  const { currentUser, handleFirstLoginDecision, logout } = useApp();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Shown when explicitly targeted (e.g. from User Management) OR when the signed-in
  // user is flagged to change their one-time password. Standard users never see it.
  const isForTargetUser = Boolean(targetUser && targetUser.username);
  const isVisible = isForTargetUser || Boolean(currentUser && currentUser.mustChangePassword);

  // Lock background scroll while the modal blocks the app.
  useEffect(() => {
    if (!isVisible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const username = (targetUser?.username || currentUser?.username || 'user').replace(/^@/, '');
  const displayName =
    targetUser?.name ||
    currentUser?.name ||
    (username === 'superadmin01' ? 'Administrator' : username);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    newPassword.length >= MIN_PASSWORD_LENGTH && newPassword === confirmPassword && !isSubmitting && !isSuccess;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword.trim()) {
      setError('Password cannot be empty.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password must match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await handleFirstLoginDecision('reset', newPassword, username);
      if (success) {
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose?.();
        }, 800);
      } else {
        setError('Failed to update password. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while updating password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-login-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/45 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-[640px] my-auto bg-white rounded-[28px] shadow-2xl overflow-hidden">
        {/* Gradient header */}
        <div className="px-7 py-7 sm:px-8 bg-gradient-to-r from-[#1D5BF5] via-[#3B4BF2] to-[#4338F0] text-white">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <KeyRound className="w-8 h-8 text-white" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/20 text-[11px] font-bold uppercase tracking-wider mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>First-Time Login Setup</span>
              </div>
              <h2 id="first-login-title" className="text-2xl sm:text-[28px] font-extrabold leading-tight tracking-tight truncate">
                Welcome, {displayName}!
              </h2>
              <p className="mt-1 text-sm text-blue-50/90">
                Temporary one-time password detected for{' '}
                <span className="font-mono font-bold text-white">@{username}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="px-7 py-6 sm:px-8 sm:py-7">
          {/* Mandatory change notice */}
          <div className="flex items-start gap-3 p-5 rounded-2xl bg-amber-50 border border-amber-200/80">
            <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-950">Action Required: Mandatory Password Change</p>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
                Your administrator provisioned your console account with a temporary one-time password. You must reset
                your password to a new personal password before accessing the system.
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isSuccess && (
            <div
              role="status"
              className="mt-5 flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Password updated. Opening your dashboard…</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="new-password-input" className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Lock className="w-4 h-4 text-blue-600" />
                  New Password <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs text-slate-400">Min {MIN_PASSWORD_LENGTH} characters</span>
              </div>
              <input
                id="new-password-input"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                autoFocus
                required
                value={newPassword}
                onChange={e => {
                  setNewPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter your new password"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="confirm-password-input" className="block mb-2 text-sm font-bold text-slate-900">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <input
                id="confirm-password-input"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                aria-invalid={mismatch}
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Re-type your new password"
                className={`${inputClass} ${mismatch ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20' : ''}`}
              />
              {mismatch && <p className="mt-1.5 text-xs text-rose-600">Passwords do not match.</p>}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-12 inline-flex items-center justify-center rounded-xl text-sm font-bold text-white bg-[#135BEC] hover:bg-blue-700 active:bg-blue-800 shadow-sm transition-colors cursor-pointer disabled:bg-blue-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isSubmitting ? 'Securing account…' : 'Reset Password & Enter Dashboard'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span>WorkForceIQ Security Governance</span>
            {onClose ? (
              <button type="button" onClick={onClose} className="font-medium hover:text-slate-800 cursor-pointer">
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 font-medium hover:text-slate-800 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
