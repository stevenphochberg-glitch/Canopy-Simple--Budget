import { DayOfWeek, PaySchedule, HouseholdMember, Category, TimeframeMode, DateRange, Expense, Household } from '../types';
import { is53WeekFiscalYear, getFiscalMonthForDate, getFiscalMonthRange } from './fiscal445';
export { getFiscalMonthRange };

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Calculates normalized weekly income from any pay frequency.
 */
export function normalizeToWeekly(amount: number, schedule: PaySchedule): number {
  if (!amount || isNaN(amount) || amount <= 0) return 0;

  switch (schedule) {
    case 'weekly':
      return Math.round(amount);
    case 'bi-weekly':
      // 26 pay periods per year / 52 weeks
      return Math.round((amount * 26) / 52);
    case 'semi-monthly':
      // 24 pay periods per year (twice a month) / 52 weeks
      return Math.round((amount * 24) / 52);
    case 'monthly':
      // 12 months per year / 52 weeks
      return Math.round((amount * 12) / 52);
    case 'none':
    default:
      return 0;
  }
}

/**
 * Calculates total weekly pool from a list of members.
 */
export function calculateWeeklyPool(members: HouseholdMember[]): number {
  return members.reduce((sum, member) => {
    return sum + (member.hasProvidedIncome ? member.normalizedWeeklyIncome : 0);
  }, 0);
}

/**
 * Derives the check-in day (last day of the week) from the selected first day of the week.
 */
export function getCheckInDay(firstDay: DayOfWeek): DayOfWeek {
  const index = DAYS_OF_WEEK.indexOf(firstDay);
  if (index === -1) return 'Sunday';
  const lastDayIndex = (index + 6) % 7;
  return DAYS_OF_WEEK[lastDayIndex];
}

/**
 * Generates a random 6-character uppercase alphanumeric sync code (e.g., "CNP-8X2" or "K7B3Q9")
 */
export function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Formats currency values
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

/**
 * Default Categories schema with fully specified requirements:
 * Essentials: Groceries, Gas, Personal Goods, Home Goods
 * Fun Money: Restaurants, Shopping
 * Bills: Subscriptions, Mortgage/Rent, Utilities, Fixed Spending
 * Savings: Downpayment, Daycare Fund, Investing
 */
export const RECOMMENDED_CATEGORY_PERCENTAGES: Record<string, number> = {
  Bills: 0.35,
  Essentials: 0.30,
  'Fun Money': 0.20,
  Savings: 0.15,
};

/**
 * Returns default Top-Level Budget Buckets (Essentials, Fun Money, Bills, Savings).
 * Subcategories are listed as examples for the transaction ledger.
 */
