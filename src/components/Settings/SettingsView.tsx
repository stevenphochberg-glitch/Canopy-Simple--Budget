import React, { useState, useEffect } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import {
  AccountType,
  DayOfWeek,
  CalendarMode,
  PaySchedule,
  IncomeType,
  Category,
  HouseholdMember,
  OneOffDeposit,
  VariableIncomeState,
  ActiveProjectIncome,
  HourlyIncomeConfig,
  ManualIncomeEntry,
  VariableIncomeSubOption,
} from '../../types';
import {
  DAYS_OF_WEEK,
  formatCurrency,
  normalizeToWeekly,
  calculateWeeklyPool,
} from '../../lib/calculations';
import {
  Shield,
  Copy,
  Check,
  Calendar,
  Clock,
  Users,
  RotateCcw,
  Smartphone,
  Info,
  DollarSign,
  UserMinus,
  Trash2,
  AlertTriangle,
  LogOut,
  Home,
  Loader2,
  Plus,
  Layers,
  Sparkles,
  PieChart,
  Save,
  CheckCircle2,
  Briefcase,
  Receipt,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';
import { CategoryIcon } from '../Common/CategoryIcon';

type SettingsTab = 'type' | 'income' | 'calendar' | 'allocation' | 'operations';

export const SettingsView: React.FC = () => {
  const {
    household,
    user,
    members,
    categories,
    updateHousehold,
    updateMemberIncome,
    addOneOffDeposit,
    createCategory,
    updateCategory,
    deleteCategory,
    saveCategoryAllocations,
    triggerFreshStartAction,
    executeMonthEndResetAction,
    leaveHousehold,
    deleteAccount,
    signOut,
    removeHouseholdMember,
    showToast,
  } = useHousehold();

  // Active section tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('type');
  const [copied, setCopied] = useState(false);

  // Household Member Removal State
  const [memberToRemove, setMemberToRemove] = useState<HouseholdMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [removeMemberError, setRemoveMemberError] = useState<string | null>(null);

  // Household Type State
  const [householdName, setHouseholdName] = useState(household?.name || '');
  const [selectedType, setSelectedType] = useState<AccountType>(household?.type || 'single');
  const [roommateCount, setRoommateCount] = useState<number>(3);
  const [isSavingType, setIsSavingType] = useState(false);

  // Income Normalization State
  const [incomeType, setIncomeType] = useState<IncomeType>(household?.incomeType || 'predictable');
  const [burnRate, setBurnRate] = useState<number>(household?.baselineWeeklyBurnRate || 800);
  const [bufferAmount, setBufferAmount] = useState<number>(household?.initialBufferAmount || 2000);
  const [memberIncomes, setMemberIncomes] = useState<
    Record<string, { rawIncome: number; schedule: PaySchedule; lastPayDate: string; isSaving: boolean; error?: string }>
  >({});

  // Scheduled Income: One-Off Deposit State in Settings
  const [showAddOneOffModal, setShowAddOneOffModal] = useState<boolean>(false);
  const [oneOffDesc, setOneOffDesc] = useState<string>('');
  const [oneOffAmount, setOneOffAmount] = useState<number | ''>('');
  const [oneOffDate, setOneOffDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [oneOffMemberId, setOneOffMemberId] = useState<string>(() => members[0]?.userId || '');
  const [oneOffNotes, setOneOffNotes] = useState<string>('');
  const [isAddingOneOff, setIsAddingOneOff] = useState<boolean>(false);

  // Variable Income State in Settings
  const [variableIncomeState, setVariableIncomeState] = useState<VariableIncomeState>(() => household?.variableIncomeState || {
    activeSubOption: 'context',
    scenarioContext: '',
    projects: [],
    hourlyConfigs: [],
    manualEntries: [],
  });

  // Active Project Form State in Settings
  const [showAddProject, setShowAddProject] = useState<boolean>(false);
  const [projName, setProjName] = useState<string>('');
  const [projStartDate, setProjStartDate] = useState<string>('');
  const [projEndDate, setProjEndDate] = useState<string>('');
  const [projTotalAmount, setProjTotalAmount] = useState<number | ''>('');
  const [projMemberId, setProjMemberId] = useState<string>(() => members[0]?.userId || '');

  // Hourly Form State in Settings
  const [hourlyMemberId, setHourlyMemberId] = useState<string>(() => members[0]?.userId || '');
  const [hourlyRate, setHourlyRate] = useState<number | ''>(45);
  const [hourlyHoursPerWeek, setHourlyHoursPerWeek] = useState<number | ''>(35);
  const [hourlySchedule, setHourlySchedule] = useState<PaySchedule>('bi-weekly');

  // Manual Form State in Settings (Mirrors manual expense logging)
  const [manualAmount, setManualAmount] = useState<number | ''>('');
  const [manualDesc, setManualDesc] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [manualMemberId, setManualMemberId] = useState<string>(() => members[0]?.userId || '');
  const [manualNotes, setManualNotes] = useState<string>('');

  // Calendar Fiscal Year-End Month State
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState<number>(household?.fiscalYearEndMonth || 12);
  const [isSavingFiscalMonth, setIsSavingFiscalMonth] = useState<boolean>(false);

  // Budget Allocation State
  const [editedAllocations, setEditedAllocations] = useState<Record<string, number>>({});
  const [isSavingAllocations, setIsSavingAllocations] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatBudget, setNewCatBudget] = useState(100);
  const [newCatGroup, setNewCatGroup] = useState('Essentials');
  const [newCatType, setNewCatType] = useState<'expense' | 'savings'>('expense');
  const [showAddCatModal, setShowAddCatModal] = useState(false);

  // Explicit approval prompt state for permanent baseline budget alterations
  const [showBaselineApprovalModal, setShowBaselineApprovalModal] = useState(false);
  const [pendingBaselineChanges, setPendingBaselineChanges] = useState<
    { id: string; name: string; oldBase: number; newBase: number }[]
  >([]);
  const [pendingSaveMode, setPendingSaveMode] = useState<'single' | 'all'>('all');
  const [pendingSingleCatId, setPendingSingleCatId] = useState<string | null>(null);

  // Maintenance & Account states
  const [showFreshStartConfirm, setShowFreshStartConfirm] = useState(false);
  const [showMonthEndConfirm, setShowMonthEndConfirm] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStep, setLeaveStep] = useState<'confirm' | 'choice'>('confirm');
  const [isLeaving, setIsLeaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync state on load or household change
  useEffect(() => {
    if (household) {
      setHouseholdName(household.name);
      setSelectedType(household.type);
      setIncomeType(household.incomeType || 'predictable');
      setBurnRate(household.baselineWeeklyBurnRate || 800);
      setBufferAmount(household.initialBufferAmount || 2000);
      if (household.fiscalYearEndMonth) {
        setFiscalYearEndMonth(household.fiscalYearEndMonth);
      }
      if (household.variableIncomeState) {
        setVariableIncomeState(household.variableIncomeState);
      }
    }
  }, [household]);

  // Sync member incomes
  useEffect(() => {
    const map: Record<string, { rawIncome: number; schedule: PaySchedule; lastPayDate: string; isSaving: boolean; error?: string }> = {};
    members.forEach((m) => {
      map[m.userId] = {
        rawIncome: m.rawIncome || 0,
        schedule: m.incomeSchedule || 'bi-weekly',
        lastPayDate: m.lastPayDate || '',
        isSaving: false,
      };
    });
    setMemberIncomes(map);
  }, [members]);

  // Sync category allocations
  useEffect(() => {
    const map: Record<string, number> = {};
    categories.forEach((c) => {
      map[c.id] = c.baselineBudget;
    });
    setEditedAllocations(map);
  }, [categories]);

  const handleCopySync = () => {
    if (household?.syncCode) {
      navigator.clipboard.writeText(household.syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSaveHouseholdType = async () => {
    setIsSavingType(true);
    try {
      await updateHousehold({
        name: householdName.trim() || household?.name || 'My Household',
        type: selectedType,
      });
    } finally {
      setIsSavingType(false);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemovingMember(true);
    setRemoveMemberError(null);
    try {
      await removeHouseholdMember(memberToRemove.userId);
      setMemberToRemove(null);
    } catch (err: any) {
      console.error('Error removing household member:', err);
      setRemoveMemberError(err?.message || 'Failed to remove member. Please try again.');
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleSaveIncomeStructure = async () => {
    await updateHousehold({
      incomeType,
      baselineWeeklyBurnRate: burnRate,
      initialBufferAmount: bufferAmount,
      variableIncomeState,
    });
  };

  const handleUpdateSingleMemberIncome = async (memberId: string) => {
    const current = memberIncomes[memberId];
    if (!current) return;

    if (!current.lastPayDate || !current.lastPayDate.trim()) {
      setMemberIncomes((prev) => ({
        ...prev,
        [memberId]: { ...prev[memberId], error: 'Date of Last Paycheck is required' },
      }));
      return;
    }

    setMemberIncomes((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], isSaving: true, error: undefined },
    }));

    try {
      await updateMemberIncome(memberId, current.rawIncome, current.schedule, true, current.lastPayDate);
    } finally {
      setMemberIncomes((prev) => ({
        ...prev,
        [memberId]: { ...prev[memberId], isSaving: false },
      }));
    }
  };

  // Scheduled Income: Add One-Off Deposit directly routing into the top-level Income Buffer
  const handleAddOneOffDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = typeof oneOffAmount === 'number' ? oneOffAmount : parseFloat(String(oneOffAmount)) || 0;
    if (amountNum <= 0) return;

    setIsAddingOneOff(true);
    try {
      await addOneOffDeposit({
        description: oneOffDesc.trim() || 'One-Off Deposit',
        amount: amountNum,
        date: oneOffDate || new Date().toISOString().split('T')[0],
        payerMemberId: oneOffMemberId || undefined,
        notes: oneOffNotes.trim() || undefined,
      });

      setOneOffDesc('');
      setOneOffAmount('');
      setOneOffNotes('');
      setShowAddOneOffModal(false);
    } finally {
      setIsAddingOneOff(false);
    }
  };

  // Variable Income: Add Active Project
  const handleAddActiveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = typeof projTotalAmount === 'number' ? projTotalAmount : parseFloat(String(projTotalAmount)) || 0;
    if (!projStartDate || !projEndDate || amountNum <= 0) return;

    const newProj: ActiveProjectIncome = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      projectName: projName.trim() || 'Active Client Project',
      startDate: projStartDate,
      endDate: projEndDate,
      totalScheduledIncome: amountNum,
      payerMemberId: projMemberId || undefined,
      memberId: projMemberId || undefined,
    };

    const nextState: VariableIncomeState = {
      ...variableIncomeState,
      projects: [...(variableIncomeState.projects || []), newProj],
    };
    setVariableIncomeState(nextState);
    await updateHousehold({ variableIncomeState: nextState });

    setProjName('');
    setProjStartDate('');
    setProjEndDate('');
    setProjTotalAmount('');
    setShowAddProject(false);
  };

  const handleRemoveActiveProject = async (projId: string) => {
    const nextState: VariableIncomeState = {
      ...variableIncomeState,
      projects: (variableIncomeState.projects || []).filter((p) => p.id !== projId),
    };
    setVariableIncomeState(nextState);
    await updateHousehold({ variableIncomeState: nextState });
  };

  // Variable Income: Save Hourly Config
  const handleSaveHourlyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = typeof hourlyRate === 'number' ? hourlyRate : parseFloat(String(hourlyRate)) || 0;
    const hoursNum = typeof hourlyHoursPerWeek === 'number' ? hourlyHoursPerWeek : parseFloat(String(hourlyHoursPerWeek)) || 0;
    if (rateNum <= 0 || hoursNum <= 0) return;

    const newConfig: HourlyIncomeConfig = {
      id: `hourly_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      memberId: hourlyMemberId,
      payerMemberId: hourlyMemberId,
      title: 'Hourly Wages',
      payFrequency: hourlySchedule,
      paySchedule: hourlySchedule,
      hourlyRate: rateNum,
      estimatedHoursPerWeek: hoursNum,
    };

    const nextState: VariableIncomeState = {
      ...variableIncomeState,
      hourlyConfigs: [
        ...(variableIncomeState.hourlyConfigs || []).filter((c) => (c.memberId || c.payerMemberId) !== hourlyMemberId),
        newConfig,
      ],
    };
    setVariableIncomeState(nextState);
    await updateHousehold({ variableIncomeState: nextState });
  };

  // Variable Income: Add Manual Income Entry (routes to top-level Income Buffer)
  const handleAddManualIncomeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = typeof manualAmount === 'number' ? manualAmount : parseFloat(String(manualAmount)) || 0;
    if (amountNum <= 0) return;

    const newManual: ManualIncomeEntry = {
      id: `man_inc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      description: manualDesc.trim() || 'Manual Income Deposit',
      amount: amountNum,
      date: manualDate || new Date().toISOString().split('T')[0],
      payerMemberId: manualMemberId || undefined,
      destination: 'Income Buffer',
      notes: manualNotes.trim() || undefined,
    };

    const nextState: VariableIncomeState = {
      ...variableIncomeState,
      manualEntries: [...(variableIncomeState.manualEntries || []), newManual],
    };
    setVariableIncomeState(nextState);

    // Route money directly into Income Buffer via addOneOffDeposit
    await addOneOffDeposit({
      description: newManual.description,
      amount: newManual.amount,
      date: newManual.date,
      payerMemberId: newManual.payerMemberId,
      notes: newManual.notes,
    });

    await updateHousehold({ variableIncomeState: nextState });
    setManualAmount('');
    setManualDesc('');
    setManualNotes('');
  };

  const handleRemoveManualIncomeEntry = async (id: string) => {
    const nextState: VariableIncomeState = {
      ...variableIncomeState,
      manualEntries: (variableIncomeState.manualEntries || []).filter((m) => m.id !== id),
    };
    setVariableIncomeState(nextState);
    await updateHousehold({ variableIncomeState: nextState });
  };

  // Calendar: Fiscal Year-End Month Change
  const handleFiscalYearEndMonthChange = async (monthNum: number) => {
    setFiscalYearEndMonth(monthNum);
    setIsSavingFiscalMonth(true);
    try {
      await updateHousehold({ fiscalYearEndMonth: monthNum });
    } finally {
      setIsSavingFiscalMonth(false);
    }
  };

  const handleDayChange = (day: DayOfWeek) => {
    updateHousehold({ firstDayOfWeek: day });
  };

  const handleCalendarModeToggle = (mode: CalendarMode) => {
    updateHousehold({ calendarMode: mode });
  };

  const handleSaveCategoryBudget = (catId: string) => {
    const val = editedAllocations[catId];
    if (val === undefined || isNaN(val)) return;
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    if (cat.baselineBudget === val) {
      showToast('Baseline budget already matches this amount.');
      return;
    }

    setPendingBaselineChanges([
      {
        id: cat.id,
        name: cat.name,
        oldBase: cat.baselineBudget,
        newBase: val,
      },
    ]);
    setPendingSaveMode('single');
    setPendingSingleCatId(catId);
    setShowBaselineApprovalModal(true);
  };

  const handleSaveAllAllocations = () => {
    const changes: { id: string; name: string; oldBase: number; newBase: number }[] = [];
    categories.forEach((c) => {
      const newVal = editedAllocations[c.id];
      if (newVal !== undefined && !isNaN(newVal) && newVal !== c.baselineBudget) {
        changes.push({
          id: c.id,
          name: c.name,
          oldBase: c.baselineBudget,
          newBase: newVal,
        });
      }
    });

    if (changes.length === 0) {
      showToast('No baseline budget allocation changes detected.');
      return;
    }

    setPendingBaselineChanges(changes);
    setPendingSaveMode('all');
    setShowBaselineApprovalModal(true);
  };

  const handleConfirmBaselineBudgetSave = async () => {
    setIsSavingAllocations(true);
    try {
      if (pendingSaveMode === 'single' && pendingSingleCatId) {
        const val = editedAllocations[pendingSingleCatId];
        await updateCategory(pendingSingleCatId, {
          currentWeeklyBudget: val,
          baselineBudget: val,
        });
      } else {
        const updated = categories.map((c) => ({
          ...c,
          currentWeeklyBudget: editedAllocations[c.id] ?? c.currentWeeklyBudget,
          baselineBudget: editedAllocations[c.id] ?? c.baselineBudget,
        }));
        await saveCategoryAllocations(updated);
      }
      setShowBaselineApprovalModal(false);
      setPendingBaselineChanges([]);
    } finally {
      setIsSavingAllocations(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await createCategory({
      name: newCatName.trim(),
      group: newCatGroup,
      type: newCatType,
      icon: 'tag',
      color: 'sage',
      currentWeeklyBudget: Number(newCatBudget) || 0,
      baselineBudget: Number(newCatBudget) || 0,
      rolloverPreference: 'rollover_positive',
    });
    setNewCatName('');
    setNewCatType('expense');
    setShowAddCatModal(false);
  };

  const handleLeaveOptionChoice = async (choice: 'new_household' | 'sign_out') => {
    setIsLeaving(true);
    try {
      await leaveHousehold();
      if (choice === 'sign_out') {
        await signOut();
      }
    } finally {
      setIsLeaving(false);
      setShowLeaveModal(false);
      setLeaveStep('confirm');
    }
  };

  const handleConfirmDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const totalAllocated: number = (Object.values(editedAllocations) as number[]).reduce(
    (sum: number, v: number): number => sum + (v || 0),
    0
  );
  const weeklyPool = calculateWeeklyPool(members);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Header */}
      <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-dark-green-900 tracking-tight">
          Household Settings
        </h1>
        <p className="text-xs sm:text-sm text-brown-700">
          Manage and customize your household configuration across all setup domains.
        </p>

        {/* Navigation Tabs Matching the Setup Wizard */}
        <div className="pt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-beige-200">
          <button
            type="button"
            onClick={() => setActiveTab('type')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'type'
                ? 'bg-dark-green-800 text-white shadow-xs'
                : 'bg-beige-100 hover:bg-beige-200 text-dark-green-900'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Household Type</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('income')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'income'
                ? 'bg-dark-green-800 text-white shadow-xs'
                : 'bg-beige-100 hover:bg-beige-200 text-dark-green-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Income Normalization</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'calendar'
                ? 'bg-dark-green-800 text-white shadow-xs'
                : 'bg-beige-100 hover:bg-beige-200 text-dark-green-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar & Check-in</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('allocation')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'allocation'
                ? 'bg-dark-green-800 text-white shadow-xs'
                : 'bg-beige-100 hover:bg-beige-200 text-dark-green-900'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Budget Allocation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('operations')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'operations'
                ? 'bg-dark-green-800 text-white shadow-xs'
                : 'bg-beige-100 hover:bg-beige-200 text-dark-green-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Operations & Account</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: HOUSEHOLD TYPE */}
      {activeTab === 'type' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Household Name & Structure */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-beige-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-dark-green-900">
                  Household Identity & Organization
                </h3>
                <p className="text-xs text-brown-700">
                  Update your household name and primary structure type.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveHouseholdType}
                disabled={isSavingType}
                className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSavingType ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Household Type</span>
              </button>
            </div>

            {/* Household Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-dark-green-900 block">
                Household Name
              </label>
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="e.g. Oak House, The Smith Home"
                className="w-full px-4 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-sm font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800 focus:bg-white"
              />
            </div>

            {/* Structure Type Selector */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold uppercase tracking-wider text-dark-green-900 block">
                Household Structure
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { type: 'single' as AccountType, label: 'Single Person', desc: 'Personal solo budget' },
                  { type: 'couple' as AccountType, label: 'Couple', desc: 'Two partners sharing pool' },
                  { type: 'family' as AccountType, label: 'Family', desc: 'Multiple earners & kids' },
                  { type: 'roommate' as AccountType, label: 'Roommates', desc: 'Shared split expenses' },
                ].map((item) => (
                  <div
                    key={item.type}
                    onClick={() => setSelectedType(item.type)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer text-left ${
                      selectedType === item.type
                        ? 'bg-sage-100/70 border-dark-green-800 ring-1 ring-dark-green-800 shadow-xs'
                        : 'bg-beige-50/60 border-beige-300 hover:border-sage-300'
                    }`}
                  >
                    <span className="text-sm font-bold text-dark-green-900 block">{item.label}</span>
                    <span className="text-[11px] text-dark-grey-600">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Household Sync Code Card */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
              <Shield className="w-5 h-5 text-sage-600" />
              <span>Household Sync Code</span>
            </div>
            <p className="text-xs text-brown-700 leading-relaxed">
              Share this 6-character code with your partner or roommates to connect their accounts and claim placeholder profiles.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-sage-50 border border-sage-200 rounded-2xl">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 block">
                  Active Sync Code
                </span>
                <span className="text-2xl font-mono font-extrabold text-dark-green-900">
                  {household?.syncCode || 'CNP-000'}
                </span>
              </div>

              <button
                onClick={handleCopySync}
                id="settings-copy-sync-code"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-sage-300" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Sync Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Current Members Roster */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-dark-green-900">
                  Household Members ({members.length})
                </h3>
                <p className="text-xs text-brown-700">
                  Active accounts and unclaimed placeholder profiles in this household.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="p-3.5 bg-beige-50 border border-beige-200 rounded-2xl flex items-center justify-between gap-2 hover:border-beige-300 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-sage-200 text-dark-green-900 font-bold text-sm flex items-center justify-center border border-sage-300 flex-shrink-0">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        member.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-dark-green-900 truncate">{member.name}</span>
                        {member.userId === user?.userId && (
                          <span className="text-[10px] bg-dark-green-800 text-white font-bold px-1.5 py-0.5 rounded-md">
                            You
                          </span>
                        )}
                        {member.isPlaceholder && (
                          <span className="text-[10px] bg-gold-100 text-gold-900 font-semibold px-1.5 py-0.5 rounded-md">
                            Placeholder
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-dark-grey-600 block truncate">
                        {formatCurrency(member.normalizedWeeklyIncome)}/wk ({member.incomeSchedule})
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMemberToRemove(member)}
                    id={`remove-member-btn-${member.userId}`}
                    className="p-2 text-brown-700 hover:text-alert-red-700 hover:bg-alert-red-50 rounded-xl transition border border-transparent hover:border-alert-red-200 cursor-pointer flex-shrink-0"
                    title={`Remove ${member.name} from household`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: INCOME NORMALIZATION */}
      {activeTab === 'income' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Structure Selector */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-beige-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-dark-green-900">
                  Income Cadence & Volatility
                </h3>
                <p className="text-xs text-brown-700">
                  Choose how Canopy normalizes incoming funds, cushions volatility, and manages buffers.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveIncomeStructure}
                className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Income Model</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIncomeType('scheduled')}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  incomeType === 'scheduled' || incomeType === 'predictable'
                    ? 'bg-sage-100/70 border-dark-green-800 ring-1 ring-dark-green-800 shadow-xs'
                    : 'bg-beige-50/50 border-beige-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-dark-green-900 block">
                    Scheduled Income
                  </span>
                  {(incomeType === 'scheduled' || incomeType === 'predictable') && (
                    <CheckCircle2 className="w-4 h-4 text-dark-green-800" />
                  )}
                </div>
                <span className="text-xs text-dark-grey-600 leading-relaxed block mt-1">
                  Predictable regular paychecks (weekly, bi-weekly, semi-monthly, or monthly) with fixed scheduled pay dates and one-off deposits.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIncomeType('variable')}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  incomeType === 'variable'
                    ? 'bg-sage-100/70 border-dark-green-800 ring-1 ring-dark-green-800 shadow-xs'
                    : 'bg-beige-50/50 border-beige-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-dark-green-900 block">
                    Variable Income
                  </span>
                  {incomeType === 'variable' && (
                    <CheckCircle2 className="w-4 h-4 text-dark-green-800" />
                  )}
                </div>
                <span className="text-xs text-dark-grey-600 leading-relaxed block mt-1">
                  Freelance, 1099, commission, active projects, or hourly wages requiring a buffer reserve and weekly burn rate.
                </span>
              </button>
            </div>
          </div>

          {/* SCHEDULED INCOME SECTION */}
          {(incomeType === 'scheduled' || incomeType === 'predictable') && (
            <>
              {/* Member Incomes Configuration Table */}
              <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-dark-green-900">
                      Scheduled Paychecks & Normalization
                    </h3>
                    <p className="text-xs text-brown-700">
                      Specify each member's paycheck amount, pay cycle, and required last paycheck date to calculate the weekly pool.
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 block">
                      Total Weekly Pool
                    </span>
                    <span className="text-lg font-black text-dark-green-900">
                      {formatCurrency(weeklyPool)}/wk
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {members.map((m) => {
                    const memState = memberIncomes[m.userId] || {
                      rawIncome: m.rawIncome || 0,
                      schedule: m.incomeSchedule || 'bi-weekly',
                      lastPayDate: m.lastPayDate || '',
                      isSaving: false,
                    };
                    const normalized = normalizeToWeekly(memState.rawIncome, memState.schedule);

                    return (
                      <div
                        key={m.userId}
                        className="p-4 bg-beige-50 border border-beige-200 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-sage-200 text-dark-green-900 font-bold text-sm flex items-center justify-center border border-sage-300 flex-shrink-0">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-dark-green-900">{m.name}</span>
                              {m.userId === user?.userId && (
                                <span className="text-[10px] bg-dark-green-800 text-white font-bold px-1.5 py-0.5 rounded-md">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-dark-grey-600">
                              Normalized: <strong className="text-dark-green-900 font-bold">{formatCurrency(normalized)}/wk</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-start gap-3">
                          {/* Pay Amount */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                              Paycheck Amount ($)
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-xs font-bold text-dark-green-900">$</span>
                              <input
                                type="number"
                                min="0"
                                value={memState.rawIncome}
                                onChange={(e) =>
                                  setMemberIncomes((prev) => ({
                                    ...prev,
                                    [m.userId]: {
                                      ...prev[m.userId],
                                      rawIncome: parseFloat(e.target.value) || 0,
                                    },
                                  }))
                                }
                                className="w-28 pl-6 pr-2.5 py-1.5 bg-white border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Pay Schedule */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                              Cadence
                            </label>
                            <select
                              value={memState.schedule}
                              onChange={(e) =>
                                setMemberIncomes((prev) => ({
                                  ...prev,
                                  [m.userId]: {
                                    ...prev[m.userId],
                                    schedule: e.target.value as PaySchedule,
                                  },
                                }))
                              }
                              className="px-3 py-1.5 bg-white border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                            >
                              <option value="weekly">Weekly</option>
                              <option value="bi-weekly">Bi-Weekly (26x)</option>
                              <option value="semi-monthly">Semi-Monthly (24x)</option>
                              <option value="monthly">Monthly (12x)</option>
                            </select>
                          </div>

                          {/* Date of Last Paycheck (Strictly Required) */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block flex items-center gap-1">
                              <span>Date of Last Paycheck</span>
                              <span className="text-alert-red-700">*</span>
                            </label>
                            <input
                              type="date"
                              required
                              value={memState.lastPayDate}
                              onChange={(e) =>
                                setMemberIncomes((prev) => ({
                                  ...prev,
                                  [m.userId]: {
                                    ...prev[m.userId],
                                    lastPayDate: e.target.value,
                                    error: undefined,
                                  },
                                }))
                              }
                              className={`px-2.5 py-1.5 bg-white border rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none ${
                                memState.error ? 'border-alert-red-500 ring-1 ring-alert-red-500 bg-alert-red-50/50' : 'border-beige-300'
                              }`}
                            />
                            {memState.error && (
                              <p className="text-[10px] font-bold text-alert-red-700">{memState.error}</p>
                            )}
                          </div>

                          {/* Action */}
                          <div className="pt-4">
                            <button
                              type="button"
                              onClick={() => handleUpdateSingleMemberIncome(m.userId)}
                              disabled={memState.isSaving}
                              className="px-3.5 py-2 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              {memState.isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              <span>Update</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scheduled Income: One-Off Deposits (Bonuses, Gifts, Tax Refunds) */}
              <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-beige-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-dark-green-700" />
                      <h3 className="text-base font-extrabold text-dark-green-900">
                        One-Off Scheduled Deposits (Bonuses, Gifts, Windfalls)
                      </h3>
                    </div>
                    <p className="text-xs text-brown-700 mt-0.5">
                      Non-recurring deposits route directly into your top-level Income Buffer without skewing weekly paycheck averages.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddOneOffModal(true)}
                    className="px-3.5 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Log One-Off Deposit</span>
                  </button>
                </div>

                {/* List of existing one-off deposits */}
                {(household?.oneOffDeposits || []).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {household?.oneOffDeposits?.map((dep) => {
                      const payer = members.find((m) => m.userId === dep.payerMemberId);
                      return (
                        <div
                          key={dep.id}
                          className="p-3.5 bg-sage-50/70 border border-sage-200/80 rounded-2xl flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-dark-green-950 truncate">
                                {dep.description}
                              </span>
                              <span className="text-[10px] bg-sage-200/80 text-dark-green-900 font-semibold px-2 py-0.5 rounded-md flex-shrink-0">
                                Buffer
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-dark-green-800 mt-1">
                              <span>{dep.date}</span>
                              {payer && <span>• {payer.name}</span>}
                              {dep.notes && <span className="truncate">• {dep.notes}</span>}
                            </div>
                          </div>

                          <span className="text-sm font-black text-dark-green-900 flex-shrink-0">
                            +{formatCurrency(dep.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-beige-50 border border-beige-200 rounded-2xl text-xs text-brown-700 flex items-center justify-between">
                    <span>No one-off deposits recorded yet. Any bonus, refund, or lump sum added here will feed directly into your Income Buffer.</span>
                    <button
                      type="button"
                      onClick={() => setShowAddOneOffModal(true)}
                      className="text-xs font-bold text-dark-green-800 hover:underline flex-shrink-0 ml-2"
                    >
                      + Add First Deposit
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* VARIABLE INCOME SECTION (4 Sub-Options) */}
          {incomeType === 'variable' && (
            <div className="space-y-5 animate-in fade-in">
              {/* Burn Rate and Buffer settings */}
              <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
                <h3 className="text-base font-extrabold text-dark-green-900">
                  Variable Safety Buffers & Burn Rate
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gold-50/60 border border-gold-200 rounded-2xl">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gold-950 block">
                      Baseline Weekly Burn Rate ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={burnRate}
                      onChange={(e) => setBurnRate(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2 bg-white border border-gold-300 rounded-xl text-sm font-bold text-dark-green-900 focus:outline-none"
                    />
                    <span className="text-[10px] text-gold-800 block">Target maximum weekly spending cap</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-gold-950 block">
                      Initial Buffer Reserve ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={bufferAmount}
                      onChange={(e) => setBufferAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3.5 py-2 bg-white border border-gold-300 rounded-xl text-sm font-bold text-dark-green-900 focus:outline-none"
                    />
                    <span className="text-[10px] text-gold-800 block">Liquid buffer to absorb payment gaps</span>
                  </div>
                </div>
              </div>

              {/* Variable Income 4 Sub-Options Navigation */}
              <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-beige-100 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-dark-green-900">
                      Variable Income Configuration Models
                    </h3>
                    <p className="text-xs text-brown-700">
                      Select how your household logs or projects fluctuating earnings.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'context', label: '1. Context Box', icon: FileText, desc: 'Scenario description' },
                    { id: 'projects', label: '2. Active Projects', icon: Briefcase, desc: 'Dates & total income' },
                    { id: 'hourly', label: '3. Hourly', icon: Clock, desc: 'Rate × weekly hours' },
                    { id: 'manual', label: '4. Manual', icon: Receipt, desc: 'Expense-style logging' },
                  ].map((sub) => {
                    const isSelected = (variableIncomeState.activeSubOption || 'context') === sub.id;
                    const IconComp = sub.icon;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={async () => {
                          const updated = {
                            ...variableIncomeState,
                            activeSubOption: sub.id as VariableIncomeSubOption,
                          };
                          setVariableIncomeState(updated);
                          await updateHousehold({ variableIncomeState: updated });
                        }}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-xs'
                            : 'bg-beige-50/60 border-beige-200 text-dark-green-900 hover:bg-beige-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <IconComp className={`w-4 h-4 ${isSelected ? 'text-sage-200' : 'text-sage-700'}`} />
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-sage-300" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold block">{sub.label}</span>
                          <span className={`text-[10px] block ${isSelected ? 'text-sage-200' : 'text-dark-grey-600'}`}>
                            {sub.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* SUB-OPTION 1: CONTEXT BOX */}
                {(variableIncomeState.activeSubOption === 'context' || !variableIncomeState.activeSubOption) && (
                  <div className="p-4 bg-beige-50 border border-beige-200 rounded-2xl space-y-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-dark-green-900 font-bold text-xs">
                      <FileText className="w-4 h-4 text-sage-600" />
                      <span>Describe Your Income Scenario</span>
                    </div>
                    <p className="text-xs text-brown-700">
                      Explain seasonality, invoice payment delays, commissions, or upcoming retainer milestones.
                    </p>
                    <textarea
                      rows={4}
                      value={variableIncomeState.scenarioContext || ''}
                      onChange={(e) =>
                        setVariableIncomeState((prev) => ({
                          ...prev,
                          scenarioContext: e.target.value,
                        }))
                      }
                      placeholder="e.g. Freelance web designer with quarterly retainer contracts. Large payments arrive irregularly every 6-8 weeks..."
                      className="w-full p-3 bg-white border border-beige-300 rounded-xl text-xs text-dark-green-900 focus:outline-none focus:ring-1 focus:ring-dark-green-800 leading-relaxed"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          await updateHousehold({ variableIncomeState });
                        }}
                        className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Context</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* SUB-OPTION 2: ACTIVE PROJECT */}
                {(variableIncomeState.activeSubOption === 'projects' || variableIncomeState.activeSubOption === 'project') && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-dark-green-900">
                          Active Client Projects
                        </h4>
                        <p className="text-xs text-brown-700">
                          Scheduled contract deliverables prorated across start and end dates.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddProject(!showAddProject)}
                        className="px-3.5 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{showAddProject ? 'Cancel' : 'Add Project'}</span>
                      </button>
                    </div>

                    {showAddProject && (
                      <form
                        onSubmit={handleAddActiveProject}
                        className="p-4 bg-sage-50/80 border border-sage-200 rounded-2xl space-y-3 animate-in fade-in"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 block">
                              Project Name *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Website Redesign"
                              value={projName}
                              onChange={(e) => setProjName(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-sage-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 block">
                              Total Scheduled Income ($) *
                            </label>
                            <input
                              type="number"
                              required
                              min="1"
                              placeholder="e.g. 6000"
                              value={projTotalAmount}
                              onChange={(e) => setProjTotalAmount(parseFloat(e.target.value) || '')}
                              className="w-full px-3 py-1.5 bg-white border border-sage-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 block">
                              Start Date *
                            </label>
                            <input
                              type="date"
                              required
                              value={projStartDate}
                              onChange={(e) => setProjStartDate(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-sage-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 block">
                              End Date *
                            </label>
                            <input
                              type="date"
                              required
                              value={projEndDate}
                              onChange={(e) => setProjEndDate(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-sage-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Project</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {(variableIncomeState.projects || []).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {variableIncomeState.projects?.map((p) => {
                          const s = new Date(p.startDate).getTime();
                          const e = new Date(p.endDate).getTime();
                          const diffWeeks = Math.max(1, Math.round(Math.abs(e - s) / (1000 * 60 * 60 * 24 * 7)));
                          const weeklyProrate = Math.round(p.totalScheduledIncome / diffWeeks);

                          return (
                            <div
                              key={p.id}
                              className="p-3.5 bg-beige-50 border border-beige-200 rounded-2xl flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-dark-green-900 truncate">
                                  {p.projectName}
                                </div>
                                <div className="text-[11px] text-dark-grey-600 mt-0.5">
                                  {p.startDate} → {p.endDate} ({diffWeeks} wks)
                                </div>
                                <div className="text-[11px] font-semibold text-dark-green-800 mt-1">
                                  Prorated: ~{formatCurrency(weeklyProrate)}/wk
                                </div>
                              </div>

                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="text-sm font-extrabold text-dark-green-900">
                                  {formatCurrency(p.totalScheduledIncome)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveActiveProject(p.id)}
                                  className="p-1.5 text-brown-700 hover:text-alert-red-700 hover:bg-alert-red-50 rounded-lg transition"
                                  title="Remove project"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-beige-50 border border-beige-200 rounded-2xl text-xs text-brown-700">
                        No active client projects currently configured.
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-OPTION 3: HOURLY */}
                {variableIncomeState.activeSubOption === 'hourly' && (
                  <form
                    onSubmit={handleSaveHourlyConfig}
                    className="p-4 bg-beige-50 border border-beige-200 rounded-2xl space-y-4 animate-in fade-in"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-dark-green-900">
                        Hourly Wage Configuration
                      </h4>
                      <p className="text-xs text-brown-700">
                        Fixed pay cadence with fluctuating weekly hours worked.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                          Household Member
                        </label>
                        <select
                          value={hourlyMemberId}
                          onChange={(e) => setHourlyMemberId(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                        >
                          {members.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                          Hourly Rate ($/hr) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={hourlyRate}
                          onChange={(e) => setHourlyRate(parseFloat(e.target.value) || '')}
                          className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                          Est. Hours / Week *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={hourlyHoursPerWeek}
                          onChange={(e) => setHourlyHoursPerWeek(parseFloat(e.target.value) || '')}
                          className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                          Pay Schedule
                        </label>
                        <select
                          value={hourlySchedule}
                          onChange={(e) => setHourlySchedule(e.target.value as PaySchedule)}
                          className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                        >
                          <option value="weekly">Weekly</option>
                          <option value="bi-weekly">Bi-Weekly</option>
                          <option value="semi-monthly">Semi-Monthly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-beige-200">
                      <div className="text-xs font-bold text-dark-green-900">
                        Projected Weekly Pool:{' '}
                        <span className="text-dark-green-800">
                          {formatCurrency(
                            (typeof hourlyRate === 'number' ? hourlyRate : 0) *
                              (typeof hourlyHoursPerWeek === 'number' ? hourlyHoursPerWeek : 0)
                          )}
                          /wk
                        </span>
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Hourly Model</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* SUB-OPTION 4: MANUAL (MIRRORS EXPENSE LOGGING) */}
                {variableIncomeState.activeSubOption === 'manual' && (
                  <div className="space-y-4 animate-in fade-in">
                    <div>
                      <h4 className="text-sm font-bold text-dark-green-900">
                        Manual Variable Income Logging
                      </h4>
                      <p className="text-xs text-brown-700">
                        Fluctuating pay amounts and unpredicted dates. Directly logs into your top-level Income Buffer (mirroring manual expense logging).
                      </p>
                    </div>

                    <form
                      onSubmit={handleAddManualIncomeEntry}
                      className="p-4 bg-sage-50/50 border border-sage-200 rounded-2xl space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-950 block">
                            Income Source / Description *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Design Consulting Payout"
                            value={manualDesc}
                            onChange={(e) => setManualDesc(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sage-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-950 block">
                            Deposit Amount ($) *
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            placeholder="e.g. 1450"
                            value={manualAmount}
                            onChange={(e) => setManualAmount(parseFloat(e.target.value) || '')}
                            className="w-full px-3 py-1.5 bg-white border border-sage-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-950 block">
                            Date Received *
                          </label>
                          <input
                            type="date"
                            required
                            value={manualDate}
                            onChange={(e) => setManualDate(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sage-300 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-950 block">
                            Routing Destination
                          </label>
                          <div className="flex items-center gap-1.5 px-3 py-2 bg-sage-100/70 border border-sage-300 rounded-xl text-xs font-bold text-dark-green-950">
                            <Shield className="w-3.5 h-3.5 text-dark-green-700" />
                            <span>Income Buffer</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Deposit to Buffer</span>
                        </button>
                      </div>
                    </form>

                    {(variableIncomeState.manualEntries || []).length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-dark-green-900 uppercase tracking-wider block">
                          Recent Variable Manual Deposits
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {variableIncomeState.manualEntries?.map((entry) => (
                            <div
                              key={entry.id}
                              className="p-3 bg-beige-50 border border-beige-200 rounded-xl flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-dark-green-900 block truncate">
                                  {entry.description}
                                </span>
                                <span className="text-[10px] text-dark-grey-600 block">
                                  {entry.date} • Routed to Buffer
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-dark-green-800">
                                  +{formatCurrency(entry.amount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveManualIncomeEntry(entry.id)}
                                  className="p-1 text-brown-700 hover:text-alert-red-700 rounded-md"
                                  title="Remove entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: CALENDAR & CHECK-IN */}
      {activeTab === 'calendar' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Calendar Architecture & Check-in Day */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
              <Calendar className="w-5 h-5 text-sage-600" />
              <span>Calendar Architecture & Check-in Day</span>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleCalendarModeToggle('weekly')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  household?.calendarMode === 'weekly'
                    ? 'bg-sage-50 border-dark-green-700 ring-1 ring-dark-green-700 font-semibold'
                    : 'bg-beige-50/50 border-beige-200'
                }`}
              >
                <div className="text-sm text-dark-green-900 font-bold">Fiscal Weekly Calendar (4-4-5)</div>
                <div className="text-xs text-dark-grey-600">7-day cycles with weekly check-in reviews</div>
              </button>

              <button
                type="button"
                onClick={() => handleCalendarModeToggle('monthly')}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                  household?.calendarMode === 'monthly'
                    ? 'bg-sage-50 border-dark-green-700 ring-1 ring-dark-green-700 font-semibold'
                    : 'bg-beige-50/50 border-beige-200'
                }`}
              >
                <div className="text-sm text-dark-green-900 font-bold">Standard Calendar Month</div>
                <div className="text-xs text-dark-grey-600">Tracks 1st to last day of month</div>
              </button>
            </div>

            {household?.calendarMode === 'weekly' ? (
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-dark-green-900 uppercase tracking-wider block">
                  First Day of the Week
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = household?.firstDayOfWeek === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayChange(day)}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold transition text-center cursor-pointer border ${
                          isSelected
                            ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-sm'
                            : 'bg-beige-50 border-beige-200 text-dark-green-900 hover:bg-sage-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div className="p-3.5 bg-sage-50 border border-sage-200 rounded-xl flex items-center gap-3 text-xs text-dark-green-900">
                  <Clock className="w-4 h-4 text-sage-700 flex-shrink-0" />
                  <span>
                    Weekly check-in is scheduled for every{' '}
                    <strong className="text-dark-green-950 font-bold">{household?.lastDayOfWeek}</strong>{' '}
                    evening.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-beige-100/70 border border-beige-200 rounded-xl text-xs text-brown-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-brown-700 flex-shrink-0 mt-0.5" />
                <span>
                  Monthly mode active: Finances are tracked per calendar month and check-ins will occur on the final day of the month.
                </span>
              </div>
            )}
          </div>

          {/* HOUSEHOLD FISCAL YEAR-END MONTH (Relocated Strictly to Calendar Tab) */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
              <Calendar className="w-5 h-5 text-sage-600" />
              <span>Household Fiscal Year-End Month</span>
            </div>

            <p className="text-xs text-brown-700 leading-relaxed">
              Sets the conclusion of your household's 52-week 4-4-5 fiscal annual cycle. Any 53rd leap week will automatically attach to this month.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
              {[
                { month: 1, name: 'January' },
                { month: 2, name: 'February' },
                { month: 3, name: 'March' },
                { month: 4, name: 'April' },
                { month: 5, name: 'May' },
                { month: 6, name: 'June' },
                { month: 7, name: 'July' },
                { month: 8, name: 'August' },
                { month: 9, name: 'September' },
                { month: 10, name: 'October' },
                { month: 11, name: 'November' },
                { month: 12, name: 'December' },
              ].map(({ month, name }) => {
                const isSelected = fiscalYearEndMonth === month;
                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => handleFiscalYearEndMonthChange(month)}
                    disabled={isSavingFiscalMonth}
                    className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-sm ring-1 ring-dark-green-800 font-bold'
                        : 'bg-beige-50/60 border-beige-200 text-dark-green-900 hover:bg-sage-50 font-semibold'
                    }`}
                  >
                    <div className="text-xs font-bold">{name}</div>
                    <div className={`text-[10px] ${isSelected ? 'text-sage-200' : 'text-dark-grey-600'}`}>
                      Month {month}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-3.5 bg-sage-50 border border-sage-200 rounded-xl flex items-center justify-between gap-3 text-xs text-dark-green-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sage-700 flex-shrink-0" />
                <span>
                  Current Fiscal Year-End is set to{' '}
                  <strong className="text-dark-green-950 font-bold">
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ][(fiscalYearEndMonth || 12) - 1]}
                  </strong>.
                </span>
              </div>
              {isSavingFiscalMonth && <Loader2 className="w-3.5 h-3.5 animate-spin text-dark-green-800" />}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: BUDGET ALLOCATION */}
      {activeTab === 'allocation' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Allocation Overview Bar */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-beige-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-dark-green-900">
                  Category Weekly Allocations
                </h3>
                <p className="text-xs text-brown-700">
                  Adjust baseline weekly spending caps across your spending buckets.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(true)}
                  className="px-3.5 py-2 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Category</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllAllocations}
                  disabled={isSavingAllocations}
                  className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {isSavingAllocations ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save All Changes</span>
                </button>
              </div>
            </div>

            {/* Income Pool vs Allocation Summary */}
            <div className="p-4 bg-sage-50 border border-sage-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-dark-green-900">
                  Allocated: {formatCurrency(totalAllocated)} / {formatCurrency(weeklyPool)}
                </span>
                <span
                  className={
                    weeklyPool - totalAllocated >= 0 ? 'text-sage-800' : 'text-alert-red-700'
                  }
                >
                  {weeklyPool - totalAllocated >= 0
                    ? `${formatCurrency(weeklyPool - totalAllocated)} Unallocated Buffer`
                    : `${formatCurrency(Math.abs(weeklyPool - totalAllocated))} Over-allocated`}
                </span>
              </div>
              <div className="w-full h-2.5 bg-beige-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    totalAllocated <= weeklyPool ? 'bg-dark-green-800' : 'bg-alert-red-600'
                  }`}
                  style={{
                    width: `${Math.min(100, weeklyPool > 0 ? (totalAllocated / weeklyPool) * 100 : 0)}%`,
                  }}
                />
              </div>
            </div>

            {/* Category Rows */}
            <div className="space-y-3 pt-1">
              {categories.map((cat) => {
                const currentVal = editedAllocations[cat.id] ?? cat.baselineBudget;
                const monthlyEquiv = Math.round((currentVal * 52) / 12);

                return (
                  <div
                    key={cat.id}
                    className="p-4 bg-beige-50 border border-beige-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-beige-300 flex items-center justify-center text-dark-green-900">
                        <CategoryIcon icon={cat.icon} group={cat.group} className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-dark-green-900">{cat.name}</span>
                          <span className="text-[10px] font-semibold bg-beige-200 text-brown-800 px-2 py-0.5 rounded-md">
                            {cat.group}
                          </span>
                        </div>
                        <span className="text-xs text-dark-grey-600">
                          Approx. {formatCurrency(monthlyEquiv)}/month
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-dark-green-900">$</span>
                        <input
                          type="number"
                          min="0"
                          value={currentVal}
                          onChange={(e) =>
                            setEditedAllocations((prev) => ({
                              ...prev,
                              [cat.id]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-28 pl-6 pr-2.5 py-1.5 bg-white border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900 focus:outline-none"
                        />
                      </div>
                      <span className="text-xs font-semibold text-dark-grey-600">/wk</span>

                      <button
                        type="button"
                        onClick={() => handleSaveCategoryBudget(cat.id)}
                        className="p-2 rounded-xl bg-white border border-beige-300 hover:bg-beige-100 text-dark-green-900 transition cursor-pointer"
                        title="Save single category"
                      >
                        <Check className="w-4 h-4 text-dark-green-800" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save All Baseline Allocations Action */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveAllAllocations}
                disabled={isSavingAllocations}
                className="px-5 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save All Baseline Allocations</span>
              </button>
            </div>
          </div>

          {/* Explicit Baseline Budget Change Approval Modal */}
          {showBaselineApprovalModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in">
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
                    Permanent Baseline Adjustments:
                  </div>
                  {pendingBaselineChanges.map((change) => {
                    const diff = change.newBase - change.oldBase;
                    return (
                      <div
                        key={change.id}
                        className="flex items-center justify-between text-xs py-1 px-1.5"
                      >
                        <span className="font-semibold text-dark-green-900 truncate">
                          {change.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 font-mono">
                          <span className="line-through text-dark-grey-600 text-[11px]">
                            {formatCurrency(change.oldBase)}
                          </span>
                          <span className="font-bold text-dark-green-900">
                            &rarr; {formatCurrency(change.newBase)}/wk
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                              diff >= 0 ? 'bg-sage-100 text-sage-900' : 'bg-alert-red-100 text-alert-red-800'
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
                  These changes will permanently update your baseline weekly budget limits and reset values for future months.
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBaselineApprovalModal(false);
                      setPendingBaselineChanges([]);
                    }}
                    disabled={isSavingAllocations}
                    className="px-4 py-2.5 rounded-xl border border-beige-300 text-brown-800 hover:bg-beige-100 text-xs font-bold transition cursor-pointer"
                  >
                    Cancel / Keep Editing
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBaselineBudgetSave}
                    disabled={isSavingAllocations}
                    className="px-5 py-2.5 rounded-xl bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    {isSavingAllocations ? (
                      <span>Saving Allocations...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm & Apply Baseline Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Add Category Modal */}
          {showAddCatModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/60 backdrop-blur-xs">
              <form
                onSubmit={handleCreateCategory}
                className="bg-white border border-beige-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95"
              >
                <h4 className="text-lg font-extrabold text-dark-green-900">Add Spending Category</h4>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-dark-green-900 block">
                    Category Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Pet Care, Hobbies"
                    className="w-full px-3.5 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-sm font-bold text-dark-green-900 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-dark-green-900 block">
                    Category Classification *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCatType('expense')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                        newCatType === 'expense'
                          ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-xs'
                          : 'bg-beige-50 border-beige-300 text-dark-green-900 hover:bg-beige-100'
                      }`}
                    >
                      <span className="text-xs font-bold">Expense Bucket</span>
                      <span className={`text-[10px] ${newCatType === 'expense' ? 'text-sage-200' : 'text-dark-grey-600'}`}>
                        Tracks spending against cap
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewCatType('savings')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                        newCatType === 'savings'
                          ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-xs'
                          : 'bg-beige-50 border-beige-300 text-dark-green-900 hover:bg-beige-100'
                      }`}
                    >
                      <span className="text-xs font-bold">Savings Bucket</span>
                      <span className={`text-[10px] ${newCatType === 'savings' ? 'text-sage-200' : 'text-dark-grey-600'}`}>
                        Tracks savings goals & targets
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-dark-green-900 block">
                      Group
                    </label>
                    <select
                      value={newCatGroup}
                      onChange={(e) => setNewCatGroup(e.target.value)}
                      className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-semibold text-dark-green-900"
                    >
                      <option value="Essentials">Essentials</option>
                      <option value="Fun Money">Fun Money</option>
                      <option value="Bills">Bills</option>
                      <option value="Savings">Savings</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-dark-green-900 block">
                      Weekly Budget ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newCatBudget}
                      onChange={(e) => setNewCatBudget(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-beige-50 border border-beige-300 rounded-xl text-xs font-bold text-dark-green-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCatModal(false)}
                    className="px-4 py-2 bg-white border border-beige-300 hover:bg-beige-50 text-dark-grey-800 text-xs font-medium rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Create Category
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* SECTION 5: OPERATIONS, SECURITY & ACCOUNT */}
      {activeTab === 'operations' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Multi-Device Sessions & Security */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
              <Smartphone className="w-5 h-5 text-sage-600" />
              <span>Multi-Device Concurrent Sessions</span>
            </div>
            <p className="text-xs text-brown-700 leading-relaxed">
              Your profile (<strong className="text-dark-green-900">{user?.name}</strong>) is linked to Household Sync Code <code className="bg-beige-100 px-1 py-0.5 rounded text-dark-green-900 font-mono font-bold">{household?.syncCode}</code>. You can log into Canopy from your phone, tablet, and laptop simultaneously without logging out your other devices.
            </p>
          </div>

          {/* Start Fresh (Hiatus & Gap Week Resolution) */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
                <span className="text-lg">🌱</span>
                <span>Start Fresh (On-Budget Gap Resolution)</span>
              </div>
              <span className="text-[10px] font-bold text-sage-800 bg-sage-100 px-2 py-0.5 rounded-full">
                Hiatus Recovery
              </span>
            </div>
            <p className="text-xs text-brown-700 leading-relaxed">
              Returning to Canopy after an app hiatus or skipped weeks? "Start Fresh" unblocks past-due check-ins by applying an <strong>"exactly on budget"</strong> assumption for all missed gap weeks and resetting current weekly budgets back to default.
            </p>

            {showFreshStartConfirm ? (
              <div className="p-4 bg-sage-50 border border-sage-200 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-dark-green-900">
                  Apply Fresh Start? This will resolve any past-due check-in alerts and reset all category budgets to baseline without losing past historical transactions.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="confirm-fresh-start-btn"
                    onClick={async () => {
                      await triggerFreshStartAction();
                      setShowFreshStartConfirm(false);
                    }}
                    className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Yes, Start Fresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFreshStartConfirm(false)}
                    className="px-4 py-2 bg-white border border-beige-300 hover:bg-beige-50 text-dark-grey-800 text-xs font-medium rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                id="start-fresh-btn"
                onClick={() => setShowFreshStartConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-sage-100 hover:bg-sage-200 text-dark-green-900 text-xs font-bold rounded-xl border border-sage-300 transition cursor-pointer"
              >
                <span>🌱 Start Fresh</span>
              </button>
            )}
          </div>

          {/* Month-End Hard Reset */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
              <RotateCcw className="w-5 h-5 text-gold-700" />
              <span>Manual Month-End Hard Reset</span>
            </div>
            <p className="text-xs text-brown-700 leading-relaxed">
              Reset all category weekly budgets back to their default baseline allocations for the new fiscal month.
            </p>

            {showMonthEndConfirm ? (
              <div className="p-4 bg-gold-50 border border-gold-200 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-gold-950">
                  Execute Month-End Reset? All category weekly budgets will return to their default baseline values.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="confirm-month-end-reset-btn"
                    onClick={async () => {
                      await executeMonthEndResetAction();
                      setShowMonthEndConfirm(false);
                    }}
                    className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Execute Hard Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMonthEndConfirm(false)}
                    className="px-4 py-2 bg-white border border-beige-300 hover:bg-beige-50 text-dark-grey-800 text-xs font-medium rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                id="manual-month-end-reset-btn"
                onClick={() => setShowMonthEndConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs font-semibold rounded-xl border border-beige-300 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Execute Hard Reset</span>
              </button>
            )}
          </div>

          {/* Leave Household Section */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-dark-green-900 font-bold text-base">
              <UserMinus className="w-5 h-5 text-brown-700" />
              <span>Household Membership</span>
            </div>
            <p className="text-xs text-brown-700 leading-relaxed">
              Disconnect your account from <span className="font-semibold text-dark-green-900">{household?.name || 'this household'}</span>.
            </p>

            {showLeaveModal ? (
              <div className="p-4 bg-beige-100 border border-beige-300 rounded-xl space-y-4">
                {leaveStep === 'confirm' ? (
                  <>
                    <div className="flex items-start gap-2.5 text-xs text-brown-900 font-medium">
                      <AlertTriangle className="w-4 h-4 text-gold-700 flex-shrink-0 mt-0.5" />
                      <span>
                        Are you sure you want to leave <strong className="font-bold text-dark-green-900">{household?.name || 'the household'}</strong>? You will no longer have access to this shared budget unless you re-join with the sync code.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        id="confirm-leave-household-step-btn"
                        onClick={() => setLeaveStep('choice')}
                        className="px-4 py-2 bg-brown-700 hover:bg-brown-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Continue
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLeaveModal(false)}
                        className="px-4 py-2 bg-white border border-beige-300 hover:bg-beige-50 text-dark-grey-800 text-xs font-medium rounded-xl transition cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-dark-green-900">
                      What would you like to do next?
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        id="leave-and-new-household-btn"
                        disabled={isLeaving}
                        onClick={() => handleLeaveOptionChoice('new_household')}
                        className="flex items-center justify-center gap-2 p-3 bg-white hover:bg-sage-50 border border-sage-300 hover:border-dark-green-700 text-dark-green-900 font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                      >
                        {isLeaving ? <Loader2 className="w-4 h-4 animate-spin text-dark-green-800" /> : <Home className="w-4 h-4 text-dark-green-800" />}
                        <span>Set up a new household</span>
                      </button>
                      <button
                        type="button"
                        id="leave-and-sign-out-btn"
                        disabled={isLeaving}
                        onClick={() => handleLeaveOptionChoice('sign_out')}
                        className="flex items-center justify-center gap-2 p-3 bg-white hover:bg-beige-50 border border-beige-300 hover:border-brown-400 text-brown-900 font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                      >
                        {isLeaving ? <Loader2 className="w-4 h-4 animate-spin text-brown-700" /> : <LogOut className="w-4 h-4 text-brown-700" />}
                        <span>Sign out</span>
                      </button>
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowLeaveModal(false);
                          setLeaveStep('confirm');
                        }}
                        className="text-xs text-dark-grey-600 hover:underline cursor-pointer"
                      >
                        Back to Settings
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                id="leave-household-btn"
                onClick={() => {
                  setLeaveStep('confirm');
                  setShowLeaveModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs font-semibold rounded-xl border border-beige-300 transition cursor-pointer"
              >
                <UserMinus className="w-3.5 h-3.5 text-brown-700" />
                <span>Leave Household</span>
              </button>
            )}
          </div>

          {/* Danger Zone: Delete Account */}
          <div className="bg-alert-red-50/70 border border-alert-red-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-alert-red-900 font-bold text-base">
              <Trash2 className="w-5 h-5 text-alert-red-700" />
              <span>Delete Account</span>
            </div>
            <p className="text-xs text-alert-red-800 leading-relaxed">
              Permanently delete your user profile and login credentials. Deleting your account will immediately remove you from the household and route you to the sign-up page. This action cannot be undone.
            </p>

            {showDeleteModal ? (
              <div className="p-4 bg-alert-red-100/80 border border-alert-red-300 rounded-xl space-y-3">
                <div className="flex items-start gap-2 text-xs text-alert-red-950 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-alert-red-700 flex-shrink-0 mt-0.5" />
                  <span>
                    Warning: Are you absolutely certain you want to delete your account? You will be removed from your household and returned to the initial registration page.
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    id="confirm-delete-account-btn"
                    disabled={isDeleting}
                    onClick={handleConfirmDeleteAccount}
                    className="flex items-center gap-1.5 px-4 py-2 bg-alert-red-700 hover:bg-alert-red-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Deleting Account...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Permanently Delete My Account</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 bg-white border border-alert-red-200 hover:bg-alert-red-50 text-alert-red-900 text-xs font-medium rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                id="delete-account-btn"
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-alert-red-600 hover:bg-alert-red-700 text-white text-xs font-bold rounded-xl border border-alert-red-700 transition cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD ONE-OFF DEPOSIT */}
      {showAddOneOffModal && (
        <div className="fixed inset-0 bg-dark-green-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-beige-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-beige-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-dark-green-900">
                    Log One-Off Deposit
                  </h3>
                  <p className="text-xs text-brown-700">
                    Routes directly into your top-level Income Buffer.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddOneOffModal(false)}
                className="p-1.5 text-brown-700 hover:text-dark-green-900 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddOneOffDeposit} className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 block">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['Annual Bonus', 'Holiday Gift', 'Tax Refund', 'Commission Payout', 'Cash Rebate'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOneOffDesc(preset)}
                      className="px-2.5 py-1 bg-beige-100 hover:bg-sage-100 text-dark-green-900 text-[11px] font-semibold rounded-lg transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 block">
                  Deposit Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q2 Performance Bonus"
                  value={oneOffDesc}
                  onChange={(e) => setOneOffDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-beige-50 border border-beige-200 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 block">
                    Deposit Amount ($) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 2500"
                    value={oneOffAmount}
                    onChange={(e) => setOneOffAmount(parseFloat(e.target.value) || '')}
                    className="w-full px-3 py-2 bg-beige-50 border border-beige-200 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 block">
                    Deposit Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={oneOffDate}
                    onChange={(e) => setOneOffDate(e.target.value)}
                    className="w-full px-3 py-2 bg-beige-50 border border-beige-200 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 block">
                  Household Member
                </label>
                <select
                  value={oneOffMemberId}
                  onChange={(e) => setOneOffMemberId(e.target.value)}
                  className="w-full px-3 py-2 bg-beige-50 border border-beige-200 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                >
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} {m.userId === user?.userId ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-dark-green-900 block">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Direct deposited into checking"
                  value={oneOffNotes}
                  onChange={(e) => setOneOffNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-beige-50 border border-beige-200 rounded-xl text-xs font-semibold text-dark-green-900 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-sage-50 border border-sage-200 rounded-xl flex items-center gap-2 text-xs text-dark-green-900">
                <Shield className="w-4 h-4 text-dark-green-700 flex-shrink-0" />
                <span>
                  This deposit will directly increase your <strong>Income Buffer</strong> without affecting weekly member paycheck allocations.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-beige-100">
                <button
                  type="button"
                  onClick={() => setShowAddOneOffModal(false)}
                  className="px-4 py-2 text-brown-700 hover:text-dark-green-900 text-xs font-bold hover:bg-beige-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Deposit into Buffer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REMOVE HOUSEHOLD MEMBER CONFIRMATION MODAL */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-alert-red-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-alert-red-100 border border-alert-red-200 flex items-center justify-center text-alert-red-700 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-dark-green-900">
                  Remove Household Member
                </h3>
                <p className="text-xs text-brown-700">
                  Confirm permanent removal of member from roster.
                </p>
              </div>
            </div>

            <div className="p-4 bg-alert-red-50/70 border border-alert-red-200 rounded-2xl space-y-2 text-xs text-alert-red-950 leading-relaxed">
              <p>
                Are you sure you want to remove <span className="font-bold">{memberToRemove.name}</span> from <span className="font-bold">{household?.name || 'this household'}</span>?
              </p>
              {memberToRemove.isPlaceholder ? (
                <p className="text-alert-red-800 text-[11px]">
                  This is an <span className="font-bold">unclaimed placeholder profile</span>. Its roster record in <code className="font-mono bg-white/70 px-1 py-0.5 rounded">households/members</code> will be permanently deleted and the shared weekly pool will adjust automatically.
                </p>
              ) : memberToRemove.userId === user?.userId ? (
                <p className="text-alert-red-800 text-[11px]">
                  <span className="font-bold">Warning:</span> You are removing your own profile. You will leave this household and will need a sync code to rejoin.
                </p>
              ) : (
                <p className="text-alert-red-800 text-[11px]">
                  This is a <span className="font-bold">real user account</span>. The member will be removed from the household roster and their profile will be unlinked (active household reset).
                </p>
              )}
              <p className="text-[11px] font-bold text-alert-red-700 pt-1">
                This action is permanent and cannot be undone.
              </p>
            </div>

            {removeMemberError && (
              <div className="p-3 bg-alert-red-100 border border-alert-red-300 rounded-xl text-xs text-alert-red-900 font-semibold">
                {removeMemberError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-beige-100">
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={() => {
                  setMemberToRemove(null);
                  setRemoveMemberError(null);
                }}
                className="px-4 py-2 text-brown-700 hover:text-dark-green-900 text-xs font-bold hover:bg-beige-100 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={handleConfirmRemoveMember}
                id="confirm-remove-member-btn"
                className="px-4 py-2 bg-alert-red-700 hover:bg-alert-red-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isRemovingMember ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Remove</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
