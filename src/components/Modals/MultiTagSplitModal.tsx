import React, { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '../../lib/calculations';
import { Layers, ArrowRight, Check, X, Tag as TagIcon, PieChart, Sparkles, AlertCircle } from 'lucide-react';

export interface MultiTagSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  description: string;
  categoryName?: string;
  tags: string[];
  onConfirmSplit: (splitItems: Array<{ tag: string; amount: number; description: string }>) => void;
  onKeepSingle: () => void;
}

export const MultiTagSplitModal: React.FC<MultiTagSplitModalProps> = ({
  isOpen,
  onClose,
  totalAmount,
  description,
  categoryName,
  tags,
  onConfirmSplit,
  onKeepSingle,
}) => {
  // Local state for split amounts per tag
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  const [splitDescriptions, setSplitDescriptions] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'choose' | 'customize'>('choose');

  // Initialize even split when opened or tags change
  useEffect(() => {
    if (!isOpen || tags.length === 0) return;

    const count = tags.length;
    const baseSplit = Math.floor((totalAmount / count) * 100) / 100;
    let remainder = Math.round((totalAmount - baseSplit * count) * 100) / 100;

    const initialAmounts: Record<string, number> = {};
    const initialDescriptions: Record<string, string> = {};

    tags.forEach((tag, idx) => {
      let amt = baseSplit;
      if (idx === count - 1) {
        amt = Math.round((baseSplit + remainder) * 100) / 100;
      }
      initialAmounts[tag] = Math.max(0, amt);
      initialDescriptions[tag] = `${description || 'Expense'} (${tag})`;
    });

    setSplitAmounts(initialAmounts);
    setSplitDescriptions(initialDescriptions);
    setMode('choose');
  }, [isOpen, totalAmount, description, tags]);

  const currentSum = useMemo(() => {
    return Object.values(splitAmounts).reduce((sum: number, val: number) => sum + (Number(val) || 0), 0);
  }, [splitAmounts]);

  const sumDiff = Math.round((totalAmount - currentSum) * 100) / 100;
  const isSumBalanced = Math.abs(sumDiff) < 0.01;

  if (!isOpen || tags.length <= 1) return null;

  const handleAmountChange = (tag: string, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setSplitAmounts((prev) => ({
      ...prev,
      [tag]: Math.max(0, val),
    }));
  };

  const handleDescriptionChange = (tag: string, val: string) => {
    setSplitDescriptions((prev) => ({
      ...prev,
      [tag]: val,
    }));
  };

  const handleEvenSplitClick = () => {
    const count = tags.length;
    const baseSplit = Math.floor((totalAmount / count) * 100) / 100;
    const remainder = Math.round((totalAmount - baseSplit * count) * 100) / 100;

    const newAmounts: Record<string, number> = {};
    tags.forEach((tag, idx) => {
      let amt = baseSplit;
      if (idx === count - 1) {
        amt = Math.round((baseSplit + remainder) * 100) / 100;
      }
      newAmounts[tag] = Math.max(0, amt);
    });
    setSplitAmounts(newAmounts);
  };

  const handleConfirmSplitAction = () => {
    if (!isSumBalanced) return;

    const items = tags.map((tag) => ({
      tag,
      amount: Number(splitAmounts[tag]) || 0,
      description: (splitDescriptions[tag] || `${description} (${tag})`).trim(),
    }));

    onConfirmSplit(items);
  };

  const perTagShare = Math.round((totalAmount / tags.length) * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl border border-beige-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-beige-200 bg-beige-50/80 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-dark-green-900 bg-sage-100 border border-sage-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Layers className="w-3 h-3 text-dark-green-800" />
                Multiple Tags Detected
              </span>
              <span className="text-xs font-bold text-brown-800">
                {tags.length} Tags Selected
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-dark-green-900 tracking-tight">
              Split into Separate Transactions?
            </h2>
            <p className="text-xs text-brown-700">
              You selected multiple tags for this {formatCurrency(totalAmount)} transaction.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-beige-200 text-brown-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Summary Banner */}
        <div className="p-4 sm:px-6 bg-sage-50/60 border-b border-beige-200 flex items-center justify-between">
          <div className="space-y-1 min-w-0 pr-2">
            <span className="text-[10px] uppercase font-bold text-dark-grey-600 block">
              {categoryName ? `${categoryName} Transaction` : 'Transaction'}
            </span>
            <span className="text-sm font-bold text-dark-green-900 block truncate">
              {description || 'Manual Transaction'}
            </span>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-white border border-sage-200 text-[10px] font-extrabold text-dark-green-900"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xl sm:text-2xl font-black font-mono text-dark-green-900">
              {formatCurrency(totalAmount)}
            </span>
            <span className="text-[10px] text-brown-700 font-medium block">
              Total Amount
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {mode === 'choose' ? (
            <div className="space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-dark-grey-600 block">
                Choose how to record this transaction:
              </span>

              {/* Option 1: Create Separate Transactions */}
              <div
                onClick={() => setMode('customize')}
                className="p-4 rounded-2xl border-2 border-sage-300 hover:border-dark-green-800 bg-sage-50/40 hover:bg-sage-50/80 transition cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-dark-green-800 text-white flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-black text-dark-green-900 block">
                        Create {tags.length} Separate Transactions
                      </span>
                      <span className="text-[10px] text-sage-800 font-bold">
                        Recommended for distinct line items
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-dark-green-800 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Customize & Split <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-[11px] text-brown-700 leading-relaxed">
                  Creates {tags.length} individual transactions (one dedicated transaction per tag with its own amount and description).
                </p>
              </div>

              {/* Option 2: Keep as Single Multi-Tagged Transaction */}
              <div
                onClick={onKeepSingle}
                className="p-4 rounded-2xl border-2 border-beige-200 hover:border-beige-400 bg-beige-50/50 hover:bg-beige-50/90 transition cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-beige-200 text-brown-800 flex items-center justify-center">
                      <PieChart className="w-4 h-4 text-brown-700" />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-black text-dark-green-900 block">
                        Keep as 1 Single Multi-Tagged Transaction
                      </span>
                      <span className="text-[10px] text-brown-700 font-medium">
                        Divide equally in pie charts
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-brown-800 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    Keep Single <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-[11px] text-brown-700 leading-relaxed">
                  Creates 1 single transaction with all {tags.length} tags attached. The expense tracking pie graph will automatically divide the {formatCurrency(totalAmount)} transaction by {tags.length} and allocate {formatCurrency(perTagShare)} to each tag category.
                </p>
              </div>
            </div>
          ) : (
            /* Customize Split Breakdown */
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-dark-grey-600">
                  Allocate Amount per Tag:
                </span>
                <button
                  type="button"
                  onClick={handleEvenSplitClick}
                  className="text-[11px] font-bold text-dark-green-800 hover:underline cursor-pointer"
                >
                  Split Evenly ({formatCurrency(perTagShare)} each)
                </button>
              </div>

              <div className="space-y-2.5">
                {tags.map((tag) => (
                  <div
                    key={tag}
                    className="p-3 bg-beige-50/80 border border-beige-200 rounded-2xl space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="px-2.5 py-1 rounded-xl bg-sage-100 border border-sage-200 text-xs font-extrabold text-dark-green-900 flex items-center gap-1 shrink-0">
                        <TagIcon className="w-3 h-3 text-sage-700" />
                        #{tag}
                      </span>
                      <div className="relative flex items-center w-36">
                        <span className="absolute left-3 text-xs font-bold text-dark-green-900">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={splitAmounts[tag] !== undefined ? splitAmounts[tag] : ''}
                          onChange={(e) => handleAmountChange(tag, e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 bg-white border border-beige-300 rounded-xl text-xs font-extrabold text-dark-green-900 text-right focus:outline-none focus:border-dark-green-800"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      value={splitDescriptions[tag] || ''}
                      onChange={(e) => handleDescriptionChange(tag, e.target.value)}
                      placeholder={`Description for #${tag}`}
                      className="w-full px-3 py-1.5 bg-white border border-beige-300 rounded-xl text-xs font-medium text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                    />
                  </div>
                ))}
              </div>

              {/* Sum Balancing Status */}
              <div
                className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                  isSumBalanced
                    ? 'bg-sage-50 border-sage-200 text-dark-green-900'
                    : 'bg-alert-red-50 border-alert-red-200 text-alert-red-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isSumBalanced ? (
                    <Check className="w-4 h-4 text-sage-700 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-alert-red-600 shrink-0" />
                  )}
                  <span className="font-bold">
                    {isSumBalanced
                      ? 'Total amounts balanced'
                      : sumDiff > 0
                      ? `Unallocated: ${formatCurrency(sumDiff)} remaining`
                      : `Overallocated: ${formatCurrency(Math.abs(sumDiff))} excess`}
                  </span>
                </div>
                <span className="font-mono font-black">
                  {formatCurrency(currentSum)} / {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-beige-200 bg-beige-50/60 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {mode === 'customize' ? (
            <>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-beige-300 text-xs font-bold text-brown-800 hover:bg-beige-100 transition cursor-pointer"
              >
                Back to Options
              </button>
              <button
                type="button"
                onClick={handleConfirmSplitAction}
                disabled={!isSumBalanced}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-40"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Create {tags.length} Separate Transactions</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-beige-300 text-xs font-bold text-brown-800 hover:bg-beige-100 transition cursor-pointer"
              >
                Cancel / Edit Tags
              </button>
              <button
                type="button"
                onClick={onKeepSingle}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <span>Continue with 1 Multi-Tagged Transaction</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
