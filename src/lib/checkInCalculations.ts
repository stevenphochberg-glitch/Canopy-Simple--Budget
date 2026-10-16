import {
  Household,
  Category,
  Expense,
  CheckIn,
  CheckInStatusInfo,
  CategoryRolloverDecision,
  DateRange,
  DayOfWeek,
  FiscalMonth,
  FeedItem,
} from '../types';
import {
  getWeekRange,
  isExpenseInDateRange,
  calculateCategorySpending,
  formatLocalDate,
  getCategoryEffectiveWeeklyBudget,
  getWeekId,
} from './calculations';
import {
  getFiscalWeekId,
  getFiscalTrackerInfo,
  getFiscalYearStartMonday,
  getFiscalMonthForDate,
  getFiscalYearMonths,
} from './fiscal445';

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
  const daysUntil = (targetCheckInIndex - currentDayIndex + 7) % 7;
  const isToday = daysUntil === 0;

  // Fiscal week IDs for robust matching
  const currentFiscalWeekId = getFiscalWeekId(currentWeekRange.startDate, household?.fiscalYearEndMonth || 12);
  const prevFiscalWeekId = getFiscalWeekId(prevWeekRange.startDate, household?.fiscalYearEndMonth || 12);

  // 2. Find check-in records for current and previous weeks
  const currentWeekStartStr = formatLocalDate(currentWeekRange.startDate);
  const currentWeekEndStr = formatLocalDate(currentWeekRange.endDate);
  const prevWeekStartStr = formatLocalDate(prevWeekRange.startDate);
  const prevWeekEndStr = formatLocalDate(prevWeekRange.endDate);

  const currentWeekCheckIn = checkIns.find(
    (c) =>
      c.status === 'completed' &&
      (c.weekEndDate === currentWeekEndStr ||
        c.weekStartDate === currentWeekStartStr ||
        c.id.includes(currentWeekStartStr) ||
        (c.fiscalWeekId && c.fiscalWeekId === currentFiscalWeekId))
  );

  const prevWeekCheckIn = checkIns.find(
    (c) =>
      c.status === 'completed' &&
      (c.weekEndDate === prevWeekEndStr ||
        c.weekStartDate === prevWeekStartStr ||
        c.id.includes(prevWeekStartStr) ||
        (c.fiscalWeekId && c.fiscalWeekId === prevFiscalWeekId))
  );

  const lastCompletedCheckIn =
    checkIns
      .filter((c) => c.status === 'completed')
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0] || null;

  // 3. Evaluate status:
  // - If completed for current week -> 'completed'
  // - If there are past-due weeks that ended without completed check-in -> 'past-due' (Action Required!)
  // - If today is lastDayOfWeek (check-in day) and current week not completed -> 'pending' (Check-in Ready!)
  // - Otherwise -> 'upcoming'
  const pastDueWeeks = getAllPastDueCheckInWeeks(household, checkIns, refDate, expenses);
  const isPastDue = pastDueWeeks.length > 0;

  let status: 'pending' | 'past-due' | 'completed' | 'upcoming' = 'upcoming';

  if (currentWeekCheckIn) {
    status = 'completed';
  } else if (isPastDue) {
    status = 'past-due';
  } else if (isToday) {
    status = 'pending';
  } else {
    status = 'upcoming';
  }

  const remainingWeeksInMonth = getRemainingWeeksInMonth(refDate);

  // Missed weeks count based on pastDueWeeks
  const missedWeeksCount = pastDueWeeks.length;

  return {
    status,
    isLastDayOfWeek: isToday,
    isPastDue,
    isFirstWeekGracePeriod: false,
    daysUntilCheckIn: daysUntil,
    checkInDayName,
    lastCompletedCheckIn,
    activeWeekRange: currentWeekRange,
    missedWeeksCount,
    remainingWeeksInMonth,
  };
}

export interface PastDueWeekInfo {
  range: DateRange;
  weekStartStr: string;
  weekEndStr: string;
  fiscalWeekId: string;
  weekNumber: number;
  fiscalWeekLabel: string;
}

/**
 * Returns all past fiscal weeks that have ended but do not have a completed check-in,
 * ordered chronologically (oldest first).
 */
/**
 * Returns all past fiscal weeks that have ended but do not have a completed check-in,
 * ordered chronologically (oldest first).
 *
 * CRITICAL SEQUENTIAL ENFORCEMENT:
 * Preceding weeks of the fiscal month must always have completed check-ins before future weeks.
 * Search starts at Week 1 of the earliest active fiscal month (derived from household creation,
 * recorded expenses, or check-ins).
 */
