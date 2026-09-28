import React, { useState, useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { formatCurrency, getMonthRange, getCategoryEffectiveWeeklyBudget, getWeekId } from '../../lib/calculations';
import { calculateCheckInStatus } from '../../lib/checkInCalculations';
import { formatFiscalRecordTrackerString } from '../../lib/fiscal445';
import { CategoryIcon } from '../Common/CategoryIcon';
import { CheckIn } from '../../types';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
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
  Pencil,
  Trash2,
  Save,
  X,
  MessageSquare,
  Layers,
  Loader2,
  Check,
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
    deleteWeeklyCheckIn,
    updateCheckIn,
    updateCheckInNotes,
    showToast,
  } = useHousehold();

  // Edit & Delete State
  const [editingCheckIn, setEditingCheckIn] = useState<CheckIn | null>(null);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editTotalSaved, setEditTotalSaved] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [deletingCheckIn, setDeletingCheckIn] = useState<CheckIn | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Inline note editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineNotesText, setInlineNotesText] = useState<string>('');
  const [isSavingInline, setIsSavingInline] = useState<boolean>(false);

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

  // Derive previewed week ID for weeklyOverrides lookup
  const previewedWeekId = useMemo(() => {
    return getWeekId(activeWeekRange, household?.firstDayOfWeek || 'Monday');
  }, [activeWeekRange, household?.firstDayOfWeek]);

  // Categories currently adjusted from baseline for the previewed week
  const adjustedCategories = useMemo(() => {
    return categories.filter((cat) => {
      const effective = getCategoryEffectiveWeeklyBudget(cat, previewedWeekId, household);
      return effective.isOverridden;
    });
  }, [categories, previewedWeekId, household]);

  // Handlers for Edit & Delete
  const handleOpenEdit = (item: CheckIn) => {
    setEditingCheckIn(item);
    setEditNotes(item.notes || '');
    setEditTotalSaved(String(item.totalSaved ?? 0));
  };

  const handleSaveEdit = async () => {
    if (!editingCheckIn) return;
    setIsSavingEdit(true);
    try {
      const parsedSaved = parseFloat(editTotalSaved);
      const newTotalSaved = isNaN(parsedSaved) ? (editingCheckIn.totalSaved || 0) : parsedSaved;
      await updateCheckIn(editingCheckIn.id, {
        notes: editNotes.trim(),
        totalSaved: newTotalSaved,
      });
      showToast('Check-in record updated successfully!', 'success');
      setEditingCheckIn(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to update check-in record.', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCheckIn) return;
    setIsDeleting(true);
    try {
      await deleteWeeklyCheckIn(deletingCheckIn.id);
      setDeletingCheckIn(null);
      if (editingCheckIn?.id === deletingCheckIn.id) {
        setEditingCheckIn(null);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to delete check-in record.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStartInlineNote = (item: CheckIn) => {
    setInlineEditingId(item.id);
    setInlineNotesText(item.notes || '');
  };

  const handleSaveInlineNote = async (checkInId: string) => {
    setIsSavingInline(true);
    try {
      await updateCheckInNotes(checkInId, inlineNotesText.trim());
      setInlineEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingInline(false);
    }
  };

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
                ? 'bg-alert-red-600 hover:bg-alert-red-700 text-white animate-pulse'
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
        <div className="bg-alert-red-50 border-2 border-alert-red-300 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-alert-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-alert-red-200 text-alert-red-900 px-2 py-0.5 rounded-full">
                    Action Required
                  </span>
                  <span className="text-xs font-bold text-alert-red-800">
                    Past-Due Weekly Check-In
                  </span>
                </div>
                <h3 className="text-xl font-black text-alert-red-950">
                  A New Week Began Without Check-In
                </h3>
                <p className="text-xs text-alert-red-900 leading-relaxed max-w-xl">
                  Your last check-in was missed. Complete the check-in now to review your week and calculate rollover budgets, or use <strong>"Start Fresh"</strong> to assume exactly on budget.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => triggerFreshStartAction()}
                className="px-4 py-2.5 bg-white border border-alert-red-200 hover:bg-alert-red-100 text-alert-red-900 text-xs font-bold rounded-2xl shadow-2xs transition cursor-pointer"
              >
                Start Fresh (On-Budget)
              </button>

              <button
                onClick={() => openWeeklyCheckInModal()}
                className="px-5 py-2.5 bg-alert-red-600 hover:bg-alert-red-700 text-white text-xs font-extrabold rounded-2xl shadow-sm transition cursor-pointer"
              >
                Complete Check-In Now
              </button>
            </div>
          </div>
        </div>
      ) : status === 'pending' || isLastDayOfWeek ? (
        /* ACTIVE CHECK-IN DAY BANNER */
        <div className="bg-sage-50/70 border-2 border-sage-300 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
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
            const effective = getCategoryEffectiveWeeklyBudget(cat, previewedWeekId, household);
            const baselineBudget = effective.baseline;
            const displayBudget = effective.budget;
            const isOverridden = effective.isOverridden;
            const diff = displayBudget - baselineBudget;

            return (
              <div
                key={cat.id}
                className={`p-3.5 rounded-2xl border ${
                  isOverridden
                    ? diff > 0
                      ? 'bg-sage-50/60 border-sage-200'
                      : 'bg-alert-red-50/60 border-alert-red-200'
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
                    {formatCurrency(displayBudget)}/wk
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-dark-grey-600 mt-2 pt-1.5 border-t border-beige-200/60">
                  <span>Baseline: {formatCurrency(baselineBudget)}</span>
                  {isOverridden && (
                    <span
                      className={`font-bold ${
                        diff > 0 ? 'text-sage-800' : 'text-alert-red-600'
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
            {pastCheckIns.map((item) => {
              const isInlineEditing = inlineEditingId === item.id;

              return (
                <div
                  key={item.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3.5 hover:bg-beige-50/40 px-2 sm:px-3 rounded-2xl transition"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-sage-100 text-dark-green-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-5 h-5 text-sage-700" />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-dark-green-900">
                          Check-In: {item.weekStartDate} to {item.weekEndDate}
                        </span>
                        <span className="text-[10px] font-bold text-sage-800 bg-sage-100 px-2 py-0.5 rounded-full">
                          Completed
                        </span>
                        <span className="text-[10px] font-mono font-bold text-dark-green-900 bg-sage-50 border border-sage-200/90 px-2 py-0.5 rounded-md">
                          {formatFiscalRecordTrackerString(
                            item.weekStartDate || item.weekEndDate || (item.timestamp ? new Date(item.timestamp) : new Date()),
                            household?.fiscalYearEndMonth || 12
                          )}
                        </span>
                      </div>

                      {/* Notes or inline editing */}
                      {isInlineEditing ? (
                        <div className="mt-2 space-y-2 max-w-lg bg-beige-50/80 p-3 rounded-2xl border border-beige-200">
                          <textarea
                            value={inlineNotesText}
                            onChange={(e) => setInlineNotesText(e.target.value)}
                            placeholder="Add or edit household notes about this check-in..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-xs text-brown-900 placeholder:text-brown-400 focus:outline-hidden focus:ring-2 focus:ring-dark-green-800 resize-none"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setInlineEditingId(null)}
                              className="px-3 py-1 bg-white hover:bg-beige-100 text-brown-700 text-xs font-bold rounded-lg border border-beige-200 transition cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveInlineNote(item.id)}
                              disabled={isSavingInline}
                              className="px-3 py-1 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                            >
                              {isSavingInline ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : item.notes ? (
                        <div className="group flex items-start gap-1.5">
                          <p className="text-xs text-brown-700 italic leading-relaxed">
                            "{item.notes}"
                          </p>
                          <button
                            onClick={() => handleStartInlineNote(item)}
                            className="text-brown-400 hover:text-dark-green-800 opacity-0 group-hover:opacity-100 transition p-0.5 cursor-pointer"
                            title="Edit notes inline"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartInlineNote(item)}
                          className="text-[11px] text-brown-500 hover:text-dark-green-800 flex items-center gap-1 transition cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Add reflection note</span>
                        </button>
                      )}

                      <div className="flex items-center gap-3 text-[11px] text-dark-grey-600 flex-wrap pt-0.5">
                        <span className="font-medium">
                          Spent: <strong className="text-dark-green-950 font-bold">{formatCurrency(item.totalSpent || 0)}</strong>
                        </span>
                        <span>&bull;</span>
                        <span className="text-sage-800 font-medium">
                          Saved to Pot: <strong className="font-bold">+{formatCurrency(item.totalSaved || 0)}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>Completed by {item.completedByName || 'Household'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Timestamp */}
                  <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-beige-100">
                    <span className="text-[10px] text-dark-grey-600 font-medium">
                      {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-dark-green-900 bg-beige-100 hover:bg-beige-200 border border-beige-300 rounded-xl transition cursor-pointer active:scale-95"
                        title="Edit check-in record"
                      >
                        <Pencil className="w-3.5 h-3.5 text-dark-green-800" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => setDeletingCheckIn(item)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-alert-red-700 bg-alert-red-50 hover:bg-alert-red-100 border border-alert-red-200 rounded-xl transition cursor-pointer active:scale-95"
                        title="Delete check-in record"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-alert-red-600" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Check-In Modal */}
      {editingCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-beige-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-beige-100 bg-beige-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sage-100 text-dark-green-900 flex items-center justify-center">
                  <Pencil className="w-5 h-5 text-dark-green-800" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 bg-sage-100 px-2.5 py-0.5 rounded-full">
                      Edit Check-In
                    </span>
                    <span className="text-xs text-dark-grey-600 font-mono">
                      {formatFiscalRecordTrackerString(
                        editingCheckIn.weekStartDate || (editingCheckIn.timestamp ? new Date(editingCheckIn.timestamp) : new Date()),
                        household?.fiscalYearEndMonth || 12
                      )}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-dark-green-900 mt-0.5">
                    {editingCheckIn.weekStartDate} – {editingCheckIn.weekEndDate}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => setEditingCheckIn(null)}
                className="w-8 h-8 rounded-full bg-white border border-beige-200 hover:bg-beige-100 text-brown-800 flex items-center justify-center transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Financial Metrics Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-beige-50/80 border border-beige-200 rounded-2xl p-4 text-center">
                  <span className="text-[11px] font-bold text-brown-700 uppercase tracking-wider block">
                    Total Spent
                  </span>
                  <span className="text-xl font-black text-dark-green-900 mt-0.5 block">
                    {formatCurrency(editingCheckIn.totalSpent || 0)}
                  </span>
                  <span className="text-[10px] text-dark-grey-600 mt-1 block">
                    of {formatCurrency(editingCheckIn.totalBudget || 0)} budget
                  </span>
                </div>

                <div className="bg-sage-50/80 border border-sage-200 rounded-2xl p-4 text-center">
                  <span className="text-[11px] font-bold text-sage-800 uppercase tracking-wider block">
                    Banked to Savings
                  </span>
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <span className="text-sm font-bold text-dark-green-900">$</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editTotalSaved}
                      onChange={(e) => setEditTotalSaved(e.target.value)}
                      className="w-24 px-2 py-1 bg-white border border-sage-300 rounded-xl text-base font-black text-dark-green-900 text-center focus:outline-hidden focus:ring-2 focus:ring-dark-green-800"
                    />
                  </div>
                  <span className="text-[10px] text-sage-700 mt-1 block">
                    editable savings amount
                  </span>
                </div>

                <div className="bg-beige-50/80 border border-beige-200 rounded-2xl p-4 text-center">
                  <span className="text-[11px] font-bold text-brown-700 uppercase tracking-wider block">
                    Completed By
                  </span>
                  <span className="text-sm font-bold text-dark-green-900 mt-1 truncate block">
                    {editingCheckIn.completedByName || 'Household'}
                  </span>
                  <span className="text-[10px] text-dark-grey-600 mt-1 block">
                    {editingCheckIn.timestamp ? new Date(editingCheckIn.timestamp).toLocaleDateString() : 'Recorded'}
                  </span>
                </div>
              </div>

              {/* Household Reflection & Notes */}
              <div className="space-y-2 bg-beige-50/60 border border-beige-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-sage-700" />
                    <label className="text-xs font-bold text-dark-green-900">
                      Household Reflection & Notes
                    </label>
                  </div>
                  <span className="text-[10px] text-dark-grey-600">
                    Shared with household feed
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add or update household notes, highlights, or context about this check-in..."
                  className="w-full px-3.5 py-2.5 bg-white border border-beige-300 rounded-xl text-xs text-brown-900 placeholder:text-brown-400 focus:outline-hidden focus:ring-2 focus:ring-dark-green-800 resize-none"
                />
              </div>

              {/* Category Decisions Breakdown */}
              {editingCheckIn.decisions && editingCheckIn.decisions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sage-700" />
                    <h3 className="text-sm font-extrabold text-dark-green-900">
                      Recorded Category Decisions
                    </h3>
                  </div>

                  <div className="divide-y divide-beige-100 border border-beige-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    {editingCheckIn.decisions.map((dec, idx) => {
                      const isUnderspent = dec.difference > 0;
                      const isOverspent = dec.difference < 0;

                      return (
                        <div
                          key={idx}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-beige-50/40 transition"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-dark-green-900">
                                {dec.categoryName}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  dec.choice === 'savings'
                                    ? 'bg-sage-100 text-dark-green-900 border-sage-300'
                                    : dec.choice === 'rollover'
                                    ? 'bg-sky-blue-100 text-sky-blue-900 border-sky-blue-300'
                                    : dec.choice === 'deduct_savings'
                                    ? 'bg-gold-100 text-gold-900 border-gold-300'
                                    : 'bg-beige-100 text-brown-800 border-beige-200'
                                }`}
                              >
                                {dec.choice === 'savings'
                                  ? `+$${dec.savingsContribution || dec.difference} to Savings`
                                  : dec.choice === 'rollover'
                                  ? 'Prorated to Remaining Weeks'
                                  : dec.choice === 'deduct_savings'
                                  ? `Deducted from Savings (-$${dec.savingsDeduction || Math.abs(dec.difference)})`
                                  : 'Balanced'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-dark-grey-600">
                              <span>Budget: {formatCurrency(dec.budget)}</span>
                              <span>&bull;</span>
                              <span>Spent: {formatCurrency(dec.spent)}</span>
                              <span>&bull;</span>
                              <span
                                className={
                                  isUnderspent
                                    ? 'text-sage-800 font-bold'
                                    : isOverspent
                                    ? 'text-alert-red-600 font-bold'
                                    : 'text-brown-700'
                                }
                              >
                                {isUnderspent
                                  ? `+${formatCurrency(dec.difference)} surplus`
                                  : isOverspent
                                  ? `-${formatCurrency(Math.abs(dec.difference))} deficit`
                                  : 'Balanced'}
                              </span>
                            </div>
                          </div>

                          {dec.newWeeklyBudget !== undefined && dec.newWeeklyBudget !== dec.previousWeeklyBudget && (
                            <div className="text-[11px] text-right text-dark-grey-600 flex items-center sm:justify-end gap-1 font-mono">
                              <span>{formatCurrency(dec.previousWeeklyBudget)}/wk</span>
                              <ArrowRight className="w-3 h-3 text-brown-600" />
                              <span className="font-bold text-dark-green-900">
                                {formatCurrency(dec.newWeeklyBudget)}/wk
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-beige-50/80 border-t border-beige-100 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setDeletingCheckIn(editingCheckIn);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-alert-red-50 hover:bg-alert-red-100 text-alert-red-700 border border-alert-red-200 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-alert-red-600" />
                <span>Delete Check-In</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingCheckIn(null)}
                  className="px-4 py-2 bg-white hover:bg-beige-100 text-dark-green-900 border border-beige-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="flex items-center gap-1.5 px-5 py-2 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-60 text-white text-xs font-extrabold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCheckIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-beige-200 overflow-hidden p-6 space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-alert-red-100 text-alert-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-dark-green-950">
                  Delete Check-In Record?
                </h3>
                <p className="text-xs text-brown-700 leading-relaxed">
                  Are you sure you want to delete the completed check-in for{' '}
                  <strong className="text-dark-green-900">
                    {deletingCheckIn.weekStartDate} – {deletingCheckIn.weekEndDate}
                  </strong>
                  ?
                </p>
              </div>
            </div>

            <div className="bg-alert-red-50/70 border border-alert-red-200/80 rounded-2xl p-3.5 text-xs text-alert-red-900 space-y-1.5">
              <p className="font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-alert-red-700" />
                This will automatically:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-alert-red-800">
                <li>Remove this check-in from your completed ledger.</li>
                <li>Revert any future weekly category budget rollovers back to baseline.</li>
                <li>Re-enable completing or previewing this check-in period.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCheckIn(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 bg-white hover:bg-beige-100 text-dark-green-900 border border-beige-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-alert-red-600 hover:bg-alert-red-700 disabled:opacity-60 text-white text-xs font-extrabold rounded-xl shadow-xs transition cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Record</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
