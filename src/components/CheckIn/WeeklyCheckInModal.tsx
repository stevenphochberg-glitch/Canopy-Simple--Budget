import React, { useState, useMemo, useEffect } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { Category, Expense, DateRange } from '../../types';
import { formatCurrency, getWeekRange, isExpenseInDateRange, formatLocalDate, getTodayLocalDateString } from '../../lib/calculations';
import { CategoryIcon } from '../Common/CategoryIcon';
import {
  calculateCheckInStatus,
  calculateCategoryDecisions,
  getRemainingWeeksInMonth,
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
  Shield,
  Receipt,
  Sparkles,
  Calendar,
  Layers,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface WeeklyCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  const [userChoices, setUserChoices] = useState<
    Record<string, 'savings' | 'rollover' | 'deduct_savings' | 'reduce_future'>
  >({});
  const [intentionsNote, setIntentionsNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [forceEarlyCheckIn, setForceEarlyCheckIn] = useState<boolean>(false);

  // Inline Expense Logging State (Dynamic inline render, no overlapping modal)
  const [showInlineLogExpense, setShowInlineLogExpense] = useState<boolean>(false);
  const [inlineAmount, setInlineAmount] = useState<string>('');
  const [inlineDescription, setInlineDescription] = useState<string>('');
  const [inlineCategoryId, setInlineCategoryId] = useState<string>('');
  const [inlineDate, setInlineDate] = useState<string>(getTodayLocalDateString());
  const [inlineLoggedBy, setInlineLoggedBy] = useState<string>(user?.userId || 'usr_self');
  const [isSavingInline, setIsSavingInline] = useState<boolean>(false);

  // Compute status info for current week
  const statusInfo = useMemo(() => {
    return calculateCheckInStatus(household, checkIns, expenses);
  }, [household, checkIns, expenses]);

  // Selected week range for check-in: allows historical navigation
  const [selectedWeekRange, setSelectedWeekRange] = useState<DateRange>(() => {
    if (timeframeMode === 'week' && timeframeOffset < 0) {
      return activeDateRange;
    }
    return statusInfo.activeWeekRange;
  });

  // Whenever modal opens or activeDateRange changes, sync selectedWeekRange
  useEffect(() => {
    if (isOpen) {
      if (timeframeMode === 'week' && timeframeOffset < 0) {
        setSelectedWeekRange(activeDateRange);
      } else {
        setSelectedWeekRange(statusInfo.activeWeekRange);
      }
      setStep(1);
      setForceEarlyCheckIn(false);
    }
  }, [isOpen, timeframeMode, timeframeOffset, activeDateRange, statusInfo.activeWeekRange]);

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

  // If this is a historical week, it has already passed!
  // Therefore it is NEVER "too early" to check in, and is NEVER restricted to preview mode!
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
      return getRemainingWeeksInMonth(selectedWeekRange.endDate);
    }
    return statusInfo.remainingWeeksInMonth;
  }, [isHistoricalWeek, selectedWeekRange.endDate, statusInfo.remainingWeeksInMonth]);

  const remainingWeeksInMonth = targetRemainingWeeks;
  const { isPastDue, isLastDayOfWeek, isFirstWeekGracePeriod } = statusInfo;

  // Calculate pacing decisions for each category with Savings Goal priority gating and Bills isolation
  const {
    decisions,
    baselineSavingsGoal,
    effectiveSavingsGoal,
    isSavingsGoalMet,
    totalSaved,
    totalSurplus,
    totalDeficit,
    totalSpent,
    totalBudget,
    totalSavingsDeducted,
    billsTotalBudget,
    billsTotalSpent,
  } = useMemo(() => {
    return calculateCategoryDecisions(
      categories,
      expenses,
      selectedWeekRange,
      targetRemainingWeeks,
      userChoices,
      household
    );
  }, [categories, expenses, selectedWeekRange, targetRemainingWeeks, userChoices, household]);

  if (!isOpen) return null;

  const handleChoiceChange = (
    categoryId: string,
    choice: 'savings' | 'rollover' | 'deduct_savings' | 'reduce_future'
  ) => {
    setUserChoices((prev) => ({
      ...prev,
      [categoryId]: choice,
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
      // Reset inline form
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
    setIsSubmitting(true);
    try {
      await completeWeeklyCheckIn({
        weekStartDate: formatLocalDate(selectedWeekRange.startDate),
        weekEndDate: formatLocalDate(selectedWeekRange.endDate),
        notes: intentionsNote.trim() || undefined,
        decisions,
        totalSaved,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-beige-200 rounded-3xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-beige-50 to-sage-50 border-b border-beige-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-dark-green-800 text-white flex items-center justify-center shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-sage-800 bg-sage-100 px-2 py-0.5 rounded-full">
                  {isHistoricalWeek ? 'Historical Check-In' : 'Weekly Alignment'}
                </span>
                {/* Week switcher controls */}
                <div className="flex items-center gap-1 bg-white/90 border border-beige-300 rounded-xl px-1.5 py-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => navigateModalWeek(-1)}
                    title="Previous week"
                    className="p-0.5 hover:bg-beige-100 rounded text-dark-green-900 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-extrabold text-dark-green-950 px-1 whitespace-nowrap">
                    {selectedWeekRange.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateModalWeek(1)}
                    title="Next week"
                    className="p-0.5 hover:bg-beige-100 rounded text-dark-green-900 transition cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-dark-green-900 leading-tight">
                {isHistoricalWeek ? 'Historical Weekly Check-In' : 'Household Weekly Check-In'}
              </h2>
              {existingCheckInForWeek && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Check-in completed for this week (${formatCurrency(existingCheckInForWeek.totalSaved)} saved). Submitting will reconcile and update it.
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-brown-700 hover:text-dark-green-900 hover:bg-beige-200 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational screen if too early in the week */}
        {isTooEarly ? (
          <div className="p-6 sm:p-8 space-y-6 overflow-y-auto">
            <div className="bg-gradient-to-br from-sage-50 to-beige-50 border border-sage-200 rounded-3xl p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto bg-sage-100 text-dark-green-800 rounded-2xl flex items-center justify-center">
                <Calendar className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-xl font-black text-dark-green-900">
                  Check-In Unlocks on {statusInfo.checkInDayName}
                </h3>
                <p className="text-xs text-brown-700 leading-relaxed">
                  Your household check-in is scheduled for every{' '}
                  <strong className="text-dark-green-900 font-bold">{statusInfo.checkInDayName}</strong>{' '}
                  ({statusInfo.daysUntilCheckIn} {statusInfo.daysUntilCheckIn === 1 ? 'day' : 'days'} away).
                  This gives you time to finish the week’s spending before calculating rollovers and surplus savings.
                </p>
              </div>

              {/* Current pacing preview */}
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto pt-2">
                <div className="p-3 bg-white border border-beige-200 rounded-2xl text-left">
                  <span className="text-[10px] uppercase font-bold text-dark-grey-600 block">
                    Spent So Far
                  </span>
                  <span className="text-base font-black text-dark-green-900">
                    {formatCurrency(totalSpent)}
                  </span>
                  <span className="text-[10px] text-brown-700 block">
                    {weekExpenses.length} transactions
                  </span>
                </div>
                <div className="p-3 bg-white border border-beige-200 rounded-2xl text-left">
                  <span className="text-[10px] uppercase font-bold text-dark-grey-600 block">
                    Weekly Budget
                  </span>
                  <span className="text-base font-black text-dark-green-900">
                    {formatCurrency(totalBudget)}
                  </span>
                  <span className="text-[10px] text-sage-800 font-bold block">
                    {totalBudget - totalSpent >= 0 ? `${formatCurrency(totalBudget - totalSpent)} remaining` : `${formatCurrency(Math.abs(totalBudget - totalSpent))} over`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs font-bold rounded-2xl transition cursor-pointer"
              >
                Wait for {statusInfo.checkInDayName}
              </button>

              <button
                type="button"
                onClick={() => setForceEarlyCheckIn(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-2xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Preview & Check In Early</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Step Wizard Stepper */}
            <div className="px-6 py-3 bg-beige-50/70 border-b border-beige-200 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep(1)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                    step === 1
                      ? 'bg-dark-green-800 text-white'
                      : 'text-dark-grey-600 hover:bg-beige-200'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center">
                    1
                  </span>
                  <span>1. Review Transactions ({weekExpenses.length})</span>
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-brown-700" />

                <button
                  onClick={() => setStep(2)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                    step === 2
                      ? 'bg-dark-green-800 text-white'
                      : 'text-dark-grey-600 hover:bg-beige-200'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center">
                    2
                  </span>
                  <span>2. Rollover & Deficits</span>
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-brown-700" />

                <button
                  onClick={() => setStep(3)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold transition cursor-pointer ${
                    step === 3
                      ? 'bg-dark-green-800 text-white'
                      : 'text-dark-grey-600 hover:bg-beige-200'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center">
                    3
                  </span>
                  <span>3. Summary & Confirm</span>
                </button>
              </div>

              {isHistoricalWeek ? (
                <span className="text-[10px] font-bold text-dark-green-900 bg-sage-200 px-2.5 py-0.5 rounded-full">
                  Historical Week
                </span>
              ) : isPastDue ? (
                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md">
                  Past-Due Cycle
                </span>
              ) : isPreviewMode ? (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  Preview Mode
                </span>
              ) : null}
            </div>

            {/* Modal Body Container */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 max-h-[80vh]">
              {/* STEP 1: REVIEW TRANSACTIONS */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="p-4 bg-sage-50/80 border border-sage-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-dark-green-900">
                        Household Accountability Review
                      </h4>
                      <p className="text-xs text-brown-700">
                        Review all expenses logged this week. Confirm that neither partner missed any receipts.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowInlineLogExpense((prev) => !prev)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        showInlineLogExpense
                          ? 'bg-dark-green-800 text-white shadow-xs'
                          : 'bg-white border border-beige-300 hover:bg-sage-100 text-dark-green-900'
                      }`}
                    >
                      {showInlineLogExpense ? (
                        <>
                          <X className="w-3.5 h-3.5" />
                          <span>Close Logger</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Log Missing Item</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Dynamic Inline Expense Logger */}
                  {showInlineLogExpense && (
                    <div className="p-4 sm:p-5 bg-white border-2 border-dark-green-700/40 rounded-2xl shadow-sm space-y-4 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between border-b border-beige-200 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-dark-green-800 text-white flex items-center justify-center">
                            <Plus className="w-4 h-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-extrabold text-dark-green-900">
                              Add Missing Expense Inline
                            </h5>
                            <span className="text-[10px] text-brown-700">
                              Saves directly to your household week ledger
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowInlineLogExpense(false)}
                          className="text-brown-700 hover:text-dark-green-900 p-1 rounded-lg hover:bg-beige-100 transition cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Amount */}
                        <div className="sm:col-span-4 space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                            Amount ($) *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-sm font-bold text-dark-green-900">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={inlineAmount}
                              onChange={(e) => setInlineAmount(e.target.value)}
                              className="w-full pl-7 pr-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-sm font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white"
                              autoFocus
                            />
                          </div>
                          <div className="flex gap-1 pt-1">
                            {[10, 25, 50, 100].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setInlineAmount(preset.toString())}
                                className="px-2 py-0.5 rounded-md bg-beige-100 hover:bg-sage-100 text-[10px] font-bold text-dark-green-900 transition cursor-pointer"
                              >
                                +${preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Description */}
                        <div className="sm:col-span-8 space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                            Merchant / Description *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Trader Joe's, Shell Gas, Pharmacy"
                            value={inlineDescription}
                            onChange={(e) => setInlineDescription(e.target.value)}
                            className="w-full px-3.5 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs sm:text-sm font-medium text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Category Dropdown (Strict text, no colorful emojis) */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                            Category *
                          </label>
                          <select
                            value={inlineCategoryId || categories[0]?.id || ''}
                            onChange={(e) => setInlineCategoryId(e.target.value)}
                            className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                          >
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name} ({formatCurrency(cat.currentWeeklyBudget)}/wk)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Date */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                            Date
                          </label>
                          <input
                            type="date"
                            value={inlineDate}
                            onChange={(e) => setInlineDate(e.target.value)}
                            className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                          />
                        </div>

                        {/* Paid By */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                            Paid By
                          </label>
                          <select
                            value={inlineLoggedBy}
                            onChange={(e) => setInlineLoggedBy(e.target.value)}
                            className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                          >
                            {members.map((m) => (
                              <option key={m.userId} value={m.userId}>
                                {m.name} {m.userId === user?.userId ? '(You)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-beige-100">
                        <button
                          type="button"
                          onClick={() => setShowInlineLogExpense(false)}
                          className="px-3.5 py-1.5 text-brown-700 hover:text-dark-green-900 text-xs font-bold transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveInlineExpense}
                          disabled={isSavingInline}
                          className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isSavingInline ? (
                            <span>Adding to Week...</span>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Expense to Week</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

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
                    <div className="border border-beige-200 rounded-2xl overflow-hidden divide-y divide-beige-100">
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

                  {/* Summary bar for Step 1 */}
                  <div className="p-3.5 bg-beige-100/70 rounded-2xl flex items-center justify-between text-xs font-bold text-dark-green-900">
                    <span>Total Logged This Week ({weekExpenses.length} items):</span>
                    <span className="text-sm font-black">{formatCurrency(totalSpent)}</span>
                  </div>
                </div>
              )}

              {/* STEP 2: CATEGORY PACING & ROLLOVER / DEFICIT RESOLUTION */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* SAVINGS PRIORITY GATE HEADER */}
                  <div
                    className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                      isSavingsGoalMet
                        ? 'bg-gradient-to-br from-sage-50 to-beige-50 border-sage-200'
                        : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isSavingsGoalMet
                              ? 'bg-sage-200 text-dark-green-900'
                              : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          <PiggyBank className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-dark-green-900">
                            Savings Priority Gate
                          </h4>
                          <span className="text-[11px] text-dark-grey-600">
                            Baseline Weekly Savings Target:{' '}
                            <strong className="text-dark-green-900">{formatCurrency(baselineSavingsGoal)}</strong>
                          </span>
                        </div>
                      </div>

                      <div>
                        {isSavingsGoalMet ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-sage-900 bg-sage-200/90 px-2.5 py-1 rounded-full">
                            <Check className="w-3.5 h-3.5 text-sage-700" />
                            <span>Goal Met ({formatCurrency(effectiveSavingsGoal)})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-900 bg-amber-200/90 px-2.5 py-1 rounded-full">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            <span>Deficit Active ({formatCurrency(effectiveSavingsGoal)})</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {!isSavingsGoalMet ? (
                      <p className="text-xs text-amber-950 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-amber-200/70">
                        <strong>Savings Priority Active:</strong> Because your weekly savings target has not been met (or was reduced to cover deficits), category proration is restricted. Any underspent surplus will automatically fill your savings goal deficit first.
                      </p>
                    ) : (
                      <p className="text-xs text-dark-green-950 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-sage-200/70">
                        <strong>Savings Target Achieved:</strong> Your weekly savings goal of {formatCurrency(baselineSavingsGoal)} is fully secured. You may choose to boost savings further or prorate surplus across remaining weeks of the month.
                      </p>
                    )}
                  </div>

                  {/* Active Categories List (Essentials & Fun Money) */}
                  <div className="space-y-3">
                    {decisions.map((dec) => {
                      const cat = categories.find((c) => c.id === dec.categoryId);
                      const isUnderspent = dec.difference > 0;
                      const isOverspent = dec.difference < 0;
                      const isExact = dec.difference === 0;

                      return (
                        <div
                          key={dec.categoryId}
                          className={`p-4 rounded-2xl border transition-all ${
                            isUnderspent
                              ? 'bg-sage-50/40 border-sage-200'
                              : isOverspent
                              ? 'bg-red-50/40 border-red-200'
                              : 'bg-white border-beige-200'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-beige-200/80 pb-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-beige-100 border border-beige-200 flex items-center justify-center flex-shrink-0">
                                <CategoryIcon name={cat?.name || dec.categoryName} group={cat?.group} icon={cat?.icon} className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-dark-green-900">
                                  {dec.categoryName}
                                </span>
                                <div className="flex items-center gap-2 text-[10px] text-dark-grey-600">
                                  <span>
                                    {dec.isOverridden && dec.baselineBudget && dec.baselineBudget !== dec.budget
                                      ? `Weekly Budget: ${formatCurrency(dec.budget)} (Baseline: ${formatCurrency(dec.baselineBudget)})`
                                      : `Weekly Budget: ${formatCurrency(dec.budget)}`}
                                  </span>
                                  <span>&bull;</span>
                                  <span>Spent: {formatCurrency(dec.spent)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Difference Status Badge */}
                            <div>
                              {isUnderspent && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-sage-900 bg-sage-200/80 px-2.5 py-0.5 rounded-full">
                                  <TrendingDown className="w-3 h-3 text-sage-700" />
                                  <span>+ {formatCurrency(dec.difference)} Surplus</span>
                                </span>
                              )}
                              {isOverspent && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full">
                                  <TrendingUp className="w-3 h-3 text-red-600" />
                                  <span>- {formatCurrency(Math.abs(dec.difference))} Deficit</span>
                                </span>
                              )}
                              {isExact && (
                                <span className="text-[11px] font-bold text-dark-grey-600 bg-beige-100 px-2.5 py-0.5 rounded-full">
                                  Exact On Budget ($0)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Visual Check-in Split Progress Bar */}
                          <div className="py-2 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold">
                              <span className="text-dark-grey-600">Progress Breakdown</span>
                              <span className="text-dark-green-900">
                                {Math.round((dec.spent / Math.max(1, dec.budget)) * 100)}% of {formatCurrency(dec.budget)}
                              </span>
                            </div>
                            <div className="h-4 w-full bg-beige-200 rounded-lg overflow-hidden flex relative">
                              {/* Spent Portion */}
                              <div
                                className={`h-full transition-all flex items-center justify-center text-[9px] font-black text-white ${
                                  isOverspent ? 'bg-red-600 w-full' : 'bg-sage-600'
                                }`}
                                style={{
                                  width: isOverspent ? '100%' : `${Math.min(100, Math.max(5, (dec.spent / Math.max(1, dec.budget)) * 100))}%`,
                                }}
                              >
                                {dec.spent > 0 && <span className="px-1 truncate">{formatCurrency(dec.spent)}</span>}
                              </div>

                              {/* Surplus Portion with Decision Treatment */}
                              {isUnderspent && (
                                <div
                                  className={`h-full transition-all flex items-center justify-center text-[9px] font-black text-white ${
                                    dec.isProrationDisabled
                                      ? 'bg-amber-600'
                                      : (userChoices[dec.categoryId] || 'savings') === 'rollover'
                                      ? 'bg-blue-600'
                                      : 'bg-dark-green-900'
                                  }`}
                                  style={{
                                    width: `${Math.max(0, 100 - (dec.spent / Math.max(1, dec.budget)) * 100)}%`,
                                  }}
                                >
                                  <span className="px-1 truncate">
                                    {dec.isProrationDisabled
                                      ? `Deficit Fill (+${formatCurrency(dec.difference)})`
                                      : (userChoices[dec.categoryId] || 'savings') === 'rollover'
                                      ? `Prorated (+${formatCurrency(dec.difference)})`
                                      : `Boosted Savings (+${formatCurrency(dec.difference)})`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Decision Options for Underspent */}
                          {isUnderspent && (
                            <div className="pt-2.5 space-y-2">
                              {dec.isProrationDisabled ? (
                                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                                    <PiggyBank className="w-4 h-4 text-amber-700" />
                                    <span>Savings Priority: Routed to Fill Savings Deficit</span>
                                  </div>
                                  <p className="text-[11px] text-amber-900 leading-relaxed">
                                    Because the baseline Weekly Savings Goal is currently below target, this +{formatCurrency(dec.difference)} surplus is automatically directed to replenish your Savings Goal. Next week’s budget remains at {formatCurrency(dec.previousWeeklyBudget)}/wk.
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <span className="text-[11px] font-extrabold text-dark-green-900 block">
                                    Choose Surplus Strategy for +{formatCurrency(dec.difference)}:
                                  </span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {/* Option A: Boost Current Savings */}
                                    <button
                                      type="button"
                                      onClick={() => handleChoiceChange(dec.categoryId, 'savings')}
                                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                        (userChoices[dec.categoryId] || 'savings') === 'savings'
                                          ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-xs'
                                          : 'bg-white hover:bg-beige-100 text-dark-green-900 border-beige-300'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-black flex items-center gap-1.5">
                                          <PiggyBank className="w-4 h-4" />
                                          Boost Savings (Option A)
                                        </span>
                                        <span
                                          className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                            (userChoices[dec.categoryId] || 'savings') === 'savings'
                                              ? 'bg-white/20 text-white'
                                              : 'bg-sage-100 text-sage-800'
                                          }`}
                                        >
                                          Recommended
                                        </span>
                                      </div>
                                      <p
                                        className={`text-[10px] mt-1 ${
                                          (userChoices[dec.categoryId] || 'savings') === 'savings'
                                            ? 'text-sage-100'
                                            : 'text-dark-grey-600'
                                        }`}
                                      >
                                        Bank +{formatCurrency(dec.difference)} directly into savings pot. Next week budget stays at baseline ({formatCurrency(dec.previousWeeklyBudget)}/wk).
                                      </p>
                                    </button>

                                    {/* Option B: Rollover & Prorate */}
                                    <button
                                      type="button"
                                      onClick={() => handleChoiceChange(dec.categoryId, 'rollover')}
                                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                        userChoices[dec.categoryId] === 'rollover'
                                          ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-xs'
                                          : 'bg-white hover:bg-beige-100 text-dark-green-900 border-beige-300'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-black flex items-center gap-1.5">
                                          <TrendingUp className="w-4 h-4" />
                                          Prorate Budget (Option B)
                                        </span>
                                        <span
                                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                            userChoices[dec.categoryId] === 'rollover'
                                              ? 'bg-white/20 text-white'
                                              : 'bg-beige-200 text-brown-800'
                                          }`}
                                        >
                                          +{formatCurrency(Math.round(dec.difference / Math.max(1, remainingWeeksInMonth)))}/wk
                                        </span>
                                      </div>
                                      <p
                                        className={`text-[10px] mt-1 ${
                                          userChoices[dec.categoryId] === 'rollover'
                                            ? 'text-sage-100'
                                            : 'text-dark-grey-600'
                                        }`}
                                      >
                                        Distribute +{formatCurrency(dec.difference)} evenly across remaining {remainingWeeksInMonth} weeks. Next week budget becomes {formatCurrency(dec.newWeeklyBudget)}/wk.
                                      </p>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Resolution Options for Overspent */}
                          {isOverspent && (
                            <div className="pt-2.5 space-y-2">
                              <span className="text-[11px] font-extrabold text-red-900 block">
                                Choose Deficit Resolution for -{formatCurrency(Math.abs(dec.difference))}:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {/* Option A: Deduct from Savings */}
                                <button
                                  type="button"
                                  onClick={() => handleChoiceChange(dec.categoryId, 'deduct_savings')}
                                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                    (userChoices[dec.categoryId] || 'deduct_savings') === 'deduct_savings'
                                      ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-xs'
                                      : 'bg-white hover:bg-beige-100 text-dark-green-900 border-beige-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black flex items-center gap-1.5">
                                      <PiggyBank className="w-4 h-4" />
                                      Deduct from Savings Goal
                                    </span>
                                  </div>
                                  <p
                                    className={`text-[10px] mt-1 ${
                                      (userChoices[dec.categoryId] || 'deduct_savings') === 'deduct_savings'
                                        ? 'text-sage-100'
                                        : 'text-dark-grey-600'
                                    }`}
                                  >
                                    Cover overage from this week’s savings pot. Next week budget stays protected at {formatCurrency(dec.previousWeeklyBudget)}/wk.
                                  </p>
                                </button>

                                {/* Option B: Reduce Future Weeks */}
                                <button
                                  type="button"
                                  onClick={() => handleChoiceChange(dec.categoryId, 'reduce_future')}
                                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                    userChoices[dec.categoryId] === 'reduce_future'
                                      ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-xs'
                                      : 'bg-white hover:bg-beige-100 text-dark-green-900 border-beige-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black flex items-center gap-1.5">
                                      <TrendingDown className="w-4 h-4" />
                                      Reduce Future Weeks
                                    </span>
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                        userChoices[dec.categoryId] === 'reduce_future'
                                          ? 'bg-white/20 text-white'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      -{formatCurrency(Math.round(Math.abs(dec.difference) / Math.max(1, remainingWeeksInMonth)))}/wk
                                    </span>
                                  </div>
                                  <p
                                    className={`text-[10px] mt-1 ${
                                      userChoices[dec.categoryId] === 'reduce_future'
                                        ? 'text-sage-100'
                                        : 'text-dark-grey-600'
                                    }`}
                                  >
                                    Absorb deficit evenly across remaining {remainingWeeksInMonth} weeks. Next week budget drops to {formatCurrency(dec.newWeeklyBudget)}/wk.
                                  </p>
                                </button>
                              </div>

                              {/* Forced Fallback Warning if Savings Depleted */}
                              {dec.forcedFallbackApplied && (
                                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900">
                                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                                  <span>
                                    <strong>Savings Depleted:</strong> Available weekly savings reached $0. The remaining deficit of {formatCurrency(Math.abs(dec.difference) - (dec.savingsDeduction || 0))} was automatically reduced across future weekly budgets.
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: SUMMARY & CONFIRMATION */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="p-4 bg-gradient-to-br from-sage-50 to-beige-50 border border-sage-200 rounded-2xl space-y-2">
                    <h4 className="text-sm font-black text-dark-green-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sage-700" />
                      Check-In Summary & Next Week Budgets
                    </h4>
                    <p className="text-xs text-brown-700">
                      Confirm your new category budgets for the coming week and record any notes or intentions.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="p-3 bg-white rounded-xl border border-beige-200">
                        <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                          Savings Baseline
                        </span>
                        <span className="text-base font-black text-dark-green-900">
                          {formatCurrency(baselineSavingsGoal)}
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-beige-200">
                        <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                          Effective Saved
                        </span>
                        <span className="text-base font-black text-sage-800">
                          +{formatCurrency(totalSaved)}
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-beige-200">
                        <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                          Total Week Spend
                        </span>
                        <span className="text-base font-black text-dark-green-900">
                          {formatCurrency(totalSpent)}
                        </span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-beige-200">
                        <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                          Net Month Pace
                        </span>
                        <span
                          className={`text-base font-black ${
                            totalSurplus >= totalDeficit ? 'text-sage-800' : 'text-red-600'
                          }`}
                        >
                          {totalSurplus >= totalDeficit
                            ? `+${formatCurrency(totalSurplus - totalDeficit)} safe`
                            : `-${formatCurrency(totalDeficit - totalSurplus)} deficit`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* New Budgets Comparison Table */}
                  <div className="border border-beige-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-beige-100/80 border-b border-beige-200 flex items-center justify-between text-xs font-extrabold text-dark-green-900">
                      <span>Category</span>
                      <div className="flex items-center gap-6">
                        <span className="w-20 text-right">Last Week</span>
                        <span className="w-24 text-right text-dark-green-900">New Budget</span>
                      </div>
                    </div>

                    <div className="divide-y divide-beige-100 max-h-56 overflow-y-auto">
                      {decisions.map((dec) => (
                        <div
                          key={dec.categoryId}
                          className="px-4 py-2 flex items-center justify-between text-xs bg-white"
                        >
                          <span className="font-medium text-dark-green-900">
                            {dec.categoryName}
                          </span>
                          <div className="flex items-center gap-6">
                            <span className="w-20 text-right text-dark-grey-600">
                              {formatCurrency(dec.previousWeeklyBudget)}
                            </span>
                            <span className="w-24 text-right font-black text-dark-green-900">
                              {formatCurrency(dec.newWeeklyBudget)}
                              {dec.newWeeklyBudget > dec.previousWeeklyBudget && (
                                <span className="text-[10px] text-sage-800 font-bold ml-1">
                                  (+{dec.newWeeklyBudget - dec.previousWeeklyBudget})
                                </span>
                              )}
                              {dec.newWeeklyBudget < dec.previousWeeklyBudget && (
                                <span className="text-[10px] text-red-600 font-bold ml-1">
                                  (-{dec.previousWeeklyBudget - dec.newWeeklyBudget})
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Partner / Intentions Note */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-dark-green-900 block">
                      Intentions & Reflections for Upcoming Week (Optional):
                    </label>
                    <textarea
                      value={intentionsNote}
                      onChange={(e) => setIntentionsNote(e.target.value)}
                      placeholder="e.g. Planning to cook dinner 5 nights; saving fun money for weekend concert tickets..."
                      rows={2}
                      className="w-full p-3 bg-beige-50 border border-beige-300 rounded-xl text-xs text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                    />
                  </div>

                  {isPreviewMode && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-xs text-amber-900 font-medium">
                      <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        * Check-ins can not be submitted until the last day of the week.
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
                    disabled={isSubmitting || isPreviewMode}
                    className="flex items-center gap-2 px-6 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-sm transition active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span>Saving Check-In...</span>
                    ) : isPreviewMode ? (
                      <span>Preview Mode (Submission Locked)</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{isHistoricalWeek ? 'Confirm & Record Historical Check-In' : 'Confirm & Complete Check-In'}</span>
                      </>
                    )}
                  </button>
                  {isPreviewMode && (
                    <span className="text-[11px] text-amber-800 font-semibold italic">
                      * Check-ins can not be submitted until the last day of the week.
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
