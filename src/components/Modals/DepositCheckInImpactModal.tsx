import React, { useMemo, useState } from 'react';
import { CheckIn, Category, Household } from '../../types';
import { formatCurrency, getWeekRange, getWeekId } from '../../lib/calculations';
import { getFiscalTrackerInfo } from '../../lib/fiscal445';
import { PiggyBank, ArrowRight, ShieldCheck, CheckCircle2, X, Sparkles, TrendingUp, Info } from 'lucide-react';

export interface DepositCheckInImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  depositAmount: number;
  depositDescription?: string;
  depositDate: string;
  checkIn: CheckIn;
  household: Household | null;
  categories: Category[];
  onConfirm: () => Promise<void> | void;
}

export const DepositCheckInImpactModal: React.FC<DepositCheckInImpactModalProps> = ({
  isOpen,
  onClose,
  depositAmount,
  depositDescription = 'One-Time Deposit',
  depositDate,
  checkIn,
  household,
  categories,
  onConfirm,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const fiscalYearEnd = household?.fiscalYearEndMonth || 12;
  const weekStart = new Date(checkIn.weekStartDate + (checkIn.weekStartDate.length === 10 ? 'T12:00:00' : ''));
  const trackerInfo = getFiscalTrackerInfo(weekStart, fiscalYearEnd);
  const weekLabel = `W${trackerInfo.weekOfFiscalYear} (M${trackerInfo.fiscalMonthNumber} W${trackerInfo.weekOfFiscalMonth})`;

  const savingsCat = useMemo(() => {
    return categories.find(
      (c) => c.id === 'cat_savings' || c.type === 'savings' || c.group?.toLowerCase() === 'savings'
    );
  }, [categories]);

  const baseSavings = Number(savingsCat?.baselineBudget) || 650;

  const weekId = useMemo(() => {
    const wRange = getWeekRange(weekStart, household?.firstDayOfWeek || 'Monday', 0);
    return getWeekId(wRange, household?.firstDayOfWeek || 'Monday');
  }, [weekStart, household?.firstDayOfWeek]);

  // Current savings budget for that week prior to this new deposit
  const currentSavingsBudget = useMemo(() => {
    const override = household?.weeklyOverrides?.[weekId];
    if (override && override.savings !== undefined) {
      return Number(override.savings);
    }
    if (override && savingsCat && override[savingsCat.id] !== undefined) {
      return Number(override[savingsCat.id]);
    }
    const savDec = (checkIn.decisions || []).find(
      (d) => d.categoryId === savingsCat?.id || d.categoryName?.toLowerCase().includes('savings')
    );
    if (savDec && savDec.budget !== undefined) {
      return Number(savDec.budget);
    }
    return baseSavings;
  }, [household?.weeklyOverrides, weekId, savingsCat, checkIn.decisions, baseSavings]);

  const newSavingsBudget = currentSavingsBudget + depositAmount;

  // Current banked savings recorded in the check-in
  const currentTotalSaved = typeof checkIn.totalSaved === 'number' ? checkIn.totalSaved : baseSavings;
  const newTotalSaved = currentTotalSaved + depositAmount;

  // Savings used in coverage during check-in
  const savingsCoverageUsed = useMemo(() => {
    const savDec = (checkIn.decisions || []).find(
      (d) => d.categoryId === savingsCat?.id || d.categoryName?.toLowerCase().includes('savings')
    );
    if (savDec && savDec.savingsDeduction !== undefined) {
      return Number(savDec.savingsDeduction);
    }
    return 0;
  }, [checkIn.decisions, savingsCat]);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl border border-beige-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-beige-200 bg-beige-50/80 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-dark-green-900 bg-sage-100 border border-sage-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <PiggyBank className="w-3 h-3 text-dark-green-800" />
                Checked-In Week Detected
              </span>
              <span className="text-xs font-bold text-brown-800">
                {weekLabel}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-dark-green-900 tracking-tight">
              One-Time Deposit Check-In Effect
            </h2>
            <p className="text-xs text-brown-700">
              This deposit is dated for a week that has already completed its weekly check-in.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-beige-200 text-brown-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Deposit Summary Banner */}
        <div className="p-4 sm:px-6 bg-sage-50/60 border-b border-beige-200 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-dark-grey-600 block">
              Incoming Deposit
            </span>
            <span className="text-sm font-bold text-dark-green-900 block truncate max-w-[220px]">
              {depositDescription || 'One-Time Savings Deposit'}
            </span>
            <span className="text-[11px] text-brown-700">
              Date: {depositDate}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-black font-mono text-dark-green-900">
              +{formatCurrency(depositAmount)}
            </span>
            <span className="text-[9px] font-extrabold text-sage-800 uppercase block">
              Budget Expansion
            </span>
          </div>
        </div>

        {/* Impact Comparison Cards */}
        <div className="p-5 sm:p-6 space-y-4">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-dark-grey-600 block">
            Check-In Results Update Preview:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Metric 1: Total Banked Savings */}
            <div className="p-3.5 bg-beige-50/70 border border-beige-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-dark-grey-600">
                  Banked Savings
                </span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sage-100 text-dark-green-900 border border-sage-300">
                  Increased
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold font-mono text-dark-grey-600 line-through">
                  {formatCurrency(currentTotalSaved)}
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-sage-600" />
                <div className="text-base font-black font-mono text-dark-green-900">
                  {formatCurrency(newTotalSaved)}
                </div>
              </div>
              <p className="text-[10px] text-brown-700 leading-tight">
                Increases {weekLabel} banked savings by +{formatCurrency(depositAmount)}.
              </p>
            </div>

            {/* Metric 2: Savings Goal / Budget */}
            <div className="p-3.5 bg-beige-50/70 border border-beige-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-dark-grey-600">
                  Savings Goal
                </span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sage-100 text-dark-green-900 border border-sage-300">
                  Expanded
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold font-mono text-dark-grey-600 line-through">
                  {formatCurrency(currentSavingsBudget)}
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-sage-600" />
                <div className="text-base font-black font-mono text-dark-green-900">
                  {formatCurrency(newSavingsBudget)}
                </div>
              </div>
              <p className="text-[10px] text-brown-700 leading-tight">
                Weekly budget expands by +{formatCurrency(depositAmount)} for that week.
              </p>
            </div>
          </div>

          {/* Context Note Box */}
          <div className="p-3.5 bg-sage-50/80 border border-sage-200 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-dark-green-900">
              <ShieldCheck className="w-4 h-4 text-sage-700 shrink-0" />
              <span>Coverage & Retrospective Integrity Preserved</span>
            </div>
            <p className="text-[11px] text-brown-700 leading-relaxed">
              {savingsCoverageUsed > 0
                ? `The ${formatCurrency(savingsCoverageUsed)} previously used for overspend coverage remains unchanged. The new deposit adds directly to your protected banked savings.`
                : 'All previous category decisions and rollover choices remain preserved. Your weekly and monthly savings progress bars will update immediately.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 sm:p-5 border-t border-beige-200 bg-beige-50/60 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-beige-300 text-xs font-bold text-brown-800 hover:bg-beige-100 transition cursor-pointer"
          >
            Cancel / Change Date
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isProcessing}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <span>Updating Check-In...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-sage-300" />
                <span>Apply Deposit & Update {weekLabel} Check-In</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
