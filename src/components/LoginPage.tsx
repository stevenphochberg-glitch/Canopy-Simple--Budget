import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { ShieldCheck, Sparkles, CheckCircle2, ArrowRight, Shield, Clock, Lock } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signInWithGoogle } = useHousehold();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleClick = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setAuthError(err?.message || 'Authentication encountered an issue. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-beige-50 flex flex-col font-sans selection:bg-sage-200">
      {/* Split Hero Container */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
        {/* Left Side: Brand Experience & Philosophy */}
        <div className="lg:w-1/2 bg-sage-400 p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden text-dark-green-800">
          {/* Ambient Lighting */}
          <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-dark-green-800 opacity-20 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-0 w-64 h-64 rounded-full bg-white opacity-15 blur-3xl pointer-events-none" />

          {/* Top Brand Header */}
          <div className="z-10 flex flex-col items-start">
            {/* Prominent Hero Illustration with object-contain for full uncropped visibility */}
            <div className="w-full mb-6 sm:mb-8 rounded-3xl overflow-hidden border border-white/50 shadow-md bg-sage-300/40 p-4 sm:p-6 flex items-center justify-center transition-transform hover:scale-[1.01] duration-300">
              <img
                src="/marketing-hero.jpeg"
                alt="Canopy Forest Nymph Hero Illustration"
                className="max-h-52 sm:max-h-72 w-auto max-w-full object-contain drop-shadow-sm rounded-2xl"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = 'true';
                    target.src = '/Gemini_Generated_Image_of6cm6of6cm6of6c.jpeg';
                  }
                }}
              />
            </div>

            <h1 className="text-dark-green-800 text-3xl sm:text-5xl lg:text-6xl font-bold leading-[0.95] tracking-tighter mb-4">
              Shelter your <br />
              savings.
            </h1>

            <p className="text-dark-green-900 text-sm sm:text-base lg:text-lg max-w-md leading-relaxed font-medium opacity-90">
              A manual, high-intent budgeting tool for households that value financial mindfulness over effortless automation.
            </p>
          </div>

          {/* Bottom Philosophy & Architecture Highlights */}
          <div className="z-10 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 pt-10 sm:pt-14 border-t border-dark-green-800/15 mt-8">
            <div>
              <p className="text-dark-green-900 text-xs font-bold uppercase tracking-widest mb-1.5 opacity-70">
                Philosophy
              </p>
              <p className="text-white text-sm font-medium leading-snug">
                Friction as a feature. Log manually to cultivate shared habits.
              </p>
            </div>
            <div>
              <p className="text-dark-green-900 text-xs font-bold uppercase tracking-widest mb-1.5 opacity-70">
                Household Sync
              </p>
              <p className="text-white text-sm font-medium leading-snug">
                Live Cloud Sync. Real-time household ledger and shared buckets.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Authentication & Access Portal */}
        <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-beige-50">
          <div className="w-full max-w-md">
            {/* Clean Logo Integration above Marketing Copy */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="mb-4">
                <img
                  src="/logo.jpeg"
                  alt="Canopy Logo"
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl object-cover border-2 border-beige-200 shadow-md transition-transform hover:scale-105 duration-200"
                />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-dark-green-900 mb-2">Welcome Home</h2>
              <p className="text-brown-700 text-xs sm:text-sm font-medium max-w-xs">
                Mindful household budgeting, shared in real time. Sign in to access your ledger.
              </p>
            </div>

            {/* Authentication Action */}
            <div className="space-y-4">
              <button
                id="google-sign-in-btn"
                onClick={handleGoogleClick}
                disabled={isSigningIn}
                className="w-full flex items-center justify-center space-x-3 bg-white border-2 border-beige-200 hover:border-sage-400 text-dark-grey-800 font-bold py-4 px-6 rounded-2xl shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer active:scale-[0.99] disabled:opacity-60"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>{isSigningIn ? 'Connecting with Google Auth...' : 'Continue with Google'}</span>
              </button>

              {authError && (
                <p className="text-xs text-alert-red-700 bg-alert-red-50 p-3 rounded-xl border border-alert-red-200">
                  {authError}
                </p>
              )}
            </div>

            {/* Feature Value Cards in Professional Polish Theme */}
            <div className="mt-8 space-y-4 border-t border-beige-200 pt-6">
              <div className="flex items-start space-x-3.5">
                <div className="w-8 h-8 rounded-lg bg-sky-blue-300/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-dark-green-800" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-dark-green-800">Universal Staging</h4>
                  <p className="text-xs text-brown-700 opacity-80 leading-relaxed">
                    Review, categorize, and confirm batch expenses before database commits.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3.5">
                <div className="w-8 h-8 rounded-lg bg-sky-blue-300/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-dark-green-800" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-dark-green-800">Live Household Sync</h4>
                  <p className="text-xs text-brown-700 opacity-80 leading-relaxed">
                    Instant multi-member category balances and synchronized expense tracking.
                  </p>
                </div>
              </div>
            </div>

            {/* Version & PWA Footer */}
            <div className="mt-10 text-center">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-brown-700 opacity-40">
                Canopy Phase 2 &bull; Professional Polish
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
