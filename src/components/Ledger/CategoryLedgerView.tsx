import React, { useState, useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
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
  TrendingUp,
  DollarSign,
  AlertCircle,
  Tag,
  Layers,
} from 'lucide-react';
import { Category, Expense, BillFrequency, CheckIn } from '../../types';
import { parseExpenseTimestamp } from '../../lib/calculations';
import { EarthToneReaction } from '../Common/EarthToneReaction';
import { BudgetProgressBar } from '../Common/BudgetProgressBar';
import { SavingsGoalsLedgerSection } from './SavingsGoalsLedgerSection';
import {
  formatCurrency,
  formatDateDisplay,
  getCategoryBudgetForTimeframe,
  calculateCategorySpending,
  getProratedExpenseAmount,
} from '../../lib/calculations';
import { getFiscalMonthForDate } from '../../lib/fiscal445';

export const CategoryLedgerView: React.FC = () => {
  const {
    household,
    categories,
    expenses,
    checkIns,
    members,
    user,
    selectedLedgerCategoryId,
    setSelectedLedgerCategoryId,
    openLogExpenseModal,
    deleteExpense,
    deleteDeposit,
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

  // Edit Expense modal state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPayerId, setEditPayerId] = useState('');
  const [editBillFrequency, setEditBillFrequency] = useState<'none' | 'weekly' | 'monthly' | 'annually'>('none');

  // Find currently active category object (if any)
  const activeCategory = useMemo(() => {
    if (!selectedLedgerCategoryId || selectedLedgerCategoryId === 'deposits') return null;
    return categories.find((c) => c.id === selectedLedgerCategoryId) || null;
  }, [categories, selectedLedgerCategoryId]);

  // Is the active category Savings?
  const isSavingsCategory = useMemo(() => {
    if (!activeCategory) return false;
    return (
      activeCategory.id === 'cat_savings' ||
      activeCategory.type === 'savings' ||
      activeCategory.group?.toLowerCase() === 'savings' ||
      activeCategory.name?.toLowerCase().includes('saving')
    );
  }, [activeCategory]);

  // Helper to extract savings dollar contribution from completed check-in record
  const getCheckInSavingsAmount = (checkIn: CheckIn): number => {
    if (checkIn.totalSaved !== undefined && checkIn.totalSaved !== null && !isNaN(Number(checkIn.totalSaved))) {
      return Number(checkIn.totalSaved);
    }
    if (checkIn.decisions && checkIn.decisions.length > 0) {
      return checkIn.decisions.reduce((sum, d) => {
        if (d.savingsContribution) return sum + d.savingsContribution;
        if (d.choice === 'savings') return sum + (d.difference > 0 ? d.difference : 0);
        return sum;
      }, 0);
    }
    return 0;
  };

  // Filter & Sort completed checkIns (for Savings ledger timeline)
  const filteredSavingsCheckIns = useMemo(() => {
    if (!isSavingsCategory) return [];
    const completed = (checkIns || []).filter((c) => c.status === 'completed');
    return completed
      .filter((c) => {
        if (selectedMemberFilter !== 'all' && c.completedByUserId && c.completedByUserId !== selectedMemberFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = 'weekly check-in deposit'.includes(q) || 'savings'.includes(q);
          const matchesNotes = c.notes ? c.notes.toLowerCase().includes(q) : false;
          const member = members.find((m) => m.userId === c.completedByUserId);
          const matchesMember = member?.name.toLowerCase().includes(q) || (c.completedByName ? c.completedByName.toLowerCase().includes(q) : false);
          const amount = getCheckInSavingsAmount(c);
          const matchesAmount = amount.toString().includes(q);
          if (!matchesTitle && !matchesNotes && !matchesMember && !matchesAmount) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = a.timestamp || new Date(a.weekEndDate || a.weekStartDate).getTime();
        const timeB = b.timestamp || new Date(b.weekEndDate || b.weekStartDate).getTime();
        const amtA = getCheckInSavingsAmount(a);
        const amtB = getCheckInSavingsAmount(b);
        if (sortBy === 'date-desc') return timeB - timeA;
        if (sortBy === 'date-asc') return timeA - timeB;
        if (sortBy === 'amount-desc') return amtB - amtA;
        if (sortBy === 'amount-asc') return amtA - amtB;
        return 0;
      });
  }, [isSavingsCategory, checkIns, selectedMemberFilter, searchQuery, sortBy, members]);

  // Filter & Sort expenses (completely ignore if activeCategory is Savings or selectedLedgerCategoryId is 'deposits')
  const filteredExpenses = useMemo(() => {
    if (selectedLedgerCategoryId === 'deposits' || isSavingsCategory) return [];
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
  }, [expenses, selectedLedgerCategoryId, isSavingsCategory, selectedMemberFilter, searchQuery, sortBy, categories, members]);

  // Filter & Sort One-off Deposits
  const filteredDeposits = useMemo(() => {
    // Exclude deposits if a specific category is selected (deposits only show under 'All' or 'deposits' tab)
    if (selectedLedgerCategoryId && selectedLedgerCategoryId !== 'deposits') {
      return [];
    }
    const deps = household?.oneOffDeposits || [];
    return deps
      .filter((dep) => {
        if (selectedMemberFilter !== 'all' && dep.payerMemberId && dep.payerMemberId !== selectedMemberFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesDesc = dep.description.toLowerCase().includes(q);
          const matchesAmount = dep.amount.toString().includes(q);
          const member = members.find((m) => m.userId === dep.payerMemberId);
          const matchesMember = member?.name.toLowerCase().includes(q);
          if (!matchesDesc && !matchesAmount && !matchesMember) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (sortBy === 'date-desc') return timeB - timeA;
        if (sortBy === 'date-asc') return timeA - timeB;
        if (sortBy === 'amount-desc') return b.amount - a.amount;
        if (sortBy === 'amount-asc') return a.amount - b.amount;
        return 0;
      });
  }, [household?.oneOffDeposits, selectedLedgerCategoryId, selectedMemberFilter, searchQuery, sortBy, members]);

  // Aggregate metrics for active selection
  const totalSelectedAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  // Total savings deposit amount for Savings view (strictly from completed check-ins)
  const totalSavingsDepositAmount = useMemo(() => {
    return filteredSavingsCheckIns.reduce((sum, c) => sum + getCheckInSavingsAmount(c), 0);
  }, [filteredSavingsCheckIns]);

  // Category specific budget stats:
  // - Month View: Statically derived constant (Baseline Weekly Allocation × Weeks in Fiscal Month)
  // - Week View: Active weekly allocation (with active overrides/adjustments)
  const categoryBudgetStats = useMemo(() => {
    if (!activeCategory) return null;
    const isMonthView = timeframeMode === 'month';
    const baseWeekly = isMonthView
      ? (activeCategory.baselineBudget || activeCategory.currentWeeklyBudget)
      : (activeCategory.currentWeeklyBudget || activeCategory.baselineBudget);
    const fiscalMonth = getFiscalMonthForDate(activeDateRange.startDate, household?.fiscalYearEndMonth || 12);
    const weeksInMonth = fiscalMonth.weekCount || 4;

    const budgetForTimeframe = getCategoryBudgetForTimeframe(
      baseWeekly,
      timeframeMode,
      weeksInMonth
    );

    if (isSavingsCategory) {
      const totalSaved = (checkIns || [])
        .filter((c) => c.status === 'completed')
        .reduce((sum, c) => sum + getCheckInSavingsAmount(c), 0);
      const remaining = budgetForTimeframe - totalSaved;
      const percentage = budgetForTimeframe > 0 ? Math.round((totalSaved / budgetForTimeframe) * 100) : 0;
      return { budgetForTimeframe, totalSpent: totalSaved, count: filteredSavingsCheckIns.length, remaining, percentage };
    }

    const { totalSpent, count } = calculateCategorySpending(
      expenses,
      activeCategory.id,
      activeDateRange.startDate,
      activeDateRange.endDate
    );
    const remaining = budgetForTimeframe - totalSpent;
    const percentage = budgetForTimeframe > 0 ? Math.round((totalSpent / budgetForTimeframe) * 100) : 0;
    return { budgetForTimeframe, totalSpent, count, remaining, percentage };
  }, [activeCategory, isSavingsCategory, checkIns, filteredSavingsCheckIns.length, expenses, timeframeMode, activeDateRange, household?.fiscalYearEndMonth]);

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
    setEditingExpense(exp);
    setEditDesc(exp.description);
    setEditAmount(exp.amount);
    setEditCategoryId(exp.categoryId);
    setEditDate(exp.date);
    setEditPayerId(exp.loggedByUserId || user?.userId || 'usr_self');
    setEditBillFrequency(exp.billFrequency || 'none');
  };

  const saveEditExpense = () => {
    if (!editingExpense || !editDesc.trim() || editAmount <= 0) return;
    const frequency = editBillFrequency === 'none' ? undefined : (editBillFrequency as BillFrequency);
    updateExpense(editingExpense.id, {
      description: editDesc.trim(),
      amount: Number(editAmount),
      categoryId: editCategoryId,
      date: editDate,
      timestamp: parseExpenseTimestamp({ date: editDate }),
      loggedByUserId: editPayerId,
      billFrequency: frequency,
    });
    setEditingExpense(null);
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

        {/* Action Button - Hidden for Savings category */}
        {!isSavingsCategory && (
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
        )}
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
              {expenses.length + (household?.oneOffDeposits?.length || 0)}
            </span>
          </button>

          {/* Income & Deposits Tab */}
          {(household?.oneOffDeposits?.length || 0) > 0 && (
            <button
              id="tab-category-deposits"
              onClick={() => setSelectedLedgerCategoryId('deposits')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer border ${
                selectedLedgerCategoryId === 'deposits'
                  ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-sm'
                  : 'bg-white text-dark-green-900 hover:bg-sage-50 border-sage-300'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-sage-600" />
              <span>Income & Deposits</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                  selectedLedgerCategoryId === 'deposits'
                    ? 'bg-dark-green-950 text-sage-200'
                    : 'bg-sage-100 text-dark-green-900'
                }`}
              >
                {household?.oneOffDeposits?.length || 0}
              </span>
            </button>
          )}

          {/* Individual Category Tabs */}
          {categories.map((cat) => {
            const isSelected = selectedLedgerCategoryId === cat.id;
            const isCatSavings =
              cat.id === 'cat_savings' ||
              cat.type === 'savings' ||
              cat.group?.toLowerCase() === 'savings' ||
              cat.name.toLowerCase().includes('saving');
            const catCount = isCatSavings
              ? (checkIns || []).filter((c) => c.status === 'completed').length
              : expenses.filter((e) => e.categoryId === cat.id).length;

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

      {/* CATEGORY DRILL-DOWN TOP SECTION */}
      {/* If active category is Savings: Display Savings Goals Dashboard directly at top, hiding default budget summary */}
      {isSavingsCategory && activeCategory ? (
        <SavingsGoalsLedgerSection category={activeCategory} />
      ) : (
        /* Standard Category Drill-Down Hero Card for Expense/Bills/Essentials Categories */
        activeCategory && categoryBudgetStats && (
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
                      ? 'bg-alert-red-50 border-alert-red-200 text-alert-red-700'
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
            {(() => {
              const subList = (activeCategory.subcategories && activeCategory.subcategories.length > 0)
                ? activeCategory.subcategories
                : (activeCategory.description ? activeCategory.description.split(',').map((s) => s.trim()).filter(Boolean) : []);

              if (subList.length === 0) return null;

              return (
                <div className="bg-beige-50/70 border border-beige-200 rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-dark-green-900 uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5 text-sage-700" />
                    <span>Included Subcategories & Examples:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {subList.map((sub, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-0.5 bg-white border border-beige-300 rounded-lg text-brown-900 font-medium shadow-2xs"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Progress bar with Category Classification Color Logic */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-dark-green-900">
                <span>Timeframe Consumption</span>
                <span>{categoryBudgetStats.percentage}%</span>
              </div>
              <BudgetProgressBar
                spent={categoryBudgetStats.totalSpent}
                budget={categoryBudgetStats.budgetForTimeframe}
                categoryType={activeCategory.type || (activeCategory.group?.toLowerCase() === 'savings' ? 'savings' : 'expense')}
                height="h-3"
              />
            </div>
          </div>
        )
      )}

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-brown-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="ledger-search-input"
            type="text"
            placeholder={isSavingsCategory ? "Search deposits by notes, member, or amount..." : "Search description, category, member, or amount..."}
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
          Showing <strong>{isSavingsCategory ? filteredSavingsCheckIns.length : (filteredExpenses.length + filteredDeposits.length)}</strong> {(isSavingsCategory ? filteredSavingsCheckIns.length : (filteredExpenses.length + filteredDeposits.length)) === 1 ? 'record' : 'records'}
        </span>
        <span>
          {isSavingsCategory ? (
            <span className="text-dark-green-900 font-bold">
              Total Saved from Check-Ins: <strong className="font-extrabold font-mono text-dark-green-700">+{formatCurrency(totalSavingsDepositAmount)}</strong>
            </span>
          ) : (
            <>
              Expenses: <strong className="text-dark-green-900 font-extrabold">{formatCurrency(totalSelectedAmount)}</strong>
              {filteredDeposits.length > 0 && (
                <span className="ml-2 text-dark-green-700">
                  (Deposits: <strong>+{formatCurrency(filteredDeposits.reduce((s, d) => s + d.amount, 0))}</strong>)
                </span>
              )}
            </>
          )}
        </span>
      </div>

      {/* TRANSACTIONS, SAVINGS & DEPOSITS LIST */}
      {isSavingsCategory ? (
        // READ-ONLY SAVINGS CHECK-IN FEED
        filteredSavingsCheckIns.length === 0 ? (
          <div className="bg-white border border-beige-200 rounded-3xl p-10 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-sage-100 border border-sage-300 flex items-center justify-center text-dark-green-900 mx-auto">
              <TrendingUp className="w-7 h-7 text-dark-green-800" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-extrabold text-dark-green-900">
                No savings deposits recorded yet
              </h3>
              <p className="text-xs text-brown-700">
                {searchQuery
                  ? `No savings deposit matches your search query "${searchQuery}".`
                  : 'No savings deposits recorded yet. Complete a weekly check-in to bank your surplus.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* RENDER COMPLETED CHECK-IN DEPOSITS ONLY (READ-ONLY) */}
            {filteredSavingsCheckIns.map((ci) => {
              const payer = members.find((m) => m.userId === ci.completedByUserId);
              const savingsAmt = getCheckInSavingsAmount(ci);
              const displayDate = ci.weekEndDate || ci.weekStartDate;

              return (
                <div
                  key={ci.id}
                  id={`savings-checkin-${ci.id}`}
                  className="bg-white border border-sage-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-sage-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 shrink-0">
                        <TrendingUp className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-dark-green-900 text-sm sm:text-base leading-tight truncate">
                            Weekly Check-In Deposit
                          </h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-sage-100 text-dark-green-900 border border-sage-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3 text-dark-green-700" />
                            Completed Check-In
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-brown-700">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDateDisplay(displayDate)}
                          </span>
                          <span>&bull;</span>
                          <div className="flex items-center gap-1.5">
                            {payer?.avatarUrl ? (
                              <img
                                src={payer.avatarUrl}
                                alt={payer.name}
                                className="w-4 h-4 rounded-full object-cover border border-beige-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <User className="w-3.5 h-3.5 text-brown-700" />
                            )}
                            <span className="font-medium">
                              {ci.completedByName || payer?.name || 'Household Member'}
                            </span>
                          </div>
                        </div>

                        {ci.notes && (
                          <p className="text-xs text-dark-grey-600 bg-beige-50/70 border border-beige-200/80 rounded-lg px-2.5 py-1 mt-1">
                            {ci.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center sm:items-end justify-between sm:justify-center">
                      <div className="text-lg sm:text-xl font-black text-dark-green-800 tracking-tight font-mono">
                        +{formatCurrency(savingsAmt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // STANDARD EXPENSE & DEPOSITS VIEW
        filteredExpenses.length === 0 && filteredDeposits.length === 0 ? (
          <div className="bg-white border border-beige-200 rounded-3xl p-10 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 mx-auto">
              {activeCategory ? (
                <CategoryIcon name={activeCategory.name} group={activeCategory.group} icon={activeCategory.icon} className="w-7 h-7" />
              ) : selectedLedgerCategoryId === 'deposits' ? (
                <TrendingUp className="w-7 h-7 text-dark-green-800" />
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
                  ? `No record matches your search query "${searchQuery}".`
                  : selectedLedgerCategoryId === 'deposits'
                  ? 'No one-off deposits have been logged yet.'
                  : activeCategory
                  ? `No transactions recorded for ${activeCategory.name} yet.`
                  : 'No expenses have been logged in the household budget yet.'}
              </p>
            </div>
            {selectedLedgerCategoryId !== 'deposits' && (
              <button
                onClick={() => openLogExpenseModal(activeCategory)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Log an Expense Now</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* RENDER ONE-OFF INCOME DEPOSITS */}
            {filteredDeposits.map((dep) => {
              const payer = members.find((m) => m.userId === dep.payerMemberId);
              return (
                <div
                  key={dep.id}
                  id={`deposit-card-${dep.id}`}
                  className="bg-white border border-sage-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-sage-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 shrink-0">
                        <DollarSign className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-dark-green-900 text-sm sm:text-base leading-tight truncate">
                            {dep.description}
                          </h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-sage-100 text-dark-green-900 border border-sage-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-dark-green-700" />
                            One-Off Income
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-brown-700">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDateDisplay(dep.date)}
                          </span>
                          <span>&bull;</span>
                          <div className="flex items-center gap-1.5">
                            {payer?.avatarUrl ? (
                              <img
                                src={payer.avatarUrl}
                                alt={payer.name}
                                className="w-4 h-4 rounded-full object-cover border border-beige-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <User className="w-3.5 h-3.5 text-brown-700" />
                            )}
                            <span className="font-medium">{payer?.name || 'Household Member'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                      <div className="text-lg sm:text-xl font-black text-dark-green-800 tracking-tight font-mono">
                        +{formatCurrency(dep.amount)}
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await deleteDeposit(dep.id);
                        }}
                        id={`del-dep-${dep.id}`}
                        className="p-1.5 rounded-lg bg-white hover:bg-alert-red-50 text-brown-700 hover:text-alert-red-700 border border-beige-300 transition cursor-pointer"
                        title="Delete deposit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

          {/* RENDER REGULAR EXPENSES */}
          {filteredExpenses.map((exp) => {
            const cat = categories.find((c) => c.id === exp.categoryId);
            const member = members.find((m) => m.userId === exp.loggedByUserId);
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
                {/* TRANSACTION DISPLAY ROW */}
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
                        {exp.billFrequency && exp.billFrequency !== 'weekly' && (
                          <span className="text-[10px] font-bold text-sage-800 bg-sage-100 border border-sage-300 px-2 py-0.5 rounded-full capitalize flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" />
                            {exp.billFrequency} (Prorated)
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
                    <div className="text-right">
                      <div className="text-lg sm:text-xl font-black text-dark-green-900 tracking-tight font-mono">
                        {formatCurrency(exp.amount)}
                      </div>
                      {exp.billFrequency && exp.billFrequency !== 'weekly' && (
                        <div className="text-[10px] font-bold text-sage-800 tracking-tight">
                          Prorated: {formatCurrency(getProratedExpenseAmount(exp, activeDateRange.startDate, activeDateRange.endDate, household?.fiscalYearEndMonth || 12))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComments(exp.id);
                        }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditExpense(exp);
                        }}
                        id={`edit-exp-${exp.id}`}
                        className="p-1.5 rounded-lg bg-white hover:bg-beige-100 text-brown-700 hover:text-dark-green-900 border border-beige-300 transition cursor-pointer"
                        title="Edit transaction"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await deleteExpense(exp.id);
                        }}
                        id={`del-exp-${exp.id}`}
                        className="p-1.5 rounded-lg bg-white hover:bg-alert-red-50 text-brown-700 hover:text-alert-red-700 border border-beige-300 transition cursor-pointer"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

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
        )
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
                className="px-4 py-2 bg-dark-green-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE EDIT TRANSACTION MODAL */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-beige-200 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-beige-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-dark-green-900">
                    Edit Transaction
                  </h3>
                  <p className="text-xs text-brown-700">
                    Update all transaction fields, payer, and bill proration.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingExpense(null)}
                className="p-1.5 text-brown-700 hover:text-dark-green-900 rounded-lg hover:bg-beige-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Description */}
              <div className="space-y-1">
                <label className="block font-bold uppercase tracking-wider text-[10px] text-dark-green-900">
                  Description
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="e.g. Electric bill, Grocery run"
                  className="w-full px-3.5 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-hidden focus:border-dark-green-800 focus:bg-white"
                />
              </div>

              {/* Amount & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold uppercase tracking-wider text-[10px] text-dark-green-900">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900 font-mono focus:outline-hidden focus:border-dark-green-800 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold uppercase tracking-wider text-[10px] text-dark-green-900">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-hidden focus:border-dark-green-800 focus:bg-white"
                  />
                </div>
              </div>

              {/* Category & Payer Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold uppercase tracking-wider text-[10px] text-dark-green-900">
                    Category
                  </label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-hidden focus:border-dark-green-800 focus:bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.group})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold uppercase tracking-wider text-[10px] text-dark-green-900">
                    Paid By
                  </label>
                  <select
                    value={editPayerId}
                    onChange={(e) => setEditPayerId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-hidden focus:border-dark-green-800 focus:bg-white"
                  >
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} {m.userId === user?.userId ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bill Frequency & Proration Model Box */}
              <div className="p-4 bg-sage-50/80 border border-sage-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-sage-700" />
                    Bill Frequency & Proration Model
                  </label>
                  <span className="text-[9px] font-extrabold text-sage-800 bg-sage-200/70 px-2 py-0.5 rounded-full">
                    Paid-Only Proration
                  </span>
                </div>

                <select
                  value={editBillFrequency}
                  onChange={(e) => setEditBillFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-sage-300 rounded-xl text-xs font-bold text-dark-green-900 focus:outline-hidden focus:border-dark-green-800"
                >
                  <option value="none">One-Time Expense (No Proration - 100% charged to date)</option>
                  <option value="weekly">Weekly Recurring (Charged fully to active week)</option>
                  <option value="monthly">Monthly Recurring (Prorated across current 4-4-5 month weeks)</option>
                  <option value="annually">Annual Recurring (Prorated evenly across 52 fiscal weeks)</option>
                </select>

                {/* Proration Calculation Preview */}
                {editBillFrequency !== 'none' && editBillFrequency !== 'weekly' && (
                  <div className="p-2.5 bg-white/90 border border-sage-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-dark-grey-600">
                        Calculated Weekly Impact:
                      </span>
                      <span className="text-xs font-black text-dark-green-900 font-mono">
                        {editBillFrequency === 'monthly'
                          ? `~$${(editAmount / 4.333).toFixed(2)} / wk`
                          : `~$${(editAmount / 52).toFixed(2)} / wk`}
                      </span>
                    </div>
                    <p className="text-[10px] text-brown-700 leading-tight">
                      Only this paid bill will be prorated into active budget timeframes. Future recurring bills are not forward-generated until paid.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-beige-100">
              <button
                type="button"
                onClick={async () => {
                  if (editingExpense) {
                    await deleteExpense(editingExpense.id);
                    setEditingExpense(null);
                  }
                }}
                className="px-3.5 py-2 text-alert-red-700 hover:text-alert-red-800 hover:bg-alert-red-50 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-alert-red-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 text-brown-700 hover:text-dark-green-900 text-xs font-bold hover:bg-beige-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditExpense}
                  disabled={!editDesc.trim() || editAmount <= 0}
                  className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
