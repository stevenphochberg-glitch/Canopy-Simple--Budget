import React, { useState, useMemo, useEffect } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { formatCurrency, getMonthRange, calculateCategorySpending, getWeekRange, formatLocalDate } from '../../lib/calculations';
import { getFiscalMonthForDate } from '../../lib/fiscal445';
import { areAllWeeklyCheckInsCompletedForMonth, getUnreviewedCompletedMonth } from '../../lib/checkInCalculations';
import {
  Calendar,
  Sparkles,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Check,
  X,
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
  Award,
  ArrowRight,
  ArrowLeft,
  Target,
  ShieldCheck,
} from 'lucide-react';

interface MonthlyRetrospectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MonthlyRetrospectiveModal: React.FC<MonthlyRetrospectiveModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    household,
    categories,
    expenses,
    members,
    user,
    checkIns,
    savingsGoals,
    allocateSavingsToGoals,
    executeMonthEndResetAction,
    monthlyRetroTargetMonth,
    showToast,
  } = useHousehold();

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [intentionsText, setIntentionsText] = useState<string>('');
  const [isExecutingReset, setIsExecutingReset] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isSwept, setIsSwept] = useState<boolean>(false);
  const [isBillsSurplusTransferred, setIsBillsSurplusTransferred] = useState<boolean>(false);
  const [isBillsDeficitDeducted, setIsBillsDeficitDeducted] = useState<boolean>(false);

  // Allocations to savings goals: map of goalId -> dollar amount
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  // Target fiscal month: dynamically resolves from context or unreviewed completed month
  const targetFiscalMonth = useMemo(() => {
    if (monthlyRetroTargetMonth) {
      return monthlyRetroTargetMonth;
    }
    const unreviewed = getUnreviewedCompletedMonth(household, checkIns, expenses);
    if (unreviewed) return unreviewed;
    return getFiscalMonthForDate(new Date(), household?.fiscalYearEndMonth || 12);
  }, [monthlyRetroTargetMonth, household, checkIns, expenses]);

  // Month range
  const monthRange = useMemo(() => {
    const startMonth = targetFiscalMonth.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endMonth = targetFiscalMonth.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return {
      startDate: targetFiscalMonth.startDate,
      endDate: targetFiscalMonth.endDate,
      label: `${targetFiscalMonth.monthName} ${targetFiscalMonth.fiscalYear || targetFiscalMonth.startDate.getFullYear()} (${startMonth} – ${endMonth})`,
    };
  }, [targetFiscalMonth]);

  // Check whether all weekly check-ins of this fiscal month are complete
  const isFinalWeeklyCheckInComplete = useMemo(() => {
    return areAllWeeklyCheckInsCompletedForMonth(targetFiscalMonth, checkIns);
  }, [targetFiscalMonth, checkIns]);

  // Compute month metrics and isolate Bills evaluation
  const monthStats = useMemo(() => {
    let totalMonthlyBudget = 0;
    let totalSpent = 0;

    const isBills = (c: { group?: string; name: string; id?: string }) =>
      c.group?.toLowerCase() === 'bills' || c.name.toLowerCase() === 'bills' || c.id === 'cat_bills';

    const isSavings = (c: { type?: string; group?: string; name: string; id?: string }) =>
      c.id === 'cat_savings' || c.type === 'savings' || c.group?.toLowerCase() === 'savings' || c.name.toLowerCase().includes('saving');

    const fiscalMonth = getFiscalMonthForDate(monthRange.startDate, household?.fiscalYearEndMonth || 12);
    const weeksInMonth = fiscalMonth.weekCount || 4;

    const mStart = monthRange.startDate.getTime();
    const mEnd = monthRange.endDate.getTime();

    const monthCompletedCheckIns = (checkIns || []).filter((c) => {
      if (c.status !== 'completed') return false;
      const cStart = new Date(c.weekStartDate + (c.weekStartDate?.length === 10 ? 'T12:00:00' : '')).getTime();
      const cEnd = new Date(c.weekEndDate + (c.weekEndDate?.length === 10 ? 'T12:00:00' : '')).getTime();
      return (cEnd >= mStart && cStart <= mEnd) || (cStart >= mStart - 86400000 && cEnd <= mEnd + 86400000);
    });

    let totalSavingsBankedFromCheckIns = 0;
    monthCompletedCheckIns.forEach((c) => {
      const savDec = (c.decisions || []).find(
        (d) => d.categoryId === 'cat_savings' || d.categoryName?.toLowerCase().includes('saving')
      );
      let weekCovered = 0;
      if (savDec && savDec.savingsDeduction !== undefined && savDec.savingsDeduction > 0) {
        weekCovered = Number(savDec.savingsDeduction);
      } else if (savDec && savDec.budget !== undefined && savDec.spent !== undefined) {
        weekCovered = Math.max(0, Number(savDec.budget) - Number(savDec.spent));
      }

      if (savDec) {
        const b = Number(savDec.budget) || 0;
        if (weekCovered > 0) {
          totalSavingsBankedFromCheckIns += Math.max(0, b - weekCovered);
        } else if (typeof savDec.spent === 'number') {
          totalSavingsBankedFromCheckIns += savDec.spent;
        } else if (typeof c.totalSaved === 'number') {
          totalSavingsBankedFromCheckIns += Math.max(0, c.totalSaved - weekCovered);
        }
      } else if (typeof c.totalSaved === 'number') {
        totalSavingsBankedFromCheckIns += Math.max(0, c.totalSaved - weekCovered);
      }
    });

    // Weekly check-ins already bake one-off deposits into the banked amount (c.totalSaved),
    // so totalSavingsBanked strictly reflects the total weekly check-in banked amount for the month.
    const totalSavingsBanked = totalSavingsBankedFromCheckIns;

    // Ensure all standard categories (Essentials, Fun Money, Bills, Savings) exist in the review
    const allCats = [...categories];
    if (!allCats.some((c) => c.id === 'cat_fun_money' || c.name?.toLowerCase().includes('fun'))) {
      allCats.push({
        id: 'cat_fun_money',
        name: 'Fun Money',
        group: 'Fun Money',
        type: 'expense',
        baselineBudget: 335,
      } as any);
    }
    if (!allCats.some((c) => c.id === 'cat_essentials' || c.name?.toLowerCase().includes('essential'))) {
      allCats.push({
        id: 'cat_essentials',
        name: 'Essentials',
        group: 'Essentials',
        type: 'expense',
        baselineBudget: 500,
      } as any);
    }

    // Calculate total one-off deposits expanding the monthly budget for the active fiscal month (matching Monthly Dashboard)
    const firstDay = household?.firstDayOfWeek || 'Monday';
    let curr = new Date(monthRange.startDate);
    const seenWeeks = new Set<string>();
    let depositCount = 0;
    let depositTotal = 0;

    const savCatItem = allCats.find(isSavings);
    const savBase = savCatItem ? Number(savCatItem.baselineBudget) || 0 : 0;

    while (curr <= monthRange.endDate) {
      const wRange = getWeekRange(curr, firstDay, 0);
      const wStartStr = formatLocalDate(wRange.startDate);

      if (!seenWeeks.has(wStartStr) && wRange.startDate <= monthRange.endDate && wRange.endDate >= monthRange.startDate) {
        seenWeeks.add(wStartStr);

        const weekDeposits = (household?.oneOffDeposits || []).filter((dep) => {
          const depDate = new Date(dep.date + (dep.date.length === 10 ? 'T12:00:00' : ''));
          return depDate >= wRange.startDate && depDate <= wRange.endDate;
        });
        const weekDepTotal = weekDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

        const weekOverride = household?.weeklyOverrides?.[wStartStr];
        const savOverrideVal = weekOverride
          ? Number(weekOverride.savings ?? (savCatItem?.id ? weekOverride[savCatItem.id] : 0))
          : 0;
        const overrideExpansion = savOverrideVal > savBase ? savOverrideVal - savBase : 0;

        const checkIn = (checkIns || []).find(
          (c) => c.status === 'completed' && (c.weekStartDate === wStartStr || c.id.includes(wStartStr))
        );
        const savDec = checkIn?.decisions?.find(
          (d) => d.categoryId === savCatItem?.id || d.categoryName?.toLowerCase().includes('savings')
        );
        const checkInExpansion = savDec && savDec.budget !== undefined && Number(savDec.budget) > savBase
          ? Number(savDec.budget) - savBase
          : 0;

        const effectiveWeekExpansion = Math.max(weekDepTotal, overrideExpansion, checkInExpansion);

        if (weekDeposits.length > 0 || effectiveWeekExpansion > 0) {
          depositCount += Math.max(weekDeposits.length, 1);
          depositTotal += effectiveWeekExpansion > 0 ? effectiveWeekExpansion : weekDepTotal;
        }
      }

      curr = new Date(curr.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const directDeposits = (household?.oneOffDeposits || []).filter((dep) => {
      const depDate = new Date(dep.date + (dep.date.length === 10 ? 'T12:00:00' : ''));
      return depDate >= monthRange.startDate && depDate <= monthRange.endDate;
    });
    const directTotal = directDeposits.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const monthDepositTotal = Math.max(depositTotal, directTotal);

    const categoryDetails = allCats.map((cat) => {
      const isSavCat = isSavings(cat);
      const isBillsCat = isBills(cat);
      const baselineMonthly = isBillsCat
        ? (cat.monthlyBudget || 3535)
        : Math.round((Number(cat.baselineBudget) || 0) * weeksInMonth);
      // For savings category, monthly budget includes deposit expansion (matching Monthly Dashboard)
      const monthlyBudget = isSavCat ? baselineMonthly + monthDepositTotal : baselineMonthly;

      totalMonthlyBudget += monthlyBudget;

      if (isSavCat) {
        const isSurplus = totalSavingsBanked > monthlyBudget;
        const surplusAmount = isSurplus ? totalSavingsBanked - monthlyBudget : 0;
        return {
          ...cat,
          monthlyBudget,
          spent: 0,
          banked: totalSavingsBanked,
          difference: surplusAmount,
          isSavings: true,
          isBills: false,
          isSurplus,
          surplusAmount,
        };
      }

      // Check spending across completed weekly check-ins as primary source, fallback to expenses collection
      let spentFromCheckIns = 0;
      let hasCheckInSpent = false;
      monthCompletedCheckIns.forEach((c) => {
        const dec = (c.decisions || []).find(
          (d) =>
            d.categoryId === cat.id ||
            d.categoryName?.toLowerCase() === cat.name?.toLowerCase() ||
            (cat.id === 'cat_fun_money' && (d.categoryId?.includes('fun') || d.categoryName?.toLowerCase().includes('fun'))) ||
            (cat.id === 'cat_essentials' && (d.categoryId?.includes('essential') || d.categoryName?.toLowerCase().includes('essential')))
        );
        if (dec && typeof dec.spent === 'number') {
          spentFromCheckIns += dec.spent;
          hasCheckInSpent = true;
        }
      });

      const { totalSpent: directSpent } = calculateCategorySpending(
        expenses,
        cat.id,
        monthRange.startDate,
        monthRange.endDate,
        household?.fiscalYearEndMonth || 12
      );

      const spent = hasCheckInSpent ? spentFromCheckIns : directSpent;

      totalSpent += spent;
      const difference = monthlyBudget - spent;

      return {
        ...cat,
        monthlyBudget,
        spent,
        banked: 0,
        difference,
        isSavings: false,
        isBills: isBillsCat,
        isSurplus: difference > 0,
        surplusAmount: Math.max(0, difference),
      };
    });

    const billsCategories = categoryDetails.filter((c) => c.isBills);
    const billsMonthlyBudget = billsCategories.reduce((sum, c) => sum + c.monthlyBudget, 0);
    const billsTotalSpent = billsCategories.reduce((sum, c) => sum + c.spent, 0);
    const billsDifference = billsMonthlyBudget - billsTotalSpent; // positive = surplus, negative = deficit

    // Underspent surplus across non-savings, non-bills expense categories
    const totalSurplus = categoryDetails
      .filter((c) => !c.isSavings && !c.isBills && c.difference > 0)
      .reduce((sum, c) => sum + c.difference, 0);

    const totalDeficit = categoryDetails
      .filter((c) => !c.isSavings && c.difference < 0)
      .reduce((sum, c) => sum + Math.abs(c.difference), 0);

    // Every category is referenced in either topWins (surplus/on track) or topOverspent (deficits)
    const topWins = categoryDetails
      .filter((c) => c.isSavings || c.difference >= 0)
      .sort((a, b) => {
        if (a.isSavings) return -1;
        if (b.isSavings) return 1;
        return b.difference - a.difference;
      });

    const topOverspent = categoryDetails
      .filter((c) => !c.isSavings && c.difference < 0)
      .sort((a, b) => a.difference - b.difference);

    return {
      weeksInMonth,
      totalMonthlyBudget,
      totalSpent,
      netRemaining: totalMonthlyBudget - totalSpent,
      totalSurplus,
      totalDeficit,
      topWins,
      topOverspent,
      categoryDetails,
      billsCategories,
      billsMonthlyBudget,
      billsTotalSpent,
      billsDifference,
      totalSavingsBanked,
      monthDepositTotal,
    };
  }, [categories, expenses, monthRange, household?.fiscalYearEndMonth, household?.oneOffDeposits, household?.weeklyOverrides, household?.firstDayOfWeek, checkIns]);

  // Compute Total Saved Funds Available to Allocate
  const totalSavedFunds = useMemo(() => {
    const savingsCatMonthly = categories
      .filter((c) => c.group?.toLowerCase() === 'savings' || c.name.toLowerCase().includes('saving'))
      .reduce((sum, c) => sum + (Number(c.baselineBudget) || 0) * monthStats.weeksInMonth, 0);

    const baseSavings = monthStats.totalSavingsBanked > 0 ? monthStats.totalSavingsBanked : savingsCatMonthly;
    const surplusContribution = isSwept ? monthStats.totalSurplus : 0;
    const billsSurplus = isBillsSurplusTransferred ? Math.max(0, monthStats.billsDifference) : 0;
    const billsDeduction = isBillsDeficitDeducted ? Math.abs(Math.min(0, monthStats.billsDifference)) : 0;

    const computed = baseSavings + surplusContribution + billsSurplus - billsDeduction;
    return Math.max(0, computed);
  }, [
    categories,
    monthStats.weeksInMonth,
    monthStats.totalSavingsBanked,
    monthStats.totalSurplus,
    monthStats.billsDifference,
    isSwept,
    isBillsSurplusTransferred,
    isBillsDeficitDeducted,
  ]);

  // Initialize allocations when entering step 2
  useEffect(() => {
    if (savingsGoals.length > 0 && Object.keys(allocations).length === 0 && totalSavedFunds > 0) {
      // Default: allocate everything to the first goal (e.g. Emergency Savings Fund)
      const primaryGoal = savingsGoals[0];
      setAllocations({ [primaryGoal.id]: totalSavedFunds });
    }
  }, [savingsGoals, totalSavedFunds]);

  // Calculate sum of allocations & remaining
  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum: number, val: number) => sum + (Number(val) || 0), 0);
  }, [allocations]);

  const remainingToAllocate = useMemo(() => {
    return totalSavedFunds - totalAllocated;
  }, [totalSavedFunds, totalAllocated]);

  const is100PercentAllocated = useMemo(() => {
    // Exact or floating point tolerance
    return Math.abs(remainingToAllocate) < 0.01;
  }, [remainingToAllocate]);

  if (!isOpen) return null;

  const handleSweepToSavings = () => {
    if (monthStats.totalSurplus <= 0) return;
    setIsSwept(true);
    showToast(`Successfully swept ${formatCurrency(monthStats.totalSurplus)} in monthly surplus directly into Savings!`, 'success');
  };

  const handleTransferBillsSurplus = () => {
    if (monthStats.billsDifference <= 0) return;
    setIsBillsSurplusTransferred(true);
    showToast(`Transferred ${formatCurrency(monthStats.billsDifference)} Bills surplus directly into Savings!`, 'success');
  };

  const handleDeductBillsDeficit = () => {
    if (monthStats.billsDifference >= 0) return;
    setIsBillsDeficitDeducted(true);
    showToast(`Covered ${formatCurrency(Math.abs(monthStats.billsDifference))} Bills deficit by deducting from Savings allocation.`, 'success');
  };

  const handleAllocationChange = (goalId: string, value: number) => {
    setAllocations((prev) => ({
      ...prev,
      [goalId]: Math.max(0, value),
    }));
  };

  const handleDistributeEvenly = () => {
    if (savingsGoals.length === 0 || totalSavedFunds <= 0) return;
    const split = Math.floor((totalSavedFunds / savingsGoals.length) * 100) / 100;
    const newAlloc: Record<string, number> = {};
    let runningSum = 0;

    savingsGoals.forEach((g, idx) => {
      if (idx === savingsGoals.length - 1) {
        newAlloc[g.id] = Math.round((totalSavedFunds - runningSum) * 100) / 100;
      } else {
        newAlloc[g.id] = split;
        runningSum += split;
      }
    });
    setAllocations(newAlloc);
  };

  const handleAllocateAllToGoal = (goalId: string) => {
    const newAlloc: Record<string, number> = {};
    savingsGoals.forEach((g) => {
      newAlloc[g.id] = g.id === goalId ? totalSavedFunds : 0;
    });
    setAllocations(newAlloc);
  };

  const handleFinalizeAndReset = async () => {
    if (!is100PercentAllocated && totalSavedFunds > 0) {
      showToast(`Please allocate 100% of the saved funds (${formatCurrency(remainingToAllocate)} remaining) before finalizing.`, 'error');
      return;
    }

    setIsExecutingReset(true);
    try {
      // 1. Record allocations to savings goals
      const allocationList: { goalId: string; amount: number }[] = Object.entries(allocations)
        .filter(([_, amt]) => (amt as number) > 0)
        .map(([goalId, amount]) => ({ goalId, amount: Number(amount) }));

      if (allocationList.length > 0) {
        await allocateSavingsToGoals(allocationList);
      }

      const allocationListWithNames = allocationList.map((item) => {
        const goal = savingsGoals.find((g) => g.id === item.goalId);
        return {
          ...item,
          goalName: goal?.name || 'Savings Goal',
        };
      });

      // 2. Execute month-end review finalization
      await executeMonthEndResetAction(targetFiscalMonth, {
        allocations: allocationListWithNames,
        totalAllocated,
        extraCovered: isBillsDeficitDeducted ? Math.abs(monthStats.billsDifference) : 0,
        extraSaved: (isSwept ? monthStats.totalSurplus : 0) + (isBillsSurplusTransferred ? Math.max(0, monthStats.billsDifference) : 0),
        billsDifference: monthStats.billsDifference,
        intentions: intentionsText,
      });
      setIsCompleted(true);
      showToast(`${targetFiscalMonth.monthName} Monthly Review completed and Savings Goals funded!`, 'success');
    } catch (err) {
      console.error('Failed to execute month-end reset:', err);
      showToast(`Error executing review: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsExecutingReset(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-beige-200 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-sage-50/70 border-b border-beige-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-dark-green-800 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-sage-800 bg-sage-100 px-2 py-0.5 rounded-full">
                  Monthly Retrospective
                </span>
                <span className="text-xs text-dark-grey-600">{monthRange.label}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-dark-green-900 leading-tight">
                {currentStep === 1
                  ? 'Fiscal Month-End Review & Hard Reset'
                  : 'Allocate Monthly Savings into Goals'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCompleted && (
              <div className="flex items-center gap-1 text-xs font-bold text-sage-900 bg-sage-100 px-2.5 py-1 rounded-xl">
                <span>Step {currentStep} of 2</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-brown-700 hover:text-dark-green-900 hover:bg-beige-200 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isCompleted ? (
            <div className="py-10 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-sage-100 text-dark-green-800 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-sage-700" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-xl font-black text-dark-green-900">
                  Month-End Reset Complete!
                </h3>
                <p className="text-xs text-brown-700 leading-relaxed">
                  All category budgets have been restored to baseline defaults and <strong>{formatCurrency(totalAllocated)}</strong> was successfully banked across your household savings goals.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-dark-green-800 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-dark-green-900 transition cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          ) : currentStep === 1 ? (
            <>
              {/* Step 1: Monthly Overview Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-beige-50 border border-beige-200 rounded-2xl">
                  <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                    Monthly Budget
                  </span>
                  <span className="text-base sm:text-lg font-black text-dark-green-900">
                    {formatCurrency(monthStats.totalMonthlyBudget)}
                  </span>
                </div>

                <div className="p-3.5 bg-beige-50 border border-beige-200 rounded-2xl">
                  <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                    Total Spent
                  </span>
                  <span className="text-base sm:text-lg font-black text-dark-green-900">
                    {formatCurrency(monthStats.totalSpent)}
                  </span>
                </div>

                <div
                  className={`p-3.5 border rounded-2xl ${
                    monthStats.netRemaining >= 0
                      ? 'bg-sage-50 border-sage-200'
                      : 'bg-alert-red-50 border-alert-red-200'
                  }`}
                >
                  <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                    {monthStats.netRemaining >= 0 ? 'Net Surplus' : 'Net Over'}
                  </span>
                  <span
                    className={`text-base sm:text-lg font-black ${
                      monthStats.netRemaining >= 0 ? 'text-sage-800' : 'text-alert-red-600'
                    }`}
                  >
                    {monthStats.netRemaining >= 0
                      ? `+${formatCurrency(monthStats.netRemaining)}`
                      : `-${formatCurrency(Math.abs(monthStats.netRemaining))}`}
                  </span>
                </div>
              </div>

              {/* Highlights & Top Wins / Overages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Wins */}
                <div className="p-4 bg-sage-50/70 border border-sage-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-sage-900">
                    <Award className="w-4 h-4 text-sage-700" />
                    <span>Top Budget Wins & On Track</span>
                  </div>
                  {monthStats.topWins.length === 0 ? (
                    <p className="text-xs text-brown-700">No surplus or banked savings recorded this month.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {monthStats.topWins.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between text-xs bg-white/80 px-2.5 py-1.5 rounded-lg"
                        >
                          <span className="font-medium text-dark-green-900">{cat.name}</span>
                          <span className="font-extrabold text-sage-800">
                            {cat.isSavings ? (
                              cat.isSurplus ? (
                                `+${formatCurrency(cat.surplusAmount)} surplus (${formatCurrency(cat.banked)} banked)`
                              ) : (
                                `${formatCurrency(cat.banked)} Banked`
                              )
                            ) : cat.difference > 0 ? (
                              `+${formatCurrency(cat.difference)} under`
                            ) : (
                              `On budget (${formatCurrency(cat.spent)} spent)`
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Overages */}
                <div className="p-4 bg-alert-red-50/70 border border-alert-red-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-alert-red-900">
                    <AlertTriangle className="w-4 h-4 text-alert-red-600" />
                    <span>Top Overages (Deficits)</span>
                  </div>
                  {monthStats.topOverspent.length === 0 ? (
                    <p className="text-xs text-brown-700">No category deficits recorded!</p>
                  ) : (
                    <div className="space-y-1.5">
                      {monthStats.topOverspent.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between text-xs bg-white/80 px-2.5 py-1.5 rounded-lg"
                        >
                          <span className="font-medium text-dark-green-900">{cat.name}</span>
                          <span className="font-extrabold text-alert-red-600">
                            -{formatCurrency(Math.abs(cat.difference))} over
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bills Category Monthly Isolation & Reconciliation */}
              {monthStats.billsCategories.length > 0 && (
                <div className="p-4 bg-white border-2 border-beige-300 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-beige-100 text-dark-green-900 flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-dark-green-900">
                            Bills Category Monthly Reconciliation
                          </h4>
                          <span className="text-[10px] font-bold bg-beige-100 text-brown-800 px-1.5 py-0.2 rounded">
                            Monthly Scope Only
                          </span>
                        </div>
                        <p className="text-[11px] text-dark-grey-600">
                          Bills are tracked strictly across the full fiscal month (Budget: {formatCurrency(monthStats.billsMonthlyBudget)} &bull; Spent: {formatCurrency(monthStats.billsTotalSpent)}).
                        </p>
                      </div>
                    </div>

                    <div>
                      {monthStats.billsDifference > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-sage-900 bg-sage-200/90 px-2.5 py-1 rounded-full">
                          <TrendingDown className="w-3.5 h-3.5 text-sage-700" />
                          <span>+{formatCurrency(monthStats.billsDifference)} Month Surplus</span>
                        </span>
                      ) : monthStats.billsDifference < 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-alert-red-700 bg-alert-red-100 px-2.5 py-1 rounded-full">
                          <TrendingUp className="w-3.5 h-3.5 text-alert-red-600" />
                          <span>-{formatCurrency(Math.abs(monthStats.billsDifference))} Month Deficit</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-dark-grey-600 bg-beige-100 px-2.5 py-1 rounded-full">
                          On Budget ($0)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action for Bills Month-End Surplus */}
                  {monthStats.billsDifference > 0 && (
                    <div className="p-3 bg-sage-50/70 border border-sage-200 rounded-xl flex items-center justify-between gap-3">
                      <p className="text-xs text-dark-green-950">
                        Lower utilities/bills this month left <strong>{formatCurrency(monthStats.billsDifference)}</strong> in surplus. Transfer it directly into Savings.
                      </p>
                      <button
                        type="button"
                        onClick={handleTransferBillsSurplus}
                        disabled={isBillsSurplusTransferred}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          isBillsSurplusTransferred
                            ? 'bg-sage-200 text-dark-green-900 cursor-default'
                            : 'bg-dark-green-800 hover:bg-dark-green-900 text-white shadow-xs'
                        }`}
                      >
                        {isBillsSurplusTransferred ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Transferred to Savings!</span>
                          </>
                        ) : (
                          <>
                            <PiggyBank className="w-3.5 h-3.5" />
                            <span>Transfer Surplus to Savings</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Action for Bills Month-End Deficit */}
                  {monthStats.billsDifference < 0 && (
                    <div className="p-3 bg-alert-red-50/70 border border-alert-red-200 rounded-xl flex items-center justify-between gap-3">
                      <p className="text-xs text-alert-red-950">
                        Higher bills/utilities resulted in a <strong>{formatCurrency(Math.abs(monthStats.billsDifference))}</strong> deficit. Cover this overage directly from your accumulated Savings allocation.
                      </p>
                      <button
                        type="button"
                        onClick={handleDeductBillsDeficit}
                        disabled={isBillsDeficitDeducted}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          isBillsDeficitDeducted
                            ? 'bg-alert-red-200 text-alert-red-900 cursor-default'
                            : 'bg-alert-red-800 hover:bg-alert-red-900 text-white shadow-xs'
                        }`}
                      >
                        {isBillsDeficitDeducted ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Covered from Savings</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Deduct {formatCurrency(Math.abs(monthStats.billsDifference))} from Savings</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Single-Click Monthly Check-in Sweep to Savings */}
              {monthStats.totalSurplus > 0 && (
                <div className="p-4 bg-sage-50/70 border border-sage-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-sage-200 text-dark-green-900 flex items-center justify-center">
                        <PiggyBank className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-dark-green-900">
                          Month-End Underspent Surplus Sweep
                        </h4>
                        <p className="text-[11px] text-dark-grey-600">
                          You have {formatCurrency(monthStats.totalSurplus)} in net underspent category surplus.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSweepToSavings}
                      disabled={isSwept}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                        isSwept
                          ? 'bg-sage-200 text-dark-green-900 cursor-default'
                          : 'bg-dark-green-800 hover:bg-dark-green-900 text-white'
                      }`}
                    >
                      {isSwept ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Swept to Savings!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Sweep {formatCurrency(monthStats.totalSurplus)} to Savings</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Hard Reset Explanation Card */}
              <div className="p-4 bg-gold-50 border border-gold-200 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-gold-900">
                  <RotateCcw className="w-4 h-4 text-gold-700" />
                  <span>The Fiscal Month-End Boundary & Hard Reset</span>
                </div>
                <p className="text-xs text-gold-950 leading-relaxed">
                  In Canopy, completed weekly budgets and check-in history of the reviewed month <strong>remain permanently preserved and will not change</strong>. The "Hard Reset" language communicates that <strong>there are no rollovers across months</strong>: you will never pull savings from another month to cover overspending or prorate budgets across month boundaries. Each month starts with a clean slate.
                </p>
              </div>

              {!isFinalWeeklyCheckInComplete && (
                <div className="p-3.5 bg-gold-50/90 border border-gold-300 rounded-2xl flex items-center gap-2.5 text-xs text-gold-950 font-medium">
                  <AlertTriangle className="w-4 h-4 text-gold-700 shrink-0" />
                  <span>
                    * The last weekly check-in of the month needs to be completed before the Monthly Retrospective can be completed.
                  </span>
                </div>
              )}

              {/* Intentions Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-dark-green-900 block">
                  Household Intentions for Next Month:
                </label>
                <textarea
                  value={intentionsText}
                  onChange={(e) => setIntentionsText(e.target.value)}
                  placeholder="e.g., Focus on reducing restaurant spending; increase contribution to Vacation Savings..."
                  rows={2}
                  className="w-full p-3 bg-beige-50 border border-beige-300 rounded-xl text-xs text-dark-green-900 focus:outline-hidden focus:border-dark-green-800"
                />
              </div>
            </>
          ) : (
            /* Step 2: Savings Goal Allocation */
            <div className="space-y-5">
              {/* Savings Total Pool Banner */}
              <div className="p-5 bg-dark-green-900 text-white rounded-2xl shadow-md space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <PiggyBank className="w-5 h-5 text-sage-300" />
                      <span className="text-xs font-bold text-sage-200 uppercase tracking-wider">
                        Accumulated Monthly Savings
                      </span>
                    </div>
                    <div className="text-3xl font-black font-mono tracking-tight text-white">
                      {formatCurrency(totalSavedFunds)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDistributeEvenly}
                      className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                    >
                      Split Evenly
                    </button>
                    {savingsGoals[0] && (
                      <button
                        type="button"
                        onClick={() => handleAllocateAllToGoal(savingsGoals[0].id)}
                        className="px-2.5 py-1 bg-sage-600/30 hover:bg-sage-600/40 text-sage-200 border border-sage-400/30 text-[11px] font-bold rounded-lg transition cursor-pointer"
                      >
                        All to Emergency Fund
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-sage-100/90 leading-relaxed border-t border-white/10 pt-2.5">
                  Allocate your accumulated monthly savings funds across your household goals below. You must distribute 100% of the funds before executing the Hard Reset.
                </p>
              </div>

              {/* Status & Distribution Validation Bar */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-colors ${
                  is100PercentAllocated
                    ? 'bg-sage-50 border-sage-300 text-dark-green-950'
                    : remainingToAllocate > 0
                    ? 'bg-gold-50 border-gold-300 text-gold-950'
                    : 'bg-alert-red-50 border-alert-red-300 text-alert-red-950'
                }`}
              >
                <div className="flex items-center gap-2">
                  {is100PercentAllocated ? (
                    <CheckCircle2 className="w-5 h-5 text-sage-700 shrink-0" />
                  ) : remainingToAllocate > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-gold-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-alert-red-600 shrink-0" />
                  )}
                  <div>
                    <span className="text-xs font-bold block">
                      {is100PercentAllocated
                        ? '100% Allocated — Ready to finalize!'
                        : remainingToAllocate > 0
                        ? `Remaining to distribute: ${formatCurrency(remainingToAllocate)}`
                        : `Overallocated by ${formatCurrency(Math.abs(remainingToAllocate))}`}
                    </span>
                    <span className="text-[11px] opacity-80">
                      Total Allocated: {formatCurrency(totalAllocated)} / {formatCurrency(totalSavedFunds)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xs font-black font-mono px-2 py-0.5 rounded-full ${
                      is100PercentAllocated
                        ? 'bg-sage-200 text-dark-green-900'
                        : 'bg-gold-200 text-gold-900'
                    }`}
                  >
                    {totalSavedFunds > 0
                      ? `${Math.round((totalAllocated / totalSavedFunds) * 100)}%`
                      : '100%'}
                  </span>
                </div>
              </div>

              {/* Savings Goals Allocation Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-dark-green-900 uppercase tracking-wider">
                    Household Savings Goals
                  </h4>
                  <span className="text-[11px] text-brown-700">
                    {savingsGoals.length} {savingsGoals.length === 1 ? 'Goal' : 'Goals'} active
                  </span>
                </div>

                {savingsGoals.map((goal) => {
                  const currentAlloc = allocations[goal.id] || 0;
                  const isEmergencyFund = goal.name.toLowerCase().includes('emergency');
                  const percent = goal.targetAmount > 0
                    ? Math.min(100, Math.round(((goal.currentAmount + currentAlloc) / goal.targetAmount) * 100))
                    : 0;

                  return (
                    <div
                      key={goal.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isEmergencyFund
                          ? 'bg-sage-50/40 border-sage-300 shadow-xs'
                          : 'bg-white border-beige-300 hover:border-beige-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isEmergencyFund
                                ? 'bg-sage-100 text-dark-green-800'
                                : 'bg-sage-100 text-dark-green-800'
                            }`}
                          >
                            {isEmergencyFund ? (
                              <ShieldCheck className="w-5 h-5" />
                            ) : (
                              <Target className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-extrabold text-sm text-dark-green-900 leading-tight">
                                {goal.name}
                              </h5>
                              {isEmergencyFund && (
                                <span className="text-[9px] font-black uppercase tracking-wider bg-sage-100 text-dark-green-900 px-1.5 py-0.5 rounded">
                                  Default Fund
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-brown-700 flex items-center gap-2 mt-0.5">
                              <span>Current: <strong>{formatCurrency(goal.currentAmount)}</strong></span>
                              <span>&bull;</span>
                              <span>Target: <strong>{formatCurrency(goal.targetAmount)}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Amount Input */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-dark-green-900">$</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={currentAlloc === 0 ? '' : currentAlloc}
                            onChange={(e) => handleAllocationChange(goal.id, Number(e.target.value) || 0)}
                            placeholder="0"
                            className="w-24 px-3 py-1.5 bg-beige-50 border border-beige-300 rounded-xl text-sm font-bold font-mono text-dark-green-900 text-right focus:outline-hidden focus:border-dark-green-700"
                          />
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-brown-700 font-medium">
                          <span>
                            Progress with this allocation: <strong>{percent}%</strong>
                          </span>
                          <span>
                            New total: {formatCurrency(goal.currentAmount + currentAlloc)}
                          </span>
                        </div>
                        <div className="w-full bg-beige-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isEmergencyFund ? 'bg-sage-600' : 'bg-dark-green-700'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isCompleted && (
          <div className="px-6 py-4 bg-beige-50/80 border-t border-beige-200 flex items-center justify-between">
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-brown-700 hover:text-dark-green-900 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-beige-100 text-dark-green-900 text-xs font-bold rounded-xl border border-beige-300 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Review</span>
              </button>
            )}

            {currentStep === 1 ? (
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!isFinalWeeklyCheckInComplete}
                  className="flex items-center gap-2 px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-xs transition active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Continue to Savings Allocation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {!isFinalWeeklyCheckInComplete && (
                  <span className="text-[11px] text-gold-800 font-semibold italic text-right max-w-sm">
                    * Complete the final weekly check-in before finalizing the monthly retrospective.
                  </span>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleFinalizeAndReset}
                disabled={isExecutingReset || !is100PercentAllocated}
                className="flex items-center gap-2 px-6 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-xs transition active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                <span>
                  {isExecutingReset ? 'Executing Reset...' : 'Confirm Allocations & Hard Reset'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
