import React, { useState } from 'react';
import {
  HouseholdMember,
  PaySchedule,
  IncomeType,
  VariableIncomeState,
  OneOffDeposit,
  ActiveProjectIncome,
  HourlyIncomeConfig,
  ManualIncomeEntry,
} from '../../types';
import { normalizeToWeekly, formatCurrency, calculateWeeklyPool } from '../../lib/calculations';
import {
  ArrowLeft,
  ArrowRight,
  DollarSign,
  Calculator,
  Calendar,
  User,
  Shield,
  Sparkles,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  Briefcase,
  Clock,
  Receipt,
  HelpCircle,
} from 'lucide-react';

interface IncomeStepProps {
  members: HouseholdMember[];
  setMembers: React.Dispatch<React.SetStateAction<HouseholdMember[]>>;
  fiscalYearEndMonth?: number;
  setFiscalYearEndMonth?: (m: number) => void;
  incomeType?: IncomeType;
  setIncomeType?: (t: IncomeType) => void;
  baselineWeeklyBurnRate?: number;
  setBaselineWeeklyBurnRate?: (r: number) => void;
  initialBufferAmount?: number;
  setInitialBufferAmount?: (a: number) => void;
  variableIncomeState?: VariableIncomeState;
  setVariableIncomeState?: React.Dispatch<React.SetStateAction<VariableIncomeState>>;
  oneOffDeposits?: OneOffDeposit[];
  setOneOffDeposits?: React.Dispatch<React.SetStateAction<OneOffDeposit[]>>;
  onNext: () => void;
  onBack: () => void;
}

const SCHEDULE_OPTIONS: Array<{ value: PaySchedule; label: string; formula: string }> = [
  { value: 'weekly', label: 'Weekly', formula: 'Amount / week' },
  { value: 'bi-weekly', label: 'Bi-Weekly (Every 2 wks)', formula: '(Amount × 26) ÷ 52' },
  { value: 'semi-monthly', label: 'Semi-Monthly (Twice a month)', formula: '(Amount × 24) ÷ 52' },
  { value: 'monthly', label: 'Monthly', formula: '(Amount × 12) ÷ 52' },
];

