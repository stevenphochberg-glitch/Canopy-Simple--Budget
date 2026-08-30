import React, { useState, useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { formatCurrency, getMonthRange, calculateCategorySpending } from '../../lib/calculations';
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
  const { household, categories, expenses, members, user, executeMonthEndResetAction } =
    useHousehold();

  const [intentionsText, setIntentionsText] = useState<string>('');
  const [reflectionNote, setReflectionNote] = useState<string>('');
  const [isExecutingReset, setIsExecutingReset] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Month range
  const monthRange = useMemo(() => {
    return getMonthRange(new Date(), 0);
  }, []);

  // Compute month metrics
  const monthStats = useMemo(() => {
    let totalMonthlyBudget = 0;
    let totalSpent = 0;

    const categoryDetails = categories.map((cat) => {
      const monthlyBudget = Math.round(((Number(cat.baselineBudget) || 0) * 52) / 12);
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
      };
    });

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
    };
  }, [categories, expenses, monthRange]);

  if (!isOpen) return null;

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

            <button
              type="button"
              onClick={handleExecuteReset}
              disabled={isExecutingReset}
              className="flex items-center gap-2 px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-xs transition active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isExecutingReset ? 'Executing Reset...' : 'Execute Month-End Hard Reset'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
