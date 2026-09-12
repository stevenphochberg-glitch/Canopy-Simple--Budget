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
}) => {
  const isSavings = categoryType === 'savings';
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const isOverBudget = percentage > 100;
  const isAchievedSavings = isSavings && percentage >= 100;

  // Expense Progress Bar Color Logic:
  // 1% – 75%: Green fill
  // 75% – 90%: Earth-tone Brown fill
  // 90% – 100%: Red fill
  // > 100% (Overbudget): Outline the entire progress bar in Red
  let expenseFillColor = 'bg-emerald-600';
  if (percentage > 90) {
    expenseFillColor = 'bg-red-600';
  } else if (percentage > 75) {
    expenseFillColor = 'bg-[#8B5A2B]'; // Earth-tone brown
  } else {
    expenseFillColor = 'bg-emerald-600'; // Green fill
  }

  // Savings Progress Bar Color Logic:
  // Strictly remains green
  // 0% – 100%: Dynamic gradient starting as Light Sage Green at low values and darkening to Dark Green
  // > 100%: Highlight the progress bar with a vibrant solid Green border / glow
  const savingsGradientStyle = {
    background: 'linear-gradient(90deg, #A8CBB0 0%, #4D8B63 50%, #174229 100%)',
  };

  // Container styling
  let containerBorderClass = 'border border-beige-200/80 bg-beige-100';
  if (!isSavings && isOverBudget) {
    // Overbudget red outline
    containerBorderClass = 'border-2 border-red-500 ring-2 ring-red-500/30 bg-red-50/50';
  } else if (isSavings && isAchievedSavings) {
    // Savings target reached: vibrant green border & glow
    containerBorderClass = 'border-2 border-emerald-400 ring-2 ring-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.55)] bg-emerald-50/50';
  }

  // Split view during or after check-in when surplus is present
  if (showSurplusSplit && surplusChoice && percentage < 100) {
    const spentPercent = Math.max(0, Math.min(100, percentage));
    const surplusPercent = Math.max(0, 100 - spentPercent);

    return (
      <div
        className={`w-full ${heightClass} rounded-full overflow-hidden flex relative ${containerBorderClass} ${className}`}
      >
        {/* Spent portion */}
        <div
          className="h-full bg-emerald-600 transition-all duration-300 relative flex items-center justify-center"
          style={{ width: `${spentPercent}%` }}
        />

        {/* Surplus Portion */}
        <div
          className={`h-full transition-all duration-300 relative flex items-center justify-center text-[9px] font-black text-white px-1 tracking-tight truncate ${
            surplusChoice === 'rollover'
              ? 'bg-sky-500 shadow-inner'
              : 'bg-dark-green-900 shadow-inner'
          }`}
          style={{ width: `${surplusPercent}%` }}
          title={surplusChoice === 'rollover' ? prorateLabel : savingsLabel}
        >
          {surplusPercent >= 20 && (
            <span className="truncate drop-shadow-xs select-none">
              {surplusChoice === 'rollover' ? prorateLabel : savingsLabel}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full ${heightClass} rounded-full overflow-hidden relative ${containerBorderClass} ${className}`}
    >
      <div
        className={`h-full transition-all duration-500 ease-out rounded-full ${
          isSavings ? '' : expenseFillColor
        }`}
        style={{
          width: `${Math.min(100, Math.max(0, percentage))}%`,
          ...(isSavings ? savingsGradientStyle : {}),
        }}
      />
    </div>
  );
};
