import React, { useState, useMemo, useEffect } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { Category, Expense, DateRange, CategoryRolloverDecision } from '../../types';
import {
  formatCurrency,
  getWeekRange,
  isExpenseInDateRange,
  formatLocalDate,
  getTodayLocalDateString,
  getWeekId,
  getCategoryEffectiveWeeklyBudget,
  calculateCategorySpending,
} from '../../lib/calculations';
import { CategoryIcon } from '../Common/CategoryIcon';
import { getSavingsProgressFillColor } from '../Common/BudgetProgressBar';
import {
  calculateCheckInStatus,
  getRemainingWeeksInMonth,
  getOldestPastDueCheckInWeek,
} from '../../lib/checkInCalculations';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  X,
  Plus,
  Receipt,
  Sparkles,
  Calendar,
  Layers,
  Check,
  AlertTriangle,
  Info,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';

interface WeeklyCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OverspendInputState {
  potPull: number;
  savingsPull: number;
  overrideMode: 'none' | 'accept_loss' | 'pull_future_savings';
}

export const WeeklyCheckInModal: React.FC<WeeklyCheckInModalProps> = ({ isOpen, onClose }) => {
  const {
    household,
    categories,
    expenses,
    members,
    user,
    checkIns,
    completeWeeklyCheckIn,
    addExpense,
    showToast,
    timeframeMode,
    timeframeOffset,
    activeDateRange,
  } = useHousehold();

  // Active step in the check-in wizard (1: Review expenses, 2: Rollovers/Deficits, 3: Confirm)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 2 Underspend decisions: categoryId -> 'transfer_pot' | 'prorate'
  const [underspendChoices, setUnderspendChoices] = useState<Record<string, 'transfer_pot' | 'prorate'>>({});

  // Step 2 Overspend inputs: categoryId -> { potPull, savingsPull, overrideMode }
  const [overspendInputs, setOverspendInputs] = useState<Record<string, OverspendInputState>>({});

  const [intentionsNote, setIntentionsNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [forceEarlyCheckIn, setForceEarlyCheckIn] = useState<boolean>(false);

  // Inline Expense Logging State
  const [showInlineLogExpense, setShowInlineLogExpense] = useState<boolean>(false);
  const [inlineAmount, setInlineAmount] = useState<string>('');
  const [inlineDescription, setInlineDescription] = useState<string>('');
  const [inlineCategoryId, setInlineCategoryId] = useState<string>('');
  const [inlineDate, setInlineDate] = useState<string>(getTodayLocalDateString());
  const [inlineLoggedBy, setInlineLoggedBy] = useState<string>(user?.userId || 'usr_self');
  const [isSavingInline, setIsSavingInline] = useState<boolean>(false);

  // Compute status info for current week and oldest past due week
  const statusInfo = useMemo(() => {
    return calculateCheckInStatus(household, checkIns, expenses);
  }, [household, checkIns, expenses]);

  const oldestPastDueWeek = useMemo(() => {
    return getOldestPastDueCheckInWeek(household, checkIns);
  }, [household, checkIns]);

  // Selected week range for check-in: allows historical navigation
  const [selectedWeekRange, setSelectedWeekRange] = useState<DateRange>(() => {
    if (timeframeMode === 'week' && timeframeOffset < 0) {
      return activeDateRange;
    }
    if (oldestPastDueWeek) {
      return oldestPastDueWeek.range;
    }
    return statusInfo.activeWeekRange;
  });

  // Whenever modal opens or activeDateRange changes, sync selectedWeekRange
  useEffect(() => {
    if (isOpen) {
      if (timeframeMode === 'week' && timeframeOffset < 0) {
        setSelectedWeekRange(activeDateRange);
      } else if (oldestPastDueWeek) {
        setSelectedWeekRange(oldestPastDueWeek.range);
      } else {
        setSelectedWeekRange(statusInfo.activeWeekRange);
      }
      setStep(1);
      setForceEarlyCheckIn(false);
      setUnderspendChoices({});
      setOverspendInputs({});
    }
  }, [isOpen, timeframeMode, timeframeOffset, activeDateRange, statusInfo.activeWeekRange, oldestPastDueWeek]);

  // Navigate week forward or backward directly inside modal
  const navigateModalWeek = (direction: -1 | 1) => {
    const firstDay = household?.firstDayOfWeek || 'Monday';
    const targetDate = new Date(selectedWeekRange.startDate.getTime() + direction * 7 * 24 * 60 * 60 * 1000);
    const newRange = getWeekRange(targetDate, firstDay, 0);
    setSelectedWeekRange(newRange);
    setStep(1);
  };

  // Determine if selected week is a historical week (ended in the past)
  const isHistoricalWeek = useMemo(() => {
    return selectedWeekRange.endDate.getTime() < Date.now();
  }, [selectedWeekRange]);

  // Check if a completed check-in already exists for this selected week
  const existingCheckInForWeek = useMemo(() => {
    const startStr = formatLocalDate(selectedWeekRange.startDate);
    const endStr = formatLocalDate(selectedWeekRange.endDate);
    return checkIns.find(
      (c) =>
        c.status === 'completed' &&
        (c.weekEndDate === endStr || c.weekStartDate === startStr || c.id.includes(startStr))
    );
  }, [selectedWeekRange, checkIns]);

  const isTooEarly = !isHistoricalWeek && !statusInfo.isLastDayOfWeek && !statusInfo.isPastDue && !forceEarlyCheckIn;
  const isPreviewMode = !isHistoricalWeek && !statusInfo.isLastDayOfWeek && !statusInfo.isPastDue && !forceEarlyCheckIn;

  // Filter expenses for this check-in week
  const weekExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      return isExpenseInDateRange(exp, selectedWeekRange.startDate, selectedWeekRange.endDate);
    });
  }, [expenses, selectedWeekRange]);

  // Calculate remaining weeks in month relative to selected week
  const targetRemainingWeeks = useMemo(() => {
    if (isHistoricalWeek) {
      return Math.max(1, getRemainingWeeksInMonth(selectedWeekRange.endDate));
    }
    return Math.max(1, statusInfo.remainingWeeksInMonth);
  }, [isHistoricalWeek, selectedWeekRange.endDate, statusInfo.remainingWeeksInMonth]);

  const remainingWeeksInMonth = targetRemainingWeeks;
  const activeWeekId = useMemo(() => {
    return getWeekId(selectedWeekRange, household?.firstDayOfWeek || 'Monday');
  }, [selectedWeekRange, household?.firstDayOfWeek]);

  // Isolate categories by group
  const isBillsCategory = (c: Category) =>
    c.group?.toLowerCase() === 'bills' || c.name?.toLowerCase() === 'bills';

  const isSavingsCategory = (c: Category) =>
    c.type === 'savings' || c.group?.toLowerCase() === 'savings';

  const expenseCategories = useMemo(() => {
    return categories.filter((c) => !isBillsCategory(c) && !isSavingsCategory(c));
  }, [categories]);

  const savingsCategories = useMemo(() => {
    return categories.filter(isSavingsCategory);
  }, [categories]);

  const baselineSavingsTarget = useMemo(() => {
    return savingsCategories.reduce((sum, c) => sum + (Number(c.baselineBudget) || 0), 0);
  }, [savingsCategories]);

  // Derive "This week" Savings budget strictly from weeklyOverrides map (e.g. expanded by one-off deposits)
  // or fall back to global baseline budget ($550).
  const thisWeekSavingsTarget = useMemo(() => {
    if (activeWeekId && household?.weeklyOverrides && household.weeklyOverrides[activeWeekId]) {
      const weekOverrides = household.weeklyOverrides[activeWeekId];
      if (weekOverrides.savings !== undefined && weekOverrides.savings !== null && !isNaN(Number(weekOverrides.savings))) {
        return Number(weekOverrides.savings);
      }
      const savingsCat = savingsCategories.find(isSavingsCategory);
      if (savingsCat && weekOverrides[savingsCat.id] !== undefined && !isNaN(Number(weekOverrides[savingsCat.id]))) {
        return Number(weekOverrides[savingsCat.id]);
      }
      if (weekOverrides['cat_savings'] !== undefined && !isNaN(Number(weekOverrides['cat_savings']))) {
        return Number(weekOverrides['cat_savings']);
      }
    }
    return baselineSavingsTarget;
  }, [activeWeekId, household?.weeklyOverrides, baselineSavingsTarget, savingsCategories]);

  // Dynamic Pacing Calculations for Step 2
  const categoryPacings = useMemo(() => {
    return expenseCategories.map((cat) => {
      const effective = getCategoryEffectiveWeeklyBudget(cat, activeWeekId, household);
      const budget = effective.budget;
      const baseline = effective.baseline;
      const { totalSpent: spent } = calculateCategorySpending(
        expenses,
        cat.id,
        selectedWeekRange.startDate,
        selectedWeekRange.endDate
      );
      const diff = budget - spent;
      return {
        category: cat,
        budget,
        baseline,
        spent,
        diff,
        isUnderspent: diff > 0,
        isOverspent: diff < 0,
        isExact: diff === 0,
        leftover: Math.max(0, diff),
        deficit: Math.max(0, -diff),
      };
    });
  }, [expenseCategories, activeWeekId, household, expenses, selectedWeekRange]);

  // 1. Calculate Gross Transfer Pot generated from underspent categories that chose 'transfer_pot'
  const totalTransferPotGenerated = useMemo(() => {
    return categoryPacings
      .filter((p) => p.isUnderspent)
      .reduce((sum, p) => {
        const choice = underspendChoices[p.category.id] || 'transfer_pot';
        if (choice === 'transfer_pot') {
          return sum + p.leftover;
        }
        return sum;
      }, 0);
  }, [categoryPacings, underspendChoices]);

  // 2. Calculate Total Pot Pulled and Total Savings Pulled to cover deficits
  const { totalPotPulledForDeficits, totalSavingsPulledForDeficits } = useMemo(() => {
    let potSum = 0;
    let savingsSum = 0;

    categoryPacings
      .filter((p) => p.isOverspent)
      .forEach((p) => {
        const input = overspendInputs[p.category.id];
        if (input) {
          potSum += Number(input.potPull) || 0;
          savingsSum += Number(input.savingsPull) || 0;
        }
      });

    return {
      totalPotPulledForDeficits: potSum,
      totalSavingsPulledForDeficits: savingsSum,
    };
  }, [categoryPacings, overspendInputs]);

  // 3. Calculate Available Net Transfer Pot remaining
  const availableTransferPot = useMemo(() => {
    return Math.max(0, totalTransferPotGenerated - totalPotPulledForDeficits);
  }, [totalTransferPotGenerated, totalPotPulledForDeficits]);

  // 4. Calculate Dynamic Savings for This Week (Savings Expansion per Requirement 5)
  // If funds remain in Transfer Pot, automatically route exact remaining amount into current week's Savings category,
  // dynamically expanding the total savings budget for the week.
  const {
    savingsBudgetThisWeek,
    savingsSavedThisWeek,
    savingsExpandedBonus,
    futureSavingsReductionTotal,
  } = useMemo(() => {
    const bonus = availableTransferPot;
    const baseTarget = thisWeekSavingsTarget;
    const baseSaved = Math.max(0, baseTarget - totalSavingsPulledForDeficits);

    const totalBudgetThisWeek = baseTarget + bonus;
    const totalSavedThisWeek = baseSaved + bonus;

    // Calculate any future savings reductions chosen via overspend overrides
    let futureSavingsReduction = 0;
    categoryPacings
      .filter((p) => p.isOverspent)
      .forEach((p) => {
        const input = overspendInputs[p.category.id];
        if (input?.overrideMode === 'pull_future_savings') {
          const covered = (Number(input.potPull) || 0) + (Number(input.savingsPull) || 0);
          const uncovered = Math.max(0, p.deficit - covered);
          const monthlyCap = p.baseline * remainingWeeksInMonth;
          const excess = Math.max(0, uncovered - monthlyCap);
          futureSavingsReduction += Math.round(excess / remainingWeeksInMonth);
        }
      });

    return {
      savingsBudgetThisWeek: totalBudgetThisWeek,
      savingsSavedThisWeek: totalSavedThisWeek,
      savingsExpandedBonus: bonus,
      futureSavingsReductionTotal: futureSavingsReduction,
    };
  }, [
    availableTransferPot,
    thisWeekSavingsTarget,
    totalSavingsPulledForDeficits,
    categoryPacings,
    overspendInputs,
    remainingWeeksInMonth,
  ]);

  // 5. Build dynamic category future budget projections
  const categoryProjections = useMemo(() => {
    return categoryPacings.map((p) => {
      const cat = p.category;
      let followingWeeksBudget = p.baseline;
      let statusLabel = 'Unchanged';
      let statusType: 'neutral' | 'prorated_up' | 'prorated_down' | 'loss_accepted' | 'future_savings_pulled' = 'neutral';
      let deltaAmount = 0;

      if (p.isUnderspent) {
        const choice = underspendChoices[cat.id] || 'transfer_pot';
        if (choice === 'prorate') {
          const addPerWeek = Math.round(p.leftover / remainingWeeksInMonth);
          followingWeeksBudget = p.baseline + addPerWeek;
          deltaAmount = addPerWeek;
          statusLabel = `+${formatCurrency(addPerWeek)}/wk prorated`;
          statusType = 'prorated_up';
        } else {
          followingWeeksBudget = p.baseline;
          statusLabel = 'Transferred to pot (baseline retained)';
          statusType = 'neutral';
        }
      } else if (p.isOverspent) {
        const input = overspendInputs[cat.id] || { potPull: 0, savingsPull: 0, overrideMode: 'none' };
        const covered = (Number(input.potPull) || 0) + (Number(input.savingsPull) || 0);
        const uncovered = Math.max(0, p.deficit - covered);
        const monthlyCap = p.baseline * remainingWeeksInMonth;

        if (uncovered === 0) {
          followingWeeksBudget = p.baseline;
          statusLabel = 'Covered via pot/savings';
          statusType = 'neutral';
        } else if (uncovered <= monthlyCap) {
          const redPerWeek = Math.round(uncovered / remainingWeeksInMonth);
          followingWeeksBudget = Math.max(0, p.baseline - redPerWeek);
          deltaAmount = redPerWeek;
          statusLabel = `-${formatCurrency(redPerWeek)}/wk auto-prorated`;
          statusType = 'prorated_down';
        } else {
          // Exceeds monthly capacity
          if (input.overrideMode === 'accept_loss') {
            followingWeeksBudget = 0;
            statusLabel = 'Loss accepted ($0/wk future budget)';
            statusType = 'loss_accepted';
          } else if (input.overrideMode === 'pull_future_savings') {
            followingWeeksBudget = 0;
            statusLabel = 'Covered from future savings ($0/wk)';
            statusType = 'future_savings_pulled';
          } else {
            followingWeeksBudget = 0;
            statusLabel = 'Deficit exceeds capacity (Action required)';
            statusType = 'prorated_down';
          }
        }
      }

      return {
        ...p,
        followingWeeksBudget,
        statusLabel,
        statusType,
        deltaAmount,
      };
    });
  }, [categoryPacings, underspendChoices, overspendInputs, remainingWeeksInMonth]);

  // Overall totals for Step 1, 2, 3
  const totalSpent = useMemo(() => {
    return categoryPacings.reduce((sum, p) => sum + p.spent, 0);
  }, [categoryPacings]);

  const totalBudget = useMemo(() => {
    return categoryPacings.reduce((sum, p) => sum + p.budget, 0);
  }, [categoryPacings]);

  const totalDeficit = useMemo(() => {
    return categoryPacings.filter((p) => p.isOverspent).reduce((sum, p) => sum + p.deficit, 0);
  }, [categoryPacings]);

  const totalSurplus = useMemo(() => {
    return categoryPacings.filter((p) => p.isUnderspent).reduce((sum, p) => sum + p.leftover, 0);
  }, [categoryPacings]);

  // Check if any overspent category with excess deficit has not yet selected a valid resolution
  const hasUnresolvedExcessDeficit = useMemo(() => {
    return categoryPacings.some((p) => {
      if (!p.isOverspent) return false;
      const input = overspendInputs[p.category.id] || { potPull: 0, savingsPull: 0, overrideMode: 'none' };
      const covered = (Number(input.potPull) || 0) + (Number(input.savingsPull) || 0);
      const uncovered = Math.max(0, p.deficit - covered);
      const monthlyCap = p.baseline * remainingWeeksInMonth;
      if (uncovered > monthlyCap && input.overrideMode === 'none') {
        return true;
      }
      return false;
    });
  }, [categoryPacings, overspendInputs, remainingWeeksInMonth]);

  // Final Decisions compiled for completion
  const decisions: CategoryRolloverDecision[] = useMemo(() => {
    const list: CategoryRolloverDecision[] = [];

    categoryProjections.forEach((proj) => {
      const cat = proj.category;
      let choice: CategoryRolloverDecision['choice'] = 'rollover';

      if (proj.isUnderspent) {
        const uChoice = underspendChoices[cat.id] || 'transfer_pot';
        choice = uChoice === 'prorate' ? 'rollover' : 'savings';
      } else if (proj.isOverspent) {
        const input = overspendInputs[cat.id];
        if (input?.savingsPull && input.savingsPull > 0) {
          choice = 'deduct_savings';
        } else {
          choice = 'reduce_future';
        }
      }

      list.push({
        categoryId: cat.id,
        categoryName: cat.name,
        spent: proj.spent,
        budget: proj.budget,
        baselineBudget: proj.baseline,
        isOverridden: proj.followingWeeksBudget !== proj.baseline,
        difference: proj.diff,
        choice,
        adjustmentPerWeek: proj.followingWeeksBudget - proj.baseline,
        previousWeeklyBudget: proj.budget,
        newWeeklyBudget: proj.followingWeeksBudget,
        savingsContribution: proj.isUnderspent && (underspendChoices[cat.id] || 'transfer_pot') === 'transfer_pot' ? proj.leftover : 0,
      });
    });

    // Add Savings categories decisions
    savingsCategories.forEach((cat) => {
      const futureSavingsBudget = Math.max(0, Number(cat.baselineBudget) - futureSavingsReductionTotal);
      list.push({
        categoryId: cat.id,
        categoryName: cat.name,
        spent: savingsSavedThisWeek,
        budget: savingsBudgetThisWeek,
        baselineBudget: Number(cat.baselineBudget),
        isOverridden: futureSavingsBudget !== Number(cat.baselineBudget),
        difference: savingsSavedThisWeek - savingsBudgetThisWeek,
        choice: 'savings',
        adjustmentPerWeek: futureSavingsBudget - Number(cat.baselineBudget),
        previousWeeklyBudget: thisWeekSavingsTarget,
        newWeeklyBudget: futureSavingsBudget,
        savingsContribution: savingsExpandedBonus,
      });
    });

    return list;
  }, [
    categoryProjections,
    savingsCategories,
    underspendChoices,
    overspendInputs,
    savingsSavedThisWeek,
    savingsBudgetThisWeek,
    futureSavingsReductionTotal,
    savingsExpandedBonus,
  ]);

  if (!isOpen) return null;

  // Handlers for Underspend choices
  const handleUnderspendChoice = (categoryId: string, choice: 'transfer_pot' | 'prorate') => {
    setUnderspendChoices((prev) => ({
      ...prev,
      [categoryId]: choice,
    }));
  };

  // Handlers for Overspend inputs
  const handleOverspendPotPull = (categoryId: string, val: number, maxAllowed: number) => {
    const safeVal = Math.max(0, Math.min(val, maxAllowed));
    setOverspendInputs((prev) => ({
      ...prev,
      [categoryId]: {
        potPull: safeVal,
        savingsPull: prev[categoryId]?.savingsPull || 0,
        overrideMode: prev[categoryId]?.overrideMode || 'none',
      },
    }));
  };

  const handleOverspendSavingsPull = (categoryId: string, val: number, maxAllowed: number) => {
    const safeVal = Math.max(0, Math.min(val, maxAllowed));
    setOverspendInputs((prev) => ({
      ...prev,
      [categoryId]: {
        potPull: prev[categoryId]?.potPull || 0,
        savingsPull: safeVal,
        overrideMode: prev[categoryId]?.overrideMode || 'none',
      },
    }));
  };

  const handleOverspendOverrideMode = (categoryId: string, mode: 'accept_loss' | 'pull_future_savings') => {
    setOverspendInputs((prev) => ({
      ...prev,
      [categoryId]: {
        potPull: prev[categoryId]?.potPull || 0,
        savingsPull: prev[categoryId]?.savingsPull || 0,
        overrideMode: mode,
      },
    }));
  };

  const handleSaveInlineExpense = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numAmount = parseFloat(inlineAmount);
    if (!numAmount || numAmount <= 0) {
      showToast('Please enter an amount greater than $0.00', 'error');
      return;
    }

    const resolvedCategoryId =
      inlineCategoryId && categories.some((c) => c.id === inlineCategoryId)
        ? inlineCategoryId
        : categories[0]?.id || '';

    setIsSavingInline(true);
    try {
      await addExpense({
        amount: numAmount,
        description: inlineDescription.trim() || 'Logged Expense',
        categoryId: resolvedCategoryId,
        date: inlineDate || formatLocalDate(selectedWeekRange.endDate),
        loggedByUserId: inlineLoggedBy || user?.userId || 'usr_self',
      });
      setInlineAmount('');
      setInlineDescription('');
      setShowInlineLogExpense(false);
    } catch (err) {
      console.error('Failed to log inline expense:', err);
    } finally {
      setIsSavingInline(false);
    }
  };

  const handleConfirmCheckIn = async () => {
    if (isPreviewMode) {
      showToast('Check-in submission is disabled during Preview mode.', 'info');
      return;
    }
    if (hasUnresolvedExcessDeficit) {
      showToast('Please resolve overspent categories before confirming.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await completeWeeklyCheckIn({
        weekStartDate: formatLocalDate(selectedWeekRange.startDate),
        weekEndDate: formatLocalDate(selectedWeekRange.endDate),
        notes: intentionsNote.trim() || undefined,
        decisions,
        totalSaved: savingsSavedThisWeek,
        totalSpent,
        totalBudget,
      });
      showToast(
        isHistoricalWeek
          ? `Historical check-in for ${selectedWeekRange.label} recorded successfully!`
          : 'Weekly check-in completed successfully!',
        'success'
      );
      onClose();
    } catch (err) {
      console.error('Failed to complete check-in:', err);
      showToast('Failed to save check-in. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-beige-200 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-3.5 bg-beige-50 border-b border-beige-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-dark-green-800 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-5 h-5 text-sage-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-dark-green-950 truncate">
                  Weekly Check-In & Budget Balancing
                </h3>
                {isHistoricalWeek ? (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-brown-100 text-brown-900 border border-brown-300">
                    Historical Week
                  </span>
                ) : isPreviewMode ? (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gold-100 text-gold-900 border border-gold-300">
                    Preview Mode
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sage-100 text-sage-900 border border-sage-300">
                    Active Alignment
                  </span>
                )}
              </div>
              <span className="text-xs text-brown-700 block truncate">
                {selectedWeekRange.label} &bull; {remainingWeeksInMonth} {remainingWeeksInMonth === 1 ? 'week' : 'weeks'} remaining in month
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-brown-700 hover:text-dark-green-900 hover:bg-beige-200/60 rounded-xl transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps Indicator */}
        <div className="px-6 py-2.5 bg-beige-50/50 border-b border-beige-200/80 flex items-center justify-between text-xs font-bold shrink-0">
          <div className="flex items-center gap-2 sm:gap-6 w-full max-w-xl">
            <div
              className={`flex items-center gap-1.5 ${
                step === 1 ? 'text-dark-green-900' : 'text-dark-grey-600'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  step === 1
                    ? 'bg-dark-green-800 text-white'
                    : step > 1
                    ? 'bg-sage-600 text-white'
                    : 'bg-beige-200 text-dark-grey-600'
                }`}
              >
                1
              </span>
              <span className="hidden sm:inline">Review Transactions</span>
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-beige-300 shrink-0" />

            <div
              className={`flex items-center gap-1.5 ${
                step === 2 ? 'text-dark-green-900' : 'text-dark-grey-600'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  step === 2
                    ? 'bg-dark-green-800 text-white'
                    : step > 2
                    ? 'bg-sage-600 text-white'
                    : 'bg-beige-200 text-dark-grey-600'
                }`}
              >
                2
              </span>
              <span className="hidden sm:inline">Rollover & Deficits</span>
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-beige-300 shrink-0" />

            <div
              className={`flex items-center gap-1.5 ${
                step === 3 ? 'text-dark-green-900' : 'text-dark-grey-600'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  step === 3 ? 'bg-dark-green-800 text-white' : 'bg-beige-200 text-dark-grey-600'
                }`}
              >
                3
              </span>
              <span className="hidden sm:inline">Summary & Confirm</span>
            </div>
          </div>

          {/* Week Switcher Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateModalWeek(-1)}
              title="Previous Week"
              className="p-1.5 rounded-lg bg-white border border-beige-200 hover:bg-beige-100 text-dark-green-900 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigateModalWeek(1)}
              title="Next Week"
              className="p-1.5 rounded-lg bg-white border border-beige-200 hover:bg-beige-100 text-dark-green-900 transition cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ========================================================================= */}
          {/* STEP 1: REVIEW TRANSACTIONS                                               */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-dark-green-900 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-dark-green-700" />
                    Transactions for {selectedWeekRange.label}
                  </h4>
                  <p className="text-xs text-brown-700">
                    Verify all purchases are logged before balancing category rollovers and deficits.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInlineLogExpense((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showInlineLogExpense ? 'Close Form' : 'Log Expense'}</span>
                </button>
              </div>

              {/* Inline Log Expense Form */}
              {showInlineLogExpense && (
                <div className="p-4 bg-sage-50/60 border border-sage-200 rounded-2xl space-y-3 animate-in fade-in duration-150">
                  <h5 className="text-xs font-black text-dark-green-900">
                    Add Missing Expense to {selectedWeekRange.label}
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-dark-grey-600 block mb-1">
                        Amount ($) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={inlineAmount}
                        onChange={(e) => setInlineAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-dark-grey-600 block mb-1">
                        Description *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Trader Joe's Groceries"
                        value={inlineDescription}
                        onChange={(e) => setInlineDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-xs text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-dark-grey-600 block mb-1">
                        Category
                      </label>
                      <select
                        value={inlineCategoryId}
                        onChange={(e) => setInlineCategoryId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-xs text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.group})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-dark-grey-600 block mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={inlineDate}
                        onChange={(e) => setInlineDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-xs text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowInlineLogExpense(false)}
                      className="px-3 py-1.5 text-xs text-brown-700 hover:text-dark-green-900 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveInlineExpense}
                      disabled={isSavingInline}
                      className="px-4 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-black rounded-xl transition"
                    >
                      {isSavingInline ? 'Adding...' : 'Add Expense to Week'}
                    </button>
                  </div>
                </div>
              )}

              {/* Transactions List */}
              {weekExpenses.length === 0 ? (
                <div className="p-8 text-center bg-beige-50/50 border border-dashed border-beige-200 rounded-2xl space-y-2">
                  <Receipt className="w-8 h-8 mx-auto text-brown-700" />
                  <h4 className="text-sm font-bold text-dark-green-900">
                    No transactions logged for this week
                  </h4>
                  <p className="text-xs text-brown-700 max-w-sm mx-auto">
                    If you spent money on groceries, bills, or dining, log them now before calculating your rollover budgets.
                  </p>
                </div>
              ) : (
                <div className="border border-beige-200 rounded-2xl overflow-hidden divide-y divide-beige-100 max-h-72 overflow-y-auto">
                  {weekExpenses.map((exp) => {
                    const cat = categories.find((c) => c.id === exp.categoryId);
                    const payer = members.find((m) => m.userId === exp.loggedByUserId);

                    return (
                      <div
                        key={exp.id}
                        className="p-3 bg-white flex items-center justify-between gap-3 hover:bg-beige-50/50 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-beige-100 border border-beige-200 flex items-center justify-center flex-shrink-0">
                            <CategoryIcon name={cat?.name} group={cat?.group} icon={cat?.icon} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-dark-green-900 truncate">
                                {exp.description}
                              </span>
                              <span className="text-[10px] font-semibold text-brown-800 bg-beige-100 px-1.5 py-0.2 rounded">
                                {cat?.name || 'Uncategorized'}
                              </span>
                            </div>
                            <span className="text-[10px] text-dark-grey-600 block">
                              {exp.date} &bull; Paid by {payer?.name || 'Member'}
                            </span>
                          </div>
                        </div>

                        <span className="text-xs font-black text-dark-green-900">
                          {formatCurrency(exp.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total Logged Summary Bar */}
              <div className="p-3.5 bg-beige-100/70 rounded-2xl flex items-center justify-between text-xs font-bold text-dark-green-900">
                <span>Total Logged This Week ({weekExpenses.length} items):</span>
                <span className="text-sm font-black">{formatCurrency(totalSpent)}</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: ROLLOVER & DEFICITS (REDESIGNED REVIEW & BALANCING)               */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="space-y-6">
              {/* TOP SECTION: GLOBAL TRANSFER POT CARD */}
              <div className="p-4 sm:p-5 bg-dark-green-900 text-white rounded-3xl shadow-md border border-dark-green-950 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-sage-300 shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-sage-200">
                          Global Transfer Pot
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/20 text-white">
                          Real-Time Pool
                        </span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white flex items-baseline gap-2">
                        <span>{formatCurrency(availableTransferPot)}</span>
                        <span className="text-xs font-medium text-sage-200">available to balance deficits or savings</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-[11px] font-bold text-sage-200">
                      +{formatCurrency(totalTransferPotGenerated)} transferred
                    </div>
                    {totalPotPulledForDeficits > 0 && (
                      <div className="px-2.5 py-1 rounded-xl bg-alert-red-600/30 border border-alert-red-300/40 text-[11px] font-bold text-alert-red-200">
                        -{formatCurrency(totalPotPulledForDeficits)} used for deficits
                      </div>
                    )}
                    {availableTransferPot > 0 && (
                      <div className="px-2.5 py-1 rounded-xl bg-sage-700/40 border border-sage-400/40 text-[11px] font-bold text-sage-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-sage-300" />
                        <span>+{formatCurrency(availableTransferPot)} routing to Savings</span>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-sage-100/90 leading-relaxed border-t border-white/10 pt-2.5">
                  Underspent envelope surpluses can be pooled into this Transfer Pot to absorb category overspends. Any remaining pot funds automatically expand your weekly Savings deposit!
                </p>
              </div>

              {/* REVIEW SECTION UI: SIDE-BY-SIDE (THIS WEEK vs FOLLOWING WEEKS) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-dark-grey-600">
                    Category Overview & Projection Matrix
                  </h4>
                  <span className="text-[11px] text-brown-700 font-semibold">
                    Dynamic updates in real-time
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* LEFT COLUMN: THIS WEEK (CURRENT CATEGORY PROGRESS) */}
                  <div className="bg-beige-50/60 border border-beige-200 rounded-3xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-beige-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-dark-green-800" />
                        <h5 className="text-xs font-black text-dark-green-950 uppercase tracking-wide">
                          This Week Progress
                        </h5>
                      </div>
                      <span className="text-[11px] font-bold text-brown-700">
                        Total Spent: {formatCurrency(totalSpent)}
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {/* Expense Categories */}
                      {categoryProjections.map((p) => {
                        const cat = p.category;
                        const spentPct = p.budget > 0 ? Math.min(100, Math.round((p.spent / p.budget) * 100)) : 0;
                        const uChoice = underspendChoices[cat.id] || 'transfer_pot';

                        return (
                          <div
                            key={cat.id}
                            className="bg-white border border-beige-200/90 rounded-2xl p-3 space-y-2 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-xl bg-beige-100 flex items-center justify-center shrink-0">
                                  <CategoryIcon name={cat.name} group={cat.group} icon={cat.icon} className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs font-extrabold text-dark-green-900 truncate">
                                  {cat.name}
                                </span>
                              </div>

                              <span className="text-xs font-black font-mono text-dark-green-900">
                                {formatCurrency(p.spent)}{' '}
                                <span className="text-[10px] text-dark-grey-600 font-normal">
                                  / {formatCurrency(p.budget)}
                                </span>
                              </span>
                            </div>

                            {/* Dynamic Segmented Progress Bar */}
                            <div className="space-y-1">
                              <div className="w-full h-3 bg-beige-200 rounded-full overflow-hidden flex border border-beige-300/40 relative">
                                {/* Base Spent Segment */}
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    p.isOverspent ? 'bg-alert-red-600' : 'bg-sage-600'
                                  }`}
                                  style={{ width: `${Math.min(100, spentPct)}%` }}
                                />

                                {/* Unused Leftover Segment */}
                                {p.isUnderspent && (
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      uChoice === 'transfer_pot'
                                        ? 'bg-dark-green-900'
                                        : 'bg-sky-blue-600'
                                    }`}
                                    style={{ width: `${100 - spentPct}%` }}
                                  />
                                )}
                              </div>

                              {/* Progress Sub-Labels */}
                              <div className="flex items-center justify-between text-[10px]">
                                {p.isUnderspent ? (
                                  <>
                                    <span className="text-sage-800 font-bold">
                                      {formatCurrency(p.leftover)} leftover
                                    </span>
                                    <span
                                      className={`font-black px-1.5 py-0.2 rounded text-[9px] ${
                                        uChoice === 'transfer_pot'
                                          ? 'bg-dark-green-900 text-white'
                                          : 'bg-sky-blue-100 text-sky-blue-900 border border-sky-blue-300'
                                      }`}
                                    >
                                      {uChoice === 'transfer_pot'
                                        ? `${formatCurrency(p.leftover)} transferred`
                                        : `${formatCurrency(p.leftover)} prorated`}
                                    </span>
                                  </>
                                ) : p.isOverspent ? (
                                  <>
                                    <span className="text-alert-red-600 font-bold">
                                      {formatCurrency(p.deficit)} overspent
                                    </span>
                                    <span className="text-alert-red-700 font-black bg-alert-red-100 px-1.5 py-0.2 rounded text-[9px]">
                                      Deficit active
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-dark-grey-600 font-bold">Exact on budget</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Savings Category Card (This Week) */}
                      <div className="bg-sage-50/70 border border-sage-200 rounded-2xl p-3 space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-xl bg-sage-200 text-dark-green-900 flex items-center justify-center shrink-0">
                              <PiggyBank className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-extrabold text-dark-green-950 block">
                                Savings Pot Deposit
                              </span>
                              <span className="text-[10px] text-sage-900 font-medium">
                                Target: {formatCurrency(thisWeekSavingsTarget)}
                                {thisWeekSavingsTarget !== baselineSavingsTarget && (
                                  <span className="ml-1 text-dark-green-800 font-bold">
                                    (Expanded from {formatCurrency(baselineSavingsTarget)} baseline)
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs font-black font-mono text-dark-green-950">
                              {formatCurrency(savingsSavedThisWeek)}{' '}
                              <span className="text-[10px] text-sage-900 font-normal">
                                / {formatCurrency(savingsBudgetThisWeek)}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold text-dark-green-800 block">
                              {savingsSavedThisWeek >= savingsBudgetThisWeek ? 'Target Achieved' : 'Deficit Active'}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar for Savings (Solid stepped color) */}
                        {(() => {
                          const savingsPct = savingsBudgetThisWeek > 0
                            ? Math.round((savingsSavedThisWeek / savingsBudgetThisWeek) * 100)
                            : 0;
                          return (
                            <div className={`w-full h-3 rounded-full overflow-hidden flex border ${
                              savingsPct >= 100
                                ? 'border-2 border-dark-green-800 ring-1 ring-dark-green-800/30 bg-beige-100'
                                : 'border-sage-300/80 bg-beige-100'
                            }`}>
                              <div
                                className={`h-full ${getSavingsProgressFillColor(savingsPct)} transition-all duration-300 rounded-full`}
                                style={{
                                  width: `${Math.min(100, savingsPct)}%`,
                                }}
                              />
                            </div>
                          );
                        })()}

                        {savingsExpandedBonus > 0 && (
                          <div className="text-[10px] text-dark-green-900 font-semibold flex items-center gap-1 bg-white/70 p-1.5 rounded-lg border border-sage-200/80">
                            <Sparkles className="w-3 h-3 text-sage-600 shrink-0" />
                            <span>
                              Expanded budget: <strong>+{formatCurrency(savingsExpandedBonus)}</strong> bonus from Transfer Pot
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN: AMOUNT BUDGETED FOR FOLLOWING WEEKS */}
                  <div className="bg-sage-50/50 border border-sage-200 rounded-3xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between border-b border-sage-200 pb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-sage-800" />
                        <h5 className="text-xs font-black text-dark-green-950 uppercase tracking-wide">
                          Amount Budgeted For Following Weeks
                        </h5>
                      </div>
                      <span className="text-[11px] font-bold text-sage-900">
                        Next {remainingWeeksInMonth} {remainingWeeksInMonth === 1 ? 'Week' : 'Weeks'}
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {/* Expense Categories Following Weeks */}
                      {categoryProjections.map((p) => {
                        const cat = p.category;
                        const isHigher = p.followingWeeksBudget > p.baseline;
                        const isLower = p.followingWeeksBudget < p.baseline;

                        return (
                          <div
                            key={`future-${cat.id}`}
                            className="bg-white border border-sage-200/80 rounded-2xl p-3 space-y-1.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-xl bg-sage-100 flex items-center justify-center shrink-0">
                                  <CategoryIcon name={cat.name} group={cat.group} icon={cat.icon} className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs font-extrabold text-dark-green-900 block truncate">
                                    {cat.name}
                                  </span>
                                  <span className="text-[10px] text-dark-grey-600">
                                    Baseline: {formatCurrency(p.baseline)}/wk
                                  </span>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-xs sm:text-sm font-black font-mono text-dark-green-900">
                                  {formatCurrency(p.followingWeeksBudget)}
                                  <span className="text-[10px] font-normal text-brown-700">/wk</span>
                                </div>
                                <span className="text-[10px] text-dark-grey-600 font-medium block">
                                  for next {remainingWeeksInMonth} {remainingWeeksInMonth === 1 ? 'week' : 'weeks'}
                                </span>
                              </div>
                            </div>

                            {/* Status Pill */}
                            <div className="pt-1 flex items-center justify-between text-[10px] border-t border-beige-100">
                              <span className="text-dark-grey-600 font-medium">Status:</span>
                              <span
                                className={`font-bold px-2 py-0.5 rounded-full ${
                                  isHigher
                                    ? 'bg-sage-100 text-sage-900 border border-sage-300'
                                    : isLower
                                    ? 'bg-alert-red-50 text-alert-red-700 border border-alert-red-200'
                                    : 'bg-beige-100 text-brown-800'
                                }`}
                              >
                                {p.statusLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Savings Category Following Weeks */}
                      <div className="bg-white border border-sage-200 rounded-2xl p-3 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-xl bg-sage-100 text-dark-green-900 flex items-center justify-center shrink-0">
                              <PiggyBank className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-extrabold text-dark-green-950 block">
                                Savings Target Projection
                              </span>
                              <span className="text-[10px] text-sage-900">
                                Global Baseline: {formatCurrency(baselineSavingsTarget)}/wk
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs sm:text-sm font-black font-mono text-dark-green-950">
                              {formatCurrency(Math.max(0, baselineSavingsTarget - futureSavingsReductionTotal))}
                              <span className="text-[10px] font-normal text-sage-900">/wk</span>
                            </div>
                            <span className="text-[10px] text-dark-green-800 font-medium block">
                              for next {remainingWeeksInMonth} {remainingWeeksInMonth === 1 ? 'week' : 'weeks'}
                            </span>
                          </div>
                        </div>

                        <div className="pt-1 flex items-center justify-between text-[10px] border-t border-sage-100">
                          <span className="text-sage-900 font-medium">Following Weeks Target:</span>
                          <span className="font-bold text-dark-green-900">
                            {futureSavingsReductionTotal > 0
                              ? `-${formatCurrency(futureSavingsReductionTotal)}/wk from deficit override`
                              : 'Baseline target maintained'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BUDGET BALANCING CHOICES (BOTTOM SECTION) */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-beige-200 pb-2">
                  <h4 className="text-sm font-black text-dark-green-950 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sage-700" />
                    Budget Balancing Choices
                  </h4>
                  <p className="text-xs text-brown-700">
                    Choose how leftover funds and overspent deficits are balanced across your Transfer Pot, Savings, and remaining weeks.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* 1. Underspent Categories List */}
                  {categoryPacings.filter((p) => p.isUnderspent).length > 0 && (
                    <div className="space-y-3">
                      <span className="text-[11px] font-black uppercase tracking-wider text-sage-900 bg-sage-100 px-2.5 py-1 rounded-full inline-block">
                        Underspent Categories ({categoryPacings.filter((p) => p.isUnderspent).length})
                      </span>

                      {categoryPacings
                        .filter((p) => p.isUnderspent)
                        .map((p) => {
                          const cat = p.category;
                          const currentChoice = underspendChoices[cat.id] || 'transfer_pot';

                          return (
                            <div
                              key={`under-${cat.id}`}
                              className="p-4 bg-white border border-beige-300 rounded-2xl shadow-xs space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-sage-100 flex items-center justify-center shrink-0">
                                    <CategoryIcon name={cat.name} group={cat.group} icon={cat.icon} className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-black text-dark-green-900">
                                      {cat.name}
                                    </h5>
                                    <span className="text-[11px] text-dark-grey-600">
                                      Spent {formatCurrency(p.spent)} of {formatCurrency(p.budget)} budget
                                    </span>
                                  </div>
                                </div>

                                <div className="px-3 py-1 bg-sage-100 border border-sage-300 rounded-xl text-xs font-black text-sage-900 self-start sm:self-auto">
                                  +{formatCurrency(p.leftover)} Leftover
                                </div>
                              </div>

                              {/* Interactive Choice Buttons */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                {/* Choice 1: Transfer Pot */}
                                <button
                                  type="button"
                                  onClick={() => handleUnderspendChoice(cat.id, 'transfer_pot')}
                                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                                    currentChoice === 'transfer_pot'
                                      ? 'bg-dark-green-900 text-white border-dark-green-950 shadow-xs'
                                      : 'bg-beige-50/50 hover:bg-beige-100 text-dark-green-900 border-beige-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-xs font-black flex items-center gap-1.5">
                                      <Layers className="w-3.5 h-3.5 text-sage-300" />
                                      Choice 1: Transfer Pot
                                    </span>
                                    <span
                                      className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                                        currentChoice === 'transfer_pot'
                                          ? 'bg-white/20 text-white'
                                          : 'bg-dark-green-100 text-dark-green-900'
                                      }`}
                                    >
                                      +{formatCurrency(p.leftover)}
                                    </span>
                                  </div>
                                  <p
                                    className={`text-[10px] leading-relaxed ${
                                      currentChoice === 'transfer_pot'
                                        ? 'text-sage-100'
                                        : 'text-dark-grey-600'
                                    }`}
                                  >
                                    Adds leftover into global Transfer Pot to cover deficits or expand Savings. Following weeks keep baseline ({formatCurrency(p.baseline)}/wk).
                                  </p>
                                </button>

                                {/* Choice 2: Prorate */}
                                <button
                                  type="button"
                                  onClick={() => handleUnderspendChoice(cat.id, 'prorate')}
                                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                                    currentChoice === 'prorate'
                                      ? 'bg-sky-blue-600 text-white border-sky-blue-700 shadow-xs'
                                      : 'bg-beige-50/50 hover:bg-beige-100 text-dark-green-900 border-beige-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-xs font-black flex items-center gap-1.5">
                                      <TrendingUp className="w-3.5 h-3.5 text-sky-blue-200" />
                                      Choice 2: Prorate
                                    </span>
                                    <span
                                      className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                                        currentChoice === 'prorate'
                                          ? 'bg-white/20 text-white'
                                          : 'bg-sky-blue-100 text-sky-blue-900'
                                      }`}
                                    >
                                      +{formatCurrency(Math.round(p.leftover / remainingWeeksInMonth))}/wk
                                    </span>
                                  </div>
                                  <p
                                    className={`text-[10px] leading-relaxed ${
                                      currentChoice === 'prorate' ? 'text-sky-blue-100' : 'text-dark-grey-600'
                                    }`}
                                  >
                                    Divides leftover across next {remainingWeeksInMonth} {remainingWeeksInMonth === 1 ? 'week' : 'weeks'}. Next week budget increases to {formatCurrency(p.baseline + Math.round(p.leftover / remainingWeeksInMonth))}/wk.
                                  </p>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* 2. Overspent Categories List */}
                  {categoryPacings.filter((p) => p.isOverspent).length > 0 && (
                    <div className="space-y-3">
                      <span className="text-[11px] font-black uppercase tracking-wider text-alert-red-800 bg-alert-red-100 px-2.5 py-1 rounded-full inline-block">
                        Overspent Categories ({categoryPacings.filter((p) => p.isOverspent).length})
                      </span>

                      {categoryPacings
                        .filter((p) => p.isOverspent)
                        .map((p) => {
                          const cat = p.category;
                          const inputState = overspendInputs[cat.id] || { potPull: 0, savingsPull: 0, overrideMode: 'none' };
                          const covered = (Number(inputState.potPull) || 0) + (Number(inputState.savingsPull) || 0);
                          const uncovered = Math.max(0, p.deficit - covered);
                          const monthlyCap = p.baseline * remainingWeeksInMonth;
                          const isOverMonthlyCap = uncovered > monthlyCap;

                          // Maximum available pot this category can pull without exceeding available transfer pot
                          const currentCatPotPull = Number(inputState.potPull) || 0;
                          const potAvailableForThisCat = availableTransferPot + currentCatPotPull;

                          return (
                            <div
                              key={`over-${cat.id}`}
                              className="p-4 bg-white border-2 border-alert-red-200 rounded-2xl shadow-xs space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-alert-red-100 pb-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-alert-red-100 text-alert-red-700 flex items-center justify-center shrink-0">
                                    <AlertCircle className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-black text-dark-green-900">
                                      {cat.name}
                                    </h5>
                                    <span className="text-[11px] text-dark-grey-600">
                                      Spent {formatCurrency(p.spent)} of {formatCurrency(p.budget)} budget
                                    </span>
                                  </div>
                                </div>

                                <div className="px-3 py-1 bg-alert-red-100 border border-alert-red-300 rounded-xl text-xs font-black text-alert-red-800 self-start sm:self-auto">
                                  -{formatCurrency(p.deficit)} Overspent
                                </div>
                              </div>

                              {/* Manual Funding Inputs */}
                              <div className="space-y-2">
                                <span className="text-[11px] font-bold text-dark-green-950 block">
                                  Cover Deficit from Transfer Pot or Savings:
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {/* Transfer Pot Input */}
                                  <div className="p-3 bg-beige-50/70 border border-beige-300 rounded-xl space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <label className="text-[10px] font-extrabold uppercase text-dark-grey-600">
                                        Pull from Transfer Pot ($)
                                      </label>
                                      <span className="text-[10px] text-dark-grey-600 font-bold">
                                        Max: {formatCurrency(potAvailableForThisCat)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min="0"
                                        max={Math.min(p.deficit, potAvailableForThisCat)}
                                        value={inputState.potPull || ''}
                                        disabled={potAvailableForThisCat <= 0}
                                        onChange={(e) =>
                                          handleOverspendPotPull(
                                            cat.id,
                                            parseFloat(e.target.value) || 0,
                                            Math.min(p.deficit, potAvailableForThisCat)
                                          )
                                        }
                                        placeholder="0.00"
                                        className="w-full px-3 py-1.5 bg-white border border-beige-300 rounded-lg text-xs font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800 disabled:opacity-50 disabled:bg-beige-100"
                                      />
                                      {potAvailableForThisCat > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleOverspendPotPull(
                                              cat.id,
                                              Math.min(p.deficit, potAvailableForThisCat),
                                              Math.min(p.deficit, potAvailableForThisCat)
                                            )
                                          }
                                          className="px-2 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-[10px] font-bold rounded-lg shrink-0"
                                        >
                                          Max
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Savings Input */}
                                  <div className="p-3 bg-beige-50/70 border border-beige-300 rounded-xl space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <label className="text-[10px] font-extrabold uppercase text-dark-grey-600">
                                        Pull from Current Savings ($)
                                      </label>
                                      <span className="text-[10px] text-dark-grey-600 font-bold">
                                        Max: {formatCurrency(thisWeekSavingsTarget)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min="0"
                                        max={Math.min(p.deficit - (Number(inputState.potPull) || 0), thisWeekSavingsTarget)}
                                        value={inputState.savingsPull || ''}
                                        onChange={(e) =>
                                          handleOverspendSavingsPull(
                                            cat.id,
                                            parseFloat(e.target.value) || 0,
                                            Math.min(p.deficit - (Number(inputState.potPull) || 0), thisWeekSavingsTarget)
                                          )
                                        }
                                        placeholder="0.00"
                                        className="w-full px-3 py-1.5 bg-white border border-beige-300 rounded-lg text-xs font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOverspendSavingsPull(
                                            cat.id,
                                            Math.min(p.deficit - (Number(inputState.potPull) || 0), thisWeekSavingsTarget),
                                            Math.min(p.deficit - (Number(inputState.potPull) || 0), thisWeekSavingsTarget)
                                          )
                                        }
                                        className="px-2 py-1.5 bg-sage-700 hover:bg-sage-800 text-white text-[10px] font-bold rounded-lg shrink-0"
                                      >
                                        Fill
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Deficit Resolution Status & Auto-Proration / Exception Logic */}
                              <div className="pt-1">
                                {uncovered === 0 ? (
                                  <div className="p-2.5 bg-sage-50 border border-sage-200 rounded-xl flex items-center gap-2 text-xs text-sage-900 font-bold">
                                    <CheckCircle2 className="w-4 h-4 text-sage-700 shrink-0" />
                                    <span>Deficit fully covered! Next weeks budget remains at {formatCurrency(p.baseline)}/wk.</span>
                                  </div>
                                ) : !isOverMonthlyCap ? (
                                  <div className="p-2.5 bg-gold-50 border border-gold-200 rounded-xl space-y-1 text-xs text-gold-950">
                                    <div className="flex items-center gap-1.5 font-black text-gold-900">
                                      <TrendingDown className="w-4 h-4 text-gold-700 shrink-0" />
                                      <span>Auto-Prorating Remaining Deficit (-{formatCurrency(uncovered)})</span>
                                    </div>
                                    <p className="text-[11px] text-gold-900/90 leading-relaxed">
                                      Reducing future weekly budgets by <strong>-{formatCurrency(Math.round(uncovered / remainingWeeksInMonth))}/wk</strong> across the remaining {remainingWeeksInMonth} {remainingWeeksInMonth === 1 ? 'week' : 'weeks'}. Next week budget: <strong>{formatCurrency(Math.max(0, p.baseline - Math.round(uncovered / remainingWeeksInMonth)))}/wk</strong>.
                                    </p>
                                  </div>
                                ) : (
                                  /* EXCEPTION RULE: Overspend exceeds total remaining monthly budget */
                                  <div className="p-3.5 bg-alert-red-50 border-2 border-alert-red-300 rounded-xl space-y-2.5 text-xs text-alert-red-950">
                                    <div className="flex items-center gap-2 font-black text-alert-red-900">
                                      <AlertTriangle className="w-4 h-4 text-alert-red-600 shrink-0" />
                                      <span>Standard Proration Strictly Disabled (Negative Future Budget Prevention)</span>
                                    </div>
                                    <p className="text-[11px] text-alert-red-900 leading-relaxed">
                                      The remaining uncovered overspend of <strong>{formatCurrency(uncovered)}</strong> exceeds the total remaining monthly budget for this category (<strong>{formatCurrency(monthlyCap)}</strong> across {remainingWeeksInMonth} weeks). You must allocate more from Transfer Pot / Savings above, or choose an override option below:
                                    </p>

                                    {/* Override Options */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOverspendOverrideMode(cat.id, 'accept_loss')}
                                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                          inputState.overrideMode === 'accept_loss'
                                            ? 'bg-alert-red-800 text-white border-alert-red-900 shadow-xs'
                                            : 'bg-white hover:bg-alert-red-100 text-alert-red-900 border-alert-red-200'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-0.5">
                                          <span className="text-[11px] font-black">
                                            1. Accept a Loss for the Week
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-alert-red-800 opacity-90 block">
                                          Sets future category budget to $0/wk and absorbs remaining deficit as a loss.
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOverspendOverrideMode(cat.id, 'pull_future_savings')}
                                        className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                                          inputState.overrideMode === 'pull_future_savings'
                                            ? 'bg-alert-red-800 text-white border-alert-red-900 shadow-xs'
                                            : 'bg-white hover:bg-alert-red-100 text-alert-red-900 border-alert-red-200'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between mb-0.5">
                                          <span className="text-[11px] font-black">
                                            2. Pull from Future Weeks' Savings
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-alert-red-800 opacity-90 block">
                                          Reduces future weekly savings budgets by -{formatCurrency(Math.round((uncovered - monthlyCap) / remainingWeeksInMonth))}/wk to balance math.
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* 3. On-Budget Categories */}
                  {categoryPacings.filter((p) => p.isExact).length > 0 && (
                    <div className="p-3 bg-beige-50/60 border border-beige-200 rounded-2xl flex items-center justify-between text-xs text-dark-green-900">
                      <span className="font-bold">
                        {categoryPacings.filter((p) => p.isExact).length} Categories Exactly on Budget:
                      </span>
                      <span className="text-dark-grey-600">
                        {categoryPacings
                          .filter((p) => p.isExact)
                          .map((p) => p.category.name)
                          .join(', ')}{' '}
                        (baseline budgets maintained)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SUMMARY & CONFIRM                                                 */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Savings Allocation Final Summary */}
              <div className="p-4 sm:p-5 bg-sage-50/70 border border-sage-300 rounded-3xl space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-dark-green-800 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-sage-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-dark-green-950">
                      Savings Allocation & Alignment Summary
                    </h4>
                    <span className="text-xs text-brown-700">
                      Final financial reconciliation for {selectedWeekRange.label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 bg-white rounded-2xl border border-beige-200 space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                      This Week Savings Target
                    </span>
                    <span className="text-base font-black text-dark-green-900">
                      {formatCurrency(thisWeekSavingsTarget)}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-2xl border border-beige-200 space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                      Transfer Pot Bonus
                    </span>
                    <span className="text-base font-black text-sage-800">
                      +{formatCurrency(savingsExpandedBonus)}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-2xl border border-beige-200 space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                      Total Week Spend
                    </span>
                    <span className="text-base font-black text-dark-green-900">
                      {formatCurrency(totalSpent)}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-2xl border border-sage-300 bg-sage-50/60 space-y-0.5">
                    <span className="text-[9px] uppercase font-bold text-dark-green-900 block">
                      Effective Saved This Week
                    </span>
                    <span className="text-base font-black text-dark-green-900">
                      {formatCurrency(savingsSavedThisWeek)}
                    </span>
                    <span className="text-[10px] text-sage-800 block">
                      out of {formatCurrency(savingsBudgetThisWeek)} total
                    </span>
                  </div>
                </div>

                <p className="text-xs text-dark-green-950 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-sage-200/80">
                  {savingsSavedThisWeek >= savingsBudgetThisWeek ? (
                    <span>
                      🎉 <strong>Savings Goal Secured:</strong> You have banked{' '}
                      <strong>{formatCurrency(savingsSavedThisWeek)}</strong> into your savings pot this week (including a {formatCurrency(savingsExpandedBonus)} transfer pot surplus expansion).
                    </span>
                  ) : (
                    <span>
                      ⚠️ <strong>Savings Adjusted:</strong> You deposited{' '}
                      <strong>{formatCurrency(savingsSavedThisWeek)}</strong> into savings after covering {formatCurrency(totalSavingsPulledForDeficits)} in category overspends.
                    </span>
                  )}
                </p>
              </div>

              {/* Following Weeks Category Budgets Table */}
              <div className="border border-beige-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="px-4 py-2.5 bg-beige-100/80 border-b border-beige-200 flex items-center justify-between text-xs font-extrabold text-dark-green-900">
                  <span>Category</span>
                  <div className="flex items-center gap-6">
                    <span className="w-20 text-right">This Week</span>
                    <span className="w-28 text-right text-dark-green-950">Following Weeks</span>
                  </div>
                </div>

                <div className="divide-y divide-beige-100 max-h-56 overflow-y-auto">
                  {decisions.map((dec) => (
                    <div
                      key={dec.categoryId}
                      className="px-4 py-2 flex items-center justify-between text-xs bg-white hover:bg-beige-50/40 transition"
                    >
                      <span className="font-medium text-dark-green-900">
                        {dec.categoryName}
                      </span>
                      <div className="flex items-center gap-6">
                        <span className="w-20 text-right text-dark-grey-600">
                          {formatCurrency(dec.previousWeeklyBudget)}
                        </span>
                        <span className="w-28 text-right font-black text-dark-green-900">
                          {formatCurrency(dec.newWeeklyBudget)}
                          {dec.newWeeklyBudget > dec.previousWeeklyBudget && (
                            <span className="text-[10px] text-sage-800 font-bold ml-1">
                              (+{dec.newWeeklyBudget - dec.previousWeeklyBudget})
                            </span>
                          )}
                          {dec.newWeeklyBudget < dec.previousWeeklyBudget && (
                            <span className="text-[10px] text-alert-red-600 font-bold ml-1">
                              (-{dec.previousWeeklyBudget - dec.newWeeklyBudget})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reflections & Intentions Textarea Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-dark-green-900 block">
                  Intentions & Reflections for Upcoming Weeks (Optional):
                </label>
                <textarea
                  value={intentionsNote}
                  onChange={(e) => setIntentionsNote(e.target.value)}
                  placeholder="e.g. Cook at home 5 nights this week; saving extra fun money for weekend birthday celebration..."
                  rows={2}
                  className="w-full p-3 bg-beige-50 border border-beige-300 rounded-xl text-xs text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                />
              </div>

              {isPreviewMode && (
                <div className="p-3.5 bg-gold-50 border border-gold-200 rounded-xl flex items-center gap-2.5 text-xs text-gold-900 font-medium">
                  <Clock className="w-4 h-4 text-gold-700 shrink-0" />
                  <span>
                    * Check-ins cannot be submitted until the last day of the week. You are in Preview Mode.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-beige-50/80 border-t border-beige-200 flex items-center justify-between shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-beige-300 hover:bg-beige-100 text-dark-green-900 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-brown-700 hover:text-dark-green-900 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-xs transition cursor-pointer"
            >
              <span>Continue</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleConfirmCheckIn}
                disabled={isSubmitting || isPreviewMode || hasUnresolvedExcessDeficit}
                className="flex items-center gap-2 px-6 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-sm transition active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span>Saving Check-In...</span>
                ) : isPreviewMode ? (
                  <span>Preview Mode (Submission Locked)</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      {isHistoricalWeek
                        ? 'Confirm & Record Historical Check-In'
                        : 'Confirm & Complete Check-In'}
                    </span>
                  </>
                )}
              </button>
              {isPreviewMode && (
                <span className="text-[11px] text-gold-800 font-semibold italic">
                  * Check-ins cannot be submitted until the last day of the week.
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
