import React from 'react';
import { AccountType } from '../../types';
import { User, Users2, Home, UserCheck, Plus, Minus, ArrowRight } from 'lucide-react';

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
];

export const AccountTypeStep: React.FC<AccountTypeStepProps> = ({
  accountType,
  setAccountType,
  roommateCount,
  setRoommateCount,
  onNext,
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-2xl font-bold text-dark-green-900">How is your household organized?</h2>
        <p className="text-sm text-brown-700">
          Choose the setup that best describes your living and budgeting arrangement.
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
    </div>
  );
};
