import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  LogOut,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import michaelsLogo from '../assets/logo.svg';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, markPasswordResetComplete, logout } = useApp();

  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError('Please enter your current temporary password.');
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current temporary password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setSuccess(
        res?.message || 'Password changed successfully! Redirecting to application...'
      );
      markPasswordResetComplete();

      // Clear sensitive password inputs immediately
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1200);
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const detail =
        err?.detail?.detail ||
        err?.detail?.message ||
        err?.detail?.error ||
        err?.message ||
        '';

      if (status === 401 || String(detail).toLowerCase().includes('incorrect') || String(detail).toLowerCase().includes('invalid')) {
        setError('Current password is incorrect. Please verify and try again.');
      } else if (detail && typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Failed to update password. Please check your credentials and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#080E21] p-4 sm:p-6 lg:p-8 select-none">
      {/* Background ambient lighting */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 20%, rgba(56, 189, 248, 0.25) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.2) 0%, transparent 50%)',
        }}
        aria-hidden="true"
      />

      {/* Center Card */}
      <div className="relative z-10 w-full max-w-[460px] select-text">
        <div className="bg-white rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.35)] border border-slate-100 overflow-hidden">
          {/* Top Amber Accent Strip indicating required security step */}
          <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-blue-600 to-indigo-600" />

          <div className="px-7 pt-7 pb-8 sm:px-9 sm:pt-8 sm:pb-9">
            {/* Header: Logo and Icon */}
            <div className="flex items-center justify-between mb-5">
              <img
                src={michaelsLogo}
                alt="Michaels"
                className="h-9 w-auto object-contain select-none"
              />
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Security Requirement</span>
              </div>
            </div>

            {/* Title & Explanatory Notice */}
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                Set New Password
              </h2>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Welcome, <span className="font-semibold text-slate-700">{currentUser.name || currentUser.username}</span>. Your account requires a mandatory password reset upon initial login before proceeding.
              </p>
            </div>

            {/* Success message banner */}
            {success && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {/* Error message banner */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Password Reset Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Current / Temporary Password */}
              <div>
                <label
                  htmlFor="current-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Current / Temporary Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="current-password"
                    name="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoFocus
                    value={currentPassword}
                    onChange={e => {
                      setCurrentPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter temporary password"
                    className="w-full h-11 pl-10 pr-10 text-xs sm:text-sm bg-white text-slate-900 font-medium placeholder:text-slate-400 border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                    title={showCurrentPassword ? 'Hide password' : 'Show password'}
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="new-password"
                    name="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={e => {
                      setNewPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter new secure password (min 6 chars)"
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
              </div>

              {/* Confirm New Password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Re-enter new password"
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
                  disabled={isSubmitting || !!success}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Updating password...</span>
                    </>
                  ) : (
                    <>
                      <span>Set Password &amp; Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Logout Option */}
              <div className="pt-3 border-t border-slate-100 flex justify-center">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors cursor-pointer py-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cancel and sign out</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
