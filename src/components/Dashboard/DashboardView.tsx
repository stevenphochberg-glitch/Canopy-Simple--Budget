import React, { useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { Category, CategoryGroup } from '../../types';
import {
  formatCurrency,
  getCategoryBudgetForTimeframe,
  isExpenseInDateRange,
} from '../../lib/calculations';
import {
  getFiscalMonthForDate,
  detectExtraPaycheckMonth,
  getFiscalTrackerInfo,
} from '../../lib/fiscal445';
import { CategoryCard } from './CategoryCard';
import { CategoryIcon } from '../Common/CategoryIcon';
import { ExtraPaycheckBanner } from './ExtraPaycheckBanner';
import { RunwayVisualizer } from './RunwayVisualizer';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Receipt,
  Trash2,
  Calendar,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenProfileModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = () => {
  const {
    household,
    categories,
    expenses,
    members,
    timeframeMode,
    setTimeframeMode,
    timeframeOffset,
    setTimeframeOffset,
    resetTimeframeToCurrent,
    activeDateRange,
    openStagingModal,
    openLogExpenseModal,
    openAllocationModal,
    deleteExpense,
  } = useHousehold();

  // 1. Calculate 4-4-5 Fiscal Month & Tracker Coordinates & Extra Paycheck Detection
  const fiscalMonth = useMemo(() => {
    return getFiscalMonthForDate(activeDateRange.startDate, household?.fiscalYearEndMonth || 12);
  }, [activeDateRange.startDate, household?.fiscalYearEndMonth]);

  const fiscalTracker = useMemo(() => {
    return getFiscalTrackerInfo(activeDateRange.startDate, household?.fiscalYearEndMonth || 12);
  }, [activeDateRange.startDate, household?.fiscalYearEndMonth]);

  const extraPaycheckInfo = useMemo(() => {
    return detectExtraPaycheckMonth(members, fiscalMonth);
  }, [members, fiscalMonth]);

  // 2. Calculate overall totals for active timeframe
  const totalWeeklyBudget = categories.reduce(
    (sum, c) => sum + (Number(c.currentWeeklyBudget) || 0),
    0
  );
  const totalTimeframeBudget = getCategoryBudgetForTimeframe(totalWeeklyBudget, timeframeMode);

  // Total spent in active timeframe
  const timeframeExpenses = useMemo(() => {
    return expenses.filter((exp) =>
      isExpenseInDateRange(exp, activeDateRange.startDate, activeDateRange.endDate)
    );
  }, [expenses, activeDateRange]);

  const totalTimeframeSpent = useMemo(() => {
    return timeframeExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [timeframeExpenses]);

  const netRemaining = totalTimeframeBudget - totalTimeframeSpent;
  const isNetOverBudget = netRemaining < 0;
  const overallPercentage =
    totalTimeframeBudget > 0 ? Math.round((totalTimeframeSpent / totalTimeframeBudget) * 100) : 0;

  // Dynamic Overall Progress Bar Color
  let overallBarColor = 'bg-sage-600';
  if (overallPercentage >= 100) overallBarColor = 'bg-red-600';
  else if (overallPercentage >= 75) overallBarColor = 'bg-amber-600';

  const isCurrentTimeframe = timeframeOffset === 0;

  // 3. Variable Income Buffer & Runway Calculations
  const bufferCategory = useMemo(() => {
    return categories.find(
      (c) => c.id === 'cat_income_buffer' || c.name.toLowerCase().includes('buffer')
    );
  }, [categories]);

  const isVariableIncome = household?.incomeType === 'variable' || Boolean(bufferCategory);
  const bufferAmount = bufferCategory ? (Number(bufferCategory.currentWeeklyBudget) || 0) : (household?.initialBufferAmount || 0);
  const baselineBurnRate = useMemo(() => {
    if (household?.baselineWeeklyBurnRate && household.baselineWeeklyBurnRate > 0) {
      return household.baselineWeeklyBurnRate;
    }
    const standardSum = categories
      .filter((c) => c.id !== bufferCategory?.id)
      .reduce((sum, c) => sum + (Number(c.baselineBudget) || 0), 0);
    return standardSum > 0 ? standardSum : totalWeeklyBudget;
  }, [household?.baselineWeeklyBurnRate, categories, bufferCategory, totalWeeklyBudget]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Timeframe Selector & Navigation Bar */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Timeframe Toggle (Week / Month) */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-dark-green-900 hidden md:inline">
            Timeframe:
          </span>
          <div className="inline-flex p-1 bg-beige-100/80 rounded-2xl border border-beige-200">
            <button
              id="toggle-timeframe-week"
              onClick={() => {
                setTimeframeMode('week');
                setTimeframeOffset(0);
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                timeframeMode === 'week'
                  ? 'bg-dark-green-800 text-white shadow-xs'
                  : 'text-dark-grey-800 hover:text-dark-green-900'
              }`}
            >
              Week View
            </button>
            <button
              id="toggle-timeframe-month"
              onClick={() => {
                setTimeframeMode('month');
                setTimeframeOffset(0);
              }}
              className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                timeframeMode === 'month'
                  ? 'bg-dark-green-800 text-white shadow-xs'
                  : 'text-dark-grey-800 hover:text-dark-green-900'
              }`}
            >
              Month View
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-50 border border-sage-200/90 rounded-xl text-[11px] font-bold text-dark-green-950 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-sage-700 shrink-0" />
            <span className="font-extrabold tracking-tight">{fiscalTracker.label}</span>
          </div>
        </div>

        {/* Center/Right: Timeframe Arrow Navigation (<, Date Range Label, >) */}
        <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-beige-50 border border-beige-200/80 rounded-2xl p-1">
            <button
              onClick={() => setTimeframeOffset((prev) => prev - 1)}
              id="nav-timeframe-prev"
              title={`Previous ${timeframeMode}`}
              className="p-2 rounded-xl hover:bg-beige-200 text-dark-green-900 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 sm:px-4 py-1 text-center min-w-[160px] sm:min-w-[200px]">
              <span className="text-xs sm:text-sm font-extrabold text-dark-green-900 block leading-tight">
                {activeDateRange.label}
              </span>
              <span className="text-[10px] text-brown-700 font-semibold block">
                {fiscalTracker.label}
              </span>
            </div>

            <button
              onClick={() => setTimeframeOffset((prev) => prev + 1)}
              id="nav-timeframe-next"
              title={`Next ${timeframeMode}`}
              className="p-2 rounded-xl hover:bg-beige-200 text-dark-green-900 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Return to Today / Current Button if viewing past/future */}
          {!isCurrentTimeframe && (
            <button
              onClick={resetTimeframeToCurrent}
              id="nav-timeframe-today"
              className="flex items-center gap-1 px-3 py-2 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs font-bold rounded-2xl border border-beige-300 transition cursor-pointer"
              title="Return to current timeframe"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Current</span>
            </button>
          )}
        </div>
      </div>

      {/* Extra Paycheck Month Banner */}
      <ExtraPaycheckBanner extraInfo={extraPaycheckInfo} />

      {/* Executive Budget Summary Card */}
      <div className="bg-gradient-to-br from-sage-50 via-white to-beige-50 border border-sage-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sage-100 pb-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-dark-green-800 bg-sage-100 px-2.5 py-0.5 rounded-full">
              Executive Overview &bull; {timeframeMode === 'week' ? 'Weekly View' : 'Monthly Normalized'}
            </span>
            <h2 className="text-lg sm:text-xl font-black text-dark-green-900 mt-1">
              {activeDateRange.label} Spending Summary
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-brown-800">
              {timeframeExpenses.length} {timeframeExpenses.length === 1 ? 'transaction' : 'transactions'} logged
            </span>
          </div>
        </div>

        {/* 3 High-contrast Metric Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white/90 border border-beige-200 rounded-2xl shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              Budget Set ({timeframeMode === 'week' ? 'Weekly' : 'Monthly'})
            </span>
            <div className="text-2xl sm:text-3xl font-black text-dark-green-900 tracking-tight">
              {formatCurrency(totalTimeframeBudget)}
            </div>
            <p className="text-[11px] text-brown-700">
              Allocated across {categories.length} categories
            </p>
          </div>

          <div className="p-4 bg-white/90 border border-beige-200 rounded-2xl shadow-2xs space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              Total Logged
            </span>
            <div className="text-2xl sm:text-3xl font-black text-dark-green-900 tracking-tight">
              {formatCurrency(totalTimeframeSpent)}
            </div>
            <p className="text-[11px] text-brown-700">
              {overallPercentage}% of allocated budget spent
            </p>
          </div>

          <div
            className={`p-4 border rounded-2xl shadow-2xs space-y-1 ${
              isNetOverBudget
                ? 'bg-red-50/90 border-red-200'
                : 'bg-sage-50/90 border-sage-200'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              {isNetOverBudget ? 'Net Over Budget' : 'Safe Remaining'}
            </span>
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                isNetOverBudget ? 'text-red-600' : 'text-sage-900'
              }`}
            >
              {isNetOverBudget
                ? `-${formatCurrency(Math.abs(netRemaining))}`
                : formatCurrency(netRemaining)}
            </div>
            <p className="text-[11px] text-brown-700">
              {isNetOverBudget
                ? 'Exceeded total allocated budget'
                : 'Available before next cycle reset'}
            </p>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-dark-green-900">
            <span>Overall Budget Consumption</span>
            <span>{overallPercentage}%</span>
          </div>
          <div className="w-full h-3 bg-beige-200 rounded-full overflow-hidden border border-beige-300/60">
            <div
              className={`h-full ${overallBarColor} transition-all duration-500 rounded-full`}
              style={{ width: `${Math.min(100, Math.max(0, overallPercentage))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Variable Income Runway Forecast with Canopy Woven Arch Visualizer */}
      {isVariableIncome && (
        <RunwayVisualizer
          incomeBufferAmount={bufferAmount}
          baselineWeeklyBurnRate={baselineBurnRate}
          targetWeeks={12}
          onOpenBufferModal={() => openAllocationModal()}
        />
      )}

      {/* Top-Level Budget Buckets Section (Flattened) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-beige-200 pb-2">
          <div>
            <h2 className="text-xl font-extrabold text-dark-green-900">
              Budget Buckets
            </h2>
            <p className="text-xs text-brown-700">
              Top-level spending categories. Click any card to drill down into transaction history.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openAllocationModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-beige-100 hover:bg-dark-green-800 hover:text-white text-dark-green-900 text-xs font-bold rounded-xl border border-beige-300 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add / Manage Buckets</span>
            </button>
          </div>
        </div>

        {/* Flattened Responsive Cards Grid */}
        {categories.length === 0 ? (
          <div className="py-10 text-center space-y-3 bg-white border border-dashed border-beige-300 rounded-3xl p-6">
            <div className="w-12 h-12 mx-auto bg-sage-100 rounded-2xl flex items-center justify-center text-dark-green-900">
              <Plus className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h4 className="text-sm font-bold text-dark-green-900">No Budget Buckets Configured</h4>
              <p className="text-xs text-brown-700">
                Create your household spending buckets to allocate budgets and track weekly progress.
              </p>
            </div>
            <button
              onClick={() => openAllocationModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Configure Budget Buckets</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                expenses={expenses}
                timeframeMode={timeframeMode}
                dateRange={activeDateRange}
                onQuickLog={(category) => openLogExpenseModal(category)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Timeframe Recent Expenses Ledger Table / List */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-beige-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-dark-green-900">
              Transactions in Active Timeframe ({timeframeExpenses.length})
            </h3>
            <p className="text-xs text-brown-700">
              {activeDateRange.label} &bull; Verified in household ledger
            </p>
          </div>

          <button
            onClick={() => openStagingModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-beige-100 hover:bg-dark-green-800 hover:text-white text-dark-green-900 text-xs font-bold rounded-xl transition cursor-pointer border border-beige-300"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Expense</span>
          </button>
        </div>

        {timeframeExpenses.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-beige-50/50 rounded-2xl border border-dashed border-beige-200">
            <div className="w-12 h-12 mx-auto bg-beige-100 rounded-full flex items-center justify-center text-brown-700">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h4 className="text-sm font-bold text-dark-green-900">
                No transactions logged in this timeframe
              </h4>
              <p className="text-xs text-brown-700">
                Click "Log Expense" above to record receipts and expenses into the household ledger.
              </p>
            </div>
            <button
              onClick={() => openStagingModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log First Expense for this Timeframe</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-beige-100">
            {timeframeExpenses.map((exp) => {
              const cat = categories.find((c) => c.id === exp.categoryId);
              const payer = members.find((m) => m.userId === exp.loggedByUserId);

              return (
                <div
                  key={exp.id}
                  className="py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-beige-50/60 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 flex-shrink-0">
                      <CategoryIcon name={cat?.name} group={cat?.group} icon={cat?.icon} className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-dark-green-900 text-sm truncate">
                          {exp.description || 'Logged Expense'}
                        </span>
                        <span className="text-[10px] font-semibold text-brown-800 bg-beige-100 px-2 py-0.2 rounded-md hidden sm:inline">
                          {cat?.name || 'Uncategorized'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-dark-grey-600">
                        <span>{exp.date || new Date(exp.timestamp).toLocaleDateString()}</span>
                        <span>&bull;</span>
                        <span>Paid by {payer?.name || 'Member'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm sm:text-base font-extrabold text-dark-green-900">
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteExpense(exp.id)}
                      className="p-1.5 text-brown-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
