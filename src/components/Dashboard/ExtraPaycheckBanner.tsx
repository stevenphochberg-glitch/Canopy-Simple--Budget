import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { ExtraPaycheckInfo, ExtraPaycheckDecision } from '../../types';
import { formatCurrency } from '../../lib/calculations';
import { Sparkles, PiggyBank, PieChart, Sliders, CalendarCheck, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface ExtraPaycheckBannerProps {
  extraInfo: ExtraPaycheckInfo;
}

export const ExtraPaycheckBanner: React.FC<ExtraPaycheckBannerProps> = ({ extraInfo }) => {
  const { household, categories, applyExtraPaycheckDecision } = useHousehold();

  const savedDecision = household?.extraPaycheckDecisions?.[extraInfo.monthKey];
  const [isEditing, setIsEditing] = useState<boolean>(!savedDecision);
  const [selectedOption, setSelectedOption] = useState<'savings' | 'prorate' | 'extra_week_buffer' | 'custom'>('savings');

  // Calculate weekly baseline sum for Option C
  const weeklyBaselineTotal = categories.reduce((sum, c) => sum + (Number(c.baselineBudget) || 0), 0);
  const optionCExtraWeekNeed = Math.min(extraInfo.totalExtraIncome, weeklyBaselineTotal);
  const optionCSavingsRemainder = Math.max(0, extraInfo.totalExtraIncome - optionCExtraWeekNeed);

  // Custom percentages state initialized evenly
  const [customPcts, setCustomPcts] = useState<Record<string, number>>(() => {
    if (savedDecision?.customPercentages) {
      return savedDecision.customPercentages;
    }
    const count = Math.max(1, categories.length);
    const base = Math.floor(100 / count);
    const initial: Record<string, number> = {};
    categories.forEach((cat, idx) => {
      initial[cat.id] = idx === 0 ? 100 - base * (count - 1) : base;
    });
    return initial;
  });

  const totalCustomPct = Object.values(customPcts).reduce((s: number, v: number) => s + (Number(v) || 0), 0);
  const isCustomPctValid = totalCustomPct === 100;

  const handleCustomPctChange = (catId: string, val: number) => {
    const safe = Math.max(0, Math.min(100, isNaN(val) ? 0 : val));
    setCustomPcts((prev) => ({ ...prev, [catId]: safe }));
  };

  const handleApply = async (option: 'savings' | 'prorate' | 'extra_week_buffer' | 'custom') => {
    const decision: ExtraPaycheckDecision = {
      monthKey: extraInfo.monthKey,
      option,
      customPercentages: option === 'custom' ? customPcts : undefined,
      totalExtraIncome: extraInfo.totalExtraIncome,
      extraWeekBufferAmount: option === 'extra_week_buffer' ? optionCExtraWeekNeed : undefined,
      savingsPortion: option === 'extra_week_buffer' ? optionCSavingsRemainder : option === 'savings' ? extraInfo.totalExtraIncome : undefined,
      appliedAt: Date.now(),
    };
    await applyExtraPaycheckDecision(decision);
    setIsEditing(false);
  };

  if (!extraInfo.isExtraPaycheckMonth || extraInfo.totalExtraIncome <= 0) {
    return null;
  }

  return (
    <div className="bg-sage-50/70 border-2 border-sage-300 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-dark-green-800 text-white rounded-2xl shadow-xs shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-sage-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-dark-green-800 bg-sage-100/90 border border-sage-200 px-2.5 py-0.5 rounded-full">
                Extra Paycheck Detected &bull; {extraInfo.fiscalMonthName} (Q{extraInfo.quarter})
              </span>
              {savedDecision && !isEditing && (
                <span className="text-[10px] font-bold text-dark-green-800 bg-sage-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-sage-600" /> Allocated
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-dark-green-950 mt-1">
              3-Paycheck Month: Forecasted{' '}
              <span className="text-dark-green-800 underline decoration-sage-400 decoration-2">
                +{formatCurrency(extraInfo.totalExtraIncome)}
              </span>{' '}
              in Extra Income
            </h3>
            <p className="text-xs text-dark-grey-600 mt-0.5">
              {extraInfo.memberBreakdown.map((b) => (
                <span key={b.memberId} className="mr-2">
                  <strong>{b.memberName}</strong> receives {b.expectedPaychecks} paychecks (+{formatCurrency(b.extraAmount)})
                </span>
              ))}
            </p>
          </div>
        </div>

        {savedDecision && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="self-start sm:self-center px-3.5 py-1.5 bg-white hover:bg-beige-100 text-dark-green-900 border border-beige-300 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            {isEditing ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Close Allocation
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Adjust Allocation
              </>
            )}
          </button>
        )}
      </div>

      {/* Decision Summary When Closed */}
      {savedDecision && !isEditing && (
        <div className="p-3 bg-white/90 border border-sage-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-dark-green-900 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-sage-600" />
            <span>
              Decision applied:{' '}
              <strong>
                {savedDecision.option === 'savings'
                  ? 'Option A: 100% to Household Savings'
                  : savedDecision.option === 'prorate'
                  ? 'Option B: Prorated Proportionally Across Categories'
                  : savedDecision.option === 'extra_week_buffer'
                  ? `Option C: Prorate for Extra Week (+${formatCurrency(savedDecision.extraWeekBufferAmount || optionCExtraWeekNeed)}) & Bank Remainder (+${formatCurrency(savedDecision.savingsPortion || optionCSavingsRemainder)})`
                  : 'Option D: Custom Category Split'}
              </strong>
            </span>
          </div>
          <span className="text-[11px] text-dark-grey-600 font-bold">
            Total Extra: +{formatCurrency(savedDecision.totalExtraIncome)}
          </span>
        </div>
      )}

      {/* Interactive Allocation Module */}
      {isEditing && (
        <div className="space-y-4 pt-2 border-t border-sage-200/60">
          <p className="text-xs font-bold text-dark-green-900">
            Choose how to distribute your +{formatCurrency(extraInfo.totalExtraIncome)} surplus:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Option A: 100% Savings */}
            <div
              onClick={() => setSelectedOption('savings')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between ${
                selectedOption === 'savings'
                  ? 'bg-white border-dark-green-800 ring-2 ring-dark-green-800/20 shadow-xs'
                  : 'bg-white/70 border-beige-200 hover:border-sage-300'
              }`}
            >
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-xl bg-sage-100 flex items-center justify-center text-dark-green-900">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-dark-green-900 text-sm">Option A: 100% Savings</h4>
                  <p className="text-[11px] text-brown-700 leading-relaxed mt-0.5">
                    Bank all +{formatCurrency(extraInfo.totalExtraIncome)} directly into your household savings buffer.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApply('savings');
                }}
                className="mt-3 w-full py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Deposit 100% to Savings
              </button>
            </div>

            {/* Option B: Baseline Prorate */}
            <div
              onClick={() => setSelectedOption('prorate')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between ${
                selectedOption === 'prorate'
                  ? 'bg-white border-dark-green-800 ring-2 ring-dark-green-800/20 shadow-xs'
                  : 'bg-white/70 border-beige-200 hover:border-sage-300'
              }`}
            >
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-xl bg-sage-100 flex items-center justify-center text-dark-green-900">
                  <PieChart className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-dark-green-900 text-sm">Option B: Baseline Prorate</h4>
                  <p className="text-[11px] text-brown-700 leading-relaxed mt-0.5">
                    Proportionally expand all category budgets to boost overall spending power.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApply('prorate');
                }}
                className="mt-3 w-full py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Prorate Proportionally
              </button>
            </div>

            {/* Option C: Prorate for Extra Week & Remainder to Savings */}
            <div
              onClick={() => setSelectedOption('extra_week_buffer')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between ${
                selectedOption === 'extra_week_buffer'
                  ? 'bg-white border-dark-green-800 ring-2 ring-dark-green-800/20 shadow-xs'
                  : 'bg-white/70 border-beige-200 hover:border-sage-300'
              }`}
            >
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-xl bg-sage-100 flex items-center justify-center text-dark-green-900">
                  <CalendarCheck className="w-4 h-4 text-dark-green-800" />
                </div>
                <div>
                  <h4 className="font-extrabold text-dark-green-900 text-sm">Option C: Prorate for Extra Week</h4>
                  <p className="text-[11px] text-brown-700 leading-relaxed mt-0.5">
                    Fund the 5th week (+{formatCurrency(optionCExtraWeekNeed)}) to maintain standard budget, banking remainder (+{formatCurrency(optionCSavingsRemainder)}) to savings.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleApply('extra_week_buffer');
                }}
                className="mt-3 w-full py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Fund Extra Week & Bank Remainder
              </button>
            </div>

            {/* Option D: Custom percentage split */}
            <div
              onClick={() => setSelectedOption('custom')}
              className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between ${
                selectedOption === 'custom'
                  ? 'bg-white border-dark-green-800 ring-2 ring-dark-green-800/20 shadow-xs'
                  : 'bg-white/70 border-beige-200 hover:border-sage-300'
              }`}
            >
              <div className="space-y-2">
                <div className="w-8 h-8 rounded-xl bg-sage-100 flex items-center justify-center text-dark-green-900">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-dark-green-900 text-sm">Option D: Custom Split</h4>
                  <p className="text-[11px] text-brown-700 leading-relaxed mt-0.5">
                    Choose specific percentage or dollar allocations across category buckets.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOption('custom')}
                className="mt-3 w-full py-2 bg-beige-100 hover:bg-beige-200 text-dark-green-900 rounded-xl text-xs font-bold transition border border-beige-300 cursor-pointer"
              >
                Configure Custom Split
              </button>
            </div>
          </div>

          {/* Custom Sliders Panel if Option D selected */}
          {selectedOption === 'custom' && (
            <div className="p-4 bg-white border border-beige-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-dark-green-900">Option D: Category Percentage Split</span>
                <span
                  className={`font-black ${
                    isCustomPctValid ? 'text-sage-800' : 'text-alert-red-600 font-extrabold'
                  }`}
                >
                  Total: {totalCustomPct}% / 100% {isCustomPctValid ? '✓' : '(Must equal 100%)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {categories.map((cat) => {
                  const pct = customPcts[cat.id] || 0;
                  const dollarAmt = Math.round((extraInfo.totalExtraIncome * pct) / 100);
                  return (
                    <div
                      key={cat.id}
                      className="p-2.5 bg-beige-50/70 border border-beige-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-dark-green-900 block truncate">{cat.name}</span>
                        <span className="text-[10px] text-dark-grey-600 font-medium">
                          +{formatCurrency(dollarAmt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={pct}
                          onChange={(e) => handleCustomPctChange(cat.id, parseInt(e.target.value, 10))}
                          className="w-14 px-2 py-1 bg-white border border-beige-300 rounded-lg text-xs font-bold text-dark-green-900 text-right focus:outline-none focus:border-dark-green-800"
                        />
                        <span className="font-semibold text-dark-grey-600">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={!isCustomPctValid}
                  onClick={() => handleApply('custom')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
                    isCustomPctValid
                      ? 'bg-dark-green-800 hover:bg-dark-green-900 text-white cursor-pointer'
                      : 'bg-beige-200 text-dark-grey-600 cursor-not-allowed opacity-60'
                  }`}
                >
                  Confirm Custom Allocation
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

