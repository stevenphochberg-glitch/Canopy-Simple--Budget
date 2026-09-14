import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { Category, CategoryGroup, StagedExpense, BillFrequency } from '../../types';
import {
  formatCurrency,
  getWeekRange,
  getWeekId,
  getCategoryEffectiveWeeklyBudget,
} from '../../lib/calculations';
import { parseQuickNoteWithGemini, scanReceiptWithGemini } from '../../lib/geminiApi';
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
} from 'lucide-react';

const LAST_TAB_STORAGE_KEY = 'canopy_last_log_tab';
type LogTab = 'manual' | 'quicknote' | 'scan';

interface LogExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: Category | null;
}

export const LogExpenseModal: React.FC<LogExpenseModalProps> = ({
  isOpen,
  onClose,
  initialCategory,
}) => {
  const {
    categories,
    members,
    user,
    household,
    addStagedItem,
    showToast,
    openStagingModal,
  } = useHousehold();

  // Remember & default to user's last selected tab
  const [activeTab, setActiveTab] = useState<LogTab>(() => {
    const saved = localStorage.getItem(LAST_TAB_STORAGE_KEY) as LogTab;
    return saved === 'manual' || saved === 'quicknote' || saved === 'scan' ? saved : 'manual';
  });

  const handleTabChange = (tab: LogTab) => {
    setActiveTab(tab);
    localStorage.setItem(LAST_TAB_STORAGE_KEY, tab);
  };

  // -------------------------------------------------------------
  // PATH A: Manual Entry State
  // -------------------------------------------------------------
  const [manualAmount, setManualAmount] = useState<string>('');
  const [manualDescription, setManualDescription] = useState<string>('');
  const [manualCategoryId, setManualCategoryId] = useState<string>(
    initialCategory?.id || categories[0]?.id || ''
  );
  const [manualDate, setManualDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [manualLoggedBy, setManualLoggedBy] = useState<string>(
    user?.userId || 'usr_self'
  );
  const [manualBillFrequency, setManualBillFrequency] = useState<BillFrequency>('monthly');

  // Manual Batch Queue (for "Save & Add Another")
  const [manualBatch, setManualBatch] = useState<StagedExpense[]>([]);

  const selectedManualCat = categories.find((c) => c.id === manualCategoryId);
  const isBillsCategory =
    selectedManualCat?.group === 'Bills' ||
    selectedManualCat?.name.toLowerCase().includes('bill');

  const activeWeekId = useMemo(() => {
    const today = new Date();
    const firstDay = household?.firstDayOfWeek || 'Monday';
    const currentWeekRange = getWeekRange(today, firstDay, 0);
    return getWeekId(currentWeekRange, firstDay);
  }, [household?.firstDayOfWeek]);

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
    if (name.includes('saving') || group.includes('saving')) {
      return 'Emergency Fund, Long-term Savings, Vacation Fund';
    }
    if (name.includes('buffer')) {
      return 'Client Invoices, Commission Deposits, Operating Buffer';
    }
    return 'General household spending';
  };

  useEffect(() => {
    if (initialCategory?.id) {
      setManualCategoryId(initialCategory.id);
    } else if (categories.length > 0) {
      // If current category is empty or not in categories, default to the first category's document ID
      if (!manualCategoryId || !categories.some((c) => c.id === manualCategoryId)) {
        setManualCategoryId(categories[0].id);
      }
    }
  }, [initialCategory, categories, manualCategoryId]);

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

    const resolvedCategoryId =
      manualCategoryId && categories.some((c) => c.id === manualCategoryId)
        ? manualCategoryId
        : categories[0]?.id || '';

    const newItem: StagedExpense = {
      amount: numAmount,
      description: manualDescription.trim() || 'Manual Expense',
      categoryId: resolvedCategoryId,
      date: manualDate || new Date().toISOString().split('T')[0],
      loggedByUserId: manualLoggedBy || user?.userId || 'usr_self',
      billFrequency: isBillsCategory ? manualBillFrequency : undefined,
    };

    setManualBatch((prev) => [...prev, newItem]);
    // Reset amount & description for next item, keep category/date for quick entry
    setManualAmount('');
    setManualDescription('');
    showToast(`Added "$${numAmount.toFixed(2)}" to current batch (${manualBatch.length + 1} items).`);
  };

  const handleManualProceedToStaging = () => {
    const currentNum = parseFloat(manualAmount);
    const itemsToStage: StagedExpense[] = [...manualBatch];

    const resolvedCategoryId =
      manualCategoryId && categories.some((c) => c.id === manualCategoryId)
        ? manualCategoryId
        : categories[0]?.id || '';

    // If the user filled the current fields, add it too
    if (currentNum && currentNum > 0) {
      itemsToStage.push({
        amount: currentNum,
        description: manualDescription.trim() || 'Manual Expense',
        categoryId: resolvedCategoryId,
        date: manualDate || new Date().toISOString().split('T')[0],
        loggedByUserId: manualLoggedBy || user?.userId || 'usr_self',
        billFrequency: isBillsCategory ? manualBillFrequency : undefined,
      });
    }

    if (itemsToStage.length === 0) {
      showToast('Please enter an amount for your expense.');
      return;
    }

    // Reset local batch and inputs
    setManualBatch([]);
    setManualAmount('');
    setManualDescription('');

    // Close Log Expense modal and open Review & Confirm staging view
    onClose();
    openStagingModal(itemsToStage);
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
      const parsedItems = await parseQuickNoteWithGemini(quickNoteText, categories);
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
        categories,
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
                Log Expense
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

            {/* Tab B: Quick Note (AI) */}
            <button
              id="tab-quick-note-ai"
              onClick={() => handleTabChange('quicknote')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'quicknote'
                  ? 'bg-white text-dark-green-900 shadow-xs'
                  : 'text-dark-grey-700 hover:text-dark-green-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-sage-600" />
              <span>Quick Note (AI)</span>
            </button>

            {/* Tab C: Scan Receipt */}
            <button
              id="tab-scan-receipt"
              onClick={() => handleTabChange('scan')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                activeTab === 'scan'
                  ? 'bg-white text-dark-green-900 shadow-xs'
                  : 'text-dark-grey-700 hover:text-dark-green-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-brown-700" />
              <span>Scan Receipt</span>
            </button>
          </div>
        </div>

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
                          className="text-brown-700 hover:text-red-600 ml-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3 Explicit Form Fields */}
              <div className="space-y-4">
                {/* Field 1: Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-sage-700" />
                      Amount ($)
                    </span>
                    <span className="text-[10px] text-brown-700 font-normal">
                      Required numeric keypad
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
                  <div className="flex gap-1.5 pt-1">
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

                {/* Field 2: Description */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-sage-700" />
                    Description
                  </label>
                  <input
                    id="manual-input-description"
                    type="text"
                    placeholder="e.g. Trader Joe's, Shell Gas, Lunch with team"
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-beige-50 border border-beige-300 rounded-2xl text-xs sm:text-sm font-medium text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white transition"
                  />
                </div>

                {/* Field 3: Category Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-sage-700" />
                    Category Selection
                  </label>
                  <select
                    id="manual-select-category"
                    value={manualCategoryId}
                    onChange={(e) => setManualCategoryId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-beige-50 border border-beige-300 rounded-2xl text-xs sm:text-sm font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white transition"
                  >
                    {categories.map((cat) => {
                      const effectiveWeekly = getCategoryEffectiveWeeklyBudget(cat, activeWeekId, household);
                      return (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({formatCurrency(effectiveWeekly.budget)}/wk)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Contextual Category Tags / Examples Helper Row */}
                {selectedManualCat && (
                  <div className="flex items-start gap-1.5 px-3 py-2 bg-beige-100/70 border border-beige-200/90 rounded-xl text-xs text-brown-800 animate-in fade-in duration-150">
                    <span className="font-bold text-dark-green-900 shrink-0">Examples:</span>
                    <span className="text-brown-800 font-medium leading-relaxed">
                      {getCategoryExamples(selectedManualCat)}
                    </span>
                  </div>
                )}

                {/* Bill Frequency Dropdown (when Bills category is selected) */}
                {isBillsCategory && (
                  <div className="space-y-1.5 p-3.5 bg-sage-50/80 border border-sage-200 rounded-2xl animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-sage-700" />
                        Bill Billing Frequency
                      </label>
                      <span className="text-[10px] font-bold text-sage-800 bg-sage-200/70 px-2 py-0.5 rounded-full">
                        Paid-Only Proration
                      </span>
                    </div>

                    <select
                      id="manual-select-bill-frequency"
                      value={manualBillFrequency}
                      onChange={(e) => setManualBillFrequency(e.target.value as BillFrequency)}
                      className="w-full px-3.5 py-2 bg-white border border-sage-300 rounded-xl text-xs sm:text-sm font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                    >
                      <option value="weekly">Weekly (Full expense charged to current week)</option>
                      <option value="monthly">Monthly (Prorated across current 4-4-5 month weeks)</option>
                      <option value="annually">Annually (Prorated across fiscal year / 52 weeks)</option>
                    </select>

                    <p className="text-[11px] text-brown-700 leading-snug pt-0.5">
                      <strong>Paid-Only Rule:</strong> Only the active prorated share of this paid bill will hit this week's budget. Unpaid future recurring bills will not be auto-scheduled.
                    </p>
                  </div>
                )}

                {/* Payer & Date Optional Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                      Paid By
                    </label>
                    <select
                      value={manualLoggedBy}
                      onChange={(e) => setManualLoggedBy(e.target.value)}
                      className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900"
                    >
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name} {m.userId === user?.userId ? '(You)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                      Date
                    </label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900"
                    />
                  </div>
                </div>
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
                    Proceed to Review & Confirm{' '}
                    {manualBatch.length > 0 ? `(${manualBatch.length + (parseFloat(manualAmount) > 0 ? 1 : 0)})` : ''}
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
              <div className="p-3.5 bg-gradient-to-r from-sage-50 to-beige-50 border border-sage-200 rounded-2xl space-y-1">
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
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
              <div className="p-3.5 bg-gradient-to-r from-sage-50 to-beige-50 border border-sage-200 rounded-2xl space-y-1">
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
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
    </div>
  );
};
