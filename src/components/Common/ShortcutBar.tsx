import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { calculateCheckInStatus, getOldestPastDueCheckInWeek } from '../../lib/checkInCalculations';
import { getFiscalMonthForDate } from '../../lib/fiscal445';
import {
  CheckCircle,
  CalendarClock,
  ArrowRight,
  ChevronUp,
  ChevronLeft,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';

export type ExpandedShortcut =
  | 'weekly_review'
  | 'monthly_review'
  | 'log_expense'
  | 'manage_budget'
  | null;

export const ShortcutBar: React.FC = () => {
  const {
    household,
    checkIns,
    expenses,
    openWeeklyCheckInModal,
    openMonthlyRetroModal,
    openLogExpenseModal,
    openAllocationModal,
  } = useHousehold();

  // Active expanded shortcut item ID. If null, all icons in the shortcut bar are visible.
  const [expandedShortcut, setExpandedShortcut] = useState<ExpandedShortcut>(null);

  // Compute weekly check-in past due status (displaying the oldest uncompleted check-in)
  const oldestPastDueWeek = React.useMemo(() => {
    return getOldestPastDueCheckInWeek(household, checkIns);
  }, [household, checkIns]);

  const weeklyPastDueStatus = React.useMemo(() => {
    if (!household) return { isPastDue: false, title: '', description: '', fiscalWeekLabel: '' };
    const statusInfo = calculateCheckInStatus(household, checkIns, expenses);
    const isPastDue = statusInfo.isPastDue || statusInfo.status === 'past-due' || statusInfo.status === 'pending' || oldestPastDueWeek !== null;

    const fiscalWeekLabel = oldestPastDueWeek ? oldestPastDueWeek.fiscalWeekLabel : (statusInfo.isPastDue ? 'Past Due' : '');

    return {
      isPastDue,
      title: 'Weekly Check-in',
      fiscalWeekLabel,
      description: oldestPastDueWeek
        ? `Reconcile spending and bank savings for ${oldestPastDueWeek.fiscalWeekLabel} to keep budgets accurate.`
        : 'Reconcile spending and bank savings to keep budgets accurate.',
    };
  }, [household, checkIns, expenses, oldestPastDueWeek]);

  // Compute monthly retrospective past due status
  const monthlyPastDueStatus = React.useMemo(() => {
    if (!household) return { isPastDue: false, title: '', description: '' };
    const currentFiscalMonth = getFiscalMonthForDate(new Date(), household.fiscalYearEndMonth || 12);
    const monthEndTime = currentFiscalMonth.endDate.getTime();
    const isPastDueMonth = new Date().getTime() > monthEndTime;

    if (isPastDueMonth) {
      const finalWeekStartTime = monthEndTime - 7 * 24 * 60 * 60 * 1000;
      const hasCompletedMonthRetro = (checkIns || []).some((c) => {
        const cEndTime = new Date(c.weekEndDate).getTime();
        return cEndTime >= finalWeekStartTime && c.status === 'completed';
      });

      if (!hasCompletedMonthRetro) {
        return {
          isPastDue: true,
          title: 'Monthly Retrospective Past Due',
          description:
            'The fiscal month has concluded. Review your macro budget performance, analyze category pacing, and establish next month’s baseline.',
        };
      }
    }

    return { isPastDue: false, title: '', description: '' };
  }, [household, checkIns]);

  // Session dismissal helpers
  const handleDismissWeeklyReview = () => {
    setExpandedShortcut(null);
    try {
      sessionStorage.setItem('canopy_dismissed_weekly_review_banner', 'true');
    } catch (e) {
      // ignore
    }
  };

  const handleDismissMonthlyReview = () => {
    setExpandedShortcut(null);
    try {
      sessionStorage.setItem('canopy_dismissed_monthly_review_banner', 'true');
    } catch (e) {
      // ignore
    }
  };

  // On initial mount, if either weekly or monthly review is past due and NOT dismissed this session, start expanded once
  const [hasInitializedReview, setHasInitializedReview] = useState(false);
  React.useEffect(() => {
    if (!hasInitializedReview) {
      let isWeeklyDismissed = false;
      let isMonthlyDismissed = false;
      try {
        isWeeklyDismissed = sessionStorage.getItem('canopy_dismissed_weekly_review_banner') === 'true';
        isMonthlyDismissed = sessionStorage.getItem('canopy_dismissed_monthly_review_banner') === 'true';
      } catch (e) {
        // ignore
      }

      if (weeklyPastDueStatus.isPastDue && !isWeeklyDismissed) {
        setExpandedShortcut('weekly_review');
      } else if (monthlyPastDueStatus.isPastDue && !isMonthlyDismissed) {
        setExpandedShortcut('monthly_review');
      }
      setHasInitializedReview(true);
    }
  }, [weeklyPastDueStatus.isPastDue, monthlyPastDueStatus.isPastDue, hasInitializedReview]);

  if (!household) return null;

  return (
    <section
      id="shortcut-bar"
      aria-label="Short cut Bar"
      className="w-full bg-beige-50/90 border-b border-beige-200/90 py-2 px-4 sm:px-6 transition-all duration-200"
    >
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
        {/* Short cut Bar Scrollable Row */}
        <div className="w-full flex items-center gap-2.5 sm:gap-3 overflow-x-auto py-0.5 no-scrollbar">
          {/* ========================================================================= */}
          {/* CASE 1: ONE SHORTCUT IS EXPANDED -> ALL OTHER ICONS ARE HIDDEN */}
          {/* ========================================================================= */}

          {/* 1. EXPANDED WEEKLY PAST DUE BANNER */}
          {expandedShortcut === 'weekly_review' && weeklyPastDueStatus.isPastDue && (
            <div
              id="dashboard-review-due-alert"
              className="w-full bg-white border border-alert-red-400/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
            >
              {/* Icon & Aligned Title + Past Due badge */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-alert-red-50 border border-alert-red-200 flex items-center justify-center text-alert-red-600 shadow-2xs">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <span
                    id="dashboard-review-notification-dot"
                    className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-alert-red-600 rounded-full ring-2 ring-white"
                    title="Actionable alert"
                    aria-label="Actionable alert"
                  />
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-dark-green-950 tracking-tight leading-none">
                      {weeklyPastDueStatus.title}
                    </h3>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-alert-red-700 bg-alert-red-100/90 border border-alert-red-300 px-2 py-0.5 rounded-full leading-none">
                      {weeklyPastDueStatus.fiscalWeekLabel ? `${weeklyPastDueStatus.fiscalWeekLabel} Past Due` : 'Past Due'}
                    </span>
                  </div>

                  {weeklyPastDueStatus.description && (
                    <p className="text-[11px] sm:text-xs text-brown-700 leading-normal max-w-2xl">
                      {weeklyPastDueStatus.description}
                    </p>
                  )}
                </div>
              </div>

              {/* CTA Button & Collapse Button */}
              <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 pl-12 sm:pl-0">
                <button
                  id="dashboard-start-review-cta"
                  onClick={() => openWeeklyCheckInModal(oldestPastDueWeek ? oldestPastDueWeek.range : undefined)}
                  className="flex items-center justify-start text-left gap-1.5 px-4 py-2 bg-alert-red-600 hover:bg-alert-red-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <span>Complete Check-In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleDismissWeeklyReview}
                  className="p-1.5 sm:p-2 text-brown-600 hover:text-dark-green-950 hover:bg-beige-100 rounded-xl transition cursor-pointer ml-auto sm:ml-0"
                  title="Collapse notification banner"
                  aria-label="Collapse notification banner"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 2. EXPANDED MONTHLY RETROSPECTIVE PAST DUE BANNER */}
          {expandedShortcut === 'monthly_review' && monthlyPastDueStatus.isPastDue && (
            <div
              id="dashboard-monthly-review-due-alert"
              className="w-full bg-white border border-alert-red-400/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95"
            >
              {/* Icon & Aligned Title + Past Due badge */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-alert-red-50 border border-alert-red-200 flex items-center justify-center text-alert-red-600 shadow-2xs">
                    <CalendarClock className="w-5 h-5" />
                  </div>
                  <span
                    id="dashboard-monthly-review-notification-dot"
                    className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-alert-red-600 rounded-full ring-2 ring-white"
                    title="Actionable alert"
                    aria-label="Actionable alert"
                  />
                </div>

                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-dark-green-950 tracking-tight leading-none">
                      {monthlyPastDueStatus.title}
                    </h3>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-alert-red-700 bg-alert-red-100/90 border border-alert-red-300 px-2 py-0.5 rounded-full leading-none">
                      Past Due
                    </span>
                  </div>

                  {monthlyPastDueStatus.description && (
                    <p className="text-[11px] sm:text-xs text-brown-700 leading-normal max-w-2xl">
                      {monthlyPastDueStatus.description}
                    </p>
                  )}
                </div>
              </div>

              {/* CTA Button & Collapse Button */}
              <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 pl-12 sm:pl-0">
                <button
                  id="dashboard-start-monthly-retro-cta"
                  onClick={() => openMonthlyRetroModal()}
                  className="flex items-center justify-start text-left gap-1.5 px-4 py-2 bg-alert-red-600 hover:bg-alert-red-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <span>Start Monthly Retro</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleDismissMonthlyReview}
                  className="p-1.5 sm:p-2 text-brown-600 hover:text-dark-green-950 hover:bg-beige-100 rounded-xl transition cursor-pointer ml-auto sm:ml-0"
                  title="Collapse notification banner"
                  aria-label="Collapse notification banner"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* 3. EXPANDED LOG TRANSACTION CTA */}
          {expandedShortcut === 'log_expense' && (
            <div className="flex items-center gap-1.5 bg-white border border-sage-300 rounded-2xl p-1.5 shadow-2xs animate-in fade-in zoom-in-95 duration-150">
              <button
                id="header-log-transaction-btn"
                type="button"
                onClick={() => {
                  openLogExpenseModal();
                  setExpandedShortcut(null);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-xs transition active:scale-98 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Log Transaction</span>
              </button>
              <button
                type="button"
                onClick={() => setExpandedShortcut(null)}
                className="p-1.5 text-brown-600 hover:text-dark-green-950 hover:bg-beige-100 rounded-lg transition cursor-pointer"
                title="Collapse Log Transaction"
                aria-label="Collapse Log Transaction"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 4. EXPANDED MANAGE BUDGET CTA */}
          {expandedShortcut === 'manage_budget' && (
            <div className="flex items-center gap-1.5 bg-white border border-sage-300 rounded-2xl p-1.5 shadow-2xs animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => {
                  openAllocationModal();
                  setExpandedShortcut(null);
                }}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-sage-800 hover:bg-sage-900 text-white text-xs font-extrabold rounded-xl shadow-xs transition active:scale-98 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 text-white" />
                <span>Manage Budget</span>
              </button>
              <button
                type="button"
                onClick={() => setExpandedShortcut(null)}
                className="p-1.5 text-brown-600 hover:text-dark-green-950 hover:bg-beige-100 rounded-lg transition cursor-pointer"
                title="Collapse Manage Budget"
                aria-label="Collapse Manage Budget"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CASE 2: NO EXPANDED SHORTCUT (DEFAULT ICONS VISIBLE IN SHORT CUT BAR)     */}
          {/* ========================================================================= */}
          {expandedShortcut === null && (
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-max">
              {/* CONDITIONAL RED ICON 1: Weekly Check-In Past Due */}
              {weeklyPastDueStatus.isPastDue && (
                <button
                  type="button"
                  id="dashboard-review-due-alert"
                  onClick={() => setExpandedShortcut('weekly_review')}
                  className="group relative shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-alert-red-50 border border-alert-red-200 hover:bg-alert-red-100 hover:scale-105 flex items-center justify-center text-alert-red-600 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Weekly Check-In Past Due (Click to expand)"
                  aria-label="Weekly Check-In Past Due (Click to expand)"
                >
                  <CheckCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-alert-red-600" />
                  <span
                    id="dashboard-review-notification-dot"
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-alert-red-600 rounded-full ring-2 ring-white animate-pulse"
                    title="Actionable alert"
                    aria-label="Actionable alert"
                  />
                </button>
              )}

              {/* CONDITIONAL RED ICON 2: Monthly Retrospective Past Due */}
              {monthlyPastDueStatus.isPastDue && (
                <button
                  type="button"
                  id="dashboard-monthly-review-due-alert"
                  onClick={() => setExpandedShortcut('monthly_review')}
                  className="group relative shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-alert-red-50 border border-alert-red-200 hover:bg-alert-red-100 hover:scale-105 flex items-center justify-center text-alert-red-600 shadow-2xs transition active:scale-95 cursor-pointer"
                  title="Monthly Retrospective Past Due (Click to expand)"
                  aria-label="Monthly Retrospective Past Due (Click to expand)"
                >
                  <CalendarClock className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-alert-red-600" />
                  <span
                    id="dashboard-monthly-review-notification-dot"
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-alert-red-600 rounded-full ring-2 ring-white animate-pulse"
                    title="Actionable alert"
                    aria-label="Actionable alert"
                  />
                </button>
              )}

              {/* PERMANENT ICON 1: Log Transaction (Light green square with dark green plus sign) */}
              <button
                type="button"
                id="global-log-transaction-icon-btn"
                onClick={() => setExpandedShortcut('log_expense')}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sage-100 hover:bg-sage-200/90 border border-sage-300 flex items-center justify-center text-dark-green-900 shadow-2xs transition active:scale-95 cursor-pointer group shrink-0"
                title="Log Transaction (Click to expand)"
                aria-label="Log Transaction (Click to expand)"
              >
                <Plus className="w-5 h-5 text-dark-green-900 stroke-[2.5] group-hover:scale-110 transition-transform" />
              </button>

              {/* PERMANENT ICON 2: Manage Budget (SlidersHorizontal icon matching Add / Manage Buckets) */}
              <button
                type="button"
                id="global-manage-budget-icon-btn"
                onClick={() => setExpandedShortcut('manage_budget')}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-beige-100 hover:bg-beige-200 border border-beige-300 flex items-center justify-center text-brown-800 shadow-2xs transition active:scale-95 cursor-pointer group shrink-0"
                title="Manage Budget (Click to expand)"
                aria-label="Manage Budget (Click to expand)"
              >
                <SlidersHorizontal className="w-4 h-4 text-brown-800 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
