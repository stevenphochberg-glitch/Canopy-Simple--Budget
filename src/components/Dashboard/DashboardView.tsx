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
  getWeekRange,
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
import { CheckInReviewModal } from '../CheckIn/CheckInReviewModal';
import { CheckInImpactModal } from '../CheckIn/CheckInImpactModal';
import { getFiscalWeekId } from '../../lib/fiscal445';
import {
  Plus,
  SlidersHorizontal,
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
  PiggyBank,
  ShieldCheck,
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
    updateCheckIn,
    showToast,
  } = useHousehold();

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingCheckIn, setIsDeletingCheckIn] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Interception Modal State for Post-Check-In Transactions (Directive 1 & 2)
  const [impactModalState, setImpactModalState] = useState<{
    isOpen: boolean;
    targetExpense: any;
    actionType: 'edit' | 'delete';
    checkIn: any;
  }>({
    isOpen: false,
    targetExpense: null,
    actionType: 'delete',
    checkIn: null,
  });

  const getCompletedPastCheckInForExpense = (exp: any) => {
    const fiscalYearEnd = household?.fiscalYearEndMonth || 12;
    const expDateStr = exp.date || (exp.timestamp ? new Date(exp.timestamp).toISOString().split('T')[0] : '');
    if (!expDateStr) return null;

    const expFiscalWeekId = getFiscalWeekId(expDateStr, fiscalYearEnd);
    if (!expFiscalWeekId) return null;

    const currentActiveWeekRange = getWeekRange(new Date(), household?.firstDayOfWeek || 'Monday', 0);
    const currentActiveWeekId = getFiscalWeekId(currentActiveWeekRange.startDate, fiscalYearEnd);
    if (expFiscalWeekId === currentActiveWeekId) {
      return null;
    }

    const matchingCheckIn = (checkIns || []).find((ci) => {
      if (ci.status !== 'completed') return false;
      const ciWeekId = ci.fiscalWeekId || getFiscalWeekId(ci.weekStartDate || ci.weekEndDate || ci.timestamp, fiscalYearEnd);
      return ciWeekId === expFiscalWeekId;
    });

    return matchingCheckIn || null;
  };

  const handleDeleteExpenseClick = async (exp: any) => {
    const completedCheckIn = getCompletedPastCheckInForExpense(exp);
    if (completedCheckIn) {
      setImpactModalState({
        isOpen: true,
        targetExpense: exp,
        actionType: 'delete',
        checkIn: completedCheckIn,
      });
      return;
    }
    await deleteExpense(exp.id);
  };

  const handleConfirmImpact = async (simulatedValues: {
    bankedSavings: number;
    totalSpent: number;
    totalBudget: number;
    decisions: any[];
  }) => {
    if (!impactModalState.targetExpense || !impactModalState.checkIn) return;
    const target = impactModalState.targetExpense;
    const ci = impactModalState.checkIn;

    const weekStart = new Date(ci.weekStartDate + (ci.weekStartDate.length === 10 ? 'T12:00:00' : ''));
    const trackerInfo = getFiscalTrackerInfo(weekStart, household?.fiscalYearEndMonth || 12);
    const weekLabel = `W${trackerInfo.weekOfFiscalMonth}`;

    await deleteExpense(target.id);

    await updateCheckIn(ci.id, {
      totalSaved: simulatedValues.bankedSavings,
      totalSpent: simulatedValues.totalSpent,
      totalBudget: simulatedValues.totalBudget,
      decisions: simulatedValues.decisions,
    });

    showToast(`Transaction updated and ${weekLabel} check-in successfully rebalanced.`, 'success');
  };

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

  const isCurrentTimeframe = timeframeOffset === 0;

  // Check for one-time deposits in the active week
  const depositsThisWeek = useMemo(() => {
    if (timeframeMode !== 'week') return [];
    return (household?.oneOffDeposits || []).filter((dep) => {
      const depDate = new Date(dep.date + 'T12:00:00');
      return depDate >= activeDateRange.startDate && depDate <= activeDateRange.endDate;
    });
  }, [timeframeMode, household?.oneOffDeposits, activeDateRange]);

  const depositTotalThisWeek = useMemo(() => {
    return depositsThisWeek.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [depositsThisWeek]);

  const isDepositExpansion = useMemo(() => {
    if (!hasAnyWeeklyOverride) return false;
    if (depositTotalThisWeek > 0) return true;
    const activeWeekStartStr = formatLocalDate(activeDateRange.startDate);
    const hasMatchingDeposit = (household?.oneOffDeposits || []).some((dep) => {
      const depDate = new Date(dep.date + 'T12:00:00');
      const targetRange = getWeekRange(depDate, household?.firstDayOfWeek || 'Monday', 0);
      return formatLocalDate(targetRange.startDate) === activeWeekStartStr;
    });
    if (hasMatchingDeposit) return true;
    const weekOverrides = household?.weeklyOverrides?.[activeWeekId];
    if (weekOverrides) {
      const overrideKeys = Object.keys(weekOverrides);
      const isOnlySavings = overrideKeys.every(
        (k) => k === 'savings' || k === 'cat_savings' || categories.find((c) => c.id === k)?.type === 'savings'
      );
      if (isOnlySavings && totalTimeframeBudget > totalWeeklyBaseline) return true;
    }
    return false;
  }, [
    hasAnyWeeklyOverride,
    depositTotalThisWeek,
    household?.oneOffDeposits,
    activeDateRange,
    household?.firstDayOfWeek,
    household?.weeklyOverrides,
    activeWeekId,
    categories,
    totalTimeframeBudget,
    totalWeeklyBaseline,
  ]);

  // 1% – 75%: Muted Sage Green, 75% – 90%: Earth Brown, 90% – 99%: Alert Red, >= 100%: Alert Red fill & Alert Red outline
  let overallBarColor = 'bg-sage-600';
  if (overallPercentage >= 100) {
    overallBarColor = 'bg-alert-red-600';
  } else if (overallPercentage >= 90) {
    overallBarColor = 'bg-alert-red-600';
  } else if (overallPercentage >= 75) {
    overallBarColor = 'bg-brown-700';
  }

  // Timeframe Navigation formatted titles & fiscal sublabels
  const timeframeNavDisplay = useMemo(() => {
    if (timeframeMode === 'month') {
      const monthTitle = activeDateRange.startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthSub = `Month ${fiscalMonth.fiscalMonthNumber} of 12`;
      return { title: monthTitle, sub: monthSub };
    } else {
      const startShort = activeDateRange.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endShort = activeDateRange.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekTitle = `W${fiscalTracker.weekOfFiscalYear}: ${startShort} - ${endShort}`;
      const weekSub = `W${fiscalTracker.weekOfFiscalMonth} of ${fiscalTracker.monthWeekCount} for M${fiscalTracker.fiscalMonthNumber}`;
      return { title: weekTitle, sub: weekSub };
    }
  }, [timeframeMode, activeDateRange, fiscalMonth, fiscalTracker]);

  // 4. Variable Income Buffer & Runway Calculations
  const bufferCategory = useMemo(() => {
    return categories.find(
      (c) => c.id === 'cat_income_buffer' || c.name.toLowerCase().includes('buffer')
    );
  }, [categories]);

  const isVariableIncome = household?.incomeType === 'variable';
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
    <div className="space-y-3.5 sm:space-y-4 border-2 border-brown-900 rounded-[1.75rem] sm:rounded-[2rem] p-1 sm:p-1.5 shadow-xs ring-1 ring-brown-950/10">
      {/* Timeframe Selector & Navigation Bar */}
      <div id="dashboard-timeframe-header" className="bg-white border-2 border-brown-800/80 rounded-[1.35rem] sm:rounded-[1.5rem] p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        {/* Left: Timeframe Title & Toggle (Week / Month) */}
        <div className="flex items-start justify-between gap-3 w-full sm:w-auto">
          <h2 className="text-xs sm:text-sm font-extrabold text-dark-green-900 shrink-0 self-start pt-1.5">
            Timeframe:
          </h2>
          <div className="inline-flex p-1 bg-beige-100/80 rounded-2xl border border-beige-200 ml-auto sm:ml-2">
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
        <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-center gap-1 bg-beige-50 border border-beige-200/80 rounded-2xl p-1 w-full sm:w-auto flex-1 sm:flex-initial">
            <button
              onClick={() => setTimeframeOffset((prev) => prev - 1)}
              id="nav-timeframe-prev"
              title={`Previous ${timeframeMode}`}
              className="p-2 rounded-xl hover:bg-beige-200 text-dark-green-900 transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 sm:px-4 py-1 text-center flex-1 sm:flex-initial min-w-[170px] sm:min-w-[240px]">
              <span className="text-xs sm:text-sm font-extrabold text-dark-green-900 block leading-tight">
                {timeframeNavDisplay.title}
              </span>
              <span className="text-[10px] font-bold text-brown-700 block tracking-tight mt-0.5">
                {timeframeNavDisplay.sub}
              </span>
            </div>

            <button
              onClick={() => setTimeframeOffset((prev) => prev + 1)}
              id="nav-timeframe-next"
              title={`Next ${timeframeMode}`}
              className="p-2 rounded-xl hover:bg-beige-200 text-dark-green-900 transition cursor-pointer shrink-0"
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
          className="bg-white border-2 border-brown-800/80 rounded-[1.35rem] sm:rounded-[1.5rem] p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden"
        >
          <div className="space-y-1.5 min-w-0">
            <h3 className="text-base sm:text-lg font-black text-dark-green-950">
              {historicalCheckIn ? 'Past Weekly Check-In Recorded' : 'Execute Historical Weekly Check-In'}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-dark-green-900 bg-sage-100 px-2.5 py-0.5 rounded-full">
                Historical Week &bull; {timeframeNavDisplay.title}
              </span>
              {historicalCheckIn ? (
                <span className="text-[12px] font-black text-dark-green-900 bg-sage-100 border border-sage-300 px-3 py-1 rounded-full flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-dark-green-700 shrink-0" />
                  <span>{formatCurrency(historicalCheckIn.totalSaved)} saved</span>
                </span>
              ) : (
                <span className="text-[10px] font-extrabold text-brown-900 bg-brown-100 border border-brown-300 px-2.5 py-0.5 rounded-full">
                  Check-In Not Yet Executed
                </span>
              )}
            </div>
            <p className="text-xs text-brown-700 max-w-xl">
              {historicalCheckIn
                ? `Weekly check-in recorded for ${timeframeNavDisplay.title}. You can review the breakdown and reflection notes at any time.`
                : `Reconcile expenses, absorb category deficits, and bank surplus envelope balances into your savings pot for ${timeframeNavDisplay.title}.`}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {historicalCheckIn ? (
              <button
                id="dashboard-historical-checkin-cta"
                onClick={() => setIsReviewModalOpen(true)}
                className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-sm transition active:scale-95 cursor-pointer"
              >
                <span>Review Check-In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                id="dashboard-historical-checkin-cta"
                onClick={() => openWeeklyCheckInModal()}
                className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-sm transition active:scale-95 cursor-pointer"
              >
                <span>Execute Check-In for this Week</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Executive Budget Summary Card - Sage border */}
      <div className="bg-white border-2 border-sage-300 rounded-[1.35rem] sm:rounded-[1.5rem] p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-beige-100 pb-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xs sm:text-sm font-extrabold text-dark-green-900">
              Spending Summary &bull; {timeframeNavDisplay.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-brown-700 font-medium">
              {timeframeExpenses.length} {timeframeExpenses.length === 1 ? 'transaction' : 'transactions'}
            </span>
          </div>
        </div>

        {/* 3 Metric Columns - Horizontal layout */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
          <div className="p-2 sm:p-2.5 bg-beige-50/50 border border-beige-200/60 rounded-lg space-y-0.5 min-w-0">
            <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-dark-grey-600 block truncate">
              Budget
            </span>
            <div className="text-sm sm:text-lg lg:text-xl font-black font-mono text-dark-green-900 tracking-tight flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
              {hasAnyWeeklyOverride ? (
                <>
                  <span
                    className="line-through text-dark-grey-600/70 text-[10px] sm:text-xs font-semibold"
                    title={`Global Baseline: ${formatCurrency(totalWeeklyBaseline)}`}
                  >
                    {formatCurrency(totalWeeklyBaseline)}
                  </span>
                  <span
                    className="text-dark-green-900"
                    title={
                      isDepositExpansion
                        ? `Expanded Weekly Budget: ${formatCurrency(totalTimeframeBudget)}`
                        : `Active Weekly Prorated: ${formatCurrency(totalTimeframeBudget)}`
                    }
                  >
                    {formatCurrency(totalTimeframeBudget)}
                  </span>
                  <span
                    className={`text-[8px] sm:text-[9px] font-extrabold px-1 py-0.2 rounded border ${
                      isDepositExpansion
                        ? 'bg-sage-100 text-dark-green-900 border-sage-300'
                        : 'bg-sky-blue-100 text-sky-blue-900 border-sky-blue-300'
                    }`}
                  >
                    {isDepositExpansion ? 'Deposit' : 'Prorated'}
                  </span>
                </>
              ) : (
                formatCurrency(totalTimeframeBudget)
              )}
            </div>
            <p className="text-[9px] sm:text-[10px] text-brown-700 truncate">
              {hasAnyWeeklyOverride
                ? isDepositExpansion
                  ? `Expanded (+${formatCurrency(
                      depositTotalThisWeek > 0
                        ? depositTotalThisWeek
                        : totalTimeframeBudget - totalWeeklyBaseline
                    )})`
                  : `Prorated (${totalTimeframeBudget >= totalWeeklyBaseline ? '+' : ''}${formatCurrency(
                      totalTimeframeBudget - totalWeeklyBaseline
                    )})`
                : `${visibleCategories.length} ${timeframeMode === 'week' ? 'weekly buckets' : 'buckets'}`}
            </p>
          </div>

          <div className="p-2 sm:p-2.5 bg-beige-50/50 border border-beige-200/60 rounded-lg space-y-0.5 min-w-0">
            <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-dark-grey-600 block truncate">
              Logged
            </span>
            <div className="text-sm sm:text-lg lg:text-xl font-black font-mono text-dark-green-900 tracking-tight">
              {formatCurrency(totalTimeframeSpent)}
            </div>
            <p className="text-[9px] sm:text-[10px] text-brown-700 truncate">
              {overallPercentage}% spent
            </p>
          </div>

          <div
            className={`p-2 sm:p-2.5 border rounded-lg space-y-0.5 min-w-0 ${
              isNetOverBudget
                ? 'bg-alert-red-50/70 border-alert-red-200'
                : 'bg-sage-50/60 border-sage-200'
            }`}
          >
            <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-dark-grey-600 block truncate">
              {isNetOverBudget ? 'Net Over' : 'Safe Remaining'}
            </span>
            <div
              className={`text-sm sm:text-lg lg:text-xl font-black font-mono tracking-tight ${
                isNetOverBudget ? 'text-alert-red-600' : 'text-sage-900'
              }`}
            >
              {isNetOverBudget
                ? `-${formatCurrency(Math.abs(netRemaining))}`
                : formatCurrency(netRemaining)}
            </div>
          </div>
        </div>

        {/* Global Progress Bar - Slim & Smooth */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-dark-green-900">
            <span>Overall Budget Consumption</span>
            <span>{overallPercentage}%</span>
          </div>
          <div
            className={`w-full h-2 rounded-full overflow-hidden transition-all ${
              overallPercentage >= 100
                ? 'border-2 border-alert-red-500 ring-2 ring-alert-red-500/20 bg-alert-red-50'
                : 'bg-beige-200 border border-beige-300/40'
            }`}
          >
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-beige-200 pb-2 px-4 sm:px-5">
          <div>
            <h2 className="text-xl font-extrabold text-dark-green-900">
              Budget Buckets
            </h2>
            <p className="text-xs text-brown-700">
              Click any card to drill down into transaction history.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openAllocationModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-beige-100 hover:bg-dark-green-800 hover:text-white text-dark-green-900 text-xs font-bold rounded-xl border border-beige-300 transition cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
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
        <div className="border-b border-beige-100 pb-3 space-y-1">
          <h3 className="text-base font-extrabold text-dark-green-900">
            Timeframe Transactions ({timeframeExpenses.length})
          </h3>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-brown-700">
              {activeDateRange.label}
            </p>

            <button
              onClick={() => openLogExpenseModal()}
              className="flex items-center justify-start text-left gap-1.5 px-3 py-1.5 bg-beige-100 hover:bg-dark-green-800 hover:text-white text-dark-green-900 text-xs font-bold rounded-xl transition cursor-pointer border border-beige-300 flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-left leading-tight">Log Transaction</span>
            </button>
          </div>
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
                Click "Log Transaction" above to record receipts and expenses into the household ledger.
              </p>
            </div>
            <button
              onClick={() => openLogExpenseModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log First Transaction for this Timeframe</span>
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
                        <span>
                          {(() => {
                            const d = exp.date ? new Date(exp.date + 'T12:00:00') : new Date(exp.timestamp);
                            return !isNaN(d.getTime())
                              ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : exp.date;
                          })()}
                        </span>
                        <span>&bull;</span>
                        <span>{payer?.name || 'Member'}</span>
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
                      onClick={() => handleDeleteExpenseClick(exp)}
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

      {/* Check-In Read-Only Review Modal */}
      {historicalCheckIn && (
        <CheckInReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          checkIn={historicalCheckIn}
        />
      )}

      {/* Historical Check-In Impact Interception Modal */}
      {impactModalState.isOpen && impactModalState.targetExpense && impactModalState.checkIn && (
        <CheckInImpactModal
          isOpen={impactModalState.isOpen}
          onClose={() =>
            setImpactModalState({
              isOpen: false,
              targetExpense: null,
              actionType: 'delete',
              checkIn: null,
            })
          }
          targetExpense={impactModalState.targetExpense}
          actionType={impactModalState.actionType}
          checkIn={impactModalState.checkIn}
          categories={categories}
          expenses={expenses}
          household={household}
          onConfirm={handleConfirmImpact}
        />
      )}
    </div>
  );
};
