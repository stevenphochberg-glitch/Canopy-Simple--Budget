import React, { useState } from 'react';
import { CategoryType } from '../../types';
import { formatCurrency } from '../../lib/calculations';

interface BudgetProgressBarProps {
  categoryType: CategoryType;
  spent: number;
  budget: number;
  heightClass?: string;
  className?: string;
  showSurplusSplit?: boolean;
  surplusChoice?: 'rollover' | 'savings' | null;
  prorateLabel?: string;
  savingsLabel?: string;
  overspendCoverageAmount?: number;
  leftoverSurplusAmount?: number;
}

/**
 * Stepped Solid Color Logic for Savings Progress Bar:
 * - 1% - 33%: Solid Sage Green (bg-sage-600)
 * - 34% - 50%: Solid Standard Green (bg-dark-green-400)
 * - 51% - 66%: Solid Darker Green (bg-dark-green-600)
 * - 67% - 75%: Increase hue darkness further (bg-dark-green-700)
 * - 76% - 90%: Increase darkness and saturation further (bg-dark-green-800)
 * - 91% - 100%: Highest saturation of the dark green hue (bg-dark-green-950)
 * - 100% (Goal Met): Retains full solid background fill AND receives a thick solid green border
 */
export function getSavingsProgressFillColor(percentage: number): string {
  if (percentage >= 91) return 'bg-dark-green-950';
  if (percentage >= 76) return 'bg-dark-green-800';
  if (percentage >= 67) return 'bg-dark-green-700';
  if (percentage >= 51) return 'bg-dark-green-600';
  if (percentage >= 34) return 'bg-dark-green-400';
  return 'bg-sage-600';
}

