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
import {
  getWeekRange,
  isExpenseInDateRange,
  calculateCategorySpending,
  formatLocalDate,
  getCategoryEffectiveWeeklyBudget,
  getWeekId,
} from './calculations';

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
  const currentWeekStartStr = formatLocalDate(currentWeekRange.startDate);
  const currentWeekEndStr = formatLocalDate(currentWeekRange.endDate);
  const prevWeekStartStr = formatLocalDate(prevWeekRange.startDate);
  const prevWeekEndStr = formatLocalDate(prevWeekRange.endDate);

  const currentWeekCheckIn = checkIns.find(
    (c) =>
      c.status === 'completed' &&
      (c.weekEndDate === currentWeekEndStr ||
        c.weekStartDate === currentWeekStartStr ||
        c.id.includes(currentWeekStartStr))
  );

  const prevWeekCheckIn = checkIns.find(
    (c) =>
      c.status === 'completed' &&
      (c.weekEndDate === prevWeekEndStr ||
        c.weekStartDate === prevWeekStartStr ||
        c.id.includes(prevWeekStartStr))
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
 * Calculates pacing, surplus, deficit, and next-week adjusted budgets for each category,
 * strictly isolating Bills to the monthly retrospective and enforcing the Weekly Savings Goal objective.
 */
export function calculateCategoryDecisions(
  categories: Category[],
  expenses: Expense[],
  weekRange: DateRange,
  remainingWeeksInMonth: number,
  userChoices: Record<string, 'savings' | 'rollover' | 'deduct_savings' | 'reduce_future'> = {},
  household?: Household | null
): {
  decisions: CategoryRolloverDecision[];
  baselineSavingsGoal: number;
  effectiveSavingsGoal: number;
  isSavingsGoalMet: boolean;
  totalSaved: number;
  totalSurplus: number;
  totalDeficit: number;
  totalSpent: number;
  totalBudget: number;
  totalSavingsDeducted: number;
  billsTotalBudget: number;
  billsTotalSpent: number;
} {
  const weeksDivider = Math.max(1, remainingWeeksInMonth);
  const weekId = household ? getWeekId(weekRange, household.firstDayOfWeek || 'Monday') : null;

  // 1. BILLS CATEGORY ISOLATION:
  // Filter out all "Bills" categories from weekly check-in proration, surplus transfers, and deficit penalty options.
  const isBillsCategory = (c: Category) =>
    c.group?.toLowerCase() === 'bills' || c.name?.toLowerCase() === 'bills';

  const isSavingsCategory = (c: Category) =>
    c.type === 'savings' || c.group?.toLowerCase() === 'savings';

  // Active weekly expense categories (Essentials, Fun Money, and any custom non-Bills expense categories)
  const weeklyExpenseCategories = categories.filter(
    (c) => !isBillsCategory(c) && !isSavingsCategory(c)
  );

  // Savings categories for establishing the Weekly Savings Goal
  const savingsCategories = categories.filter(isSavingsCategory);
  const baselineSavingsGoal = savingsCategories.reduce(
    (sum, c) => sum + (Number(c.baselineBudget) || 0),
    0
  );

  // Calculate Bills totals strictly for informational/monthly context
  const billsCategories = categories.filter(isBillsCategory);
  let billsTotalBudget = 0;
  let billsTotalSpent = 0;
  billsCategories.forEach((cat) => {
    const effective = getCategoryEffectiveWeeklyBudget(cat, weekId, household);
    billsTotalBudget += effective.budget;
    const { totalSpent: spent } = calculateCategorySpending(
      expenses,
      cat.id,
      weekRange.startDate,
      weekRange.endDate
    );
    billsTotalSpent += spent;
  });

  // Calculate spending for each weekly expense category
  interface CategoryPacing {
    category: Category;
    budget: number;
    baselineBudget: number;
    isOverridden: boolean;
    spent: number;
    diff: number; // positive = surplus, negative = deficit
  }

  const pacings: CategoryPacing[] = weeklyExpenseCategories.map((cat) => {
    const effective = getCategoryEffectiveWeeklyBudget(cat, weekId, household);
    const budget = effective.budget;
    const baselineBudget = effective.baseline;
    const isOverridden = effective.isOverridden || (baselineBudget > 0 && budget !== baselineBudget);

    const { totalSpent: spent } = calculateCategorySpending(
      expenses,
      cat.id,
      weekRange.startDate,
      weekRange.endDate
    );
    return {
      category: cat,
      budget,
      baselineBudget,
      isOverridden,
      spent,
      diff: budget - spent,
    };
  });

  let totalBudget = pacings.reduce((sum, p) => sum + p.budget, 0);
  let totalSpent = pacings.reduce((sum, p) => sum + p.spent, 0);
  let totalSurplus = pacings.filter((p) => p.diff > 0).reduce((sum, p) => sum + p.diff, 0);
  let totalDeficit = pacings.filter((p) => p.diff < 0).reduce((sum, p) => sum + Math.abs(p.diff), 0);

  // 2. OVERSPENDING RESOLUTION (OPTION A: Deduct from Savings Goal vs OPTION B: Reduce Future Weeks)
  let availableSavingsGoal = baselineSavingsGoal;
  let totalSavingsDeducted = 0;
  const overspentDecisionsMap = new Map<string, CategoryRolloverDecision>();

  // Process overspent categories first to determine if Savings Goal is impacted
  for (const p of pacings.filter((p) => p.diff < 0)) {
    const cat = p.category;
    const deficit = Math.abs(p.diff);
    const chosenResolution = (userChoices[cat.id] as 'deduct_savings' | 'reduce_future') || 'deduct_savings';

    if (chosenResolution === 'deduct_savings') {
      if (availableSavingsGoal >= deficit) {
        // Covered in full by Savings Goal
        availableSavingsGoal -= deficit;
        totalSavingsDeducted += deficit;

        overspentDecisionsMap.set(cat.id, {
          categoryId: cat.id,
          categoryName: cat.name,
          spent: p.spent,
          budget: p.budget,
          baselineBudget: p.baselineBudget,
          isOverridden: p.isOverridden,
          difference: p.diff,
          choice: 'deduct_savings',
          overspendChoice: 'deduct_savings',
          savingsDeduction: deficit,
          futureWeeklyReduction: 0,
          forcedFallbackApplied: false,
          effectiveSavingsReduced: deficit,
          adjustmentPerWeek: 0,
          previousWeeklyBudget: p.budget,
          newWeeklyBudget: p.budget, // Next week budget is not reduced
          savingsContribution: 0,
        });
      } else if (availableSavingsGoal > 0) {
        // Partially covered: Forced Fallback (Depleted Savings)
        const coveredBySavings = availableSavingsGoal;
        const uncoveredDeficit = deficit - coveredBySavings;
        totalSavingsDeducted += coveredBySavings;
        availableSavingsGoal = 0;

        const reductionPerWeek = Math.round(uncoveredDeficit / weeksDivider);
        const newWeeklyBudget = Math.max(0, p.budget - reductionPerWeek);

        overspentDecisionsMap.set(cat.id, {
          categoryId: cat.id,
          categoryName: cat.name,
          spent: p.spent,
          budget: p.budget,
          baselineBudget: p.baselineBudget,
          isOverridden: p.isOverridden,
          difference: p.diff,
          choice: 'deduct_savings',
          overspendChoice: 'deduct_savings',
          savingsDeduction: coveredBySavings,
          futureWeeklyReduction: reductionPerWeek,
          forcedFallbackApplied: true,
          effectiveSavingsReduced: coveredBySavings,
          adjustmentPerWeek: -reductionPerWeek,
          previousWeeklyBudget: p.budget,
          newWeeklyBudget,
          savingsContribution: 0,
        });
      } else {
        // Savings completely depleted: Forced Fallback to Option B
        const reductionPerWeek = Math.round(deficit / weeksDivider);
        const newWeeklyBudget = Math.max(0, p.budget - reductionPerWeek);

        overspentDecisionsMap.set(cat.id, {
          categoryId: cat.id,
          categoryName: cat.name,
          spent: p.spent,
          budget: p.budget,
          baselineBudget: p.baselineBudget,
          isOverridden: p.isOverridden,
          difference: p.diff,
          choice: 'reduce_future',
          overspendChoice: 'reduce_future',
          savingsDeduction: 0,
          futureWeeklyReduction: reductionPerWeek,
          forcedFallbackApplied: true,
          effectiveSavingsReduced: 0,
          adjustmentPerWeek: -reductionPerWeek,
          previousWeeklyBudget: p.budget,
          newWeeklyBudget,
          savingsContribution: 0,
        });
      }
    } else {
      // Option B: Reduce Future Weeks
      const reductionPerWeek = Math.round(deficit / weeksDivider);
      const newWeeklyBudget = Math.max(0, p.budget - reductionPerWeek);

      overspentDecisionsMap.set(cat.id, {
        categoryId: cat.id,
        categoryName: cat.name,
        spent: p.spent,
        budget: p.budget,
        baselineBudget: p.baselineBudget,
        isOverridden: p.isOverridden,
        difference: p.diff,
        choice: 'reduce_future',
        overspendChoice: 'reduce_future',
        savingsDeduction: 0,
        futureWeeklyReduction: reductionPerWeek,
        forcedFallbackApplied: false,
        effectiveSavingsReduced: 0,
        adjustmentPerWeek: -reductionPerWeek,
        previousWeeklyBudget: p.budget,
        newWeeklyBudget,
        savingsContribution: 0,
      });
    }
  }

  // 3. UNDERSPENDING RESOLUTION & SAVINGS PRIORITY GATE:
  // Check if baseline Weekly Savings Goal has been met (no net savings deficit)
  let currentSavingsDeficit = baselineSavingsGoal - availableSavingsGoal;
  const initialSavingsGoalMet = currentSavingsDeficit <= 0;
  let totalSavedFromSurplus = 0;

  const underspentDecisionsMap = new Map<string, CategoryRolloverDecision>();

  for (const p of pacings.filter((p) => p.diff > 0)) {
    const cat = p.category;
    const surplus = p.diff;
    const userPref = (userChoices[cat.id] as 'savings' | 'rollover') || 'savings';

    if (currentSavingsDeficit > 0) {
      // Savings Goal is NOT Met -> Proration is disabled.
      // Unspent funds must automatically route to fill the savings deficit.
      if (surplus <= currentSavingsDeficit) {
        currentSavingsDeficit -= surplus;
        availableSavingsGoal += surplus;
        totalSavedFromSurplus += surplus;

        underspentDecisionsMap.set(cat.id, {
          categoryId: cat.id,
          categoryName: cat.name,
          spent: p.spent,
          budget: p.budget,
          baselineBudget: p.baselineBudget,
          isOverridden: p.isOverridden,
          difference: p.diff,
          choice: 'savings_deficit_fill',
          underspendChoice: 'savings',
          isProrationDisabled: true,
          adjustmentPerWeek: 0,
          previousWeeklyBudget: p.budget,
          newWeeklyBudget: p.budget,
          savingsContribution: surplus,
        });
      } else {
        // Surplus exceeds what is needed to restore the Savings Goal!
        const fillAmount = currentSavingsDeficit;
        const excessSurplus = surplus - fillAmount;
        currentSavingsDeficit = 0;
        availableSavingsGoal += fillAmount;
        totalSavedFromSurplus += fillAmount;

        if (userPref === 'rollover') {
          // Excess can be prorated across future weeks
          const extraPerWeek = Math.round(excessSurplus / weeksDivider);
          underspentDecisionsMap.set(cat.id, {
            categoryId: cat.id,
            categoryName: cat.name,
            spent: p.spent,
            budget: p.budget,
            baselineBudget: p.baselineBudget,
            isOverridden: p.isOverridden,
            difference: p.diff,
            choice: 'rollover',
            underspendChoice: 'rollover',
            isProrationDisabled: false,
            adjustmentPerWeek: extraPerWeek,
            previousWeeklyBudget: p.budget,
            newWeeklyBudget: p.budget + extraPerWeek,
            savingsContribution: fillAmount,
          });
        } else {
          // Entire surplus boosts savings
          totalSavedFromSurplus += excessSurplus;
          underspentDecisionsMap.set(cat.id, {
            categoryId: cat.id,
            categoryName: cat.name,
            spent: p.spent,
            budget: p.budget,
            baselineBudget: p.baselineBudget,
            isOverridden: p.isOverridden,
            difference: p.diff,
            choice: 'savings',
            underspendChoice: 'savings',
            isProrationDisabled: false,
            adjustmentPerWeek: 0,
            previousWeeklyBudget: p.budget,
            newWeeklyBudget: p.budget,
            savingsContribution: surplus,
          });
        }
      }
    } else {
      // Savings Goal IS Met: Present Option A (Boost Savings) or Option B (Prorate Future Budget)
      if (userPref === 'savings') {
        totalSavedFromSurplus += surplus;
        underspentDecisionsMap.set(cat.id, {
          categoryId: cat.id,
          categoryName: cat.name,
          spent: p.spent,
          budget: p.budget,
          baselineBudget: p.baselineBudget,
          isOverridden: p.isOverridden,
          difference: p.diff,
          choice: 'savings',
          underspendChoice: 'savings',
          isProrationDisabled: false,
          adjustmentPerWeek: 0,
          previousWeeklyBudget: p.budget,
          newWeeklyBudget: p.budget,
          savingsContribution: surplus,
        });
      } else {
        const extraPerWeek = Math.round(surplus / weeksDivider);
        underspentDecisionsMap.set(cat.id, {
          categoryId: cat.id,
          categoryName: cat.name,
          spent: p.spent,
          budget: p.budget,
          baselineBudget: p.baselineBudget,
          isOverridden: p.isOverridden,
          difference: p.diff,
          choice: 'rollover',
          underspendChoice: 'rollover',
          isProrationDisabled: false,
          adjustmentPerWeek: extraPerWeek,
          previousWeeklyBudget: p.budget,
          newWeeklyBudget: p.budget + extraPerWeek,
          savingsContribution: 0,
        });
      }
    }
  }

  // Combine all decisions in order of pacings
  const decisions: CategoryRolloverDecision[] = pacings.map((p) => {
    if (p.diff > 0) {
      return underspentDecisionsMap.get(p.category.id)!;
    }
    if (p.diff < 0) {
      return overspentDecisionsMap.get(p.category.id)!;
    }
    // Exactly on budget
    return {
      categoryId: p.category.id,
      categoryName: p.category.name,
      spent: p.spent,
      budget: p.budget,
      baselineBudget: p.baselineBudget,
      isOverridden: p.isOverridden,
      difference: 0,
      choice: 'savings',
      underspendChoice: 'savings',
      isProrationDisabled: false,
      adjustmentPerWeek: 0,
      previousWeeklyBudget: p.budget,
      newWeeklyBudget: p.budget,
      savingsContribution: 0,
    };
  });

  const finalSavingsGoalMet = currentSavingsDeficit <= 0;
  const totalSaved = totalSavedFromSurplus;

  return {
    decisions,
    baselineSavingsGoal,
    effectiveSavingsGoal: availableSavingsGoal + totalSavedFromSurplus,
    isSavingsGoalMet: finalSavingsGoalMet,
    totalSaved,
    totalSurplus,
    totalDeficit,
    totalSpent,
    totalBudget,
    totalSavingsDeducted,
    billsTotalBudget,
    billsTotalSpent,
  };
}
