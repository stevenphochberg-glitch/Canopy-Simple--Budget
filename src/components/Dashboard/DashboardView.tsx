import React, { useMemo, useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { Category, CategoryGroup } from '../../types';
import {
  formatCurrency,
  getCategoryBudgetForTimeframe,
  isExpenseInDateRange,
  getProratedExpenseAmount,
  getWeekId,
  getCategoryEffectiveWeeklyBudget,
  formatLocalDate,
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
import { calculateCheckInStatus } from '../../lib/checkInCalculations';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Receipt,
  Trash2,
  CheckCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  X,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenProfileModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = () => {
  const {
    household,
    categories,
    expenses,
    checkIns,
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
    openWeeklyCheckInModal,
    openMonthlyRetroModal,
    deleteExpense,
    deleteWeeklyCheckIn,
  } = useHousehold();

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingCheckIn, setIsDeletingCheckIn] = useState(false);

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

  // Check if active timeframe is a historical week with a completed check-in
  const historicalCheckIn = useMemo(() => {
    if (timeframeMode !== 'week' || timeframeOffset >= 0) return null;
    const startStr = formatLocalDate(activeDateRange.startDate);
    const endStr = formatLocalDate(activeDateRange.endDate);
    return checkIns.find(
      (c) =>
        c.status === 'completed' &&
        (c.weekEndDate === endStr || c.weekStartDate === startStr || c.id.includes(startStr))
    );
  }, [timeframeMode, timeframeOffset, activeDateRange, checkIns]);

  // Helper to identify Bills categories
  const isBillsCategory = (c: { group?: string; name?: string; id?: string }) =>
    c.group?.toLowerCase() === 'bills' || c.name?.toLowerCase() === 'bills' || c.id === 'cat_bills';

  // 2. Filter categories according to timeframe mode:
  // When Timeframe is set to "Week View", strictly filter out and hide the "Bills" category card.
  // Bills must ONLY render when Timeframe is toggled to "Month View".
  const visibleCategories = useMemo(() => {
    if (timeframeMode === 'week') {
      return categories.filter((c) => !isBillsCategory(c));
    }
    return categories;
  }, [categories, timeframeMode]);

  const weeksInFiscalMonth = fiscalMonth.weekCount || 4;

  const activeWeekId = getWeekId(activeDateRange, household?.firstDayOfWeek || 'Monday');

  // Baseline sum for visible categories
  const totalWeeklyBaseline = useMemo(() => {
    return visibleCategories.reduce((sum, c) => sum + (Number(c.baselineBudget) || 0), 0);
  }, [visibleCategories]);

  // 3. Executive Overview Spending Summary Calculations:
  // - Week View: Budget Set sums only weekly allocations of Essentials, Fun Money, and Savings (non-Bills), resolving weeklyOverrides[activeWeekId] if present.
  // - Month View: Total Monthly Budget is a statically derived constant (Baseline Weekly Allocation × Weeks in Fiscal Month).
  const { totalTimeframeBudget, hasAnyWeeklyOverride } = useMemo(() => {
    if (timeframeMode === 'week') {
      let sum = 0;
      let overridePresent = false;
      visibleCategories.forEach((c) => {
        const { budget, isOverridden } = getCategoryEffectiveWeeklyBudget(c, activeWeekId, household);
        sum += budget;
        if (isOverridden) {
          overridePresent = true;
        }
      });
      return { totalTimeframeBudget: sum, hasAnyWeeklyOverride: overridePresent };
    }
    // Month View: Statically derived constant (Baseline Weekly Allocation × Weeks in Fiscal Month)
    const monthSum = categories.reduce(
      (sum, c) => sum + ((Number(c.baselineBudget) || 0) * weeksInFiscalMonth),
      0
    );
    return { totalTimeframeBudget: monthSum, hasAnyWeeklyOverride: false };
  }, [timeframeMode, visibleCategories, categories, weeksInFiscalMonth, activeWeekId, household]);

  // Total spent in active timeframe:
  // In Week View, completely exclude Bills transactions from calculations.
  // In Month View, include all transactions (with dynamic paid-only bill proration).
  const timeframeExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (timeframeMode === 'week') {
        const cat = categories.find((c) => c.id === exp.categoryId);
        if (cat && isBillsCategory(cat)) {
          return false;
        }
      }
      const prorated = getProratedExpenseAmount(
        exp,
        activeDateRange.startDate,
        activeDateRange.endDate,
        household?.fiscalYearEndMonth || 12
      );
      return prorated > 0;
    });
  }, [expenses, activeDateRange, household?.fiscalYearEndMonth, timeframeMode, categories]);

  const totalTimeframeSpent = useMemo(() => {
    return timeframeExpenses.reduce((sum, exp) => {
      const prorated = getProratedExpenseAmount(
        exp,
        activeDateRange.startDate,
        activeDateRange.endDate,
        household?.fiscalYearEndMonth || 12
      );
      return sum + prorated;
    }, 0);
  }, [timeframeExpenses, activeDateRange, household?.fiscalYearEndMonth]);

  const netRemaining = totalTimeframeBudget - totalTimeframeSpent;
  const isNetOverBudget = netRemaining < 0;
  const overallPercentage =
    totalTimeframeBudget > 0 ? Math.round((totalTimeframeSpent / totalTimeframeBudget) * 100) : 0;

  // Dynamic Overall Progress Bar Color
  // Smooth transition: earth-tone green (<80%) -> warm warning amber (80-94%) -> deep amber (95-99%) -> Actionable alert red (>=100%)
  let overallBarColor = 'bg-sage-600';
  if (overallPercentage >= 100) {
    overallBarColor = 'bg-red-600';
  } else if (overallPercentage >= 95) {
    overallBarColor = 'bg-amber-700';
  } else if (overallPercentage >= 80) {
    overallBarColor = 'bg-amber-600';
  }

  const isCurrentTimeframe = timeframeOffset === 0;

  // 4. Variable Income Buffer & Runway Calculations
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
    return standardSum > 0 ? standardSum : totalTimeframeBudget;
  }, [household?.baselineWeeklyBurnRate, categories, bufferCategory, totalTimeframeBudget]);

  // 5. Reactive Review Due Status for Actionable Alert Badge & Prominent Banner
  const reviewDueStatus = useMemo(() => {
    if (!household) return { isDue: false, type: null, isPastDue: false, title: '', description: '' };
    const statusInfo = calculateCheckInStatus(household, checkIns, expenses);
    const isWeeklyDue = statusInfo.isPastDue || statusInfo.status === 'pending' || statusInfo.status === 'past-due';

    if (isWeeklyDue) {
      return {
        isDue: true,
        type: 'weekly' as const,
        isPastDue: statusInfo.isPastDue,
        title: statusInfo.isPastDue
          ? 'Weekly Check-In is Past Due'
          : statusInfo.isLastDayOfWeek
            ? 'Weekly Household Alignment Due Today'
            : 'Weekly Check-In Due',
        description: statusInfo.isPastDue
          ? 'You have unreviewed envelope balances from a previous week. Reconcile spending and bank savings to keep budgets accurate.'
          : 'Review this week’s expenses, bank category surpluses into savings, and set envelope allocations for next week.',
      };
    }

    const currentFiscalMonth = getFiscalMonthForDate(new Date(), household.fiscalYearEndMonth || 12);
    const monthEndTime = currentFiscalMonth.endDate.getTime();
    const finalWeekStartTime = monthEndTime - 7 * 24 * 60 * 60 * 1000;
    const isMonthEnd = new Date().getTime() >= finalWeekStartTime;

    if (isMonthEnd) {
      const hasCompletedMonthRetro = (checkIns || []).some((c) => {
        const cEndTime = new Date(c.weekEndDate).getTime();
        return cEndTime >= finalWeekStartTime && c.status === 'completed';
      });
      if (!hasCompletedMonthRetro) {
        const isPastDueMonth = new Date().getTime() > monthEndTime;
        return {
          isDue: true,
          type: 'monthly' as const,
          isPastDue: isPastDueMonth,
          title: isPastDueMonth
            ? 'Monthly Retrospective Past Due'
            : 'Monthly Retrospective Ready',
          description:
            'The fiscal month has concluded. Review your macro budget performance, analyze category pacing, and establish next month’s baseline.',
        };
      }
    }

    return { isDue: false, type: null, isPastDue: false, title: '', description: '' };
  }, [household, checkIns, expenses]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Prominent Actionable Review Due Element */}
      {reviewDueStatus.isDue && (
        <div
          id="dashboard-review-due-alert"
          className="bg-white border-2 border-red-500 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden"
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                <CheckCircle className="w-6 h-6" />
              </div>
              {/* Solid Red Dot - Red is strictly reserved for actionable alerts and past-due notifications */}
              <span
                id="dashboard-review-notification-dot"
                className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 rounded-full ring-2 ring-white"
                title="Actionable alert"
                aria-label="Actionable alert"
              />
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-red-700 bg-red-100/90 px-2.5 py-0.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  Action Required &bull; {reviewDueStatus.type === 'monthly' ? 'Monthly Retrospective' : 'Weekly Check-In'}
                </span>
                {reviewDueStatus.isPastDue && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                    Past Due
                  </span>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-black text-dark-green-950">
                {reviewDueStatus.title}
              </h3>
              <p className="text-xs text-brown-700 max-w-xl">
                {reviewDueStatus.description}
              </p>
            </div>
          </div>

          <button
            id="dashboard-start-review-cta"
            onClick={() => {
              if (reviewDueStatus.type === 'monthly') {
                openMonthlyRetroModal();
              } else {
                openWeeklyCheckInModal();
              }
            }}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-sm transition active:scale-95 cursor-pointer"
          >
            <span>{reviewDueStatus.type === 'monthly' ? 'Start Monthly Retro' : 'Complete Check-In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

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

            <div className="px-3 sm:px-4 py-1 text-center min-w-[140px] sm:min-w-[180px]">
              <span className="text-xs sm:text-sm font-extrabold text-dark-green-900 block leading-tight">
                {activeDateRange.label}
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

      {/* Historical Week Check-In Action Banner */}
      {timeframeMode === 'week' && timeframeOffset < 0 && (
        <div
          id="dashboard-historical-checkin-banner"
          className="bg-white border-2 border-sage-300 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden"
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-dark-green-800 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-dark-green-900 bg-sage-100 px-2.5 py-0.5 rounded-full">
                  <Clock className="w-3 h-3 text-dark-green-800" />
                  Historical Week &bull; {activeDateRange.label}
                </span>
                {historicalCheckIn ? (
                  <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    Check-In Completed (${formatCurrency(historicalCheckIn.totalSaved)} saved)
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                    Check-In Not Yet Executed
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-black text-dark-green-950">
                {historicalCheckIn ? 'Past Weekly Check-In Recorded' : 'Execute Historical Weekly Check-In'}
              </h3>
              <p className="text-xs text-brown-700 max-w-xl">
                {historicalCheckIn
                  ? `Weekly check-in recorded for ${activeDateRange.label}. You can review or re-execute this past check-in at any time.`
                  : `Reconcile expenses, absorb category deficits, and bank surplus envelope balances into your savings pot for ${activeDateRange.label}.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {historicalCheckIn && (
              <button
                id="dashboard-historical-checkin-delete-btn"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs sm:text-sm font-extrabold rounded-2xl shadow-2xs transition active:scale-95 cursor-pointer"
                title="Delete this historical check-in record and reverse future prorations"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Delete Check-In</span>
              </button>
            )}

            <button
              id="dashboard-historical-checkin-cta"
              onClick={() => openWeeklyCheckInModal()}
              className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>{historicalCheckIn ? 'Review Check-In' : 'Execute Check-In for this Week'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Executive Budget Summary Card - Compact, Low Visual Weight */}
      <div className="bg-white border border-beige-200/80 rounded-xl p-3 sm:p-3.5 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-beige-100 pb-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-dark-green-800 bg-sage-100/80 px-2 py-0.5 rounded-md">
              {timeframeMode === 'week' ? 'Weekly' : 'Monthly Normalized'}
            </span>
            <h2 className="text-xs sm:text-sm font-extrabold text-dark-green-900">
              {activeDateRange.label} Spending Summary
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-brown-700 font-medium">
              {timeframeExpenses.length} {timeframeExpenses.length === 1 ? 'transaction' : 'transactions'}
            </span>
          </div>
        </div>

        {/* 3 Metric Columns - Low-Weight Streamlined */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
          <div className="p-2.5 bg-beige-50/50 border border-beige-200/60 rounded-lg space-y-0.5">
            <span className="text-[9px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              Budget Set ({timeframeMode === 'week' ? 'Weekly' : 'Monthly'})
            </span>
            <div className="text-lg sm:text-xl font-black font-mono text-dark-green-900 tracking-tight flex items-baseline gap-1.5 flex-wrap">
              {hasAnyWeeklyOverride ? (
                <>
                  <span
                    className="line-through text-dark-grey-600/70 text-xs sm:text-sm font-semibold"
                    title={`Global Baseline: ${formatCurrency(totalWeeklyBaseline)}`}
                  >
                    {formatCurrency(totalWeeklyBaseline)}
                  </span>
                  <span
                    className="text-dark-green-900"
                    title={`Active Weekly Prorated: ${formatCurrency(totalTimeframeBudget)}`}
                  >
                    {formatCurrency(totalTimeframeBudget)}
                  </span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sage-100 text-sage-900 border border-sage-200">
                    Prorated
                  </span>
                </>
              ) : (
                formatCurrency(totalTimeframeBudget)
              )}
            </div>
            <p className="text-[10px] text-brown-700 truncate">
              {hasAnyWeeklyOverride
                ? `Prorated from check-in (${totalTimeframeBudget >= totalWeeklyBaseline ? '+' : ''}${formatCurrency(totalTimeframeBudget - totalWeeklyBaseline)})`
                : `Across ${visibleCategories.length} ${timeframeMode === 'week' ? 'weekly categories' : 'categories'}`}
            </p>
          </div>

          <div className="p-2.5 bg-beige-50/50 border border-beige-200/60 rounded-lg space-y-0.5">
            <span className="text-[9px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              Total Logged
            </span>
            <div className="text-lg sm:text-xl font-black font-mono text-dark-green-900 tracking-tight">
              {formatCurrency(totalTimeframeSpent)}
            </div>
            <p className="text-[10px] text-brown-700 truncate">
              {overallPercentage}% of allocated budget spent
            </p>
          </div>

          <div
            className={`p-2.5 border rounded-lg space-y-0.5 ${
              isNetOverBudget
                ? 'bg-red-50/70 border-red-200'
                : 'bg-sage-50/60 border-sage-200'
            }`}
          >
            <span className="text-[9px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              {isNetOverBudget ? 'Net Over Budget' : 'Safe Remaining'}
            </span>
            <div
              className={`text-lg sm:text-xl font-black font-mono tracking-tight ${
                isNetOverBudget ? 'text-red-600' : 'text-sage-900'
              }`}
            >
              {isNetOverBudget
                ? `-${formatCurrency(Math.abs(netRemaining))}`
                : formatCurrency(netRemaining)}
            </div>
            <p className="text-[10px] text-brown-700 truncate">
              {isNetOverBudget
                ? 'Exceeded total allocated budget'
                : 'Available before next reset'}
            </p>
          </div>
        </div>

        {/* Global Progress Bar - Slim & Smooth */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-dark-green-900">
            <span>Overall Budget Consumption</span>
            <span>{overallPercentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-beige-200 rounded-full overflow-hidden border border-beige-300/40">
            <div
              className={`h-full ${overallBarColor} transition-all duration-500 ease-out rounded-full`}
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
        {visibleCategories.length === 0 ? (
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
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 ${
              timeframeMode === 'week' || visibleCategories.length === 3
                ? 'lg:grid-cols-3'
                : 'lg:grid-cols-4'
            } gap-4`}
          >
            {visibleCategories.map((cat) => (
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
            onClick={() => openLogExpenseModal()}
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
              onClick={() => openLogExpenseModal()}
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
                      {(() => {
                        const proratedAmt = getProratedExpenseAmount(
                          exp,
                          activeDateRange.startDate,
                          activeDateRange.endDate,
                          household?.fiscalYearEndMonth || 12
                        );
                        const isProrated = Boolean(exp.billFrequency && exp.billFrequency !== 'weekly');

                        return (
                          <>
                            <span className="text-sm sm:text-base font-extrabold text-dark-green-900">
                              {formatCurrency(isProrated ? proratedAmt : exp.amount)}
                            </span>
                            {isProrated && (
                              <span className="block text-[9px] font-bold text-sage-800">
                                Prorated ({formatCurrency(exp.amount)} {exp.billFrequency})
                              </span>
                            )}
                          </>
                        );
                      })()}
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

      {/* Delete Historical Check-In Confirmation Modal */}
      {isDeleteConfirmOpen && historicalCheckIn && (
        <div
          id="delete-checkin-modal-backdrop"
          className="fixed inset-0 z-50 bg-dark-green-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            id="delete-checkin-modal"
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-beige-300 space-y-5 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-dark-green-950">
                    Delete Historical Check-In
                  </h3>
                  <p className="text-xs font-bold text-brown-600">
                    {activeDateRange.label}
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isDeletingCheckIn && setIsDeleteConfirmOpen(false)}
                className="p-1.5 text-brown-600 hover:text-dark-green-900 rounded-xl hover:bg-beige-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 space-y-2">
              <p className="text-sm font-extrabold text-rose-900">
                Are you sure? This will reverse all budget prorations and savings transfers for this week.
              </p>
              <p className="text-xs text-rose-800 leading-relaxed">
                Deleting this check-in will erase the reconciliation record, restore future-week budget envelopes back to their baseline allocations, and return this week to an un-reconciled state.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                id="cancel-delete-checkin-btn"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={isDeletingCheckIn}
                className="px-4 py-2.5 rounded-xl border border-beige-300 text-xs sm:text-sm font-extrabold text-brown-800 hover:bg-beige-100 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                id="confirm-delete-checkin-btn"
                onClick={async () => {
                  if (!historicalCheckIn) return;
                  setIsDeletingCheckIn(true);
                  try {
                    await deleteWeeklyCheckIn(historicalCheckIn.id);
                    setIsDeleteConfirmOpen(false);
                  } finally {
                    setIsDeletingCheckIn(false);
                  }
                }}
                disabled={isDeletingCheckIn}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-extrabold shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingCheckIn ? 'Deleting...' : 'Delete Check-In'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