export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({
  categoryType,
  spent,
  budget,
  heightClass = 'h-5 sm:h-5.5',
  className = '',
  showSurplusSplit = false,
  surplusChoice = null,
  prorateLabel = 'Prorated',
  savingsLabel = 'Sent to savings',
  overspendCoverageAmount,
  leftoverSurplusAmount,
}) => {
  const [spentMode, setSpentMode] = useState<'desc' | 'amount' | 'percent'>('desc');
  const [coverageMode, setCoverageMode] = useState<'desc' | 'amount' | 'percent'>('desc');
  const [surplusMode, setSurplusMode] = useState<'desc' | 'amount' | 'percent'>('desc');
  const [standardMode, setStandardMode] = useState<'desc' | 'amount' | 'percent'>('desc');

  const cycleMode = (current: 'desc' | 'amount' | 'percent') => {
    if (current === 'desc') return 'amount';
    if (current === 'amount') return 'percent';
    return 'desc';
  };

  const isSavings = categoryType === 'savings';
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const isOverBudget = !isSavings && (percentage >= 100 || spent > budget);
  const isAchievedSavings = isSavings && percentage >= 100;

  // Expense Progress Bar Color Logic (Pre & Standard):
  // 1% – 74%: Muted Sage Green fill
  // 75% – 89%: Earth-tone Brown fill
  // 90% – 99%: Alert Red fill
  // >= 100% (Overbudget): Outline the entire progress bar in Alert Red + Alert Red fill
  let expenseFillColor = 'bg-sage-600';
  if (percentage >= 90) {
    expenseFillColor = 'bg-alert-red-600';
  } else if (percentage >= 75) {
    expenseFillColor = 'bg-brown-700';
  } else {
    expenseFillColor = 'bg-sage-600';
  }

  // Savings Progress Bar Color (Solid Stepped Fill)
  const savingsFillColor = getSavingsProgressFillColor(percentage);

  // Container styling:
  let containerBorderClass = 'border border-beige-300/90 bg-beige-100/60 p-0.5 shadow-2xs';
  if (isOverBudget) {
    // Overbudget red outline matching regular red
    containerBorderClass = 'border-2 border-alert-red-500 ring-2 ring-alert-red-500/20 bg-alert-red-100/40 p-0.5';
  } else if (isSavings && isAchievedSavings) {
    // 100% (Goal Met): Retains full solid background fill AND receives a thick, solid green border/outline.
    containerBorderClass = 'border-2 border-dark-green-800 ring-2 ring-dark-green-800/30 bg-beige-100 p-0.5';
  }

  // 1. OVERBUDGET EXPENSE STATE:
  // If spent > budget (or percentage >= 100), fill to 100% width with regular semantic red
  if (isOverBudget) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setStandardMode((prev) => cycleMode(prev));
        }}
        className={`w-full ${heightClass} rounded-full overflow-hidden relative ${containerBorderClass} ${className} cursor-pointer hover:brightness-105 active:scale-98 select-none`}
        title={`Over budget: ${Math.round(percentage)}% (${formatCurrency(spent)}/${formatCurrency(budget)}) - Click to toggle display`}
      >
        <div className="h-full w-full bg-alert-red-600 rounded-full transition-all duration-500 ease-out flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-brown-100 px-1">
          {standardMode === 'amount' ? (
            <span className="truncate text-brown-100 drop-shadow-xs font-black">{formatCurrency(spent)}</span>
          ) : standardMode === 'percent' ? (
            <span className="truncate text-brown-100 drop-shadow-xs font-black">{Math.round(percentage)}%</span>
          ) : null}
        </div>
      </div>
    );
  }

  // 2. POST-CHECK-IN EXPENSE STACKED SPLIT VIEW (when surplus was resolved for an expense):
  if (!isSavings && showSurplusSplit && percentage < 100) {
    const activeHeight = heightClass === 'h-2.5' ? 'h-5 sm:h-5.5' : heightClass;
    const spentPercent = Math.max(0, Math.min(100, percentage));
    const totalRemainingPercent = Math.max(0, 100 - spentPercent);

    // Calculate proportional split between Overspend Coverage and Leftover Surplus
    let coveragePercent = 0;
    let leftoverPercent = totalRemainingPercent;

    if (overspendCoverageAmount !== undefined || leftoverSurplusAmount !== undefined) {
      const covAmt = overspendCoverageAmount || 0;
      const leftAmt = leftoverSurplusAmount || 0;
      const totalSurplus = covAmt + leftAmt;
      if (totalSurplus > 0) {
        coveragePercent = Math.max(0, (covAmt / totalSurplus) * totalRemainingPercent);
        leftoverPercent = Math.max(0, totalRemainingPercent - coveragePercent);
      }
    }

    return (
      <div
        className={`w-full ${activeHeight} rounded-full border border-beige-300/90 bg-beige-100/60 p-0.5 flex items-center gap-1.5 sm:gap-2 relative shadow-2xs ${className}`}
      >
        {/* Spent portion Pill */}
        {spentPercent > 0 && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setSpentMode((prev) => cycleMode(prev));
            }}
            className="h-full bg-sage-600 text-brown-100 rounded-full transition-all duration-300 relative flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1.5 overflow-hidden whitespace-nowrap cursor-pointer hover:brightness-110 active:scale-95 select-none"
            style={{ width: `${spentPercent}%` }}
            title={`Spent: ${formatCurrency(spent)} (${spentPercent.toFixed(1)}%) - Click to toggle display`}
          >
            <span className="truncate text-brown-100 drop-shadow-xs select-none">
              {spentMode === 'desc'
                ? 'Spent'
                : spentMode === 'amount'
                ? formatCurrency(spent)
                : `${Math.round(spentPercent)}%`}
            </span>
          </div>
        )}

        {/* Overspend Coverage Portion (Brown Pill) */}
        {coveragePercent > 0 && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setCoverageMode((prev) => cycleMode(prev));
            }}
            className="h-full bg-brown-700 text-[#F5F5DC] rounded-full transition-all duration-300 relative flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1.5 tracking-tight truncate overflow-hidden whitespace-nowrap flex-shrink-0 cursor-pointer hover:brightness-110 active:scale-95 select-none"
            style={{ width: `${coveragePercent}%` }}
            title={`Overspend coverage: ${formatCurrency(overspendCoverageAmount || 0)} (${coveragePercent.toFixed(1)}%) - Click to toggle display`}
          >
            <span className="truncate text-[#F5F5DC] drop-shadow-xs select-none">
              {coverageMode === 'desc'
                ? 'Coverage'
                : coverageMode === 'amount'
                ? formatCurrency(overspendCoverageAmount || 0)
                : `${Math.round(coveragePercent)}%`}
            </span>
          </div>
        )}

        {/* Surplus Portion Pill */}
        {leftoverPercent > 0 && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setSurplusMode((prev) => cycleMode(prev));
            }}
            className={`h-full transition-all duration-300 relative flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white px-1.5 rounded-full tracking-tight truncate overflow-hidden whitespace-nowrap cursor-pointer hover:brightness-110 active:scale-95 select-none ${
              surplusChoice === 'rollover'
                ? 'bg-sky-blue-500'
                : 'bg-dark-green-800'
            }`}
            style={{ width: `${leftoverPercent}%` }}
            title={`${surplusChoice === 'rollover' ? prorateLabel : savingsLabel}: ${formatCurrency(leftoverSurplusAmount || 0)} (${leftoverPercent.toFixed(1)}%) - Click to toggle display`}
          >
            <span className="truncate drop-shadow-xs select-none">
              {surplusMode === 'desc'
                ? surplusChoice === 'rollover'
                  ? prorateLabel
                  : savingsLabel
                : surplusMode === 'amount'
                ? formatCurrency(leftoverSurplusAmount || 0)
                : `${Math.round(leftoverPercent)}%`}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 3. STANDARD SOLID PROGRESS BAR (Savings & Expense):
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setStandardMode((prev) => cycleMode(prev));
      }}
      className={`w-full ${heightClass} rounded-full overflow-hidden relative ${containerBorderClass} ${className} cursor-pointer hover:brightness-105 active:scale-98 select-none`}
      title={`${categoryType === 'savings' ? 'Savings' : 'Spent'}: ${formatCurrency(spent)} / ${formatCurrency(budget)} (${Math.round(percentage)}%) - Click to toggle display`}
    >
      <div
        className={`h-full transition-all duration-500 ease-out rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white px-1 ${
          isSavings ? savingsFillColor : expenseFillColor
        }`}
        style={{
          width: `${Math.min(100, Math.max(0, percentage))}%`,
        }}
      >
        {standardMode === 'amount' ? (
          <span className="truncate drop-shadow-xs">{formatCurrency(spent)}</span>
        ) : standardMode === 'percent' ? (
          <span className="truncate drop-shadow-xs">{Math.round(percentage)}%</span>
        ) : null}
      </div>
    </div>
  );
};
