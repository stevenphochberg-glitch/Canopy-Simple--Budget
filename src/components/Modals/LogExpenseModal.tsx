import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { Category, CategoryGroup, StagedExpense, BillFrequency } from '../../types';
import {
  formatCurrency,
  getWeekRange,
  getWeekId,
  getCategoryEffectiveWeeklyBudget,
} from '../../lib/calculations';
import { getFiscalYearMonths, getFiscalWeekId } from '../../lib/fiscal445';
import { parseQuickNoteWithGemini, scanReceiptWithGemini } from '../../lib/geminiApi';
import { DepositCheckInImpactModal } from './DepositCheckInImpactModal';
import { MultiTagSplitModal } from './MultiTagSplitModal';
import {
  X,
  Plus,
  Sparkles,
  Camera,
  Upload,
  Receipt,
  Edit3,
  CheckCircle2,
  DollarSign,
  Tag,
  FileText,
  AlertCircle,
  Layers,
  Trash2,
  ArrowRight,
  Loader2,
  Image as ImageIcon,
  Calendar,
  Users,
  PiggyBank,
} from 'lucide-react';

const LAST_TAB_STORAGE_KEY = 'canopy_last_log_tab';
type LogTab = 'manual' | 'quicknote' | 'scan';

interface LogExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: Category | string | null;
  isCategoryLocked?: boolean;
}

