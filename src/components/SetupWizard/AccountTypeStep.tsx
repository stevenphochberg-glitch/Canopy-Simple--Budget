import React, { useState } from 'react';
import { AccountType, Household, HouseholdMember, PaySchedule } from '../../types';
import {
  User,
  Users2,
  Home,
  UserCheck,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Loader2,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Calendar,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';
import { normalizeToWeekly, formatCurrency } from '../../lib/calculations';

interface AccountTypeStepProps {
  accountType: AccountType;
  setAccountType: (type: AccountType) => void;
  roommateCount: number;
  setRoommateCount: (count: number) => void;
  onNext: () => void;
}

const ACCOUNT_TYPES: Array<{
  type: AccountType;
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  defaultMembers: number;
}> = [
  {
    type: 'single',
    title: 'Single Person',
    description: 'Personal budgeting with personal weekly check-ins and clean discipline.',
    icon: User,
    defaultMembers: 1,
  },
  {
    type: 'couple',
    title: 'Couple',
    description: 'Shared household finances for partners living together or splitting expenses.',
    icon: Users2,
    defaultMembers: 2,
  },
  {
    type: 'family',
    title: 'Family',
    description: 'Unified family budget with multiple earners and combined expenses.',
    icon: Home,
    defaultMembers: 3,
  },
  {
    type: 'roommate',
    title: 'Roommates',
    description: 'Shared rent, utilities, and common groceries with custom roommate counts.',
    icon: UserCheck,
    defaultMembers: 3,
  },
  {
    type: 'join',
    title: 'Join Existing Household',
    description: 'Connect with your partner or roommates using their 6-character Sync Code.',
    icon: KeyRound,
    defaultMembers: 1,
  },
];

const PAY_SCHEDULE_OPTIONS: Array<{ value: PaySchedule; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Bi-Weekly (Every 2 weeks)' },
  { value: 'semi-monthly', label: 'Semi-Monthly (Twice a month)' },
  { value: 'monthly', label: 'Monthly' },
];

export const AccountTypeStep: React.FC<AccountTypeStepProps> = ({
  accountType,
  setAccountType,
  roommateCount,
  setRoommateCount,
  onNext,
}) => {
  const { joinHouseholdWithSyncCode, getHouseholdBySyncCode, user } = useHousehold();
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Multi-step Join Workflow States
  const [joinPhase, setJoinPhase] = useState<'code' | 'select_profile' | 'confirm_income'>('code');
  const [foundHousehold, setFoundHousehold] = useState<Household | null>(null);
  const [foundMembers, setFoundMembers] = useState<HouseholdMember[]>([]);
  const [selectedPlaceholderId, setSelectedPlaceholderId] = useState<string | null>(null);

  // Income & Frequency Confirmation inputs
  const [confirmedName, setConfirmedName] = useState<string>('');
  const [confirmedIncome, setConfirmedIncome] = useState<number>(2400);
  const [confirmedSchedule, setConfirmedSchedule] = useState<PaySchedule>('bi-weekly');

  const handleLookupHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncCodeInput.trim()) {
      setJoinError('Please enter your 6-character Household Sync Code.');
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    try {
      // Actively query the household document and members subcollection
      const result = await getHouseholdBySyncCode(syncCodeInput.trim());
      if (!result) {
        setJoinError(`No household found with sync code "${syncCodeInput.trim()}". Please verify and try again.`);
        return;
      }

      setFoundHousehold(result.household);
      setFoundMembers(result.members);

      // Identify existing placeholder profiles
      const placeholders = (result.members || []).filter((m) => m.isPlaceholder);

      if (placeholders.length > 0) {
        // Default to first placeholder profile
        setSelectedPlaceholderId(placeholders[0].userId);
        setConfirmedName(user?.name || placeholders[0].name || 'You');
        setConfirmedIncome(placeholders[0].rawIncome || 2400);
        setConfirmedSchedule(placeholders[0].incomeSchedule || 'bi-weekly');
        setJoinPhase('select_profile');
      } else {
        // No placeholders, proceed directly to confirm income as new member
        setSelectedPlaceholderId(null);
        setConfirmedName(user?.name || 'You');
        setConfirmedIncome(2400);
        setConfirmedSchedule('bi-weekly');
        setJoinPhase('confirm_income');
      }
    } catch (err: any) {
      setJoinError(err.message || 'Error querying household members.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSelectPlaceholderAndProceed = (placeholderId: string | null) => {
    setSelectedPlaceholderId(placeholderId);
    if (placeholderId) {
      const match = foundMembers.find((m) => m.userId === placeholderId);
      if (match) {
        setConfirmedName(user?.name || match.name || 'You');
        setConfirmedIncome(match.rawIncome || 2400);
        setConfirmedSchedule(match.incomeSchedule || 'bi-weekly');
      }
    } else {
      setConfirmedName(user?.name || 'You');
    }
    setJoinPhase('confirm_income');
  };

  const handleFinalConfirmJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmedIncome < 0 || isNaN(confirmedIncome)) {
      setJoinError('Please enter a valid non-negative income amount.');
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    try {
      const normalized = normalizeToWeekly(confirmedIncome, confirmedSchedule);
      const res = await joinHouseholdWithSyncCode(
        syncCodeInput.trim(),
        selectedPlaceholderId || undefined,
        {
          name: confirmedName.trim() || user?.name || 'You',
          rawIncome: confirmedIncome,
          incomeSchedule: confirmedSchedule,
          normalizedWeeklyIncome: normalized,
        }
      );

      if (!res.success) {
        setJoinError(res.message || 'Failed to complete household join.');
      }
      // If successful, joinHouseholdWithSyncCode routes user to main dashboard automatically
    } catch (err: any) {
      setJoinError(err.message || 'Error joining household.');
    } finally {
      setIsJoining(false);
    }
  };

  const placeholderMembers = foundMembers.filter((m) => m.isPlaceholder);
  const normalizedPreview = normalizeToWeekly(confirmedIncome, confirmedSchedule);

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-2xl font-bold text-dark-green-900">How is your household organized?</h2>
        <p className="text-sm text-brown-700">
          Canopy normalizes disparate income cadences into a predictable weekly pool.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {ACCOUNT_TYPES.map((item) => {
          const Icon = item.icon;
          const isSelected = accountType === item.type;
          return (
            <button
              key={item.type}
              type="button"
              id={`account-type-${item.type}`}
              onClick={() => {
                setAccountType(item.type);
                if (item.type !== 'join') {
                  setJoinPhase('code');
                  setJoinError(null);
                }
              }}
              className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 cursor-pointer ${
                isSelected
                  ? 'bg-sage-100/60 border-dark-green-800 shadow-sm ring-1 ring-dark-green-800'
                  : 'bg-white border-beige-300 hover:border-beige-400 hover:bg-beige-50/50'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl flex-shrink-0 ${
                  isSelected ? 'bg-dark-green-800 text-white' : 'bg-beige-200 text-dark-green-900'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-dark-green-900 text-base">{item.title}</h3>
                <p className="text-xs text-dark-grey-600 mt-1 leading-relaxed">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Join Household Form with 3-Step Placeholder Workflow */}
      {accountType === 'join' && (
        <div className="space-y-4">
          {/* Phase 1: Sync Code Query */}
          {joinPhase === 'code' && (
            <form
              onSubmit={handleLookupHousehold}
              className="p-5 bg-white border border-sage-300 rounded-2xl shadow-xs space-y-4 animate-in fade-in"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sage-100 border border-sage-300 flex items-center justify-center text-dark-green-900 flex-shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-dark-green-900">
                    Enter 6-Character Sync Code
                  </h4>
                  <p className="text-xs text-brown-700">
                    Ask your household member for the Sync Code in their Canopy account dropdown.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    id="join-sync-code-input"
                    type="text"
                    maxLength={10}
                    required
                    placeholder="e.g. CNP-8X2"
                    value={syncCodeInput}
                    onChange={(e) => setSyncCodeInput(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-beige-50 border border-beige-300 rounded-xl font-mono text-base font-black tracking-widest text-dark-green-950 placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-dark-grey-600 focus:outline-none focus:border-dark-green-800 focus:bg-white uppercase"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isJoining || !syncCodeInput.trim()}
                  className="px-6 py-3 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking Members...</span>
                    </>
                  ) : (
                    <>
                      <span>Find Household</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {joinError && (
                <div className="flex items-center gap-2 p-3 bg-alert-red-50 border border-alert-red-200 rounded-xl text-xs font-semibold text-alert-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}
            </form>
          )}

          {/* Phase 2: Placeholder Profile Selection */}
          {joinPhase === 'select_profile' && foundHousehold && (
            <div className="p-5 bg-white border border-sage-300 rounded-2xl shadow-xs space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-beige-200 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 bg-sage-100 px-2.5 py-0.5 rounded-full">
                    Household Found
                  </span>
                  <h4 className="text-base font-extrabold text-dark-green-900 mt-1">
                    {foundHousehold.name}
                  </h4>
                  <p className="text-xs text-brown-700">
                    Sync Code: <span className="font-mono font-bold text-dark-green-800">{foundHousehold.syncCode}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setJoinPhase('code')}
                  className="text-xs text-brown-700 hover:text-dark-green-900 flex items-center gap-1 font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change Code
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-dark-green-900 block">
                  Select Your Profile Slot
                </label>
                <p className="text-xs text-brown-700">
                  We found placeholder profiles created by your household administrator. Select yours to claim it:
                </p>

                <div className="space-y-2 pt-1">
                  {placeholderMembers.map((member) => {
                    const isSelected = selectedPlaceholderId === member.userId;
                    return (
                      <div
                        key={member.userId}
                        onClick={() => setSelectedPlaceholderId(member.userId)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-sage-100/70 border-dark-green-800 shadow-xs ring-1 ring-dark-green-800'
                            : 'bg-beige-50 border-beige-300 hover:border-sage-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-sage-200 text-dark-green-900 font-bold text-xs flex items-center justify-center border border-sage-300">
                            {member.avatar || member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-dark-green-900">{member.name}</span>
                              <span className="text-[10px] font-semibold bg-beige-200 text-brown-800 px-2 py-0.5 rounded-md">
                                Unclaimed Slot
                              </span>
                            </div>
                            <span className="text-xs text-dark-grey-600 block">
                              Tentative income: {formatCurrency(member.rawIncome || 0)} ({member.incomeSchedule || 'bi-weekly'})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'bg-dark-green-800 border-dark-green-800 text-white'
                                : 'border-beige-400 bg-white'
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Option to join as new member instead */}
                  <div
                    onClick={() => setSelectedPlaceholderId(null)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      selectedPlaceholderId === null
                        ? 'bg-sage-100/70 border-dark-green-800 shadow-xs ring-1 ring-dark-green-800'
                        : 'bg-beige-50 border-beige-300 hover:border-sage-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-beige-200 text-dark-green-900 font-bold text-xs flex items-center justify-center border border-beige-300">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-dark-green-900 block">
                          Join as New Household Member
                        </span>
                        <span className="text-xs text-dark-grey-600">
                          Create an additional profile slot in this household
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          selectedPlaceholderId === null
                            ? 'bg-dark-green-800 border-dark-green-800 text-white'
                            : 'border-beige-400 bg-white'
                        }`}
                      >
                        {selectedPlaceholderId === null && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSelectPlaceholderAndProceed(selectedPlaceholderId)}
                  className="px-6 py-3 bg-dark-green-800 hover:bg-dark-green-900 text-white font-bold text-sm rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>Continue to Income & Pay Frequency</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Phase 3: Explicit Income & Pay Frequency Confirmation */}
          {joinPhase === 'confirm_income' && (
            <form
              onSubmit={handleFinalConfirmJoin}
              className="p-5 bg-white border border-sage-300 rounded-2xl shadow-xs space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between border-b border-beige-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sage-100 flex items-center justify-center text-dark-green-900">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-dark-green-900">
                      Confirm Your Income & Frequency
                    </h4>
                    <p className="text-xs text-brown-700">
                      Required to accurately calculate your weekly household spending pool.
                    </p>
                  </div>
                </div>

                {placeholderMembers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setJoinPhase('select_profile')}
                    className="text-xs text-brown-700 hover:text-dark-green-900 flex items-center gap-1 font-semibold"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
              </div>

              <div className="space-y-3.5">
                {/* Your Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-dark-green-900 block">
                    Your Name in Household
                  </label>
                  <input
                    type="text"
                    required
                    value={confirmedName}
                    onChange={(e) => setConfirmedName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full px-3.5 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-sm font-bold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Income Amount */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-sage-700" />
                      Take-Home Pay Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm font-bold text-dark-green-900">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={confirmedIncome}
                        onChange={(e) => setConfirmedIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="2400"
                        className="w-full pl-7 pr-3 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-sm font-extrabold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                      />
                    </div>
                  </div>

                  {/* Pay Frequency */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-dark-green-900 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-sage-700" />
                      Pay Frequency
                    </label>
                    <select
                      value={confirmedSchedule}
                      onChange={(e) => setConfirmedSchedule(e.target.value as PaySchedule)}
                      className="w-full px-3 py-2.5 bg-beige-50 border border-beige-300 rounded-xl text-xs sm:text-sm font-semibold text-dark-green-900 focus:outline-none focus:border-dark-green-800"
                    >
                      {PAY_SCHEDULE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Normalized Income Preview Banner */}
                <div className="p-3 bg-sage-50 border border-sage-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sage-700" />
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sage-800 block">
                        Normalized Weekly Contribution
                      </span>
                      <span className="text-xs text-dark-grey-600">
                        Based on {confirmedSchedule} schedule
                      </span>
                    </div>
                  </div>
                  <span className="text-base font-black text-dark-green-900">
                    {formatCurrency(normalizedPreview)}/wk
                  </span>
                </div>
              </div>

              {joinError && (
                <div className="flex items-center gap-2 p-3 bg-alert-red-50 border border-alert-red-200 rounded-xl text-xs font-semibold text-alert-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isJoining}
                  className="w-full sm:w-auto px-6 py-3 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Joining Dashboard...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Enter Dashboard</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Dynamic Roommate Input */}
      {accountType === 'roommate' && (
        <div className="p-4 bg-sage-50/80 border border-sage-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label htmlFor="roommate-counter" className="text-sm font-semibold text-dark-green-900">
                Number of Roommates
              </label>
              <p className="text-xs text-brown-700">
                Including yourself in the shared household.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white border border-beige-200 rounded-lg p-1 shadow-sm">
              <button
                type="button"
                id="decrement-roommates-btn"
                onClick={() => setRoommateCount(Math.max(2, roommateCount - 1))}
                disabled={roommateCount <= 2}
                className="w-8 h-8 flex items-center justify-center rounded bg-beige-100 hover:bg-beige-200 text-dark-green-900 disabled:opacity-40 cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                id="roommate-counter"
                type="number"
                min="2"
                max="12"
                value={roommateCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 2 && val <= 12) {
                    setRoommateCount(val);
                  }
                }}
                className="w-12 text-center font-bold text-dark-green-900 text-base focus:outline-none"
              />
              <button
                type="button"
                id="increment-roommates-btn"
                onClick={() => setRoommateCount(Math.min(12, roommateCount + 1))}
                disabled={roommateCount >= 12}
                className="w-8 h-8 flex items-center justify-center rounded bg-beige-100 hover:bg-beige-200 text-dark-green-900 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-xs text-dark-green-800 bg-white/70 px-3 py-1.5 rounded-md border border-sage-200/60">
            Household roster will automatically configure {roommateCount} distinct member slots.
          </div>
        </div>
      )}

      {accountType !== 'join' && (
        <div className="pt-4 flex justify-end">
          <button
            type="button"
            id="account-step-next-btn"
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-3 bg-dark-green-800 hover:bg-dark-green-900 text-white font-semibold text-sm rounded-xl transition shadow-sm cursor-pointer"
          >
            <span>Continue to Income Setup</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
