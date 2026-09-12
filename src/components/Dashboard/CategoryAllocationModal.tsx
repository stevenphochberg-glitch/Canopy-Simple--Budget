import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { Category, CategoryGroup } from '../../types';
import { formatCurrency } from '../../lib/calculations';
import {
  X,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { CategoryIcon } from '../Common/CategoryIcon';

interface CategoryAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Exactly 4 default category icons + 6 visually distinct minimalist icons = 10 clean icons
const DEFAULT_LUCIDE_ICONS = [
  'shopping-bag', // Essentials
  'sparkles',     // Fun Money
  'file-text',    // Bills
  'piggy-bank',   // Savings
  'utensils',     // Dining & Groceries
  'coffee',       // Coffee & Drinks
  'car',          // Transit & Auto
  'home',         // Housing & Maintenance
  'plane',        // Travel & Holidays
  'heart',        // Health & Wellness
];

export const CategoryAllocationModal: React.FC<CategoryAllocationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    household,
    categories,
    saveCategoryAllocations,
    createCategory,
    deleteCategory,
    showToast,
  } = useHousehold();

  // Local draft of category budgets
  const [draftCategories, setDraftCategories] = useState<Category[]>(() => categories);

  // New Bucket / Category Form State
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('shopping-bag');
  const [newType, setNewType] = useState<'expense' | 'savings'>('expense');
  const [newSubcategories, setNewSubcategories] = useState('');
  const [newAllocation, setNewAllocation] = useState<number>(50);

  // Explicit approval prompt state for permanent baseline changes
  const [showApprovalPrompt, setShowApprovalPrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Keep draft in sync if categories change while closed
  React.useEffect(() => {
    setDraftCategories(categories);
    setShowApprovalPrompt(false);
  }, [categories, isOpen]);

  if (!isOpen) return null;

  const weeklyIncomePool = household?.weeklyIncomePool || 0;
  const totalAllocated = draftCategories.reduce(
    (sum, cat) => sum + (Number(cat.baselineBudget) || 0),
    0
  );
  const unallocated = weeklyIncomePool - totalAllocated;
  const isOverAllocated = unallocated < 0;

  // Identify categories with actual baseline modifications
  const modifiedCategories = draftCategories.filter((draft) => {
    const original = categories.find((c) => c.id === draft.id);
    if (!original) return true;
    return Number(draft.baselineBudget) !== Number(original.baselineBudget);
  });

  const handleBudgetChange = (catId: string, value: number) => {
    const safeVal = Math.max(0, isNaN(value) ? 0 : value);
    setDraftCategories((prev) =>
      prev.map((c) =>
        c.id === catId
          ? { ...c, baselineBudget: safeVal, currentWeeklyBudget: safeVal }
          : c
      )
    );
  };

  const handleInitiateSave = () => {
    if (isOverAllocated) {
      showToast('Total allocations exceed your weekly income pool. Please adjust category amounts.');
      return;
    }

    if (modifiedCategories.length === 0) {
      onClose();
      return;
    }

    setShowApprovalPrompt(true);
  };

  const handleConfirmSaveAll = async () => {
    setIsSaving(true);
    try {
      await saveCategoryAllocations(draftCategories);
      setShowApprovalPrompt(false);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    if (totalAllocated + newAllocation > weeklyIncomePool) {
      showToast('New bucket allocation would exceed weekly income pool.');
    }

    const subcategoryArray = newSubcategories
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    await createCategory({
      name: newName.trim(),
      group: newName.trim(),
      type: newType,
      icon: newIcon,
      color: 'sage',
      baselineBudget: newAllocation,
      currentWeeklyBudget: newAllocation,
      subcategories: subcategoryArray.length > 0 ? subcategoryArray : [newName.trim()],
      description: subcategoryArray.length > 0 ? `Includes: ${subcategoryArray.join(', ')}` : `${newName.trim()} budget bucket.`,
    });

    setNewName('');
    setNewType('expense');
    setNewSubcategories('');
    setNewAllocation(50);
    setIsAddingNew(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (draftCategories.length <= 1) {
      showToast('You must have at least one budget bucket.');
      return;
    }
    await deleteCategory(id);
    setDraftCategories((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl border border-beige-200 shadow-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-3 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header - Reduced static padding for mobile screens */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3.5 border-b border-beige-200 flex items-center justify-between bg-beige-50/80 shrink-0">
          <div>
            <span className="text-[10px] sm:text-xs font-semibold text-dark-grey-600 uppercase tracking-wider block">
              Budget Allocation
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-dark-green-900 leading-tight">
              Manage Budget Buckets
            </h2>
            <p className="text-[11px] sm:text-xs text-brown-700">
              Allocate weekly pool ({formatCurrency(weeklyIncomePool)}/wk) across top-level buckets.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-full hover:bg-beige-200 text-brown-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Allocation Summary Header */}
        <div className="p-2 sm:p-2.5 sm:px-6 bg-beige-100/70 border-b border-beige-200 grid grid-cols-3 gap-2 sm:gap-3 text-center shrink-0">
          <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-beige-200 shadow-xs">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block truncate">
              Weekly Pool
            </span>
            <span className="text-xs sm:text-base font-black text-dark-green-900">
              {formatCurrency(weeklyIncomePool)}
            </span>
          </div>

          <div className="bg-white p-1.5 sm:p-2 rounded-xl border border-beige-200 shadow-xs">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block truncate">
              Total Allocated
            </span>
            <span
              className={`text-xs sm:text-base font-black ${
                isOverAllocated ? 'text-red-600' : 'text-dark-green-900'
              }`}
            >
              {formatCurrency(totalAllocated)}
            </span>
          </div>

          <div
            className={`p-1.5 sm:p-2 rounded-xl border shadow-xs ${
              isOverAllocated
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-sage-50 border-sage-200 text-sage-900'
            }`}
          >
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block truncate">
              {isOverAllocated ? 'Over Budget' : 'Buffer'}
            </span>
            <span className="text-xs sm:text-base font-black">
              {isOverAllocated
                ? `-${formatCurrency(Math.abs(unallocated))}`
                : formatCurrency(unallocated)}
            </span>
          </div>
        </div>

        {/* Scrollable Categories List & Forms - Responsive max height and mobile keyboard scroll */}
        <div className="flex-1 overflow-y-auto max-h-[80vh] p-3.5 sm:p-6 space-y-4 sm:space-y-6 overscroll-contain pb-8">
          {isOverAllocated && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-xs text-red-800 font-semibold">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span>
                Total category allocations exceed your weekly income pool by {formatCurrency(Math.abs(unallocated))}. Please decrease some buckets before saving.
              </span>
            </div>
          )}

          {/* Buckets Listing */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-beige-200 pb-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900">
                Top-Level Budget Buckets ({draftCategories.length})
              </span>
              <span className="text-xs font-bold text-dark-green-900">
                Total: {formatCurrency(totalAllocated)}/wk
              </span>
            </div>

            <div className="space-y-2.5">
              {draftCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3 bg-beige-50/50 hover:bg-beige-50 border border-beige-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 flex-shrink-0">
                      <CategoryIcon name={cat.name} group={cat.group} icon={cat.icon} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-dark-green-900 text-sm block truncate">
                          {cat.name}
                        </span>
                        <span className="text-[10px] font-semibold text-brown-800 bg-beige-100 px-2 py-0.2 rounded-md">
                          {cat.group}
                        </span>
                      </div>
                      {cat.subcategories && cat.subcategories.length > 0 ? (
                        <span className="text-[11px] text-brown-700 block truncate">
                          Examples: {cat.subcategories.join(', ')}
                        </span>
                      ) : (
                        <span className="text-[11px] text-dark-grey-600 block">
                          Monthly equivalent: {formatCurrency(((cat.baselineBudget || 0) * 52) / 12)}/mo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Numeric Budget Input */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className="relative flex items-center">
                      <span className="absolute left-2.5 text-xs text-dark-grey-600 font-bold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={cat.baselineBudget !== undefined ? cat.baselineBudget : ''}
                        onChange={(e) => handleBudgetChange(cat.id, parseFloat(e.target.value))}
                        className="w-24 sm:w-28 pl-6 pr-2.5 py-1.5 bg-white border border-beige-300 rounded-xl text-sm font-bold text-dark-green-900 text-right focus:outline-none focus:border-dark-green-800"
                      />
                      <span className="text-[10px] text-brown-700 font-medium ml-1">
                        /wk
                      </span>
                    </div>

                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-2 text-brown-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                      title="Delete bucket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Custom Category Form / Button */}
          {isAddingNew ? (
            <form
              onSubmit={handleCreateCategory}
              className="p-4 bg-white border-2 border-dashed border-sage-300 rounded-2xl space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-dark-green-900">
                  Add Top-Level Budget Bucket
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-xs text-brown-700 hover:text-dark-green-900 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                    Bucket Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Travel & Vacation"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-medium text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                    Weekly Allocation ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={newAllocation}
                    onChange={(e) => setNewAllocation(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                  />
                </div>
              </div>

              {/* Category Classification: Expense vs Savings */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                  Category Classification *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('expense')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                      newType === 'expense'
                        ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-xs'
                        : 'bg-beige-50 border-beige-300 text-dark-green-900 hover:bg-beige-100'
                    }`}
                  >
                    <span className="text-xs font-bold">Expense Bucket</span>
                    <span className={`text-[10px] ${newType === 'expense' ? 'text-sage-200' : 'text-dark-grey-600'}`}>
                      Tracks weekly spending against baseline cap
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewType('savings')}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                      newType === 'savings'
                        ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-xs'
                        : 'bg-beige-50 border-beige-300 text-dark-green-900 hover:bg-beige-100'
                    }`}
                  >
                    <span className="text-xs font-bold">Savings Bucket</span>
                    <span className={`text-[10px] ${newType === 'savings' ? 'text-sage-200' : 'text-dark-grey-600'}`}>
                      Tracks progressive savings accumulations & goals
                    </span>
                  </button>
                </div>
              </div>

              {/* Subcategories comma separated */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                  Subcategories (comma separated examples)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Flights, Hotels, Dining on trips"
                  value={newSubcategories}
                  onChange={(e) => setNewSubcategories(e.target.value)}
                  className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-medium text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                />
              </div>

              {/* Icon Selector (Lucide earth tone) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                  Select Earth-Tone Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_LUCIDE_ICONS.map((iconKey) => (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setNewIcon(iconKey)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                        newIcon === iconKey
                          ? 'bg-sage-200 border-2 border-dark-green-800 text-dark-green-900 scale-105 shadow-xs'
                          : 'bg-beige-100 border border-beige-200 text-brown-800 hover:bg-beige-200'
                      }`}
                    >
                      <CategoryIcon icon={iconKey} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
              >
                + Add Bucket to Household
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAddingNew(true)}
              className="w-full py-3 border border-dashed border-beige-300 hover:border-sage-400 bg-beige-50/50 hover:bg-sage-50/50 text-dark-green-900 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-sage-700" />
              <span>Add Another Top-Level Bucket</span>
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-beige-200 bg-beige-50/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-beige-300 text-brown-800 hover:bg-beige-100 text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleInitiateSave}
            disabled={isOverAllocated}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer ${
              isOverAllocated
                ? 'bg-beige-300 text-dark-grey-600 cursor-not-allowed'
                : 'bg-dark-green-800 hover:bg-dark-green-900 text-white'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>Save Category Allocations</span>
          </button>
        </div>

        {/* Explicit Approval Prompt Modal */}
        {showApprovalPrompt && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-dark-green-950/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl border border-beige-300 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-dark-green-800" />
                </div>
                <div>
                  <h4 className="text-base font-black text-dark-green-900">
                    Confirm Baseline Budget Change
                  </h4>
                  <p className="text-xs text-dark-grey-600">
                    Are you sure you want to permanently alter your weekly budget allocations?
                  </p>
                </div>
              </div>

              <div className="bg-beige-50 border border-beige-200 rounded-2xl p-3.5 space-y-2 max-h-56 overflow-y-auto">
                <div className="text-[11px] font-bold uppercase tracking-wider text-brown-800 pb-1 border-b border-beige-200">
                  Updated Baseline Allocations:
                </div>
                {modifiedCategories.map((cat) => {
                  const orig = categories.find((c) => c.id === cat.id);
                  const oldVal = orig?.baselineBudget ?? 0;
                  const newVal = cat.currentWeeklyBudget;
                  const diff = newVal - oldVal;

                  return (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between text-xs py-1 px-1.5"
                    >
                      <span className="font-semibold text-dark-green-900 truncate">
                        {cat.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className="line-through text-dark-grey-600 text-[11px]">
                          {formatCurrency(oldVal)}
                        </span>
                        <span className="font-bold text-dark-green-900">
                          &rarr; {formatCurrency(newVal)}/wk
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                            diff >= 0 ? 'bg-sage-100 text-sage-900' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {diff >= 0 ? `+${formatCurrency(diff)}` : `-${formatCurrency(Math.abs(diff))}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-brown-700 bg-sage-50/70 border border-sage-200/80 rounded-xl p-3 leading-relaxed">
                This will permanently change the baseline weekly targets used for your weekly planning and monthly fiscal anchors.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApprovalPrompt(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl border border-beige-300 text-brown-800 hover:bg-beige-100 text-xs font-bold transition cursor-pointer"
                >
                  Cancel / Keep Editing
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveAll}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isSaving ? (
                    <span>Saving Changes...</span>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirm & Apply Baseline Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