export const LogExpenseModal: React.FC<LogExpenseModalProps> = ({
  isOpen,
  onClose,
  initialCategory,
  isCategoryLocked = false,
}) => {
  const {
    categories,
    members,
    user,
    household,
    savingsGoals,
    checkIns,
    addOneOffDeposit,
    addStagedItem,
    showToast,
    openStagingModal,
  } = useHousehold();

  const [depositImpactState, setDepositImpactState] = useState<{
    isOpen: boolean;
    amount: number;
    description: string;
    date: string;
    checkIn: any;
  } | null>(null);

  const [multiTagPromptState, setMultiTagPromptState] = useState<{
    isOpen: boolean;
    totalAmount: number;
    description: string;
    categoryName?: string;
    tags: string[];
    actionType: 'proceed_staging' | 'save_add_another';
  } | null>(null);

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

  const handleConfirmDepositImpact = async () => {
    if (!depositImpactState) return;
    await addOneOffDeposit({
      amount: depositImpactState.amount,
      description: depositImpactState.description,
      date: depositImpactState.date,
      payerMemberId: manualLoggedBy,
    });
    setDepositImpactState(null);
    onClose();
  };

  // Remember & default to user's last selected tab
  const [activeTab, setActiveTab] = useState<LogTab>('manual');
  const [comingSoonMessage, setComingSoonMessage] = useState<string | null>(null);

  const handleTabChange = (tab: LogTab) => {
    if (tab === 'quicknote') {
      setComingSoonMessage('Quick Note (AI) is coming soon! Please use Manual Entry.');
      return;
    }
    if (tab === 'scan') {
      setComingSoonMessage('Scan Receipt is coming soon! Please use Manual Entry.');
      return;
    }
    setActiveTab('manual');
    localStorage.setItem(LAST_TAB_STORAGE_KEY, 'manual');
  };

  // Available expense categories (strictly exclude savings categories)
  const availableExpenseCategories = useMemo(() => {
    return categories.filter(
      (c) =>
        c.id !== 'cat_savings' &&
        c.type !== 'savings' &&
        c.group?.toLowerCase() !== 'savings' &&
        !c.name.toLowerCase().includes('saving')
    );
  }, [categories]);

  const isSavingsCategory = (cat?: Category | null) => {
    if (!cat) return false;
    return (
      cat.id === 'cat_savings' ||
      cat.type === 'savings' ||
      cat.group?.toLowerCase() === 'savings' ||
      cat.name.toLowerCase().includes('saving')
    );
  };

  // -------------------------------------------------------------
  // PATH A: Manual Entry State
  // -------------------------------------------------------------
  const [manualAmount, setManualAmount] = useState<string>('');
  const [manualDescription, setManualDescription] = useState<string>('');
  const [manualCategoryId, setManualCategoryId] = useState<string>(() => {
    if (initialCategory?.id) {
      if (isSavingsCategory(initialCategory)) {
        return 'cat_one_time_deposit';
      }
      return initialCategory.id;
    }
    return availableExpenseCategories[0]?.id || 'cat_one_time_deposit';
  });
  const [manualDate, setManualDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [manualLoggedBy, setManualLoggedBy] = useState<string>(
    user?.userId || 'usr_self'
  );
  const [manualBillFrequency, setManualBillFrequency] = useState<BillFrequency>('monthly');

  // Generate fiscal weeks list for custom date range picker (current year + next year)
  const fiscalWeekOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1];
    const options: { id: string; label: string; startDate: string; endDate: string }[] = [];

    years.forEach((year) => {
      const months = getFiscalYearMonths(year);
      let weekOfYear = 1;

      months.forEach((m) => {
        const start = new Date(m.startDate);
        for (let w = 0; w < m.weekCount; w++) {
          const weekStart = new Date(start);
          weekStart.setDate(weekStart.getDate() + w * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);

          const startStr = weekStart.toISOString().split('T')[0];
          const endStr = weekEnd.toISOString().split('T')[0];
          const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
          const startDay = weekStart.getDate();
          const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
          const endDay = weekEnd.getDate();
          const weekOfMonth = w + 1;

          const yearSuffix = year !== currentYear ? ` '${String(year).slice(-2)}` : '';
          const label = `W${weekOfYear} (${startMonth} ${startDay} - ${endMonth} ${endDay}${yearSuffix}) W${weekOfMonth}`;

          options.push({
            id: `FY${year}-W${weekOfYear}-${startStr}`,
            label,
            startDate: startStr,
            endDate: endStr,
          });

          weekOfYear++;
        }
      });
    });

    return options;
  }, []);

  const [manualBillStartDate, setManualBillStartDate] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    return monday.toISOString().split('T')[0];
  });
  const [manualBillEndDate, setManualBillEndDate] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const sunday = new Date(today);
    sunday.setDate(today.getDate() + diffToMonday + 27); // 4 full weeks
    return sunday.toISOString().split('T')[0];
  });

  // One-Time Deposit state
  const isOneTimeDeposit = manualCategoryId === 'cat_one_time_deposit';
  const [depositDestination, setDepositDestination] = useState<'savings_budget' | 'goal'>('savings_budget');
  const [selectedGoalId, setSelectedGoalId] = useState<string>(() => {
    return savingsGoals[0]?.id || 'goal_emergency';
  });

  // Tagging engine state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState<string>('');

  // Manual Batch Queue (for "Save & Add Another")
  const [manualBatch, setManualBatch] = useState<StagedExpense[]>([]);

  const selectedManualCat = isOneTimeDeposit
    ? null
    : availableExpenseCategories.find((c) => c.id === manualCategoryId) || availableExpenseCategories[0] || null;

  const isBillsCategory =
    selectedManualCat?.group === 'Bills' ||
    selectedManualCat?.name.toLowerCase().includes('bill');

  const activeWeekId = useMemo(() => {
    const today = new Date();
    const firstDay = household?.firstDayOfWeek || 'Monday';
    const currentWeekRange = getWeekRange(today, firstDay, 0);
    return getWeekId(currentWeekRange, firstDay);
  }, [household?.firstDayOfWeek]);

  // Keep category selection synced when modal opens or initialCategory changes
  useEffect(() => {
    if (isOpen) {
      if (initialCategory) {
        if (typeof initialCategory === 'object' && initialCategory.id) {
          if (isSavingsCategory(initialCategory)) {
            setManualCategoryId('cat_one_time_deposit');
          } else {
            setManualCategoryId(initialCategory.id);
          }
        } else if (typeof initialCategory === 'string') {
          if (initialCategory === 'deposits' || initialCategory === 'cat_one_time_deposit') {
            setManualCategoryId('cat_one_time_deposit');
          } else {
            setManualCategoryId(initialCategory);
          }
        }
      } else if (!isCategoryLocked) {
        setManualCategoryId((prev) => (prev ? prev : availableExpenseCategories[0]?.id || 'cat_one_time_deposit'));
      }
    }
  }, [isOpen, initialCategory, isCategoryLocked, availableExpenseCategories]);

  // Keep selectedGoalId synced with savingsGoals
  useEffect(() => {
    if (savingsGoals.length > 0 && !savingsGoals.some((g) => g.id === selectedGoalId)) {
      setSelectedGoalId(savingsGoals[0].id);
    }
  }, [savingsGoals, selectedGoalId]);

  // Reset or initialize subcategory tags when category changes
  useEffect(() => {
    setSelectedTags([]);
    setCustomTagInput('');
  }, [manualCategoryId]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customTagInput.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed]);
      setCustomTagInput('');
    }
  };

  // Additive Quick-Add Math Logic: increments the current manualAmount by preset value
  const handleQuickAdd = (preset: number) => {
    const current = parseFloat(manualAmount) || 0;
    const next = Math.round((current + preset) * 100) / 100;
    setManualAmount(Number.isInteger(next) ? next.toString() : next.toFixed(2));
  };

  // Helper for dynamic category examples
  const getCategoryExamples = (cat?: Category | null): string => {
    if (!cat) return 'Groceries, Fuel, Dining, Subscriptions';
    const name = cat.name.toLowerCase();
    const group = cat.group?.toLowerCase() || '';

    if (name.includes('bill') || group.includes('bill')) {
      return 'Subscriptions, Utilities, Mortgage, Rent';
    }
    if (cat.subcategories && cat.subcategories.length > 0) {
      return cat.subcategories.join(', ');
    }
    if (name.includes('essential') || name.includes('grocer') || group.includes('essential')) {
      return 'Groceries, Gas & Transit, Personal Goods, Pharmacy';
    }
    if (name.includes('fun') || name.includes('dining') || group.includes('fun')) {
      return 'Restaurants & Dining, Coffee & Drinks, Shopping, Entertainment';
    }
    return 'General household spending';
  };

  // Sync initialCategory if changed from external trigger
  useEffect(() => {
    if (initialCategory?.id) {
      if (isSavingsCategory(initialCategory)) {
        setManualCategoryId('cat_one_time_deposit');
      } else {
        setManualCategoryId(initialCategory.id);
      }
    }
  }, [initialCategory]);

  // Validate manualCategoryId: allow cat_one_time_deposit OR any known category
  useEffect(() => {
    if (
      manualCategoryId &&
      manualCategoryId !== 'cat_one_time_deposit' &&
      availableExpenseCategories.length > 0 &&
      !availableExpenseCategories.some((c) => c.id === manualCategoryId)
    ) {
      setManualCategoryId(availableExpenseCategories[0].id);
    }
  }, [availableExpenseCategories, manualCategoryId]);

  useEffect(() => {
    if (user?.userId) {
      setManualLoggedBy(user.userId);
    }
  }, [user]);

  const handleSaveAndAddAnother = () => {
    const numAmount = parseFloat(manualAmount);
    if (!numAmount || numAmount <= 0) {
      showToast('Please enter an amount greater than $0.00');
      return;
    }

    if (isOneTimeDeposit) {
      const completedCi = getCompletedCheckInForDate(manualDate);
      if (completedCi) {
        setDepositImpactState({
          isOpen: true,
          amount: numAmount,
          description: manualDescription.trim() || 'One-Time Savings Deposit',
          date: manualDate,
          checkIn: completedCi,
        });
        return;
      }
    }

    // Prompt user to split into separate transactions if more than 1 tag is selected
    if (!isOneTimeDeposit && selectedTags.length > 1) {
      setMultiTagPromptState({
        isOpen: true,
        totalAmount: numAmount,
        description: manualDescription.trim() || 'Manual Expense',
        categoryName: selectedManualCat?.name,
        tags: selectedTags,
        actionType: 'save_add_another',
      });
      return;
    }

    const resolvedCategoryId = isOneTimeDeposit
      ? 'cat_savings'
      : manualCategoryId && availableExpenseCategories.some((c) => c.id === manualCategoryId)
      ? manualCategoryId
      : availableExpenseCategories[0]?.id || '';

    const defaultDesc = isOneTimeDeposit
      ? 'One-Time Savings Deposit'
      : 'Manual Expense';

    const newItem: StagedExpense = {
      amount: numAmount,
      description: manualDescription.trim() || defaultDesc,
      categoryId: resolvedCategoryId,
      date: manualDate || new Date().toISOString().split('T')[0],
      loggedByUserId: manualLoggedBy || user?.userId || 'usr_self',
      billFrequency: isBillsCategory ? manualBillFrequency : undefined,
      billStartDate: isBillsCategory && manualBillFrequency === 'custom' ? manualBillStartDate : undefined,
      billEndDate: isBillsCategory && manualBillFrequency === 'custom' ? manualBillEndDate : undefined,
      tags: isOneTimeDeposit
        ? ['One-Time Deposit', 'Budget Expansion']
        : selectedTags.length > 0
        ? selectedTags
        : undefined,
      subcategory: isOneTimeDeposit ? undefined : selectedTags[0] || undefined,
      depositDestination: isOneTimeDeposit ? 'savings_budget' : undefined,
      targetGoalId: undefined,
    };

    setManualBatch((prev) => [...prev, newItem]);
    // Reset amount & description for next item, keep category/date for quick entry
    setManualAmount('');
    setManualDescription('');
    setSelectedTags([]);
    showToast(`Added "$${numAmount.toFixed(2)}" to current batch (${manualBatch.length + 1} items).`);
  };

  const handleManualProceedToStaging = async () => {
    const currentNum = parseFloat(manualAmount);
    const itemsToStage: StagedExpense[] = [...manualBatch];

    const resolvedCategoryId = isOneTimeDeposit
      ? 'cat_savings'
      : manualCategoryId && availableExpenseCategories.some((c) => c.id === manualCategoryId)
      ? manualCategoryId
      : availableExpenseCategories[0]?.id || '';

    const defaultDesc = isOneTimeDeposit
      ? 'One-Time Savings Deposit'
      : 'Manual Expense';

    // Check if user is logging a deposit for a week that is already checked in
    if (isOneTimeDeposit && currentNum > 0) {
      const completedCi = getCompletedCheckInForDate(manualDate);
      if (completedCi) {
        setDepositImpactState({
          isOpen: true,
          amount: currentNum,
          description: manualDescription.trim() || defaultDesc,
          date: manualDate,
          checkIn: completedCi,
        });
        return;
      }
    }

    // Prompt user to split into separate transactions if more than 1 tag is selected on current input
    if (!isOneTimeDeposit && currentNum > 0 && selectedTags.length > 1) {
      setMultiTagPromptState({
        isOpen: true,
        totalAmount: currentNum,
        description: manualDescription.trim() || defaultDesc,
        categoryName: selectedManualCat?.name,
        tags: selectedTags,
        actionType: 'proceed_staging',
      });
      return;
    }

    // Check if any batched deposit belongs to a checked-in week
    const depositInBatch = itemsToStage.find((item) => {
      const isDep = item.categoryId === 'cat_savings' || item.depositDestination === 'savings_budget' || item.tags?.includes('One-Time Deposit');
      if (!isDep) return false;
      return !!getCompletedCheckInForDate(item.date);
    });

    if (depositInBatch) {
      const completedCi = getCompletedCheckInForDate(depositInBatch.date);
      if (completedCi) {
        setDepositImpactState({
          isOpen: true,
          amount: depositInBatch.amount,
          description: depositInBatch.description,
          date: depositInBatch.date,
          checkIn: completedCi,
        });
        return;
      }
    }

    // If user is directly logging a single deposit for an unchecked week, log immediately
    if (isOneTimeDeposit && currentNum > 0 && itemsToStage.length === 0) {
      await addOneOffDeposit({
        amount: currentNum,
        description: manualDescription.trim() || defaultDesc,
        date: manualDate || new Date().toISOString().split('T')[0],
        payerMemberId: manualLoggedBy,
      });
      onClose();
      return;
    }

    // If the user filled the current fields, add it too
    if (currentNum && currentNum > 0) {
      itemsToStage.push({
        amount: currentNum,
        description: manualDescription.trim() || defaultDesc,
        categoryId: resolvedCategoryId,
        date: manualDate || new Date().toISOString().split('T')[0],
        loggedByUserId: manualLoggedBy || user?.userId || 'usr_self',
        billFrequency: isBillsCategory ? manualBillFrequency : undefined,
        billStartDate: isBillsCategory && manualBillFrequency === 'custom' ? manualBillStartDate : undefined,
        billEndDate: isBillsCategory && manualBillFrequency === 'custom' ? manualBillEndDate : undefined,
        tags: isOneTimeDeposit
          ? ['One-Time Deposit', 'Budget Expansion']
          : selectedTags.length > 0
          ? selectedTags
          : undefined,
        subcategory: isOneTimeDeposit ? undefined : selectedTags[0] || undefined,
        depositDestination: isOneTimeDeposit ? 'savings_budget' : undefined,
        targetGoalId: undefined,
      });
    }

    if (itemsToStage.length === 0) {
      showToast('Please enter an amount for your transaction.');
      return;
    }

    // Reset local batch and inputs
    setManualBatch([]);
    setManualAmount('');
    setManualDescription('');
    setSelectedTags([]);

    // Close Log modal and open Review & Confirm staging view
    onClose();
    openStagingModal(itemsToStage);
  };

  const handleConfirmSplitFromPrompt = (
    splitItems: Array<{ tag: string; amount: number; description: string }>
  ) => {
    if (!multiTagPromptState) return;

    const resolvedCategoryId =
      manualCategoryId && availableExpenseCategories.some((c) => c.id === manualCategoryId)
        ? manualCategoryId
        : availableExpenseCategories[0]?.id || '';

    const newItems: StagedExpense[] = splitItems.map((item) => ({
      amount: item.amount,
      description: item.description,
      categoryId: resolvedCategoryId,
      date: manualDate || new Date().toISOString().split('T')[0],
      loggedByUserId: manualLoggedBy || user?.userId || 'usr_self',
      billFrequency: isBillsCategory ? manualBillFrequency : undefined,
      billStartDate: isBillsCategory && manualBillFrequency === 'custom' ? manualBillStartDate : undefined,
      billEndDate: isBillsCategory && manualBillFrequency === 'custom' ? manualBillEndDate : undefined,
      tags: [item.tag],
      subcategory: item.tag,
    }));

    if (multiTagPromptState.actionType === 'save_add_another') {
      setManualBatch((prev) => [...prev, ...newItems]);
      setManualAmount('');
      setManualDescription('');
      setSelectedTags([]);
      setMultiTagPromptState(null);
      showToast(`Created ${newItems.length} separate transactions for batch (${manualBatch.length + newItems.length} items total).`);
    } else {
      const itemsToStage = [...manualBatch, ...newItems];
      setManualBatch([]);
      setManualAmount('');
      setManualDescription('');
      setSelectedTags([]);
      setMultiTagPromptState(null);
      onClose();
      openStagingModal(itemsToStage);
    }
  };

  const handleKeepSingleFromPrompt = () => {
    if (!multiTagPromptState) return;

    const resolvedCategoryId =
      manualCategoryId && availableExpenseCategories.some((c) => c.id === manualCategoryId)
        ? manualCategoryId
        : availableExpenseCategories[0]?.id || '';

    const singleItem: StagedExpense = {
      amount: multiTagPromptState.totalAmount,
      description: multiTagPromptState.description,
      categoryId: resolvedCategoryId,
      date: manualDate || new Date().toISOString().split('T')[0],
      loggedByUserId: manualLoggedBy || user?.userId || 'usr_self',
      billFrequency: isBillsCategory ? manualBillFrequency : undefined,
      billStartDate: isBillsCategory && manualBillFrequency === 'custom' ? manualBillStartDate : undefined,
      billEndDate: isBillsCategory && manualBillFrequency === 'custom' ? manualBillEndDate : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      subcategory: selectedTags[0] || undefined,
    };

    if (multiTagPromptState.actionType === 'save_add_another') {
      setManualBatch((prev) => [...prev, singleItem]);
      setManualAmount('');
      setManualDescription('');
      setSelectedTags([]);
      setMultiTagPromptState(null);
      showToast(`Added multi-tagged "$${singleItem.amount.toFixed(2)}" to batch (${manualBatch.length + 1} items).`);
    } else {
      const itemsToStage = [...manualBatch, singleItem];
      setManualBatch([]);
      setManualAmount('');
      setManualDescription('');
      setSelectedTags([]);
      setMultiTagPromptState(null);
      onClose();
      openStagingModal(itemsToStage);
    }
  };

  const removeBatchItem = (index: number) => {
    setManualBatch((prev) => prev.filter((_, idx) => idx !== index));
  };

  // -------------------------------------------------------------
  // PATH B: Quick Note (AI NLP) State
  // -------------------------------------------------------------
  const [quickNoteText, setQuickNoteText] = useState<string>('');
  const [isParsingNote, setIsParsingNote] = useState<boolean>(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const sampleQuickNotes = [
    'I paid $50 in gas, $150 at the bar last night, and had to pay my $75 cell phone bill yesterday. I also paid $25 for a case of beer.',
    'Spent $84.20 on groceries at Trader Joes, $6.50 for iced matcha latte, and $15 for Uber ride home',
    'Order Total $132.50: Amazon Prime Essentials $45.00, Household cleaning supplies $22.50, Protein powder $65.00',
    'Con Edison electric bill $88.40, Netflix $19.99, Spotify $11.99',
  ];

  const handleParseQuickNote = async () => {
    if (!quickNoteText.trim()) {
      showToast('Please enter some text or paste an order receipt to parse.');
      return;
    }

    setIsParsingNote(true);
    setNoteError(null);

    try {
      const parsedItems = await parseQuickNoteWithGemini(quickNoteText, availableExpenseCategories);
      if (!parsedItems || parsedItems.length === 0) {
        throw new Error('No transaction entities could be detected in this text.');
      }

      const stagedItems: StagedExpense[] = parsedItems.map((item) => ({
        amount: item.amount,
        description: item.description,
        categoryId: item.matchedCategoryId,
        date: new Date().toISOString().split('T')[0],
        loggedByUserId: user?.userId || 'usr_self',
      }));

      onClose();
      setQuickNoteText('');
      openStagingModal(stagedItems);
      showToast(`✓ Gemini AI extracted ${stagedItems.length} distinct line items!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse natural language note.';
      setNoteError(msg);
    } finally {
      setIsParsingNote(false);
    }
  };

  // -------------------------------------------------------------
  // PATH C: Photo Receipt Scanner State
  // -------------------------------------------------------------
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isScanningReceipt, setIsScanningReceipt] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const sampleReceiptPresets = [
    {
      title: 'Trader Joe’s Market ($48.20)',
      subtitle: 'Groceries: Milk, Eggs, Organic Apples, Bread',
      dataUrl:
        'https://images.unsplash.com/photo-1554415707-9e4c0188824f?w=600&auto=format&fit=crop&q=80',
    },
    {
      title: 'Artisan Cafe & Bakery ($14.75)',
      subtitle: 'Coffee, Almond Croissant, Avocado Toast',
      dataUrl:
        'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=600&auto=format&fit=crop&q=80',
    },
    {
      title: 'Chevron Fuel & Snacks ($46.50)',
      subtitle: 'Gasoline 12.4 Gal ($41.00), Sparkling Water ($5.50)',
      dataUrl:
        'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80',
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setScanError(null);
    }
  };

  const handleSelectPreset = (preset: typeof sampleReceiptPresets[0]) => {
    setSelectedFile(null);
    setImagePreviewUrl(preset.dataUrl);
    setScanError(null);
  };

  const handleScanReceipt = async () => {
    if (!selectedFile && !imagePreviewUrl) {
      showToast('Please upload or select a receipt photo first.');
      return;
    }

    setIsScanningReceipt(true);
    setScanError(null);

    try {
      const source = selectedFile || imagePreviewUrl!;
      const householdId = household?.id || 'hh_local';
      const { items, receiptUrl } = await scanReceiptWithGemini(
        source,
        householdId,
        availableExpenseCategories,
        selectedFile?.name
      );

      if (!items || items.length === 0) {
        throw new Error('Could not identify line items on this receipt image.');
      }

      const stagedItems: StagedExpense[] = items.map((item) => ({
        amount: item.amount,
        description: item.description,
        categoryId: item.matchedCategoryId,
        date: new Date().toISOString().split('T')[0],
        loggedByUserId: user?.userId || 'usr_self',
        receiptImgUrl: receiptUrl || imagePreviewUrl || undefined,
      }));

      onClose();
      setSelectedFile(null);
      setImagePreviewUrl(null);
      openStagingModal(stagedItems);
      showToast(`✓ Gemini Multimodal parsed ${stagedItems.length} receipt items!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Receipt scan failed.';
      setScanError(msg);
    } finally {
      setIsScanningReceipt(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl border border-beige-200 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-beige-200 flex items-center justify-between bg-beige-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-dark-green-800 text-white flex items-center justify-center shadow-xs">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-dark-green-900 tracking-tight">
                Log Transaction
              </h2>
              <p className="text-xs text-brown-700">
                Choose your preferred logging path &bull; Routed to Review & Confirm
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-beige-200 text-brown-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Persistent Tabs */}
        <div className="px-6 pt-3 pb-2 bg-beige-50/50 border-b border-beige-200">
          <div className="flex p-1 bg-beige-200/70 rounded-2xl gap-1">
            {/* Tab A: Manual Entry */}
            <button
              id="tab-manual-entry"
              onClick={() => handleTabChange('manual')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-white text-dark-green-900 shadow-xs'
                  : 'text-dark-grey-700 hover:text-dark-green-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Manual Entry</span>
              {manualBatch.length > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-dark-green-800 text-white text-[10px] flex items-center justify-center">
                  {manualBatch.length}
                </span>
              )}
            </button>

            {/* Tab B: Quick Note (AI) - Disabled */}
            <button
              id="tab-quick-note-ai"
              type="button"
              onClick={() => handleTabChange('quicknote')}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition opacity-60 text-dark-grey-600 hover:opacity-80 cursor-pointer select-none"
              title="Quick Note (AI) - Coming Soon"
            >
              <Sparkles className="w-3.5 h-3.5 text-sage-600" />
              <span>Quick Note (AI)</span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-beige-300 text-brown-800">
                Soon
              </span>
            </button>

            {/* Tab C: Scan Receipt - Disabled */}
            <button
              id="tab-scan-receipt"
              type="button"
              onClick={() => handleTabChange('scan')}
              className="flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition opacity-60 text-dark-grey-600 hover:opacity-80 cursor-pointer select-none"
              title="Scan Receipt - Coming Soon"
            >
              <Camera className="w-3.5 h-3.5 text-brown-700" />
              <span>Scan Receipt</span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-beige-300 text-brown-800">
                Soon
              </span>
            </button>
          </div>
        </div>

        {/* Coming Soon Notice Banner */}
        {comingSoonMessage && (
          <div className="mx-6 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 font-semibold animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{comingSoonMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setComingSoonMessage(null)}
              className="p-1 rounded-full hover:bg-amber-100 text-amber-800 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {/* ============================================================== */}
          {/* PATH A: MANUAL ENTRY                                           */}
          {/* ============================================================== */}
          {activeTab === 'manual' && (
            <div className="space-y-5">
              {/* Batch Queue Pill Bar if user already added items */}
              {manualBatch.length > 0 && (
                <div className="p-3.5 bg-sage-50 border border-sage-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-dark-green-900">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-sage-700" />
                      Current Staging Batch: {manualBatch.length}{' '}
                      {manualBatch.length === 1 ? 'item' : 'items'}
                    </span>
                    <span className="font-extrabold text-dark-green-950">
                      Total: {formatCurrency(manualBatch.reduce((sum, i) => sum + i.amount, 0))}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {manualBatch.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 bg-white border border-sage-200 px-2.5 py-1 rounded-xl text-xs"
                      >
                        <span className="font-bold text-dark-green-900">
                          {formatCurrency(item.amount)}
                        </span>
                        <span className="text-dark-grey-600 truncate max-w-[100px]">
                          {item.description}
                        </span>
                        <button
                          onClick={() => removeBatchItem(idx)}
                          className="text-brown-700 hover:text-alert-red-700 ml-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Field 1: Category Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-sage-700" />
                      Category Selection
                    </span>
                    {isCategoryLocked && (
                      <span className="text-[10px] font-bold text-brown-700 bg-beige-200 px-2 py-0.5 rounded-full">
                        Locked to Tab
                      </span>
                    )}
                  </label>
                  <select
                    id="manual-select-category"
                    value={manualCategoryId}
                    onChange={(e) => setManualCategoryId(e.target.value)}
                    disabled={isCategoryLocked}
                    className={`w-full px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition ${
                      isCategoryLocked
                        ? 'bg-beige-200/70 border border-beige-300 text-dark-grey-700 cursor-not-allowed opacity-90'
                        : 'bg-beige-50 border border-beige-300 text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white'
                    }`}
                  >
                    {availableExpenseCategories.map((cat) => {
                      const isBills = cat.group === 'Bills' || cat.name.toLowerCase().includes('bill');
                      const effectiveWeekly = getCategoryEffectiveWeeklyBudget(cat, activeWeekId, household);
                      
                      if (isBills) {
                        const monthlyBudget = Math.round((cat.baselineBudget || 0) * (52 / 12));
                        return (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({formatCurrency(monthlyBudget)}/mo)
                          </option>
                        );
                      }

                      return (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({formatCurrency(effectiveWeekly.budget)}/wk)
                        </option>
                      );
                    })}
                    <option value="cat_one_time_deposit">
                      One-Time Deposit (Savings Allocation)
                    </option>
                  </select>
                </div>

                {/* Field 2 (when Bills category is selected): Bill Billing Frequency */}
                {isBillsCategory && (
                  <div className="space-y-2 p-3.5 bg-sage-50/80 border border-sage-200 rounded-2xl animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-sage-700" />
                        Bill Billing Frequency
                      </label>
                    </div>

                    <select
                      id="manual-select-bill-frequency"
                      value={manualBillFrequency}
                      onChange={(e) => setManualBillFrequency(e.target.value as BillFrequency)}
                      className="w-full px-3.5 py-2 bg-white border border-sage-300 rounded-xl text-xs sm:text-sm font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom</option>
                    </select>

                    {manualBillFrequency === 'custom' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 animate-in fade-in">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-sage-700" />
                            Start Week
                          </label>
                          <select
                            id="manual-input-bill-start-date"
                            value={manualBillStartDate}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              setManualBillStartDate(newStart);
                              if (manualBillEndDate < newStart) {
                                const matched = fiscalWeekOptions.find((o) => o.startDate === newStart);
                                if (matched) setManualBillEndDate(matched.endDate);
                              }
                            }}
                            className="w-full px-3 py-2 bg-white border border-sage-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                          >
                            {fiscalWeekOptions.map((opt) => (
                              <option key={opt.id} value={opt.startDate}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-sage-700" />
                            End Week
                          </label>
                          <select
                            id="manual-input-bill-end-date"
                            value={manualBillEndDate}
                            onChange={(e) => setManualBillEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-sage-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                          >
                            {fiscalWeekOptions
                              .filter((opt) => opt.endDate >= manualBillStartDate)
                              .map((opt) => (
                                <option key={opt.id} value={opt.endDate}>
                                  {opt.label}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 pt-0.5 text-[11px] text-brown-700 leading-snug">
                      <p>
                        <strong>Note:</strong> Bills are not included in weekly budgeting and will only show in the Monthly view dashboard.
                      </p>
                      {manualBillFrequency === 'yearly' && (
                        <p className="text-sage-800 font-semibold pt-0.5">
                          This yearly expense will be prorated equally over the next 12 months starting with the month that the Bill was logged in.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Field 2 / 3: Description */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-sage-700" />
                    Description
                  </label>
                  <input
                    id="manual-input-description"
                    type="text"
                    placeholder={
                      isOneTimeDeposit
                        ? 'e.g. Tax Refund, Bonus, Gift, Birthday Money'
                        : "e.g. Trader Joe's, Shell Gas, Lunch with team"
                    }
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-beige-50 border border-beige-300 rounded-2xl text-xs sm:text-sm font-medium text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white transition"
                  />
                </div>

                {/* Field 3: Amount ($) and Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  {/* Amount */}
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-sage-700" />
                        Amount ($)
                      </span>
                      <span className="text-[10px] text-brown-700 font-normal">
                        Required
                      </span>
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-2xl font-black text-dark-green-900">
                        $
                      </span>
                      <input
                        id="manual-input-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-beige-50 border border-beige-300 rounded-2xl text-2xl sm:text-3xl font-black text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white transition"
                        autoFocus
                      />
                    </div>

                    {/* Quick Preset Buttons - Additive Math Logic */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[5, 10, 20, 50, 100].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleQuickAdd(preset)}
                          className="px-2.5 py-1 rounded-lg bg-beige-100 hover:bg-sage-100 text-[11px] font-bold text-dark-green-900 border border-beige-200 transition cursor-pointer"
                        >
                          +${preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-sage-700" />
                      Date
                    </label>
                    <input
                      id="manual-input-date"
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full px-4 py-3 bg-beige-50 border border-beige-300 rounded-2xl text-xs sm:text-sm font-semibold text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Subcategory & Tagging Engine (for Standard Categories & One-Time Deposits) */}
                {(selectedManualCat || isOneTimeDeposit) && (
                  <div className="space-y-2 p-3.5 bg-beige-50/80 border border-beige-200 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-sage-700" />
                        Subcategories & Tags
                      </label>
                      <span className="text-[10px] text-brown-700 font-medium">
                        Click tags or add custom
                      </span>
                    </div>

                    {/* Pre-defined Subcategory Pills */}
                    {((isOneTimeDeposit
                      ? ['Tax Refund', 'Bonus', 'Gift', 'Birthday', 'Side Hustle']
                      : selectedManualCat?.subcategories) || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(isOneTimeDeposit
                          ? ['Tax Refund', 'Bonus', 'Gift', 'Birthday', 'Side Hustle']
                          : selectedManualCat?.subcategories || []
                        ).map((subcat) => {
                          const isSelected = selectedTags.includes(subcat);
                          return (
                            <button
                              key={subcat}
                              type="button"
                              onClick={() => handleToggleTag(subcat)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                isSelected
                                  ? 'bg-dark-green-800 text-white border-dark-green-900 shadow-xs'
                                  : 'bg-white text-brown-800 border-beige-300 hover:border-dark-green-700'
                              }`}
                            >
                              {subcat}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Custom Tag Input & Active Tags Display */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="+ Add custom tag..."
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomTag();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-white border border-beige-300 rounded-xl text-xs font-medium text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomTag()}
                        disabled={!customTagInput.trim()}
                        className="px-3 py-1.5 bg-beige-200 hover:bg-beige-300 text-dark-green-950 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40"
                      >
                        Add Tag
                      </button>
                    </div>

                    {/* Active Selected Tags Display */}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sage-100 border border-sage-200 text-dark-green-900 text-[11px] font-bold"
                          >
                            #{tag}
                            <button
                              type="button"
                              onClick={() => handleToggleTag(tag)}
                              className="text-brown-700 hover:text-alert-red-700 cursor-pointer ml-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Payer Optional Row */}
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-sage-700" />
                    Paid By
                  </label>
                  <select
                    id="manual-select-paid-by"
                    value={manualLoggedBy}
                    onChange={(e) => setManualLoggedBy(e.target.value)}
                    className="w-full px-4 py-2.5 bg-beige-50 border border-beige-300 rounded-2xl text-xs sm:text-sm font-semibold text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white transition"
                  >
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} {m.userId === user?.userId ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Checked-In Week Notice for One-Time Deposits */}
                {isOneTimeDeposit && getCompletedCheckInForDate(manualDate) && (
                  <div className="p-3 bg-sage-50 border border-sage-200 rounded-2xl flex items-start gap-2.5 animate-in fade-in">
                    <PiggyBank className="w-4 h-4 text-dark-green-800 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-dark-green-900 block">
                        Checked-In Week Detected
                      </span>
                      <p className="text-[11px] text-brown-700 leading-tight">
                        This deposit is dated for a completed check-in week. Submitting will open the Check-In Effect preview to review updated banked savings and expanded goals.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Save & Add Another + Review & Confirm */}
              <div className="pt-3 border-t border-beige-200 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  id="btn-save-add-another"
                  onClick={handleSaveAndAddAnother}
                  className="w-full sm:w-auto flex-1 py-3 px-4 rounded-2xl bg-beige-100 hover:bg-beige-200 border border-beige-300 text-dark-green-900 text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-sage-700" />
                  <span>Save & Add Another</span>
                </button>

                <button
                  type="button"
                  id="btn-manual-proceed-staging"
                  onClick={handleManualProceedToStaging}
                  className="w-full sm:w-auto flex-1 py-3 px-4 rounded-2xl bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isOneTimeDeposit
                      ? getCompletedCheckInForDate(manualDate)
                        ? 'Review Check-In Effect & Log Deposit'
                        : 'Log One-Time Deposit'
                      : `Proceed to Review & Confirm ${
                          manualBatch.length > 0 ? `(${manualBatch.length + (parseFloat(manualAmount) > 0 ? 1 : 0)})` : ''
                        }`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PATH B: QUICK NOTE (AI NLP)                                    */}
          {/* ============================================================== */}
          {activeTab === 'quicknote' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-sage-50/70 border border-sage-200 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-dark-green-900">
                  <Sparkles className="w-4 h-4 text-sage-600" />
                  <span>Gemini Natural Language Entity Extractor</span>
                </div>
                <p className="text-[11px] text-brown-700 leading-relaxed">
                  Type compound sentences or paste email receipt text / order breakdowns. Gemini parses each item into distinct line items and predicts your household categories.
                </p>
              </div>

              {/* Multi-line Text Box */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 block">
                  Quick Note / Pasted Order Text:
                </label>
                <textarea
                  id="quicknote-textarea"
                  rows={4}
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  placeholder="e.g. I paid $50 in gas, $150 at the bar last night, and had to pay my $75 cell phone bill yesterday. I also paid $25 for a case of beer."
                  className="w-full p-4 bg-beige-50 border border-beige-300 rounded-2xl text-xs sm:text-sm font-medium text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white transition resize-none"
                />
              </div>

              {/* Sample Prompts */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                  Try Sample Quick Notes (1-Click Fill):
                </span>
                <div className="space-y-1.5">
                  {sampleQuickNotes.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQuickNoteText(sample)}
                      className="w-full text-left p-2 rounded-xl bg-beige-50 hover:bg-sage-50 border border-beige-200 text-[11px] text-dark-green-900 transition cursor-pointer line-clamp-1"
                    >
                      &ldquo;{sample}&rdquo;
                    </button>
                  ))}
                </div>
              </div>

              {noteError && (
                <div className="p-3 bg-alert-red-50 border border-alert-red-200 rounded-xl text-xs text-alert-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-alert-red-600 flex-shrink-0 mt-0.5" />
                  <span>{noteError}</span>
                </div>
              )}

              {/* Parse & Stage Action */}
              <div className="pt-2">
                <button
                  type="button"
                  id="btn-parse-quicknote"
                  onClick={handleParseQuickNote}
                  disabled={isParsingNote || !quickNoteText.trim()}
                  className={`w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer ${
                    isParsingNote || !quickNoteText.trim()
                      ? 'bg-beige-300 text-dark-grey-600 cursor-not-allowed'
                      : 'bg-dark-green-800 hover:bg-dark-green-900 text-white'
                  }`}
                >
                  {isParsingNote ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-sage-300" />
                      <span>Parsing Natural Language with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-sage-300" />
                      <span>Extract & Send to Review Staging</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PATH C: PHOTO RECEIPT SCANNER                                  */}
          {/* ============================================================== */}
          {activeTab === 'scan' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-sage-50/70 border border-sage-200 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-dark-green-900">
                  <Camera className="w-4 h-4 text-brown-700" />
                  <span>Gemini Multimodal Receipt OCR</span>
                </div>
                <p className="text-[11px] text-brown-700 leading-relaxed">
                  Upload a photo of any receipt or invoice. Gemini analyzes the image, extracts line items, and categorizes them automatically.
                </p>
              </div>

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-beige-300 hover:border-dark-green-700 rounded-3xl p-5 sm:p-6 text-center bg-beige-50/50 hover:bg-sage-50/30 transition cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                {imagePreviewUrl ? (
                  <div className="space-y-2">
                    <img
                      src={imagePreviewUrl}
                      alt="Receipt Preview"
                      className="max-h-48 rounded-xl object-contain mx-auto shadow-md border border-beige-200"
                    />
                    <p className="text-xs font-bold text-dark-green-900">
                      Receipt selected &bull; Click to change photo
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-beige-100 border border-beige-200 flex items-center justify-center text-brown-700">
                      <Upload className="w-6 h-6 text-dark-green-800" />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-dark-green-900 block">
                        Click to upload receipt or drag & drop
                      </span>
                      <span className="text-[10px] text-brown-700">
                        Supports JPG, PNG, WEBP, or live camera capture
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Preset Sample Receipts */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                  Or Test with Sample Receipts (1-Click Preset):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {sampleReceiptPresets.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="p-2.5 text-left rounded-xl bg-beige-50 hover:bg-sage-50 border border-beige-200 text-xs transition cursor-pointer space-y-0.5"
                    >
                      <span className="font-bold text-dark-green-900 block truncate">
                        {preset.title}
                      </span>
                      <span className="text-[10px] text-brown-700 block truncate">
                        {preset.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {scanError && (
                <div className="p-3 bg-alert-red-50 border border-alert-red-200 rounded-xl text-xs text-alert-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-alert-red-600 flex-shrink-0 mt-0.5" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* Scan & Stage Action */}
              <div className="pt-2">
                <button
                  type="button"
                  id="btn-scan-receipt-action"
                  onClick={handleScanReceipt}
                  disabled={isScanningReceipt || (!selectedFile && !imagePreviewUrl)}
                  className={`w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer ${
                    isScanningReceipt || (!selectedFile && !imagePreviewUrl)
                      ? 'bg-beige-300 text-dark-grey-600 cursor-not-allowed'
                      : 'bg-dark-green-800 hover:bg-dark-green-900 text-white'
                  }`}
                >
                  {isScanningReceipt ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-sage-300" />
                      <span>Scanning Receipt with Gemini Multimodal...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-sage-300" />
                      <span>Scan & Send to Review Staging</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
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

      {/* Multi-Tag Split Prompt Modal */}
      {multiTagPromptState?.isOpen && (
        <MultiTagSplitModal
          isOpen={multiTagPromptState.isOpen}
          onClose={() => setMultiTagPromptState(null)}
          totalAmount={multiTagPromptState.totalAmount}
          description={multiTagPromptState.description}
          categoryName={multiTagPromptState.categoryName}
          tags={multiTagPromptState.tags}
          onConfirmSplit={handleConfirmSplitFromPrompt}
          onKeepSingle={handleKeepSingleFromPrompt}
        />
      )}
    </div>
  );
};
