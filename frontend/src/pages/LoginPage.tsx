import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Monitor,
  BarChart3,
  Sliders,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import michaelsLogo from '../assets/logo.svg';
import loginOfficeBg from '../assets/images/login_office_environment.jpg';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useApp();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    const pwdToSubmit = password;
    // Wipe password from state immediately so plaintext credentials are never retained
    setPassword('');

    try {
      const res = await login(trimmedUser, pwdToSubmit);
      const mustReset = Boolean(
        res.must_reset_password === true ||
        res.user?.must_reset_password === true ||
        String(res.must_reset_password).toUpperCase() === 'TRUE'
      );

      if (mustReset) {
        navigate('/reset-password', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const detail =
        err?.detail?.detail ||
        err?.detail?.message ||
        err?.detail?.error ||
        err?.message ||
        '';
      const detailLower = String(detail).toLowerCase();

      if (
        status === 401 ||
        detailLower.includes('invalid credentials') ||
        detailLower.includes('unauthorized') ||
        detailLower.includes('incorrect password') ||
        detailLower.includes('invalid username') ||
        detailLower.includes('wrong password')
      ) {
        setError('Invalid username or password. Please verify your credentials and try again.');
      } else if (
        status === 403 ||
        detailLower.includes('inactive') ||
        detailLower.includes('disabled') ||
        detailLower.includes('suspended') ||
        detailLower.includes('deactivated')
      ) {
        setError('This account is currently inactive. Please contact your system administrator.');
      } else if (
        err?.type === 'NETWORK_FAILURE' ||
        detailLower.includes('network') ||
        detailLower.includes('refused') ||
        err?.code === 'ERR_NETWORK' ||
        err?.code === 'ECONNREFUSED'
      ) {
        setError('Unable to connect to authentication server. Please check your network connection and try again.');
      } else if (status >= 500) {
        setError('An internal server error occurred. Please try again shortly or contact support.');
      } else if (detail && typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Authentication failure. Please verify your credentials and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#080E21] overflow-x-hidden select-none">
      {/* ========================================================
          LEFT 60% PANEL — FUTURISTIC ASSET INTELLIGENCE ENVIRONMENT
      ======================================================== */}
      <section
        className="relative w-full lg:w-[60%] min-h-[460px] lg:min-h-screen flex flex-col justify-between overflow-hidden shrink-0"
        aria-label="Asset Intelligence Overview"
      >
        {/* Photorealistic Corporate Glass Office Environment Background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none scale-100 transition-transform duration-1000"
          style={{
            backgroundImage: `url(${loginOfficeBg})`,
            backgroundPosition: 'left center',
          }}
          aria-hidden="true"
        />

        {/* Cinematic Deep Twilight & Blue Vignette Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(8, 14, 33, 0.76) 0%, rgba(10, 24, 60, 0.42) 35%, rgba(6, 11, 25, 0.62) 100%)',
          }}
          aria-hidden="true"
        />

        {/* Ambient Cyan Cyber Glow & Radial Lighting Effect */}
        <div
          className="absolute inset-0 pointer-events-none opacity-35 mix-blend-screen"
          style={{
            backgroundImage:
              'radial-gradient(circle at 35% 65%, rgba(56, 189, 248, 0.35) 0%, transparent 55%), radial-gradient(circle at 65% 35%, rgba(99, 102, 241, 0.25) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />

        {/* SVG Holographic Overlays: Glowing particles, curved data streams & network nodes */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="streamPulse" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.05" />
              <stop offset="35%" stopColor="#00e5ff" stopOpacity="0.85" />
              <stop offset="65%" stopColor="#3b82f6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
            </linearGradient>

            <filter id="hudNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Sweeping Cyan Data Ribbon Over Laptops */}
          <path
            d="M 40 620 C 200 640, 340 535, 500 565 C 660 595, 800 510, 1150 560"
            fill="none"
            stroke="url(#streamPulse)"
            strokeWidth="3.2"
            filter="url(#hudNeonGlow)"
          />
          <path
            d="M 80 650 C 260 670, 400 565, 580 585 C 760 605, 900 535, 1180 575"
            fill="none"
            stroke="url(#streamPulse)"
            strokeWidth="1.8"
            opacity="0.75"
            filter="url(#hudNeonGlow)"
          />

          {/* Floating High-Tech Data Nodes */}
          <circle cx="210" cy="590" r="3.5" fill="#38bdf8" filter="url(#hudNeonGlow)" />
          <circle cx="410" cy="545" r="4" fill="#00e5ff" filter="url(#hudNeonGlow)" />
          <circle cx="600" cy="580" r="4.5" fill="#ffffff" filter="url(#hudNeonGlow)" />
          <circle cx="780" cy="550" r="3.8" fill="#60a5fa" filter="url(#hudNeonGlow)" />
          <circle cx="950" cy="540" r="4" fill="#38bdf8" filter="url(#hudNeonGlow)" />
        </svg>

        {/* Top-Left Content: Headline & 4 Capability Badges */}
        <div className="relative z-10 px-8 pt-10 sm:px-12 sm:pt-14 lg:px-14 lg:pt-16 max-w-3xl">
          {/* Main Headline */}
          <h1 className="relative -top-8 sm:-top-10 text-2xl sm:text-3xl lg:text-4xl font-semibold text-white tracking-tight leading-[1.22] drop-shadow-md">
            Smarter Asset Intelligence
            <br />
            for a Connected Tomorrow
          </h1>

          {/* Four Capability Badges — 2-row, 2-column layout */}
          <div className="relative -left-6 sm:-left-8 mt-8 sm:mt-10 grid grid-cols-2 gap-y-6 gap-x-8 sm:gap-y-7 sm:gap-x-12 max-w-xs sm:max-w-sm">
            {/* 1. Device Discovery */}
            <div className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-sky-400/50 bg-sky-950/40 backdrop-blur-md flex items-center justify-center text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.35)] transition-all group-hover:border-sky-300 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.6)]">
                <Monitor className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-sky-300 stroke-[1.8]" />
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-slate-200 tracking-wide text-center">
                Device Discovery
              </span>
            </div>

            {/* 2. Inventory Insights */}
            <div className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-sky-400/50 bg-sky-950/40 backdrop-blur-md flex items-center justify-center text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.35)] transition-all group-hover:border-sky-300 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.6)]">
                <BarChart3 className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-sky-300 stroke-[1.8]" />
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-slate-200 tracking-wide text-center">
                Inventory Insights
              </span>
            </div>

            {/* 3. Compliance Ready */}
            <div className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-sky-400/50 bg-sky-950/40 backdrop-blur-md flex items-center justify-center text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.35)] transition-all group-hover:border-sky-300 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.6)]">
                <ShieldCheck className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-sky-300 stroke-[1.8]" />
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-slate-200 tracking-wide text-center">
                Compliance Ready
              </span>
            </div>

            {/* 4. Unified Management */}
            <div className="flex flex-col items-center gap-2 group cursor-default">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-sky-400/50 bg-sky-950/40 backdrop-blur-md flex items-center justify-center text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.35)] transition-all group-hover:border-sky-300 group-hover:shadow-[0_0_20px_rgba(56,189,248,0.6)]">
                <Sliders className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-sky-300 stroke-[1.8]" />
              </div>
              <span className="text-[11px] sm:text-xs font-medium text-slate-200 tracking-wide text-center">
                Unified Management
              </span>
            </div>
          </div>
        </div>

        {/* Floating Holographic Asset Metrics Badges (Bottom Overlay) */}
        <div className="relative z-10 px-8 pb-8 sm:px-12 sm:pb-10 lg:px-14 lg:pb-12 hidden md:flex items-center gap-4">
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-950/60 backdrop-blur-md border border-sky-500/30 text-xs shadow-lg shadow-sky-950/40">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Enterprise Asset Fleet:</span>
            <span className="text-sky-300 font-semibold tracking-wide">100% Synced</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/60 backdrop-blur-md border border-sky-500/30 text-xs shadow-lg shadow-sky-950/40">
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-300 font-medium">Hardware EOL Status:</span>
            <span className="text-emerald-400 font-semibold tracking-wide">Monitored</span>
          </div>
        </div>
      </section>

      {/* ========================================================
          RIGHT 40% PANEL — PALE-BLUE LOGIN AREA WITH CENTERED CARD
      ======================================================== */}
      <aside
        className="relative w-full lg:w-[40%] min-h-[540px] lg:min-h-screen flex items-center justify-center p-6 sm:p-8 lg:p-10 xl:p-14 shrink-0 overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 50% 25%, #f0f7ff 0%, #e2efff 50%, #d4e7fc 100%)',
        }}
        aria-label="User Sign In"
      >
        {/* Soft Organic Ambient Light Gradients in Pale Blue Backdrop */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 100% 100%, rgba(59, 130, 246, 0.18) 0%, transparent 60%), radial-gradient(circle at 0% 0%, rgba(147, 197, 253, 0.22) 0%, transparent 50%)',
          }}
          aria-hidden="true"
        />

        {/* Centered White Login Card */}
        <div className="relative z-10 w-full max-w-[420px] select-text">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_20px_50px_rgba(15,42,88,0.18)] border border-slate-100/90 overflow-hidden">
            {/* Top Dark Navy Accent Strip */}
            <div className="h-1.5 w-full bg-[#0B132B]" />

            <div className="px-7 pt-7 pb-8 sm:px-9 sm:pt-8 sm:pb-9">
              {/* Michaels Customer Logo Centered Near Top */}
              <div className="flex justify-center mb-5">
                <img
                  src={michaelsLogo}
                  alt="Michaels"
                  className="h-10 sm:h-11 w-auto object-contain select-none"
                />
              </div>

              {/* AssetIQ Branding & Subtitle */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1D63F0] flex items-center justify-center text-white shadow-xs shrink-0">
                    <ShieldCheck className="w-4.5 h-4.5 text-white" />
                  </div>
                  <span className="text-2xl font-bold tracking-tight text-slate-900 leading-none">
                    AssetIQ
                  </span>
                </div>
                <p className="text-xs sm:text-[13px] font-medium text-slate-500">
                  Intelligence &amp; Governance
                </p>
              </div>

              {/* Validation Error Message */}
              {error && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Username Input */}
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      autoFocus
                      value={username}
                      onChange={e => {
                        setUsername(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Enter your username"
                      className="w-full h-11 pl-10 pr-3.5 text-xs sm:text-sm bg-white text-slate-900 font-medium placeholder:text-slate-400 border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Password Input with Show/Hide Toggle */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Enter your password"
                      className="w-full h-11 pl-10 pr-10 text-xs sm:text-sm bg-white text-slate-900 font-medium placeholder:text-slate-400 border border-slate-200 hover:border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Sign In Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#135BEC] hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
