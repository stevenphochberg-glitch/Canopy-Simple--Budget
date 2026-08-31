import React, { useState } from 'react';
import { AccountType } from '../../types';
import { User, Users2, Home, UserCheck, Plus, Minus, ArrowRight, KeyRound, Loader2, AlertCircle } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';

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

export const AccountTypeStep: React.FC<AccountTypeStepProps> = ({
  accountType,
  setAccountType,
  roommateCount,
  setRoommateCount,
  onNext,
}) => {
  const { joinHouseholdWithSyncCode } = useHousehold();
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoinHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncCodeInput.trim()) {
      setJoinError('Please enter your 6-character Household Sync Code.');
      return;
    }

    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await joinHouseholdWithSyncCode(syncCodeInput.trim());
      if (!res.success) {
        setJoinError(res.message || 'Household not found. Please verify the sync code.');
      }
    } catch (err: any) {
      setJoinError(err.message || 'Error joining household.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-2xl font-bold text-dark-green-900">How is your household organized?</h2>
        <p className="text-sm text-brown-700">
          Choose to create a new budget structure or join an existing household via sync code.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {ACCOUNT_TYPES.map((item) => {
          const isSelected = accountType === item.type;
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              id={`account-type-${item.type}`}
              onClick={() => {
                setAccountType(item.type);
                setJoinError(null);
                if (item.type === 'roommate' && roommateCount < 2) {
                  setRoommateCount(3);
                }
              }}
              className={`p-4 rounded-xl border text-left transition relative cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-sage-50 border-dark-green-700 ring-2 ring-dark-green-700/20 shadow-sm'
                  : 'bg-white border-beige-200 hover:border-sage-300 hover:bg-beige-50/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`p-2 rounded-lg ${
                      isSelected
                        ? 'bg-dark-green-800 text-white'
                        : 'bg-beige-100 text-dark-green-800'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  {isSelected && (
                    <span className="text-[11px] font-semibold bg-dark-green-800 text-white px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-dark-green-900 text-base">{item.title}</h3>
                <p className="text-xs text-dark-grey-600 mt-1 leading-relaxed">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dynamic Join Household Form */}
      {accountType === 'join' && (
        <form
          onSubmit={handleJoinHousehold}
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
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Join Household</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {joinError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{joinError}</span>
            </div>
          )}
        </form>
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
