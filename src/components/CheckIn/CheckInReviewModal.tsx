import React, { useState, useEffect } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { CheckIn } from '../../types';
import { formatCurrency } from '../../lib/calculations';
import {
  X,
  CheckCircle2,
  Calendar,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  MessageSquare,
  Save,
  Check,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface CheckInReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkIn: CheckIn | null;
}

export const CheckInReviewModal: React.FC<CheckInReviewModalProps> = ({
  isOpen,
  onClose,
  checkIn,
}) => {
  const { updateCheckInNotes, showToast } = useHousehold();
  const [reflectionNote, setReflectionNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (checkIn) {
      setReflectionNote(checkIn.notes || '');
      setHasSaved(false);
    }
  }, [checkIn]);

  if (!isOpen || !checkIn) return null;

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      await updateCheckInNotes(checkIn.id, reflectionNote.trim());
      setHasSaved(true);
      setTimeout(() => setHasSaved(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalSaved = Number(checkIn.totalSaved) || 0;
  const totalSpent = Number(checkIn.totalSpent) || 0;
  const totalBudget = Number(checkIn.totalBudget) || 0;

  const formatDateWithoutYear = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return dateStr;
  };

  return (
    <div
      id="checkin-review-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-beige-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-beige-100 bg-beige-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sage-100 text-dark-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-sage-700" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-dark-green-900">
                Check-In Review
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 bg-sage-100 px-2.5 py-0.5 rounded-full">
                  Read-Only
                </span>
                <span className="text-xs text-dark-grey-600">
                  {formatDateWithoutYear(checkIn.weekStartDate)} – {formatDateWithoutYear(checkIn.weekEndDate)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-beige-200 hover:bg-beige-100 text-brown-800 flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Hero Metrics Card */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-beige-50/80 border border-beige-200 rounded-2xl p-3 sm:p-4 text-center min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-brown-700 uppercase tracking-wider block truncate">
                SPENT
              </span>
              <span className="text-base sm:text-xl font-black text-dark-green-900 mt-0.5 block truncate">
                {formatCurrency(totalSpent)}
              </span>
              <span className="text-[9px] sm:text-[10px] text-dark-grey-600 mt-1 block truncate">
                of {formatCurrency(totalBudget)} budget
              </span>
            </div>

            <div className="bg-sage-50/80 border border-sage-200 rounded-2xl p-3 sm:p-4 text-center min-w-0">
              <span className="text-[10px] sm:text-[11px] font-bold text-sage-800 uppercase tracking-wider block truncate">
                SAVINGS
              </span>
              <span className="text-base sm:text-xl font-black text-dark-green-900 mt-0.5 block truncate">
                +{formatCurrency(totalSaved)}
              </span>
              <span className="text-[9px] sm:text-[10px] text-sage-700 mt-1 block truncate">
                banked
              </span>
            </div>
          </div>

          {/* Category Decisions Breakdown */}
          {checkIn.decisions && checkIn.decisions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sage-700" />
                <h3 className="text-sm font-extrabold text-dark-green-900">
                  Category Pacing & Decisions
                </h3>
              </div>

              <div className="divide-y divide-beige-100 border border-beige-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                {checkIn.decisions.map((dec, idx) => {
                  const isUnderspent = dec.difference > 0;
                  const isOverspent = dec.difference < 0;
                  const isSavings = dec.categoryName?.toLowerCase().includes('savings') || dec.categoryId === 'cat_savings';

                  let choiceBadge: string | null = 'On Budget';
                  let choiceClass = 'bg-beige-100 text-brown-800 border-beige-200';

                  if (isSavings) {
                    choiceBadge = null;
                  } else if (dec.choice === 'savings') {
                    const contrib = Number(dec.savingsContribution || dec.difference).toFixed(2);
                    choiceBadge = `+$${contrib} to Savings`;
                    choiceClass = 'bg-sage-100 text-dark-green-900 border-sage-300';
                  } else if (dec.choice === 'rollover') {
                    choiceBadge = 'Prorated to Remaining Weeks';
                    choiceClass = 'bg-sky-blue-100 text-sky-blue-900 border-sky-blue-300';
                  } else if (dec.choice === 'deduct_savings') {
                    const deduction = Number(dec.savingsDeduction || Math.abs(dec.difference)).toFixed(2);
                    choiceBadge = `Covered by Savings (-$${deduction})`;
                    choiceClass = 'bg-gold-100 text-gold-900 border-gold-300';
                  } else if (dec.choice === 'reduce_future') {
                    choiceBadge = 'Reduced Future Weekly Budgets';
                    choiceClass = 'bg-alert-red-100 text-alert-red-900 border-alert-red-300';
                  }

                  return (
                    <div
                      key={idx}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-beige-50/40 transition"
                    >
                      <div className="space-y-1">
                        <div>
                          <span className="text-xs font-bold text-dark-green-900">
                            {dec.categoryName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-dark-grey-600">
                          <span>
                            {isSavings ? 'Goal' : 'Budget'}: {formatCurrency(dec.budget)}
                          </span>
                          <span>&bull;</span>
                          <span>
                            {isSavings ? 'Banked' : 'Spent'}: {formatCurrency(dec.spent)}
                          </span>
                          <span>&bull;</span>
                          <span
                            className={
                              isUnderspent
                                ? 'text-sage-800 font-bold'
                                : isOverspent
                                ? isSavings
                                  ? 'text-brown-900 font-bold'
                                  : 'text-alert-red-600 font-bold'
                                : 'text-brown-700'
                            }
                          >
                            {isUnderspent
                              ? `+${formatCurrency(dec.difference)} surplus`
                              : isOverspent
                              ? isSavings
                                ? `-${formatCurrency(Math.abs(dec.difference))} missed`
                                : `-${formatCurrency(Math.abs(dec.difference))} deficit`
                              : 'Balanced'}
                          </span>
                        </div>

                        {choiceBadge && (
                          <div className="pt-0.5">
                            <span
                              title="Action"
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${choiceClass}`}
                            >
                              <ArrowRight className="w-3 h-3 shrink-0" />
                              <span>{choiceBadge}</span>
                            </span>
                          </div>
                        )}
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

          {/* Reflection Comment & Editing */}
          <div className="space-y-2.5 bg-beige-50/60 border border-beige-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sage-700" />
                <label
                  htmlFor="checkin-reflection-input"
                  className="text-xs font-bold text-dark-green-900"
                >
                  Household Reflection & Notes
                </label>
              </div>
              <span className="text-[10px] text-dark-grey-600">
                Editable anytime
              </span>
            </div>

            <textarea
              id="checkin-reflection-input"
              rows={3}
              value={reflectionNote}
              onChange={(e) => setReflectionNote(e.target.value)}
              placeholder="Add or update household notes, highlights, or context about this week's spending..."
              className="w-full px-3.5 py-2.5 bg-white border border-beige-300 rounded-xl text-xs text-brown-900 placeholder:text-brown-400 focus:outline-hidden focus:ring-2 focus:ring-dark-green-800 transition resize-none"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-dark-grey-600">
                {hasSaved ? (
                  <span className="text-sage-700 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Comment saved & activity feed updated!
                  </span>
                ) : (
                  'Edits persist directly to this check-in record.'
                )}
              </span>

              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Comment'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-beige-50/80 border-t border-beige-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-beige-100 text-dark-green-900 border border-beige-300 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