export function getDefaultCategories(
  weeklyIncomePool: number,
  incomeType?: 'predictable' | 'scheduled' | 'variable',
  initialBufferAmount?: number
): Category[] {
  const pool = weeklyIncomePool > 0 ? weeklyIncomePool : 1500;

  if (incomeType === 'variable') {
    // Variable income structure: Essentials, Bills, Fun Money, plus dedicated top-level "Income Buffer"
    const bufferAmount = initialBufferAmount !== undefined ? initialBufferAmount : 6000;
    const categories: Category[] = [
      {
        id: 'cat_income_buffer',
        name: 'Income Buffer',
        group: 'Savings',
        type: 'savings',
        icon: 'shield',
        color: 'dark-green',
        baselineBudget: 0, // holding tank, not weekly spend
        currentWeeklyBudget: bufferAmount,
        subcategories: ['Irregular Client Invoices', 'Commission Deposits', 'Lump Sum Reserves', 'Operating Buffer'],
        description: 'Dedicated holding tank for large, irregular deposits. Fuels baseline weekly category drawdowns.',
        totalLogged: 0,
        transactionCount: 0,
      },
      {
        id: 'cat_essentials',
        name: 'Essentials',
        group: 'Essentials',
        type: 'expense',
        icon: 'shopping-bag',
        color: 'sage',
        baselineBudget: Math.round(pool * 0.50),
        currentWeeklyBudget: Math.round(pool * 0.50),
        subcategories: ['Groceries', 'Gas & Transit', 'Personal Goods', 'Home Goods', 'Health & Pharmacy'],
        description: 'Baseline necessities: groceries, fuel, household essentials.',
        totalLogged: 0,
        transactionCount: 0,
      },
      {
        id: 'cat_bills',
        name: 'Bills',
        group: 'Bills',
        type: 'expense',
        icon: 'file-text',
        color: 'brown',
        baselineBudget: Math.round(pool * 0.35),
        currentWeeklyBudget: Math.round(pool * 0.35),
        subcategories: ['Mortgage / Rent', 'Utilities & Electric', 'Subscriptions & Phone', 'Insurance & Services'],
        description: 'Fixed housing, recurring utilities, insurance, and critical debt.',
        totalLogged: 0,
        transactionCount: 0,
      },
      {
        id: 'cat_fun_money',
        name: 'Fun Money',
        group: 'Fun Money',
        type: 'expense',
        icon: 'sparkles',
        color: 'sky-blue',
        baselineBudget: Math.round(pool * 0.15),
        currentWeeklyBudget: Math.round(pool * 0.15),
        subcategories: ['Restaurants & Dining', 'Coffee & Drinks', 'Shopping', 'Entertainment & Hobbies'],
        description: 'Discretionary leisure, personal spending, dining out.',
        totalLogged: 0,
        transactionCount: 0,
      },
    ];
    return categories;
  }

  // Standard scheduled/predictable income distribution across top-level buckets:
  // Bills (35%), Essentials (30%), Fun Money (20%), and Savings (15%)
  const buckets: Array<{
    id: string;
    name: string;
    group: string;
    type: 'expense' | 'savings';
    icon: string;
    color: string;
    weight: number;
    subcategories: string[];
    description: string;
  }> = [
    {
      id: 'cat_bills',
      name: 'Bills',
      group: 'Bills',
      type: 'expense',
      icon: 'file-text',
      color: 'brown',
      weight: 0.35,
      subcategories: ['Mortgage / Rent', 'Utilities & Electric', 'Subscriptions & Phone', 'Insurance & Services'],
      description: 'Recurring monthly housing, utilities, digital subscriptions, and fixed payments.',
    },
    {
      id: 'cat_essentials',
      name: 'Essentials',
      group: 'Essentials',
      type: 'expense',
      icon: 'shopping-bag',
      color: 'sage',
      weight: 0.30,
      subcategories: ['Groceries', 'Gas & Transit', 'Personal Goods', 'Home Goods', 'Health & Pharmacy'],
      description: 'Groceries, transportation, household supplies, and health necessities.',
    },
    {
      id: 'cat_fun_money',
      name: 'Fun Money',
      group: 'Fun Money',
      type: 'expense',
      icon: 'sparkles',
      color: 'sky-blue',
      weight: 0.20,
      subcategories: ['Restaurants & Dining', 'Coffee & Drinks', 'Shopping', 'Entertainment & Hobbies'],
      description: 'Dining out, coffee runs, entertainment, hobbies, and personal treats.',
    },
    {
      id: 'cat_savings',
      name: 'Savings',
      group: 'Savings',
      type: 'savings',
      icon: 'piggy-bank',
      color: 'dark-green',
      weight: 0.15,
      subcategories: ['Emergency Fund', 'Downpayment Fund', 'Investing & Retirement', 'Vacation Fund'],
      description: 'Emergency buffer, investments, down payment goals, and special funds.',
    },
  ];

  let remaining = pool;
  return buckets.map((b, idx) => {
    const isLast = idx === buckets.length - 1;
    const allocation = isLast ? remaining : Math.round(pool * b.weight);
    remaining -= allocation;
    const finalAlloc = Math.max(0, allocation);

    return {
      id: b.id,
      name: b.name,
      group: b.group,
      type: b.type,
      baselineBudget: finalAlloc,
      currentWeeklyBudget: finalAlloc,
      subcategories: b.subcategories,
      description: b.description,
      totalLogged: 0,
      transactionCount: 0,
      icon: b.icon,
      color: b.color,
    };
  });
}

