import React from 'react';
import { HouseholdMember, PaySchedule } from '../../types';
import { normalizeToWeekly, formatCurrency, calculateWeeklyPool } from '../../lib/calculations';
import { ArrowLeft, ArrowRight, DollarSign, Calculator, HelpCircle, Check, User } from 'lucide-react';

interface IncomeStepProps {
  members: HouseholdMember[];
  setMembers: React.Dispatch<React.SetStateAction<HouseholdMember[]>>;
  onNext: () => void;
  onBack: () => void;
}

const SCHEDULE_OPTIONS: Array<{ value: PaySchedule; label: string; formula: string }> = [
  { value: 'weekly', label: 'Weekly', formula: 'Amount / week' },
  { value: 'bi-weekly', label: 'Bi-Weekly (Every 2 wks)', formula: '(Amount × 26) ÷ 52' },
  { value: 'monthly', label: 'Monthly', formula: '(Amount × 12) ÷ 52' },
];

export const IncomeStep: React.FC<IncomeStepProps> = ({
  members,
  setMembers,
  onNext,
  onBack,
}) => {
  const totalWeeklyPool = calculateWeeklyPool(members);

  const handleIncomeChange = (userId: string, value: number) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.userId === userId) {
          const raw = isNaN(value) ? 0 : Math.max(0, value);
          const normalized = m.hasProvidedIncome ? normalizeToWeekly(raw, m.incomeSchedule) : 0;
          return {
            ...m,
            rawIncome: raw,
            normalizedWeeklyIncome: normalized,
          };
        }
        return m;
      })
    );
  };

  const handleScheduleChange = (userId: string, schedule: PaySchedule) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.userId === userId) {
          const normalized = m.hasProvidedIncome ? normalizeToWeekly(m.rawIncome, schedule) : 0;
          return {
            ...m,
            incomeSchedule: schedule,
            normalizedWeeklyIncome: normalized,
          };
        }
        return m;
      })
    );
  };

  const handleToggleSelfInput = (userId: string, willInputSelf: boolean) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.userId === userId) {
          const hasProvided = !willInputSelf;
          const normalized = hasProvided ? normalizeToWeekly(m.rawIncome, m.incomeSchedule) : 0;
          return {
            ...m,
            hasProvidedIncome: hasProvided,
            normalizedWeeklyIncome: normalized,
          };
        }
        return m;
      })
    );
  };

  const handleNameChange = (userId: string, name: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, name } : m))
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-2xl font-bold text-dark-green-900">Income & Weekly Normalization</h2>
        <p className="text-sm text-brown-700">
          Enter income schedules to automatically normalize and convert them into your unified weekly budget pool.
        </p>
      </div>

      {/* Unified Weekly Pool Callout Card */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-sage-100 to-beige-100 border border-sage-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-dark-green-800 text-white rounded-xl shadow-sm">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-dark-green-800">
              Total Household Budget Pool
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-dark-green-900">
              {formatCurrency(totalWeeklyPool)}
              <span className="text-sm font-medium text-brown-700 ml-1.5">/ week</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-dark-green-900 bg-white/80 border border-sage-200 px-3.5 py-2 rounded-xl text-center sm:text-right">
          <p className="font-semibold">Normalized Baseline</p>
          <p className="text-dark-grey-600">
            {formatCurrency(totalWeeklyPool * 52 / 12)} / month equivalent
          </p>
        </div>
      </div>

      {/* Member Roster Income Cards */}
      <div className="space-y-4">
        {members.map((member, idx) => {
          const isOwner = idx === 0;
          return (
            <div
              key={member.userId}
              className="p-4 sm:p-5 bg-white border border-beige-200 rounded-xl space-y-4 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-beige-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-sage-300"
                    />
                    {isOwner && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-dark-green-800 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                        ★
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      id={`member-name-input-${member.userId}`}
                      value={member.name}
                      onChange={(e) => handleNameChange(member.userId, e.target.value)}
                      placeholder="Member Name"
                      className="font-bold text-dark-green-900 text-base bg-transparent border-b border-transparent hover:border-beige-300 focus:border-dark-green-700 focus:outline-none px-1"
                    />
                    <p className="text-xs text-dark-grey-600 px-1">
                      {isOwner ? 'Primary Account Creator' : `Household Member #${idx + 1}`}
                    </p>
                  </div>
                </div>

                {!isOwner && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-brown-800 bg-beige-50 px-3 py-1.5 rounded-lg border border-beige-200 hover:bg-beige-100">
                    <input
                      type="checkbox"
                      id={`toggle-self-input-${member.userId}`}
                      checked={!member.hasProvidedIncome}
                      onChange={(e) => handleToggleSelfInput(member.userId, e.target.checked)}
                      className="rounded border-beige-300 text-dark-green-700 focus:ring-dark-green-600 h-4 w-4"
                    />
                    <span>They will input their own income when they sign in</span>
                  </label>
                )}
              </div>

              {member.hasProvidedIncome ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                  {/* Income Amount */}
                  <div className="sm:col-span-5 space-y-1">
                    <label
                      htmlFor={`income-amount-${member.userId}`}
                      className="text-xs font-semibold text-dark-grey-800 block"
                    >
                      Take-Home Income Amount
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-grey-600">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <input
                        type="number"
                        id={`income-amount-${member.userId}`}
                        min="0"
                        step="50"
                        value={member.rawIncome || ''}
                        onChange={(e) => handleIncomeChange(member.userId, parseFloat(e.target.value))}
                        placeholder="e.g. 2500"
                        className="w-full pl-9 pr-3 py-2.5 bg-beige-50/50 border border-beige-300 rounded-xl text-dark-green-900 font-semibold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-dark-green-700/20 focus:border-dark-green-700"
                      />
                    </div>
                  </div>

                  {/* Pay Frequency */}
                  <div className="sm:col-span-4 space-y-1">
                    <label
                      htmlFor={`pay-schedule-${member.userId}`}
                      className="text-xs font-semibold text-dark-grey-800 block"
                    >
                      Pay Schedule
                    </label>
                    <select
                      id={`pay-schedule-${member.userId}`}
                      value={member.incomeSchedule}
                      onChange={(e) =>
                        handleScheduleChange(member.userId, e.target.value as PaySchedule)
                      }
                      className="w-full px-3 py-2.5 bg-beige-50/50 border border-beige-300 rounded-xl text-dark-green-900 font-medium text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-dark-green-700/20 focus:border-dark-green-700 cursor-pointer"
                    >
                      {SCHEDULE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Normalized Result Pill */}
                  <div className="sm:col-span-3">
                    <div className="p-2.5 rounded-xl bg-sage-50 border border-sage-200 text-center sm:text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 block">
                        Weekly Normalized
                      </span>
                      <span className="text-base font-extrabold text-dark-green-900">
                        {formatCurrency(member.normalizedWeeklyIncome)}
                        <span className="text-xs font-normal text-brown-700">/wk</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-beige-50 border border-dashed border-beige-300 rounded-xl text-xs text-brown-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span>
                    Income will be marked as <strong>Pending</strong> until {member.name} joins with the sync code and inputs their details.
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Actions */}
      <div className="pt-4 flex items-center justify-between">
        <button
          type="button"
          id="income-step-back-btn"
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 border border-beige-300 hover:bg-beige-100 text-dark-green-900 font-semibold text-sm rounded-xl transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          id="income-step-next-btn"
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 bg-dark-green-800 hover:bg-dark-green-900 text-white font-semibold text-sm rounded-xl transition shadow-sm cursor-pointer"
        >
          <span>Continue to Calendar</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
