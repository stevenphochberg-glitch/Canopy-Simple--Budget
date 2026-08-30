import React, { useState, useEffect } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { AccountType, CalendarMode, DayOfWeek, HouseholdMember, OnboardingData } from '../../types';
import { AccountTypeStep } from './AccountTypeStep';
import { IncomeStep } from './IncomeStep';
import { CalendarStep } from './CalendarStep';
import { SyncCodeStep } from './SyncCodeStep';
import { normalizeToWeekly } from '../../lib/calculations';

const AVATAR_SEEDS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
];

export const SetupWizard: React.FC = () => {
  const { user, completeOnboarding } = useHousehold();
  const [step, setStep] = useState<number>(1);
  const [accountType, setAccountType] = useState<AccountType>('couple');
  const [roommateCount, setRoommateCount] = useState<number>(3);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('weekly');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<DayOfWeek>('Monday');

  const [members, setMembers] = useState<HouseholdMember[]>([]);

  // Initialize members based on selected account type
  useEffect(() => {
    if (!user) return;

    let initialCount = 1;
    if (accountType === 'couple') initialCount = 2;
    else if (accountType === 'family') initialCount = 3;
    else if (accountType === 'roommate') initialCount = roommateCount;

    setMembers((prevMembers) => {
      // First member is always current user
      const list: HouseholdMember[] = [
        {
          userId: user.userId,
          name: user.name || 'You',
          avatarUrl: user.avatarUrl || AVATAR_SEEDS[0],
          rawIncome: prevMembers[0]?.rawIncome || 2400,
          incomeSchedule: prevMembers[0]?.incomeSchedule || 'bi-weekly',
          normalizedWeeklyIncome: prevMembers[0]?.normalizedWeeklyIncome || normalizeToWeekly(2400, 'bi-weekly'),
          hasProvidedIncome: true,
          isCurrentUser: true,
        },
      ];

      for (let i = 1; i < initialCount; i++) {
        const defaultNames = ['Partner', 'Roommate 1', 'Roommate 2', 'Family Member'];
        const name = defaultNames[i - 1] || `Member ${i + 1}`;
        const existing = prevMembers[i];

        list.push({
          userId: existing?.userId || `member_${Date.now()}_${i}`,
          name: existing?.name || name,
          avatarUrl: existing?.avatarUrl || AVATAR_SEEDS[i % AVATAR_SEEDS.length],
          rawIncome: existing ? existing.rawIncome : (accountType === 'couple' ? 4500 : 1800),
          incomeSchedule: existing ? existing.incomeSchedule : (accountType === 'couple' ? 'monthly' : 'bi-weekly'),
          normalizedWeeklyIncome: existing
            ? existing.normalizedWeeklyIncome
            : normalizeToWeekly(accountType === 'couple' ? 4500 : 1800, accountType === 'couple' ? 'monthly' : 'bi-weekly'),
          hasProvidedIncome: existing ? existing.hasProvidedIncome : true,
          isCurrentUser: false,
        });
      }

      return list;
    });
  }, [accountType, roommateCount, user]);

  const onboardingData: OnboardingData = {
    accountType,
    roommateCount,
    members,
    calendarMode,
    firstDayOfWeek,
  };

  const stepsList = [
    { num: 1, title: 'Household Type' },
    { num: 2, title: 'Income Normalization' },
    { num: 3, title: 'Calendar & Check-in' },
    { num: 4, title: 'Sync Code' },
  ];

  return (
    <div className="min-h-screen bg-beige-50 flex flex-col justify-between selection:bg-sage-200">
      {/* Top Header */}
      <header className="px-6 py-4 max-w-4xl mx-auto w-full flex items-center justify-between border-b border-beige-200/70">
        <div className="flex items-center gap-3">
          <img src="/logo.jpeg" alt="Canopy Logo" className="w-8 h-8 rounded-lg object-cover border border-beige-300" />
          <span className="text-lg font-bold text-dark-green-900 font-sans">Canopy Setup</span>
        </div>
        <div className="text-xs font-semibold text-brown-700 bg-beige-100 px-3 py-1 rounded-full">
          Step {step} of 4
        </div>
      </header>

      {/* Progress Bar & Indicators */}
      <div className="max-w-4xl mx-auto w-full px-6 pt-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          {stepsList.map((s) => (
            <div key={s.num} className="flex-1 flex flex-col items-center sm:items-start">
              <div
                className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                  s.num <= step ? 'bg-dark-green-800' : 'bg-beige-200'
                }`}
              />
              <span
                className={`text-[11px] font-medium mt-1.5 hidden sm:block ${
                  s.num === step
                    ? 'text-dark-green-900 font-bold'
                    : s.num < step
                    ? 'text-sage-700'
                    : 'text-dark-grey-600'
                }`}
              >
                {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Wizard Content Card */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-6 flex flex-col justify-center">
        <div className="bg-white/90 backdrop-blur-sm border border-beige-200/90 rounded-2xl p-6 sm:p-8 shadow-sm">
          {step === 1 && (
            <AccountTypeStep
              accountType={accountType}
              setAccountType={setAccountType}
              roommateCount={roommateCount}
              setRoommateCount={setRoommateCount}
              onNext={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <IncomeStep
              members={members}
              setMembers={setMembers}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <CalendarStep
              calendarMode={calendarMode}
              setCalendarMode={setCalendarMode}
              firstDayOfWeek={firstDayOfWeek}
              setFirstDayOfWeek={setFirstDayOfWeek}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && (
            <SyncCodeStep
              data={onboardingData}
              onComplete={completeOnboarding}
              onBack={() => setStep(3)}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-dark-grey-600 max-w-4xl mx-auto w-full border-t border-beige-200/60">
        <p>Canopy &bull; Household Setup Wizard &bull; Steve's Home Ec LLC</p>
      </footer>
    </div>
  );
};
