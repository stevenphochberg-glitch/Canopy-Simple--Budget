import React, { useState, useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { Category, Expense } from '../../types';
import { formatCurrency } from '../../lib/calculations';
import { CategoryIcon } from '../Common/CategoryIcon';
import {
  calculateCheckInStatus,
  calculateCategoryDecisions,
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
  } = useHousehold();

  // Active step in the check-in wizard (1: Review expenses, 2: Rollovers/Deficits, 3: Confirm)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [userChoices, setUserChoices] = useState<Record<string, 'savings' | 'rollover'>>({});
  const [intentionsNote, setIntentionsNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [forceEarlyCheckIn, setForceEarlyCheckIn] = useState<boolean>(false);

  // Inline Expense Logging State (Dynamic inline render, no overlapping modal)
  const [showInlineLogExpense, setShowInlineLogExpense] = useState<boolean>(false);
  const [inlineAmount, setInlineAmount] = useState<string>('');
  const [inlineDescription, setInlineDescription] = useState<string>('');
  const [inlineCategoryId, setInlineCategoryId] = useState<string>('');
  const [inlineDate, setInlineDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [inlineLoggedBy, setInlineLoggedBy] = useState<string>(user?.userId || 'usr_self');
  const [isSavingInline, setIsSavingInline] = useState<boolean>(false);

  // Compute status info
  const statusInfo = useMemo(() => {
    return calculateCheckInStatus(household, checkIns, expenses);
  }, [household, checkIns, expenses]);

  const { activeWeekRange, remainingWeeksInMonth, isLastDayOfWeek, isPastDue, isFirstWeekGracePeriod } = statusInfo;

  // Filter expenses for this check-in week
  const weekExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      let expTime = exp.timestamp;
      if (!expTime && exp.date) expTime = new Date(exp.date).getTime();
      if (!expTime) return false;
      return (
        expTime >= activeWeekRange.startDate.getTime() &&
        expTime <= activeWeekRange.endDate.getTime()
      );
    });
  }, [expenses, activeWeekRange]);

  // Calculate pacing decisions for each category
  const {
    decisions,
    totalSaved,
    totalSurplus,
    totalDeficit,
    totalSpent,
    totalBudget,
  } = useMemo(() => {
    return calculateCategoryDecisions(
      categories,
      expenses,
      activeWeekRange,
      remainingWeeksInMonth,
      userChoices
    );
  }, [categories, expenses, activeWeekRange, remainingWeeksInMonth, userChoices]);

  if (!isOpen) return null;

  // If not yet check-in day and user hasn't chosen to proceed early
  const isTooEarly = !isLastDayOfWeek && !isPastDue && !forceEarlyCheckIn;
  const isPreviewMode = !isLastDayOfWeek && !isPastDue;

  const handleChoiceChange = (categoryId: string, choice: 'savings' | 'rollover') => {
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
        date: inlineDate || new Date().toISOString().split('T')[0],
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
        weekStartDate: activeWeekRange.startDate.toISOString().split('T')[0],
        weekEndDate: activeWeekRange.endDate.toISOString().split('T')[0],
        notes: intentionsNote.trim() || undefined,
        decisions,
        totalSaved,
        totalSpent,
        totalBudget,
      });
      onClose();
    } catch (err) {
      console.error('Failed to complete check-in:', err);
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
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-sage-800 bg-sage-100 px-2 py-0.5 rounded-full">
                  Weekly Alignment
                </span>
                <span className="text-xs text-dark-grey-600">
                  {activeWeekRange.label}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-dark-green-900 leading-tight">
                Household Weekly Check-In
              </h2>
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

              {isPastDue && (
                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md">
                  Past-Due Cycle
                </span>
              )}
              {isPreviewMode && !isPastDue && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  Preview Mode
                </span>
              )}
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
                  <div className="p-4 bg-beige-50 border border-beige-200 rounded-2xl space-y-1">
                    <h4 className="text-sm font-bold text-dark-green-900">
                      Behavioral Rollover & Deficit Resolution
                    </h4>
                    <p className="text-xs text-brown-700">
                      For underspent categories, choose between moving surplus to <strong>Savings</strong> (Recommended) or <strong>Prorating across remaining {remainingWeeksInMonth} weeks</strong> of this month. Overspent deficits are automatically absorbed across remaining weeks.
                    </p>
                  </div>

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
                                  <span>Budget: {formatCurrency(dec.budget)}</span>
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

                          {/* Decision Options for Underspent */}
                          {isUnderspent && (
                            <div className="pt-3 space-y-2">
                              <span className="text-[11px] font-extrabold text-dark-green-900 block">
                                Choose Surplus Strategy for {formatCurrency(dec.difference)}:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {/* Option 1: Move to Savings */}
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
                                      Move to Savings
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
                                    Bank +{formatCurrency(dec.difference)} directly into your savings pot. Next week budget stays at {formatCurrency(dec.previousWeeklyBudget)}/wk.
                                  </p>
                                </button>

                                {/* Option 2: Rollover / Prorate */}
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
                                      Rollover & Prorate
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
                                    Spread evenly across remaining {remainingWeeksInMonth} weeks of the month. Next week budget increases to {formatCurrency(dec.previousWeeklyBudget + Math.round(dec.difference / Math.max(1, remainingWeeksInMonth)))}/wk.
                                  </p>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Automatic Resolution for Overspent */}
                          {isOverspent && (
                            <div className="pt-2 text-xs space-y-1">
                              <div className="flex items-center justify-between text-dark-green-900">
                                <span className="text-[11px] font-bold text-red-700">
                                  Deficit Adjustment (Auto-absorbed across {remainingWeeksInMonth} {remainingWeeksInMonth === 1 ? 'week' : 'weeks'}):
                                </span>
                                <span className="font-extrabold text-red-700">
                                  -{formatCurrency(Math.round(Math.abs(dec.difference) / Math.max(1, remainingWeeksInMonth)))}/wk
                                </span>
                              </div>
                              <p className="text-[10px] text-brown-700 leading-relaxed">
                                To stay on track for the month, next week’s weekly budget is adjusted down to{' '}
                                <strong className="text-dark-green-900 font-extrabold">{formatCurrency(dec.newWeeklyBudget)}</strong>{' '}
                                (previously {formatCurrency(dec.previousWeeklyBudget)}).
                              </p>
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

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-3 bg-white rounded-xl border border-beige-200">
                        <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                          Total Saved to Pot
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
                      <div className="p-3 bg-white rounded-xl border border-beige-200 col-span-2 sm:col-span-1">
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
                        <span>Confirm & Complete Check-In</span>
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
