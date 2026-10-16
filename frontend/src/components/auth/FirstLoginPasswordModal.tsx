import React, { useState } from 'react';
import {
  KeyRound,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface FirstLoginPasswordModalProps {
  onSuccess?: () => void;
  targetUser?: {
    username: string;
    name?: string;
    role?: string;
  };
  onClose?: () => void;
}

export const FirstLoginPasswordModal: React.FC<FirstLoginPasswordModalProps> = ({
  onSuccess,
  targetUser,
  onClose,
}) => {
  const { currentUser, handleFirstLoginDecision, logout } = useApp();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Modal Interceptor Rendering:
  // Render if explicitly targeted (e.g. from User Management) OR if currentUser must change password
  const isForTargetUser = Boolean(targetUser && targetUser.username);
  if (!isForTargetUser && (!currentUser || !currentUser.mustChangePassword)) {
    return null; // Modal stays hidden for standard users
  }

  const username = (targetUser?.username || currentUser?.username || 'user').replace(/^@/, '');
  const displayName = targetUser?.name || currentUser?.name || (username === 'superadmin01' ? 'Administrator' : username);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation Rules (FirstLoginPasswordModal.tsx):
    // 1. Password cannot be empty.
    if (!newPassword.trim()) {
      setError('Password cannot be empty.');
      return;
    }

    // 2. Minimum length: 4 characters.
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    // 3. newPassword and confirmPassword must match identically.
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password must match identically.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Submitting New Password via handleFirstLoginDecision('reset', newPassword, username)
      const success = await handleFirstLoginDecision('reset', newPassword, username);
      if (success) {
        setIsSuccess(true);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          if (onClose) onClose();
        }, 800);
      } else {
        setError('Failed to update password. Please check your credentials and try again.');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md select-text animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
        {/* Top Dark Navy Accent Bar */}
        <div className="h-1.5 w-full bg-[#0B132B]" />

        <div className="p-6 sm:p-8">
          {/* Header Icon & Tag */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                <KeyRound className="w-5 h-5 text-amber-600 stroke-[2.2]" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-1">
                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                  <span>One-Time Password Detected</span>
                </div>
                <h2 id="first-login-title" className="text-lg font-bold text-slate-900 leading-tight">
                  Reset Temporary Password
                </h2>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* User Callout Banner */}
          <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <span className="font-medium">Account:</span>
              <span className="font-semibold text-slate-900">{displayName}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Username:</span>
              <span className="font-mono text-slate-700">@{username}</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 mb-5 leading-relaxed">
            Your account was provisioned with a temporary One-Time Password (OTP). Security policy requires you to establish a permanent personal password before accessing WorkForceIQ.
          </p>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success State */}
          {isSuccess && (
            <div
              role="status"
              className="mb-4 flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Password successfully updated! Unlocking WorkForceIQ...</span>
            </div>
          )}

          {/* Reset Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* New Password */}
            <div>
              <label
                htmlFor="new-password-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="new-password-input"
                  name="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter new permanent password"
                  className="w-full h-11 pl-10 pr-10 text-xs sm:text-sm bg-white text-slate-900 font-medium placeholder:text-slate-400 border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Minimum 4 characters.</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirm-password-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="confirm-password-input"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Re-enter new permanent password"
                  className="w-full h-11 pl-10 pr-10 text-xs sm:text-sm bg-white text-slate-900 font-medium placeholder:text-slate-400 border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isSuccess}
                className="w-full h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#135BEC] hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                {isSubmitting ? (
                  <span>Securing Account...</span>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Reset Password &amp; Continue</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Sign Out Option */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Need assistance? Contact IT Admin</span>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