export const IncomeStep: React.FC<IncomeStepProps> = ({
  members,
  setMembers,
  incomeType = 'predictable',
  setIncomeType,
  baselineWeeklyBurnRate = 0,
  setBaselineWeeklyBurnRate,
  initialBufferAmount = 0,
  setInitialBufferAmount,
  variableIncomeState = {
    activeSubOption: 'context',
    scenarioContext: '',
    projects: [],
    hourlyConfigs: [],
    manualEntries: [],
  },
  setVariableIncomeState,
  oneOffDeposits = [],
  setOneOffDeposits,
  onNext,
  onBack,
}) => {
  const totalWeeklyPool = calculateWeeklyPool(members);

  // Validation State for Strictly Required Date of Last Paycheck
  const [missingDateMemberIds, setMissingDateMemberIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Scheduled Income: One-Off Deposit Form State
  const [showAddOneOffModal, setShowAddOneOffModal] = useState<boolean>(false);
  const [oneOffDesc, setOneOffDesc] = useState<string>('');
  const [oneOffAmount, setOneOffAmount] = useState<number | ''>('');
  const [oneOffDate, setOneOffDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [oneOffMemberId, setOneOffMemberId] = useState<string>(() => members[0]?.userId || '');
  const [oneOffNotes, setOneOffNotes] = useState<string>('');

  // Variable Income Sub-Option Form States
  const activeSubOption = variableIncomeState?.activeSubOption || 'context';

  // Active Project Form State
  const [showAddProject, setShowAddProject] = useState<boolean>(false);
  const [projName, setProjName] = useState<string>('');
  const [projStartDate, setProjStartDate] = useState<string>('');
  const [projEndDate, setProjEndDate] = useState<string>('');
  const [projTotalAmount, setProjTotalAmount] = useState<number | ''>('');
  const [projMemberId, setProjMemberId] = useState<string>(() => members[0]?.userId || '');
  const [projNotes, setProjNotes] = useState<string>('');

  // Hourly Form State
  const [hourlyMemberId, setHourlyMemberId] = useState<string>(() => members[0]?.userId || '');
  const [hourlyRate, setHourlyRate] = useState<number | ''>(45);
  const [hourlyHoursPerWeek, setHourlyHoursPerWeek] = useState<number | ''>(35);
  const [hourlySchedule, setHourlySchedule] = useState<PaySchedule>('bi-weekly');

  // Manual Form State (Mirrors manual expense logging)
  const [manualAmount, setManualAmount] = useState<number | ''>('');
  const [manualDesc, setManualDesc] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [manualMemberId, setManualMemberId] = useState<string>(() => members[0]?.userId || '');
  const [manualNotes, setManualNotes] = useState<string>('');

  const handleIncomeChange = (userId: string, value: number) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.userId === userId) {
          const raw = isNaN(value) ? 0 : Math.max(0, value);
          const normalized = m.hasProvidedIncome ? normalizeToWeekly(raw, m.incomeSchedule) : 0;
          return {
            ...m,
            rawIncome: raw,
            normalizedWeeklyIncome: normalized,
          };
        }
        return m;
      })
    );
  };

  const handleScheduleChange = (userId: string, schedule: PaySchedule) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.userId === userId) {
          const normalized = m.hasProvidedIncome ? normalizeToWeekly(m.rawIncome, schedule) : 0;
          return {
            ...m,
            incomeSchedule: schedule,
            normalizedWeeklyIncome: normalized,
          };
        }
        return m;
      })
    );
  };

  const handleLastPayDateChange = (userId: string, dateStr: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, lastPayDate: dateStr } : m))
    );
    if (dateStr.trim()) {
      setMissingDateMemberIds((prev) => prev.filter((id) => id !== userId));
      if (missingDateMemberIds.length <= 1) {
        setValidationError(null);
      }
    }
  };

  const handleToggleSelfInput = (userId: string, willInputSelf: boolean) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.userId === userId) {
          const hasProvided = !willInputSelf;
          const normalized = hasProvided ? normalizeToWeekly(m.rawIncome, m.incomeSchedule) : 0;
          return {
            ...m,
            hasProvidedIncome: hasProvided,
            normalizedWeeklyIncome: normalized,
          };
        }
        return m;
      })
    );
  };

  const handleNameChange = (userId: string, name: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, name } : m))
    );
  };

  // Scheduled Income: Add One-Off Deposit
  const handleAddOneOffDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = typeof oneOffAmount === 'number' ? oneOffAmount : parseFloat(String(oneOffAmount)) || 0;
    if (amountNum <= 0) return;

    const newDeposit: OneOffDeposit = {
      id: `dep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      description: oneOffDesc.trim() || 'One-Off Deposit',
      amount: amountNum,
      date: oneOffDate || new Date().toISOString().split('T')[0],
      payerMemberId: oneOffMemberId,
      notes: oneOffNotes.trim() || undefined,
    };

    if (setOneOffDeposits) {
      setOneOffDeposits((prev) => [...(prev || []), newDeposit]);
    }
    if (setInitialBufferAmount) {
      setInitialBufferAmount((initialBufferAmount || 0) + amountNum);
    }

    setOneOffDesc('');
    setOneOffAmount('');
    setOneOffNotes('');
    setShowAddOneOffModal(false);
  };

  const handleRemoveOneOffDeposit = (id: string, amount: number) => {
    if (setOneOffDeposits) {
      setOneOffDeposits((prev) => (prev || []).filter((d) => d.id !== id));
    }
    if (setInitialBufferAmount) {
      setInitialBufferAmount(Math.max(0, (initialBufferAmount || 0) - amount));
    }
  };

  // Variable Income: Add Active Project
  const handleAddActiveProject = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = typeof projTotalAmount === 'number' ? projTotalAmount : parseFloat(String(projTotalAmount)) || 0;
    if (!projStartDate || !projEndDate || amountNum <= 0) return;

    const newProject: ActiveProjectIncome = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      projectName: projName.trim() || 'Active Client Project',
      startDate: projStartDate,
      endDate: projEndDate,
      totalScheduledIncome: amountNum,
      memberId: projMemberId,
      notes: projNotes.trim() || undefined,
    };

    if (setVariableIncomeState) {
      setVariableIncomeState((prev) => ({
        ...prev,
        projects: [...(prev.projects || []), newProject],
      }));
    }

    setProjName('');
    setProjStartDate('');
    setProjEndDate('');
    setProjTotalAmount('');
    setProjNotes('');
    setShowAddProject(false);
  };

  const handleRemoveActiveProject = (id: string) => {
    if (setVariableIncomeState) {
      setVariableIncomeState((prev) => ({
        ...prev,
        projects: (prev.projects || []).filter((p) => p.id !== id),
      }));
    }
  };

  // Variable Income: Save Hourly Configuration
  const handleSaveHourlyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const rateNum = typeof hourlyRate === 'number' ? hourlyRate : parseFloat(String(hourlyRate)) || 0;
    const hoursNum = typeof hourlyHoursPerWeek === 'number' ? hourlyHoursPerWeek : parseFloat(String(hourlyHoursPerWeek)) || 0;
    if (rateNum <= 0 || hoursNum <= 0) return;

    const newConfig: HourlyIncomeConfig = {
      id: `hourly_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      memberId: hourlyMemberId,
      payFrequency: hourlySchedule,
      hourlyRate: rateNum,
      estimatedHoursPerWeek: hoursNum,
    };

    if (setVariableIncomeState) {
      setVariableIncomeState((prev) => ({
        ...prev,
        hourlyConfigs: [
          ...(prev.hourlyConfigs || []).filter((c) => c.memberId !== hourlyMemberId),
          newConfig,
        ],
      }));
    }

    // Also update member rawIncome and normalized rate for parity
    const computedWeekly = rateNum * hoursNum;
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === hourlyMemberId
          ? {
              ...m,
              rawIncome: computedWeekly * (hourlySchedule === 'bi-weekly' ? 2 : hourlySchedule === 'monthly' ? 4.333 : 1),
              incomeSchedule: hourlySchedule,
              normalizedWeeklyIncome: computedWeekly,
              hasProvidedIncome: true,
            }
          : m
      )
    );
  };

  // Variable Income: Add Manual Entry
  const handleAddManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = typeof manualAmount === 'number' ? manualAmount : parseFloat(String(manualAmount)) || 0;
    if (amountNum <= 0) return;

    const newEntry: ManualIncomeEntry = {
      id: `man_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      amount: amountNum,
      description: manualDesc.trim() || 'Manual Deposit',
      category: 'Income Buffer',
      date: manualDate || new Date().toISOString().split('T')[0],
      payerMemberId: manualMemberId,
      notes: manualNotes.trim() || undefined,
    };

    if (setVariableIncomeState) {
      setVariableIncomeState((prev) => ({
        ...prev,
        manualEntries: [...(prev.manualEntries || []), newEntry],
      }));
    }
    if (setInitialBufferAmount) {
      setInitialBufferAmount((initialBufferAmount || 0) + amountNum);
    }

    setManualAmount('');
    setManualDesc('');
    setManualNotes('');
  };

  const handleRemoveManualEntry = (id: string, amount: number) => {
    if (setVariableIncomeState) {
      setVariableIncomeState((prev) => ({
        ...prev,
        manualEntries: (prev.manualEntries || []).filter((e) => e.id !== id),
      }));
    }
    if (setInitialBufferAmount) {
      setInitialBufferAmount(Math.max(0, (initialBufferAmount || 0) - amount));
    }
  };

  // Validation Check before proceeding to next step
  const handleNextClick = () => {
    const missing = members
      .filter((m) => m.hasProvidedIncome && (!m.lastPayDate || !m.lastPayDate.trim()))
      .map((m) => m.userId);

    if (missing.length > 0) {
      setMissingDateMemberIds(missing);
      const names = members
        .filter((m) => missing.includes(m.userId))
        .map((m) => m.name)
        .join(', ');
      setValidationError(
        `Date of Last Paycheck is required for all earning members (${names}) to establish paycheck timing and 4-4-5 extra paycheck detection.`
      );
      return;
    }

    setMissingDateMemberIds([]);
    setValidationError(null);
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-2xl font-bold text-dark-green-900">Income Normalization</h2>
        <p className="text-sm text-brown-700">
          Configure household pay schedules, last paycheck timing, and income buffer architecture.
        </p>
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-red-800">
            <span className="font-bold block">Required Field Missing</span>
            <p>{validationError}</p>
          </div>
        </div>
      )}

      {/* Income Structure Type Selection */}
      <div className="bg-white border border-beige-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <label className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900 block">
            Income Structure Type
          </label>
          <span className="text-[11px] text-brown-700">Choose how your household earns</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Scheduled Income (Renamed from Predictable Income) */}
          <button
            type="button"
            id="income-type-predictable-btn"
            onClick={() => setIncomeType?.('predictable')}
            className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              incomeType === 'predictable'
                ? 'bg-sage-50/80 border-dark-green-800 ring-2 ring-dark-green-800/20'
                : 'bg-white border-beige-200 hover:border-beige-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-extrabold text-sm text-dark-green-900">Scheduled Income</span>
              <Calendar className="w-4 h-4 text-sage-700" />
            </div>
            <p className="text-xs text-brown-700 leading-relaxed">
              Steady, regular paychecks (salaried, hourly, bi-weekly, or monthly). Automatic 4-4-5 extra paycheck detection.
            </p>
          </button>

          {/* Variable / Freelance */}
          <button
            type="button"
            id="income-type-variable-btn"
            onClick={() => {
              setIncomeType?.('variable');
              if (setBaselineWeeklyBurnRate && baselineWeeklyBurnRate === 0) {
                setBaselineWeeklyBurnRate(totalWeeklyPool > 0 ? totalWeeklyPool : 1500);
              }
              if (setInitialBufferAmount && initialBufferAmount === 0) {
                setInitialBufferAmount(totalWeeklyPool > 0 ? totalWeeklyPool * 4 : 6000);
              }
            }}
            className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              incomeType === 'variable'
                ? 'bg-sage-50/80 border-dark-green-800 ring-2 ring-dark-green-800/20'
                : 'bg-white border-beige-200 hover:border-beige-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-extrabold text-sm text-dark-green-900">Variable / Freelance</span>
              <Shield className="w-4 h-4 text-dark-green-800" />
            </div>
            <p className="text-xs text-brown-700 leading-relaxed">
              Fluctuating or irregular deposits. Earnings feed a dedicated Income Buffer tank, with automated weekly drawdown.
            </p>
          </button>
        </div>

        {/* SCHEDULED INCOME ENHANCEMENT: One-Off Deposits Path */}
        {incomeType === 'predictable' && (
          <div className="pt-3 border-t border-beige-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-dark-green-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sage-700" />
                  One-Off Scheduled Deposits (Bonuses, Gifts, Tax Refunds)
                </span>
                <p className="text-[11px] text-brown-700">
                  Lump sums and windfalls route directly to your top-level Income Buffer reserve.
                </p>
              </div>
              <button
                type="button"
                id="add-one-off-deposit-toggle-btn"
                onClick={() => setShowAddOneOffModal((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-100 hover:bg-sage-200 text-dark-green-900 border border-sage-300 rounded-xl text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddOneOffModal ? 'Cancel' : 'Add One-Off Deposit'}</span>
              </button>
            </div>

            {/* One-Off Deposit Form */}
            {showAddOneOffModal && (
              <form
                onSubmit={handleAddOneOffDeposit}
                className="p-4 bg-beige-50/90 border border-beige-300 rounded-2xl space-y-3 animate-in fade-in"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-dark-grey-800 block">
                      Deposit Amount ($) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-brown-600 absolute left-3 top-2.5" />
                      <input
                        type="number"
                        required
                        min="1"
                        step="50"
                        value={oneOffAmount}
                        onChange={(e) => setOneOffAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        placeholder="e.g. 3000"
                        className="w-full pl-8 pr-3 py-2 bg-white border border-beige-300 rounded-xl text-dark-green-900 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-dark-green-700"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-xs font-semibold text-dark-grey-800 block">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={oneOffDesc}
                      onChange={(e) => setOneOffDesc(e.target.value)}
                      placeholder="e.g. Annual Bonus, Tax Refund, Gift"
                      className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-dark-green-900 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-dark-green-700"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-xs font-semibold text-dark-grey-800 block">
                      Deposit Date
                    </label>
                    <input
                      type="date"
                      value={oneOffDate}
                      onChange={(e) => setOneOffDate(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-beige-300 rounded-xl text-dark-green-900 text-xs focus:outline-none focus:ring-1 focus:ring-dark-green-700 cursor-pointer"
                    />
                  </div>

                  {/* Quick Preset Tags */}
                  <div className="sm:col-span-12 flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-brown-700 font-semibold">Quick presets:</span>
                    {['Annual Bonus', 'Tax Refund', 'Holiday Gift', 'Contract Milestone', 'Rebate'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setOneOffDesc(preset)}
                        className="px-2 py-0.5 bg-white hover:bg-sage-100 border border-beige-200 rounded-md text-[10px] font-medium text-dark-green-900 transition cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <div className="sm:col-span-8 space-y-1">
                    <label className="text-xs font-semibold text-dark-grey-800 block">
                      Deposited By
                    </label>
                    <select
                      value={oneOffMemberId}
                      onChange={(e) => setOneOffMemberId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-beige-300 rounded-xl text-dark-green-900 text-xs focus:outline-none focus:ring-1 focus:ring-dark-green-700 cursor-pointer"
                    >
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4 flex justify-end">
                    <button
                      type="submit"
                      className="w-full py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
                    >
                      Route to Income Buffer
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Logged One-Off Deposits List */}
            {oneOffDeposits && oneOffDeposits.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {oneOffDeposits.map((dep) => (
                  <div
                    key={dep.id}
                    className="p-2.5 bg-beige-50/70 border border-beige-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="p-1 bg-dark-green-800 text-white rounded-md">
                        <Shield className="w-3 h-3" />
                      </span>
                      <span className="font-bold text-dark-green-900 truncate">{dep.description}</span>
                      <span className="text-[10px] text-brown-700 bg-beige-200/70 px-2 py-0.5 rounded">
                        {dep.date}
                      </span>
                      <span className="text-[10px] text-dark-green-800 bg-sage-100 font-semibold px-2 py-0.5 rounded">
                        Routes to Income Buffer
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-extrabold text-dark-green-900">
                        +{formatCurrency(dep.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOneOffDeposit(dep.id, dep.amount)}
                        className="text-dark-grey-600 hover:text-red-600 p-1 transition cursor-pointer"
                        title="Remove deposit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VARIABLE INCOME RESTRUCTURING: 4 Sub-Options */}
        {incomeType === 'variable' && (
          <div className="pt-3 border-t border-beige-200/80 space-y-4">
            {/* Drawdown Architecture Banner */}
            <div className="p-3.5 bg-dark-green-900 text-white rounded-xl text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-sage-200">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Automated Buffer Drawdown Architecture</span>
              </div>
              <p className="text-sage-100/90 leading-relaxed">
                Variable earnings flow directly into an <strong>Income Buffer</strong>. Every fiscal week, Canopy draws down your steady baseline burn rate to fill envelope allocations smoothly.
              </p>
            </div>

            {/* Core Baseline Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="baseline-burn-rate-input"
                  className="text-xs font-bold text-dark-green-900 block"
                >
                  Baseline Weekly Burn Rate ($/wk)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-brown-600 font-bold">$</span>
                  <input
                    type="number"
                    id="baseline-burn-rate-input"
                    min="0"
                    step="50"
                    value={baselineWeeklyBurnRate || ''}
                    onChange={(e) => setBaselineWeeklyBurnRate?.(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="1200"
                    className="w-full pl-7 pr-3 py-1.5 bg-beige-50/50 border border-beige-300 rounded-xl text-dark-green-900 font-bold text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-dark-green-700"
                  />
                </div>
                <span className="text-[10px] text-brown-700">Target weekly spending allocation</span>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="initial-buffer-amount-input"
                  className="text-xs font-bold text-dark-green-900 block"
                >
                  Initial Income Buffer Reserve ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-brown-600 font-bold">$</span>
                  <input
                    type="number"
                    id="initial-buffer-amount-input"
                    min="0"
                    step="100"
                    value={initialBufferAmount || ''}
                    onChange={(e) => setInitialBufferAmount?.(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="5000"
                    className="w-full pl-7 pr-3 py-1.5 bg-beige-50/50 border border-beige-300 rounded-xl text-dark-green-900 font-bold text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-dark-green-700"
                  />
                </div>
                <span className="text-[10px] text-brown-700">Reserve funds on hand to absorb dry weeks</span>
              </div>
            </div>

            {/* 4 Specific Sub-Options Nav */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-dark-green-900">
                  Variable Income Models
                </span>
                <span className="text-[11px] text-brown-700">Select model to configure details</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  id="suboption-context-btn"
                  onClick={() =>
                    setVariableIncomeState?.((prev) => ({ ...prev, activeSubOption: 'context' }))
                  }
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    activeSubOption === 'context'
                      ? 'bg-dark-green-800 text-white border-dark-green-900 shadow-xs'
                      : 'bg-beige-50 border-beige-200 text-dark-green-900 hover:bg-beige-100'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-xs font-bold">1. Context Box</span>
                </button>

                <button
                  type="button"
                  id="suboption-projects-btn"
                  onClick={() =>
                    setVariableIncomeState?.((prev) => ({ ...prev, activeSubOption: 'projects' }))
                  }
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    activeSubOption === 'projects'
                      ? 'bg-dark-green-800 text-white border-dark-green-900 shadow-xs'
                      : 'bg-beige-50 border-beige-200 text-dark-green-900 hover:bg-beige-100'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span className="text-xs font-bold">2. Active Projects</span>
                </button>

                <button
                  type="button"
                  id="suboption-hourly-btn"
                  onClick={() =>
                    setVariableIncomeState?.((prev) => ({ ...prev, activeSubOption: 'hourly' }))
                  }
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    activeSubOption === 'hourly'
                      ? 'bg-dark-green-800 text-white border-dark-green-900 shadow-xs'
                      : 'bg-beige-50 border-beige-200 text-dark-green-900 hover:bg-beige-100'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-bold">3. Hourly Rate</span>
                </button>

                <button
                  type="button"
                  id="suboption-manual-btn"
                  onClick={() =>
                    setVariableIncomeState?.((prev) => ({ ...prev, activeSubOption: 'manual' }))
                  }
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    activeSubOption === 'manual'
                      ? 'bg-dark-green-800 text-white border-dark-green-900 shadow-xs'
                      : 'bg-beige-50 border-beige-200 text-dark-green-900 hover:bg-beige-100'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span className="text-xs font-bold">4. Manual Logging</span>
                </button>
              </div>

              {/* Sub-Option 1: Context Box */}
              {activeSubOption === 'context' && (
                <div className="p-4 bg-beige-50/70 border border-beige-200 rounded-2xl space-y-2 animate-in fade-in">
                  <label
                    htmlFor="scenario-context-textarea"
                    className="text-xs font-bold text-dark-green-900 block"
                  >
                    Describe Your Income Scenario
                  </label>
                  <p className="text-[11px] text-brown-700">
                    Prompt: Detail your household's freelance cadence, seasonal spikes, invoicing terms, or payment volatility so buffer calculations stay aligned.
                  </p>
                  <textarea
                    id="scenario-context-textarea"
                    rows={3}
                    value={variableIncomeState?.scenarioContext || ''}
                    onChange={(e) =>
                      setVariableIncomeState?.((prev) => ({
                        ...prev,
                        scenarioContext: e.target.value,
                      }))
                    }
                    placeholder="e.g., We have a primary design retainer billed on the 1st of every month, plus ad-hoc engineering consulting with net-30 invoicing. Summer months yield 40% higher billings."
                    className="w-full p-3 bg-white border border-beige-300 rounded-xl text-dark-green-900 text-xs focus:outline-none focus:ring-1 focus:ring-dark-green-700 leading-relaxed"
                  />
                </div>
              )}

              {/* Sub-Option 2: Active Project */}
              {activeSubOption === 'projects' && (
                <div className="p-4 bg-beige-50/70 border border-beige-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-dark-green-900 block">
                        Active Contracts & Retainers
                      </span>
                      <p className="text-[11px] text-brown-700">
                        Requires start date, end date, and total scheduled income amount.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddProject((prev) => !prev)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-sage-100 hover:bg-sage-200 text-dark-green-900 text-xs font-bold rounded-lg border border-sage-300 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showAddProject ? 'Cancel' : 'Add Project'}</span>
                    </button>
                  </div>

                  {showAddProject && (
                    <form
                      onSubmit={handleAddActiveProject}
                      className="p-3.5 bg-white border border-beige-300 rounded-xl space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-6 space-y-1">
                          <label className="text-[11px] font-bold text-dark-grey-800 block">
                            Project Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={projName}
                            onChange={(e) => setProjName(e.target.value)}
                            placeholder="e.g. Q3 Design Retainer"
                            className="w-full px-3 py-1.5 border border-beige-300 rounded-lg text-xs font-medium text-dark-green-900 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-6 space-y-1">
                          <label className="text-[11px] font-bold text-dark-grey-800 block">
                            Total Scheduled Income ($) <span className="text-alert-red-600">*</span>
                          </label>
                          <div className="relative">
                            <DollarSign className="w-3.5 h-3.5 text-brown-600 absolute left-2.5 top-2" />
                            <input
                              type="number"
                              required
                              min="1"
                              value={projTotalAmount}
                              onChange={(e) =>
                                setProjTotalAmount(
                                  e.target.value === '' ? '' : parseFloat(e.target.value)
                                )
                              }
                              placeholder="12000"
                              className="w-full pl-7 pr-2.5 py-1.5 border border-beige-300 rounded-lg text-xs font-bold text-dark-green-900 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-6 space-y-1">
                          <label className="text-[11px] font-bold text-dark-grey-800 block">
                            Start Date <span className="text-alert-red-600">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={projStartDate}
                            onChange={(e) => setProjStartDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-beige-300 rounded-lg text-xs text-dark-green-900 focus:outline-none cursor-pointer"
                          />
                        </div>

                        <div className="sm:col-span-6 space-y-1">
                          <label className="text-[11px] font-bold text-dark-grey-800 block">
                            End Date <span className="text-alert-red-600">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={projEndDate}
                            onChange={(e) => setProjEndDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-beige-300 rounded-lg text-xs text-dark-green-900 focus:outline-none cursor-pointer"
                          />
                        </div>

                        <div className="sm:col-span-12 flex justify-end">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                          >
                            Save Active Project
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* List of Active Projects */}
                  {variableIncomeState?.projects && variableIncomeState.projects.length > 0 ? (
                    <div className="space-y-1.5">
                      {variableIncomeState.projects.map((proj) => {
                        const start = new Date(proj.startDate).getTime();
                        const end = new Date(proj.endDate).getTime();
                        const weeks = Math.max(1, Math.round((end - start) / (7 * 24 * 60 * 60 * 1000)));
                        const weeklyProration = proj.totalScheduledIncome / weeks;

                        return (
                          <div
                            key={proj.id}
                            className="p-3 bg-white border border-beige-200 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-dark-green-900">{proj.projectName}</span>
                                <span className="text-[10px] bg-sage-100 text-dark-green-800 px-2 py-0.5 rounded font-semibold">
                                  {weeks} wks duration
                                </span>
                              </div>
                              <span className="text-[11px] text-brown-700 block">
                                {proj.startDate} to {proj.endDate} &bull; Total:{' '}
                                <strong>{formatCurrency(proj.totalScheduledIncome)}</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-[10px] uppercase font-bold text-dark-grey-600 block">
                                  Weekly Equivalent
                                </span>
                                <span className="font-extrabold text-dark-green-900">
                                  {formatCurrency(weeklyProration)}/wk
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveActiveProject(proj.id)}
                                className="text-dark-grey-600 hover:text-alert-red-700 p-1 transition cursor-pointer"
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
                    <p className="text-xs text-brown-700 italic">
                      No active projects added yet. Click &ldquo;Add Project&rdquo; to input client contracts.
                    </p>
                  )}
                </div>
              )}

              {/* Sub-Option 3: Hourly */}
              {activeSubOption === 'hourly' && (
                <div className="p-4 bg-beige-50/70 border border-beige-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div>
                    <span className="text-xs font-bold text-dark-green-900 block">
                      Hourly Pay Normalization
                    </span>
                    <p className="text-[11px] text-brown-700">
                      Constant pay frequency with fluctuating pay amounts based on estimated hours.
                    </p>
                  </div>

                  <form onSubmit={handleSaveHourlyConfig} className="p-3.5 bg-white border border-beige-300 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-[11px] font-bold text-dark-grey-800 block">
                          Earning Member
                        </label>
                        <select
                          value={hourlyMemberId}
                          onChange={(e) => setHourlyMemberId(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-beige-300 rounded-lg text-xs font-medium text-dark-green-900 cursor-pointer"
                        >
                          {members.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-[11px] font-bold text-dark-grey-800 block">
                          Pay Frequency (Cadence)
                        </label>
                        <select
                          value={hourlySchedule}
                          onChange={(e) => setHourlySchedule(e.target.value as PaySchedule)}
                          className="w-full px-2.5 py-1.5 border border-beige-300 rounded-lg text-xs font-medium text-dark-green-900 cursor-pointer"
                        >
                          {SCHEDULE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-bold text-dark-grey-800 block">
                          Rate ($/hr)
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={hourlyRate}
                          onChange={(e) =>
                            setHourlyRate(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full px-2.5 py-1.5 border border-beige-300 rounded-lg text-xs font-bold text-dark-green-900"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-bold text-dark-grey-800 block">
                          Est. Hrs/Wk
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={hourlyHoursPerWeek}
                          onChange={(e) =>
                            setHourlyHoursPerWeek(
                              e.target.value === '' ? '' : parseFloat(e.target.value)
                            )
                          }
                          className="w-full px-2.5 py-1.5 border border-beige-300 rounded-lg text-xs font-bold text-dark-green-900"
                        />
                      </div>

                      <div className="sm:col-span-12 flex items-center justify-between pt-1 border-t border-beige-200">
                        <div className="text-xs text-dark-green-900">
                          Estimated Weekly Baseline:{' '}
                          <strong className="text-sm font-extrabold text-dark-green-950">
                            {formatCurrency(
                              (typeof hourlyRate === 'number' ? hourlyRate : 0) *
                                (typeof hourlyHoursPerWeek === 'number' ? hourlyHoursPerWeek : 0)
                            )}
                            /wk
                          </strong>
                        </div>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                        >
                          Apply Hourly Rate
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* Sub-Option 4: Manual Income Logging (Mirrors Log Expense Modal) */}
              {activeSubOption === 'manual' && (
                <div className="p-4 bg-beige-50/70 border border-beige-200 rounded-2xl space-y-3 animate-in fade-in">
                  <div>
                    <span className="text-xs font-bold text-dark-green-900 block">
                      Manual Income Logging (Expense Mirror)
                    </span>
                    <p className="text-[11px] text-brown-700">
                      Fluctuating frequency and amount. Directly mirrors manual expense logging interface.
                    </p>
                  </div>

                  {/* Form mirroring LogExpenseModal */}
                  <form
                    onSubmit={handleAddManualEntry}
                    className="p-4 bg-white border border-beige-300 rounded-2xl space-y-3 shadow-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {/* Amount Input */}
                      <div className="sm:col-span-6 space-y-1">
                        <label className="text-xs font-bold text-dark-grey-800 block">
                          Deposit Amount ($) <span className="text-alert-red-600">*</span>
                        </label>
                        <div className="relative">
                          <DollarSign className="w-5 h-5 text-dark-green-800 absolute left-3 top-2" />
                          <input
                            type="number"
                            required
                            min="1"
                            step="5"
                            value={manualAmount}
                            onChange={(e) =>
                              setManualAmount(e.target.value === '' ? '' : parseFloat(e.target.value))
                            }
                            placeholder="0.00"
                            className="w-full pl-9 pr-3 py-2 border border-beige-300 rounded-xl text-dark-green-900 font-extrabold text-sm focus:outline-none focus:ring-1 focus:ring-dark-green-700"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div className="sm:col-span-6 space-y-1">
                        <label className="text-xs font-bold text-dark-grey-800 block">
                          Description <span className="text-alert-red-600">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={manualDesc}
                          onChange={(e) => setManualDesc(e.target.value)}
                          placeholder="e.g. Invoice #204 paid by client"
                          className="w-full px-3 py-2 border border-beige-300 rounded-xl text-dark-green-900 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-dark-green-700"
                        />
                      </div>

                      {/* Category Envelope (Preset to Income Buffer) */}
                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-xs font-bold text-dark-grey-800 block">
                          Destination Envelope
                        </label>
                        <div className="px-3 py-2 bg-sage-50 border border-sage-200 rounded-xl flex items-center gap-2 text-xs font-bold text-dark-green-900">
                          <Shield className="w-4 h-4 text-dark-green-800 shrink-0" />
                          <span>Income Buffer (Holding Tank)</span>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-xs font-bold text-dark-grey-800 block">
                          Date Received
                        </label>
                        <input
                          type="date"
                          value={manualDate}
                          onChange={(e) => setManualDate(e.target.value)}
                          className="w-full px-3 py-2 border border-beige-300 rounded-xl text-dark-green-900 text-xs focus:outline-none focus:ring-1 focus:ring-dark-green-700 cursor-pointer"
                        />
                      </div>

                      {/* Received By */}
                      <div className="sm:col-span-4 space-y-1">
                        <label className="text-xs font-bold text-dark-grey-800 block">
                          Received By
                        </label>
                        <select
                          value={manualMemberId}
                          onChange={(e) => setManualMemberId(e.target.value)}
                          className="w-full px-3 py-2 border border-beige-300 rounded-xl text-dark-green-900 text-xs focus:outline-none focus:ring-1 focus:ring-dark-green-700 cursor-pointer"
                        >
                          {members.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Action Button */}
                      <div className="sm:col-span-12 flex justify-end pt-1">
                        <button
                          type="submit"
                          className="px-5 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Log Income to Buffer</span>
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* List of Manual Entries */}
                  {variableIncomeState?.manualEntries && variableIncomeState.manualEntries.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {variableIncomeState.manualEntries.map((ent) => (
                        <div
                          key={ent.id}
                          className="p-2.5 bg-white border border-beige-200 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-dark-green-900">{ent.description}</span>
                            <span className="text-[10px] text-brown-700 bg-beige-100 px-2 py-0.5 rounded">
                              {ent.date}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-dark-green-900">
                              +{formatCurrency(ent.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveManualEntry(ent.id, ent.amount)}
                              className="text-dark-grey-600 hover:text-alert-red-700 p-1 transition cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Unified Weekly Pool Callout Card */}
      <div className="p-4 sm:p-5 bg-sage-100/90 border border-sage-300 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-dark-green-800 text-white rounded-xl shadow-sm">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-dark-green-800">
              Total Household Budget Pool
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-dark-green-900">
              {formatCurrency(totalWeeklyPool)}
              <span className="text-sm font-medium text-brown-700 ml-1.5">/ week</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-dark-green-900 bg-white/80 border border-sage-200 px-3.5 py-2 rounded-xl text-center sm:text-right">
          <p className="font-semibold">Normalized Baseline</p>
          <p className="text-dark-grey-600">
            {formatCurrency((totalWeeklyPool * 52) / 12)} / month equivalent
          </p>
        </div>
      </div>

      {/* Member Roster Income Cards */}
      <div className="space-y-4">
        {members.map((member, idx) => {
          const isOwner = idx === 0;
          const isMissingDate = missingDateMemberIds.includes(member.userId);

          return (
            <div
              key={member.userId}
              className={`p-4 sm:p-5 bg-white border rounded-2xl space-y-4 shadow-sm transition ${
                isMissingDate
                  ? 'border-alert-red-400 ring-2 ring-alert-red-400/20'
                  : 'border-beige-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-beige-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-sage-300"
                    />
                    {isOwner && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-dark-green-800 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                        ★
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      id={`member-name-input-${member.userId}`}
                      value={member.name}
                      onChange={(e) => handleNameChange(member.userId, e.target.value)}
                      placeholder="Member Name"
                      className="font-bold text-dark-green-900 text-base bg-transparent border-b border-transparent hover:border-beige-300 focus:border-dark-green-700 focus:outline-none px-1"
                    />
                    <p className="text-xs text-dark-grey-600 px-1">
                      {isOwner ? 'Primary Account Creator' : `Household Member #${idx + 1}`}
                    </p>
                  </div>
                </div>

                {!isOwner && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-brown-800 bg-beige-50 px-3 py-1.5 rounded-lg border border-beige-200 hover:bg-beige-100">
                    <input
                      type="checkbox"
                      id={`toggle-self-input-${member.userId}`}
                      checked={!member.hasProvidedIncome}
                      onChange={(e) => handleToggleSelfInput(member.userId, e.target.checked)}
                      className="rounded border-beige-300 text-dark-green-700 focus:ring-dark-green-600 h-4 w-4"
                    />
                    <span>They will input their own income when they sign in</span>
                  </label>
                )}
              </div>

              {member.hasProvidedIncome ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                  {/* Income Amount */}
                  <div className="sm:col-span-4 space-y-1">
                    <label
                      htmlFor={`income-amount-${member.userId}`}
                      className="text-xs font-semibold text-dark-grey-800 block"
                    >
                      Take-Home Paycheck ($)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-grey-600">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <input
                        type="number"
                        id={`income-amount-${member.userId}`}
                        min="0"
                        step="50"
                        value={member.rawIncome || ''}
                        onChange={(e) => handleIncomeChange(member.userId, parseFloat(e.target.value))}
                        placeholder="e.g. 2500"
                        className="w-full pl-9 pr-3 py-2.5 bg-beige-50/50 border border-beige-300 rounded-xl text-dark-green-900 font-semibold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-dark-green-700/20 focus:border-dark-green-700"
                      />
                    </div>
                  </div>

                  {/* Pay Frequency */}
                  <div className="sm:col-span-4 space-y-1">
                    <label
                      htmlFor={`pay-schedule-${member.userId}`}
                      className="text-xs font-semibold text-dark-grey-800 block"
                    >
                      Pay Frequency
                    </label>
                    <select
                      id={`pay-schedule-${member.userId}`}
                      value={member.incomeSchedule}
                      onChange={(e) =>
                        handleScheduleChange(member.userId, e.target.value as PaySchedule)
                      }
                      className="w-full px-3 py-2.5 bg-beige-50/50 border border-beige-300 rounded-xl text-dark-green-900 font-medium text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-dark-green-700/20 focus:border-dark-green-700 cursor-pointer"
                    >
                      {SCHEDULE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Strictly Required Date of Last Paycheck */}
                  <div className="sm:col-span-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={`last-pay-date-${member.userId}`}
                        className={`text-xs font-bold block ${
                          isMissingDate ? 'text-alert-red-700' : 'text-dark-grey-800'
                        }`}
                      >
                        Date of Last Paycheck <span className="text-alert-red-600">*</span>
                      </label>
                      {isMissingDate && (
                        <span className="text-[10px] text-alert-red-600 font-semibold">Strictly required</span>
                      )}
                    </div>
                    <input
                      type="date"
                      required
                      id={`last-pay-date-${member.userId}`}
                      value={member.lastPayDate || ''}
                      onChange={(e) => handleLastPayDateChange(member.userId, e.target.value)}
                      className={`w-full px-3 py-2.5 bg-beige-50/50 border rounded-xl text-dark-green-900 font-medium text-sm focus:bg-white focus:outline-none focus:ring-2 cursor-pointer transition ${
                        isMissingDate
                          ? 'border-alert-red-500 ring-2 ring-alert-red-500/20 focus:border-alert-red-600'
                          : 'border-beige-300 focus:ring-dark-green-700/20 focus:border-dark-green-700'
                      }`}
                    />
                  </div>

                  {/* Normalized Result Banner */}
                  <div className="sm:col-span-12 pt-1">
                    <div className="p-2.5 rounded-xl bg-sage-50 border border-sage-200 flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-sage-800">
                        Weekly Normalized Income:
                      </span>
                      <span className="text-sm sm:text-base font-extrabold text-dark-green-900">
                        {formatCurrency(member.normalizedWeeklyIncome)}
                        <span className="text-xs font-normal text-brown-700 ml-1">/ week</span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-beige-50 border border-dashed border-beige-300 rounded-xl text-xs text-brown-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-sage-600 flex-shrink-0" />
                  <span>
                    Income will be marked as <strong>Pending</strong> until {member.name} joins with the sync code and inputs their details.
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Actions */}
      <div className="pt-4 flex items-center justify-between">
        <button
          type="button"
          id="income-step-back-btn"
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 border border-beige-300 hover:bg-beige-100 text-dark-green-900 font-semibold text-sm rounded-xl transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          id="income-step-next-btn"
          onClick={handleNextClick}
          className="flex items-center gap-2 px-6 py-3 bg-dark-green-800 hover:bg-dark-green-900 text-white font-semibold text-sm rounded-xl transition shadow-sm cursor-pointer"
        >
          <span>Continue to Calendar</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
