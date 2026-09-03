import React from 'react';
import { HouseholdMember, PaySchedule, IncomeType } from '../../types';
import { normalizeToWeekly, formatCurrency, calculateWeeklyPool } from '../../lib/calculations';
import { FISCAL_MONTH_NAMES } from '../../lib/fiscal445';
import { ArrowLeft, ArrowRight, DollarSign, Calculator, Calendar, User, Shield, TrendingUp, Sparkles } from 'lucide-react';

interface IncomeStepProps {
  members: HouseholdMember[];
  setMembers: React.Dispatch<React.SetStateAction<HouseholdMember[]>>;
  fiscalYearEndMonth: number;
  setFiscalYearEndMonth: (m: number) => void;
  incomeType?: IncomeType;
  setIncomeType?: (t: IncomeType) => void;
  baselineWeeklyBurnRate?: number;
  setBaselineWeeklyBurnRate?: (r: number) => void;
  initialBufferAmount?: number;
  setInitialBufferAmount?: (a: number) => void;
  onNext: () => void;
  onBack: () => void;
}

const SCHEDULE_OPTIONS: Array<{ value: PaySchedule; label: string; formula: string }> = [
  { value: 'weekly', label: 'Weekly', formula: 'Amount / week' },
  { value: 'bi-weekly', label: 'Bi-Weekly (Every 2 wks)', formula: '(Amount × 26) ÷ 52' },
  { value: 'semi-monthly', label: 'Semi-Monthly (Twice a month)', formula: '(Amount × 24) ÷ 52' },
  { value: 'monthly', label: 'Monthly', formula: '(Amount × 12) ÷ 52' },
];

