import React, { useState, useMemo } from 'react';
import { Category, Expense, TimeframeMode, DateRange, CheckIn } from '../../types';
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
import { Plus, AlertCircle, CheckCircle2, ChevronRight, ChevronDown, ShieldCheck, PiggyBank, MoreHorizontal, Sparkles } from 'lucide-react';
import { CategoryIcon } from '../Common/CategoryIcon';
import { BudgetProgressBar } from '../Common/BudgetProgressBar';

export interface WaterfallMetrics {
  totalTransferPot: number;
  totalDeficit: number;
  netDeficit: number;
  potUsedForCoverage: number;
  baselineSavingsTargetAvailable: number;
}

export interface CategoryCardProps {
  category: Category;
  expenses: Expense[];
  timeframeMode: TimeframeMode;
  dateRange: DateRange;
  onQuickLog: (category: Category) => void;
  navigateToCategoryLedger: (catId: string | null) => void;
  household: any;
  checkIns: CheckIn[];
  waterfallMetrics: WaterfallMetrics;
  categorySpending?: { totalSpent: number; count: number };
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const CategoryCardComponent: React.FC<CategoryCardProps> = ({
  category,
  expenses,
  timeframeMode,
  dateRange,
  onQuickLog,
  navigateToCategoryLedger,
  household,
  checkIns,
  waterfallMetrics,
  categorySpending,
  isExpanded: propIsExpanded,
  onToggleExpand,
}) => {
  console.count("Category Card Rendered");
  const [localIsExpanded, setLocalIsExpanded] = useState(false);
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : localIsExpanded;

  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setLocalIsExpanded((prev) => !prev);
    }
  };

  const [coverageMode, setCoverageMode] = useState<'desc' | 'amount' | 'percent'>('desc');
  const [protectedMode, setProtectedMode] = useState<'desc' | 'amount' | 'percent'>('desc');
  const [depositMode, setDepositMode] = useState<'desc' | 'amount' | 'percent'>('desc');

  const cycleMode = (current: 'desc' | 'amount' | 'percent') => {
    if (current === 'desc') return 'amount';
    if (current === 'amount') return 'percent';
    return 'desc';
  };

  const isBills = category.group?.toLowerCase() === 'bills' || category.name?.toLowerCase() === 'bills' || category.id === 'cat_bills';
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
  const isMonthView = timeframeMode === 'month';
  const fiscalMonth = getFiscalMonthForDate(dateRange.startDate, household?.fiscalYearEndMonth || 12);
  const weeksInMonth = fiscalMonth.weekCount || 4;

  const budgetForTimeframe = isMonthView
    ? baselineBudget * weeksInMonth
    : effectiveWeeklyBudget;

  const isProratedWeek = !isMonthView && isOverridden && overrideAmount !== undefined;

  // Calculate actual spending in this active date range (using precomputed spending if provided)
  const { totalSpent, count } = categorySpending || calculateCategorySpending(
    expenses,
    category.id,
    dateRange.startDate,
    dateRange.endDate
  );

  // Completed check-in status for this week or previous week
  const startStr = formatLocalDate(dateRange.startDate);
  const endStr = formatLocalDate(dateRange.endDate);

  const thisWeekCheckIn = useMemo<CheckIn | undefined>(() => {
    return (checkIns || []).find(
      (c) =>
        c.status === 'completed' &&
        (c.weekEndDate === endStr || c.weekStartDate === startStr || c.id.includes(startStr))
    );
  }, [checkIns, startStr, endStr]);

  const hasThisWeekCheckIn = !!thisWeekCheckIn;

  const prevWeekRange = useMemo(() => {
    const targetDate = new Date(dateRange.startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getWeekRange(targetDate, household?.firstDayOfWeek || 'Monday', 0);
  }, [dateRange.startDate, household?.firstDayOfWeek]);

  const hasPrevWeekCheckIn = useMemo(() => {
    const pStart = formatLocalDate(prevWeekRange.startDate);
    const pEnd = formatLocalDate(prevWeekRange.endDate);
    return (checkIns || []).some(
      (c) =>
        c.status === 'completed' &&
        (c.weekEndDate === pEnd || c.weekStartDate === pStart || c.id.includes(pStart))
    );
  }, [checkIns, prevWeekRange]);

  const isSavingsAllocated = !isMonthView ? (hasPrevWeekCheckIn || hasThisWeekCheckIn) : true;
  const isSavingsFunded = isSavingsAllocated;
  const effectiveSpent = isSavings
    ? (!isMonthView ? (isSavingsFunded ? budgetForTimeframe : (totalSpent > 0 ? totalSpent : 0)) : totalSpent)
    : totalSpent;

  const remaining = budgetForTimeframe - effectiveSpent;
  const isOverBudget = !isSavings && remaining < 0;
  const percentage = budgetForTimeframe > 0 ? Math.round((effectiveSpent / budgetForTimeframe) * 100) : 0;

  // Decision breakdown for post-check-in stacked segment visualization
  const categoryDecision = useMemo(() => {
    if (!thisWeekCheckIn || !thisWeekCheckIn.decisions) return null;
    return thisWeekCheckIn.decisions.find((d) => d.categoryId === category.id) || null;
  }, [thisWeekCheckIn, category.id]);

  // Deposits this active week
  const depositsThisWeek = useMemo(() => {
    return (household?.oneOffDeposits || []).filter((dep) => {
      const depDate = new Date(dep.date + 'T12:00:00');
      return depDate >= dateRange.startDate && depDate <= dateRange.endDate;
    });
  }, [household?.oneOffDeposits, dateRange]);

  const depositTotalThisWeek = useMemo(() => {
    return depositsThisWeek.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [depositsThisWeek]);

  const isDepositExpansion = isSavings && (
    depositTotalThisWeek > 0 ||
    (overrideAmount !== undefined && overrideAmount > baselineBudget)
  );

  const depositAmount = isSavings
    ? (depositTotalThisWeek > 0
        ? depositTotalThisWeek
        : (overrideAmount !== undefined && overrideAmount > baselineBudget ? overrideAmount - baselineBudget : 0))
    : 0;

  // WATERFALL METRICS: Injected as precalculated, memoized metrics from parent dashboard
  const {
    totalTransferPot,
    totalDeficit,
    netDeficit,
    potUsedForCoverage,
    baselineSavingsTargetAvailable,
  } = waterfallMetrics;

  const totalAvailableSavings = baselineSavingsTargetAvailable;

  // 3. For this individual underspent expense category:
  const { categoryOverspendCoverage, categoryLeftoverSurplus } = useMemo(() => {
    if (isSavings || isBills) return { categoryOverspendCoverage: 0, categoryLeftoverSurplus: 0 };
    const mySurplus = Math.max(0, remaining);
    if (mySurplus <= 0 || totalTransferPot <= 0) {
      return { categoryOverspendCoverage: 0, categoryLeftoverSurplus: 0 };
    }
    // Proportional share of the pot used for overspend coverage
    const coverageShare = mySurplus * (potUsedForCoverage / totalTransferPot);
    const leftover = Math.max(0, mySurplus - coverageShare);
    return {
      categoryOverspendCoverage: coverageShare,
      categoryLeftoverSurplus: leftover,
    };
  }, [isSavings, isBills, remaining, totalTransferPot, potUsedForCoverage]);

  const { categoryTransfersCovered, categorySavingsCovered, categoryProratedCovered } = useMemo(() => {
    if (isSavings || remaining >= 0) {
      return { categoryTransfersCovered: 0, categorySavingsCovered: 0, categoryProratedCovered: 0 };
    }
    const def = Math.abs(remaining);

    // 1. Post-Check-In: strictly use the recorded decision resolution and actual savings deduction
    if (thisWeekCheckIn) {
      const dec = categoryDecision;
      const potCovered = dec?.transfersCovered !== undefined
        ? Number(dec.transfersCovered)
        : (totalDeficit > 0 ? (def / totalDeficit) * potUsedForCoverage : 0);
      const remAfterPot = Math.max(0, def - potCovered);

      let savCovered = 0;
      if (dec?.savingsDeduction !== undefined && Number(dec.savingsDeduction) > 0) {
        savCovered = Math.min(remAfterPot, Number(dec.savingsDeduction));
      } else if (dec?.choice === 'deduct_savings') {
        savCovered = remAfterPot;
      } else if (dec?.choice === 'reduce_future') {
        savCovered = 0;
      } else {
        // Only use what was actually deducted from savings in this completed check-in
        const savDec = (thisWeekCheckIn.decisions || []).find(
          (d) => d.categoryId === 'cat_savings' || d.categoryName?.toLowerCase().includes('saving')
        );
        const actualSavDeducted = Number(savDec?.savingsDeduction) || 0;
        savCovered = totalDeficit > 0 ? Math.min(remAfterPot, (def / totalDeficit) * actualSavDeducted) : 0;
      }

      const prorated = dec?.proratedCovered !== undefined
        ? Number(dec.proratedCovered)
        : (dec?.choice === 'reduce_future'
            ? remAfterPot
            : Math.max(0, remAfterPot - savCovered));

      return {
        categoryTransfersCovered: potCovered,
        categorySavingsCovered: savCovered,
        categoryProratedCovered: prorated > 0 ? prorated : (dec?.choice === 'reduce_future' ? def : 0),
      };
    }

    // 2. Pre-Check-In pacing estimation
    const transfersShare = totalDeficit > 0 ? (def / totalDeficit) * potUsedForCoverage : 0;
    const remainingDef = Math.max(0, def - transfersShare);
    const savingsShare = totalDeficit > 0 ? Math.min(remainingDef, (def / totalDeficit) * totalAvailableSavings) : 0;
    const proratedShare = Math.max(0, remainingDef - savingsShare);

    return {
      categoryTransfersCovered: transfersShare,
      categorySavingsCovered: savingsShare,
      categoryProratedCovered: proratedShare,
    };
  }, [isSavings, remaining, thisWeekCheckIn, categoryDecision, totalDeficit, potUsedForCoverage, totalAvailableSavings]);

  // Contributions sent to savings from underspent expense categories during check-in
  const savingsContributions = useMemo(() => {
    // Only displayed/computed after the week's check-in is complete
    if (!isSavings || !thisWeekCheckIn) return [];
    const list: { categoryId: string; categoryName: string; amount: number }[] = [];

    // Helper to compute net savings amount after deducting overspend coverage share
    const getNetSavings = (rawAmt: number, categoryDifference: number) => {
      const diff = categoryDifference > 0 ? categoryDifference : rawAmt;
      const coverageShare = (totalTransferPot > 0 && potUsedForCoverage > 0 && diff > 0)
        ? diff * (potUsedForCoverage / totalTransferPot)
        : 0;
      return Math.max(0, rawAmt - coverageShare);
    };

    // 1. From completed check-in decisions
    if (thisWeekCheckIn.decisions && thisWeekCheckIn.decisions.length > 0) {
      thisWeekCheckIn.decisions.forEach((d) => {
        const isSavCat = d.categoryId === category.id || d.categoryName?.toLowerCase().includes('savings');
        if (isSavCat) return;

        const isSavingsChoice = d.choice === 'savings' || (d.savingsContribution && d.savingsContribution > 0);
        const rawAmount = d.savingsContribution && d.savingsContribution > 0
          ? d.savingsContribution
          : d.choice === 'savings' && d.difference !== undefined && d.difference > 0
          ? d.difference
          : d.choice === 'savings' && d.budget !== undefined && d.spent !== undefined && d.budget > d.spent
          ? d.budget - d.spent
          : 0;

        const diff = d.difference !== undefined ? d.difference : rawAmount;
        const amount = getNetSavings(rawAmount, diff);

        if (isSavingsChoice && amount > 0) {
          list.push({
            categoryId: d.categoryId,
            categoryName: d.categoryName || 'Category',
            amount,
          });
        }
      });
    }

    // 2. Fallback: If thisWeekCheckIn exists and positive surplus exists in decisions
    if (list.length === 0 && thisWeekCheckIn.decisions) {
      thisWeekCheckIn.decisions.forEach((d) => {
        const isSavCat = d.categoryId === category.id || d.categoryName?.toLowerCase().includes('savings');
        if (isSavCat) return;
        const diff = (d.difference !== undefined && d.difference > 0)
          ? d.difference
          : (d.budget !== undefined && d.spent !== undefined && d.budget > d.spent)
          ? d.budget - d.spent
          : 0;
        const amount = getNetSavings(diff, diff);
        if (amount > 0) {
          list.push({
            categoryId: d.categoryId,
            categoryName: d.categoryName || 'Category',
            amount,
          });
        }
      });
    }

    return list;
  }, [isSavings, thisWeekCheckIn, category.id, totalTransferPot, potUsedForCoverage]);

  const totalSavingsSurplusTransferred = useMemo(() => {
    return savingsContributions.reduce((sum, c) => sum + c.amount, 0);
  }, [savingsContributions]);

  // For an individual expense category, check if leftover surplus was sent to savings
  const isSentToSavings = useMemo(() => {
    if (isSavings) return false;
    if (categoryDecision?.choice === 'savings') return true;
    if (categoryDecision?.savingsContribution && categoryDecision.savingsContribution > 0) return true;
    if (thisWeekCheckIn && remaining > 0) return true;
    return false;
  }, [isSavings, categoryDecision, thisWeekCheckIn, remaining]);

  // Completed check-ins for the active timeframe (Month or Week)
  const completedCheckInsInTimeframe = useMemo(() => {
    if (!checkIns || checkIns.length === 0) return [];
    const rangeStart = dateRange.startDate.getTime();
    const rangeEnd = dateRange.endDate.getTime();

    if (isMonthView) {
      return (checkIns || []).filter((c) => {
        if (c.status !== 'completed') return false;
        const cStart = new Date(c.weekStartDate + (c.weekStartDate?.length === 10 ? 'T12:00:00' : '')).getTime();
        const cEnd = new Date(c.weekEndDate + (c.weekEndDate?.length === 10 ? 'T12:00:00' : '')).getTime();
        return (cEnd >= rangeStart && cStart <= rangeEnd) ||
               (cStart >= rangeStart - 86400000 && cEnd <= rangeEnd + 86400000);
      });
    } else {
      return (checkIns || []).filter(
        (c) =>
          c.status === 'completed' &&
          (c.weekEndDate === endStr || c.weekStartDate === startStr || c.id.includes(startStr))
      );
    }
  }, [checkIns, isMonthView, dateRange, startStr, endStr]);

  // Totals based on previous weekly check-ins for weekly expense categories (Essentials, Fun money)
  const checkInTotals = useMemo(() => {
    if (isSavings || isBills || completedCheckInsInTimeframe.length === 0) {
      return null;
    }

    let totalSpentFromCheckIns = 0;
    let totalCoverageFromCheckIns = 0;
    let totalSavingsFromCheckIns = 0;
    let totalBudgetFromCheckIns = 0;
    let foundAnyDecision = false;

    completedCheckInsInTimeframe.forEach((c) => {
      const dec = (c.decisions || []).find(
        (d) => d.categoryId === category.id || d.categoryName?.toLowerCase() === category.name?.toLowerCase()
      );
      if (!dec) return;
      foundAnyDecision = true;

      const spentInWeek = Number(dec.spent) || 0;
      const budgetInWeek = Number(dec.budget) || (spentInWeek + (Number(dec.difference) || 0));
      const diffInWeek = dec.difference !== undefined ? Number(dec.difference) : budgetInWeek - spentInWeek;

      totalSpentFromCheckIns += spentInWeek;
      totalBudgetFromCheckIns += budgetInWeek;

      if (diffInWeek > 0) {
        // Calculate the transfer pot and deficit across all non-bills, non-savings expense categories in this check-in
        let weekPot = 0;
        let weekDef = 0;
        (c.decisions || []).forEach((d) => {
          const isSavCat = d.categoryId === 'cat_savings' || d.categoryName?.toLowerCase().includes('savings');
          const isBillsCat = d.categoryId === 'cat_bills' || d.categoryName?.toLowerCase().includes('bills');
          if (!isSavCat && !isBillsCat) {
            const dDiff = Number(d.difference) !== undefined ? Number(d.difference) : (Number(d.budget) || 0) - (Number(d.spent) || 0);
            if (dDiff > 0) weekPot += dDiff;
            else if (dDiff < 0) weekDef += Math.abs(dDiff);
          }
        });

        const weekPotUsed = Math.min(weekPot, weekDef);
        const covShare = weekPot > 0 && weekPotUsed > 0 ? diffInWeek * (weekPotUsed / weekPot) : 0;
        const savShare = Math.max(0, diffInWeek - covShare);

        totalCoverageFromCheckIns += covShare;
        totalSavingsFromCheckIns += savShare;
      }
    });

    if (!foundAnyDecision) return null;

    return {
      spent: totalSpentFromCheckIns,
      coverage: totalCoverageFromCheckIns,
      savings: totalSavingsFromCheckIns,
      budget: totalBudgetFromCheckIns,
    };
  }, [isSavings, isBills, completedCheckInsInTimeframe, category.id, category.name]);

  const effectiveCategorySpent = checkInTotals ? checkInTotals.spent : effectiveSpent;
  const effectiveOverspendCoverage = isBills || isMonthView ? 0 : (checkInTotals ? checkInTotals.coverage : categoryOverspendCoverage);
  const effectiveSentToSavings = isBills ? 0 : (checkInTotals ? checkInTotals.savings : categoryLeftoverSurplus);
  const effectiveRemaining = checkInTotals
    ? Math.max(0, budgetForTimeframe - effectiveCategorySpent)
    : remaining;

  const shouldShowSurplusSplit = !isSavings && !isBills && (
    checkInTotals !== null
      ? (effectiveSentToSavings > 0 || (!isMonthView && checkInTotals.coverage > 0))
      : (hasThisWeekCheckIn && categoryDecision !== null && ((!isMonthView && categoryOverspendCoverage > 0) || categoryLeftoverSurplus > 0))
  );

  const displayPercentage = budgetForTimeframe > 0
    ? Math.round((effectiveCategorySpent / budgetForTimeframe) * 100)
    : 0;

  // Month View vs Week View savings aggregation
  const monthCompletedCheckIns = completedCheckInsInTimeframe;

  const { monthSavingsBanked, monthSavingsCovered } = useMemo(() => {
    if (!isMonthView) return { monthSavingsBanked: 0, monthSavingsCovered: 0 };
    let banked = 0;
    let covered = 0;

    monthCompletedCheckIns.forEach((c) => {
      const weekBanked = typeof c.totalSaved === 'number' ? Number(c.totalSaved) : 0;
      banked += weekBanked;

      const savDecision = (c.decisions || []).find(
        (d) => d.categoryId === category.id || d.categoryName?.toLowerCase().includes('savings')
      );
      
      let weekCovered = 0;
      if (savDecision && savDecision.savingsDeduction !== undefined && savDecision.savingsDeduction > 0) {
        weekCovered = Number(savDecision.savingsDeduction);
      } else if (savDecision && savDecision.budget !== undefined && savDecision.spent !== undefined) {
        weekCovered = Math.max(0, Number(savDecision.budget) - Number(savDecision.spent));
      } else {
        const baseline = Number(category.baselineBudget) || 650;
        weekCovered = Math.max(0, baseline - weekBanked);
      }
      covered += weekCovered;
    });

    return { monthSavingsBanked: banked, monthSavingsCovered: covered };
  }, [isMonthView, monthCompletedCheckIns, category.id, category.baselineBudget]);

  // savingsDeducted is strictly the savings amount used for overspend coverage (capped by available baseline budget)
  const savingsDeducted = useMemo(() => {
    if (!isSavings) return 0;
    if (thisWeekCheckIn) {
      const savDecision = (thisWeekCheckIn.decisions || []).find(
        (d) => d.categoryId === category.id || d.categoryName?.toLowerCase().includes('savings')
      );
      if (savDecision && savDecision.savingsDeduction !== undefined && Number(savDecision.savingsDeduction) > 0) {
        return Number(savDecision.savingsDeduction) || 0;
      }
      if (savDecision && savDecision.budget !== undefined && savDecision.spent !== undefined) {
        return Math.max(0, Number(savDecision.budget) - Number(savDecision.spent));
      }
      if (typeof thisWeekCheckIn.totalSaved === 'number' && baselineSavingsTargetAvailable > thisWeekCheckIn.totalSaved) {
        return Math.max(0, baselineSavingsTargetAvailable - thisWeekCheckIn.totalSaved);
      }
    }
    return Math.min(baselineSavingsTargetAvailable, netDeficit);
  }, [isSavings, thisWeekCheckIn, category.id, baselineSavingsTargetAvailable, netDeficit]);

  // Protected savings (baseline budget that survived check-in/pacing)
  const protectedSavings = useMemo(() => {
    if (!isSavings) return 0;
    return Math.max(0, baselineSavingsTargetAvailable - savingsDeducted);
  }, [isSavings, baselineSavingsTargetAvailable, savingsDeducted]);

  const { monthDepositCount, monthDepositTotal } = useMemo(() => {
    if (!isMonthView || !isSavings) return { monthDepositCount: 0, monthDepositTotal: 0 };
    let count = 0;
    let total = 0;
    const firstDay = household?.firstDayOfWeek || 'Monday';
    let curr = new Date(dateRange.startDate);
    const seenWeeks = new Set<string>();

    while (curr <= dateRange.endDate) {
      const wRange = getWeekRange(curr, firstDay, 0);
      const wStartStr = formatLocalDate(wRange.startDate);

      if (!seenWeeks.has(wStartStr) && wRange.startDate <= dateRange.endDate && wRange.endDate >= dateRange.startDate) {
        seenWeeks.add(wStartStr);

        // 1. Direct one-off deposits in this week
        const weekDeposits = (household?.oneOffDeposits || []).filter((dep) => {
          const depDate = new Date(dep.date + (dep.date.length === 10 ? 'T12:00:00' : ''));
          return depDate >= wRange.startDate && depDate <= wRange.endDate;
        });

        const weekDepTotal = weekDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

        // 2. Weekly override expanding savings above baseline
        const weekOverride = household?.weeklyOverrides?.[wStartStr];
        const savOverrideVal = weekOverride
          ? Number(weekOverride.savings ?? (category.id ? weekOverride[category.id] : 0))
          : 0;
        const overrideExpansion = savOverrideVal > baselineBudget ? savOverrideVal - baselineBudget : 0;

        // 3. Completed check-in decision with expanded savings budget
        const checkIn = (checkIns || []).find(
          (c) => c.status === 'completed' && (c.weekStartDate === wStartStr || c.id.includes(wStartStr))
        );
        const savDec = checkIn?.decisions?.find(
          (d) => d.categoryId === category.id || d.categoryName?.toLowerCase().includes('savings')
        );
        const checkInExpansion = savDec && savDec.budget !== undefined && Number(savDec.budget) > baselineBudget
          ? Number(savDec.budget) - baselineBudget
          : 0;

        const effectiveWeekExpansion = Math.max(weekDepTotal, overrideExpansion, checkInExpansion);

        if (weekDeposits.length > 0 || effectiveWeekExpansion > 0) {
          count += Math.max(weekDeposits.length, 1);
          total += effectiveWeekExpansion > 0 ? effectiveWeekExpansion : weekDepTotal;
        }
      }

      curr = new Date(curr.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const directDeposits = (household?.oneOffDeposits || []).filter((dep) => {
      const depDate = new Date(dep.date + (dep.date.length === 10 ? 'T12:00:00' : ''));
      return depDate >= dateRange.startDate && depDate <= dateRange.endDate;
    });
    const directTotal = directDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    return {
      monthDepositCount: Math.max(count, directDeposits.length),
      monthDepositTotal: Math.max(total, directTotal),
    };
  }, [
    isMonthView,
    isSavings,
    household?.firstDayOfWeek,
    household?.oneOffDeposits,
    household?.weeklyOverrides,
    dateRange,
    baselineBudget,
    category.id,
    checkIns,
  ]);

  // True banked amount (Baseline Budget: e.g. $335 weekly savings budget)
  const targetBudget = useMemo(() => {
    if (!isSavings) return budgetForTimeframe;
    if (isMonthView) {
      return (baselineBudget * weeksInMonth) + monthDepositTotal;
    }
    return baselineBudget + depositAmount;
  }, [
    isSavings,
    isMonthView,
    baselineBudget,
    weeksInMonth,
    monthDepositTotal,
    depositAmount,
    budgetForTimeframe,
  ]);

  const amountActuallyBanked = useMemo(() => {
    if (!isSavings) return 0;
    if (thisWeekCheckIn) {
      const savDecision = (thisWeekCheckIn.decisions || []).find(
        (d) => d.categoryId === category.id || d.categoryName?.toLowerCase().includes('savings')
      );
      if (savDecision) {
        const b = Number(savDecision.budget) || targetBudget || 0;
        const d = Number(savDecision.savingsDeduction) || savingsDeducted || 0;
        if (d > 0) {
          return Math.max(0, b - d);
        }
        if (typeof savDecision.spent === 'number') return savDecision.spent;
        return Math.max(0, b - d);
      }
      if (savingsDeducted > 0) {
        return Math.max(0, targetBudget - savingsDeducted);
      }
      if (typeof thisWeekCheckIn.totalSaved === 'number') {
        return Math.max(0, thisWeekCheckIn.totalSaved - savingsDeducted);
      }
    }
    return Math.max(0, protectedSavings + totalSavingsSurplusTransferred);
  }, [isSavings, thisWeekCheckIn, category.id, targetBudget, savingsDeducted, protectedSavings, totalSavingsSurplusTransferred]);

  const displayCoverage = isMonthView ? 0 : savingsDeducted;
  const displayBanked = isMonthView
    ? monthSavingsBanked
    : (hasThisWeekCheckIn || totalSavingsSurplusTransferred > 0 ? amountActuallyBanked : (isSavingsAllocated ? protectedSavings : 0));
  const displayDeposit = depositAmount;
  const depositCount = isSavings ? (isMonthView ? monthDepositCount : Math.max(depositsThisWeek.length, depositAmount > 0 ? 1 : 0)) : count;

  // Total pool for segmented savings bar
  const totalPool = useMemo(() => {
    if (!isSavings) return 0;
    if (isMonthView) {
      return Math.max(targetBudget, displayBanked, 1);
    }
    return Math.max(targetBudget, displayCoverage + displayBanked, 1);
  }, [isSavings, isMonthView, targetBudget, displayCoverage, displayBanked]);

  // Determine icon background style based on bucket color/group
  let iconBg = 'bg-sage-100 text-dark-green-900 border-sage-300';
  if (category.group === 'Fun Money' || category.color === 'sky-blue') {
    iconBg = 'bg-sky-blue-100 text-sky-blue-900 border-sky-blue-300';
  } else if (category.group === 'Bills' || category.color === 'brown' || isBills) {
    iconBg = 'bg-beige-100 text-brown-800 border-beige-300';
  } else if (isSavings) {
    iconBg = 'bg-dark-green-100 text-dark-green-900 border-dark-green-300';
  }

  return (
    <div
      id={`cat-card-${category.id}`}
      onClick={() => navigateToCategoryLedger(category.id)}
      className={`bg-white border-2 hover:border-dark-green-700/60 hover:ring-1 hover:ring-dark-green-700/20 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-2 group cursor-pointer ${
        isOverBudget
          ? 'border-alert-red-300 bg-alert-red-50/20'
          : 'border-sage-300'
      }`}
    >
      {/* Top Header (Div 2): Icon, Name, Category Type Badge, Quick Log & Chevron */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${iconBg}`}>
            <CategoryIcon name={category.name} group={category.group} icon={category.icon} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-dark-green-900 text-base sm:text-lg truncate group-hover:text-dark-green-700 transition-colors flex items-center gap-1.5">
              {category.name}
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-dark-green-600 transition-opacity" />
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span
                className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                  isSavings
                    ? 'bg-sage-100 text-dark-green-900 border-sage-300'
                    : 'bg-beige-100 text-brown-800 border-beige-300'
                }`}
              >
                {isSavings ? 'Savings' : 'Expense'}
              </span>
              {!isSavings && (
                isProratedWeek && overrideAmount !== undefined && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sky-blue-100 text-sky-blue-900 border border-sky-blue-300">
                    Prorated {overrideAmount > baselineBudget ? '+' : ''}
                    {formatCurrency(overrideAmount - baselineBudget)}
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Expense cards retain the + CTA, Savings card removes it */}
          {!isSavings && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickLog(category);
              }}
              id={`quick-log-${category.id}`}
              title={`Log expense for ${category.name}`}
              className="p-2 sm:p-2.5 rounded-xl bg-beige-100 hover:bg-dark-green-800 hover:text-white text-dark-green-900 transition-colors cursor-pointer border border-beige-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* Chevron Toggle Button to collapse/expand metrics row */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpand();
            }}
            id={`toggle-metrics-${category.id}`}
            title={isExpanded ? 'Collapse budget metrics' : 'Expand budget metrics'}
            aria-label={isExpanded ? 'Collapse budget metrics' : 'Expand budget metrics'}
            className="p-2 sm:p-2.5 rounded-xl bg-beige-100 hover:bg-beige-200 text-dark-green-900 transition cursor-pointer border border-beige-300 flex items-center justify-center"
          >
            <ChevronDown
              className={`w-4 h-4 text-dark-green-800 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Metrics Row (Div 1) & Progress Bar (Div 2) Container */}
      <div className="space-y-2">
        {/* Div 1: Metrics Row with faint line breaks - Collapsed by default */}
        {isExpanded && (
          <div className="border-y border-beige-200/80 py-2 sm:py-2.5 my-0.5 animate-fadeIn">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
                  {isSavings ? 'Savings Target' : 'Logged / Budget'}
                </span>
                <div className="text-base sm:text-xl font-black font-mono text-dark-green-900 tracking-tight flex items-baseline gap-1 flex-wrap">
                  {isSavings ? (
                    isMonthView ? (
                      <>
                        <span>{formatCurrency(displayBanked)}</span>
                        <span className="text-xs font-normal text-brown-700 ml-1">
                          / {formatCurrency(targetBudget)}
                        </span>
                      </>
                    ) : (displayBanked > 0 || hasThisWeekCheckIn) ? (
                      <>
                        <span>{formatCurrency(displayBanked)}</span>
                        <span className="text-xs font-normal text-brown-700 ml-1">
                          / {formatCurrency(targetBudget)}
                        </span>
                      </>
                    ) : !isSavingsAllocated ? (
                      <>
                        <span>$0</span>
                        <span className="text-xs font-normal text-brown-700 ml-1">
                          / {formatCurrency(targetBudget)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>{formatCurrency(targetBudget)}</span>
                        <span className="text-xs font-normal text-brown-700 ml-1">
                          allocated
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      <span>{formatCurrency(effectiveCategorySpent)}</span>
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
                    </>
                  )}
                </div>
              </div>

              {/* Right Status Indicator */}
              <div className="text-right space-y-0.5 flex-shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
                  Status
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  {isSavings ? (
                    <div className="flex flex-col items-end gap-0.5">
                      {isMonthView ? (
                        (depositCount > 0 && monthDepositTotal > 0) && (
                          <div className="flex items-center justify-end gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-sage-100 text-dark-green-900 border border-sage-300 tracking-tight">
                            <span>{formatCurrency(monthDepositTotal)} for {depositCount} {depositCount === 1 ? 'deposit' : 'deposits'}</span>
                          </div>
                        )
                      ) : (
                        depositAmount > 0 && (
                          <div className="flex items-center justify-end gap-1 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-sage-100 text-dark-green-900 border border-sage-300 tracking-tight">
                            <span>One-Time Deposit +{formatCurrency(depositAmount)}</span>
                          </div>
                        )
                      )}
                      {!isMonthView && ((displayCoverage > 0) || (hasThisWeekCheckIn && savingsDeducted > 0)) && (
                        <div className="flex items-center justify-end gap-1 text-dark-grey-600 text-[11px] font-bold tracking-tight">
                          <svg
                            className="w-3.5 h-3.5 shrink-0"
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
                          <span>
                            {formatCurrency(savingsDeducted || displayCoverage)} used in coverage
                          </span>
                        </div>
                      )}
                      {isMonthView ? (
                        <div className="flex items-center justify-end gap-1.5 text-sage-800 font-bold text-[11px]">
                          {displayBanked > 0 ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-sage-600 flex-shrink-0" />
                              <span>{formatCurrency(displayBanked)} Banked</span>
                            </>
                          ) : (
                            <span className="text-dark-grey-600 font-bold text-[11px]">$0 Banked</span>
                          )}
                        </div>
                      ) : hasThisWeekCheckIn ? (
                        displayBanked > 0 ? (
                          <div className="flex items-center justify-end gap-1.5 text-sage-800 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-sage-600 flex-shrink-0" />
                            <span>{formatCurrency(displayBanked)} Banked</span>
                          </div>
                        ) : null
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 text-sage-800 font-bold text-[11px]">
                          {!isSavingsAllocated ? (
                            <span className="text-dark-grey-600 font-bold text-[11px]">Unallocated (Pending)</span>
                          ) : (
                            <>
                              <svg
                                className="w-3.5 h-3.5 text-sage-600 shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="2" y="5" width="20" height="14" rx="7" />
                                <circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none" />
                                <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
                                <circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none" />
                              </svg>
                              <span>{formatCurrency(targetBudget)} Allocated</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : isOverBudget ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center justify-end gap-1 text-alert-red-700 font-bold text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 text-alert-red-600 flex-shrink-0" />
                        <span>Exceeded by {formatCurrency(Math.abs(remaining))}</span>
                      </div>
                      {!isMonthView && hasThisWeekCheckIn && (
                        <>
                          {categoryTransfersCovered > 0 && (
                            <div className="flex items-center justify-end gap-1 text-dark-grey-600 text-[11px] font-bold tracking-tight">
                              <svg
                                className="w-3.5 h-3.5 shrink-0"
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
                              <span>
                                {formatCurrency(categoryTransfersCovered)} covered from transfers
                              </span>
                            </div>
                          )}
                          {categorySavingsCovered > 0 && (
                            <div className="flex items-center justify-end gap-1 text-dark-grey-600 text-[11px] font-bold tracking-tight">
                              <svg
                                className="w-3.5 h-3.5 shrink-0"
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
                              <span>
                                {formatCurrency(categorySavingsCovered)} covered from savings
                              </span>
                            </div>
                          )}
                          {categoryProratedCovered > 0 && (
                            <div className="flex items-center justify-end gap-1 text-sky-blue-800 text-[11px] font-bold tracking-tight">
                              <svg
                                className="w-3.5 h-3.5 shrink-0"
                                viewBox="0 0 24 24"
                                fill="#E0F2FE"
                                stroke="#0284C7"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <rect x="2" y="2" width="20" height="20" rx="5" fill="#E0F2FE" stroke="#0284C7" />
                                <path d="M8 12h8" stroke="#0284C7" />
                                <path d="m13 9 3 3-3 3" stroke="#0284C7" />
                              </svg>
                              <span>
                                {formatCurrency(categoryProratedCovered)} prorated, budget lowered
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center justify-end gap-1 text-sage-800 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sage-600 flex-shrink-0" />
                        <span>
                          {hasThisWeekCheckIn || checkInTotals
                            ? `${formatCurrency(effectiveRemaining)} unspent`
                            : `On track (${formatCurrency(remaining)} unspent)`}
                        </span>
                      </div>
                      {!isBills && effectiveSentToSavings > 0 && (
                        <div className="flex items-center justify-end gap-1 text-dark-green-800 text-[11px] font-bold tracking-tight">
                          <span>
                            {formatCurrency(effectiveSentToSavings)} sent to savings
                          </span>
                        </div>
                      )}
                      {!isBills && !isMonthView && effectiveOverspendCoverage > 0 && (
                        <div className="flex items-center justify-end gap-1 text-dark-grey-600 text-[11px] font-bold tracking-tight">
                          <svg
                            className="w-3.5 h-3.5 shrink-0"
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
                          <span>
                            {formatCurrency(effectiveOverspendCoverage)} used in coverage
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Div 2: Progress Bar & Allocation Metrics - Always visible */}
        <div className="space-y-1.5 pt-0.5">
          {/* Additional notes under the savings account - displayed above progress bar only after week's check-in is complete */}
          {isSavings && hasThisWeekCheckIn && savingsContributions.length > 0 && (
            <div className="space-y-1.5 pb-0.5" id="savings-account-notes">
              {savingsContributions.map((contrib, idx) => (
                <div
                  key={`savings-note-${contrib.categoryId || idx}`}
                  id={`savings-note-${contrib.categoryId || idx}`}
                  className="flex items-center justify-between text-xs bg-sage-50/90 border border-sage-200/90 rounded-xl px-2.5 py-1.5 text-dark-green-900"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-sage-600 shrink-0" />
                    <span className="font-semibold truncate">
                      {formatCurrency(contrib.amount)} sent to savings
                    </span>
                    {contrib.categoryName && (
                      <span className="text-[10px] text-brown-700 truncate font-normal">
                        ({contrib.categoryName})
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono font-bold text-dark-green-800 shrink-0">
                    +{formatCurrency(contrib.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

            {isSavings ? (
              isMonthView ? (
                /* Month View: Bar showing Banked from Check-Ins (no coverage on month view) */
                displayBanked > 0 ? (
                  <div
                    className="w-full h-5 sm:h-5.5 rounded-full border border-beige-300/90 bg-beige-100/60 p-0.5 flex items-center relative shadow-2xs overflow-hidden"
                    title={`Monthly Target: ${formatCurrency(targetBudget)} | Banked from Check-ins: ${formatCurrency(displayBanked)}`}
                  >
                    {/* Banked Savings Pill from Completed Check-ins */}
                    <div
                      style={{ width: `${Math.min(100, (displayBanked / totalPool) * 100)}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setProtectedMode((prev) => cycleMode(prev));
                      }}
                      className="h-full bg-dark-green-900 text-sage-200 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 cursor-pointer hover:brightness-110 active:scale-95 select-none"
                      title={`Banked from check-ins: ${formatCurrency(displayBanked)} (${Math.round((displayBanked / totalPool) * 100)}%) - Click to toggle display`}
                    >
                      <span className="truncate text-sage-200 drop-shadow-xs">
                        {protectedMode === 'desc'
                          ? 'Banked'
                          : protectedMode === 'amount'
                          ? formatCurrency(displayBanked)
                          : `${Math.round((displayBanked / totalPool) * 100)}%`}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Month View with 0 check-ins completed yet: Empty progress bar */
                  <div
                    className="w-full h-5 sm:h-5.5 rounded-full border border-beige-300/90 bg-beige-100/60 p-0.5 relative shadow-2xs"
                    title={`Monthly Target: ${formatCurrency(targetBudget)} | $0 banked (Awaiting weekly check-ins)`}
                  >
                    <div className="w-0 h-full rounded-full bg-sage-500/20 transition-all duration-300" />
                  </div>
                )
              ) : !isSavingsAllocated ? (
                /* Week View - Inactive Week / Pending Prior Week Check-In: Empty Progress Bar */
                <div
                  className="w-full h-5 sm:h-5.5 rounded-full border border-beige-300/90 bg-beige-100/60 p-0.5 relative shadow-2xs"
                  title={`Target: ${formatCurrency(targetBudget)} | $0 allocated (Awaiting prior week check-in)`}
                >
                  <div
                    className="w-0 h-full rounded-full bg-sage-500/20 transition-all duration-300"
                  />
                </div>
              ) : hasThisWeekCheckIn ? (
                /* Week View - Post-Check-In Segmented flex container for Savings */
                <div
                  className="w-full h-5 sm:h-5.5 rounded-full border border-beige-300/90 bg-beige-100/60 p-0.5 flex items-center gap-1.5 sm:gap-2 relative shadow-2xs"
                  title={`Target: ${formatCurrency(targetBudget)} | Banked: ${formatCurrency(amountActuallyBanked)} | Covered Overspend: ${formatCurrency(savingsDeducted)}`}
                >
                  {/* Segment 1 (Overspend Coverage Pill) */}
                  {savingsDeducted > 0 && (
                    <div
                      style={{ width: amountActuallyBanked === 0 ? '100%' : `${(savingsDeducted / (savingsDeducted + amountActuallyBanked)) * 100}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverageMode((prev) => cycleMode(prev));
                      }}
                      className="h-full bg-brown-700 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 flex-shrink-0 cursor-pointer hover:brightness-110 active:scale-95 select-none"
                      title={`Overspend coverage: ${formatCurrency(savingsDeducted)} (${amountActuallyBanked === 0 ? 100 : Math.round((savingsDeducted / (savingsDeducted + amountActuallyBanked)) * 100)}%) - Click to toggle display`}
                    >
                      <span className="truncate text-[#F5F5DC] drop-shadow-xs">
                        {coverageMode === 'desc'
                          ? 'Coverage'
                          : coverageMode === 'amount'
                          ? formatCurrency(savingsDeducted)
                          : `${amountActuallyBanked === 0 ? 100 : Math.round((savingsDeducted / (savingsDeducted + amountActuallyBanked)) * 100)}%`}
                      </span>
                    </div>
                  )}

                  {/* Segment 2 (Banked / Allocated Savings Pill) */}
                  {amountActuallyBanked > 0 && (
                    <div
                      style={{ width: `${(amountActuallyBanked / (savingsDeducted + amountActuallyBanked)) * 100}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setProtectedMode((prev) => cycleMode(prev));
                      }}
                      className="h-full bg-dark-green-900 text-sage-200 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 cursor-pointer hover:brightness-110 active:scale-95 select-none"
                      title={`${hasThisWeekCheckIn ? 'Banked savings' : 'Allocated savings'}: ${formatCurrency(amountActuallyBanked)} (${Math.round((amountActuallyBanked / (savingsDeducted + amountActuallyBanked)) * 100)}%) - Click to toggle display`}
                    >
                      <span className="truncate text-sage-200 drop-shadow-xs">
                        {protectedMode === 'desc'
                          ? '$'
                          : protectedMode === 'amount'
                          ? formatCurrency(amountActuallyBanked)
                          : `${Math.round((amountActuallyBanked / (savingsDeducted + amountActuallyBanked)) * 100)}%`}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Week View - Pre-Check-In 100% Allocated Hashed Progress Bar */
                <div
                  className="w-full h-5 sm:h-5.5 rounded-full border border-beige-300/90 bg-beige-100/60 p-0.5 relative shadow-2xs"
                  title={`Target: ${formatCurrency(targetBudget)} | Allocated: ${formatCurrency(targetBudget)} (100% allocated)`}
                >
                  <div
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, #6B9F6D, #6B9F6D 6px, #EDE4DC 6px, #EDE4DC 12px)',
                    }}
                    className="w-full h-full rounded-full border border-sage-500/80 transition-all duration-300"
                  />
                </div>
              )
            ) : (
              <BudgetProgressBar
                categoryType={categoryType}
                spent={effectiveCategorySpent}
                budget={budgetForTimeframe}
                heightClass="h-5 sm:h-5.5"
                showSurplusSplit={shouldShowSurplusSplit}
                surplusChoice={
                  categoryDecision?.choice === 'rollover'
                    ? 'rollover'
                    : 'savings'
                }
                overspendCoverageAmount={effectiveOverspendCoverage}
                leftoverSurplusAmount={effectiveSentToSavings}
                savingsLabel="Sent to savings"
              />
            )}

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-dark-grey-600 font-medium">
                {isSavings
                  ? isMonthView
                    ? `${Math.round((displayBanked / (targetBudget || 1)) * 100)}% of monthly target banked`
                    : (hasThisWeekCheckIn || displayBanked > 0)
                    ? `${Math.round((displayBanked / (targetBudget || 1)) * 100)}% of target banked`
                    : !isSavingsAllocated
                    ? '0% of target allocated'
                    : `${Math.round((targetBudget / (targetBudget || 1)) * 100)}% of target allocated`
                  : `${displayPercentage}% of ${timeframeMode === 'week' ? 'weekly' : 'monthly'} allocation`}
              </span>
              <span className="text-brown-800 font-medium">
                {isSavings
                  ? `${depositCount} ${depositCount === 1 ? 'deposit' : 'deposits'}`
                  : `${count} ${count === 1 ? 'entry' : 'entries'}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
};

function areCategoryCardPropsEqual(prev: CategoryCardProps, next: CategoryCardProps): boolean {
  if (prev.category !== next.category) {
    if (
      prev.category.id !== next.category.id ||
      prev.category.baselineBudget !== next.category.baselineBudget ||
      prev.category.currentWeeklyBudget !== next.category.currentWeeklyBudget ||
      prev.category.name !== next.category.name ||
      prev.category.group !== next.category.group ||
      prev.category.type !== next.category.type
    ) {
      return false;
    }
  }
  if (prev.timeframeMode !== next.timeframeMode) return false;
  if (prev.dateRange.startDate.getTime() !== next.dateRange.startDate.getTime()) return false;
  if (prev.dateRange.endDate.getTime() !== next.dateRange.endDate.getTime()) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.onQuickLog !== next.onQuickLog) return false;
  if (prev.onToggleExpand !== next.onToggleExpand) return false;
  if (prev.navigateToCategoryLedger !== next.navigateToCategoryLedger) return false;
  if (prev.household !== next.household) return false;
  if (prev.checkIns !== next.checkIns) return false;
  if (prev.expenses !== next.expenses) return false;
  if (prev.categorySpending !== next.categorySpending) {
    if (
      prev.categorySpending?.totalSpent !== next.categorySpending?.totalSpent ||
      prev.categorySpending?.count !== next.categorySpending?.count
    ) {
      return false;
    }
  }
  if (prev.waterfallMetrics !== next.waterfallMetrics) {
    if (
      prev.waterfallMetrics.totalTransferPot !== next.waterfallMetrics.totalTransferPot ||
      prev.waterfallMetrics.totalDeficit !== next.waterfallMetrics.totalDeficit ||
      prev.waterfallMetrics.netDeficit !== next.waterfallMetrics.netDeficit ||
      prev.waterfallMetrics.potUsedForCoverage !== next.waterfallMetrics.potUsedForCoverage ||
      prev.waterfallMetrics.baselineSavingsTargetAvailable !== next.waterfallMetrics.baselineSavingsTargetAvailable
    ) {
      return false;
    }
  }
  return true;
}

export const CategoryCard = React.memo(CategoryCardComponent, areCategoryCardPropsEqual);
