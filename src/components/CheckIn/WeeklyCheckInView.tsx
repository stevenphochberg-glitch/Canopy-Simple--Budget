import React, { useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { formatCurrency, getMonthRange } from '../../lib/calculations';
import { calculateCheckInStatus } from '../../lib/checkInCalculations';
import { CategoryIcon } from '../Common/CategoryIcon';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  ArrowRight,
  RotateCcw,
  Shield,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  FileCheck,
  Zap,
} from 'lucide-react';

export const WeeklyCheckInView: React.FC = () => {
  const {
    household,
    categories,
    expenses,
    members,
    checkIns,
    openWeeklyCheckInModal,
    openMonthlyRetroModal,
    triggerFreshStartAction,
  } = useHousehold();

  const statusInfo = useMemo(() => {
    return calculateCheckInStatus(household, checkIns, expenses);
  }, [household, checkIns, expenses]);

  const {
    status,
    isPastDue,
    isLastDayOfWeek,
    isFirstWeekGracePeriod,
    daysUntilCheckIn,
    checkInDayName,
    activeWeekRange,
    missedWeeksCount,
  } = statusInfo;

  // Completed check-ins
  const pastCheckIns = useMemo(() => {
    return [...checkIns]
      .filter((c) => c.status === 'completed')
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [checkIns]);

  // Categories currently adjusted from baseline
  const adjustedCategories = useMemo(() => {
    return categories.filter(
      (c) => Number(c.currentWeeklyBudget) !== Number(c.baselineBudget)
    );
  }, [categories]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Top Header Card */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 bg-sage-100 px-2.5 py-0.5 rounded-full">
              Phase 4 Active
            </span>
            <span className="text-xs text-dark-grey-600">
              Weekly Alignment & Behavioral Rollovers
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-dark-green-900 mt-1">
            Check-In and Accountability
          </h1>
          <p className="text-xs sm:text-sm text-brown-700">
            Align with your household every{' '}
            <strong className="text-dark-green-900">{checkInDayName}</strong> to review pacing, bank surplus savings, and absorb deficits.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => openMonthlyRetroModal()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs font-bold rounded-2xl border border-beige-300 transition cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-sage-700" />
            <span>Monthly Retrospective</span>
          </button>

          <button
            onClick={() => openWeeklyCheckInModal()}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-extrabold rounded-2xl shadow-sm transition active:scale-95 cursor-pointer ${
              isPastDue
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-dark-green-800 hover:bg-dark-green-900 text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>
              {isPastDue
                ? 'Complete Past-Due Check-In'
                : isLastDayOfWeek || status === 'pending'
                ? 'Weekly Check-in Ready'
                : 'Preview Check-In'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Status Hero Banner */}
      {isPastDue ? (
        /* PAST DUE RED BANNER */
        <div className="bg-red-50 border-2 border-red-300 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-red-200 text-red-900 px-2 py-0.5 rounded-full">
                    Action Required
                  </span>
                  <span className="text-xs font-bold text-red-800">
                    Past-Due Weekly Check-In
                  </span>
                </div>
                <h3 className="text-xl font-black text-red-950">
                  A New Week Began Without Check-In
                </h3>
                <p className="text-xs text-red-900 leading-relaxed max-w-xl">
                  Your last check-in was missed. Complete the check-in now to review your week and calculate rollover budgets, or use <strong>"Start Fresh"</strong> to assume exactly on budget.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => triggerFreshStartAction()}
                className="px-4 py-2.5 bg-white border border-red-200 hover:bg-red-100 text-red-900 text-xs font-bold rounded-2xl shadow-2xs transition cursor-pointer"
              >
                Start Fresh (On-Budget)
              </button>

              <button
                onClick={() => openWeeklyCheckInModal()}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-2xl shadow-sm transition cursor-pointer"
              >
                Complete Check-In Now
              </button>
            </div>
          </div>
        </div>
      ) : status === 'pending' || isLastDayOfWeek ? (
        /* ACTIVE CHECK-IN DAY BANNER */
        <div className="bg-gradient-to-br from-sage-50 to-beige-50 border-2 border-sage-300 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-dark-green-800 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-sage-200 text-dark-green-900 px-2 py-0.5 rounded-full">
                    Weekly Check-in Ready
                  </span>
                  <span className="text-xs font-bold text-dark-green-800">
                    {activeWeekRange.label}
                  </span>
                </div>
                <h3 className="text-xl font-black text-dark-green-900">
                  It's {checkInDayName}! Time for Weekly Check-In
                </h3>
                <p className="text-xs text-brown-700 leading-relaxed max-w-xl">
                  Review this week’s spending, decide whether to move surplus into savings or prorate across remaining weeks, and confirm next week's budgets.
                </p>
              </div>
            </div>

            <button
              onClick={() => openWeeklyCheckInModal()}
              className="px-6 py-3 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-2xl shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>Weekly Check-in Ready</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : status === 'completed' ? (
        /* COMPLETED BANNER */
        <div className="bg-sage-50/70 border border-sage-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sage-100 text-sage-800 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-sage-700" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-sage-200 text-sage-900 px-2 py-0.5 rounded-full">
                  Up to Date
                </span>
                <span className="text-xs font-bold text-sage-900">
                  {activeWeekRange.label}
                </span>
              </div>
              <h3 className="text-lg font-black text-dark-green-900">
                Weekly Check-In Completed
              </h3>
              <p className="text-xs text-brown-700">
                Category rollovers and savings contributions have been applied.
              </p>
            </div>
          </div>

          <button
            onClick={() => openWeeklyCheckInModal()}
            className="px-4 py-2 bg-white border border-beige-300 hover:bg-beige-100 text-dark-green-900 text-xs font-bold rounded-2xl transition cursor-pointer"
          >
            Review / Edit Check-In
          </button>
        </div>
      ) : (
        /* UPCOMING BANNER */
        <div className="bg-white border border-beige-200 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-beige-100 text-brown-800 flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-beige-100 text-brown-800 px-2 py-0.5 rounded-full">
                  Upcoming Check-In
                </span>
                <span className="text-xs text-dark-grey-600">
                  {daysUntilCheckIn} {daysUntilCheckIn === 1 ? 'day' : 'days'} away
                </span>
              </div>
              <h3 className="text-lg font-black text-dark-green-900">
                Scheduled for {checkInDayName}
              </h3>
              <p className="text-xs text-brown-700">
                Keep logging your receipts throughout the week. Check-in unlocks on {checkInDayName} evening.
              </p>
            </div>
          </div>

          <button
            onClick={() => openWeeklyCheckInModal()}
            className="px-4 py-2 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs font-bold rounded-2xl border border-beige-300 transition cursor-pointer"
          >
            Preview Check-In
          </button>
        </div>
      )}

      {/* Rollover Active Adjustments Card */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-beige-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-dark-green-900">
              Current Weekly Category Budgets & Rollovers
            </h3>
            <p className="text-xs text-brown-700">
              Categories adjusted within the current month ({adjustedCategories.length} modified from baseline)
            </p>
          </div>

          <span className="text-xs font-bold text-dark-green-900 bg-beige-100 px-3 py-1 rounded-xl">
            {household?.calendarMode === 'weekly' ? 'Fiscal Weekly Mode' : 'Calendar Month Mode'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((cat) => {
            const isDifferent = Number(cat.currentWeeklyBudget) !== Number(cat.baselineBudget);
            const diff = Number(cat.currentWeeklyBudget) - Number(cat.baselineBudget);

            return (
              <div
                key={cat.id}
                className={`p-3.5 rounded-2xl border ${
                  isDifferent
                    ? diff > 0
                      ? 'bg-sage-50/60 border-sage-200'
                      : 'bg-red-50/60 border-red-200'
                    : 'bg-beige-50/40 border-beige-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center shrink-0">
                      <CategoryIcon
                        name={cat.name}
                        group={cat.group}
                        icon={cat.icon}
                        className="w-3.5 h-3.5 text-dark-green-900"
                      />
                    </div>
                    <span className="text-xs font-bold text-dark-green-900 truncate">
                      {cat.name}
                    </span>
                  </div>

                  <span className="text-xs font-black text-dark-green-900 shrink-0">
                    {formatCurrency(cat.currentWeeklyBudget)}/wk
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-dark-grey-600 mt-2 pt-1.5 border-t border-beige-200/60">
                  <span>Baseline: {formatCurrency(cat.baselineBudget)}</span>
                  {isDifferent && (
                    <span
                      className={`font-bold ${
                        diff > 0 ? 'text-sage-800' : 'text-red-600'
                      }`}
                    >
                      {diff > 0 ? `+${formatCurrency(diff)} rollover` : `-${formatCurrency(Math.abs(diff))} deficit`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completed Check-in History */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-beige-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-dark-green-900">
              Completed Check-In Logs ({pastCheckIns.length})
            </h3>
            <p className="text-xs text-brown-700">
              Historical ledger of past check-ins, rollover decisions, and household intentions.
            </p>
          </div>
        </div>

        {pastCheckIns.length === 0 ? (
          <div className="py-10 text-center space-y-2 bg-beige-50/50 rounded-2xl border border-dashed border-beige-200">
            <FileCheck className="w-8 h-8 mx-auto text-brown-700" />
            <h4 className="text-sm font-bold text-dark-green-900">
              No historical check-ins recorded yet
            </h4>
            <p className="text-xs text-brown-700">
              Your completed weekly check-ins and monthly retrospectives will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-beige-100">
            {pastCheckIns.map((item) => (
              <div key={item.id} className="py-3.5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sage-100 text-dark-green-800 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-sage-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-dark-green-900">
                        Check-In: {item.weekStartDate} to {item.weekEndDate}
                      </span>
                      <span className="text-[10px] font-bold text-sage-800 bg-sage-100 px-2 py-0.2 rounded">
                        Completed
                      </span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-brown-700 italic mt-0.5">
                        "{item.notes}"
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-dark-grey-600 mt-1">
                      <span>Spent: {formatCurrency(item.totalSpent || 0)}</span>
                      <span>&bull;</span>
                      <span>Saved to Pot: +{formatCurrency(item.totalSaved || 0)}</span>
                      <span>&bull;</span>
                      <span>Completed by {item.completedByName || 'Household'}</span>
                    </div>
                  </div>
                </div>

                <span className="text-[10px] text-dark-grey-600 font-medium">
                  {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