/**
 * Calculates start and end Date for a given week offset from a reference date.
 */
export function getWeekRange(refDate: Date, firstDayOfWeek: DayOfWeek, weekOffset: number = 0): DateRange {
  const target = new Date(refDate);
  target.setDate(target.getDate() + weekOffset * 7);

  // Days: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayIndexMap: Record<DayOfWeek, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const firstDayIndex = dayIndexMap[firstDayOfWeek] ?? 1;
  const currentDayIndex = target.getDay();

  // Calculate difference to reach firstDay
  let diffToFirst = currentDayIndex - firstDayIndex;
  if (diffToFirst < 0) diffToFirst += 7;

  const start = new Date(target);
  start.setDate(target.getDate() - diffToFirst);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined });
  const year = end.getFullYear();

  return {
    startDate: start,
    endDate: end,
    label: `${startMonth} – ${endMonth}, ${year}`,
  };
}

/**
 * Calculates start and end Date for a given month offset from a reference date.
 * Strictly adheres to 4-4-5 Fiscal Month boundaries and resolves reference dates
 * according to which fiscal month they fall into.
 */
export function getMonthRange(refDate: Date, monthOffset: number = 0, fiscalYearEndMonth: number = 12): DateRange {
  return getFiscalMonthRange(refDate, monthOffset, fiscalYearEndMonth);
}

/**
 * Formats a Date as YYYY-MM-DD in local time, preventing UTC offsets from shifting dates.
 */
export function formatLocalDate(date: Date): string {
  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date in local time as YYYY-MM-DD.
 */
export function getTodayLocalDateString(): string {
  return formatLocalDate(new Date());
}

/**
 * Extracts a normalized numeric epoch millisecond timestamp from an expense object.
 * Robustly parses Firestore Timestamp objects, numeric timestamps, ISO date strings,
 * and local YYYY-MM-DD date strings with strict local timezone anchoring.
 */
export function parseExpenseTimestamp(expense: { timestamp?: any; date?: string; createdAt?: any }): number {
  if (expense.date && typeof expense.date === 'string') {
    const trimmed = expense.date.trim();
    // Strict local calendar date handling for YYYY-MM-DD: anchor to local midday (12:00:00)
    // so UTC offsets and DST shifts never pull Monday into Sunday night or vice versa.
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parts = trimmed.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day, 12, 0, 0, 0).getTime();
    }
  }

  const ts = expense.timestamp ?? expense.createdAt;
  if (ts !== undefined && ts !== null) {
    if (typeof ts === 'number' && !isNaN(ts)) {
      return ts;
    }
    if (typeof ts === 'object') {
      if (typeof ts.toMillis === 'function') {
        return ts.toMillis();
      }
      if (typeof ts.toDate === 'function') {
        return ts.toDate().getTime();
      }
      if (typeof ts.seconds === 'number') {
        return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
      }
    }
    if (typeof ts === 'string') {
      const parsed = new Date(ts).getTime();
      if (!isNaN(parsed)) return parsed;
    }
  }

  if (expense.date) {
    const parsed = new Date(expense.date).getTime();
    if (!isNaN(parsed)) return parsed;
  }

  return Date.now();
}

/**
 * Checks if a given expense date/timestamp falls inside a DateRange
 */
export function isExpenseInDateRange(expense: Expense, start: Date, end: Date): boolean {
  const expTime = parseExpenseTimestamp(expense);
  const startTime = start.getTime();
  const endTime = end.getTime();
  return expTime >= startTime && expTime <= endTime;
}