export const IncomeStep: React.FC<IncomeStepProps> = ({
  members,
  setMembers,
  fiscalYearEndMonth,
  setFiscalYearEndMonth,
  incomeType = 'predictable',
  setIncomeType,
  baselineWeeklyBurnRate = 0,
  setBaselineWeeklyBurnRate,
  initialBufferAmount = 0,
  setInitialBufferAmount,
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

  const handleLastPayDateChange = (userId: string, dateStr: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, lastPayDate: dateStr } : m))
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
        <h2 className="text-2xl font-bold text-dark-green-900">Income & Dynamic Pay Cadence</h2>
        <p className="text-sm text-brown-700">
          Set up your household pay frequency, paycheck timing, and fiscal year calendar to forecast extra paycheck months.
        </p>
      </div>

      {/* Income Structure Type Selection */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 block">
            Income Structure Type
          </label>
          <span className="text-[11px] text-brown-700">Choose how your household earns</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            id="income-type-predictable-btn"
            onClick={() => setIncomeType?.('predictable')}
            className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              incomeType === 'predictable'
                ? 'bg-sage-50/80 border-dark-green-800 ring-2 ring-dark-green-800/20'
                : 'bg-white border-beige-200 hover:border-beige-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-extrabold text-sm text-dark-green-900">Predictable Income</span>
              <Calendar className="w-4 h-4 text-sage-700" />
            </div>
            <p className="text-xs text-brown-700 leading-relaxed">
              Steady, regular paychecks (salaried, hourly, bi-weekly, or monthly). Automatic 4-4-5 extra paycheck detection.
            </p>
          </button>

          <button
            type="button"
            id="income-type-variable-btn"
            onClick={() => {
              setIncomeType?.('variable');
              if (setBaselineWeeklyBurnRate && baselineWeeklyBurnRate === 0) {
                setBaselineWeeklyBurnRate(totalWeeklyPool > 0 ? totalWeeklyPool : 1500);
              }
              if (setInitialBufferAmount && initialBufferAmount === 0) {
                setInitialBufferAmount(totalWeeklyPool > 0 ? totalWeeklyPool * 4 : 6000);
              }
            }}
            className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              incomeType === 'variable'
                ? 'bg-sage-50/80 border-dark-green-800 ring-2 ring-dark-green-800/20'
                : 'bg-white border-beige-200 hover:border-beige-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-extrabold text-sm text-dark-green-900">Variable / Freelance</span>
              <Shield className="w-4 h-4 text-dark-green-800" />
            </div>
            <p className="text-xs text-brown-700 leading-relaxed">
              Fluctuating or irregular deposits. Earnings feed a dedicated Income Buffer tank, with automated weekly drawdown.
            </p>
          </button>
        </div>

        {/* Variable Income Configuration Panel */}
        {incomeType === 'variable' && (
          <div className="pt-3 border-t border-beige-200/80 space-y-4">
            <div className="p-3.5 bg-dark-green-900 text-white rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-sage-200">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Automated Buffer Drawdown Architecture</span>
              </div>
              <p className="text-sage-100/90 leading-relaxed">
                In variable income mode, an <strong>Income Buffer</strong> category is generated. Income flows into the buffer, and at the start of each fiscal week, Canopy automatically draws down funds to fill your baseline budget allocations.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label
                  htmlFor="baseline-burn-rate-input"
                  className="text-xs font-bold text-dark-green-900 block"
                >
                  Baseline Weekly Burn Rate ($/wk)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-brown-600 font-bold">$</span>
                  <input
                    type="number"
                    id="baseline-burn-rate-input"
                    min="0"
                    step="50"
                    value={baselineWeeklyBurnRate || ''}
                    onChange={(e) => setBaselineWeeklyBurnRate?.(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="1200"
                    className="w-full pl-7 pr-3 py-2 bg-beige-50/50 border border-beige-300 rounded-xl text-dark-green-900 font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-dark-green-700/20"
                  />
                </div>
                <span className="text-[10px] text-brown-700">Minimum essentials required per week</span>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="initial-buffer-amount-input"
                  className="text-xs font-bold text-dark-green-900 block"
                >
                  Initial Income Buffer Reserve ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-brown-600 font-bold">$</span>
                  <input
                    type="number"
                    id="initial-buffer-amount-input"
                    min="0"
                    step="100"
                    value={initialBufferAmount || ''}
                    onChange={(e) => setInitialBufferAmount?.(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="5000"
                    className="w-full pl-7 pr-3 py-2 bg-beige-50/50 border border-beige-300 rounded-xl text-dark-green-900 font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-dark-green-700/20"
                  />
                </div>
                <span className="text-[10px] text-brown-700">Initial cash buffer on hand</span>
              </div>
            </div>
          </div>
        )}
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
            {formatCurrency((totalWeeklyPool * 52) / 12)} / month equivalent
          </p>
        </div>
      </div>

      {/* Household Fiscal Year-End Configuration */}
      <div className="p-4 sm:p-5 bg-white border border-beige-200 rounded-2xl space-y-2 shadow-xs">
        <div className="flex items-center gap-2 text-dark-green-900 font-extrabold text-sm">
          <Calendar className="w-4 h-4 text-sage-700" />
          <span>Household Fiscal Year-End Month</span>
        </div>
        <p className="text-xs text-brown-700">
          Used to calculate the 4-4-5 accounting calendar (four 13-week quarters: 4-4-5 weeks).
        </p>
        <div className="pt-1 max-w-sm">
          <select
            id="fiscal-year-end-month-select"
            value={fiscalYearEndMonth}
            onChange={(e) => setFiscalYearEndMonth(parseInt(e.target.value, 10))}
            className="w-full px-3.5 py-2.5 bg-beige-50/70 border border-beige-300 rounded-xl text-dark-green-900 font-bold text-sm focus:bg-white focus:outline-none focus:border-dark-green-700 cursor-pointer"
          >
            {FISCAL_MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name} (Month {idx + 1}) {idx === 11 ? '— Standard (Default)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Member Roster Income Cards */}
      <div className="space-y-4">
        {members.map((member, idx) => {
          const isOwner = idx === 0;
          return (
            <div
              key={member.userId}
              className="p-4 sm:p-5 bg-white border border-beige-200 rounded-2xl space-y-4 shadow-sm"
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
                  <div className="sm:col-span-4 space-y-1">
                    <label
                      htmlFor={`income-amount-${member.userId}`}
                      className="text-xs font-semibold text-dark-grey-800 block"
                    >
                      Take-Home Paycheck ($)
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
                      Pay Frequency
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

                  {/* Date of Last Paycheck */}
                  <div className="sm:col-span-4 space-y-1">
                    <label
                      htmlFor={`last-pay-date-${member.userId}`}
                      className="text-xs font-semibold text-dark-grey-800 block"
                    >
                      Date of Last Paycheck
                    </label>
                    <input
                      type="date"
                      id={`last-pay-date-${member.userId}`}
                      value={member.lastPayDate || ''}
                      onChange={(e) => handleLastPayDateChange(member.userId, e.target.value)}
                      className="w-full px-3 py-2.5 bg-beige-50/50 border border-beige-300 rounded-xl text-dark-green-900 font-medium text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-dark-green-700/20 focus:border-dark-green-700 cursor-pointer"
                    />
                  </div>

                  {/* Normalized Result Banner */}
                  <div className="sm:col-span-12 pt-1">
                    <div className="p-2.5 rounded-xl bg-sage-50 border border-sage-200 flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-sage-800">
                        Weekly Normalized Income:
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-dark-green-900">
                        {formatCurrency(member.normalizedWeeklyIncome)}
                        <span className="text-xs font-normal text-brown-700 ml-1">/ week</span>
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
