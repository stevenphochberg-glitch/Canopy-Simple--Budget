import { DayOfWeek, PaySchedule, HouseholdMember, Category, TimeframeMode, DateRange, Expense } from '../types';

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
/**
 * Returns default Top-Level Budget Buckets (Essentials, Fun Money, Bills, Savings).
 * Subcategories are listed as examples for the transaction ledger.
 */
export function getDefaultCategories(weeklyIncomePool: number): Category[] {
  const pool = weeklyIncomePool > 0 ? weeklyIncomePool : 1500;

  // Proportional baseline distribution across top-level buckets summing to 100% of pool
  const buckets: Array<{
    id: string;
    name: string;
    group: string;
    icon: string;
    color: string;
    weight: number;
    subcategories: string[];
    description: string;
  }> = [
    {
      id: 'cat_essentials',
      name: 'Essentials',
      group: 'Essentials',
      icon: 'shopping-bag',
      color: 'sage',
      weight: 0.40,
      subcategories: ['Groceries', 'Gas & Transit', 'Personal Goods', 'Home Goods', 'Health & Pharmacy'],
      description: 'Groceries, transportation, household supplies, and health necessities.',
    },
    {
      id: 'cat_fun_money',
      name: 'Fun Money',
      group: 'Fun Money',
      icon: 'sparkles',
      color: 'sky-blue',
      weight: 0.20,
      subcategories: ['Restaurants & Dining', 'Coffee & Drinks', 'Shopping', 'Entertainment & Hobbies'],
      description: 'Dining out, coffee runs, entertainment, hobbies, and personal treats.',
    },
    {
      id: 'cat_bills',
      name: 'Bills',
      group: 'Bills',
      icon: 'file-text',
      color: 'brown',
      weight: 0.25,
      subcategories: ['Mortgage / Rent', 'Utilities & Electric', 'Subscriptions & Phone', 'Insurance & Services'],
      description: 'Recurring monthly housing, utilities, digital subscriptions, and fixed payments.',
    },
    {
      id: 'cat_savings',
      name: 'Savings',
      group: 'Savings',
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
 */
export function getMonthRange(refDate: Date, monthOffset: number = 0): DateRange {
  const target = new Date(refDate.getFullYear(), refDate.getMonth() + monthOffset, 1);
  const start = new Date(target.getFullYear(), target.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59, 999);

  return {
    startDate: start,
    endDate: end,
    label: target.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
}

/**
 * Extracts a normalized numeric epoch millisecond timestamp from an expense object.
 * Robustly parses Firestore Timestamp objects (with toMillis, toDate, or seconds),
 * numeric timestamps, ISO date strings, and local YYYY-MM-DD date strings.
 */
export function parseExpenseTimestamp(expense: { timestamp?: any; date?: string; createdAt?: any }): number {
  const ts = expense.timestamp || expense.createdAt;
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
    // If expense.date is YYYY-MM-DD, parse as local midday to avoid timezone offset shifts
    const parts = expense.date.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day, 12, 0, 0).getTime();
    }
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
 * Normalizes a weekly budget to monthly equivalent when in Month view
 */
export function getCategoryBudgetForTimeframe(weeklyBudget: number, mode: TimeframeMode): number {
  if (mode === 'month') {
    return Math.round((weeklyBudget * 52) / 12);
  }
  return weeklyBudget;
}

/**
 * Calculates spending and transaction count for a category within a date range
 */
export function calculateCategorySpending(
  expenses: Expense[],
  categoryId: string,
  start: Date,
  end: Date
): { totalSpent: number; count: number } {
  let totalSpent = 0;
  let count = 0;

  for (const exp of expenses) {
    if (exp.categoryId === categoryId && isExpenseInDateRange(exp, start, end)) {
      totalSpent += Number(exp.amount) || 0;
      count += 1;
    }
  }

  return { totalSpent, count };
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