/**
 * Normalizes a weekly budget to monthly equivalent when in Month view.
 * The total Monthly Budget is a statically derived constant (Baseline Weekly Allocation × Weeks in Fiscal Month).
 * It must NEVER be dynamically calculated by summing up post-check-in adjusted weekly budgets.
 */
export function getCategoryBudgetForTimeframe(
  weeklyBudget: number,
  mode: TimeframeMode,
  weeksInFiscalMonth?: number
): number {
  if (mode === 'month') {
    if (weeksInFiscalMonth && weeksInFiscalMonth > 0) {
      return Math.round(weeklyBudget * weeksInFiscalMonth);
    }
    return Math.round((weeklyBudget * 52) / 12);
  }
  return weeklyBudget;
}

/**
 * Dynamic Proration for Paid-Only Bills:
 * - Strict Logging Rule: Only log and prorate the exact amount of the expense that has actively been paid.
 * - Annual Bills: Dynamically calculate the exact number of fiscal weeks in the current year
 *   (52-week or 53-week year based on Jan 5, 2026 anchor). Divide actively paid bill amount by this exact integer
 *   to display weekly amount. For monthly view, multiply that weekly amount by the 4 or 5 weeks in current fiscal month.
 *   The prorated amount covers the active timeframe (e.g., Sept to Sept) without auto-renewing.
 * - Monthly Bills: Split the actively paid expense across the weeks of that specific month based on 4-4-5 structure.
 *   Only prorated across the weeks of the single month it was logged for, with no adjustments pushed to unpaid future months.
 * - Weekly Bills / Regular Expenses: Direct allocation to that specific week.
 */
