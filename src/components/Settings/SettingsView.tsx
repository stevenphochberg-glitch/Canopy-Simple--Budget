import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { DayOfWeek, CalendarMode, PaySchedule } from '../../types';
import { DAYS_OF_WEEK, getCheckInDay, formatCurrency } from '../../lib/calculations';
import {
  Settings,
  Shield,
  Copy,
  Check,
  Calendar,
  Clock,
  Users,
  RotateCcw,
  Smartphone,
  Info,
  DollarSign,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    household,
    user,
    members,
    updateHousehold,
    updateMemberIncome,
    resetHouseholdToOnboarding,
    triggerFreshStartAction,
    executeMonthEndResetAction,
  } = useHousehold();

  const [copied, setCopied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFreshStartConfirm, setShowFreshStartConfirm] = useState(false);
  const [showMonthEndConfirm, setShowMonthEndConfirm] = useState(false);

  const handleCopySync = () => {
    if (household?.syncCode) {
      navigator.clipboard.writeText(household.syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDayChange = (day: DayOfWeek) => {
    updateHousehold({ firstDayOfWeek: day });
  };

  const handleCalendarModeToggle = (mode: CalendarMode) => {
    updateHousehold({ calendarMode: mode });
  };

  return (
    <div className="space-y-6 pb-16 lg:pb-6">
      {/* Header */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-1">
        <h1 className="text-2xl font-bold text-dark-green-900">Household Settings</h1>
        <p className="text-sm text-brown-700">
          Manage your Sync Code, fiscal calendar boundaries, member income normalization, and multi-device sessions.
        </p>
      </div>

      {/* Sync Code Management Section */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
          <Shield className="w-5 h-5 text-sage-600" />
          <span>Household Sync Code</span>
        </div>
        <p className="text-xs text-brown-700 leading-relaxed">
          This 6-character code uniquely identifies your shared household. Share it with your partner or roommates to connect their individual profiles.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-sage-50 border border-sage-200 rounded-xl">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 block">
              Active Sync Code
            </span>
            <span className="text-2xl font-mono font-extrabold text-dark-green-900">
              {household?.syncCode || 'CNP-000'}
            </span>
          </div>

          <button
            onClick={handleCopySync}
            id="settings-copy-sync-code"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-sage-300" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Sync Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Calendar Architecture Settings */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
          <Calendar className="w-5 h-5 text-sage-600" />
          <span>Calendar Architecture & Check-in Day</span>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleCalendarModeToggle('weekly')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
              household?.calendarMode === 'weekly'
                ? 'bg-sage-50 border-dark-green-700 ring-1 ring-dark-green-700 font-semibold'
                : 'bg-beige-50/50 border-beige-200'
            }`}
          >
            <div className="text-sm text-dark-green-900 font-bold">Fiscal Weekly Calendar</div>
            <div className="text-xs text-dark-grey-600">7-day cycles with weekly check-ins</div>
          </button>

          <button
            type="button"
            onClick={() => handleCalendarModeToggle('monthly')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
              household?.calendarMode === 'monthly'
                ? 'bg-sage-50 border-dark-green-700 ring-1 ring-dark-green-700 font-semibold'
                : 'bg-beige-50/50 border-beige-200'
            }`}
          >
            <div className="text-sm text-dark-green-900 font-bold">Standard Calendar Month</div>
            <div className="text-xs text-dark-grey-600">Tracks 1st to last day of month</div>
          </button>
        </div>

        {household?.calendarMode === 'weekly' ? (
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-dark-green-900 uppercase tracking-wider block">
              First Day of the Week
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = household?.firstDayOfWeek === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayChange(day)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold transition text-center cursor-pointer border ${
                      isSelected
                        ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-sm'
                        : 'bg-beige-50 border-beige-200 text-dark-green-900 hover:bg-sage-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="p-3.5 bg-sage-50 border border-sage-200 rounded-xl flex items-center gap-3 text-xs text-dark-green-900">
              <Clock className="w-4 h-4 text-sage-700 flex-shrink-0" />
              <span>
                Weekly check-in is scheduled for every{' '}
                <strong className="text-dark-green-950 font-bold">{household?.lastDayOfWeek}</strong>{' '}
                evening.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-beige-100/70 border border-beige-200 rounded-xl text-xs text-brown-800 flex items-start gap-2">
            <Info className="w-4 h-4 text-brown-700 flex-shrink-0 mt-0.5" />
            <span>
              Monthly mode active: Finances are tracked per calendar month and check-ins will occur on the final day of the month.
            </span>
          </div>
        )}
      </div>

      {/* Multi-Device Sessions & Security */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
          <Smartphone className="w-5 h-5 text-sage-600" />
          <span>Multi-Device Concurrent Sessions</span>
        </div>
        <p className="text-xs text-brown-700 leading-relaxed">
          Your profile (<strong className="text-dark-green-900">{user?.name}</strong>) is linked to Household Sync Code <code className="bg-beige-100 px-1 py-0.5 rounded text-dark-green-900 font-mono font-bold">{household?.syncCode}</code>. You can log into Canopy from your phone, tablet, and laptop simultaneously without logging out your other devices or other household members.
        </p>
      </div>

      {/* Email Forwarding Placeholder */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
            <span className="text-lg">✉️</span>
            <span>Email Forwarding</span>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-brown-800 bg-beige-100 px-2.5 py-1 rounded-full border border-beige-200">
            Coming Soon
          </span>
        </div>
        <p className="text-xs text-brown-700 leading-relaxed">
          Forward receipts directly to your household email inbox (e.g. <code className="bg-beige-100 px-1 py-0.5 rounded text-dark-green-900 font-mono font-bold">receipts-{household?.syncCode?.toLowerCase() || 'sync'}@canopybudget.app</code>). Our Gemini parsing engine will automatically extract the line items and stage them for your weekly check-in.
        </p>
        <div className="p-3 bg-beige-50 border border-beige-200 rounded-xl text-xs text-brown-800 flex items-center gap-2">
          <Info className="w-4 h-4 text-brown-700 flex-shrink-0" />
          <span>Email Forwarding (Coming Soon after custom domain deployment).</span>
        </div>
      </div>

      {/* Start Fresh (Hiatus & Gap Week Resolution) */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
            <span className="text-lg">🌱</span>
            <span>Start Fresh (On-Budget Gap Resolution)</span>
          </div>
          <span className="text-[10px] font-bold text-sage-800 bg-sage-100 px-2 py-0.5 rounded-full">
            Hiatus Recovery
          </span>
        </div>
        <p className="text-xs text-brown-700 leading-relaxed">
          Returning to Canopy after an app hiatus or skipped weeks? "Start Fresh" unblocks past-due check-ins by applying an <strong>"exactly on budget"</strong> assumption for all missed gap weeks, injecting $0 baseline placeholders, and resetting current weekly budgets back to default.
        </p>

        {showFreshStartConfirm ? (
          <div className="p-4 bg-sage-50 border border-sage-200 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-dark-green-900">
              Apply Fresh Start? This will resolve any past-due check-in alerts and reset all category budgets to baseline without losing past historical transactions.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="confirm-fresh-start-btn"
                onClick={async () => {
                  await triggerFreshStartAction();
                  setShowFreshStartConfirm(false);
                }}
                className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Yes, Start Fresh
              </button>
              <button
                type="button"
                onClick={() => setShowFreshStartConfirm(false)}
                className="px-4 py-2 bg-white border border-beige-300 hover:bg-beige-50 text-dark-grey-800 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            id="start-fresh-btn"
            onClick={() => setShowFreshStartConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-sage-100 hover:bg-sage-200 text-dark-green-900 text-xs font-bold rounded-xl border border-sage-300 transition cursor-pointer"
          >
            <span>🌱 Start Fresh</span>
          </button>
        )}
      </div>

      {/* Month-End Hard Reset */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
          <RotateCcw className="w-5 h-5 text-amber-700" />
          <span>Manual Month-End Hard Reset</span>
        </div>
        <p className="text-xs text-brown-700 leading-relaxed">
          Reset all category weekly budgets back to their default baseline allocations for the new fiscal month.
        </p>

        {showMonthEndConfirm ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-amber-950">
              Execute Month-End Reset? All category weekly budgets will return to their default baseline values.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="confirm-month-end-reset-btn"
                onClick={async () => {
                  await executeMonthEndResetAction();
                  setShowMonthEndConfirm(false);
                }}
                className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Execute Hard Reset
              </button>
              <button
                type="button"
                onClick={() => setShowMonthEndConfirm(false)}
                className="px-4 py-2 bg-white border border-beige-300 hover:bg-beige-50 text-dark-grey-800 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            id="manual-month-end-reset-btn"
            onClick={() => setShowMonthEndConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs font-semibold rounded-xl border border-beige-300 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Execute Hard Reset</span>
          </button>
        )}
      </div>

      {/* Reconfigure / Reset Onboarding Wizard */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
          <RotateCcw className="w-5 h-5 text-brown-700" />
          <span>Re-run Setup Wizard</span>
        </div>
        <p className="text-xs text-brown-700">
          Want to change your account structure (Single, Couple, Family, Roommates) or re-normalize incomes from scratch?
        </p>

        {showResetConfirm ? (
          <div className="p-4 bg-beige-100 border border-beige-300 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-dark-green-900">
              Are you sure you want to re-run the tutorial setup wizard?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetHouseholdToOnboarding}
                className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Yes, Re-open Setup Wizard
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-white border border-beige-300 hover:bg-beige-50 text-dark-grey-800 text-xs font-medium rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            id="reset-wizard-btn"
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs font-semibold rounded-xl border border-beige-300 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Re-open Tutorial Flow</span>
          </button>
        )}
      </div>
    </div>
  );
};
