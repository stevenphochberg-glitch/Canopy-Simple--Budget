import React, { useState, useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { formatCurrency, getMonthRange, calculateCategorySpending } from '../../lib/calculations';
import { getFiscalMonthForDate } from '../../lib/fiscal445';
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
} from 'lucide-react';

interface MonthlyRetrospectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MonthlyRetrospectiveModal: React.FC<MonthlyRetrospectiveModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { household, categories, expenses, members, user, checkIns, executeMonthEndResetAction, showToast } =
    useHousehold();

  const [intentionsText, setIntentionsText] = useState<string>('');
  const [reflectionNote, setReflectionNote] = useState<string>('');
  const [isExecutingReset, setIsExecutingReset] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isSwept, setIsSwept] = useState<boolean>(false);
  const [isBillsSurplusTransferred, setIsBillsSurplusTransferred] = useState<boolean>(false);
  const [isBillsDeficitDeducted, setIsBillsDeficitDeducted] = useState<boolean>(false);

  // Month range
  const monthRange = useMemo(() => {
    return getMonthRange(new Date(), 0);
  }, []);

  // Check whether the final weekly check-in of the current fiscal month is complete
  const isFinalWeeklyCheckInComplete = useMemo(() => {
    const fiscalMonth = getFiscalMonthForDate(new Date(), household?.fiscalYearEndMonth || 12);
    // End date of the fiscal month
    const monthEndTime = fiscalMonth.endDate.getTime();
    const finalWeekStartTime = monthEndTime - 6 * 24 * 60 * 60 * 1000;

    return (checkIns || []).some((c) => {
      const cEndTime = new Date(c.weekEndDate).getTime();
      return cEndTime >= finalWeekStartTime;
    });
  }, [checkIns, household?.fiscalYearEndMonth]);

  // Compute month metrics and isolate Bills evaluation
  const monthStats = useMemo(() => {
    let totalMonthlyBudget = 0;
    let totalSpent = 0;

    const isBills = (c: { group?: string; name: string }) =>
      c.group?.toLowerCase() === 'bills' || c.name.toLowerCase() === 'bills';

    const fiscalMonth = getFiscalMonthForDate(monthRange.startDate, household?.fiscalYearEndMonth || 12);
    const weeksInMonth = fiscalMonth.weekCount || 4;

    const categoryDetails = categories.map((cat) => {
      // Statically derived constant: Baseline Weekly Allocation × Weeks in Fiscal Month
      const monthlyBudget = Math.round((Number(cat.baselineBudget) || 0) * weeksInMonth);
      const { totalSpent: spent } = calculateCategorySpending(
        expenses,
        cat.id,
        monthRange.startDate,
        monthRange.endDate
      );

      totalMonthlyBudget += monthlyBudget;
      totalSpent += spent;

      return {
        ...cat,
        monthlyBudget,
        spent,
        difference: monthlyBudget - spent,
        isBills: isBills(cat),
      };
    });

    const billsCategories = categoryDetails.filter((c) => c.isBills);
    const billsMonthlyBudget = billsCategories.reduce((sum, c) => sum + c.monthlyBudget, 0);
    const billsTotalSpent = billsCategories.reduce((sum, c) => sum + c.spent, 0);
    const billsDifference = billsMonthlyBudget - billsTotalSpent; // positive = surplus, negative = deficit

    const totalSurplus = categoryDetails
      .filter((c) => c.difference > 0)
      .reduce((sum, c) => sum + c.difference, 0);

    const totalDeficit = categoryDetails
      .filter((c) => c.difference < 0)
      .reduce((sum, c) => sum + Math.abs(c.difference), 0);

    const topWins = [...categoryDetails]
      .filter((c) => c.difference > 0)
      .sort((a, b) => b.difference - a.difference)
      .slice(0, 3);

    const topOverspent = [...categoryDetails]
      .filter((c) => c.difference < 0)
      .sort((a, b) => a.difference - b.difference)
      .slice(0, 3);

    return {
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
    };
  }, [categories, expenses, monthRange]);

  if (!isOpen) return null;

  const handleSweepToSavings = () => {
    if (monthStats.totalSurplus <= 0) return;
    setIsSwept(true);
    showToast(`Successfully swept ${formatCurrency(monthStats.totalSurplus)} in monthly surplus directly into Savings!`);
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

  const handleExecuteReset = async () => {
    setIsExecutingReset(true);
    try {
      await executeMonthEndResetAction();
      setIsCompleted(true);
    } catch (err) {
      console.error('Failed to execute month-end reset:', err);
    } finally {
      setIsExecutingReset(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-beige-200 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sage-50 to-beige-50 border-b border-beige-200 flex items-center justify-between">
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
                Fiscal Month-End Review & Hard Reset
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
                  All category budgets have been reset to their baseline default values. Your household is primed for a fresh financial month ahead.
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
          ) : (
            <>
              {/* Monthly Overview Stats */}
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
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <span className="text-[9px] uppercase font-bold text-dark-grey-600 block">
                    {monthStats.netRemaining >= 0 ? 'Net Surplus' : 'Net Over'}
                  </span>
                  <span
                    className={`text-base sm:text-lg font-black ${
                      monthStats.netRemaining >= 0 ? 'text-sage-800' : 'text-red-600'
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
                    <span>Top Budget Wins (Surplus)</span>
                  </div>
                  {monthStats.topWins.length === 0 ? (
                    <p className="text-xs text-brown-700">No surplus recorded this month.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {monthStats.topWins.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between text-xs bg-white/80 px-2.5 py-1.5 rounded-lg"
                        >
                          <span className="font-medium text-dark-green-900">{cat.name}</span>
                          <span className="font-extrabold text-sage-800">
                            +{formatCurrency(cat.difference)} under
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Overages */}
                <div className="p-4 bg-red-50/70 border border-red-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-900">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
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
                          <span className="font-extrabold text-red-600">
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
                        <span className="inline-flex items-center gap-1 text-[11px] font-black text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
                          <TrendingUp className="w-3.5 h-3.5 text-red-600" />
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
                    <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl flex items-center justify-between gap-3">
                      <p className="text-xs text-red-950">
                        Higher bills/utilities resulted in a <strong>{formatCurrency(Math.abs(monthStats.billsDifference))}</strong> deficit. Cover this overage directly from your accumulated Savings allocation.
                      </p>
                      <button
                        type="button"
                        onClick={handleDeductBillsDeficit}
                        disabled={isBillsDeficitDeducted}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          isBillsDeficitDeducted
                            ? 'bg-red-200 text-red-900 cursor-default'
                            : 'bg-red-700 hover:bg-red-800 text-white shadow-xs'
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
                <div className="p-4 bg-gradient-to-br from-sage-50 to-emerald-50 border border-sage-200 rounded-2xl space-y-3">
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
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <RotateCcw className="w-4 h-4 text-amber-700" />
                  <span>The Fiscal Month-End Hard Reset</span>
                </div>
                <p className="text-xs text-amber-950 leading-relaxed">
                  In Canopy, rollovers and deficit adjustments <strong>do not roll over across month boundaries</strong>. Executing the Hard Reset returns all category weekly budgets back to their default baseline values, providing a clean slate for next month.
                </p>
              </div>

              {!isFinalWeeklyCheckInComplete && (
                <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-2xl flex items-center gap-2.5 text-xs text-amber-950 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
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
                  className="w-full p-3 bg-beige-50 border border-beige-300 rounded-xl text-xs text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!isCompleted && (
          <div className="px-6 py-4 bg-beige-50/80 border-t border-beige-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-brown-700 hover:text-dark-green-900 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isExecutingReset || !isFinalWeeklyCheckInComplete}
                className="flex items-center gap-2 px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-xs transition active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isExecutingReset ? 'Executing Reset...' : 'Execute Month-End Hard Reset'}</span>
              </button>
              {!isFinalWeeklyCheckInComplete && (
                <span className="text-[11px] text-amber-800 font-semibold italic text-right max-w-sm">
                  * The last weekly check-in of the month needs to be completed before the Monthly Retrospective can be completed.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
