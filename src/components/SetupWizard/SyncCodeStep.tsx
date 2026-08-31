import React, { useState } from 'react';
import { OnboardingData } from '../../types';
import { formatCurrency, calculateWeeklyPool, getCheckInDay, generateSyncCode } from '../../lib/calculations';
import { ArrowLeft, Check, Copy, Shield, Users, Calendar, Sparkles, Home } from 'lucide-react';

interface SyncCodeStepProps {
  data: OnboardingData;
  onComplete: (data: OnboardingData) => void;
  onBack: () => void;
}

export const SyncCodeStep: React.FC<SyncCodeStepProps> = ({
  data,
  onComplete,
  onBack,
}) => {
  const [copied, setCopied] = useState(false);
  const syncCode = data.syncCode || generateSyncCode();

  const totalPool = calculateWeeklyPool(data.members);
  const checkInDay = getCheckInDay(data.firstDayOfWeek);

  const handleCopy = () => {
    navigator.clipboard.writeText(syncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-2xl font-bold text-dark-green-900">Your Household is Ready</h2>
        <p className="text-sm text-brown-700">
          Share your private Sync Code with household members so they can connect with their distinct profiles.
        </p>
      </div>

      {/* Sync Code Hero Display */}
      <div className="p-6 bg-gradient-to-br from-dark-green-800 to-dark-green-900 text-white rounded-2xl shadow-md text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-dark-green-700/60 border border-dark-green-600 text-[11px] font-semibold tracking-wider uppercase text-sage-200">
          <Shield className="w-3 h-3 text-sage-300" />
          Household Sync Code
        </div>

        <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-widest text-beige-100 py-1">
          {syncCode}
        </div>

        <p className="text-xs text-sage-200/90 max-w-sm mx-auto">
          Members enter this 6-character code upon sign in to join your synchronized ledger.
        </p>

        <div className="pt-2">
          <button
            type="button"
            id="copy-sync-code-btn"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-beige-100 hover:bg-white text-dark-green-900 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-dark-green-700" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-dark-green-800" />
                <span>Copy Sync Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Configuration Summary Review */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-dark-green-800 border-b border-beige-100 pb-2">
          Household Setup Summary
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-dark-grey-600 block">Account Setup</span>
            <div className="flex items-center gap-1.5 font-bold text-dark-green-900 text-sm capitalize">
              <Users className="w-4 h-4 text-sage-600" />
              {data.accountType} ({data.members.length} {data.members.length === 1 ? 'member' : 'members'})
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-dark-grey-600 block">Weekly Budget Pool</span>
            <div className="font-extrabold text-dark-green-900 text-sm">
              {formatCurrency(totalPool)} <span className="text-xs font-normal text-brown-700">/ week</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-medium text-dark-grey-600 block">Check-in Rhythm</span>
            <div className="flex items-center gap-1.5 font-bold text-dark-green-900 text-sm">
              <Calendar className="w-4 h-4 text-sage-600" />
              {data.calendarMode === 'weekly' ? `Weekly on ${checkInDay}` : 'Monthly on final day'}
            </div>
          </div>
        </div>

        {/* Member list chips */}
        <div className="pt-2 border-t border-beige-100">
          <span className="text-[11px] font-semibold text-dark-grey-600 block mb-2">
            Configured Household Members:
          </span>
          <div className="flex flex-wrap gap-2">
            {data.members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-beige-50 border border-beige-200 text-xs"
              >
                <img src={m.avatarUrl} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                <span className="font-semibold text-dark-green-900">{m.name}</span>
                <span className="text-[10px] text-dark-grey-600 font-medium">
                  {m.hasProvidedIncome ? `${formatCurrency(m.normalizedWeeklyIncome)}/wk` : '(Pending income)'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Complete Button */}
      <div className="pt-4 flex items-center justify-between">
        <button
          type="button"
          id="sync-step-back-btn"
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 border border-beige-300 hover:bg-beige-100 text-dark-green-900 font-semibold text-sm rounded-xl transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          id="finish-onboarding-btn"
          onClick={() => onComplete(data)}
          className="flex items-center gap-2 px-7 py-3 bg-dark-green-800 hover:bg-dark-green-900 text-white font-bold text-sm rounded-xl transition shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
        >
          <Sparkles className="w-4 h-4 text-sage-300" />
          <span>Enter Canopy Dashboard</span>
        </button>
      </div>
    </div>
  );
};
