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
    createCategory,
    updateCategory,
    deleteCategory,
    saveCategoryAllocations,
    triggerFreshStartAction,
    executeMonthEndResetAction,
    leaveHousehold,
    deleteAccount,
    signOut,
  } = useHousehold();

  // Active section tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('type');
  const [copied, setCopied] = useState(false);

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
    Record<string, { rawIncome: number; schedule: PaySchedule; isSaving: boolean }>
  >({});

  // Budget Allocation State
  const [editedAllocations, setEditedAllocations] = useState<Record<string, number>>({});
  const [isSavingAllocations, setIsSavingAllocations] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatBudget, setNewCatBudget] = useState(100);
  const [newCatGroup, setNewCatGroup] = useState('Essentials');
  const [showAddCatModal, setShowAddCatModal] = useState(false);

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
    }
  }, [household]);

  // Sync member incomes
  useEffect(() => {
    const map: Record<string, { rawIncome: number; schedule: PaySchedule; isSaving: boolean }> = {};
    members.forEach((m) => {
      map[m.userId] = {
        rawIncome: m.rawIncome || 0,
        schedule: m.incomeSchedule || 'bi-weekly',
        isSaving: false,
      };
    });
    setMemberIncomes(map);
  }, [members]);

  // Sync category allocations
  useEffect(() => {
    const map: Record<string, number> = {};
    categories.forEach((c) => {
      map[c.id] = c.currentWeeklyBudget ?? c.baselineBudget;
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

  const handleSaveIncomeStructure = async () => {
    await updateHousehold({
      incomeType,
      baselineWeeklyBurnRate: burnRate,
      initialBufferAmount: bufferAmount,
    });
  };

  const handleUpdateSingleMemberIncome = async (memberId: string) => {
    const current = memberIncomes[memberId];
    if (!current) return;

    setMemberIncomes((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], isSaving: true },
    }));

    try {
      await updateMemberIncome(memberId, current.rawIncome, current.schedule);
    } finally {
      setMemberIncomes((prev) => ({
        ...prev,
        [memberId]: { ...prev[memberId], isSaving: false },
      }));
    }
  };

  const handleDayChange = (day: DayOfWeek) => {
    updateHousehold({ firstDayOfWeek: day });
  };

  const handleCalendarModeToggle = (mode: CalendarMode) => {
    updateHousehold({ calendarMode: mode });
  };

  const handleSaveCategoryBudget = async (catId: string) => {
    const val = editedAllocations[catId];
    if (val === undefined || isNaN(val)) return;
    await updateCategory(catId, { currentWeeklyBudget: val, baselineBudget: val });
  };

  const handleSaveAllAllocations = async () => {
    setIsSavingAllocations(true);
    try {
      const updated = categories.map((c) => ({
        ...c,
        currentWeeklyBudget: editedAllocations[c.id] ?? c.currentWeeklyBudget,
        baselineBudget: editedAllocations[c.id] ?? c.baselineBudget,
      }));
      await saveCategoryAllocations(updated);
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
      icon: 'tag',
      color: 'sage',
      currentWeeklyBudget: Number(newCatBudget) || 0,
      baselineBudget: Number(newCatBudget) || 0,
      rolloverPreference: 'rollover_positive',
    });
    setNewCatName('');
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
                  className="p-3.5 bg-beige-50 border border-beige-200 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sage-200 text-dark-green-900 font-bold text-sm flex items-center justify-center border border-sage-300">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        member.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-dark-green-900">{member.name}</span>
                        {member.userId === user?.userId && (
                          <span className="text-[10px] bg-dark-green-800 text-white font-bold px-1.5 py-0.5 rounded-md">
                            You
                          </span>
                        )}
                        {member.isPlaceholder && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded-md">
                            Placeholder
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-dark-grey-600">
                        {formatCurrency(member.normalizedWeeklyIncome)}/wk ({member.incomeSchedule})
                      </span>
                    </div>
                  </div>
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
            <div className="flex items-center justify-between border-b border-beige-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-dark-green-900">
                  Income Cadence & Volatility
                </h3>
                <p className="text-xs text-brown-700">
                  Choose how Canopy manages incoming funds and buffers.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveIncomeStructure}
                className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Income Model</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIncomeType('predictable')}
                className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                  incomeType === 'predictable'
                    ? 'bg-sage-100/70 border-dark-green-800 ring-1 ring-dark-green-800 shadow-xs'
                    : 'bg-beige-50/50 border-beige-300'
                }`}
              >
                <span className="text-sm font-bold text-dark-green-900 block">
                  Predictable Regular Income
                </span>
                <span className="text-xs text-dark-grey-600 leading-relaxed block mt-1">
                  Standard W-2 paychecks on regular cadences (weekly, bi-weekly, semi-monthly, or monthly).
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
                <span className="text-sm font-bold text-dark-green-900 block">
                  Variable / Commission Income
                </span>
                <span className="text-xs text-dark-grey-600 leading-relaxed block mt-1">
                  Freelance, 1099, or commission-based earnings requiring a buffer pool and baseline weekly burn rate.
                </span>
              </button>
            </div>

            {incomeType === 'variable' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-amber-50/60 border border-amber-200 rounded-2xl animate-in fade-in">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-950 block">
                    Baseline Weekly Burn Rate ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={burnRate}
                    onChange={(e) => setBurnRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-sm font-bold text-dark-green-900 focus:outline-none"
                  />
                  <span className="text-[10px] text-amber-800 block">Target weekly spending cap</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-950 block">
                    Initial Buffer Reserve ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={bufferAmount}
                    onChange={(e) => setBufferAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-sm font-bold text-dark-green-900 focus:outline-none"
                  />
                  <span className="text-[10px] text-amber-800 block">Liquid buffer to absorb slow weeks</span>
                </div>
              </div>
            )}
          </div>

          {/* Member Incomes Configuration Table */}
          <div className="bg-white border border-beige-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-dark-green-900">
                  Member Pay Schedules & Normalization
                </h3>
                <p className="text-xs text-brown-700">
                  Each member's income is mathematically normalized to create a predictable weekly household pool.
                </p>
              </div>

              <div className="text-right">
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
                  isSaving: false,
                };
                const normalized = normalizeToWeekly(memState.rawIncome, memState.schedule);

                return (
                  <div
                    key={m.userId}
                    className="p-4 bg-beige-50 border border-beige-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
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
                          Weekly normalized: <strong className="text-dark-green-900 font-bold">{formatCurrency(normalized)}/wk</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
                          Pay Amount ($)
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

                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => handleUpdateSingleMemberIncome(m.userId)}
                          disabled={memState.isSaving}
                          className="px-3 py-2 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
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
        </div>
      )}

      {/* SECTION 3: CALENDAR & CHECK-IN */}
      {activeTab === 'calendar' && (
        <div className="space-y-5 animate-in fade-in">
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
                    weeklyPool - totalAllocated >= 0 ? 'text-sage-800' : 'text-red-700'
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
                    totalAllocated <= weeklyPool ? 'bg-dark-green-800' : 'bg-red-600'
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
                const currentVal = editedAllocations[cat.id] ?? cat.currentWeeklyBudget;
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
          </div>

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
              <RotateCcw className="w-5 h-5 text-amber-700" />
              <span>Manual Month-End Hard Reset</span>
            </div>
            <p className="text-xs text-brown-700 leading-relaxed">
              Reset all category weekly budgets back to their default baseline allocations for the new fiscal month.
            </p>

            {showMonthEndConfirm ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-amber-950">
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
                      <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <span>
                        Are you sure you want to leave <strong className="font-bold text-dark-green-900">{household?.name || 'the household'}</strong>? You will no longer have access to this shared budget unless you re-join with the sync code.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        id="confirm-leave-household-step-btn"
                        onClick={() => setLeaveStep('choice')}
                        className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
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
          <div className="bg-red-50/70 border border-red-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-red-900 font-bold text-base">
              <Trash2 className="w-5 h-5 text-red-700" />
              <span>Delete Account</span>
            </div>
            <p className="text-xs text-red-800 leading-relaxed">
              Permanently delete your user profile and login credentials. Deleting your account will immediately remove you from the household and route you to the sign-up page. This action cannot be undone.
            </p>

            {showDeleteModal ? (
              <div className="p-4 bg-red-100/80 border border-red-300 rounded-xl space-y-3">
                <div className="flex items-start gap-2 text-xs text-red-950 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
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
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
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
                    className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-900 text-xs font-medium rounded-xl transition cursor-pointer disabled:opacity-50"
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
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl border border-red-700 transition cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
