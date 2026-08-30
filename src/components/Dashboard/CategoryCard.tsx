import React from 'react';
import { Category, Expense, TimeframeMode, DateRange } from '../../types';
import {
  formatCurrency,
  getCategoryBudgetForTimeframe,
  calculateCategorySpending,
} from '../../lib/calculations';
import { Plus, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';
import { CategoryIcon } from '../Common/CategoryIcon';

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
  const { navigateToCategoryLedger } = useHousehold();

  // Budget for current timeframe (weekly baseline or monthly equivalent)
  const budgetForTimeframe = getCategoryBudgetForTimeframe(
    category.currentWeeklyBudget || category.baselineBudget,
    timeframeMode
  );

  // Calculate actual spending in this active date range
  const { totalSpent, count } = calculateCategorySpending(
    expenses,
    category.id,
    dateRange.startDate,
    dateRange.endDate
  );

  const remaining = budgetForTimeframe - totalSpent;
  const isOverBudget = remaining < 0;
  const percentage = budgetForTimeframe > 0 ? Math.round((totalSpent / budgetForTimeframe) * 100) : 0;

  // Determine progress bar and badge colors based on percentage
  // < 75% -> Earth Sage/Forest Green
  // 75% - 99% -> Warning Amber
  // >= 100% -> Alert Red
  let progressColor = 'bg-sage-600';
  if (percentage >= 100) {
    progressColor = 'bg-red-600';
  } else if (percentage >= 75) {
    progressColor = 'bg-amber-600';
  }

  // Determine icon background style based on bucket color/group
  let iconBg = 'bg-sage-100 text-dark-green-900 border-sage-200';
  if (category.group === 'Fun Money' || category.color === 'sky-blue') {
    iconBg = 'bg-sky-50 text-sky-900 border-sky-200';
  } else if (category.group === 'Bills' || category.color === 'brown') {
    iconBg = 'bg-beige-100 text-brown-800 border-beige-300';
  } else if (category.group === 'Savings' || category.color === 'dark-green') {
    iconBg = 'bg-dark-green-100 text-dark-green-900 border-dark-green-200';
  }

  return (
    <div
      id={`cat-card-${category.id}`}
      onClick={() => navigateToCategoryLedger(category.id)}
      className="bg-white border border-beige-200/90 hover:border-dark-green-600/50 hover:ring-1 hover:ring-dark-green-600/20 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 group cursor-pointer"
    >
      {/* Top Header: Icon, Name, Group Badge, Quick Log */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${iconBg}`}>
            <CategoryIcon name={category.name} group={category.group} icon={category.icon} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-dark-green-900 text-base sm:text-lg truncate group-hover:text-dark-green-700 transition-colors flex items-center gap-1.5">
              {category.name}
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-dark-green-600 transition-opacity" />
            </h3>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brown-700 block truncate">
              {category.description ? category.description.slice(0, 36) + '...' : category.group}
            </span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickLog(category);
          }}
          id={`quick-log-${category.id}`}
          title={`Log expense for ${category.name}`}
          className="p-2 rounded-xl bg-beige-100 hover:bg-dark-green-800 hover:text-white text-dark-green-900 transition-colors cursor-pointer border border-beige-300"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Subcategories example tags if present */}
      {category.subcategories && category.subcategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {category.subcategories.slice(0, 3).map((sub) => (
            <span
              key={sub}
              className="text-[10px] font-medium text-brown-800 bg-beige-100/90 px-2 py-0.5 rounded-md border border-beige-200/80 truncate max-w-[130px]"
            >
              {sub}
            </span>
          ))}
          {category.subcategories.length > 3 && (
            <span className="text-[10px] font-medium text-brown-700 bg-beige-50 px-1.5 py-0.5 rounded-md border border-beige-200">
              +{category.subcategories.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Metrics Row: Spent / Budget & Remaining */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              Logged / Budget
            </span>
            <div className="text-base sm:text-xl font-black text-dark-green-900 tracking-tight">
              {formatCurrency(totalSpent)}
              <span className="text-xs font-normal text-brown-700 ml-1">
                / {formatCurrency(budgetForTimeframe)}
              </span>
            </div>
          </div>

          {/* Remaining Difference */}
          <div className="text-right space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              {isOverBudget ? 'Over Budget' : 'Remaining'}
            </span>
            <div
              className={`text-sm sm:text-base font-extrabold ${
                isOverBudget ? 'text-red-600' : 'text-sage-800'
              }`}
            >
              {isOverBudget ? `-${formatCurrency(Math.abs(remaining))}` : `${formatCurrency(remaining)} left`}
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="space-y-1 pt-1">
          <div className="w-full h-2.5 bg-beige-100 rounded-full overflow-hidden border border-beige-200/60">
            <div
              className={`h-full ${progressColor} transition-all duration-500 rounded-full`}
              style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-dark-grey-600 font-medium">
              {percentage}% of {timeframeMode === 'week' ? 'weekly' : 'monthly'} allocation
            </span>
            <span className="text-brown-800 font-medium">
              {count} {count === 1 ? 'transaction' : 'transactions'}
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
