import React, { useMemo, useState } from 'react';
import { Expense, CheckIn, Category, Household } from '../../types';
import { formatCurrency, getCategoryEffectiveWeeklyBudget, getWeekId, isExpenseInDateRange } from '../../lib/calculations';
import { getFiscalTrackerInfo } from '../../lib/fiscal445';
import { AlertTriangle, ArrowRight, ShieldCheck, TrendingUp, X, Sparkles, AlertCircle } from 'lucide-react';

export interface CheckInImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetExpense: Expense;
  actionType: 'edit' | 'delete';
  proposedExpense?: Partial<Expense>;
  checkIn: CheckIn;
  categories: Category[];
  expenses: Expense[];
  household: Household | null;
  onConfirm: (simulatedValues: {
    bankedSavings: number;
    totalSpent: number;
    totalBudget: number;
    decisions: any[];
  }) => Promise<void>;
}

interface WaterfallState {
  totalBudget: number;
  totalSpent: number;
  grossTransferPot: number;
  netDeficit: number;
  overspendCoverage: number;
  protectedSavings: number;
  bankedSavings: number;
  decisions: any[];
}

function calculateWaterfall(
  expList: Expense[],
  checkIn: CheckIn,
  categories: Category[],
  household: Household | null
): WaterfallState {
  const fiscalYearEnd = household?.fiscalYearEndMonth || 12;
  const weekStart = new Date(checkIn.weekStartDate + (checkIn.weekStartDate.length === 10 ? 'T12:00:00' : ''));
  const weekEnd = new Date(checkIn.weekEndDate + (checkIn.weekEndDate.length === 10 ? 'T12:00:00' : ''));
  const weekRange = {
    startDate: weekStart,
    endDate: weekEnd,
    label: `${checkIn.weekStartDate} – ${checkIn.weekEndDate}`,
  };
  const weekId = getWeekId(weekRange, household?.firstDayOfWeek || 'Monday');

  const isBills = (c: Category) =>
    c.group?.toLowerCase() === 'bills' || c.name?.toLowerCase() === 'bills';
  const isSavings = (c: Category) =>
    c.type === 'savings' || c.group?.toLowerCase() === 'savings' || c.name?.toLowerCase().includes('saving');

  const expenseCategories = categories.filter((c) => !isBills(c) && !isSavings(c));
  const savingsCategories = categories.filter(isSavings);

  let baselineSavingsTarget = savingsCategories.reduce(
    (sum, c) => sum + (Number(c.baselineBudget) || 0),
    0
  );
  if (household?.weeklyOverrides?.[weekId]?.['cat_savings'] !== undefined) {
    baselineSavingsTarget = Number(household.weeklyOverrides[weekId]['cat_savings']);
  }

  let totalBudget = 0;
  let totalSpent = 0;
  let grossTransferPot = 0;
  let netDeficit = 0;

  const categoryDecisions: any[] = [];

  expenseCategories.forEach((cat) => {
    const effective = getCategoryEffectiveWeeklyBudget(cat, weekId, household);
    const budget = effective.budget;
    const spent = expList
      .filter((e) => e.categoryId === cat.id)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const diff = budget - spent;

    totalBudget += budget;
    totalSpent += spent;

    if (diff > 0) {
      grossTransferPot += diff;
    } else if (diff < 0) {
      netDeficit += Math.abs(diff);
    }
  });

  const coveredBySurplus = Math.min(grossTransferPot, netDeficit);
  const uncoveredDeficitAfterSurplus = Math.max(0, netDeficit - coveredBySurplus);
  const coveredBySavings = Math.min(baselineSavingsTarget, uncoveredDeficitAfterSurplus);
  const overspendCoverage = coveredBySurplus + coveredBySavings;

  const protectedSavings = Math.max(0, baselineSavingsTarget - coveredBySavings);
  const remainingSurplus = Math.max(0, grossTransferPot - coveredBySurplus);
  const bankedSavings = protectedSavings + remainingSurplus;

  expenseCategories.forEach((cat) => {
    const effective = getCategoryEffectiveWeeklyBudget(cat, weekId, household);
    const budget = effective.budget;
    const spent = expList
      .filter((e) => e.categoryId === cat.id)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const diff = budget - spent;

    if (diff > 0) {
      categoryDecisions.push({
        categoryId: cat.id,
        categoryName: cat.name,
        spent,
        budget,
        baselineBudget: effective.baseline,
        isOverridden: effective.isOverridden,
        difference: diff,
        choice: 'savings',
        underspendChoice: 'savings',
        isProrationDisabled: false,
        adjustmentPerWeek: 0,
        previousWeeklyBudget: budget,
        newWeeklyBudget: budget,
        savingsContribution: diff,
      });
    } else if (diff < 0) {
      categoryDecisions.push({
        categoryId: cat.id,
        categoryName: cat.name,
        spent,
        budget,
        baselineBudget: effective.baseline,
        isOverridden: effective.isOverridden,
        difference: diff,
        choice: 'deduct_savings',
        overspendChoice: 'deduct_savings',
        savingsDeduction: Math.min(baselineSavingsTarget, Math.abs(diff)),
        futureWeeklyReduction: 0,
        forcedFallbackApplied: false,
        effectiveSavingsReduced: Math.min(baselineSavingsTarget, Math.abs(diff)),
        adjustmentPerWeek: 0,
        previousWeeklyBudget: budget,
        newWeeklyBudget: budget,
        savingsContribution: 0,
      });
    } else {
      categoryDecisions.push({
        categoryId: cat.id,
        categoryName: cat.name,
        spent,
        budget,
        baselineBudget: effective.baseline,
        isOverridden: effective.isOverridden,
        difference: 0,
        choice: 'savings',
        underspendChoice: 'savings',
        isProrationDisabled: false,
        adjustmentPerWeek: 0,
        previousWeeklyBudget: budget,
        newWeeklyBudget: budget,
        savingsContribution: 0,
      });
    }
  });

  return {
    totalBudget,
    totalSpent,
    grossTransferPot,
    netDeficit,
    overspendCoverage,
    protectedSavings,
    bankedSavings,
    decisions: categoryDecisions,
  };
}

