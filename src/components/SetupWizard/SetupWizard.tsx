import React, { useState, useEffect } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { AccountType, CalendarMode, DayOfWeek, HouseholdMember, OnboardingData, Category, IncomeType, VariableIncomeState, OneOffDeposit } from '../../types';
import { AccountTypeStep } from './AccountTypeStep';
import { IncomeStep } from './IncomeStep';
import { CalendarStep } from './CalendarStep';
import { AllocationStep } from './AllocationStep';
import { SyncCodeStep } from './SyncCodeStep';
import { normalizeToWeekly, generateSyncCode, calculateWeeklyPool, getDefaultCategories } from '../../lib/calculations';
import { generateFacelessVectorAvatar } from '../../lib/avatars';

export const SetupWizard: React.FC = () => {
  const { user, household, completeOnboarding } = useHousehold();
  const [step, setStep] = useState<number>(1);
  const [accountType, setAccountType] = useState<AccountType>('couple');
  const [incomeType, setIncomeType] = useState<IncomeType>('predictable');
  const [baselineWeeklyBurnRate, setBaselineWeeklyBurnRate] = useState<number>(0);
  const [initialBufferAmount, setInitialBufferAmount] = useState<number>(0);
  const [variableIncomeState, setVariableIncomeState] = useState<VariableIncomeState>({
    activeSubOption: 'context',
    scenarioContext: '',
    projects: [],
    hourlyConfigs: [],
    manualEntries: [],
  });
  const [oneOffDeposits, setOneOffDeposits] = useState<OneOffDeposit[]>([]);
  const [roommateCount, setRoommateCount] = useState<number>(3);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('weekly');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<DayOfWeek>('Monday');
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState<number>(12);
  const [syncCode] = useState<string>(() => household?.syncCode || generateSyncCode());

  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Initialize members based on selected account type using faceless vector avatars for placeholders
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
          avatarUrl: user.avatarUrl || generateFacelessVectorAvatar(0),
          rawIncome: prevMembers[0]?.rawIncome || 2400,
          incomeSchedule: prevMembers[0]?.incomeSchedule || 'bi-weekly',
          normalizedWeeklyIncome: prevMembers[0]?.normalizedWeeklyIncome || normalizeToWeekly(2400, 'bi-weekly'),
          hasProvidedIncome: true,
          isCurrentUser: true,
          isPlaceholder: false,
        },
      ];

      for (let i = 1; i < initialCount; i++) {
        const defaultNames = ['Partner', 'Roommate 1', 'Roommate 2', 'Family Member'];
        const name = defaultNames[i - 1] || `Member ${i + 1}`;
        const existing = prevMembers[i];

        list.push({
          userId: existing?.userId || `placeholder_${Date.now()}_${i}`,
          name: existing?.name || name,
          avatarUrl: existing?.avatarUrl || generateFacelessVectorAvatar(i),
          rawIncome: existing ? existing.rawIncome : (accountType === 'couple' ? 4500 : 1800),
          incomeSchedule: existing ? existing.incomeSchedule : (accountType === 'couple' ? 'monthly' : 'bi-weekly'),
          normalizedWeeklyIncome: existing
            ? existing.normalizedWeeklyIncome
            : normalizeToWeekly(accountType === 'couple' ? 4500 : 1800, accountType === 'couple' ? 'monthly' : 'bi-weekly'),
          hasProvidedIncome: existing ? existing.hasProvidedIncome : true,
          isCurrentUser: false,
          isPlaceholder: true,
        });
      }

      return list;
    });
  }, [accountType, roommateCount, user]);

  const weeklyIncomePool = calculateWeeklyPool(members);

  // Initialize or re-scale categories when weekly pool is established
  useEffect(() => {
    if (weeklyIncomePool > 0) {
      setCategories((prev) => {
        if (prev.length === 0) {
          return getDefaultCategories(weeklyIncomePool, incomeType, initialBufferAmount);
        }
        return prev;
      });
    }
  }, [weeklyIncomePool, incomeType, initialBufferAmount]);

  const onboardingData: OnboardingData = {
    accountType,
    incomeType,
    baselineWeeklyBurnRate,
    initialBufferAmount,
    variableIncomeState,
    oneOffDeposits,
    roommateCount,
    members,
    categories,
    calendarMode,
    firstDayOfWeek,
    fiscalYearEndMonth,
    syncCode,
  };

  const stepsList = [
    { num: 1, title: 'Household Type' },
    { num: 2, title: 'Income Normalization' },
    { num: 3, title: 'Calendar & Check-in' },
    { num: 4, title: 'Budget Allocation' },
    { num: 5, title: 'Sync Code' },
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
          Step {step} of 5
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
              fiscalYearEndMonth={fiscalYearEndMonth}
              setFiscalYearEndMonth={setFiscalYearEndMonth}
              incomeType={incomeType}
              setIncomeType={setIncomeType}
              baselineWeeklyBurnRate={baselineWeeklyBurnRate}
              setBaselineWeeklyBurnRate={setBaselineWeeklyBurnRate}
              initialBufferAmount={initialBufferAmount}
              setInitialBufferAmount={setInitialBufferAmount}
              variableIncomeState={variableIncomeState}
              setVariableIncomeState={setVariableIncomeState}
              oneOffDeposits={oneOffDeposits}
              setOneOffDeposits={setOneOffDeposits}
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
              fiscalYearEndMonth={fiscalYearEndMonth}
              setFiscalYearEndMonth={setFiscalYearEndMonth}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && (
            <AllocationStep
              categories={categories.length > 0 ? categories : getDefaultCategories(weeklyIncomePool, incomeType, initialBufferAmount)}
              setCategories={setCategories}
              weeklyIncomePool={weeklyIncomePool}
              onNext={() => setStep(5)}
              onBack={() => setStep(3)}
            />
          )}

          {step === 5 && (
            <SyncCodeStep
              data={onboardingData}
              onComplete={completeOnboarding}
              onBack={() => setStep(4)}
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
