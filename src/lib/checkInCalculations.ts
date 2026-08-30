import {
  Household,
  Category,
  Expense,
  CheckIn,
  CheckInStatusInfo,
  CategoryRolloverDecision,
  DateRange,
  DayOfWeek,
} from '../types';
import { getWeekRange, isExpenseInDateRange, calculateCategorySpending } from './calculations';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const DAY_INDEX_MAP: Record<DayOfWeek, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Calculates remaining weekly cycles in the current calendar month.
 */
export function getRemainingWeeksInMonth(refDate: Date): number {
  const currentDay = refDate.getDate();
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - currentDay);
  
  // Calculate remaining weeks (at least 1 to avoid division by zero)
  const remainingWeeks = Math.ceil(daysRemaining / 7);
  return Math.max(1, remainingWeeks);
}

/**
 * Calculates whether today is the designated check-in day for the household.
 */
export function isTodayCheckInDay(lastDayOfWeek: DayOfWeek, refDate: Date = new Date()): boolean {
  const currentDayIndex = refDate.getDay();
  const targetIndex = DAY_INDEX_MAP[lastDayOfWeek] ?? 0;
  return currentDayIndex === targetIndex;
}

/**
 * Computes comprehensive Check-In status, grace periods, and date ranges.
 */
export function calculateCheckInStatus(
  household: Household | null,
  checkIns: CheckIn[],
  expenses: Expense[],
  refDate: Date = new Date()
): CheckInStatusInfo {
  const firstDay = household?.firstDayOfWeek || 'Monday';
  const lastDay = household?.lastDayOfWeek || 'Sunday';

  // 1. Determine active week range
  const currentWeekRange = getWeekRange(refDate, firstDay, 0);
  const prevWeekRange = getWeekRange(refDate, firstDay, -1);

  const checkInDayName = lastDay;
  const currentDayIndex = refDate.getDay();
  const targetCheckInIndex = DAY_INDEX_MAP[lastDay] ?? 0;

  // Calculate days until check-in day
  let daysUntil = (targetCheckInIndex - currentDayIndex + 7) % 7;
  const isToday = daysUntil === 0;

  // 2. Check if household is in First-Week Grace Period
  let isFirstWeekGracePeriod = false;
  if (household?.createdAt) {
    const createdDate = new Date(household.createdAt);
    const msDiff = refDate.getTime() - createdDate.getTime();
    const daysSinceCreation = msDiff / (1000 * 60 * 60 * 24);
    // If created within the last 7 days or during current week
    if (daysSinceCreation < 7) {
      isFirstWeekGracePeriod = true;
    }
  }

  // 3. Find check-in records for current and previous weeks
  const currentWeekKey = `${currentWeekRange.startDate.toISOString().split('T')[0]}_${currentWeekRange.endDate.toISOString().split('T')[0]}`;
  const prevWeekKey = `${prevWeekRange.startDate.toISOString().split('T')[0]}_${prevWeekRange.endDate.toISOString().split('T')[0]}`;

  const currentWeekCheckIn = checkIns.find(
    (c) =>
      c.status === 'completed' &&
      (c.weekEndDate === currentWeekRange.endDate.toISOString().split('T')[0] ||
        c.id.includes(currentWeekRange.startDate.toISOString().split('T')[0]))
  );

  const prevWeekCheckIn = checkIns.find(
    (c) =>
      c.status === 'completed' &&
      (c.weekEndDate === prevWeekRange.endDate.toISOString().split('T')[0] ||
        c.id.includes(prevWeekRange.startDate.toISOString().split('T')[0]))
  );

  const lastCompletedCheckIn =
    checkIns
      .filter((c) => c.status === 'completed')
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0] || null;

  // 4. Evaluate status:
  // - If completed for current week -> 'completed'
  // - If today is lastDayOfWeek and not checked in -> 'pending' (ACTIVE CTA)
  // - If past lastDayOfWeek (new week began) and previous week was not checked in -> 'past-due'
  // - Otherwise -> 'upcoming' (not yet check-in day, but can view preview)
  let status: 'pending' | 'past-due' | 'completed' | 'upcoming' = 'upcoming';
  let isPastDue = false;

  if (currentWeekCheckIn) {
    status = 'completed';
  } else if (isToday) {
    status = 'pending';
  } else {
    // We are on another day of the week.
    // Check if the previous week was completed.
    // If not completed AND not protected by first week grace period -> past-due!
    if (!prevWeekCheckIn && !isFirstWeekGracePeriod) {
      status = 'past-due';
      isPastDue = true;
    } else {
      status = 'upcoming';
    }
  }

  const remainingWeeksInMonth = getRemainingWeeksInMonth(refDate);

  // Estimate missed weeks
  let missedWeeksCount = 0;
  if (isPastDue) {
    if (household?.createdAt) {
      const createdDate = new Date(household.createdAt);
      const diffWeeks = Math.floor((refDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      missedWeeksCount = Math.max(1, diffWeeks);
    } else {
      missedWeeksCount = 1;
    }
  }

  return {
    status,
    isLastDayOfWeek: isToday,
    isPastDue,
    isFirstWeekGracePeriod,
    daysUntilCheckIn: daysUntil,
    checkInDayName,
    lastCompletedCheckIn,
    activeWeekRange: currentWeekRange,
    missedWeeksCount,
    remainingWeeksInMonth,
  };
}

/**
 * Calculates pacing, surplus, deficit, and next-week adjusted budgets for each category.
 */
export function calculateCategoryDecisions(
  categories: Category[],
  expenses: Expense[],
  weekRange: DateRange,
  remainingWeeksInMonth: number,
  userChoices: Record<string, 'savings' | 'rollover'>
): {
  decisions: CategoryRolloverDecision[];
  totalSaved: number;
  totalSurplus: number;
  totalDeficit: number;
  totalSpent: number;
  totalBudget: number;
} {
  const decisions: CategoryRolloverDecision[] = [];
  let totalSaved = 0;
  let totalSurplus = 0;
  let totalDeficit = 0;
  let totalSpent = 0;
  let totalBudget = 0;

  const weeksDivider = Math.max(1, remainingWeeksInMonth);

  for (const cat of categories) {
    const budget = Number(cat.currentWeeklyBudget) || 0;
    const { totalSpent: spent } = calculateCategorySpending(
      expenses,
      cat.id,
      weekRange.startDate,
      weekRange.endDate
    );

    totalBudget += budget;
    totalSpent += spent;

    const diff = budget - spent; // positive = underspent, negative = overspent

    if (diff > 0) {
      // Underspent / Surplus
      totalSurplus += diff;
      const choice = userChoices[cat.id] || 'savings'; // Default recommended choice is savings

      if (choice === 'savings') {
        totalSaved += diff;
        decisions.push({
          categoryId: cat.id,
          categoryName: cat.name,
          spent,
          budget,
          difference: diff,
          choice: 'savings',
          adjustmentPerWeek: 0,
          previousWeeklyBudget: budget,
          newWeeklyBudget: budget,
          savingsContribution: diff,
        });
      } else {
        // Rollover / Prorate surplus evenly across remaining weeks of the month
        const extraPerWeek = Math.round(diff / weeksDivider);
        decisions.push({
          categoryId: cat.id,
          categoryName: cat.name,
          spent,
          budget,
          difference: diff,
          choice: 'rollover',
          adjustmentPerWeek: extraPerWeek,
          previousWeeklyBudget: budget,
          newWeeklyBudget: budget + extraPerWeek,
          savingsContribution: 0,
        });
      }
    } else if (diff < 0) {
      // Overspent / Deficit
      const deficitAmount = Math.abs(diff);
      totalDeficit += deficitAmount;

      // Automatically adjust future weekly budgets downward across remaining weeks of month
      const reductionPerWeek = Math.round(deficitAmount / weeksDivider);
      const newWeeklyBudget = Math.max(0, budget - reductionPerWeek);

      decisions.push({
        categoryId: cat.id,
        categoryName: cat.name,
        spent,
        budget,
        difference: diff,
        choice: 'deficit_absorbed',
        adjustmentPerWeek: -reductionPerWeek,
        previousWeeklyBudget: budget,
        newWeeklyBudget,
        savingsContribution: 0,
      });
    } else {
      // Exactly on budget
      decisions.push({
        categoryId: cat.id,
        categoryName: cat.name,
        spent,
        budget,
        difference: 0,
        choice: 'savings',
        adjustmentPerWeek: 0,
        previousWeeklyBudget: budget,
        newWeeklyBudget: budget,
        savingsContribution: 0,
      });
    }
  }

  return {
    decisions,
    totalSaved,
    totalSurplus,
    totalDeficit,
    totalSpent,
    totalBudget,
  };
}