export const CheckInImpactModal: React.FC<CheckInImpactModalProps> = ({
  isOpen,
  onClose,
  targetExpense,
  actionType,
  proposedExpense,
  checkIn,
  categories,
  expenses,
  household,
  onConfirm,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  // 1. Identify all week expenses
  const weekExpenses = useMemo(() => {
    const wStart = new Date(checkIn.weekStartDate + (checkIn.weekStartDate.length === 10 ? 'T00:00:00' : ''));
    const wEnd = new Date(checkIn.weekEndDate + (checkIn.weekEndDate.length === 10 ? 'T23:59:59' : ''));
    return expenses.filter((e) => isExpenseInDateRange(e, wStart, wEnd));
  }, [expenses, checkIn]);

  // 2. Compute Run 1: Current State
  const currentState = useMemo(() => {
    return calculateWaterfall(weekExpenses, checkIn, categories, household);
  }, [weekExpenses, checkIn, categories, household]);

  // 3. Compute Run 2: Simulated State
  const simulatedState = useMemo(() => {
    let simulatedExpList: Expense[] = [];
    if (actionType === 'delete') {
      simulatedExpList = weekExpenses.filter((e) => e.id !== targetExpense.id);
    } else {
      simulatedExpList = weekExpenses.map((e) =>
        e.id === targetExpense.id ? ({ ...e, ...(proposedExpense || {}) } as Expense) : e
      );
    }
    return calculateWaterfall(simulatedExpList, checkIn, categories, household);
  }, [weekExpenses, actionType, targetExpense, proposedExpense, checkIn, categories, household]);

  if (!isOpen) return null;

  // Fiscal tracker format for display
  const weekStart = new Date(checkIn.weekStartDate + (checkIn.weekStartDate.length === 10 ? 'T12:00:00' : ''));
  const trackerInfo = getFiscalTrackerInfo(weekStart, household?.fiscalYearEndMonth || 12);
  const weekLabel = `W${trackerInfo.weekOfFiscalMonth}`;
  const fullFiscalString = `W${trackerInfo.weekOfFiscalYear} of Fiscal Year | W${trackerInfo.weekOfFiscalMonth} of ${trackerInfo.monthWeekCount} for M${trackerInfo.fiscalMonthNumber}`;

  const targetCat = categories.find((c) => c.id === targetExpense.categoryId);
  const catName = targetCat?.name || 'Category';

  const oldAmount = targetExpense.amount;
  const newAmount = proposedExpense?.amount !== undefined ? proposedExpense.amount : targetExpense.amount;
  const delta = simulatedState.bankedSavings - currentState.bankedSavings;

  const handleConfirmAction = async () => {
    setIsConfirming(true);
    try {
      await onConfirm({
        bankedSavings: simulatedState.bankedSavings,
        totalSpent: simulatedState.totalSpent,
        totalBudget: simulatedState.totalBudget,
        decisions: simulatedState.decisions,
      });
      onClose();
    } catch (err) {
      console.error('Failed to confirm check-in impact recalculation:', err);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-dark-green-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-beige-300 animate-in zoom-in-95 duration-200 space-y-0">
        {/* Warning Header Banner (Semantic Amber / Earth-Tone Warning) */}
        <div className="bg-amber-50 border-b border-amber-200/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0 shadow-2xs">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-950">
                Historical Check-In Impact
              </h3>
              <span className="text-[10px] font-mono font-bold text-amber-800">
                {fullFiscalString}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="p-1.5 text-brown-600 hover:text-dark-green-950 hover:bg-amber-100/60 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Dynamic Summary Text */}
          <div className="p-4 bg-beige-50 rounded-2xl border border-beige-200 text-xs sm:text-sm text-dark-green-950 leading-relaxed">
            {actionType === 'delete' ? (
              <span>
                You are deleting a <strong className="font-bold text-dark-green-900">{formatCurrency(oldAmount)}</strong> transaction from <strong className="font-bold text-dark-green-900">{catName}</strong> during a completed check-in week (<strong className="font-bold text-dark-green-900">{weekLabel}</strong>).
              </span>
            ) : (
              <span>
                You are modifying a <strong className="font-bold text-dark-green-900">{catName}</strong> transaction from <strong className="font-bold text-dark-green-900">{formatCurrency(oldAmount)}</strong> to <strong className="font-bold text-dark-green-900">{formatCurrency(newAmount)}</strong> during a completed check-in week (<strong className="font-bold text-dark-green-900">{weekLabel}</strong>).
              </span>
            )}
          </div>

          {/* Comparison Matrix: Before & After States for 3 Critical Metrics */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-brown-700 block">
              Waterfall Recalculation (Before vs. After)
            </span>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Metric 1: Overspend Coverage */}
              <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-beige-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-beige-100 flex items-center justify-center text-brown-700 shrink-0">
                    <ShieldCheck className="w-4 h-4 text-brown-700" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-dark-green-900 block">
                      Overspend Coverage
                    </span>
                    <span className="text-[10px] text-brown-600 block">
                      Deficit covered by pot & savings
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs sm:text-sm font-bold">
                  <span className="text-brown-700">
                    {formatCurrency(currentState.overspendCoverage)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-brown-400" />
                  <span
                    className={
                      simulatedState.overspendCoverage < currentState.overspendCoverage
                        ? 'text-emerald-700 font-black'
                        : simulatedState.overspendCoverage > currentState.overspendCoverage
                        ? 'text-amber-700 font-black'
                        : 'text-dark-green-900 font-black'
                    }
                  >
                    {formatCurrency(simulatedState.overspendCoverage)}
                  </span>
                </div>
              </div>

              {/* Metric 2: Protected Savings */}
              <div className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-beige-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sage-100 flex items-center justify-center text-dark-green-800 shrink-0">
                    <ShieldCheck className="w-4 h-4 text-dark-green-800" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-dark-green-900 block">
                      Protected Savings
                    </span>
                    <span className="text-[10px] text-brown-600 block">
                      Baseline savings intact
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs sm:text-sm font-bold">
                  <span className="text-brown-700">
                    {formatCurrency(currentState.protectedSavings)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-brown-400" />
                  <span
                    className={
                      simulatedState.protectedSavings > currentState.protectedSavings
                        ? 'text-emerald-700 font-black'
                        : simulatedState.protectedSavings < currentState.protectedSavings
                        ? 'text-amber-700 font-black'
                        : 'text-dark-green-900 font-black'
                    }
                  >
                    {formatCurrency(simulatedState.protectedSavings)}
                  </span>
                </div>
              </div>

              {/* Metric 3: Total Banked Savings */}
              <div className="flex items-center justify-between p-3.5 bg-sage-50/70 rounded-2xl border border-sage-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-sage-200/80 flex items-center justify-center text-dark-green-900 shrink-0">
                    <TrendingUp className="w-4 h-4 text-dark-green-900" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-dark-green-950 block">
                      Total Banked Savings
                    </span>
                    <span className="text-[10px] text-dark-green-800 block">
                      Final net banked for {weekLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs sm:text-sm font-bold">
                  <span className="text-brown-700">
                    {formatCurrency(currentState.bankedSavings)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-dark-green-600" />
                  <span
                    className={`text-sm font-black ${
                      delta > 0
                        ? 'text-emerald-700'
                        : delta < 0
                        ? 'text-amber-700'
                        : 'text-dark-green-950'
                    }`}
                  >
                    {formatCurrency(simulatedState.bankedSavings)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Resolution Message */}
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
              delta >= 0
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/70 border-amber-200 text-amber-950'
            }`}
          >
            {delta >= 0 ? (
              <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            )}
            <p className="leading-relaxed font-semibold">
              {delta >= 0
                ? `This change frees up ${formatCurrency(delta)}. These funds will be automatically routed to your Banked Savings for ${weekLabel}.`
                : `This change requires an additional ${formatCurrency(Math.abs(delta))}. Your Banked Savings for ${weekLabel} will be reduced to cover the difference.`}
            </p>
          </div>
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="p-4 sm:p-6 bg-beige-50/60 border-t border-beige-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-brown-700 hover:text-dark-green-950 hover:bg-beige-100 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmAction}
            disabled={isConfirming}
            className="w-full sm:w-auto px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isConfirming ? (
              <span>Rebalancing Check-In...</span>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-beige-300" />
                <span>Confirm & Update Check-In</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
