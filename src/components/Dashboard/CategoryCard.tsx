import React, { useMemo } from 'react';
import { Category, Expense, TimeframeMode, DateRange } from '../../types';
import {
  formatCurrency,
  getCategoryBudgetForTimeframe,
  calculateCategorySpending,
  getWeekId,
  getCategoryEffectiveWeeklyBudget,
  getWeekRange,
  formatLocalDate,
} from '../../lib/calculations';
import { getFiscalMonthForDate } from '../../lib/fiscal445';
import { Plus, AlertCircle, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';
import { CategoryIcon } from '../Common/CategoryIcon';
import { BudgetProgressBar } from '../Common/BudgetProgressBar';

interface CategoryCardProps {
  category: Category;
  expenses: Expense[];
  timeframeMode: TimeframeMode;
  dateRange: DateRange;
  onQuickLog: (category: Category) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  expenses,
  timeframeMode,
  dateRange,
  onQuickLog,
}) => {
  const { household, navigateToCategoryLedger, checkIns } = useHousehold();

  const isSavings = category.type === 'savings' || category.group === 'Savings';
  const categoryType = isSavings ? 'savings' : 'expense';

  // Active week ID for weekly overrides check
  const activeWeekId = getWeekId(dateRange, household?.firstDayOfWeek || 'Monday');
  const {
    budget: effectiveWeeklyBudget,
    baseline: baselineBudget,
    isOverridden,
    overrideAmount,
  } = getCategoryEffectiveWeeklyBudget(category, activeWeekId, household);

  // Budget for current timeframe:
  // - Month View: Statically derived constant (Baseline Weekly Allocation × Weeks in Fiscal Month). Never dynamically calculated from adjusted weekly budgets.
  // - Week View: Active weekly allocation (checking weeklyOverrides[activeWeekId] over baseline).
  const isMonthView = timeframeMode === 'month';
  const fiscalMonth = getFiscalMonthForDate(dateRange.startDate, household?.fiscalYearEndMonth || 12);
  const weeksInMonth = fiscalMonth.weekCount || 4;

  const budgetForTimeframe = isMonthView
    ? baselineBudget * weeksInMonth
    : effectiveWeeklyBudget;

  const isProratedWeek = !isMonthView && isOverridden && overrideAmount !== undefined;

  // Calculate actual spending in this active date range
  const { totalSpent, count } = calculateCategorySpending(
    expenses,
    category.id,
    dateRange.startDate,
    dateRange.endDate
  );

  // Check if previous week's check-in has been completed for Savings card instant fill
  const prevWeekRange = useMemo(() => {
    const targetDate = new Date(dateRange.startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getWeekRange(targetDate, household?.firstDayOfWeek || 'Monday', 0);
  }, [dateRange.startDate, household?.firstDayOfWeek]);

  const hasPrevWeekCheckIn = useMemo(() => {
    const startStr = formatLocalDate(prevWeekRange.startDate);
    const endStr = formatLocalDate(prevWeekRange.endDate);
    return (checkIns || []).some(
      (c) =>
        c.status === 'completed' &&
        (c.weekEndDate === endStr || c.weekStartDate === startStr || c.id.includes(startStr))
    );
  }, [checkIns, prevWeekRange]);

  const hasThisWeekCheckIn = useMemo(() => {
    const startStr = formatLocalDate(dateRange.startDate);
    const endStr = formatLocalDate(dateRange.endDate);
    return (checkIns || []).some(
      (c) =>
        c.status === 'completed' &&
        (c.weekEndDate === endStr || c.weekStartDate === startStr || c.id.includes(startStr))
    );
  }, [checkIns, dateRange]);

  // Requirement 7: The Savings category must instantly start with a filled budget/progress bar
  // immediately after the previous week's check-in is complete.
  // If the previous week's check-in has not yet been executed, the current week's Savings category remains at $0.
  const isSavingsFunded = hasPrevWeekCheckIn || hasThisWeekCheckIn;
  const effectiveSpent = isSavings
    ? (!isMonthView ? (isSavingsFunded ? budgetForTimeframe : (totalSpent > 0 ? totalSpent : 0)) : totalSpent)
    : totalSpent;

  const remaining = budgetForTimeframe - effectiveSpent;
  const isOverBudget = !isSavings && remaining < 0;
  const isSavingsAchieved = isSavings && effectiveSpent >= budgetForTimeframe && budgetForTimeframe > 0;
  const percentage = budgetForTimeframe > 0 ? Math.round((effectiveSpent / budgetForTimeframe) * 100) : 0;

  // Determine icon background style based on bucket color/group
  let iconBg = 'bg-sage-100 text-dark-green-900 border-sage-200';
  if (category.group === 'Fun Money' || category.color === 'sky-blue') {
    iconBg = 'bg-sky-50 text-sky-900 border-sky-200';
  } else if (category.group === 'Bills' || category.color === 'brown') {
    iconBg = 'bg-beige-100 text-brown-800 border-beige-300';
  } else if (isSavings) {
    iconBg = 'bg-emerald-100 text-dark-green-900 border-emerald-300';
  }

  return (
    <div
      id={`cat-card-${category.id}`}
      onClick={() => navigateToCategoryLedger(category.id)}
      className={`bg-white border hover:border-dark-green-600/50 hover:ring-1 hover:ring-dark-green-600/20 rounded-2xl p-5 sm:p-6 min-h-[240px] sm:min-h-[255px] shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 group cursor-pointer ${
        isOverBudget
          ? 'border-red-300 bg-red-50/20'
          : isSavingsAchieved
          ? 'border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
          : 'border-beige-200/90'
      }`}
    >
      {/* Top Header: Icon, Name, Group Badge, Quick Log */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${iconBg}`}>
            <CategoryIcon name={category.name} group={category.group} icon={category.icon} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-dark-green-900 text-base sm:text-lg truncate group-hover:text-dark-green-700 transition-colors flex items-center gap-1.5">
              {category.name}
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-dark-green-600 transition-opacity" />
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brown-700 block truncate">
                {category.group}
              </span>
              <span
                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full border ${
                  isSavings
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-beige-100 text-brown-800 border-beige-300'
                }`}
              >
                {isSavings ? 'Savings' : 'Expense'}
              </span>
              {isProratedWeek && overrideAmount !== undefined && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sage-100 text-sage-900 border border-sage-200">
                  Prorated {overrideAmount > baselineBudget ? '+' : ''}
                  {formatCurrency(overrideAmount - baselineBudget)}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickLog(category);
          }}
          id={`quick-log-${category.id}`}
          title={`Log expense for ${category.name}`}
          className="p-2.5 rounded-xl bg-beige-100 hover:bg-dark-green-800 hover:text-white text-dark-green-900 transition-colors cursor-pointer border border-beige-300"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics Row: Spent / Budget & Remaining */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              {isSavings ? 'Deposited / Target' : 'Logged / Budget'}
            </span>
            <div className="text-lg sm:text-2xl font-black font-mono text-dark-green-900 tracking-tight flex items-baseline gap-1 flex-wrap">
              <span>{formatCurrency(effectiveSpent)}</span>
              <span className="text-xs font-normal text-brown-700 ml-1">
                /{' '}
                {isProratedWeek && overrideAmount !== undefined ? (
                  <span className="inline-flex items-baseline gap-1">
                    <span
                      className="line-through text-dark-grey-600/70 font-semibold"
                      title={`Global Baseline Budget: ${formatCurrency(baselineBudget)}`}
                    >
                      {formatCurrency(baselineBudget)}
                    </span>
                    <span
                      className="font-extrabold text-dark-green-900"
                      title={`Active Weekly Override: ${formatCurrency(overrideAmount)}`}
                    >
                      {formatCurrency(overrideAmount)}
                    </span>
                  </span>
                ) : (
                  formatCurrency(budgetForTimeframe)
                )}
              </span>
            </div>
          </div>

          {/* Remaining Difference */}
          <div className="text-right space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              {isSavings ? (effectiveSpent >= budgetForTimeframe ? 'Goal Met!' : 'To Goal') : isOverBudget ? 'Over Budget' : 'Remaining'}
            </span>
            <div
              className={`text-sm sm:text-base font-extrabold font-mono ${
                isOverBudget
                  ? 'text-red-600'
                  : isSavingsAchieved
                  ? 'text-emerald-700 font-black'
                  : 'text-sage-800'
              }`}
            >
              {isSavings
                ? effectiveSpent >= budgetForTimeframe
                  ? `+${formatCurrency(effectiveSpent - budgetForTimeframe)} extra`
                  : `${formatCurrency(budgetForTimeframe - effectiveSpent)} needed`
                : isOverBudget
                ? `-${formatCurrency(Math.abs(remaining))}`
                : `${formatCurrency(remaining)} left`}
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <BudgetProgressBar
            categoryType={categoryType}
            spent={effectiveSpent}
            budget={budgetForTimeframe}
            heightClass="h-2.5"
          />

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-dark-grey-600 font-medium">
              {percentage}% of {timeframeMode === 'week' ? 'weekly' : 'monthly'} allocation
            </span>
            <span className="text-brown-800 font-medium">
              {count} {count === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Status Tag */}
      <div className="pt-2 border-t border-beige-100 flex items-center justify-between text-[11px]">
        {isOverBudget ? (
          <div className="flex items-center gap-1 text-red-700 font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Exceeded by {formatCurrency(Math.abs(remaining))}</span>
          </div>
        ) : isSavingsAchieved ? (
          <div className="flex items-center gap-1 text-emerald-800 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Target Achieved ({formatCurrency(effectiveSpent)} saved)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-sage-800 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-sage-600" />
            <span>On track ({formatCurrency(remaining)} unspent)</span>
          </div>
        )}

        <span className="text-[10px] text-dark-grey-600 font-mono">
          {timeframeMode === 'week' ? 'Weekly' : 'Monthly'}
        </span>
      </div>
    </div>
  );
};
