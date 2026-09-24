/**
 * Canopy Budgeting App - Core Data Types & Interfaces
 */

export type AccountType = 'single' | 'couple' | 'family' | 'roommate' | 'join';
export type PaySchedule = 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly' | 'none';
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
  householdIds?: string[];
  createdAt?: string;
}

export type IncomeType = 'scheduled' | 'variable' | 'predictable';

export type VariableIncomeSubOption = 'context' | 'project' | 'projects' | 'hourly' | 'manual';

export interface ActiveProjectIncome {
  id: string;
  projectName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalScheduledIncome: number;
  payerMemberId?: string;
  memberId?: string;
  notes?: string;
}

export interface HourlyIncomeConfig {
  id: string;
  title?: string;
  hourlyRate: number;
  estimatedHoursPerWeek: number;
  paySchedule?: PaySchedule;
  payFrequency?: PaySchedule;
  payerMemberId?: string;
  memberId?: string;
}

export interface ManualIncomeEntry {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payerMemberId?: string;
  destination?: 'Income Buffer';
  category?: string;
  notes?: string;
}

export interface OneOffDeposit {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  payerMemberId?: string;
  notes?: string;
  comments?: TransactionComment[];
  reactions?: TransactionReaction[];
}

export interface VariableIncomeState {
  activeSubOption: VariableIncomeSubOption;
  scenarioContext?: string;
  projects?: ActiveProjectIncome[];
  hourlyConfigs?: HourlyIncomeConfig[];
  manualEntries?: ManualIncomeEntry[];
}

export interface HouseholdMember {
  userId: string;
  name: string;
  avatarUrl: string;
  rawIncome: number;
  incomeSchedule: PaySchedule;
  lastPayDate?: string; // YYYY-MM-DD
  normalizedWeeklyIncome: number;
  hasProvidedIncome: boolean;
  isCurrentUser?: boolean;
  isPlaceholder?: boolean;
}

export interface Household {
  id: string;
  syncCode: string; // 6-character string e.g. "CNP-8X2"
  accountType: AccountType;
  incomeType?: IncomeType;
  baselineWeeklyBurnRate?: number;
  initialBufferAmount?: number;
  variableIncomeState?: VariableIncomeState;
  oneOffDeposits?: OneOffDeposit[];
  roommateCount?: number | null;
  weeklyIncomePool: number;
  calendarMode: CalendarMode;
  firstDayOfWeek: DayOfWeek;
  lastDayOfWeek: DayOfWeek;
  fiscalYearEndMonth?: number; // 1-12, default 12 (December)
  extraPaycheckDecisions?: Record<string, ExtraPaycheckDecision>;
  createdById: string;
  createdAt: string;
  name?: string;
  lastAutomatedDrawdownWeek?: string;
  weeklyOverrides?: Record<string, Record<string, number>>; // [weekId]: { [categoryIdOrSlug: string]: number }
}

export interface FiscalMonth {
  fiscalMonthNumber: number; // 1 to 12 (or 13 in rare cases)
  quarter: number; // 1, 2, 3, 4
  weekCount: number; // 4, 4, 5, or 6
  name: string;
  monthName: string;
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface ExtraPaycheckInfo {
  isExtraPaycheckMonth: boolean;
  memberBreakdown: Array<{
    memberId: string;
    memberName: string;
    paySchedule: PaySchedule;
    expectedPaychecks: number;
    standardPaychecks: number;
    extraCount: number;
    extraAmount: number;
    payDates: string[];
  }>;
  totalExtraIncome: number;
  fiscalMonthName: string;
  monthKey: string;
  quarter: number;
}

export interface ExtraPaycheckDecision {
  monthKey: string;
  option: 'savings' | 'prorate' | 'extra_week_buffer' | 'custom';
  customPercentages?: Record<string, number>;
  totalExtraIncome: number;
  extraWeekBufferAmount?: number;
  savingsPortion?: number;
  appliedAt: number;
}

export type CategoryGroup = 'Essentials' | 'Fun Money' | 'Bills' | 'Savings' | string;
export type CategoryType = 'expense' | 'savings';
export type TimeframeMode = 'week' | 'month';

export interface SavingsGoal {
  id: string;
  name: string; // e.g. Down Payment, Student Debt, Emergency Fund, Vacation, Appliance
  targetAmount: number; // $ Target Goal Amount
  currentAmount: number; // $ Current Allocated Amount
  categoryId?: string; // Linked Savings Category ID
  targetDate?: string; // Optional target completion date
  isAchieved?: boolean;
  achievedAt?: string; // YYYY-MM-DD
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  group: CategoryGroup;
  type: CategoryType; // Required field: 'expense' | 'savings'
  baselineBudget: number;
  currentWeeklyBudget: number;
  prorationOverride?: number; // Forward-only proration adjustment for the current month
  subcategories?: string[];
  description?: string;
  totalLogged?: number;
  transactionCount?: number;
  icon?: string;
  color?: string;
  savingsGoals?: SavingsGoal[];
  rolloverPreference?: string;
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

export type BillFrequency = 'weekly' | 'monthly' | 'annually';

export interface Expense {
  id: string;
  amount: number;
  description: string;
  categoryId: string;
  timestamp: number;
  date: string;
  loggedByUserId: string;
  receiptImgUrl?: string;
  billFrequency?: BillFrequency;
  tags?: string[];
  subcategory?: string;
  depositDestination?: 'savings_budget' | 'goal';
  targetGoalId?: string;
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
  billFrequency?: BillFrequency;
  tags?: string[];
  subcategory?: string;
  depositDestination?: 'savings_budget' | 'goal';
  targetGoalId?: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export type OverspendResolutionChoice = 'deduct_savings' | 'reduce_future';
export type UnderspendResolutionChoice = 'savings' | 'rollover';

export interface CategoryRolloverDecision {
  categoryId: string;
  categoryName: string;
  spent: number;
  budget: number;
  baselineBudget?: number;
  isOverridden?: boolean;
  difference: number; // positive = surplus (underspent), negative = deficit (overspent)
  choice: 'savings' | 'rollover' | 'deficit_absorbed' | 'deduct_savings' | 'reduce_future' | 'savings_deficit_fill';
  overspendChoice?: OverspendResolutionChoice;
  underspendChoice?: UnderspendResolutionChoice;
  isProrationDisabled?: boolean;
  savingsDeduction?: number;
  futureWeeklyReduction?: number;
  forcedFallbackApplied?: boolean;
  effectiveSavingsReduced?: number;
  adjustmentPerWeek: number; // amount added or subtracted to weekly budget for remainder of month
  previousWeeklyBudget: number;
  newWeeklyBudget: number;
  savingsContribution: number;
  savingsGoalId?: string; // Optional target savings goal for the contribution
}

export interface CheckIn {
  id: string;
  fiscalWeekId?: string;
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
  type: 'transaction' | 'comment' | 'reaction' | 'checkin' | 'freshStart' | 'monthEndReset' | 'message' | 'savingsGoalAchieved' | 'milestone';
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
  savingsGoal?: {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
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
  incomeType?: IncomeType;
  baselineWeeklyBurnRate?: number;
  initialBufferAmount?: number;
  variableIncomeState?: VariableIncomeState;
  oneOffDeposits?: OneOffDeposit[];
  roommateCount: number;
  members: HouseholdMember[];
  categories?: Category[];
  calendarMode: CalendarMode;
  firstDayOfWeek: DayOfWeek;
  fiscalYearEndMonth?: number; // 1-12, default 12
  syncCode?: string;
}

export type ActiveTab = 'dashboard' | 'ledger' | 'checkin' | 'feed' | 'settings';
