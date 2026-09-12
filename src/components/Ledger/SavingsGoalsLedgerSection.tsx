import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { Category, SavingsGoal } from '../../types';
import { formatCurrency } from '../../lib/calculations';
import { BudgetProgressBar } from '../Common/BudgetProgressBar';
import {
  Target,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Calendar,
  Sparkles,
  TrendingUp,
  X,
  Check,
} from 'lucide-react';

interface SavingsGoalsLedgerSectionProps {
  category: Category;
}

export const SavingsGoalsLedgerSection: React.FC<SavingsGoalsLedgerSectionProps> = ({ category }) => {
  const { savingsGoals, createSavingsGoal, updateSavingsGoal, deleteSavingsGoal } = useHousehold();

  const [isAdding, setIsAdding] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [targetAmount, setTargetAmount] = useState<number>(1000);
  const [currentAmount, setCurrentAmount] = useState<number>(0);
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');

  // Editing state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editTargetAmount, setEditTargetAmount] = useState<number>(1000);
  const [editCurrentAmount, setEditCurrentAmount] = useState<number>(0);

  // Filter goals that match this savings category (or show all if category matches)
  const categoryGoals = savingsGoals.filter(
    (g) => !g.categoryId || g.categoryId === category.id
  );

  const totalSavedAcrossGoals = categoryGoals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
  const totalTargetAcrossGoals = categoryGoals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim() || targetAmount <= 0) return;

    await createSavingsGoal({
      name: goalName.trim(),
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount) || 0,
      categoryId: category.id,
      targetDate: targetDate || undefined,
      notes: notes.trim() || undefined,
    });

    setGoalName('');
    setTargetAmount(1000);
    setCurrentAmount(0);
    setTargetDate('');
    setNotes('');
    setIsAdding(false);
  };

  const handleStartEdit = (goal: SavingsGoal) => {
    setEditingGoalId(goal.id);
    setEditGoalName(goal.name);
    setEditTargetAmount(goal.targetAmount);
    setEditCurrentAmount(goal.currentAmount);
  };

  const handleSaveEdit = async (goalId: string) => {
    if (!editGoalName.trim()) return;
    await updateSavingsGoal(goalId, {
      name: editGoalName.trim(),
      targetAmount: Number(editTargetAmount),
      currentAmount: Number(editCurrentAmount),
      isAchieved: Number(editCurrentAmount) >= Number(editTargetAmount),
      achievedAt:
        Number(editCurrentAmount) >= Number(editTargetAmount)
          ? new Date().toISOString().split('T')[0]
          : undefined,
    });
    setEditingGoalId(null);
  };

  const handleQuickAdd = async (goal: SavingsGoal, delta: number) => {
    const newAmt = Math.max(0, (goal.currentAmount || 0) + delta);
    const isAchieved = newAmt >= goal.targetAmount;
    await updateSavingsGoal(goal.id, {
      currentAmount: newAmt,
      isAchieved,
      achievedAt: isAchieved ? new Date().toISOString().split('T')[0] : undefined,
    });
  };

  return (
    <div className="bg-gradient-to-br from-sage-50/50 via-white to-beige-50/50 border border-sage-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sage-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-dark-green-800 text-white flex items-center justify-center shadow-xs">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-dark-green-900">
                {category.name} Savings Goals
              </h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sage-200/80 text-dark-green-900">
                {categoryGoals.length} Active {categoryGoals.length === 1 ? 'Goal' : 'Goals'}
              </span>
            </div>
            <p className="text-xs text-dark-grey-600">
              Track milestones, sinking funds, and target balances for this savings bucket.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5 px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isAdding ? 'Cancel' : 'New Savings Goal'}</span>
        </button>
      </div>

      {/* Aggregate Overview Card */}
      {categoryGoals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white/90 border border-sage-200/60 rounded-2xl">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
              Total Saved So Far
            </span>
            <span className="text-lg font-black text-dark-green-900">
              {formatCurrency(totalSavedAcrossGoals)}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
              Total Target Goal
            </span>
            <span className="text-lg font-black text-dark-green-900">
              {formatCurrency(totalTargetAcrossGoals)}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
              Aggregate Progress
            </span>
            <span className="text-lg font-black text-sage-800">
              {totalTargetAcrossGoals > 0
                ? Math.round((totalSavedAcrossGoals / totalTargetAcrossGoals) * 100)
                : 0}
              %
            </span>
          </div>
        </div>
      )}

      {/* Add New Goal Form */}
      {isAdding && (
        <form
          onSubmit={handleCreateGoal}
          className="p-4 sm:p-5 bg-white border border-sage-300 rounded-2xl space-y-4 shadow-sm animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-dark-green-900">
            <Sparkles className="w-4 h-4 text-sage-700" />
            <span>Create New Savings Milestone / Goal</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-dark-grey-700 block">
                Goal Name *
              </label>
              <input
                type="text"
                required
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="e.g. Down Payment, Emergency Cushion, Vacation 2026"
                className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900 focus:outline-none focus:ring-1 focus:ring-dark-green-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-dark-grey-700 block">
                Target Amount ($) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={targetAmount}
                onChange={(e) => setTargetAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900 focus:outline-none focus:ring-1 focus:ring-dark-green-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-dark-grey-700 block">
                Starting Amount ($)
              </label>
              <input
                type="number"
                min="0"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900 focus:outline-none focus:ring-1 focus:ring-dark-green-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-dark-grey-700 block">
                Target Date (Optional)
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-medium text-dark-green-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 bg-beige-100 hover:bg-beige-200 text-dark-grey-700 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Save Goal
            </button>
          </div>
        </form>
      )}

      {/* Goals List */}
      {categoryGoals.length === 0 ? (
        <div className="p-8 text-center bg-white/60 border border-dashed border-sage-200 rounded-2xl space-y-2">
          <TrendingUp className="w-8 h-8 text-sage-400 mx-auto" />
          <h4 className="text-xs font-bold text-dark-green-900">No Savings Goals Set Yet</h4>
          <p className="text-[11px] text-dark-grey-600 max-w-sm mx-auto">
            Break down this {category.name} bucket into distinct targets like Emergency Cushion,
            House Fund, or Vacation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {categoryGoals.map((goal) => {
            const isEditing = editingGoalId === goal.id;
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            const isCompleted = goal.currentAmount >= goal.targetAmount;

            return (
              <div
                key={goal.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 bg-white ${
                  isCompleted
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-beige-200 hover:border-sage-300'
                }`}
              >
                {isEditing ? (
                  /* Inline Edit Form */
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={editGoalName}
                      onChange={(e) => setEditGoalName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-beige-50 border border-beige-300 rounded-lg text-xs font-bold text-dark-green-900"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-dark-grey-600">Saved ($)</label>
                        <input
                          type="number"
                          value={editCurrentAmount}
                          onChange={(e) => setEditCurrentAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-beige-50 border border-beige-300 rounded-lg text-xs font-bold text-dark-green-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-dark-grey-600">Target ($)</label>
                        <input
                          type="number"
                          value={editTargetAmount}
                          onChange={(e) => setEditTargetAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-beige-50 border border-beige-300 rounded-lg text-xs font-bold text-dark-green-900"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingGoalId(null)}
                        className="px-2.5 py-1 text-xs text-dark-grey-700 hover:bg-beige-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(goal.id)}
                        className="px-3 py-1 bg-dark-green-800 text-white text-xs font-bold rounded-lg"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display View */
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-black text-dark-green-900">{goal.name}</h4>
                          {isCompleted && (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Achieved!
                            </span>
                          )}
                        </div>
                        {goal.targetDate && (
                          <span className="text-[10px] text-dark-grey-600 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" /> Target: {goal.targetDate}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(goal)}
                          className="p-1.5 text-dark-grey-600 hover:text-dark-green-900 hover:bg-beige-100 rounded-lg transition"
                          title="Edit Goal"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavingsGoal(goal.id)}
                          className="p-1.5 text-dark-grey-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          title="Delete Goal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-dark-green-900">
                          {formatCurrency(goal.currentAmount)}
                        </span>
                        <span className="font-semibold text-dark-grey-600">
                          of {formatCurrency(goal.targetAmount)} ({Math.round(progress)}%)
                        </span>
                      </div>
                      <BudgetProgressBar
                        spent={goal.currentAmount}
                        budget={goal.targetAmount}
                        categoryType="savings"
                        height="h-2.5"
                      />
                    </div>

                    {/* Quick Deposit Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-beige-100 text-[10px]">
                      <span className="font-bold text-dark-grey-600">Quick Adjust:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(goal, 25)}
                          className="px-2 py-1 bg-sage-100 hover:bg-sage-200 text-dark-green-900 font-bold rounded-lg transition cursor-pointer"
                        >
                          +$25
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(goal, 100)}
                          className="px-2 py-1 bg-sage-100 hover:bg-sage-200 text-dark-green-900 font-bold rounded-lg transition cursor-pointer"
                        >
                          +$100
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(goal, -25)}
                          disabled={goal.currentAmount < 25}
                          className="px-2 py-1 bg-beige-100 hover:bg-beige-200 text-dark-grey-700 font-bold rounded-lg transition cursor-pointer disabled:opacity-40"
                        >
                          -$25
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