export function getProratedExpenseAmount(
  exp: Expense,
  start: Date,
  end: Date,
  fiscalYearEndMonth: number = 12
): number {
  const amount = Number(exp.amount) || 0;
  if (amount <= 0) return 0;

  // If no billFrequency or weekly bill, use standard date range check
  if (!exp.billFrequency || exp.billFrequency === 'weekly') {
    return isExpenseInDateRange(exp, start, end) ? amount : 0;
  }

  const expDate = new Date(exp.date + (exp.date.length === 10 ? 'T12:00:00' : ''));
  const expTime = isNaN(expDate.getTime()) ? (exp.timestamp || Date.now()) : expDate.getTime();
  const validExpDate = new Date(expTime);

  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const isWeeklyView = diffDays <= 9;

  if (exp.billFrequency === 'monthly') {
    const billFiscalMonth = getFiscalMonthForDate(validExpDate, fiscalYearEndMonth);
    const mStart = billFiscalMonth.startDate.getTime();
    const mEnd = billFiscalMonth.endDate.getTime();

    // Must overlap with this specific fiscal month
    if (end.getTime() < mStart || start.getTime() > mEnd) {
      return 0;
    }

    if (isWeeklyView) {
      // Split actively paid expense across the weeks of that specific 4-4-5 month
      const weeksInMonth = billFiscalMonth.weekCount || 4;
      return Math.round((amount / weeksInMonth) * 100) / 100;
    } else {
      // For the monthly view of this single month, full paid amount is recognized
      return amount;
    }
  }

  if (exp.billFrequency === 'annually' || exp.billFrequency === 'yearly') {
    const expYear = validExpDate.getFullYear();
    const totalWeeksInYear = is53WeekFiscalYear(expYear, fiscalYearEndMonth) ? 53 : 52;
    const weeklyAmount = amount / totalWeeksInYear;

    // Active timeframe: totalWeeksInYear weeks starting from the fiscal week of validExpDate
    const billFiscalMonth = getFiscalMonthForDate(validExpDate, fiscalYearEndMonth);
    const daysFromMonthStart = Math.max(
      0,
      Math.floor((validExpDate.getTime() - billFiscalMonth.startDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const weekOfFiscalMonth = Math.min(
      billFiscalMonth.weekCount,
      Math.floor(daysFromMonthStart / 7) + 1
    );
    const weekStartTime = billFiscalMonth.startDate.getTime() + (weekOfFiscalMonth - 1) * 7 * 24 * 60 * 60 * 1000;
    const activeStartTime = weekStartTime;
    const activeEndTime = activeStartTime + totalWeeksInYear * 7 * 24 * 60 * 60 * 1000 - 1;

    if (end.getTime() < activeStartTime || start.getTime() > activeEndTime) {
      return 0;
    }

    if (isWeeklyView) {
      return Math.round(weeklyAmount * 100) / 100;
    } else {
      const currentFiscalMonth = getFiscalMonthForDate(start, fiscalYearEndMonth);
      const weeksInMonth = currentFiscalMonth.weekCount || 4;
      return Math.round((weeklyAmount * weeksInMonth) * 100) / 100;
    }
  }

  if (exp.billFrequency === 'custom' && exp.billStartDate && exp.billEndDate) {
    const customStart = new Date(exp.billStartDate + (exp.billStartDate.length === 10 ? 'T00:00:00' : ''));
    const customEnd = new Date(exp.billEndDate + (exp.billEndDate.length === 10 ? 'T23:59:59' : ''));
    if (!isNaN(customStart.getTime()) && !isNaN(customEnd.getTime()) && customEnd >= customStart) {
      const totalDays = Math.max(1, Math.round((customEnd.getTime() - customStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
      const weeklyAmount = amount / totalWeeks;

      if (end.getTime() < customStart.getTime() || start.getTime() > customEnd.getTime()) {
        return 0;
      }

      if (isWeeklyView) {
        return Math.round(weeklyAmount * 100) / 100;
      } else {
        const currentFiscalMonth = getFiscalMonthForDate(start, fiscalYearEndMonth);
        const weeksInMonth = currentFiscalMonth.weekCount || 4;
        return Math.round((weeklyAmount * weeksInMonth) * 100) / 100;
      }
    }
  }

  return isExpenseInDateRange(exp, start, end) ? amount : 0;
}

/**
 * Calculates spending and transaction count for a category within a date range,
 * applying dynamic paid-only bill proration.
 */
export function calculateCategorySpending(
  expenses: Expense[],
  categoryId: string,
  start: Date,
  end: Date,
  fiscalYearEndMonth: number = 12
): { totalSpent: number; count: number } {
  let totalSpent = 0;
  let count = 0;

  for (const exp of expenses) {
    if (exp.categoryId === categoryId) {
      const prorated = getProratedExpenseAmount(exp, start, end, fiscalYearEndMonth);
      if (prorated > 0) {
        totalSpent += prorated;
        count += 1;
      }
    }
  }

  return { totalSpent: Math.round(totalSpent * 100) / 100, count };
}

/**
 * Evaluates if a household is currently in its first-week grace period.
 * For new sign-ups in their first week, suppress past-due check-in requirements for prior weeks.
 */
export function isFirstWeekGracePeriod(createdAt: string | number | undefined): boolean {
  if (!createdAt) return true; // Grace period if undefined
  const createdTime = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt;
  if (isNaN(createdTime)) return true;
  const now = Date.now();
  const diffDays = (now - createdTime) / (1000 * 60 * 60 * 24);
  return diffDays < 7;
}

/**
 * Formats ISO date string YYYY-MM-DD to human readable string (e.g. "Mon, Oct 24")
 */
export function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : ''));
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function calculateRolloverImpact(
  baselineWeeklyBudget: number,
  currentSpent: number,
  remainingWeeksInMonth: number = 3
): {
  isOverspent: boolean;
  difference: number;
  newWeeklyBudget: number;
} {
  const diff = currentSpent - baselineWeeklyBudget;
  if (diff > 0) {
    // Overspent: Deficit penalty prorated across remaining weeks
    const penaltyPerWeek = remainingWeeksInMonth > 0 ? diff / remainingWeeksInMonth : diff;
    const adjusted = Math.max(0, Math.round(baselineWeeklyBudget - penaltyPerWeek));
    return {
      isOverspent: true,
      difference: diff,
      newWeeklyBudget: adjusted,
    };
  } else {
    // Underspent: Surplus
    return {
      isOverspent: false,
      difference: Math.abs(diff),
      newWeeklyBudget: baselineWeeklyBudget,
    };
  }
}

/**
 * Returns a standardized weekId for a date or DateRange (YYYY-MM-DD of the week's start date in local time).
 */
export function getWeekId(dateOrRange: Date | DateRange, firstDayOfWeek: DayOfWeek = 'Monday'): string {
  if (!dateOrRange) {
    return getTodayLocalDateString();
  }
  if ('startDate' in dateOrRange) {
    return formatLocalDate(dateOrRange.startDate);
  }
  const range = getWeekRange(dateOrRange, firstDayOfWeek, 0);
  return formatLocalDate(range.startDate);
}

/**
 * Returns the future weeks (DateRange[]) in the current fiscal month strictly AFTER the current week.
 * Guaranteed: Does NOT include currentWeekRange, and does NOT include any past weeks.
 */
export function getFutureWeeksInFiscalMonth(
  currentWeekRange: DateRange,
  household: Household | null
): DateRange[] {
  const firstDay = household?.firstDayOfWeek || 'Monday';
  const fiscalMonth = getFiscalMonthForDate(currentWeekRange.startDate, household?.fiscalYearEndMonth || 12);

  const futureWeeks: DateRange[] = [];
  // Next week starts exactly 7 days after currentWeekRange.startDate
  let nextWeekStart = new Date(currentWeekRange.startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  // While next week starts before or on the end of this fiscal month
  while (nextWeekStart.getTime() <= fiscalMonth.endDate.getTime()) {
    const nextWeekRange = getWeekRange(nextWeekStart, firstDay, 0);
    futureWeeks.push(nextWeekRange);
    nextWeekStart = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return futureWeeks;
}

/**
 * Resolves a category's effective weekly budget for a specific week:
 * 1. Global baseline budget is the primary source of truth.
 * 2. Checks if household.weeklyOverrides[activeWeekId] contains an override for this category.
 */
export function getCategoryEffectiveWeeklyBudget(
  category: Category,
  activeWeekId: string | null | undefined,
  household: Household | null | undefined
): {
  budget: number;
  baseline: number;
  isOverridden: boolean;
  overrideAmount?: number;
} {
  const baseline = Number(category.baselineBudget) || 0;
  if (!activeWeekId || !household?.weeklyOverrides || !household.weeklyOverrides[activeWeekId]) {
    return {
      budget: baseline,
      baseline,
      isOverridden: false,
    };
  }

  const weekOverrides = household.weeklyOverrides[activeWeekId];
  const nameSlug = category.name ? category.name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const altSlug = category.name ? category.name.toLowerCase().replace(/\s+/g, '') : '';
  
  const isSavings =
    category.id === 'cat_savings' ||
    category.type === 'savings' ||
    category.group?.toLowerCase() === 'savings' ||
    category.name?.toLowerCase().includes('saving');

  const overrideVal =
    weekOverrides[category.id] ??
    (altSlug ? weekOverrides[altSlug] : undefined) ??
    (nameSlug ? weekOverrides[nameSlug] : undefined) ??
    (category.name ? weekOverrides[category.name] : undefined) ??
    (isSavings ? (weekOverrides['savings'] ?? weekOverrides['cat_savings']) : undefined);

  if (overrideVal !== undefined && overrideVal !== null && !isNaN(Number(overrideVal))) {
    const numOverride = Number(overrideVal);
    return {
      budget: numOverride,
      baseline,
      isOverridden: numOverride !== baseline,
      overrideAmount: numOverride,
    };
  }

  return {
    budget: baseline,
    baseline,
    isOverridden: false,
  };
}


