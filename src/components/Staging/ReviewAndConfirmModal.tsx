import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { CategoryGroup, StagedExpense, BillFrequency } from '../../types';
import { formatCurrency } from '../../lib/calculations';
import { getFiscalWeekId } from '../../lib/fiscal445';
import { DepositCheckInImpactModal } from '../Modals/DepositCheckInImpactModal';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Receipt,
  Sparkles,
  Calendar,
  Tag,
  User,
  DollarSign,
  AlertCircle,
} from 'lucide-react';

const CATEGORY_GROUPS: CategoryGroup[] = ['Essentials', 'Fun Money', 'Bills', 'Savings'];

export const ReviewAndConfirmModal: React.FC = () => {
  const {
    isStagingModalOpen,
    closeStagingModal,
    stagedExpenses,
    addStagedItem,
    updateStagedItem,
    removeStagedItem,
    confirmAllStagedExpenses,
    categories,
    members,
    user,
    savingsGoals,
    checkIns,
    household,
    addOneOffDeposit,
  } = useHousehold();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [depositImpactState, setDepositImpactState] = useState<{
    isOpen: boolean;
    amount: number;
    description: string;
    date: string;
    checkIn: any;
    stagedIndex?: number;
  } | null>(null);

  if (!isStagingModalOpen) return null;

  const totalStagedAmount = stagedExpenses.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );

  const getCompletedCheckInForDate = (dateStr: string) => {
    if (!dateStr) return null;
    const fiscalYearEnd = household?.fiscalYearEndMonth || 12;
    const expFiscalWeekId = getFiscalWeekId(dateStr, fiscalYearEnd);
    return (
      (checkIns || []).find((ci) => {
        if (ci.status !== 'completed') return false;
        const ciWeekId =
          ci.fiscalWeekId ||
          getFiscalWeekId(ci.weekStartDate || ci.weekEndDate || ci.timestamp, fiscalYearEnd);
        if (ciWeekId && expFiscalWeekId && ciWeekId === expFiscalWeekId) return true;
        const cStart = ci.weekStartDate;
        const cEnd = ci.weekEndDate;
        return dateStr >= cStart && dateStr <= cEnd;
      }) || null
    );
  };

  const handleConfirm = async () => {
    // Check if any staged expense is a deposit belonging to a completed check-in
    const depositIndex = stagedExpenses.findIndex((item) => {
      const isDep =
        item.categoryId === 'cat_savings' ||
        item.depositDestination === 'savings_budget' ||
        item.tags?.includes('One-Time Deposit');
      if (!isDep) return false;
      return !!getCompletedCheckInForDate(item.date);
    });

    if (depositIndex !== -1) {
      const depItem = stagedExpenses[depositIndex];
      const completedCi = getCompletedCheckInForDate(depItem.date);
      if (completedCi) {
        setDepositImpactState({
          isOpen: true,
          amount: depItem.amount,
          description: depItem.description || 'One-Time Savings Deposit',
          date: depItem.date,
          checkIn: completedCi,
          stagedIndex: depositIndex,
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await confirmAllStagedExpenses();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDepositImpact = async () => {
    if (!depositImpactState) return;
    if (depositImpactState.stagedIndex !== undefined) {
      removeStagedItem(depositImpactState.stagedIndex);
    }
    await addOneOffDeposit({
      amount: depositImpactState.amount,
      description: depositImpactState.description,
      date: depositImpactState.date,
      payerMemberId: user?.userId || 'usr_self',
    });
    setDepositImpactState(null);
    if (stagedExpenses.length <= 1) {
      closeStagingModal();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl border border-beige-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-beige-200 flex items-center justify-between bg-beige-50/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 bg-sage-100 px-2.5 py-0.5 rounded-full">
                Review & Confirm
              </span>
              <span className="text-xs text-dark-grey-600">
                Review & Confirm Before Database Submission
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-dark-green-900 tracking-tight">
              Review & Confirm Expenses
            </h2>
            <p className="text-xs text-brown-700">
              Verify amounts and adjust categories or payers before updating the household ledger.
            </p>
          </div>
          <button
            onClick={closeStagingModal}
            className="p-2 rounded-full hover:bg-beige-200 text-brown-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Staging Summary Header Banner */}
        <div className="p-4 sm:px-6 bg-sage-50/70 border-b border-beige-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-dark-green-800" />
            <div>
              <span className="text-xs font-bold text-dark-green-900 block">
                {stagedExpenses.length} {stagedExpenses.length === 1 ? 'Item' : 'Items'} Ready to Log
              </span>
              <span className="text-[10px] text-brown-700">
                All entries will update category balances immediately.
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-dark-grey-600 block">
              Total to Commit
            </span>
            <span className="text-lg sm:text-xl font-black text-dark-green-900">
              {formatCurrency(totalStagedAmount)}
            </span>
          </div>
        </div>

        {/* Scrollable Staged Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {stagedExpenses.map((item, index) => {
            const validCategoryId =
              item.categoryId && categories.some((c) => c.id === item.categoryId)
                ? item.categoryId
                : categories[0]?.id || '';
            const selectedCategory = categories.find((c) => c.id === validCategoryId);

            return (
              <div
                key={index}
                className="p-4 bg-white border border-beige-200 hover:border-sage-300 rounded-2xl shadow-xs space-y-3 transition-colors relative"
              >
                <div className="flex items-center justify-between border-b border-beige-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-dark-green-900 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-dark-green-800 text-white text-[10px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      Expense Item #{index + 1}
                    </span>

                    {item.receiptImgUrl && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sage-100 text-dark-green-900 text-[10px] font-semibold">
                        <Receipt className="w-3 h-3 text-sage-700" />
                        <span>Receipt Attached</span>
                      </span>
                    )}
                  </div>

                  {stagedExpenses.length > 1 && (
                    <button
                      onClick={() => removeStagedItem(index)}
                      className="text-brown-700 hover:text-alert-red-700 p-1 rounded-lg hover:bg-alert-red-50 transition cursor-pointer text-xs flex items-center gap-1"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Remove</span>
                    </button>
                  )}
                </div>

                {/* Primary Row: Amount & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Amount Input */}
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-brown-700" />
                      Amount ($)
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-sm font-bold text-dark-green-900">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.amount || ''}
                        onChange={(e) =>
                          updateStagedItem(index, {
                            amount: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full pl-7 pr-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-sm font-extrabold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                      />
                    </div>
                  </div>

                  {/* Description / Merchant */}
                  <div className="sm:col-span-8 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                      Description / Merchant
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Trader Joe's, Shell Gas, Internet bill"
                      value={item.description}
                      onChange={(e) =>
                        updateStagedItem(index, {
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs sm:text-sm font-medium text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                    />
                  </div>
                </div>

                {/* Secondary Row: Category Dropdown, Date, Paid By */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Interactive Category Dropdown Override */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-brown-700" />
                      Category Dropdown
                    </label>
                    <select
                      value={validCategoryId}
                      onChange={(e) =>
                        updateStagedItem(index, {
                          categoryId: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({formatCurrency(cat.currentWeeklyBudget)}/wk)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-brown-700" />
                      Transaction Date
                    </label>
                    <input
                      type="date"
                      value={item.date}
                      onChange={(e) =>
                        updateStagedItem(index, {
                          date: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                    />
                  </div>

                  {/* Paid By Member Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 flex items-center gap-1">
                      <User className="w-3 h-3 text-brown-700" />
                      Paid By
                    </label>
                    <select
                      value={item.loggedByUserId}
                      onChange={(e) =>
                        updateStagedItem(index, {
                          loggedByUserId: e.target.value,
                        })
                      }
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

                {/* Deposit Destination Row (When item is savings/deposit) */}
                {(item.categoryId === 'cat_savings' || item.depositDestination) && (
                  <div className="p-3 bg-sage-50/80 border border-sage-200 rounded-xl space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-sage-700" />
                        Deposit Destination
                      </label>
                      <span className="text-[9px] font-extrabold text-sage-800 bg-sage-200/70 px-2 py-0.5 rounded-full">
                        Savings Allocation
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateStagedItem(index, {
                            depositDestination: 'savings_budget',
                            targetGoalId: undefined,
                            tags: ['One-Time Deposit', 'Budget Expansion'],
                          })
                        }
                        className={`p-2 rounded-lg text-left text-xs font-bold border transition cursor-pointer ${
                          item.depositDestination === 'savings_budget' || !item.depositDestination
                            ? 'bg-white border-dark-green-800 shadow-xs ring-1 ring-dark-green-800 text-dark-green-900'
                            : 'bg-white/60 border-sage-200 text-brown-800 hover:bg-white'
                        }`}
                      >
                        Expand Savings Budget
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updateStagedItem(index, {
                            depositDestination: 'goal',
                            targetGoalId: item.targetGoalId || savingsGoals[0]?.id || 'goal_emergency',
                            tags: ['One-Time Deposit', 'Goal Deposit'],
                          })
                        }
                        className={`p-2 rounded-lg text-left text-xs font-bold border transition cursor-pointer ${
                          item.depositDestination === 'goal'
                            ? 'bg-white border-dark-green-800 shadow-xs ring-1 ring-dark-green-800 text-dark-green-900'
                            : 'bg-white/60 border-sage-200 text-brown-800 hover:bg-white'
                        }`}
                      >
                        Direct Goal Deposit
                      </button>
                    </div>

                    {item.depositDestination === 'goal' && (
                      <div className="pt-1">
                        <select
                          value={item.targetGoalId || 'goal_emergency'}
                          onChange={(e) =>
                            updateStagedItem(index, {
                              targetGoalId: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 bg-white border border-sage-300 rounded-lg text-xs font-bold text-dark-green-900"
                        >
                          <option value="goal_emergency">
                            🛡️ Emergency Savings Fund (${formatCurrency(savingsGoals.find(g => g.id === 'goal_emergency')?.currentAmount || 0)} allocated)
                          </option>
                          {savingsGoals
                            .filter((g) => g.id !== 'goal_emergency')
                            .map((goal) => (
                              <option key={goal.id} value={goal.id}>
                                🎯 {goal.name} (${formatCurrency(goal.currentAmount || 0)} / {formatCurrency(goal.targetAmount || 0)})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Subcategory & Tags Display/Editor for non-savings items */}
                {item.categoryId !== 'cat_savings' && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 flex items-center gap-1 mr-1">
                      <Tag className="w-2.5 h-2.5" /> Tags:
                    </span>
                    {item.tags && item.tags.length > 0 ? (
                      item.tags.map((tag, tagIdx) => (
                        <span
                          key={tagIdx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sage-100 text-dark-green-900 text-[10px] font-bold"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => {
                              const newTags = item.tags?.filter((_, i) => i !== tagIdx);
                              updateStagedItem(index, {
                                tags: newTags && newTags.length > 0 ? newTags : undefined,
                                subcategory: newTags && newTags.length > 0 ? newTags[0] : undefined,
                              });
                            }}
                            className="text-brown-700 hover:text-alert-red-700 cursor-pointer ml-0.5"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-dark-grey-500 italic">No tags attached</span>
                    )}
                  </div>
                )}

                {/* Bill Frequency Row (When category is Bills or frequency is set) */}
                {(selectedCategory?.group === 'Bills' ||
                  selectedCategory?.name.toLowerCase().includes('bill') ||
                  item.billFrequency) && (
                  <div className="p-3 bg-sage-50/80 border border-sage-200 rounded-xl space-y-1.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-sage-700" />
                        Bill Billing Frequency
                      </label>
                      <span className="text-[9px] font-extrabold text-sage-800 bg-sage-200/70 px-2 py-0.5 rounded-full">
                        Paid-Only Proration
                      </span>
                    </div>

                    <select
                      value={item.billFrequency || 'monthly'}
                      onChange={(e) =>
                        updateStagedItem(index, {
                          billFrequency: e.target.value as BillFrequency,
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-sage-300 rounded-lg text-xs font-bold text-dark-green-900 focus:outline-none"
                    >
                      <option value="weekly">Weekly (Full expense charged to current week)</option>
                      <option value="monthly">Monthly (Prorated across current 4-4-5 month weeks)</option>
                      <option value="annually">Annually (Prorated across fiscal year / 52 weeks)</option>
                    </select>
                    <p className="text-[10px] text-brown-700 leading-tight">
                      Only the active prorated amount of this paid bill will be charged to the current fiscal period. Unpaid future recurring bills are not forward-generated.
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Another Item Button */}
          <button
            onClick={() => addStagedItem()}
            className="w-full py-3 border border-dashed border-beige-300 hover:border-sage-400 bg-beige-50/50 hover:bg-sage-50/50 text-dark-green-900 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-sage-700" />
            <span>+ Add Another Expense to Batch</span>
          </button>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-beige-200 bg-beige-50/90 flex items-center justify-between">
          <button
            onClick={closeStagingModal}
            className="px-4 py-2.5 rounded-xl border border-beige-300 text-brown-800 hover:bg-beige-100 text-xs font-bold transition cursor-pointer"
          >
            Discard
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-dark-grey-600 uppercase font-bold block">
                Total to Log
              </span>
              <span className="text-base font-black text-dark-green-900">
                {formatCurrency(totalStagedAmount)}
              </span>
            </div>

            <button
              onClick={handleConfirm}
              id="confirm-all-expenses-btn"
              disabled={isSubmitting || totalStagedAmount <= 0}
              className={`px-6 py-3 rounded-xl text-xs sm:text-sm font-extrabold shadow-sm transition flex items-center gap-2 cursor-pointer ${
                isSubmitting || totalStagedAmount <= 0
                  ? 'bg-beige-300 text-dark-grey-600 cursor-not-allowed'
                  : 'bg-dark-green-800 hover:bg-dark-green-900 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Writing to Ledger...'
                  : `Confirm All ${stagedExpenses.length > 1 ? `(${stagedExpenses.length} Expenses)` : 'Expense'}`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Deposit Impact Modal on Completed Check-In */}
      {depositImpactState?.isOpen && (
        <DepositCheckInImpactModal
          isOpen={depositImpactState.isOpen}
          onClose={() => setDepositImpactState(null)}
          depositAmount={depositImpactState.amount}
          depositDescription={depositImpactState.description}
          depositDate={depositImpactState.date}
          checkIn={depositImpactState.checkIn}
          household={household}
          categories={categories}
          onConfirm={handleConfirmDepositImpact}
        />
      )}
    </div>
  );
};
