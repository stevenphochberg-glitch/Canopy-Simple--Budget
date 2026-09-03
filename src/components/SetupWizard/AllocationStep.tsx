import React, { useState } from 'react';
import { Category } from '../../types';
import { formatCurrency } from '../../lib/calculations';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  DollarSign,
  Sparkles,
} from 'lucide-react';
import { CategoryIcon } from '../Common/CategoryIcon';

interface AllocationStepProps {
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  weeklyIncomePool: number;
  onNext: () => void;
  onBack: () => void;
}

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

export const AllocationStep: React.FC<AllocationStepProps> = ({
  categories,
  setCategories,
  weeklyIncomePool,
  onNext,
  onBack,
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('shopping-bag');
  const [newSubcategories, setNewSubcategories] = useState('');
  const [newAllocation, setNewAllocation] = useState<number>(50);

  const totalAllocated = categories.reduce(
    (sum, cat) => sum + (Number(cat.currentWeeklyBudget) || 0),
    0
  );
  const unallocated = weeklyIncomePool - totalAllocated;
  const isOverAllocated = unallocated < 0;
  const isPerfectMatch = unallocated === 0;

  const handleBudgetChange = (catId: string, value: number) => {
    const safeVal = Math.max(0, isNaN(value) ? 0 : Math.round(value));
    setCategories((prev) =>
      prev.map((c) =>
        c.id === catId
          ? { ...c, currentWeeklyBudget: safeVal, baselineBudget: safeVal }
          : c
      )
    );
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const subcategoryArray = newSubcategories
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newCat: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newName.trim(),
      group: newName.trim(),
      icon: newIcon,
      color: 'sage',
      baselineBudget: newAllocation,
      currentWeeklyBudget: newAllocation,
      subcategories: subcategoryArray.length > 0 ? subcategoryArray : [newName.trim()],
      description:
        subcategoryArray.length > 0
          ? `Includes: ${subcategoryArray.join(', ')}`
          : `${newName.trim()} budget bucket.`,
    };

    setCategories((prev) => [...prev, newCat]);
    setNewName('');
    setNewSubcategories('');
    setNewAllocation(50);
    setIsAddingNew(false);
  };

  const handleDelete = (id: string) => {
    if (categories.length <= 1) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAutoBalance = () => {
    if (weeklyIncomePool <= 0 || categories.length === 0) return;
    const currentSum = categories.reduce((s, c) => s + (c.baselineBudget || 1), 0);
    if (currentSum === 0) return;

    let remainder = weeklyIncomePool;
    const balanced = categories.map((cat, idx) => {
      const isLast = idx === categories.length - 1;
      const portion = isLast
        ? remainder
        : Math.round(weeklyIncomePool * ((cat.baselineBudget || 1) / currentSum));
      remainder -= portion;
      return {
        ...cat,
        baselineBudget: portion,
        currentWeeklyBudget: portion,
      };
    });
    setCategories(balanced);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-2xl font-bold text-dark-green-900">Budget Bucket Allocation</h2>
        <p className="text-sm text-brown-700">
          Confirm, customize, or add default budget envelopes for your household before launching your live ledger.
        </p>
      </div>

      {/* Income Pool & Allocation Tracker Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-br from-sage-100 to-beige-100 border border-sage-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-dark-green-800 text-white rounded-xl shadow-xs">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-dark-green-800">
              Weekly Income Pool
            </span>
            <div className="text-2xl font-extrabold text-dark-green-900">
              {formatCurrency(weeklyIncomePool)}
              <span className="text-xs font-normal text-brown-700 ml-1">/ week</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-1.5 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-dark-grey-600">Allocated:</span>
            <span className="text-sm font-bold text-dark-green-950">
              {formatCurrency(totalAllocated)}
            </span>
            <span className="text-xs text-dark-grey-600">
              ({weeklyIncomePool > 0 ? Math.round((totalAllocated / weeklyIncomePool) * 100) : 0}%)
            </span>
          </div>

          {isPerfectMatch && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-sage-800 bg-sage-200/80 px-2.5 py-1 rounded-lg border border-sage-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-sage-700" />
              <span>100% Perfectly Allocated</span>
            </div>
          )}

          {isOverAllocated && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100/90 px-2.5 py-1 rounded-lg border border-red-200">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              <span>Over by {formatCurrency(Math.abs(unallocated))}</span>
            </div>
          )}

          {!isPerfectMatch && !isOverAllocated && (
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200">
              <span>{formatCurrency(unallocated)} unallocated</span>
              <button
                type="button"
                onClick={handleAutoBalance}
                className="text-[11px] text-dark-green-800 underline hover:text-dark-green-950 font-bold cursor-pointer"
              >
                Auto-balance
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Category List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-dark-green-900 uppercase tracking-wider">
            Budget Envelopes ({categories.length})
          </label>
          {!isAddingNew && (
            <button
              type="button"
              id="wizard-add-bucket-btn"
              onClick={() => setIsAddingNew(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-dark-green-800 hover:text-dark-green-950 bg-sage-50 hover:bg-sage-100 border border-sage-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Bucket</span>
            </button>
          )}
        </div>

        {/* Add Bucket Form */}
        {isAddingNew && (
          <form
            onSubmit={handleCreateCategory}
            className="p-4 bg-beige-50 border border-beige-300 rounded-2xl space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-dark-green-900">New Budget Bucket</span>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="text-xs font-medium text-dark-grey-600 hover:text-dark-grey-800"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-dark-grey-700 block mb-1">
                  Bucket Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pets & Vet"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs font-bold text-dark-green-900 bg-white border border-beige-300 rounded-xl px-3 py-2 focus:ring-1 focus:ring-dark-green-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-dark-grey-700 block mb-1">
                  Initial Weekly Target ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={newAllocation}
                  onChange={(e) => setNewAllocation(Math.max(0, Number(e.target.value)))}
                  className="w-full text-xs font-bold text-dark-green-900 bg-white border border-beige-300 rounded-xl px-3 py-2 focus:ring-1 focus:ring-dark-green-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-dark-grey-700 block mb-1.5">
                Choose Icon
              </label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_LUCIDE_ICONS.map((iconKey) => {
                  const isSelected = newIcon === iconKey;
                  return (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setNewIcon(iconKey)}
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-dark-green-800 text-white border-dark-green-800 ring-2 ring-sage-400'
                          : 'bg-white border-beige-300 text-dark-grey-700 hover:bg-sage-50'
                      }`}
                    >
                      <CategoryIcon icon={iconKey} className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-dark-grey-700 block mb-1">
                Subcategories / Examples (comma separated)
              </label>
              <input
                type="text"
                placeholder="e.g. Kibble, Vet Visits, Grooming"
                value={newSubcategories}
                onChange={(e) => setNewSubcategories(e.target.value)}
                className="w-full text-xs text-dark-green-900 bg-white border border-beige-300 rounded-xl px-3 py-2 focus:ring-1 focus:ring-dark-green-700 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Add Bucket
              </button>
            </div>
          </form>
        )}

        {/* Existing Category Rows */}
        <div className="space-y-2.5">
          {categories.map((cat) => {
            const pct =
              weeklyIncomePool > 0
                ? Math.round(((cat.currentWeeklyBudget || 0) / weeklyIncomePool) * 100)
                : 0;

            return (
              <div
                key={cat.id}
                className="p-3.5 bg-white border border-beige-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-sage-300 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-sage-50 border border-sage-200 flex items-center justify-center text-dark-green-800 shrink-0">
                    <CategoryIcon icon={cat.icon || 'shopping-bag'} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-dark-green-900 truncate">
                        {cat.name}
                      </span>
                      <span className="text-[10px] font-bold text-brown-700 bg-beige-100 px-2 py-0.5 rounded-md">
                        {pct}%
                      </span>
                    </div>
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <p className="text-[11px] text-dark-grey-600 truncate max-w-xs sm:max-w-sm">
                        {cat.subcategories.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 bg-beige-50 border border-beige-300 rounded-xl px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-dark-green-700">
                    <DollarSign className="w-3.5 h-3.5 text-brown-700" />
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={cat.currentWeeklyBudget || 0}
                      onChange={(e) => handleBudgetChange(cat.id, Number(e.target.value))}
                      className="w-20 text-xs font-extrabold text-dark-green-900 bg-transparent text-right focus:outline-none"
                    />
                    <span className="text-[10px] text-brown-700 font-semibold">/wk</span>
                  </div>

                  {categories.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      className="p-2 text-dark-grey-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                      title="Delete bucket"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-beige-200">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-beige-300 text-xs font-bold text-brown-800 hover:bg-beige-50 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-dark-green-800 hover:bg-dark-green-900 text-xs font-bold text-white shadow-xs transition cursor-pointer"
        >
          <span>Continue to Sync Code</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
