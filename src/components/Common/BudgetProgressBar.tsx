import React from 'react';
import { CategoryType } from '../../types';

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
  heightClass = 'h-2.5',
  className = '',
  showSurplusSplit = false,
  surplusChoice = null,
  prorateLabel = 'Prorated',
  savingsLabel = 'Sent to savings',
  overspendCoverageAmount,
  leftoverSurplusAmount,
}) => {
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
  let containerBorderClass = 'border border-beige-300/80 bg-beige-100';
  if (isOverBudget) {
    // Overbudget red outline
    containerBorderClass = 'border-2 border-alert-red-500 ring-2 ring-alert-red-500/20 bg-alert-red-100/40';
  } else if (isSavings && isAchievedSavings) {
    // 100% (Goal Met): Retains full solid background fill AND receives a thick, solid green border/outline.
    containerBorderClass = 'border-2 border-dark-green-800 ring-2 ring-dark-green-800/30 bg-beige-100';
  }

  // 1. OVERBUDGET EXPENSE STATE:
  // If spent > budget (or percentage >= 100), fill to 100% width with solid semantic red
  if (isOverBudget) {
    return (
      <div
        className={`w-full ${heightClass} rounded-full overflow-hidden relative ${containerBorderClass} ${className}`}
        title={`Over budget: ${Math.round(percentage)}% (${spent}/${budget})`}
      >
        <div
          className="h-full w-full bg-alert-red-600 rounded-full transition-all duration-500 ease-out"
        />
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
        className={`w-full ${activeHeight} rounded-full overflow-hidden flex relative ${containerBorderClass} ${className}`}
      >
        {/* Spent portion (Sage Green) */}
        <div
          className="h-full bg-sage-600 transition-all duration-300 relative flex items-center justify-center"
          style={{ width: `${spentPercent}%` }}
          title={`Spent: ${spentPercent.toFixed(1)}%`}
        />

        {/* Overspend Coverage Portion (Brown) */}
        {coveragePercent > 0 && (
          <div
            className="h-full bg-brown-700 text-beige-100 transition-all duration-300 relative flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1 tracking-tight truncate overflow-hidden whitespace-nowrap"
            style={{ width: `${coveragePercent}%` }}
            title={`Overspend coverage: ${coveragePercent.toFixed(1)}%`}
          >
            {coveragePercent >= 12 && (
              <span className="truncate drop-shadow-xs select-none">
                Overspend coverage
              </span>
            )}
          </div>
        )}

        {/* Surplus Portion (Dark Green or Sky Blue) */}
        {leftoverPercent > 0 && (
          <div
            className={`h-full transition-all duration-300 relative flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white px-1 tracking-tight truncate overflow-hidden whitespace-nowrap ${
              surplusChoice === 'rollover'
                ? 'bg-sky-blue-500 shadow-inner'
                : 'bg-dark-green-800 shadow-inner'
            }`}
            style={{ width: `${leftoverPercent}%` }}
            title={surplusChoice === 'rollover' ? prorateLabel : savingsLabel}
          >
            {leftoverPercent >= 12 && (
              <span className="truncate drop-shadow-xs select-none">
                {surplusChoice === 'rollover' ? prorateLabel : savingsLabel}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. STANDARD SOLID PROGRESS BAR (Savings & Expense):
  return (
    <div
      className={`w-full ${heightClass} rounded-full overflow-hidden relative ${containerBorderClass} ${className}`}
    >
      <div
        className={`h-full transition-all duration-500 ease-out rounded-full ${
          isSavings ? savingsFillColor : expenseFillColor
        }`}
        style={{
          width: `${Math.min(100, Math.max(0, percentage))}%`,
        }}
      />
    </div>
  );
};
