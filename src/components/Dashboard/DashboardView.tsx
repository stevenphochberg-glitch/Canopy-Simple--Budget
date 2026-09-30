import React, { useMemo, useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { Category, CategoryGroup, Expense, OneOffDeposit } from '../../types';
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
  MessageSquare,
  AlertCircle,
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
    deleteDeposit,
    showToast,
  } = useHousehold();

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingCheckIn, setIsDeletingCheckIn] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [areAllCardsExpanded, setAreAllCardsExpanded] = useState(false);
  const [earlierCheckInWarning, setEarlierCheckInWarning] = useState<string | null>(null);

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

  // Detect if there is an earlier past-due uncompleted check-in prior to the current active historical week
  const earlierUncompletedWeek = useMemo(() => {
    if (timeframeMode !== 'week' || timeframeOffset >= 0) return null;
    const firstDay = household?.firstDayOfWeek || 'Monday';
    const fiscalYearEnd = household?.fiscalYearEndMonth || 12;

    // Earliest boundary: household creation date or earliest expense or 12 weeks back
    let earliestDate = new Date();
    if (household?.createdAt) {
      const created = new Date(household.createdAt);
      if (!isNaN(created.getTime())) earliestDate = created;
    }
    if (expenses.length > 0) {
      expenses.forEach((e) => {
        const d = e.date ? new Date(e.date + (e.date.length === 10 ? 'T12:00:00' : '')) : new Date(e.timestamp);
        if (!isNaN(d.getTime()) && d < earliestDate) earliestDate = d;
      });
    }
    const maxPastLimit = new Date();
    maxPastLimit.setDate(maxPastLimit.getDate() - 12 * 7);
    if (earliestDate < maxPastLimit) earliestDate = maxPastLimit;

    // Start scanning week by week from earliestDate up to the week strictly before activeDateRange.startDate
    let scanDate = new Date(earliestDate);
    let scanRange = getWeekRange(scanDate, firstDay, 0);

    const activeStartStr = formatLocalDate(activeDateRange.startDate);
    const today = new Date();
    const currentWeekRange = getWeekRange(today, firstDay, 0);
    const currentStartStr = formatLocalDate(currentWeekRange.startDate);

    while (formatLocalDate(scanRange.startDate) < activeStartStr) {
      const scanStartStr = formatLocalDate(scanRange.startDate);
      const scanEndStr = formatLocalDate(scanRange.endDate);

      // Check if this scanned week was completed
      const isCompleted = checkIns.some(
        (c) =>
          c.status === 'completed' &&
          (c.weekStartDate === scanStartStr ||
            c.weekEndDate === scanEndStr ||
            c.id.includes(scanStartStr))
      );

      // If it's not completed, and this week has concluded in the past (before current week)
      if (!isCompleted && scanStartStr < currentStartStr) {
        const tracker = getFiscalTrackerInfo(scanRange.startDate, fiscalYearEnd);
        return {
          weekStartDate: scanRange.startDate,
          weekEndDate: scanRange.endDate,
          startStr: scanStartStr,
          endStr: scanEndStr,
          weekOfFiscalYear: tracker.weekOfFiscalYear,
          label: `W${tracker.weekOfFiscalYear} (${scanRange.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${scanRange.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
        };
      }

      // Move to next week
      scanDate = new Date(scanRange.startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      scanRange = getWeekRange(scanDate, firstDay, 0);
    }

    return null;
  }, [timeframeMode, timeframeOffset, household, expenses, checkIns, activeDateRange]);

  const historicalSavingsDeducted = useMemo(() => {
    if (!historicalCheckIn?.decisions) return 0;
    return historicalCheckIn.decisions.reduce((sum, d) => {
      const deduction = Number(d.savingsDeduction) || (d.choice === 'deduct_savings' ? Math.abs(d.difference) : 0);
      return sum + deduction;
    }, 0);
  }, [historicalCheckIn]);

  const historicalDeposits = useMemo(() => {
    if (!historicalCheckIn) return [];
    return (household?.oneOffDeposits || []).filter((dep) => {
      const depDate = new Date(dep.date + (dep.date.length === 10 ? 'T12:00:00' : ''));
      return depDate >= activeDateRange.startDate && depDate <= activeDateRange.endDate;
    });
  }, [household?.oneOffDeposits, activeDateRange, historicalCheckIn]);

  const historicalDepositTotal = useMemo(() => {
    return historicalDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [historicalDeposits]);

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

  // Check for one-time deposits in the active week / timeframe
  const depositsThisWeek = useMemo(() => {
    return (household?.oneOffDeposits || []).filter((dep) => {
      const depDate = new Date(dep.date + (dep.date.length === 10 ? 'T12:00:00' : ''));
      return depDate >= activeDateRange.startDate && depDate <= activeDateRange.endDate;
    });
  }, [household?.oneOffDeposits, activeDateRange]);

  const depositTotalThisWeek = useMemo(() => {
    return depositsThisWeek.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [depositsThisWeek]);

  // 3. Executive Overview Spending Summary Calculations:
  // - Week View: Budget Set sums weekly allocations of Essentials, Fun Money, and Savings (non-Bills), plus any one-time deposit expansion.
  // - Month View: Total Monthly Budget is a statically derived constant (Baseline Weekly Allocation × Weeks in Fiscal Month) + one-time deposits.
  const { totalTimeframeBudget, hasAnyWeeklyOverride } = useMemo(() => {
    if (timeframeMode === 'week') {
      let sum = 0;
      let overridePresent = false;
      visibleCategories.forEach((c) => {
        const { budget, isOverridden } = getCategoryEffectiveWeeklyBudget(c, activeWeekId, household);
        const isSavings = c.type === 'savings' || c.group?.toLowerCase() === 'savings';
        const effective = isSavings
          ? Math.max(budget, (Number(c.baselineBudget) || 0) + depositTotalThisWeek)
          : budget;
        sum += effective;
        if (isOverridden || (isSavings && depositTotalThisWeek > 0)) {
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
    return {
      totalTimeframeBudget: monthSum + depositTotalThisWeek,
      hasAnyWeeklyOverride: depositTotalThisWeek > 0,
    };
  }, [timeframeMode, visibleCategories, categories, weeksInFiscalMonth, activeWeekId, household, depositTotalThisWeek]);

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

  // Unified timeframe transactions list (combining expenses and one-time deposits)
  const unifiedTimeframeTransactions = useMemo(() => {
    const list: Array<
      | { type: 'expense'; data: Expense; date: Date; id: string }
      | { type: 'deposit'; data: OneOffDeposit; date: Date; id: string }
    > = [];

    timeframeExpenses.forEach((exp) => {
      const d = exp.date ? new Date(exp.date + (exp.date.length === 10 ? 'T12:00:00' : '')) : new Date(exp.timestamp);
      list.push({ type: 'expense', data: exp, date: d, id: exp.id });
    });

    depositsThisWeek.forEach((dep) => {
      const d = new Date(dep.date + (dep.date.length === 10 ? 'T12:00:00' : ''));
      list.push({ type: 'deposit', data: dep, date: d, id: dep.id });
    });

    list.sort((a, b) => b.date.getTime() - a.date.getTime());
    return list;
  }, [timeframeExpenses, depositsThisWeek]);

  const isDepositExpansion = useMemo(() => {
    if (depositTotalThisWeek > 0) return true;
    if (!hasAnyWeeklyOverride) return false;
    const activeWeekStartStr = formatLocalDate(activeDateRange.startDate);
    const hasMatchingDeposit = (household?.oneOffDeposits || []).some((dep) => {
      const depDate = new Date(dep.date + (dep.date.length === 10 ? 'T12:00:00' : ''));
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
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-nowrap">
              <h3 className="text-base sm:text-lg font-black text-dark-green-950 whitespace-nowrap">
                {historicalCheckIn ? `W${fiscalTracker.weekOfFiscalYear} Check-in Details` : `Execute W${fiscalTracker.weekOfFiscalYear} Weekly Check-In`}
              </h3>
              {historicalCheckIn ? (
                <span className="text-[12px] font-black text-dark-green-900 bg-sage-100 border border-sage-300 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                  <CheckCircle2 className="w-4 h-4 text-dark-green-700 shrink-0" />
                  <span>complete</span>
                </span>
              ) : (
                <span className="text-[10px] font-extrabold text-brown-900 bg-brown-100 border border-brown-300 px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                  Check-In Not Yet Executed
                </span>
              )}
            </div>

            {historicalCheckIn ? (
              <div className="flex flex-col lg:flex-row items-stretch gap-2.5 max-w-4xl">
                <div className="flex-1 min-w-0 flex items-start gap-2 bg-beige-50/80 border border-beige-200/90 rounded-xl p-2.5 text-xs text-brown-900">
                  {historicalSavingsDeducted > 0 ? (
                    <>
                      <svg
                        className="w-3.5 h-3.5 shrink-0 mt-0.5"
                        viewBox="0 0 24 24"
                        fill="#F5EFEB"
                        stroke="#8C6239"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                        <line x1="12" y1="9" x2="12" y2="13" stroke="#8C6239" />
                        <line x1="12" y1="17" x2="12.01" y2="17" stroke="#8C6239" />
                      </svg>
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brown-700 block">
                          SAVINGS ADJUSTED:
                        </span>
                        <p className="text-brown-800 text-xs leading-relaxed">
                          You deposited{' '}
                          <strong>{formatCurrency(historicalCheckIn.totalSaved || 0)}</strong> into savings after covering {formatCurrency(historicalSavingsDeducted)} in category overspends
                          {historicalDepositTotal > 0 ? ` (including +${formatCurrency(historicalDepositTotal)} from one-off deposits)` : ''}.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-sage-700 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brown-700 block">
                          SAVINGS GOAL SECURED:
                        </span>
                        <p className="text-brown-800 text-xs leading-relaxed">
                          You have banked{' '}
                          <strong>{formatCurrency(historicalCheckIn.totalSaved || 0)}</strong> into your savings pot this week
                          {historicalDepositTotal > 0 ? ` (including +${formatCurrency(historicalDepositTotal)} from one-off deposits)` : ''}.
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {historicalCheckIn.notes && (
                  <div className="flex-1 min-w-0 flex items-start gap-2 bg-beige-50/80 border border-beige-200/90 rounded-xl p-2.5 text-xs text-brown-900">
                    <MessageSquare className="w-3.5 h-3.5 text-sage-700 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brown-700 block">
                        Check-In Comments:
                      </span>
                      <p className="italic text-brown-800 text-xs leading-relaxed">
                        "{historicalCheckIn.notes}"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-brown-700 max-w-xl">
                  Reconcile expenses, absorb category deficits, and bank surplus envelope balances into your savings pot for {timeframeNavDisplay.title}.
                </p>
                {earlierCheckInWarning && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-900 font-bold animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>{earlierCheckInWarning}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEarlierCheckInWarning(null)}
                      className="text-amber-700 hover:text-amber-900 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
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
                type="button"
                onClick={() => {
                  if (earlierUncompletedWeek) {
                    setEarlierCheckInWarning(
                      `The earlier fiscal week check-in (${earlierUncompletedWeek.label}) needs to be completed first.`
                    );
                    showToast(
                      `The earlier fiscal week check-in (${earlierUncompletedWeek.label}) needs to be completed first.`,
                      'warning'
                    );
                    return;
                  }
                  openWeeklyCheckInModal();
                }}
                className={`flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 text-xs sm:text-sm font-extrabold rounded-2xl transition ${
                  earlierUncompletedWeek
                    ? 'bg-beige-200 text-dark-grey-600 border border-beige-300 opacity-70 cursor-not-allowed'
                    : 'bg-dark-green-800 hover:bg-dark-green-900 text-white shadow-sm active:scale-95 cursor-pointer'
                }`}
                title={
                  earlierUncompletedWeek
                    ? `Earlier fiscal week check-in (${earlierUncompletedWeek.label}) needs to be completed first.`
                    : 'Execute Check-In for this Week'
                }
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
              {unifiedTimeframeTransactions.length} {unifiedTimeframeTransactions.length === 1 ? 'transaction' : 'transactions'}
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
              {isNetOverBudget ? 'Net Over' : historicalCheckIn ? 'Banked Savings' : 'Safe Remaining'}
            </span>
            <div
              className={`text-sm sm:text-lg lg:text-xl font-black font-mono tracking-tight ${
                isNetOverBudget ? 'text-alert-red-600' : 'text-sage-900'
              }`}
            >
              {isNetOverBudget
                ? `-${formatCurrency(Math.abs(netRemaining))}`
                : formatCurrency(
                    historicalCheckIn
                      ? (historicalCheckIn.totalSaved !== undefined
                          ? historicalCheckIn.totalSaved
                          : netRemaining)
                      : netRemaining
                  )}
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
                isExpanded={areAllCardsExpanded}
                onToggleExpand={() => setAreAllCardsExpanded((prev) => !prev)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Timeframe Recent Expenses Ledger Table / List */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="border-b border-beige-100 pb-3 space-y-1">
          <h3 className="text-base font-extrabold text-dark-green-900">
            Timeframe Transactions ({unifiedTimeframeTransactions.length})
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

        {unifiedTimeframeTransactions.length === 0 ? (
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
            {unifiedTimeframeTransactions.map((item) => {
              if (item.type === 'deposit') {
                const dep = item.data;
                const payer = members.find((m) => m.userId === dep.payerMemberId);

                return (
                  <div
                    key={dep.id}
                    id={`deposit-card-${dep.id}`}
                    className="py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-beige-50/60 px-2 rounded-xl transition bg-sage-50/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-sage-100 border border-sage-300 flex items-center justify-center text-dark-green-900 flex-shrink-0">
                        <PiggyBank className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-dark-green-900 text-sm truncate">
                            {dep.description || 'One-Time Deposit'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-dark-grey-600">
                          <span>
                            {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span>&bull;</span>
                          <span>
                            {payer?.name || dep.contributor || 'Household Deposit'}
                          </span>
                          {dep.notes && (
                            <>
                              <span>&bull;</span>
                              <span className="truncate italic text-brown-700 max-w-[200px]">{dep.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm sm:text-base font-black text-dark-green-900">
                          +{formatCurrency(dep.amount)}
                        </span>
                        <span className="block text-[9px] font-bold text-sage-800">
                          Deposit
                        </span>
                      </div>

                      <button
                        onClick={async () => {
                          if (deleteDeposit) {
                            await deleteDeposit(dep.id);
                            showToast('Deposit removed', 'info');
                          }
                        }}
                        className="p-1.5 text-brown-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Delete deposit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              }

              const exp = item.data;
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
                            const d = exp.date ? new Date(exp.date + (exp.date.length === 10 ? 'T12:00:00' : '')) : new Date(exp.timestamp);
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
