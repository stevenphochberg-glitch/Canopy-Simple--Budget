import React, { useState } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { formatCurrency } from '../../lib/calculations';
import {
  Receipt,
  CheckCircle2,
  Activity,
  Sparkles,
  Camera,
  Plus,
  ArrowRight,
  AlertTriangle,
  Clock,
  MessageSquare,
  Smile,
  Shield,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';

export const LedgerPlaceholder: React.FC = () => {
  const { household, expenses, categories, members, user, openStagingModal, deleteExpense } = useHousehold();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredExpenses = expenses.filter((exp) => {
    const matchesCategory =
      selectedCategoryFilter === 'all' || exp.categoryId === selectedCategoryFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      exp.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalFilteredAmount = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Header */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 bg-sage-100 px-2.5 py-0.5 rounded-full">
              Phase 2 Active
            </span>
            <span className="text-xs text-dark-grey-600">Complete Household Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-dark-green-900 mt-1">
            Household Expense Ledger
          </h1>
          <p className="text-xs sm:text-sm text-brown-700">
            Real-time log of all verified expenses and category debits.
          </p>
        </div>

        <button
          onClick={() => openStagingModal()}
          id="ledger-log-expense-btn"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-sm transition-transform active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Log Expense (Staging)</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-beige-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-brown-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search merchant or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-medium text-dark-green-900 focus:outline-none focus:border-dark-green-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-brown-700" />
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
          >
            <option value="all">All Categories ({expenses.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-beige-100 pb-3">
          <span className="text-xs font-bold text-dark-green-900">
            Showing {filteredExpenses.length} of {expenses.length} Records
          </span>
          <span className="text-xs font-extrabold text-dark-green-900">
            Total Filtered: {formatCurrency(totalFilteredAmount)}
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-beige-50/50 rounded-2xl border border-dashed border-beige-200">
            <Receipt className="w-8 h-8 mx-auto text-brown-700" />
            <h4 className="text-sm font-bold text-dark-green-900">No expenses found</h4>
            <p className="text-xs text-brown-700">
              {expenses.length === 0
                ? 'Your household ledger is clean. Click "Log Expense" to record an entry.'
                : 'No transactions match your current search and category filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-beige-100">
            {filteredExpenses.map((exp) => {
              const cat = categories.find((c) => c.id === exp.categoryId);
              const payer = members.find((m) => m.userId === exp.loggedByUserId);

              return (
                <div
                  key={exp.id}
                  className="py-3.5 flex items-center justify-between gap-3 hover:bg-beige-50/60 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-beige-100 border border-beige-200 flex items-center justify-center text-lg flex-shrink-0">
                      {cat?.icon || '🏷️'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-dark-green-900 text-sm truncate">
                          {exp.description}
                        </span>
                        <span className="text-[10px] font-semibold text-brown-800 bg-beige-100 px-2 py-0.2 rounded-md">
                          {cat?.name || 'Uncategorized'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-dark-grey-600">
                        <span>{exp.date || new Date(exp.timestamp).toLocaleDateString()}</span>
                        <span>&bull;</span>
                        <span>Paid by {payer?.name || 'Member'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-base font-black text-dark-green-900">
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteExpense(exp.id)}
                      className="p-1.5 text-brown-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      title="Delete expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

import { WeeklyCheckInView } from '../CheckIn/WeeklyCheckInView';

export const CheckInPlaceholder: React.FC = () => {
  return <WeeklyCheckInView />;
};

export const FeedPlaceholder: React.FC = () => {
  const { household, user, expenses } = useHousehold();

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brown-800 bg-beige-100 px-2.5 py-0.5 rounded-full">
            Phase 4 Feature
          </span>
          <span className="text-xs text-dark-grey-600">Shared Activity Stream</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-dark-green-900 mt-1">Household Activity Stream</h1>
        <p className="text-xs sm:text-sm text-brown-700">
          Live feed for household transactions, check-in completions, emoji reactions, and fresh starts.
        </p>
      </div>

      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-dark-green-800 border-b border-beige-100 pb-2">
          Recent Activity
        </h3>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-beige-50/60 border border-beige-200/80">
            <img
              src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={user?.name}
              className="w-8 h-8 rounded-full object-cover border border-sage-300"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-dark-green-900">
                {user?.name || 'Member'}{' '}
                <span className="font-medium text-dark-grey-600">
                  {expenses.length > 0 ? `Logged ${expenses.length} transaction${expenses.length > 1 ? 's' : ''} to the ledger` : 'Configured household budget and categories'}
                </span>
              </p>
              <span className="text-[10px] text-dark-grey-600">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
