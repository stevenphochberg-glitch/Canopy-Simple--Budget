import React, { useState, useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { formatCurrency, formatDateDisplay, getCategoryBudgetForTimeframe, calculateCategorySpending } from '../../lib/calculations';
import { CategoryIcon } from '../Common/CategoryIcon';
import {
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Trash2,
  Edit3,
  MessageSquare,
  Smile,
  Receipt,
  X,
  Check,
  Calendar,
  User,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  AlertCircle,
  Tag,
  Layers,
} from 'lucide-react';
import { Category, Expense } from '../../types';
import { EarthToneReaction } from '../Common/EarthToneReaction';

export const CategoryLedgerView: React.FC = () => {
  const {
    categories,
    expenses,
    members,
    user,
    selectedLedgerCategoryId,
    setSelectedLedgerCategoryId,
    openLogExpenseModal,
    deleteExpense,
    updateExpense,
    addTransactionComment,
    addTransactionReaction,
    timeframeMode,
    activeDateRange,
  } = useHousehold();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  // Edit Expense modal/inline state
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDate, setEditDate] = useState('');

  // Find currently active category object (if any)
  const activeCategory = useMemo(() => {
    if (!selectedLedgerCategoryId) return null;
    return categories.find((c) => c.id === selectedLedgerCategoryId) || null;
  }, [categories, selectedLedgerCategoryId]);

  // Filter & Sort expenses
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((exp) => {
        // Category filter
        if (selectedLedgerCategoryId && exp.categoryId !== selectedLedgerCategoryId) {
          return false;
        }
        // Member filter
        if (selectedMemberFilter !== 'all' && exp.loggedByUserId !== selectedMemberFilter) {
          return false;
        }
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesDesc = exp.description.toLowerCase().includes(q);
          const cat = categories.find((c) => c.id === exp.categoryId);
          const matchesCat = cat?.name.toLowerCase().includes(q) || cat?.group.toLowerCase().includes(q);
          const member = members.find((m) => m.userId === exp.loggedByUserId);
          const matchesMember = member?.name.toLowerCase().includes(q);
          const matchesAmount = exp.amount.toString().includes(q);
          if (!matchesDesc && !matchesCat && !matchesMember && !matchesAmount) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return (b.timestamp || new Date(b.date).getTime()) - (a.timestamp || new Date(a.date).getTime());
        }
        if (sortBy === 'date-asc') {
          return (a.timestamp || new Date(a.date).getTime()) - (b.timestamp || new Date(b.date).getTime());
        }
        if (sortBy === 'amount-desc') {
          return b.amount - a.amount;
        }
        if (sortBy === 'amount-asc') {
          return a.amount - b.amount;
        }
        return 0;
      });
  }, [expenses, selectedLedgerCategoryId, selectedMemberFilter, searchQuery, sortBy, categories, members]);

  // Aggregate metrics for active selection
  const totalSelectedAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  // Category specific budget stats
  const categoryBudgetStats = useMemo(() => {
    if (!activeCategory) return null;
    const budgetForTimeframe = getCategoryBudgetForTimeframe(
      activeCategory.currentWeeklyBudget || activeCategory.baselineBudget,
      timeframeMode
    );
    const { totalSpent, count } = calculateCategorySpending(
      expenses,
      activeCategory.id,
      activeDateRange.startDate,
      activeDateRange.endDate
    );
    const remaining = budgetForTimeframe - totalSpent;
    const percentage = budgetForTimeframe > 0 ? Math.round((totalSpent / budgetForTimeframe) * 100) : 0;
    return { budgetForTimeframe, totalSpent, count, remaining, percentage };
  }, [activeCategory, expenses, timeframeMode, activeDateRange]);

  const toggleComments = (expenseId: string) => {
    setExpandedComments((prev) => ({ ...prev, [expenseId]: !prev[expenseId] }));
  };

  const handleSendComment = (expenseId: string) => {
    const text = commentInputs[expenseId];
    if (!text || !text.trim()) return;
    addTransactionComment(expenseId, text.trim());
    setCommentInputs((prev) => ({ ...prev, [expenseId]: '' }));
    setExpandedComments((prev) => ({ ...prev, [expenseId]: true }));
  };

  const startEditExpense = (exp: Expense) => {
    setEditingExpenseId(exp.id);
    setEditDesc(exp.description);
    setEditAmount(exp.amount);
    setEditCategoryId(exp.categoryId);
    setEditDate(exp.date);
  };

  const saveEditExpense = (expenseId: string) => {
    if (!editDesc.trim() || editAmount <= 0) return;
    updateExpense(expenseId, {
      description: editDesc.trim(),
      amount: Number(editAmount),
      categoryId: editCategoryId,
      date: editDate,
      timestamp: new Date(editDate).getTime(),
    });
    setEditingExpenseId(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-beige-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sage-100 text-dark-green-950 border border-sage-300">
              Transaction History
            </span>
            <span className="text-xs text-dark-grey-600">
              Lateral Category Drill-Down & Master Ledger
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-dark-green-900 tracking-tight">
            {activeCategory ? `${activeCategory.name} Ledger` : 'All Household Transactions'}
          </h1>
          <p className="text-xs sm:text-sm text-brown-700">
            {activeCategory
              ? `Reviewing dedicated category activity, social notes, and line-item receipts.`
              : `Consolidated transaction history across all ${categories.length} budget categories and household members.`}
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            id="ledger-log-expense-btn"
            onClick={() => openLogExpenseModal(activeCategory)}
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{activeCategory ? `Log to ${activeCategory.name}` : 'Log Expense'}</span>
          </button>
        </div>
      </div>

      {/* LATERAL NAVIGATION BAR (Horizontal Scrolling Category Chips) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900">
            Category Drill-Down:
          </span>
          <span className="text-xs text-brown-700 font-medium">
            Swipe or click tabs to switch
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-beige-300">
          {/* Master "All Transactions" Tab */}
          <button
            id="tab-category-all"
            onClick={() => setSelectedLedgerCategoryId(null)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer border ${
              selectedLedgerCategoryId === null
                ? 'bg-dark-green-900 text-white border-dark-green-900 shadow-sm'
                : 'bg-white text-dark-green-900 hover:bg-beige-100/80 border-beige-300'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>All Transactions</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                selectedLedgerCategoryId === null
                  ? 'bg-dark-green-800 text-beige-100'
                  : 'bg-beige-200 text-dark-green-900'
              }`}
            >
              {expenses.length}
            </span>
          </button>

          {/* Individual Category Tabs */}
          {categories.map((cat) => {
            const isSelected = selectedLedgerCategoryId === cat.id;
            const catCount = expenses.filter((e) => e.categoryId === cat.id).length;

            return (
              <button
                key={cat.id}
                id={`tab-category-${cat.id}`}
                onClick={() => setSelectedLedgerCategoryId(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-dark-green-900 text-white border-dark-green-900 shadow-sm'
                    : 'bg-white text-dark-green-900 hover:bg-beige-100/80 border-beige-300'
                }`}
              >
                <CategoryIcon name={cat.name} group={cat.group} icon={cat.icon} className="w-4 h-4" />
                <span>{cat.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                    isSelected
                      ? 'bg-dark-green-800 text-beige-100'
                      : 'bg-beige-200 text-dark-green-900'
                  }`}
                >
                  {catCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CATEGORY DRILL-DOWN HERO CARD (If specific category is selected) */}
      {activeCategory && categoryBudgetStats && (
        <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-beige-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 flex-shrink-0">
                <CategoryIcon name={activeCategory.name} group={activeCategory.group} icon={activeCategory.icon} className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-dark-green-900">
                    {activeCategory.name}
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-sage-100 text-dark-green-900 px-2.5 py-0.5 rounded-full border border-sage-200">
                    {activeCategory.group} Bucket
                  </span>
                </div>
                <p className="text-xs text-brown-700">
                  Weekly Baseline: <strong>{formatCurrency(activeCategory.baselineBudget)}</strong> &bull; Current Allocation: <strong>{formatCurrency(activeCategory.currentWeeklyBudget || activeCategory.baselineBudget)}</strong>
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 text-xs">
              <div className="bg-beige-50 border border-beige-200 px-3.5 py-2 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-dark-grey-600 block">
                  {timeframeMode === 'week' ? 'Weekly Budget' : 'Monthly Budget'}
                </span>
                <span className="text-sm font-extrabold text-dark-green-900">
                  {formatCurrency(categoryBudgetStats.budgetForTimeframe)}
                </span>
              </div>

              <div className="bg-beige-50 border border-beige-200 px-3.5 py-2 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-dark-grey-600 block">
                  Timeframe Spent
                </span>
                <span className="text-sm font-extrabold text-dark-green-900">
                  {formatCurrency(categoryBudgetStats.totalSpent)}
                </span>
              </div>

              <div
                className={`px-3.5 py-2 rounded-2xl border ${
                  categoryBudgetStats.remaining < 0
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-sage-50 border-sage-200 text-dark-green-900'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-dark-grey-600 block">
                  {categoryBudgetStats.remaining < 0 ? 'Over Budget' : 'Remaining'}
                </span>
                <span className="text-sm font-extrabold">
                  {categoryBudgetStats.remaining < 0
                    ? `-${formatCurrency(Math.abs(categoryBudgetStats.remaining))}`
                    : `${formatCurrency(categoryBudgetStats.remaining)} left`}
                </span>
              </div>
            </div>
          </div>

          {/* Subcategories Tags (Only displayed in Category Drill-Down / History view) */}
          {activeCategory.subcategories && activeCategory.subcategories.length > 0 && (
            <div className="bg-beige-50/70 border border-beige-200 rounded-2xl p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-dark-green-900 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-sage-700" />
                <span>Included Subcategories & Examples:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeCategory.subcategories.map((sub, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2.5 py-0.5 bg-white border border-beige-300 rounded-lg text-brown-900 font-medium shadow-2xs"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-dark-green-900">
              <span>Timeframe Consumption</span>
              <span>{categoryBudgetStats.percentage}%</span>
            </div>
            <div className="w-full h-2.5 bg-beige-100 rounded-full overflow-hidden border border-beige-200">
              <div
                className={`h-full ${
                  categoryBudgetStats.percentage >= 100
                    ? 'bg-red-600'
                    : categoryBudgetStats.percentage >= 75
                    ? 'bg-amber-600'
                    : 'bg-sage-600'
                } transition-all duration-500 rounded-full`}
                style={{ width: `${Math.min(100, Math.max(0, categoryBudgetStats.percentage))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-brown-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="ledger-search-input"
            type="text"
            placeholder="Search description, category, member, or amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-beige-50 border border-beige-200 rounded-xl text-xs sm:text-sm text-dark-green-900 focus:outline-hidden focus:border-dark-green-700 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brown-700 hover:text-dark-green-900"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Member filter & Sort selector */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Member Filter */}
          <div className="flex items-center gap-1.5 bg-beige-50 border border-beige-200 px-3 py-1.5 rounded-xl">
            <User className="w-3.5 h-3.5 text-brown-700" />
            <select
              id="ledger-member-filter"
              value={selectedMemberFilter}
              onChange={(e) => setSelectedMemberFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-dark-green-900 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Members</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 bg-beige-50 border border-beige-200 px-3 py-1.5 rounded-xl">
            <ArrowUpDown className="w-3.5 h-3.5 text-brown-700" />
            <select
              id="ledger-sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-dark-green-900 focus:outline-hidden cursor-pointer"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
          </div>
        </div>
      </div>

      {/* SUMMARY BANNER */}
      <div className="flex items-center justify-between text-xs text-brown-700 px-1">
        <span>
          Showing <strong>{filteredExpenses.length}</strong> {filteredExpenses.length === 1 ? 'transaction' : 'transactions'}
        </span>
        <span>
          Total Value: <strong className="text-dark-green-900 font-extrabold">{formatCurrency(totalSelectedAmount)}</strong>
        </span>
      </div>

      {/* TRANSACTIONS LIST */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white border border-beige-200 rounded-3xl p-10 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 mx-auto">
            {activeCategory ? (
              <CategoryIcon name={activeCategory.name} group={activeCategory.group} icon={activeCategory.icon} className="w-7 h-7" />
            ) : (
              <Receipt className="w-7 h-7 text-dark-green-800" />
            )}
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-extrabold text-dark-green-900">
              No transactions found
            </h3>
            <p className="text-xs text-brown-700">
              {searchQuery
                ? `No expense matches your search query "${searchQuery}".`
                : activeCategory
                ? `No transactions recorded for ${activeCategory.name} yet.`
                : 'No expenses have been logged in the household budget yet.'}
            </p>
          </div>
          <button
            onClick={() => openLogExpenseModal(activeCategory)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log an Expense Now</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredExpenses.map((exp) => {
            const cat = categories.find((c) => c.id === exp.categoryId);
            const member = members.find((m) => m.userId === exp.loggedByUserId);
            const isEditing = editingExpenseId === exp.id;
            const comments = exp.comments || [];
            const reactions = exp.reactions || [];
            const isCommentsOpen = !!expandedComments[exp.id];

            // Group reactions by emoji
            type ReactionMeta = { count: number; users: string[]; hasReacted: boolean };
            const initialMap: Record<string, ReactionMeta> = {};
            const reactionCounts = reactions.reduce((acc, r) => {
              if (!acc[r.emoji]) {
                acc[r.emoji] = { count: 0, users: [], hasReacted: false };
              }
              acc[r.emoji].count += 1;
              acc[r.emoji].users.push(r.authorName);
              if (r.authorId === user?.userId) {
                acc[r.emoji].hasReacted = true;
              }
              return acc;
            }, initialMap);

            return (
              <div
                key={exp.id}
                id={`expense-card-${exp.id}`}
                className="bg-white border border-beige-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-beige-300 transition-all space-y-3"
              >
                {isEditing ? (
                  /* INLINE EDIT MODE */
                  <div className="space-y-3 p-2 bg-beige-50/80 rounded-xl border border-beige-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-dark-green-900">
                        Edit Transaction
                      </span>
                      <button
                        onClick={() => setEditingExpenseId(null)}
                        className="text-brown-700 hover:text-dark-green-900 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                      <div>
                        <label className="block font-bold text-dark-green-900 mb-1">Description</label>
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-beige-300 rounded-lg text-dark-green-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-dark-green-900 mb-1">Amount ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-white border border-beige-300 rounded-lg text-dark-green-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-dark-green-900 mb-1">Category</label>
                        <select
                          value={editCategoryId}
                          onChange={(e) => setEditCategoryId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-beige-300 rounded-lg text-dark-green-900"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.group})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-dark-green-900 mb-1">Date</label>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-beige-300 rounded-lg text-dark-green-900"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => saveEditExpense(exp.id)}
                        className="px-3 py-1 bg-dark-green-800 hover:bg-dark-green-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* NORMAL DISPLAY MODE */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Category Icon, Description, Date, Payer */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        onClick={() => cat && setSelectedLedgerCategoryId(cat.id)}
                        title={`Filter by ${cat?.name || 'Category'}`}
                        className="w-10 h-10 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
                      >
                        <CategoryIcon name={cat?.name} group={cat?.group} icon={cat?.icon} className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-dark-green-900 text-sm sm:text-base leading-tight truncate">
                            {exp.description}
                          </h4>
                          {cat && (
                            <span
                              onClick={() => setSelectedLedgerCategoryId(cat.id)}
                              className="text-[10px] font-bold uppercase tracking-wider bg-beige-100 hover:bg-beige-200 text-dark-green-900 border border-beige-300 px-2 py-0.5 rounded-full cursor-pointer transition"
                            >
                              {cat.name}
                            </span>
                          )}
                          {exp.receiptImgUrl && (
                            <button
                              onClick={() => setSelectedReceiptUrl(exp.receiptImgUrl || null)}
                              className="text-[10px] font-bold text-sage-800 bg-sage-50 hover:bg-sage-100 border border-sage-300 px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Receipt</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-brown-700">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDateDisplay(exp.date)}
                          </span>
                          <span>&bull;</span>
                          <div className="flex items-center gap-1.5">
                            {member?.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.name}
                                className="w-4 h-4 rounded-full object-cover border border-beige-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <User className="w-3.5 h-3.5 text-brown-700" />
                            )}
                            <span className="font-medium">{member?.name || 'Household Member'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                      <div className="text-lg sm:text-xl font-black text-dark-green-900 tracking-tight font-mono">
                        {formatCurrency(exp.amount)}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleComments(exp.id)}
                          id={`comment-toggle-${exp.id}`}
                          className={`p-1.5 rounded-lg border transition text-xs flex items-center gap-1 cursor-pointer ${
                            comments.length > 0 || isCommentsOpen
                              ? 'bg-sage-100 text-dark-green-900 border-sage-300'
                              : 'bg-white hover:bg-beige-100 text-brown-700 border-beige-300'
                          }`}
                          title="View or add comments"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="font-bold text-[11px]">{comments.length}</span>
                        </button>

                        <button
                          onClick={() => startEditExpense(exp)}
                          id={`edit-exp-${exp.id}`}
                          className="p-1.5 rounded-lg bg-white hover:bg-beige-100 text-brown-700 hover:text-dark-green-900 border border-beige-300 transition cursor-pointer"
                          title="Edit transaction"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            if (window.confirm(`Delete expense "${exp.description}"?`)) {
                              deleteExpense(exp.id);
                            }
                          }}
                          id={`del-exp-${exp.id}`}
                          className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-brown-700 hover:text-red-700 border border-beige-300 transition cursor-pointer"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SOCIAL REACTIONS BAR (CUSTOM EARTH-TONE SVG ICONS) */}
                <div className="pt-1.5 border-t border-beige-100">
                  <EarthToneReaction
                    reactions={exp.reactions || []}
                    onReact={(reactionId) => addTransactionReaction(exp.id, reactionId)}
                    currentUserId={user?.userId}
                  />
                </div>

                {/* COMMENTS SECTION (EXPANDABLE) */}
                {isCommentsOpen && (
                  <div className="mt-2 pt-3 border-t border-beige-100 space-y-2.5 bg-beige-50/50 p-3 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-bold text-dark-green-900 mb-1">
                      <span>Comments & Activity Notes</span>
                      <span className="text-brown-700 text-[11px]">
                        {comments.length} {comments.length === 1 ? 'note' : 'notes'}
                      </span>
                    </div>

                    {/* Comment list */}
                    {comments.length === 0 ? (
                      <p className="text-xs text-brown-700 italic">
                        No comments on this transaction yet. Add a note below!
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {comments.map((c) => (
                          <div
                            key={c.id}
                            className="bg-white border border-beige-200 p-2.5 rounded-xl space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {c.authorAvatar ? (
                                  <img
                                    src={c.authorAvatar}
                                    alt={c.authorName}
                                    className="w-4 h-4 rounded-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <User className="w-3.5 h-3.5 text-brown-700" />
                                )}
                                <span className="font-bold text-dark-green-900">{c.authorName}</span>
                              </div>
                              <span className="text-[10px] text-brown-700">
                                {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-dark-green-950 pl-5">{c.text}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Input box for new comment */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Add a household note or comment..."
                        value={commentInputs[exp.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({ ...prev, [exp.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendComment(exp.id);
                        }}
                        className="flex-1 px-3 py-1.5 bg-white border border-beige-300 rounded-xl text-xs text-dark-green-900 focus:outline-hidden focus:border-dark-green-700"
                      />
                      <button
                        onClick={() => handleSendComment(exp.id)}
                        disabled={!commentInputs[exp.id]?.trim()}
                        className="px-3 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* RECEIPT IMAGE PREVIEW MODAL */}
      {selectedReceiptUrl && (
        <div className="fixed inset-0 z-50 bg-dark-green-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-lg w-full space-y-4 shadow-2xl border border-beige-300 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-beige-200 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-dark-green-900" />
                <h3 className="font-extrabold text-dark-green-900">Receipt Preview</h3>
              </div>
              <button
                onClick={() => setSelectedReceiptUrl(null)}
                className="p-1 rounded-lg hover:bg-beige-100 text-brown-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-beige-200 flex items-center justify-center bg-beige-50">
              <img
                src={selectedReceiptUrl}
                alt="Receipt Full View"
                className="max-w-full h-auto object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedReceiptUrl(null)}
                className="px-4 py-2 bg-dark-green-800 text-white rounded-xl text-xs font-bold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
