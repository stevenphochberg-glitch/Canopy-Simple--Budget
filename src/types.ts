/**
 * Canopy Budgeting App - Core Data Types & Interfaces
 */

export type AccountType = 'single' | 'couple' | 'family' | 'roommate';
export type PaySchedule = 'weekly' | 'bi-weekly' | 'monthly' | 'none';
export type CalendarMode = 'weekly' | 'monthly';
export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface UserProfile {
  userId: string;
  name: string;
  avatarUrl: string;
  email: string;
  activeHouseholdId: string | null;
  createdAt?: string;
}

export interface HouseholdMember {
  userId: string;
  name: string;
  avatarUrl: string;
  rawIncome: number;
  incomeSchedule: PaySchedule;
  normalizedWeeklyIncome: number;
  hasProvidedIncome: boolean;
  isCurrentUser?: boolean;
}

export interface Household {
  id: string;
  syncCode: string; // 6-character string e.g. "CNP-8X2"
  accountType: AccountType;
  roommateCount?: number;
  weeklyIncomePool: number;
  calendarMode: CalendarMode;
  firstDayOfWeek: DayOfWeek;
  lastDayOfWeek: DayOfWeek;
  createdById: string;
  createdAt: string;
  name?: string;
}

export type CategoryGroup = 'Essentials' | 'Fun Money' | 'Bills' | 'Savings' | string;
export type TimeframeMode = 'week' | 'month';

export interface Category {
  id: string;
  name: string;
  group: CategoryGroup;
  baselineBudget: number;
  currentWeeklyBudget: number;
  subcategories?: string[];
  description?: string;
  totalLogged?: number;
  transactionCount?: number;
  icon?: string;
  color?: string;
}

export interface TransactionComment {
  id: string;
  expenseId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  timestamp: number;
}

export interface TransactionReaction {
  id: string;
  expenseId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  emoji: string;
  timestamp: number;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  categoryId: string;
  timestamp: number;
  date: string;
  loggedByUserId: string;
  receiptImgUrl?: string;
  comments?: TransactionComment[];
  reactions?: TransactionReaction[];
}

export interface StagedExpense {
  id?: string;
  amount: number;
  description: string;
  categoryId: string;
  date: string;
  loggedByUserId: string;
  receiptImgUrl?: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface CategoryRolloverDecision {
  categoryId: string;
  categoryName: string;
  spent: number;
  budget: number;
  difference: number; // positive = surplus (underspent), negative = deficit (overspent)
  choice: 'savings' | 'rollover' | 'deficit_absorbed';
  adjustmentPerWeek: number; // amount added or subtracted to weekly budget for remainder of month
  previousWeeklyBudget: number;
  newWeeklyBudget: number;
  savingsContribution: number;
}

export interface CheckIn {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  status: 'completed' | 'past-due' | 'pending';
  completedByUserId?: string;
  completedByName?: string;
  timestamp?: number;
  notes?: string;
  decisions?: CategoryRolloverDecision[];
  totalSaved?: number;
  totalSpent?: number;
  totalBudget?: number;
}

export interface CheckInStatusInfo {
  status: 'pending' | 'past-due' | 'completed' | 'upcoming';
  isLastDayOfWeek: boolean;
  isPastDue: boolean;
  isFirstWeekGracePeriod: boolean;
  daysUntilCheckIn: number;
  checkInDayName: string;
  lastCompletedCheckIn: CheckIn | null;
  activeWeekRange: DateRange;
  missedWeeksCount: number;
  remainingWeeksInMonth: number;
}

export interface MonthlyRetrospectiveData {
  monthName: string;
  totalBudget: number;
  totalSpent: number;
  totalSurplus: number;
  totalDeficit: number;
  totalSaved: number;
  topOverspentCategories: Array<{ categoryName: string; overspent: number }>;
  topSavingsCategories: Array<{ categoryName: string; underspent: number }>;
  intentions?: string;
  completedAt?: number;
}

export interface FeedItem {
  id: string;
  type: 'transaction' | 'comment' | 'reaction' | 'checkin' | 'freshStart' | 'monthEndReset' | 'message';
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  timestamp: number;
  date?: string;
  linkedExpenseId?: string;
  linkedExpense?: {
    id: string;
    description: string;
    categoryName: string;
    categoryIcon?: string;
    amount: number;
    date: string;
    payerName?: string;
  };
  emoji?: string;
  metadata?: {
    totalSaved?: number;
    totalSpent?: number;
    totalBudget?: number;
    [key: string]: any;
  };
}

export interface OnboardingData {
  accountType: AccountType;
  roommateCount: number;
  members: HouseholdMember[];
  calendarMode: CalendarMode;
  firstDayOfWeek: DayOfWeek;
}

export type ActiveTab = 'dashboard' | 'ledger' | 'checkin' | 'feed' | 'settings';
