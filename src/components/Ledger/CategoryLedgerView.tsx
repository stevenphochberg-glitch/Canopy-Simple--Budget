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
  ChevronLeft,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Tag,
  Layers,
  Sparkles,
  PieChart,
  Send,
} from 'lucide-react';
import { Category, Expense, BillFrequency, CheckIn, OneOffDeposit } from '../../types';
import { parseExpenseTimestamp, getWeekRange, getWeekId } from '../../lib/calculations';
import { EarthToneReaction } from '../Common/EarthToneReaction';
import { BudgetProgressBar } from '../Common/BudgetProgressBar';
import { SavingsGoalsLedgerSection } from './SavingsGoalsLedgerSection';
import { LedgerDataVisualizer, LedgerDateRangeMeta } from './LedgerDataVisualizer';
import { CheckInImpactModal } from '../CheckIn/CheckInImpactModal';
import {
  formatCurrency,
  formatDateDisplay,
  getCategoryBudgetForTimeframe,
  calculateCategorySpending,
  getProratedExpenseAmount,
} from '../../lib/calculations';
import { getFiscalMonthForDate, getFiscalQuarterForDate, formatFiscalRecordTrackerString, getFiscalWeekId, getFiscalTrackerInfo } from '../../lib/fiscal445';

export type LedgerDateFilterType =
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'ytd'
  | 'last12months'
  | 'alltime'
  | 'custom';

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
    updateDeposit,
    deleteDeposit,
    updateExpense,
    updateCheckIn,
    showToast,
    addTransactionComment,
    addTransactionReaction,
    addCustomTag,
    renameTag,
    deleteTag,
  } = useHousehold();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  // Advanced Date Filter & Pagination State
  const [dateFilterType, setDateFilterType] = useState<LedgerDateFilterType>('month');
  const [dateFilterOffset, setDateFilterOffset] = useState<number>(0);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Tag Management State (Add / Rename / Delete dialogs)
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameTagInput, setRenameTagInput] = useState('');
  const [deletingTag, setDeletingTag] = useState<string | null>(null);

  // Edit Expense / Deposit modal state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingDeposit, setEditingDeposit] = useState<OneOffDeposit | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPayerId, setEditPayerId] = useState('');
  const [editBillFrequency, setEditBillFrequency] = useState<'none' | 'weekly' | 'monthly' | 'annually'>('none');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editCustomTagInput, setEditCustomTagInput] = useState('');

  // Interception Modal State for Post-Check-In Transactions (Directive 1 & 2)
  const [impactModalState, setImpactModalState] = useState<{
    isOpen: boolean;
    targetExpense: Expense | null;
    actionType: 'edit' | 'delete';
    proposedExpense?: Partial<Expense>;
    checkIn: CheckIn | null;
  }>({
    isOpen: false,
    targetExpense: null,
    actionType: 'delete',
    checkIn: null,
  });

  /**
   * Evaluates whether an expense belongs to a past completed fiscal week check-in.
   * If strictly completed and in the past, returns the CheckIn record.
   */
  const getCompletedPastCheckInForExpense = (exp: Expense): CheckIn | null => {
    const fiscalYearEnd = household?.fiscalYearEndMonth || 12;
    const expDateStr = exp.date || (exp.timestamp ? new Date(exp.timestamp).toISOString().split('T')[0] : '');
    if (!expDateStr) return null;

    const expFiscalWeekId = getFiscalWeekId(expDateStr, fiscalYearEnd);
    if (!expFiscalWeekId) return null;

    // Check if it's the current active week
    const currentActiveWeekRange = getWeekRange(new Date(), household?.firstDayOfWeek || 'Monday', 0);
    const currentActiveWeekId = getFiscalWeekId(currentActiveWeekRange.startDate, fiscalYearEnd);
    if (expFiscalWeekId === currentActiveWeekId) {
      // Current active week -> does not trigger historical interceptor
      return null;
    }

    // Check if matching check-in is strictly completed
    const matchingCheckIn = (checkIns || []).find((ci) => {
      if (ci.status !== 'completed') return false;
      const ciWeekId = ci.fiscalWeekId || getFiscalWeekId(ci.weekStartDate || ci.weekEndDate || ci.timestamp, fiscalYearEnd);
      return ciWeekId === expFiscalWeekId;
    });

    return matchingCheckIn || null;
  };

  /**
   * Delete expense handler with strict post-checkin interception.
   */
  const handleDeleteExpenseClick = async (exp: Expense) => {
    const completedCheckIn = getCompletedPastCheckInForExpense(exp);
    if (completedCheckIn) {
      setImpactModalState({
        isOpen: true,
        targetExpense: exp,
        actionType: 'delete',
        checkIn: completedCheckIn,
      });
      return;
    }
    await deleteExpense(exp.id);
  };

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

  // --------------------------------------------------------------------------
  // 1. ADVANCED DATE RANGE COMPUTATION & TIME-TRAVEL PAGINATION
  // --------------------------------------------------------------------------
  const dateRangeMeta: LedgerDateRangeMeta = useMemo(() => {
    const today = new Date();
    const firstDay = household?.firstDayOfWeek || 'Monday';
    const fiscalYearEnd = household?.fiscalYearEndMonth || 12;

    if (dateFilterType === 'week') {
      const range = getWeekRange(today, firstDay, dateFilterOffset);
      const isCurrent = dateFilterOffset === 0;
      const label = isCurrent
        ? `This Week (${formatDateDisplay(range.startDate.toISOString().split('T')[0])} - ${formatDateDisplay(range.endDate.toISOString().split('T')[0])})`
        : `Week of ${formatDateDisplay(range.startDate.toISOString().split('T')[0])} - ${formatDateDisplay(range.endDate.toISOString().split('T')[0])}`;
      return {
        startDate: range.startDate,
        endDate: range.endDate,
        label,
        filterType: 'week',
        isShorterThanMonth: true,
        isIncompleteMonth: false,
      };
    }

    if (dateFilterType === 'month') {
      // Offset by months
      const targetDate = new Date(today.getFullYear(), today.getMonth() + dateFilterOffset, 15);
      const fiscalMonth = getFiscalMonthForDate(targetDate, fiscalYearEnd);
      const isCurrent = dateFilterOffset === 0;
      const isIncomplete = isCurrent && today.getTime() < fiscalMonth.endDate.getTime();
      return {
        startDate: fiscalMonth.startDate,
        endDate: fiscalMonth.endDate,
        label: `${fiscalMonth.monthName} ${targetDate.getFullYear()}`,
        filterType: 'month',
        isShorterThanMonth: false,
        isIncompleteMonth: isIncomplete,
      };
    }

    if (dateFilterType === 'quarter') {
      const targetDate = new Date(today.getFullYear(), today.getMonth() + dateFilterOffset * 3, 15);
      const fiscalQ = getFiscalQuarterForDate(targetDate, fiscalYearEnd);
      const isCurrent = dateFilterOffset === 0;
      return {
        startDate: fiscalQ.startDate,
        endDate: fiscalQ.endDate,
        label: `${fiscalQ.quarterName} ${targetDate.getFullYear()}`,
        filterType: 'quarter',
        isShorterThanMonth: false,
        isIncompleteMonth: isCurrent && today.getTime() < fiscalQ.endDate.getTime(),
      };
    }

    if (dateFilterType === 'year') {
      const targetYear = today.getFullYear() + dateFilterOffset;
      const start = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      const end = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      const isCurrent = dateFilterOffset === 0;
      return {
        startDate: start,
        endDate: end,
        label: `Year ${targetYear}`,
        filterType: 'year',
        isShorterThanMonth: false,
        isIncompleteMonth: isCurrent,
      };
    }

    if (dateFilterType === 'ytd') {
      const targetYear = today.getFullYear() + dateFilterOffset;
      const start = new Date(targetYear, 0, 1, 0, 0, 0, 0);
      const end = dateFilterOffset === 0 ? today : new Date(targetYear, 11, 31, 23, 59, 59, 999);
      return {
        startDate: start,
        endDate: end,
        label: `YTD ${targetYear}`,
        filterType: 'ytd',
        isShorterThanMonth: false,
        isIncompleteMonth: dateFilterOffset === 0,
      };
    }

    if (dateFilterType === 'last12months') {
      const end = new Date(today.getTime() + dateFilterOffset * 365 * 24 * 60 * 60 * 1000);
      const start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
      return {
        startDate: start,
        endDate: end,
        label: `Last 12 Months (${formatDateDisplay(start.toISOString().split('T')[0])} - ${formatDateDisplay(end.toISOString().split('T')[0])})`,
        filterType: 'last12months',
        isShorterThanMonth: false,
        isIncompleteMonth: false,
      };
    }

    if (dateFilterType === 'alltime') {
      const start = new Date(2020, 0, 1);
      const end = new Date(2099, 11, 31);
      return {
        startDate: start,
        endDate: end,
        label: 'All Time',
        filterType: 'alltime',
        isShorterThanMonth: false,
        isIncompleteMonth: false,
      };
    }

    // Custom Date Range
    const start = new Date(customStartDate + 'T00:00:00');
    const end = new Date(customEndDate + 'T23:59:59');
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return {
      startDate: start,
      endDate: end,
      label: `${formatDateDisplay(customStartDate)} - ${formatDateDisplay(customEndDate)}`,
      filterType: 'custom',
      isShorterThanMonth: diffDays < 28,
      isIncompleteMonth: today >= start && today <= end,
    };
  }, [dateFilterType, dateFilterOffset, customStartDate, customEndDate, household?.firstDayOfWeek, household?.fiscalYearEndMonth]);

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

  // --------------------------------------------------------------------------
  // 2. TAGS EXTRACTION & MANAGEMENT
  // --------------------------------------------------------------------------
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();

    if (activeCategory) {
      (activeCategory.subcategories || []).forEach((t) => tagSet.add(t.trim()));
      expenses
        .filter((e) => e.categoryId === activeCategory.id)
        .forEach((e) => (e.tags || []).forEach((t) => tagSet.add(t.trim())));
    } else {
      categories.forEach((c) => (c.subcategories || []).forEach((t) => tagSet.add(t.trim())));
      expenses.forEach((e) => (e.tags || []).forEach((t) => tagSet.add(t.trim())));
    }

    return Array.from(tagSet).filter(Boolean);
  }, [activeCategory, categories, expenses]);

  // --------------------------------------------------------------------------
  // 3. FILTERED CHECK-INS, EXPENSES, & DEPOSITS (DATE RANGE & TAGS FILTER)
  // --------------------------------------------------------------------------
  const filteredSavingsCheckIns = useMemo(() => {
    if (!isSavingsCategory) return [];
    const completed = (checkIns || []).filter((c) => c.status === 'completed');
    const startT = dateRangeMeta.startDate.getTime();
    const endT = dateRangeMeta.endDate.getTime();

    return completed
      .filter((c) => {
        // Date range filter
        const time = c.timestamp || new Date(c.weekEndDate || c.weekStartDate).getTime();
        if (time < startT || time > endT) return false;

        // Member filter
        if (selectedMemberFilter !== 'all' && c.completedByUserId && c.completedByUserId !== selectedMemberFilter) {
          return false;
        }

        // Search query
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
  }, [isSavingsCategory, checkIns, dateRangeMeta, selectedMemberFilter, searchQuery, sortBy, members]);

  const filteredExpenses = useMemo(() => {
    if (selectedLedgerCategoryId === 'deposits' || isSavingsCategory) return [];
    const startT = dateRangeMeta.startDate.getTime();
    const endT = dateRangeMeta.endDate.getTime();
    const fiscalYearEnd = household?.fiscalYearEndMonth || 12;

    return expenses
      .filter((exp) => {
        // Category filter
        if (selectedLedgerCategoryId && exp.categoryId !== selectedLedgerCategoryId) {
          return false;
        }

        // Tag filter
        if (selectedTagFilter) {
          if (selectedTagFilter === '__untagged') {
            if (exp.tags && exp.tags.length > 0) return false;
          } else {
            if (!exp.tags || !exp.tags.some((t) => t.trim().toLowerCase() === selectedTagFilter.toLowerCase())) {
              return false;
            }
          }
        }

        // Member filter
        if (selectedMemberFilter !== 'all' && exp.loggedByUserId !== selectedMemberFilter) {
          return false;
        }

        // Date range filter with proration support
        const prorated = getProratedExpenseAmount(exp, dateRangeMeta.startDate, dateRangeMeta.endDate, fiscalYearEnd);
        if (prorated <= 0) {
          const expTime = exp.timestamp || new Date(exp.date + (exp.date.length === 10 ? 'T12:00:00' : '')).getTime();
          if (expTime < startT || expTime > endT) {
            return false;
          }
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesDesc = exp.description.toLowerCase().includes(q);
          const cat = categories.find((c) => c.id === exp.categoryId);
          const matchesCat = cat?.name.toLowerCase().includes(q) || cat?.group.toLowerCase().includes(q);
          const member = members.find((m) => m.userId === exp.loggedByUserId);
          const matchesMember = member?.name.toLowerCase().includes(q);
          const matchesAmount = exp.amount.toString().includes(q);
          const matchesTag = exp.tags ? exp.tags.some((t) => t.toLowerCase().includes(q)) : false;
          if (!matchesDesc && !matchesCat && !matchesMember && !matchesAmount && !matchesTag) {
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
  }, [expenses, selectedLedgerCategoryId, isSavingsCategory, dateRangeMeta, selectedTagFilter, selectedMemberFilter, searchQuery, sortBy, categories, members, household?.fiscalYearEndMonth]);

  const filteredDeposits = useMemo(() => {
    if (selectedLedgerCategoryId && selectedLedgerCategoryId !== 'deposits') {
      return [];
    }
    const deps = household?.oneOffDeposits || [];
    const startT = dateRangeMeta.startDate.getTime();
    const endT = dateRangeMeta.endDate.getTime();

    return deps
      .filter((dep) => {
        // Date range filter
        const depTime = new Date(dep.date + (dep.date.length === 10 ? 'T12:00:00' : '')).getTime();
        if (depTime < startT || depTime > endT) return false;

        // Member filter
        if (selectedMemberFilter !== 'all' && dep.payerMemberId && dep.payerMemberId !== selectedMemberFilter) {
          return false;
        }

        // Search query
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
  }, [household?.oneOffDeposits, selectedLedgerCategoryId, dateRangeMeta, selectedMemberFilter, searchQuery, sortBy, members]);

  // Aggregate metrics for active selection
  const totalSelectedAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const totalSavingsDepositAmount = useMemo(() => {
    return filteredSavingsCheckIns.reduce((sum, c) => sum + getCheckInSavingsAmount(c), 0);
  }, [filteredSavingsCheckIns]);

  // --------------------------------------------------------------------------
  // 4. DYNAMIC BUDGET TRACKING STATS (STRICTLY CALCULATED FOR TIMEFRAME)
  // --------------------------------------------------------------------------
  const categoryBudgetStats = useMemo(() => {
    if (!activeCategory) return null;

    const baseWeekly = activeCategory.baselineBudget || activeCategory.currentWeeklyBudget || 0;
    const days = Math.max(1, Math.round((dateRangeMeta.endDate.getTime() - dateRangeMeta.startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const weeksRatio = days / 7;
    const budgetForTimeframe = Math.round(baseWeekly * weeksRatio);

    if (isSavingsCategory) {
      const totalSaved = filteredSavingsCheckIns.reduce((sum, c) => sum + getCheckInSavingsAmount(c), 0);
      const remaining = budgetForTimeframe - totalSaved;
      const percentage = budgetForTimeframe > 0 ? Math.round((totalSaved / budgetForTimeframe) * 100) : 0;
      return { budgetForTimeframe, totalSpent: totalSaved, count: filteredSavingsCheckIns.length, remaining, percentage };
    }

    const { totalSpent, count } = calculateCategorySpending(
      expenses,
      activeCategory.id,
      dateRangeMeta.startDate,
      dateRangeMeta.endDate
    );
    const remaining = budgetForTimeframe - totalSpent;
    const percentage = budgetForTimeframe > 0 ? Math.round((totalSpent / budgetForTimeframe) * 100) : 0;
    return { budgetForTimeframe, totalSpent, count, remaining, percentage };
  }, [activeCategory, isSavingsCategory, dateRangeMeta, filteredSavingsCheckIns, expenses]);

  // --------------------------------------------------------------------------
  // 5. DYNAMIC LOGGING BUTTON COMPUTATION
  // --------------------------------------------------------------------------
  const loggingButtonConfig = useMemo(() => {
    if (isSavingsCategory) {
      return null; // Savings tab: completely hide logging button
    }
    if (selectedLedgerCategoryId === null) {
      return {
        label: '+ Log Transactions',
        onClick: () => openLogExpenseModal(null, false), // Unlocked
      };
    }
    if (selectedLedgerCategoryId === 'deposits') {
      return {
        label: '+ Log Deposit',
        onClick: () => openLogExpenseModal('cat_one_time_deposit', true), // Locked to deposits
      };
    }
    if (activeCategory) {
      const isBills = activeCategory.group === 'Bills' || activeCategory.name.toLowerCase().includes('bill');
      const isEssentials = activeCategory.group === 'Essentials' || activeCategory.name.toLowerCase().includes('essential');
      const isFunMoney = activeCategory.group === 'Fun Money' || activeCategory.name.toLowerCase().includes('fun');

      let label = `+ Log ${activeCategory.name} Expense`;
      if (isBills) label = '+ Log Bills';
      else if (isEssentials) label = '+ Log Essentials Expense';
      else if (isFunMoney) label = '+ Log Fun Money Expense';

      return {
        label,
        onClick: () => openLogExpenseModal(activeCategory, true), // Locked to this category
      };
    }
    return {
      label: '+ Log Expense',
      onClick: () => openLogExpenseModal(null, false),
    };
  }, [isSavingsCategory, selectedLedgerCategoryId, activeCategory, openLogExpenseModal]);

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

  // --------------------------------------------------------------------------
  // 6. EDIT TRANSACTION WITH TAGGING & BILLS-ONLY TIMEFRAME
  // --------------------------------------------------------------------------
  const startEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setEditingDeposit(null);
    setEditDesc(exp.description);
    setEditAmount(exp.amount);
    setEditCategoryId(exp.categoryId);
    setEditDate(exp.date);
    setEditPayerId(exp.loggedByUserId || user?.userId || 'usr_self');
    setEditBillFrequency(exp.billFrequency || 'none');
    setEditTags(exp.tags ? [...exp.tags] : []);
    setEditCustomTagInput('');
  };

  const startEditDeposit = (dep: OneOffDeposit) => {
    setEditingDeposit(dep);
    setEditingExpense(null);
    setEditDesc(dep.description || '');
    setEditAmount(dep.amount);
    setEditDate(dep.date);
    setEditPayerId(dep.payerMemberId || user?.userId || 'usr_self');
  };

  const saveEditDeposit = async () => {
    if (!editingDeposit || !editDesc.trim() || editAmount <= 0) return;
    await updateDeposit(editingDeposit.id, {
      description: editDesc.trim(),
      amount: Number(editAmount),
      date: editDate,
      payerMemberId: editPayerId,
    });
    setEditingDeposit(null);
  };

  const saveEditExpense = async () => {
    if (!editingExpense || !editDesc.trim() || editAmount <= 0) return;
    const editedCat = categories.find((c) => c.id === editCategoryId);
    const isBills = editedCat?.group === 'Bills' || editedCat?.name.toLowerCase().includes('bill');

    // Timeframe / BillFrequency only applies to Bills category
    const frequency = isBills && editBillFrequency !== 'none' ? (editBillFrequency as BillFrequency) : undefined;

    const proposed: Partial<Expense> = {
      description: editDesc.trim(),
      amount: Number(editAmount),
      categoryId: editCategoryId,
      date: editDate,
      timestamp: parseExpenseTimestamp({ date: editDate }),
      loggedByUserId: editPayerId,
      billFrequency: frequency,
      tags: editTags,
    };

    const completedCheckIn = getCompletedPastCheckInForExpense(editingExpense);
    if (completedCheckIn) {
      setImpactModalState({
        isOpen: true,
        targetExpense: editingExpense,
        actionType: 'edit',
        proposedExpense: proposed,
        checkIn: completedCheckIn,
      });
      setEditingExpense(null);
      return;
    }

    await updateExpense(editingExpense.id, proposed);
    setEditingExpense(null);
  };

  /**
   * Confirms and persists the check-in rebalance & transaction mutation.
   */
  const handleConfirmImpact = async (simulatedValues: {
    bankedSavings: number;
    totalSpent: number;
    totalBudget: number;
    decisions: any[];
  }) => {
    if (!impactModalState.targetExpense || !impactModalState.checkIn) return;
    const target = impactModalState.targetExpense;
    const ci = impactModalState.checkIn;
    const action = impactModalState.actionType;

    const weekStart = new Date(ci.weekStartDate + (ci.weekStartDate.length === 10 ? 'T12:00:00' : ''));
    const trackerInfo = getFiscalTrackerInfo(weekStart, household?.fiscalYearEndMonth || 12);
    const weekLabel = `W${trackerInfo.weekOfFiscalMonth}`;

    // 1. Execute mutation
    if (action === 'delete') {
      await deleteExpense(target.id);
    } else if (action === 'edit' && impactModalState.proposedExpense) {
      await updateExpense(target.id, impactModalState.proposedExpense);
    }

    // 2. Overwrite historical checkIn
    await updateCheckIn(ci.id, {
      totalSaved: simulatedValues.bankedSavings,
      totalSpent: simulatedValues.totalSpent,
      totalBudget: simulatedValues.totalBudget,
      decisions: simulatedValues.decisions,
    });

    // 3. Trigger UI toast notification
    showToast(`Transaction updated and ${weekLabel} check-in successfully rebalanced.`, 'success');
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
            {activeCategory ? `${activeCategory.name} Ledger` : selectedLedgerCategoryId === 'deposits' ? 'Income & Deposits' : 'All Household Transactions'}
          </h1>
          <p className="text-xs sm:text-sm text-brown-700">
            {activeCategory
              ? `Reviewing dedicated category activity, tags distribution, social notes, and line-item receipts.`
              : selectedLedgerCategoryId === 'deposits'
              ? `Reviewing household one-off deposits and savings additions.`
              : `Consolidated transaction history across all ${categories.length} budget categories and household members.`}
          </p>
        </div>

        {/* Dynamic Action Button - Strictly Hidden for Savings category */}
        {loggingButtonConfig && (
          <div className="flex items-center gap-2.5">
            <button
              id="ledger-dynamic-log-btn"
              onClick={loggingButtonConfig.onClick}
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs sm:text-sm font-extrabold rounded-2xl shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{loggingButtonConfig.label}</span>
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
            onClick={() => {
              setSelectedLedgerCategoryId(null);
              setSelectedTagFilter(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer border ${
              selectedLedgerCategoryId === null
                ? 'bg-dark-green-900 text-white border-dark-green-900 shadow-sm'
                : 'bg-white text-dark-green-900 hover:bg-beige-100/80 border-beige-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
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
              onClick={() => {
                setSelectedLedgerCategoryId('deposits');
                setSelectedTagFilter(null);
              }}
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
                onClick={() => {
                  setSelectedLedgerCategoryId(cat.id);
                  setSelectedTagFilter(null);
                }}
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

      {/* LEDGER DATA VISUALIZATIONS (PIE CHARTS / SAVINGS LINE GRAPH) */}
      <LedgerDataVisualizer
        activeTabCategory={activeCategory}
        selectedTabId={selectedLedgerCategoryId}
        expenses={expenses}
        deposits={household?.oneOffDeposits || []}
        household={household}
        categories={categories}
        dateRangeMeta={dateRangeMeta}
        checkIns={checkIns}
        members={members}
      />

      {/* CATEGORY DRILL-DOWN BUDGET TRACKING (TAGS REMOVED, STRICT TIMEFRAME MATH) */}
      {isSavingsCategory && activeCategory ? (
        <SavingsGoalsLedgerSection category={activeCategory} />
      ) : (
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
                    Weekly Baseline: <strong>{formatCurrency(activeCategory.baselineBudget)}</strong> &bull; Selected Range: <strong>{dateRangeMeta.label}</strong>
                  </p>
                </div>
              </div>

              {/* Dynamic Budget Metrics for Active Date Range */}
              <div className="flex items-center gap-3 text-xs flex-wrap">
                <div className="bg-beige-50 border border-beige-200 px-3.5 py-2 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-dark-grey-600 block">
                    Timeframe Target
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

            {/* Progress bar */}
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

      {/* FILTER & CONTROL TOOLBAR (ADVANCED DATE FILTER, PAGINATION, TAG MANAGEMENT) */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* ROW 1: Advanced Date Range Selector & Pagination Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-beige-200">
          {/* Left: Date Range Dropdown & Time-Travel Pagination */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 bg-beige-50 border border-beige-200 px-3 py-1.5 rounded-xl">
              <Calendar className="w-3.5 h-3.5 text-brown-700" />
              <select
                id="ledger-date-filter-select"
                value={dateFilterType}
                onChange={(e) => {
                  setDateFilterType(e.target.value as LedgerDateFilterType);
                  setDateFilterOffset(0);
                }}
                className="bg-transparent text-xs font-extrabold text-dark-green-900 focus:outline-hidden cursor-pointer"
              >
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
                <option value="ytd">YTD</option>
                <option value="last12months">Last 12 Months</option>
                <option value="alltime">All Time</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Pagination Controls (Left / Current / Right) */}
            {dateFilterType !== 'alltime' && dateFilterType !== 'custom' && (
              <div className="flex items-center gap-1 bg-beige-50 border border-beige-200 p-1 rounded-xl">
                <button
                  type="button"
                  id="ledger-prev-period-btn"
                  onClick={() => setDateFilterOffset((prev) => prev - 1)}
                  title="Previous time block"
                  className="p-1 rounded-lg hover:bg-beige-200/80 text-dark-green-900 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-extrabold text-dark-green-900 px-2 min-w-[90px] text-center font-mono">
                  {dateRangeMeta.label}
                </span>
                <button
                  type="button"
                  id="ledger-next-period-btn"
                  onClick={() => setDateFilterOffset((prev) => prev + 1)}
                  title="Next time block"
                  className="p-1 rounded-lg hover:bg-beige-200/80 text-dark-green-900 transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {dateFilterOffset !== 0 && (
                  <button
                    type="button"
                    onClick={() => setDateFilterOffset(0)}
                    title="Reset to current"
                    className="p-1 rounded-lg hover:bg-beige-200 text-brown-700 hover:text-dark-green-900 transition ml-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Custom Date Pickers */}
            {dateFilterType === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-beige-50 border border-beige-200 rounded-xl text-xs font-bold text-dark-green-900"
                />
                <span className="text-xs text-brown-700 font-bold">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-beige-50 border border-beige-200 rounded-xl text-xs font-bold text-dark-green-900"
                />
              </div>
            )}
          </div>

          {/* Right: Member filter & Sort By */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
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

        {/* ROW 2: Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-brown-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="ledger-search-input"
            type="text"
            placeholder={isSavingsCategory ? "Search deposits by notes, member, or amount..." : "Search description, category, member, tags, or amount..."}
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

        {/* ROW 3: TAG MANAGEMENT & FILTER CHIPS (RELOCATED TO FILTER SECTION) */}
        {!isSavingsCategory && selectedLedgerCategoryId !== 'deposits' && (
          <div className="space-y-2 pt-1 border-t border-beige-100">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-dark-green-900">
                <Tag className="w-3.5 h-3.5 text-sage-700" />
                <span>Filter by Tag / Manage Tags:</span>
              </div>
              <button
                type="button"
                id="ledger-add-tag-btn"
                onClick={() => {
                  setNewTagInput('');
                  setIsAddTagOpen(true);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-dark-green-900 hover:text-dark-green-950 bg-sage-50 hover:bg-sage-100 border border-sage-300 px-2.5 py-1 rounded-xl transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Tag</span>
              </button>
            </div>

            {/* Tag Chips List with Click-to-Filter and CRUD Actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* All Tags chip */}
              <button
                type="button"
                onClick={() => setSelectedTagFilter(null)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  selectedTagFilter === null
                    ? 'bg-dark-green-900 text-white border-dark-green-900 shadow-2xs'
                    : 'bg-beige-50 hover:bg-beige-100 text-brown-900 border-beige-300'
                }`}
              >
                All Tags
              </button>

              {/* Available Custom & Subcategory Tags */}
              {availableTags.map((tag) => {
                const isSelected = selectedTagFilter?.toLowerCase() === tag.toLowerCase();
                return (
                  <div
                    key={tag}
                    className={`inline-flex items-center rounded-xl border text-xs font-bold transition shadow-2xs ${
                      isSelected
                        ? 'bg-dark-green-900 text-white border-dark-green-900'
                        : 'bg-white hover:bg-beige-50 text-dark-green-950 border-beige-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedTagFilter(isSelected ? null : tag)}
                      className="px-2.5 py-1 cursor-pointer flex items-center gap-1"
                    >
                      <span>#{tag}</span>
                    </button>

                    {/* Tag CRUD Actions (Rename & Delete) */}
                    <div className="flex items-center pr-1.5 pl-0.5 border-l border-current/20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingTag(tag);
                          setRenameTagInput(tag);
                        }}
                        title={`Rename #${tag} across all historical transactions`}
                        className="p-1 hover:opacity-80 transition cursor-pointer"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingTag(tag);
                        }}
                        title={`Delete #${tag} from all transactions`}
                        className="p-1 hover:opacity-80 text-alert-red-600 hover:text-alert-red-700 transition cursor-pointer"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Untagged filter chip */}
              <button
                type="button"
                onClick={() => setSelectedTagFilter(selectedTagFilter === '__untagged' ? null : '__untagged')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  selectedTagFilter === '__untagged'
                    ? 'bg-dark-green-900 text-white border-dark-green-900'
                    : 'bg-beige-50/70 hover:bg-beige-100 text-brown-700 border-beige-300'
                }`}
              >
                Untagged Only
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUMMARY BANNER */}
      <div className="flex items-center justify-between text-xs text-brown-700 px-1">
        <span>
          Showing <strong>{isSavingsCategory ? filteredSavingsCheckIns.length : (filteredExpenses.length + filteredDeposits.length)}</strong> {(isSavingsCategory ? filteredSavingsCheckIns.length : (filteredExpenses.length + filteredDeposits.length)) === 1 ? 'record' : 'records'} in <strong>{dateRangeMeta.label}</strong>
          {selectedTagFilter && <span className="ml-1 text-dark-green-900 font-bold">(Filtered by #{selectedTagFilter})</span>}
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
                No savings deposits recorded in this period
              </h3>
              <p className="text-xs text-brown-700">
                {searchQuery
                  ? `No savings deposit matches your search query "${searchQuery}".`
                  : `No completed check-ins found for ${dateRangeMeta.label}.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
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

                        {/* Fiscal Tracker String (Directive 4.4) */}
                        <div className="text-[11px] font-mono font-bold text-dark-green-900 bg-sage-50 border border-sage-200/90 px-2 py-0.5 rounded-md inline-block">
                          {formatFiscalRecordTrackerString(displayDate || ci.timestamp, household?.fiscalYearEndMonth || 12)}
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
                  : selectedTagFilter
                  ? `No transactions with tag #${selectedTagFilter} in ${dateRangeMeta.label}.`
                  : selectedLedgerCategoryId === 'deposits'
                  ? `No one-off deposits found in ${dateRangeMeta.label}.`
                  : activeCategory
                  ? `No transactions recorded for ${activeCategory.name} in ${dateRangeMeta.label}.`
                  : `No expenses logged for ${dateRangeMeta.label}.`}
              </p>
            </div>
            {loggingButtonConfig && (
              <button
                onClick={loggingButtonConfig.onClick}
                className="inline-flex items-center gap-2 px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{loggingButtonConfig.label}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* RENDER ONE-OFF INCOME DEPOSITS */}
            {filteredDeposits.map((dep) => {
              const payer = members.find((m) => m.userId === dep.payerMemberId);
              const comments = dep.comments || [];
              const isCommentsOpen = !!expandedComments[dep.id];

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

                      {/* Interactivity Buttons for Deposit (Comments, Edit, Delete) */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleComments(dep.id);
                          }}
                          id={`comment-toggle-${dep.id}`}
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
                            startEditDeposit(dep);
                          }}
                          id={`edit-dep-${dep.id}`}
                          className="p-1.5 rounded-lg bg-white hover:bg-beige-100 text-brown-700 hover:text-dark-green-900 border border-beige-300 transition cursor-pointer"
                          title="Edit deposit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

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

                  {/* SOCIAL REACTIONS BAR */}
                  <div className="pt-1.5 border-t border-sage-100">
                    <EarthToneReaction
                      reactions={dep.reactions || []}
                      onReact={(reactionId) => addTransactionReaction(dep.id, reactionId)}
                      currentUserId={user?.userId}
                    />
                  </div>

                  {/* COMMENTS SECTION */}
                  {isCommentsOpen && (
                    <div className="mt-2 pt-3 border-t border-sage-100 space-y-2.5 bg-sage-50/50 p-3 rounded-xl">
                      <div className="flex items-center justify-between text-xs font-bold text-dark-green-900 mb-1">
                        <span>Comments & Activity Notes</span>
                        <span className="text-brown-700 text-[11px]">
                          {comments.length} {comments.length === 1 ? 'note' : 'notes'}
                        </span>
                      </div>

                      {comments.length === 0 ? (
                        <p className="text-xs text-brown-700 italic">
                          No comments on this deposit yet. Add a note below!
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {comments.map((c) => (
                            <div
                              key={c.id}
                              className="bg-white border border-sage-200 p-2.5 rounded-xl space-y-1 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  {c.authorAvatar ? (
                                    <img
                                      src={c.authorAvatar}
                                      alt={c.authorName}
                                      className="w-4 h-4 rounded-full object-cover border border-beige-300"
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
                          placeholder="Write a comment or note..."
                          value={commentInputs[dep.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [dep.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSendComment(dep.id);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 bg-white border border-sage-200 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-hidden focus:border-dark-green-800"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendComment(dep.id)}
                          disabled={!commentInputs[dep.id]?.trim()}
                          className="px-3 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <Send className="w-3 h-3" />
                          <span>Post</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* RENDER REGULAR EXPENSES */}
            {filteredExpenses.map((exp) => {
              const cat = categories.find((c) => c.id === exp.categoryId);
              const member = members.find((m) => m.userId === exp.loggedByUserId);
              const comments = exp.comments || [];
              const isCommentsOpen = !!expandedComments[exp.id];

              return (
                <div
                  key={exp.id}
                  id={`expense-card-${exp.id}`}
                  className="bg-white border border-beige-200/90 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-beige-300 transition-all space-y-3"
                >
                  {/* TRANSACTION DISPLAY ROW */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Category Icon, Description, Tags, Date, Payer */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        onClick={() => cat && setSelectedLedgerCategoryId(cat.id)}
                        title={`Filter by ${cat?.name || 'Category'}`}
                        className="w-10 h-10 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 shrink-0 cursor-pointer hover:scale-105 transition-transform"
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

                          {/* Render Assigned Tags */}
                          {(exp.tags || []).map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              onClick={() => setSelectedTagFilter(tag)}
                              className="text-[10px] font-bold text-brown-800 bg-beige-50 hover:bg-beige-100 border border-beige-300 px-2 py-0.5 rounded-full cursor-pointer transition flex items-center gap-0.5"
                            >
                              <Tag className="w-2.5 h-2.5 text-sage-700" />
                              <span>{tag}</span>
                            </span>
                          ))}

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
                            Prorated: {formatCurrency(getProratedExpenseAmount(exp, dateRangeMeta.startDate, dateRangeMeta.endDate, household?.fiscalYearEndMonth || 12))}
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
                            await handleDeleteExpenseClick(exp);
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

                  {/* SOCIAL REACTIONS BAR (CUSTOM EARTH-TONE SVG ICONS WITH ANIMATION) */}
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

      {/* TAG ADD MODAL */}
      {isAddTagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-beige-200 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between border-b border-beige-100 pb-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-sage-700" />
                <h3 className="text-sm font-extrabold text-dark-green-900">Add New Tag</h3>
              </div>
              <button
                onClick={() => setIsAddTagOpen(false)}
                className="p-1 text-brown-700 hover:text-dark-green-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-dark-green-900">Tag Name</label>
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="e.g. Groceries, Gas, Coffee"
                className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-hidden focus:border-dark-green-800"
                autoFocus
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newTagInput.trim()) {
                    await addCustomTag(newTagInput.trim(), activeCategory?.id);
                    setIsAddTagOpen(false);
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddTagOpen(false)}
                className="px-3 py-1.5 text-xs font-bold text-brown-700 hover:bg-beige-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newTagInput.trim()}
                onClick={async () => {
                  await addCustomTag(newTagInput.trim(), activeCategory?.id);
                  setIsAddTagOpen(false);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-dark-green-800 hover:bg-dark-green-900 text-white rounded-xl disabled:opacity-50"
              >
                Save Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAG RENAME MODAL (CASCADING BATCH UPDATE) */}
      {renamingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-beige-200 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between border-b border-beige-100 pb-2">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-sage-700" />
                <h3 className="text-sm font-extrabold text-dark-green-900">Rename Tag</h3>
              </div>
              <button
                onClick={() => setRenamingTag(null)}
                className="p-1 text-brown-700 hover:text-dark-green-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-brown-700">
              Renaming <strong>#{renamingTag}</strong> will automatically update all historical transactions and categories that use this tag.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-dark-green-900">New Tag Name</label>
              <input
                type="text"
                value={renameTagInput}
                onChange={(e) => setRenameTagInput(e.target.value)}
                className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-hidden focus:border-dark-green-800"
                autoFocus
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && renameTagInput.trim()) {
                    await renameTag(renamingTag, renameTagInput.trim(), activeCategory?.id);
                    if (selectedTagFilter === renamingTag) {
                      setSelectedTagFilter(renameTagInput.trim());
                    }
                    setRenamingTag(null);
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingTag(null)}
                className="px-3 py-1.5 text-xs font-bold text-brown-700 hover:bg-beige-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!renameTagInput.trim() || renameTagInput.trim() === renamingTag}
                onClick={async () => {
                  await renameTag(renamingTag, renameTagInput.trim(), activeCategory?.id);
                  if (selectedTagFilter === renamingTag) {
                    setSelectedTagFilter(renameTagInput.trim());
                  }
                  setRenamingTag(null);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-dark-green-800 hover:bg-dark-green-900 text-white rounded-xl disabled:opacity-50"
              >
                Rename Everywhere
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAG DELETE CONFIRMATION MODAL (CASCADING BATCH REMOVAL) */}
      {deletingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-beige-200 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between border-b border-beige-100 pb-2">
              <div className="flex items-center gap-2 text-alert-red-700">
                <Trash2 className="w-4 h-4" />
                <h3 className="text-sm font-extrabold">Delete Tag</h3>
              </div>
              <button
                onClick={() => setDeletingTag(null)}
                className="p-1 text-brown-700 hover:text-dark-green-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-brown-700 leading-relaxed">
              Are you sure you want to remove tag <strong>#{deletingTag}</strong>? This will remove the tag from all historical transaction records across your household ledger.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTag(null)}
                className="px-3 py-1.5 text-xs font-bold text-brown-700 hover:bg-beige-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteTag(deletingTag, activeCategory?.id);
                  if (selectedTagFilter === deletingTag) {
                    setSelectedTagFilter(null);
                  }
                  setDeletingTag(null);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-alert-red-600 hover:bg-alert-red-700 text-white rounded-xl shadow-2xs"
              >
                Remove Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE EDIT TRANSACTION MODAL (WITH TAGGING & BILLS-ONLY TIMEFRAME) */}
      {editingExpense && (() => {
        const editedCat = categories.find((c) => c.id === editCategoryId);
        const isBills = editedCat?.group === 'Bills' || editedCat?.name.toLowerCase().includes('bill');

        return (
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
                      Update details, tags, and category assignment.
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

                {/* Tagging Selector for Edit Transaction */}
                <div className="space-y-2 p-3.5 bg-beige-50/70 border border-beige-200 rounded-2xl">
                  <label className="block font-bold uppercase tracking-wider text-[10px] text-dark-green-900 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-sage-700" />
                    Transaction Tags
                  </label>

                  {/* Selected tag chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {editTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-dark-green-900 text-white rounded-lg text-xs font-bold"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => setEditTags((prev) => prev.filter((t) => t !== tag))}
                          className="hover:text-alert-red-300 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Suggested tags from edited category */}
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {(editedCat?.subcategories || []).map((sub) => {
                      const isAttached = editTags.includes(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => {
                            if (isAttached) {
                              setEditTags((prev) => prev.filter((t) => t !== sub));
                            } else {
                              setEditTags((prev) => [...prev, sub]);
                            }
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded-lg border transition font-medium cursor-pointer ${
                            isAttached
                              ? 'bg-sage-100 text-dark-green-950 border-sage-300 font-bold'
                              : 'bg-white hover:bg-beige-100 text-brown-800 border-beige-300'
                          }`}
                        >
                          {isAttached ? '✓ ' : '+ '}#{sub}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add custom tag to transaction */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Add another tag..."
                      value={editCustomTagInput}
                      onChange={(e) => setEditCustomTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = editCustomTagInput.trim();
                          if (val && !editTags.includes(val)) {
                            setEditTags((prev) => [...prev, val]);
                            setEditCustomTagInput('');
                          }
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-white border border-beige-300 rounded-lg text-xs font-semibold text-dark-green-900 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = editCustomTagInput.trim();
                        if (val && !editTags.includes(val)) {
                          setEditTags((prev) => [...prev, val]);
                          setEditCustomTagInput('');
                        }
                      }}
                      disabled={!editCustomTagInput.trim()}
                      className="px-3 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Timeframe / Bill Frequency & Proration Model Box: ONLY SHOWN IF BILLS CATEGORY */}
                {isBills && (
                  <div className="p-4 bg-sage-50/80 border border-sage-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-sage-700" />
                        Timeframe & Bill Proration Model
                      </label>
                      <span className="text-[9px] font-extrabold text-sage-800 bg-sage-200/70 px-2 py-0.5 rounded-full">
                        Bills Only
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
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-beige-100">
                <button
                  type="button"
                  onClick={async () => {
                    if (editingExpense) {
                      const expToDelete = editingExpense;
                      setEditingExpense(null);
                      await handleDeleteExpenseClick(expToDelete);
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
        );
      })()}

      {/* EDIT DEPOSIT MODAL */}
      {editingDeposit && (
        <div className="fixed inset-0 z-50 bg-dark-green-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-beige-300 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-beige-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-dark-green-900">Edit One-Off Income</h3>
                  <p className="text-[11px] text-brown-700">Update deposit details or contributor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDeposit(null)}
                className="p-1 rounded-xl text-brown-600 hover:text-dark-green-900 hover:bg-beige-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="block font-bold uppercase tracking-wider text-[10px] text-dark-green-900">
                  Description / Source
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900 focus:outline-hidden focus:border-dark-green-800 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold uppercase tracking-wider text-[10px] text-dark-green-900">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editAmount || ''}
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

              <div className="space-y-1">
                <label className="block font-bold uppercase tracking-wider text-[10px] text-dark-green-900">
                  Received / Contributed By
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

            <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-beige-100">
              <button
                type="button"
                onClick={async () => {
                  if (editingDeposit) {
                    await deleteDeposit(editingDeposit.id);
                    setEditingDeposit(null);
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
                  onClick={() => setEditingDeposit(null)}
                  className="px-4 py-2 text-brown-700 hover:text-dark-green-900 text-xs font-bold hover:bg-beige-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditDeposit}
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

      {/* Historical Check-In Impact Interception Modal (Directive 1-5) */}
      {impactModalState.isOpen && impactModalState.targetExpense && impactModalState.checkIn && (
        <CheckInImpactModal
          isOpen={impactModalState.isOpen}
          onClose={() =>
            setImpactModalState({
              isOpen: false,
              targetExpense: null,
              actionType: 'delete',
              checkIn: null,
            })
          }
          targetExpense={impactModalState.targetExpense}
          actionType={impactModalState.actionType}
          proposedExpense={impactModalState.proposedExpense}
          checkIn={impactModalState.checkIn}
          categories={categories}
          expenses={expenses}
          household={household}
          onConfirm={handleConfirmImpact}
        />
      )}
    </div>
  );
};