export function getAllPastDueCheckInWeeks(
  household: Household | null,
  checkIns: CheckIn[],
  refDate: Date = new Date(),
  expenses?: Expense[]
): PastDueWeekInfo[] {
  if (!household) return [];
  const firstDay = household.firstDayOfWeek || 'Monday';
  const fiscalYearEndMonth = household.fiscalYearEndMonth || 12;

  // Anchor: find start of search range.
  // 1. Determine earliest activity timestamp among createdAt, expenses, and check-ins.
  let earliestActivityDate: Date | null = null;
  if (household.createdAt) {
    const created = new Date(household.createdAt);
    if (!isNaN(created.getTime())) {
      earliestActivityDate = created;
    }
  }

  if (expenses && expenses.length > 0) {
    expenses.forEach((e) => {
      const d = e.date
        ? new Date(e.date + (e.date.length === 10 ? 'T12:00:00' : ''))
        : new Date(e.timestamp);
      if (!isNaN(d.getTime())) {
        if (!earliestActivityDate || d < earliestActivityDate) {
          earliestActivityDate = d;
        }
      }
    });
  }

  if (checkIns && checkIns.length > 0) {
    checkIns.forEach((c) => {
      const d = c.weekStartDate
        ? new Date(c.weekStartDate + (c.weekStartDate.length === 10 ? 'T12:00:00' : ''))
        : new Date(c.timestamp || 0);
      if (!isNaN(d.getTime()) && d.getTime() > 0) {
        if (!earliestActivityDate || d < earliestActivityDate) {
          earliestActivityDate = d;
        }
      }
    });
  }

  if (!earliestActivityDate) {
    earliestActivityDate = getFiscalYearStartMonday(refDate.getFullYear(), fiscalYearEndMonth);
  }

  // Preceding weeks of the month must always be evaluated before future weeks:
  // Align searchStart to Week 1 of the fiscal month containing earliestActivityDate.
  const earliestFiscalMonth = getFiscalMonthForDate(earliestActivityDate, fiscalYearEndMonth);
  const searchStart = new Date(earliestFiscalMonth.startDate);

  // Align searchStart to firstDayOfWeek
  const initialWeek = getWeekRange(searchStart, firstDay, 0);
  let currentWeekStart = new Date(initialWeek.startDate);

  // A week is considered elapsed and eligible for check-in if its entire period ended strictly before refDate
  const pastDueWeeks: PastDueWeekInfo[] = [];

  while (currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000 <= refDate.getTime()) {
    const weekRange = getWeekRange(currentWeekStart, firstDay, 0);
    const weekStartStr = formatLocalDate(weekRange.startDate);
    const weekEndStr = formatLocalDate(weekRange.endDate);
    const fiscalWeekId = getFiscalWeekId(weekRange.startDate, fiscalYearEndMonth);
    const trackerInfo = getFiscalTrackerInfo(weekRange.startDate, fiscalYearEndMonth);
    const weekNumber = trackerInfo.weekOfFiscalYear;
    const fiscalWeekLabel = `W${weekNumber}`;

    // Check if this week has a completed check-in
    const isCompleted = (checkIns || []).some((c) => {
      if (c.status !== 'completed') return false;
      return (
        c.weekEndDate === weekEndStr ||
        c.weekStartDate === weekStartStr ||
        c.id.includes(weekStartStr) ||
        (c.fiscalWeekId && c.fiscalWeekId === fiscalWeekId)
      );
    });

    if (!isCompleted) {
      pastDueWeeks.push({
        range: weekRange,
        weekStartStr,
        weekEndStr,
        fiscalWeekId,
        weekNumber,
        fiscalWeekLabel,
      });
    }

    currentWeekStart = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  // Sort chronologically (oldest first)
  pastDueWeeks.sort((a, b) => a.range.startDate.getTime() - b.range.startDate.getTime());
  return pastDueWeeks;
}

/**
 * Returns the oldest past-due check-in week that requires completion first.
 */
export function getOldestPastDueCheckInWeek(
  household: Household | null,
  checkIns: CheckIn[],
  refDate: Date = new Date(),
  expenses?: Expense[]
): PastDueWeekInfo | null {
  const weeks = getAllPastDueCheckInWeeks(household, checkIns, refDate, expenses);
  return weeks.length > 0 ? weeks[0] : null;
}

/**
 * Checks if the specified week has any uncompleted preceding week in the same fiscal month
 * (or earlier elapsed weeks since tracking began), enforcing the rule that preceding weeks of
 * the month must have a completed check-in before future weeks can be checked in.
 */
export function getPrecedingUncompletedWeek(
  targetWeekRange: DateRange,
  household: Household | null,
  checkIns: CheckIn[],
  refDate: Date = new Date(),
  expenses?: Expense[]
): PastDueWeekInfo | null {
  const allPastDue = getAllPastDueCheckInWeeks(household, checkIns, refDate, expenses);
  const targetStartTime = targetWeekRange.startDate.getTime();

  // Find past-due weeks that started strictly before the target week
  const precedingUncompleted = allPastDue.filter(
    (w) => w.range.startDate.getTime() < targetStartTime
  );

  return precedingUncompleted.length > 0 ? precedingUncompleted[0] : null;
}

/**
 * Checks whether all weekly check-ins for a given fiscal month have been completed.
 */
export function areAllWeeklyCheckInsCompletedForMonth(
  fiscalMonth: FiscalMonth,
  checkIns: CheckIn[]
): boolean {
  if (!checkIns || checkIns.length === 0) return false;

  const weekCount = fiscalMonth.weekCount;
  const monthStartT = fiscalMonth.startDate.getTime();
  const monthEndT = fiscalMonth.endDate.getTime();

  // 1. Check if total unique completed check-ins in this month range >= weekCount
  const completedInMonth = checkIns.filter((c) => {
    if (c.status !== 'completed') return false;
    const cStart = c.weekStartDate
      ? new Date(c.weekStartDate + (c.weekStartDate.length === 10 ? 'T12:00:00' : '')).getTime()
      : 0;
    const cEnd = c.weekEndDate
      ? new Date(c.weekEndDate + (c.weekEndDate.length === 10 ? 'T12:00:00' : '')).getTime()
      : 0;
    return (
      (cStart >= monthStartT - 86400000 && cStart <= monthEndT) ||
      (cEnd >= monthStartT && cEnd <= monthEndT + 86400000)
    );
  });

  if (completedInMonth.length >= weekCount) {
    return true;
  }

  // 2. Week-by-week verification
  const startMonday = new Date(fiscalMonth.startDate);
  startMonday.setHours(0, 0, 0, 0);

  for (let i = 0; i < weekCount; i++) {
    const wStart = new Date(startMonday.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const wEnd = new Date(wStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    const wStartStr = formatLocalDate(wStart);
    const wEndStr = formatLocalDate(wEnd);

    const isWeekDone = checkIns.some((c) => {
      if (c.status !== 'completed') return false;
      if (c.weekStartDate === wStartStr || c.weekEndDate === wEndStr) return true;
      if (c.id && (c.id.includes(wStartStr) || c.id.includes(wEndStr))) return true;
      const cStartTime = c.weekStartDate
        ? new Date(c.weekStartDate + (c.weekStartDate.length === 10 ? 'T12:00:00' : '')).getTime()
        : 0;
      const cEndTime = c.weekEndDate
        ? new Date(c.weekEndDate + (c.weekEndDate.length === 10 ? 'T12:00:00' : '')).getTime()
        : 0;
      if (cStartTime >= wStart.getTime() - 86400000 && cStartTime <= wEnd.getTime()) return true;
      if (cEndTime >= wStart.getTime() && cEndTime <= wEnd.getTime() + 86400000) return true;
      return false;
    });

    if (!isWeekDone) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether the monthly retrospective/review for a given fiscal month has been completed.
 */
export function isMonthlyReviewCompletedForMonth(
  fiscalMonth: FiscalMonth,
  household: Household | null,
  feedItems?: FeedItem[]
): boolean {
  if (!household) return false;

  const monthKey = `${fiscalMonth.fiscalYear || fiscalMonth.endDate.getFullYear()}-M${fiscalMonth.fiscalMonthNumber}`;

  // 1. Explicitly recorded completed monthly reviews
  if (household.completedMonthlyReviews && household.completedMonthlyReviews[monthKey]) {
    return true;
  }

  // 2. Verified via lastMonthEndReset timestamp
  if (household.lastMonthEndReset) {
    const resetTime = household.lastMonthEndReset;
    const finalWeekStart = fiscalMonth.endDate.getTime() - 7 * 24 * 60 * 60 * 1000;
    if (resetTime >= finalWeekStart && resetTime >= fiscalMonth.startDate.getTime()) {
      return true;
    }
  }

  // 3. Verified via feedItems
  if (feedItems && feedItems.length > 0) {
    const monthEndStr = formatLocalDate(fiscalMonth.endDate);
    const hasFeedItem = feedItems.some(
      (f) =>
        f.type === 'monthEndReset' &&
        (f.date === monthEndStr ||
          (f.timestamp &&
            f.timestamp >= fiscalMonth.endDate.getTime() - 7 * 24 * 60 * 60 * 1000 &&
            f.timestamp <= fiscalMonth.endDate.getTime() + 14 * 24 * 60 * 60 * 1000))
    );
    if (hasFeedItem) return true;
  }

  return false;
}

/**
 * Finds the earliest (or active) fiscal month where all weekly check-ins have been completed,
 * but the monthly review has not yet been completed.
 */
export function getUnreviewedCompletedMonth(
  household: Household | null,
  checkIns: CheckIn[],
  expenses?: Expense[],
  feedItems?: FeedItem[]
): FiscalMonth | null {
  if (!household || !checkIns || checkIns.length === 0) return null;

  const fiscalYearEnd = household.fiscalYearEndMonth || 12;
  const now = new Date();
  const currentFiscalMonth = getFiscalMonthForDate(now, fiscalYearEnd);
  const currentYear = currentFiscalMonth.fiscalYear || now.getFullYear();

  // Check chronological months for previous year and current year
  for (const year of [currentYear - 1, currentYear, currentYear + 1]) {
    const fMonths = getFiscalYearMonths(year, fiscalYearEnd);
    for (const fm of fMonths) {
      // Only consider months where all weekly check-ins have been completed
      if (areAllWeeklyCheckInsCompletedForMonth(fm, checkIns)) {
        if (!isMonthlyReviewCompletedForMonth(fm, household, feedItems)) {
          return fm;
        }
      }
    }
  }

  return null;
}

/**
 * Checks if the target week belongs to a future fiscal month while a preceding fiscal month
 * has all weekly check-ins completed but its monthly review has NOT been completed.
 * Enforces the rule: Users should not be able to complete weekly check-ins of future months
 * until the monthly review of preceding completed months is completed.
 */
export function getPrecedingUncompletedMonthReview(
  targetWeekRange: DateRange,
  household: Household | null,
  checkIns: CheckIn[],
  expenses?: Expense[],
  feedItems?: FeedItem[]
): FiscalMonth | null {
  if (!household) return null;

  const fiscalYearEnd = household.fiscalYearEndMonth || 12;
  const targetFiscalMonth = getFiscalMonthForDate(targetWeekRange.startDate, fiscalYearEnd);
  const targetStartTime = targetFiscalMonth.startDate.getTime();
  const currentYear = targetFiscalMonth.fiscalYear || targetWeekRange.startDate.getFullYear();

  // Search chronological preceding months
  for (const year of [currentYear - 1, currentYear]) {
    const fMonths = getFiscalYearMonths(year, fiscalYearEnd);
    for (const fm of fMonths) {
      // Must be strictly preceding the target fiscal month
      if (fm.endDate.getTime() < targetStartTime) {
        // If all weekly check-ins of this preceding month are completed
        if (areAllWeeklyCheckInsCompletedForMonth(fm, checkIns)) {
          // And its monthly review is NOT completed
          if (!isMonthlyReviewCompletedForMonth(fm, household, feedItems)) {
            return fm;
          }
        }
      }
    }
  }

  return null;
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

    const round2 = (val: number) => Math.round((Number(val) || 0) * 100) / 100;
  const finalSavingsGoalMet = currentSavingsDeficit <= 0;
  const totalSaved = round2(totalSavedFromSurplus);

  return {
    decisions,
    baselineSavingsGoal: round2(baselineSavingsGoal),
    effectiveSavingsGoal: round2(availableSavingsGoal + totalSavedFromSurplus),
    isSavingsGoalMet: finalSavingsGoalMet,
    totalSaved,
    totalSurplus: round2(totalSurplus),
    totalDeficit: round2(totalDeficit),
    totalSpent: round2(totalSpent),
    totalBudget: round2(totalBudget),
    totalSavingsDeducted: round2(totalSavingsDeducted),
    billsTotalBudget: round2(billsTotalBudget),
    billsTotalSpent: round2(billsTotalSpent),
  };
}
