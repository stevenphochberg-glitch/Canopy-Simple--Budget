/**
 * Canopy Budgeting App - Universal Household State & Persistence Engine
 * Live Firestore Subscriptions, Dynamic Allocations, Real-time Feeds & Social Interactions
 * Project ID: canopy-d29a1
 */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AccountType,
  CalendarMode,
  Category,
  CheckIn,
  DayOfWeek,
  Expense,
  Household,
  HouseholdMember,
  OnboardingData,
  UserProfile,
  ActiveTab,
  StagedExpense,
  CategoryRolloverDecision,
  ExtraPaycheckDecision,
  TimeframeMode,
  DateRange,
  FeedItem,
  TransactionComment,
  TransactionReaction,
  OneOffDeposit,
  SavingsGoal,
} from '../types';
import {
  calculateWeeklyPool,
  getDefaultCategories,
  getCheckInDay,
  generateSyncCode,
  normalizeToWeekly,
  getWeekRange,
  getMonthRange,
  parseExpenseTimestamp,
  formatCurrency,
  getWeekId,
  getFutureWeeksInFiscalMonth,
  formatLocalDate,
  getTodayLocalDateString,
} from '../lib/calculations';
import { getFiscalWeekId, getFiscalMonthForDate } from '../lib/fiscal445';
import { getReactionDef } from '../components/Common/EarthToneReaction';
import { auth, db, googleProvider, isFirebaseConfigured, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithPopup,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  writeBatch,
  increment,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';

/**
 * Recursively sanitizes any payload before writing to Firestore.
 * Replaces undefined values with null or strips keys with undefined values,
 * preventing Firestore runtime crashes when fields are undefined.
 * Preserves Date, Timestamp, and Firestore FieldValue instances (increment, serverTimestamp).
 */
export function sanitizeFirestorePayload<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  // Preserve Date, Timestamp, FieldValue instances
  if (
    data instanceof Date ||
    (data.constructor &&
      data.constructor.name !== 'Object' &&
      data.constructor.name !== 'Array')
  ) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeFirestorePayload(item)) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value === undefined) {
      clean[key] = null;
    } else if (value !== null && typeof value === 'object') {
      clean[key] = sanitizeFirestorePayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean as T;
}

/**
 * Universal evaluator for whether a transaction is a One-Time / One-Off Deposit.
 * Accurately recognizes one-time deposits regardless of whether they were created
 * through the direct one-time deposit flow or legacy/staged expense flow.
 */
export const isExpenseOneTimeDeposit = (
  exp?: Partial<Expense> | Partial<StagedExpense> | null
): boolean => {
  if (!exp) return false;
  if (exp.categoryId === 'cat_one_time_deposit' || (exp.depositDestination as string) === 'savings_budget') {
    return true;
  }
  if (
    exp.tags &&
    exp.tags.some((t) => {
      const l = t.toLowerCase();
      return (
        l === 'one-time deposit' ||
        l === 'one-off deposit' ||
        l.includes('deposit') ||
        l.includes('budget expansion')
      );
    })
  ) {
    if (
      exp.categoryId === 'cat_one_time_deposit' ||
      Boolean(exp.description && exp.description.toLowerCase().includes('deposit'))
    ) {
      return true;
    }
  }
  if (
    exp.description &&
    (exp.description.toLowerCase().startsWith('one-off deposit') ||
      exp.description.toLowerCase().startsWith('one-time deposit'))
  ) {
    return true;
  }
  return false;
};

export interface HouseholdContextType {
  user: UserProfile | null;
  household: Household | null;
  members: HouseholdMember[];
  categories: Category[];
  expenses: Expense[];
  checkIns: CheckIn[];
  feedItems: FeedItem[];
  isLoading: boolean;
  isHouseholdLoading: boolean;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOnboarding: boolean;
  setIsOnboarding: (val: boolean) => void;

  // Lateral Category Drill-Down Navigation State
  selectedLedgerCategoryId: string | null;
  setSelectedLedgerCategoryId: (catId: string | null) => void;
  navigateToCategoryLedger: (catId: string | null) => void;
  ledgerDateRangeLabel: string;
  setLedgerDateRangeLabel: (val: string) => void;

  // Social Feed & Transaction Interactions
  addTransactionComment: (expenseId: string, text: string) => Promise<void>;
  addTransactionReaction: (expenseId: string, emoji: string) => Promise<void>;
  postFeedMessage: (content: string) => Promise<void>;

  // Timeframe filter state
  timeframeMode: TimeframeMode;
  setTimeframeMode: (mode: TimeframeMode) => void;
  timeframeOffset: number;
  setTimeframeOffset: (offset: number | ((prev: number) => number)) => void;
  resetTimeframeToCurrent: () => void;
  activeDateRange: DateRange;

  // Staging modal & state
  isStagingModalOpen: boolean;
  stagedExpenses: StagedExpense[];
  openStagingModal: (initial?: StagedExpense | StagedExpense[]) => void;
  closeStagingModal: () => void;
  addStagedItem: (item?: Partial<StagedExpense>) => void;
  updateStagedItem: (index: number, updates: Partial<StagedExpense>) => void;
  removeStagedItem: (index: number) => void;
  confirmAllStagedExpenses: () => Promise<void>;

  // Log Expense Modal
  isLogExpenseModalOpen: boolean;
  logExpenseInitialCategory: Category | string | null;
  isCategoryLockedInModal: boolean;
  openLogExpenseModal: (category?: Category | string | null, isLocked?: boolean) => void;
  closeLogExpenseModal: () => void;

  // Tag CRUD with Cascading Database Updates
  addCustomTag: (tag: string, categoryId?: string) => Promise<void>;
  renameTag: (oldTag: string, newTag: string, categoryId?: string) => Promise<void>;
  deleteTag: (tagToDelete: string, categoryId?: string) => Promise<void>;

  // CheckIn & Retrospective modals
  isWeeklyCheckInModalOpen: boolean;
  weeklyCheckInTargetRange: DateRange | null;
  openWeeklyCheckInModal: (targetRange?: DateRange | null) => void;
  closeWeeklyCheckInModal: () => void;
  isMonthlyRetroModalOpen: boolean;
  openMonthlyRetroModal: () => void;
  closeMonthlyRetroModal: () => void;
  isAllocationModalOpen: boolean;
  openAllocationModal: () => void;
  closeAllocationModal: () => void;
  completeWeeklyCheckIn: (data: {
    weekStartDate: string;
    weekEndDate: string;
    notes?: string;
    decisions: CategoryRolloverDecision[];
    totalSaved: number;
    totalSpent: number;
    totalBudget: number;
  }) => Promise<void>;
  deleteWeeklyCheckIn: (checkInId: string) => Promise<void>;
  updateCheckInNotes: (checkInId: string, notes: string) => Promise<void>;
  updateCheckIn: (checkInId: string, updates: Partial<CheckIn>) => Promise<void>;
  triggerFreshStartAction: () => Promise<void>;
  executeMonthEndResetAction: () => Promise<void>;

  // Category mutations
  createCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  saveCategoryAllocations: (updatedCategories: Category[]) => Promise<void>;

  // Savings Goals subcollections
  savingsGoals: SavingsGoal[];
  createSavingsGoal: (goal: Omit<SavingsGoal, 'id'>) => Promise<void>;
  updateSavingsGoal: (id: string, updates: Partial<SavingsGoal>) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
  allocateSavingsToGoals: (allocations: Record<string, number>) => Promise<void>;

  // Expense mutations
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;

  // Toast notifications
  toastMessage: string | null;
  toastType: 'info' | 'error' | 'success';
  showToast: (msg: string, type?: 'info' | 'error' | 'success') => void;

  // Auth & Household Core
  signInWithGoogle: () => Promise<void>;
  switchActiveMember: (memberId: string) => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  joinHouseholdWithSyncCode: (
    syncCode: string,
    claimPlaceholderMemberId?: string,
    memberCustomData?: Partial<HouseholdMember>
  ) => Promise<{ success: boolean; message?: string }>;
  getHouseholdBySyncCode: (
    syncCode: string
  ) => Promise<{ household: Household; members: HouseholdMember[] } | null>;
  leaveHousehold: () => Promise<void>;
  removeHouseholdMember: (memberId: string) => Promise<void>;
  updateHousehold: (updated: Partial<Household>) => Promise<void>;
  updateMemberIncome: (
    memberId: string,
    rawIncome: number,
    schedule: HouseholdMember['incomeSchedule'],
    hasProvided: boolean,
    lastPayDate?: string
  ) => Promise<void>;
  addOneOffDeposit: (depositData: {
    description: string;
    amount: number;
    date: string;
    payerMemberId?: string;
    notes?: string;
  }) => Promise<void>;
  updateDeposit: (depositId: string, updates: Partial<OneOffDeposit>) => Promise<void>;
  deleteDeposit: (depositId: string) => Promise<void>;
  applyExtraPaycheckDecision: (decision: ExtraPaycheckDecision) => Promise<void>;
  resetHouseholdToOnboarding: () => void;

  // Multi-Household Switcher & Automated Buffer Drawdown
  userHouseholds: Household[];
  switchHousehold: (householdId: string) => Promise<void>;
  triggerAutomatedDrawdown: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication & Async State Tracking
  const [user, setUser] = useState<UserProfile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [userHouseholds, setUserHouseholds] = useState<Household[]>([]);
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  const [currentAuthUser, setCurrentAuthUser] = useState<any>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isHouseholdLoading, setIsHouseholdLoading] = useState<boolean>(false);

  // Helper to fetch all joined household documents for the multi-household switcher
  const refreshUserHouseholds = useCallback(
    async (householdIds: string[]) => {
      if (!isFirebaseConfigured || !db || !householdIds || householdIds.length === 0) {
        setUserHouseholds([]);
        return;
      }
      try {
        const uniqueIds = Array.from(new Set(householdIds)).filter(Boolean);
        const list: Household[] = [];
        for (const hid of uniqueIds) {
          try {
            const snap = await getDoc(doc(db, 'households', hid));
            if (snap.exists()) {
              list.push({ ...(snap.data() as Household), id: snap.id });
            }
          } catch (e) {
            console.warn(`[HouseholdContext] Could not fetch household ${hid}:`, e);
          }
        }
        setUserHouseholds(list);
      } catch (e) {
        console.warn('[HouseholdContext] refreshUserHouseholds error:', e);
      }
    },
    []
  );

  // UI Navigation & View Modes
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);

  // Lateral Category Drill-Down Navigation State
  const [selectedLedgerCategoryId, setSelectedLedgerCategoryId] = useState<string | null>(null);
  const [ledgerDateRangeLabel, setLedgerDateRangeLabel] = useState<string>('');

  const navigateToCategoryLedger = (catId: string | null) => {
    setSelectedLedgerCategoryId(catId);
    setActiveTab('ledger');
  };

  // Timeframe filter state
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>('week');
  const [timeframeOffset, setTimeframeOffset] = useState<number>(0);

  // Staging Modal & Batch Staged Items State
  const [isStagingModalOpen, setIsStagingModalOpen] = useState<boolean>(false);
  const [stagedExpenses, setStagedExpenses] = useState<StagedExpense[]>([]);

  // Log Expense Modal State
  const [isLogExpenseModalOpen, setIsLogExpenseModalOpen] = useState<boolean>(false);
  const [logExpenseInitialCategory, setLogExpenseInitialCategory] = useState<Category | string | null>(null);
  const [isCategoryLockedInModal, setIsCategoryLockedInModal] = useState<boolean>(false);

  const openLogExpenseModal = (category?: Category | string | null, isLocked: boolean = false) => {
    if (typeof category === 'string') {
      if (category === 'deposits' || category === 'cat_one_time_deposit') {
        setLogExpenseInitialCategory({
          id: 'cat_one_time_deposit',
          name: 'Income & Deposits',
          group: 'Savings',
          type: 'savings',
          baselineBudget: 0,
          currentWeeklyBudget: 0,
        });
      } else {
        const found = categories.find((c) => c.id === category);
        setLogExpenseInitialCategory(found || category);
      }
    } else {
      setLogExpenseInitialCategory(category || null);
    }
    setIsCategoryLockedInModal(isLocked);
    setIsLogExpenseModalOpen(true);
  };

  const closeLogExpenseModal = () => {
    setIsLogExpenseModalOpen(false);
    setLogExpenseInitialCategory(null);
    setIsCategoryLockedInModal(false);
  };

  // CheckIn & Retrospective Modals State
  const [isWeeklyCheckInModalOpen, setIsWeeklyCheckInModalOpen] = useState<boolean>(false);
  const [weeklyCheckInTargetRange, setWeeklyCheckInTargetRange] = useState<DateRange | null>(null);
  const [isMonthlyRetroModalOpen, setIsMonthlyRetroModalOpen] = useState<boolean>(false);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState<boolean>(false);

  const openWeeklyCheckInModal = (targetRange?: DateRange | null) => {
    setWeeklyCheckInTargetRange(targetRange || null);
    setIsWeeklyCheckInModalOpen(true);
  };
  const closeWeeklyCheckInModal = () => {
    setIsWeeklyCheckInModalOpen(false);
    setWeeklyCheckInTargetRange(null);
  };
  const openMonthlyRetroModal = () => setIsMonthlyRetroModalOpen(true);
  const closeMonthlyRetroModal = () => setIsMonthlyRetroModalOpen(false);
  const openAllocationModal = () => setIsAllocationModalOpen(true);
  const closeAllocationModal = () => setIsAllocationModalOpen(false);

  // Toast state
  const [toastInfo, setToastInfo] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  const showToast = useCallback((msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToastInfo({ message: msg, type });
    setTimeout(() => {
      setToastInfo((curr) => (curr?.message === msg ? null : curr));
    }, 4000);
  }, []);

  const toastMessage = toastInfo?.message || null;
  const toastType = toastInfo?.type || 'info';

  // Compute active date range based on mode, offset, and household firstDayOfWeek
  const activeDateRange = useMemo<DateRange>(() => {
    const now = new Date();
    const firstDay = household?.firstDayOfWeek || 'Monday';
    const fiscalYearEnd = household?.fiscalYearEndMonth || 12;
    if (timeframeMode === 'week') {
      return getWeekRange(now, firstDay, timeframeOffset);
    } else {
      return getMonthRange(now, timeframeOffset, fiscalYearEnd);
    }
  }, [timeframeMode, timeframeOffset, household?.firstDayOfWeek, household?.fiscalYearEndMonth]);

  const resetTimeframeToCurrent = () => {
    setTimeframeOffset(0);
  };

  // Active Firestore listeners reference & clean unsubscription helper
  const activeListenersRef = useRef<(() => void)[]>([]);

  const unsubscribeAllListeners = useCallback(() => {
    if (activeListenersRef.current && activeListenersRef.current.length > 0) {
      const listeners = [...activeListenersRef.current];
      activeListenersRef.current = [];
      listeners.forEach((unsub) => {
        try {
          if (typeof unsub === 'function') {
            unsub();
          }
        } catch (e) {
          console.warn('Error unsubscribing listener:', e);
        }
      });
    }
  }, []);

  // 1. Live Firebase Auth Listener & Session Binding
  useEffect(() => {
    if (isFirebaseConfigured && auth && db) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setCurrentAuthUser(firebaseUser);
        setAuthInitialized(true);

        if (firebaseUser) {
          try {
            setIsLoading(true);
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userDocRef);

            let activeHouseholdId: string | null = null;
            let householdIds: string[] = [];
            let userProfileName = firebaseUser.displayName || 'Canopy Member';
            let userProfileAvatar =
              firebaseUser.photoURL ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

            if (userSnap.exists()) {
              const userData = userSnap.data();
              activeHouseholdId = userData.activeHouseholdId || null;
              householdIds = Array.isArray(userData.householdIds)
                ? userData.householdIds
                : (userData.activeHouseholdId ? [userData.activeHouseholdId] : []);
              if (userData.name) userProfileName = userData.name;
              if (userData.avatarUrl) userProfileAvatar = userData.avatarUrl;
            } else {
              // Create user document in Firestore on first sign-in
              await setDoc(
                userDocRef,
                sanitizeFirestorePayload({
                  userId: firebaseUser.uid,
                  name: userProfileName,
                  email: firebaseUser.email || '',
                  avatarUrl: userProfileAvatar,
                  activeHouseholdId: null,
                  householdIds: [],
                  createdAt: new Date().toISOString(),
                })
              );
            }

            const profile: UserProfile = {
              userId: firebaseUser.uid,
              name: userProfileName,
              email: firebaseUser.email || '',
              avatarUrl: userProfileAvatar,
              activeHouseholdId,
              householdIds,
              createdAt: new Date().toISOString(),
            };
            setUser(profile);

            // Fetch all joined households for multi-household switcher
            if (householdIds.length > 0) {
              refreshUserHouseholds(householdIds);
            } else {
              setUserHouseholds([]);
            }

            // If activeHouseholdId exists, verify it exists in Firestore
            if (activeHouseholdId) {
              const householdDocRef = doc(db, 'households', activeHouseholdId);
              const hhSnap = await getDoc(householdDocRef);
              if (hhSnap.exists()) {
                const loadedHousehold = { ...(hhSnap.data() as Household), id: hhSnap.id };
                setHousehold(loadedHousehold);
                setIsOnboarding(false);
                setIsLoading(false);
                return;
              }
            }

            // User has no active household or left household -> open Setup Wizard
            setHousehold(null);
            setIsOnboarding(true);
            setIsLoading(false);
          } catch (err) {
            console.error('Firestore Error loading user session:', err);
            handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
            showToast(`Session load note: ${err instanceof Error ? err.message : String(err)}`, 'error');
            setHousehold(null);
            setIsOnboarding(true);
            setIsLoading(false);
          }
        } else {
          // Logged out
          setCurrentAuthUser(null);
          setAuthInitialized(true);
          unsubscribeAllListeners();
          setUser(null);
          setHousehold(null);
          setUserHouseholds([]);
          setMembers([]);
          setCategories([]);
          setExpenses([]);
          setCheckIns([]);
          setFeedItems([]);
          setIsOnboarding(false);
          setIsLoading(false);
        }
      });
      return () => unsubscribe();
    } else {
      // Firebase not configured yet
      setIsLoading(false);
      setAuthInitialized(true);
    }
  }, [showToast, unsubscribeAllListeners, refreshUserHouseholds]);

  // 2. Live Firestore Subscriptions for Household, Categories, Members, Expenses, CheckIns, and Feed
  useEffect(() => {
    // Unsubscribe from any previously active listeners before establishing new ones
    unsubscribeAllListeners();

    // 1. FIX FIREBASE LISTENER RACE CONDITION:
    // Explicitly wait for Firebase Auth to finish initializing and for currentUser to be truthy.
    // If currentUser is null or loading, do not attach the data listeners.
    if (
      !isFirebaseConfigured ||
      !db ||
      !authInitialized ||
      !currentAuthUser ||
      !auth?.currentUser ||
      !user?.userId ||
      !household?.id ||
      isLoading
    ) {
      return;
    }

    const householdId = household.id;
    setIsHouseholdLoading(true);

    // Household document listener
    const unsubHousehold = onSnapshot(
      doc(db, 'households', householdId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Household;
          setHousehold({ ...data, id: snapshot.id });
        }
        setIsHouseholdLoading(false);
      },
      (err) => {
        setIsHouseholdLoading(false);
        console.warn(`[Firestore] Household listener note:`, err);
      }
    );

    // Categories listener
    const unsubCategories = onSnapshot(
      collection(db, 'households', householdId, 'categories'),
      (snapshot) => {
        const loadedCats = snapshot.docs.map((d) => ({
          ...(d.data() as Category),
          id: d.id,
        }));
        setCategories(loadedCats);
      },
      (err) => {
        console.warn(`[Firestore] Categories listener note:`, err);
      }
    );

    // Members listener
    const unsubMembers = onSnapshot(
      collection(db, 'households', householdId, 'members'),
      (snapshot) => {
        const loadedMembers = snapshot.docs.map((d) => ({
          ...(d.data() as HouseholdMember),
          userId: d.id,
          isCurrentUser: d.id === user?.userId,
        }));
        setMembers(loadedMembers);
      },
      (err) => {
        console.warn(`[Firestore] Members listener note:`, err);
      }
    );

    // Expenses listener
    const unsubExpenses = onSnapshot(
      collection(db, 'households', householdId, 'expenses'),
      (snapshot) => {
        const rawExpenses = snapshot.docs.map((d) => {
          const data = d.data();
          const normalizedTs = parseExpenseTimestamp({
            timestamp: data.timestamp,
            createdAt: data.createdAt,
            date: data.date,
          });
          return {
            ...(data as Expense),
            id: d.id,
            timestamp: normalizedTs,
          };
        });

        // Segregate genuine expenses vs one-time deposits
        const legacyDepositExpenses = rawExpenses.filter(isExpenseOneTimeDeposit);
        const regularExpenses = rawExpenses.filter((e) => !isExpenseOneTimeDeposit(e));

        regularExpenses.sort((a, b) => b.timestamp - a.timestamp);
        setExpenses(regularExpenses);

        // If legacy deposit expenses are found, migrate them into household.oneOffDeposits
        if (legacyDepositExpenses.length > 0) {
          setHousehold((currentHh) => {
            if (!currentHh) return currentHh;
            const existingDeps = currentHh.oneOffDeposits || [];
            let hasNew = false;
            const updatedDeps = [...existingDeps];

            legacyDepositExpenses.forEach((exp) => {
              const alreadyExists = existingDeps.some(
                (d) =>
                  d.id === exp.id ||
                  d.id === exp.id.replace('exp_', 'dep_') ||
                  (d.date === exp.date &&
                    Math.abs(d.amount - exp.amount) < 0.01 &&
                    d.description === exp.description)
              );
              if (!alreadyExists) {
                hasNew = true;
                updatedDeps.push({
                  id: exp.id,
                  description: exp.description || 'One-off Deposit',
                  amount: exp.amount,
                  date:
                    exp.date ||
                    (exp.timestamp
                      ? new Date(exp.timestamp).toISOString().split('T')[0]
                      : new Date().toISOString().split('T')[0]),
                  payerMemberId: exp.loggedByUserId,
                  notes: (exp.tags || []).join(', '),
                  comments: exp.comments,
                  reactions: exp.reactions,
                });
              }
            });

            if (hasNew) {
              if (isFirebaseConfigured && db && currentHh.id) {
                const hhDocRef = doc(db, 'households', currentHh.id);
                updateDoc(
                  hhDocRef,
                  sanitizeFirestorePayload({
                    oneOffDeposits: updatedDeps,
                    updatedAt: new Date().toISOString(),
                  })
                ).catch(console.error);

                // Clean up legacy expense documents from Firestore
                const batch = writeBatch(db);
                legacyDepositExpenses.forEach((exp) => {
                  batch.delete(doc(db, 'households', currentHh.id, 'expenses', exp.id));
                });
                batch.commit().catch(console.error);
              }
              return { ...currentHh, oneOffDeposits: updatedDeps };
            }
            return currentHh;
          });
        }
      },
      (err) => {
        console.warn(`[Firestore] Expenses listener note:`, err);
      }
    );

    // CheckIns listener
    const unsubCheckIns = onSnapshot(
      collection(db, 'households', householdId, 'checkins'),
      (snapshot) => {
        const loadedCheckIns = snapshot.docs.map((d) => {
          const item = d.data() as CheckIn;
          return {
            ...item,
            id: d.id,
            fiscalWeekId: item.fiscalWeekId || getFiscalWeekId(item.weekStartDate || item.weekEndDate || item.timestamp, household?.fiscalYearEndMonth || 12),
          };
        });
        loadedCheckIns.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setCheckIns(loadedCheckIns);
      },
      (err) => {
        console.warn(`[Firestore] Checkins listener note:`, err);
      }
    );

    // Activity Feed listener
    const unsubFeed = onSnapshot(
      collection(db, 'households', householdId, 'feed'),
      (snapshot) => {
        const loadedFeed = snapshot.docs.map((d) => ({
          ...(d.data() as FeedItem),
          id: d.id,
        }));
        loadedFeed.sort((a, b) => b.timestamp - a.timestamp);
        setFeedItems(loadedFeed);
      },
      (err) => {
        console.warn(`[Firestore] Feed listener note:`, err);
      }
    );

    // Savings Goals listener
    const unsubSavingsGoals = onSnapshot(
      collection(db, 'households', householdId, 'savingsGoals'),
      (snapshot) => {
        const loadedGoals = snapshot.docs.map((d) => ({
          ...(d.data() as SavingsGoal),
          id: d.id,
        }));
        if (loadedGoals.length === 0) {
          const defaultGoal: SavingsGoal = {
            id: `goal_emergency_${householdId}`,
            name: 'Emergency Savings Fund',
            targetAmount: 5000,
            currentAmount: 0,
            isAchieved: false,
          };
          setSavingsGoals([defaultGoal]);
          if (isFirebaseConfigured && db) {
            const goalRef = doc(db, 'households', householdId, 'savingsGoals', defaultGoal.id);
            setDoc(goalRef, sanitizeFirestorePayload(defaultGoal)).catch(console.error);
          }
        } else {
          setSavingsGoals(loadedGoals);
        }
      },
      (err) => {
        console.warn(`[Firestore] SavingsGoals listener note:`, err);
      }
    );

    activeListenersRef.current = [
      unsubHousehold,
      unsubCategories,
      unsubMembers,
      unsubExpenses,
      unsubCheckIns,
      unsubFeed,
      unsubSavingsGoals,
    ];

    return () => {
      unsubscribeAllListeners();
    };
  }, [authInitialized, currentAuthUser, user?.userId, household?.id, isLoading, unsubscribeAllListeners]);

  // Google Sign-In with real Firebase GoogleAuthProvider
  const signInWithGoogle = async () => {
    if (isFirebaseConfigured && auth && googleProvider && db) {
      try {
        setIsLoading(true);
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;

        const userDocRef = doc(db, 'users', fbUser.uid);
        const userSnap = await getDoc(userDocRef);

        let activeHouseholdId: string | null = null;
        let householdIds: string[] = [];
        let userName = fbUser.displayName || 'Canopy Member';
        let avatarUrl =
          fbUser.photoURL ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

        if (userSnap.exists()) {
          const uData = userSnap.data();
          activeHouseholdId = uData.activeHouseholdId || null;
          householdIds = Array.isArray(uData.householdIds)
            ? uData.householdIds
            : (uData.activeHouseholdId ? [uData.activeHouseholdId] : []);
          if (uData.name) userName = uData.name;
          if (uData.avatarUrl) avatarUrl = uData.avatarUrl;
        } else {
          await setDoc(
            userDocRef,
            sanitizeFirestorePayload({
              userId: fbUser.uid,
              name: userName,
              email: fbUser.email || '',
              avatarUrl,
              activeHouseholdId: null,
              householdIds: [],
              createdAt: new Date().toISOString(),
            })
          );
        }

        const profile: UserProfile = {
          userId: fbUser.uid,
          name: userName,
          email: fbUser.email || '',
          avatarUrl,
          activeHouseholdId,
          householdIds,
          createdAt: new Date().toISOString(),
        };
        setUser(profile);

        if (householdIds.length > 0) {
          refreshUserHouseholds(householdIds);
        } else {
          setUserHouseholds([]);
        }

        if (activeHouseholdId) {
          const hhRef = doc(db, 'households', activeHouseholdId);
          const hhSnap = await getDoc(hhRef);
          if (hhSnap.exists()) {
            const loadedHh = { ...(hhSnap.data() as Household), id: hhSnap.id };
            setHousehold(loadedHh);
            setIsOnboarding(false);
            setActiveTab('dashboard');
          } else {
            setHousehold(null);
            setIsOnboarding(true);
          }
        } else {
          setHousehold(null);
          setIsOnboarding(true);
        }

        setIsLoading(false);
        showToast(`Welcome to Canopy, ${userName.split(' ')[0]}!`);
      } catch (err: any) {
        setIsLoading(false);
        console.error('Firestore Sign-In Error:', err);
        handleFirestoreError(err, OperationType.WRITE, 'users');
        showToast(`Sign in error: ${err.message || String(err)}`, 'error');
        throw err;
      }
    } else {
      showToast('Firebase configuration is required for live sync.', 'error');
    }
  };

  const switchActiveMember = (memberId: string) => {
    const target = members.find((m) => m.userId === memberId);
    if (target && user) {
      setUser({
        ...user,
        userId: target.userId,
        name: target.name,
        avatarUrl: target.avatarUrl,
      });
      showToast(`Switched active profile to ${target.name}`);
    }
  };

  const signOut = async () => {
    unsubscribeAllListeners();
    if (isFirebaseConfigured && auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        console.error('Sign out error:', e);
      }
    }
    setUser(null);
    setHousehold(null);
    setMembers([]);
    setCategories([]);
    setExpenses([]);
    setCheckIns([]);
    setFeedItems([]);
    setIsOnboarding(false);
    showToast('Signed out of Canopy.');
  };

  // Complete Onboarding & Live Firestore writes
  const completeOnboarding = async (data: OnboardingData) => {
    if (!user) return;

    const syncCode = data.syncCode || household?.syncCode || generateSyncCode();
    const householdId = household?.id || `hh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const totalWeeklyPool = calculateWeeklyPool(data.members);
    const lastDay = getCheckInDay(data.firstDayOfWeek);

    const isRoommate = data.accountType?.toLowerCase() === 'roommate';
    const newHousehold: Household = {
      id: householdId,
      name: `${user.name.split(' ')[0]}'s Household`,
      syncCode,
      accountType: data.accountType,
      incomeType: data.incomeType || 'predictable',
      baselineWeeklyBurnRate: data.baselineWeeklyBurnRate,
      initialBufferAmount: data.initialBufferAmount,
      roommateCount: isRoommate ? Number(data.roommateCount) || 3 : null,
      weeklyIncomePool: totalWeeklyPool,
      calendarMode: data.calendarMode,
      firstDayOfWeek: data.firstDayOfWeek,
      lastDayOfWeek: lastDay,
      fiscalYearEndMonth: data.fiscalYearEndMonth || 12,
      createdById: user.userId,
      createdAt: new Date().toISOString(),
    };

    const initialCategories = data.categories && data.categories.length > 0
      ? data.categories
      : getDefaultCategories(totalWeeklyPool, data.incomeType, data.initialBufferAmount);

    const existingHouseholdIds = user.householdIds || [];
    const updatedHouseholdIds = Array.from(new Set([...existingHouseholdIds, householdId]));

    const updatedUser: UserProfile = {
      ...user,
      activeHouseholdId: householdId,
      householdIds: updatedHouseholdIds,
    };

    // 1. Optimistic React State update
    setHousehold(newHousehold);
    setMembers(data.members);
    setCategories(initialCategories);
    setUser(updatedUser);
    setUserHouseholds((prev) => [...prev.filter((h) => h.id !== householdId), newHousehold]);
    setIsOnboarding(false);
    setActiveTab('dashboard');

    // 2. Perform Live Firestore Writes
    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);

        // Write Household doc
        const householdRef = doc(db, 'households', householdId);
        batch.set(householdRef, sanitizeFirestorePayload(newHousehold));

        // Write User doc
        const userRef = doc(db, 'users', user.userId);
        batch.set(userRef, sanitizeFirestorePayload(updatedUser), { merge: true });

        // Write Members
        data.members.forEach((m) => {
          const memberRef = doc(db, 'households', householdId, 'members', m.userId);
          batch.set(memberRef, sanitizeFirestorePayload(m));
        });

        // Write Categories
        initialCategories.forEach((cat) => {
          const catRef = doc(db, 'households', householdId, 'categories', cat.id);
          batch.set(catRef, sanitizeFirestorePayload(cat));
        });

        // Add welcome message to Feed
        const feedRef = doc(db, 'households', householdId, 'feed', `feed_init_${Date.now()}`);
        batch.set(
          feedRef,
          sanitizeFirestorePayload({
            id: `feed_init_${Date.now()}`,
            type: 'message',
            content: `🌿 Welcome to Canopy! Sync Code: ${syncCode}. Category ledgers and shared finances are live.`,
            authorId: user.userId,
            authorName: user.name,
            authorAvatar: user.avatarUrl,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
          })
        );

        await batch.commit();
      } catch (error) {
        console.error('Firestore Setup Write Failed:', error);
        handleFirestoreError(error, OperationType.WRITE, `households/${householdId}`);
        showToast(`Firestore Write Failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }

    showToast('Household created & live budget buckets initialized.');
  };

  // Inspect existing household by 6-character Sync Code
  const getHouseholdBySyncCode = async (
    syncCode: string
  ): Promise<{ household: Household; members: HouseholdMember[] } | null> => {
    const rawClean = syncCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!rawClean || rawClean.length < 4 || !isFirebaseConfigured || !db) return null;

    try {
      const householdsRef = collection(db, 'households');
      const q = query(householdsRef);
      const snapshot = await getDocs(q);

      const targetDoc = snapshot.docs.find((d) => {
        const sc = d.data().syncCode;
        return sc && sc.toString().toUpperCase().replace(/[^A-Z0-9]/g, '') === rawClean;
      });

      if (!targetDoc) return null;

      const hhData = { ...targetDoc.data(), id: targetDoc.id } as Household;
      const membersSnap = await getDocs(collection(db, 'households', targetDoc.id, 'members'));
      const hhMembers = membersSnap.docs.map((d) => ({
        ...(d.data() as HouseholdMember),
        userId: d.id,
      }));

      return { household: hhData, members: hhMembers };
    } catch (e) {
      console.warn('getHouseholdBySyncCode error:', e);
      return null;
    }
  };

  // Join Existing Household by 6-character Sync Code with Optional Placeholder Claiming
  const joinHouseholdWithSyncCode = async (
    syncCode: string,
    claimPlaceholderMemberId?: string,
    memberCustomData?: Partial<HouseholdMember>
  ): Promise<{ success: boolean; message?: string }> => {
    const rawClean = syncCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!rawClean || rawClean.length < 4) {
      return { success: false, message: 'Please enter a valid sync code (e.g. CNP-8X2).' };
    }

    if (isFirebaseConfigured && db && user) {
      try {
        const householdsRef = collection(db, 'households');
        const q = query(householdsRef);
        const snapshot = await getDocs(q);

        const targetDoc = snapshot.docs.find((d) => {
          const sc = d.data().syncCode;
          return sc && sc.toString().toUpperCase().replace(/[^A-Z0-9]/g, '') === rawClean;
        });

        if (!targetDoc) {
          return {
            success: false,
            message: `No household found with sync code "${syncCode.trim()}". Please check the code and try again.`,
          };
        }

        const targetHouseholdData = { ...targetDoc.data(), id: targetDoc.id } as Household;
        const targetHouseholdId = targetDoc.id;

        const existingHouseholdIds = user.householdIds || [];
        const updatedHouseholdIds = Array.from(new Set([...existingHouseholdIds, targetHouseholdId]));

        const updatedUser: UserProfile = {
          ...user,
          activeHouseholdId: targetHouseholdId,
          householdIds: updatedHouseholdIds,
        };

        let placeholderData: Partial<HouseholdMember> | null = null;
        if (claimPlaceholderMemberId && claimPlaceholderMemberId !== user.userId) {
          try {
            const phSnap = await getDoc(
              doc(db, 'households', targetHouseholdId, 'members', claimPlaceholderMemberId)
            );
            if (phSnap.exists()) {
              placeholderData = phSnap.data() as HouseholdMember;
            }
          } catch (e) {
            console.warn('Could not read placeholder before claiming:', e);
          }
        }

        const rawIncome = memberCustomData?.rawIncome ?? placeholderData?.rawIncome ?? 1800;
        const schedule = memberCustomData?.incomeSchedule ?? placeholderData?.incomeSchedule ?? 'bi-weekly';

        const newMember: HouseholdMember = {
          userId: user.userId,
          name: memberCustomData?.name || placeholderData?.name || user.name,
          avatarUrl: memberCustomData?.avatarUrl || placeholderData?.avatarUrl || user.avatarUrl,
          rawIncome,
          incomeSchedule: schedule,
          normalizedWeeklyIncome: normalizeToWeekly(rawIncome, schedule),
          hasProvidedIncome: true,
          isCurrentUser: true,
          isPlaceholder: false,
        };

        const batch = writeBatch(db);
        const userRef = doc(db, 'users', user.userId);
        batch.set(userRef, sanitizeFirestorePayload(updatedUser), { merge: true });

        // If claiming an existing placeholder slot, remove the old placeholder document
        if (claimPlaceholderMemberId && claimPlaceholderMemberId !== user.userId) {
          const placeholderRef = doc(db, 'households', targetHouseholdId, 'members', claimPlaceholderMemberId);
          batch.delete(placeholderRef);
        }

        const memberRef = doc(db, 'households', targetHouseholdId, 'members', user.userId);
        batch.set(memberRef, sanitizeFirestorePayload(newMember), { merge: true });

        // Add member join announcement to feed
        const feedRef = doc(db, 'households', targetHouseholdId, 'feed', `feed_join_${Date.now()}`);
        batch.set(
          feedRef,
          sanitizeFirestorePayload({
            id: `feed_join_${Date.now()}`,
            type: 'message',
            content: claimPlaceholderMemberId
              ? `${user.name} claimed their profile in ${targetHouseholdData.name || 'the household'}!`
              : `${user.name} joined the household!`,
            authorId: user.userId,
            authorName: user.name,
            authorAvatar: user.avatarUrl,
            timestamp: Date.now(),
            date: new Date().toISOString().split('T')[0],
          })
        );

        await batch.commit();

        refreshUserHouseholds(updatedHouseholdIds);
        setUser(updatedUser);
        setHousehold(targetHouseholdData);
        setUserHouseholds((prev) => [...prev.filter((h) => h.id !== targetHouseholdId), targetHouseholdData]);
        setIsOnboarding(false);
        setActiveTab('dashboard');
        showToast(
          claimPlaceholderMemberId
            ? `Successfully claimed profile and joined ${targetHouseholdData.name || 'household'}!`
            : `Successfully connected to ${targetHouseholdData.name || 'household'}!`
        );
        return { success: true };
      } catch (err: any) {
        console.error('Firestore Join Failed:', err);
        handleFirestoreError(err, OperationType.WRITE, 'households');
        showToast(`Failed to join household: ${err.message || String(err)}`, 'error');
        return { success: false, message: err.message || 'Failed to join household.' };
      }
    }

    return { success: false, message: 'Please sign in to join a household.' };
  };

  // Multi-Household Switcher
  const switchHousehold = async (targetHouseholdId: string) => {
    if (!user || !targetHouseholdId) return;
    if (household?.id === targetHouseholdId) return;

    setIsLoading(true);
    unsubscribeAllListeners();

    try {
      const updatedUser: UserProfile = {
        ...user,
        activeHouseholdId: targetHouseholdId,
      };

      if (isFirebaseConfigured && db) {
        const userRef = doc(db, 'users', user.userId);
        await setDoc(userRef, sanitizeFirestorePayload(updatedUser), { merge: true });

        const hhSnap = await getDoc(doc(db, 'households', targetHouseholdId));
        if (hhSnap.exists()) {
          const loadedHh = { ...(hhSnap.data() as Household), id: hhSnap.id };
          setUser(updatedUser);
          setHousehold(loadedHh);
          setIsOnboarding(false);
          setActiveTab('dashboard');
          showToast(`Switched active household to ${loadedHh.name || 'household'}.`, 'success');
          return;
        }
      }

      setUser(updatedUser);
    } catch (e: any) {
      console.error('switchHousehold error:', e);
      showToast(`Could not switch household: ${e.message || String(e)}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Automated Drawdown from Income Buffer for Variable Income Households
  const triggerAutomatedDrawdown = async () => {
    if (!isFirebaseConfigured || !db || !household?.id || !user?.userId) return;

    const bufferCategory = categories.find(
      (c) => c.id === 'cat_income_buffer' || c.name.toLowerCase().includes('buffer')
    );
    if (!bufferCategory || (Number(bufferCategory.currentWeeklyBudget) || 0) <= 0) {
      showToast('No available buffer funds to draw down.', 'info');
      return;
    }

    const currentWeekKey = `${activeDateRange.startDate}_${activeDateRange.endDate}`;
    const nonBufferCategories = categories.filter((c) => c.id !== bufferCategory.id);
    const requiredFunding = nonBufferCategories.reduce(
      (sum, c) => sum + (Number(c.baselineBudget) || 0),
      0
    );

    if (requiredFunding <= 0) {
      showToast('No baseline category funding required.', 'info');
      return;
    }

    const availableBuffer = Number(bufferCategory.currentWeeklyBudget) || 0;
    const drawAmount = Math.min(availableBuffer, requiredFunding);
    if (drawAmount <= 0) return;

    try {
      const batch = writeBatch(db);

      const newBufferBudget = Math.max(0, availableBuffer - drawAmount);
      const bufferRef = doc(db, 'households', household.id, 'categories', bufferCategory.id);
      batch.update(bufferRef, { currentWeeklyBudget: newBufferBudget });

      nonBufferCategories.forEach((cat) => {
        const catRef = doc(db, 'households', household.id, 'categories', cat.id);
        batch.update(catRef, { currentWeeklyBudget: cat.baselineBudget || 0 });
      });

      const householdRef = doc(db, 'households', household.id);
      batch.update(householdRef, {
        lastAutomatedDrawdownWeek: currentWeekKey,
      });

      const feedRef = doc(db, 'households', household.id, 'feed', `feed_drawdown_${Date.now()}`);
      batch.set(
        feedRef,
        sanitizeFirestorePayload({
          id: `feed_drawdown_${Date.now()}`,
          type: 'message',
          content: `🌿 Automated Weekly Drawdown: ${formatCurrency(drawAmount)} transferred from Income Buffer to fill baseline allocations for ${activeDateRange.label}.`,
          authorId: 'system',
          authorName: 'Canopy Buffer Engine',
          authorAvatar: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=150&auto=format&fit=crop&q=80',
          timestamp: Date.now(),
          date: new Date().toISOString().split('T')[0],
        })
      );

      await batch.commit();

      setCategories((prev) =>
        prev.map((c) => {
          if (c.id === bufferCategory.id) {
            return { ...c, currentWeeklyBudget: newBufferBudget };
          }
          return { ...c, currentWeeklyBudget: c.baselineBudget || 0 };
        })
      );

      setHousehold((prev) => (prev ? { ...prev, lastAutomatedDrawdownWeek: currentWeekKey } : null));

      showToast(`Automated drawdown: ${formatCurrency(drawAmount)} drawn from Income Buffer.`, 'success');
    } catch (e: any) {
      console.error('triggerAutomatedDrawdown error:', e);
      showToast(`Drawdown failed: ${e.message || String(e)}`, 'error');
    }
  };

  // Permanent Account Deletion
  const deleteAccount = async () => {
    // 1. Explicitly unsubscribe from all active Firestore listeners
    unsubscribeAllListeners();

    const currentUserId = user?.userId || auth?.currentUser?.uid;
    const currentHouseholdId = household?.id;

    if (isFirebaseConfigured && db && currentUserId) {
      try {
        // 1. Remove user from active household members collection if in a household
        if (currentHouseholdId) {
          const memberRef = doc(db, 'households', currentHouseholdId, 'members', currentUserId);
          await deleteDoc(memberRef).catch((e) => {
            console.warn('Member doc deletion note:', e);
          });
        }

        // 2. Delete user profile document from Firestore
        const userRef = doc(db, 'users', currentUserId);
        await deleteDoc(userRef).catch((e) => {
          console.warn('User doc deletion note:', e);
        });

        // 3. Delete Firebase Auth user if available with re-authentication fallback
        if (auth?.currentUser) {
          try {
            await deleteUser(auth.currentUser);
          } catch (authErr: any) {
            console.warn('Initial deleteUser requires re-authentication, attempting popup:', authErr);
            if (
              authErr?.code === 'auth/requires-recent-login' ||
              authErr?.message?.includes('requires-recent-login')
            ) {
              if (googleProvider) {
                // Prompt user to re-authenticate via Google Auth popup to refresh credentials
                await reauthenticateWithPopup(auth.currentUser, googleProvider);
                // Re-attempt user doc deletion in Firestore
                await deleteDoc(userRef).catch(() => {});
                // Execute deleteUser with refreshed credentials
                await deleteUser(auth.currentUser);
              } else {
                throw authErr;
              }
            } else {
              throw authErr;
            }
          }
        }
      } catch (err: any) {
        console.error('Account deletion cleanup error:', err);
        showToast(`Account deletion error: ${err?.message || String(err)}`, 'error');
        throw err;
      }
    }

    // Clear local state and route to login / marketing page
    unsubscribeAllListeners();
    setUser(null);
    setHousehold(null);
    setMembers([]);
    setCategories([]);
    setExpenses([]);
    setCheckIns([]);
    setFeedItems([]);
    setIsOnboarding(false);
    setActiveTab('dashboard');
    showToast('Your account has been deleted.');
  };

  // Leave Current Household (preserves user profile & account history)
  const leaveHousehold = async () => {
    // 1. Explicitly unsubscribe from all active Firestore listeners first
    unsubscribeAllListeners();

    const currentUserId = user?.userId || auth?.currentUser?.uid;

    // 2. Immediately clear local React state and forcibly route to Setup Wizard
    setHousehold(null);
    setMembers([]);
    setCategories([]);
    setExpenses([]);
    setCheckIns([]);
    setFeedItems([]);
    setIsOnboarding(true);
    setActiveTab('dashboard');

    if (user) {
      const updatedUser: UserProfile = {
        ...user,
        activeHouseholdId: null,
      };
      setUser(updatedUser);
    }

    // 3. Immediately update users/{userId}.activeHouseholdId to null in Firestore
    if (isFirebaseConfigured && db && currentUserId) {
      try {
        const userRef = doc(db, 'users', currentUserId);
        await setDoc(
          userRef,
          sanitizeFirestorePayload({
            activeHouseholdId: null,
            updatedAt: new Date().toISOString(),
          }),
          { merge: true }
        );
      } catch (err) {
        console.error('Firestore leaveHousehold user record update error:', err);
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUserId}`);
      }
    }

    showToast('Left current household. You can now join an existing household or create a new one.');
  };

  // Remove Household Member (removes from household and cleans user doc if authenticated)
  const removeHouseholdMember = async (memberId: string) => {
    if (!household) return;

    const targetMember = members.find((m) => m.userId === memberId);
    if (!targetMember) return;

    const isCurrentLoggedInUser = memberId === user?.userId;

    if (isCurrentLoggedInUser) {
      await leaveHousehold();
      return;
    }

    // 1. Optimistic local state update
    const remainingMembers = members.filter((m) => m.userId !== memberId);
    setMembers(remainingMembers);

    // Recalculate household weekly income pool
    const newWeeklyPool = calculateWeeklyPool(remainingMembers);
    setHousehold((prev) => (prev ? { ...prev, weeklyIncomePool: newWeeklyPool } : null));

    // 2. Database Execution
    if (isFirebaseConfigured && db && household.id) {
      try {
        const batch = writeBatch(db);

        // Delete member document from households/{householdId}/members/{memberId}
        const memberRef = doc(db, 'households', household.id, 'members', memberId);
        batch.delete(memberRef);

        // Update household weekly income pool
        const householdRef = doc(db, 'households', household.id);
        batch.update(
          householdRef,
          sanitizeFirestorePayload({
            weeklyIncomePool: newWeeklyPool,
            updatedAt: new Date().toISOString(),
          })
        );

        await batch.commit();

        // 3. Placeholder vs Real User Logic:
        // If the removed profile is a real user, update users/{userId} doc
        if (!targetMember.isPlaceholder) {
          try {
            const userRef = doc(db, 'users', memberId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              const existingHouseholdIds: string[] = Array.isArray(userData.householdIds)
                ? userData.householdIds
                : [];
              const updatedHouseholdIds = existingHouseholdIds.filter((id) => id !== household.id);
              const newActiveId =
                userData.activeHouseholdId === household.id
                  ? updatedHouseholdIds[0] || null
                  : userData.activeHouseholdId || null;

              await updateDoc(
                userRef,
                sanitizeFirestorePayload({
                  householdIds: updatedHouseholdIds,
                  activeHouseholdId: newActiveId,
                  updatedAt: new Date().toISOString(),
                })
              );
            }
          } catch (userUpdateErr) {
            console.warn('[Firestore] Note updating removed user profile:', userUpdateErr);
          }
        }
      } catch (err) {
        console.error('Firestore removeHouseholdMember error:', err);
        handleFirestoreError(err, OperationType.DELETE, `households/${household.id}/members/${memberId}`);
        showToast(`Error removing member: ${err instanceof Error ? err.message : String(err)}`, 'error');
        return;
      }
    }

    showToast(`Removed ${targetMember.name} from the household.`);
  };

  const updateHousehold = async (updated: Partial<Household>) => {
    if (!household) return;
    const newHousehold = { ...household, ...updated };
    if (updated.firstDayOfWeek) {
      newHousehold.lastDayOfWeek = getCheckInDay(updated.firstDayOfWeek);
    }
    setHousehold(newHousehold);

    if (isFirebaseConfigured && db) {
      try {
        const householdRef = doc(db, 'households', household.id);
        await updateDoc(householdRef, sanitizeFirestorePayload(updated));
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}`);
        showToast(`Error updating household: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
    showToast('Household settings updated.');
  };

  const updateMemberIncome = async (
    memberId: string,
    rawIncome: number,
    schedule: HouseholdMember['incomeSchedule'],
    hasProvided: boolean,
    lastPayDate?: string
  ) => {
    const updatedMembers = members.map((m) => {
      if (m.userId === memberId) {
        const normalized = hasProvided ? normalizeToWeekly(rawIncome, schedule) : 0;
        return {
          ...m,
          rawIncome,
          incomeSchedule: schedule,
          normalizedWeeklyIncome: normalized,
          hasProvidedIncome: hasProvided,
          lastPayDate: lastPayDate !== undefined ? lastPayDate : m.lastPayDate,
        };
      }
      return m;
    });

    setMembers(updatedMembers);
    const newPool = calculateWeeklyPool(updatedMembers);

    // Proportionally recalculate Category Budget Limits if categories exist
    let updatedCategories: Category[] = [];
    if (categories.length > 0) {
      const oldTotalBudget = categories.reduce((sum, c) => sum + (c.baselineBudget || 0), 0);
      if (oldTotalBudget > 0 && newPool > 0) {
        let remaining = newPool;
        updatedCategories = categories.map((cat, idx) => {
          const ratio = (cat.baselineBudget || 1) / oldTotalBudget;
          const isLast = idx === categories.length - 1;
          const newAlloc = isLast ? remaining : Math.round(newPool * ratio);
          remaining -= newAlloc;
          const finalVal = Math.max(0, newAlloc);
          return {
            ...cat,
            baselineBudget: finalVal,
            currentWeeklyBudget: finalVal,
          };
        });
      } else if (newPool > 0) {
        updatedCategories = getDefaultCategories(newPool);
      }
      if (updatedCategories.length > 0) {
        setCategories(updatedCategories);
      }
    }

    if (household) {
      const updatedHousehold = { ...household, weeklyIncomePool: newPool };
      setHousehold(updatedHousehold);

      if (isFirebaseConfigured && db) {
        try {
          const batch = writeBatch(db);
          const memberRef = doc(db, 'households', household.id, 'members', memberId);
          const targetMember = updatedMembers.find((m) => m.userId === memberId);
          if (targetMember) {
            batch.set(memberRef, sanitizeFirestorePayload(targetMember), { merge: true });
          }
          const householdRef = doc(db, 'households', household.id);
          batch.update(householdRef, sanitizeFirestorePayload({ weeklyIncomePool: newPool }));

          if (updatedCategories.length > 0) {
            updatedCategories.forEach((cat) => {
              const catRef = doc(db, 'households', household.id, 'categories', cat.id);
              batch.set(catRef, sanitizeFirestorePayload(cat), { merge: true });
            });
          }

          await batch.commit();
        } catch (err) {
          console.error('Firestore Write Failed:', err);
          handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/members/${memberId}`);
          showToast(`Error saving member income: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      }
    }
    showToast('Income updated & category budgets recalculated.');
  };

  // One-Off Deposit routing: immediately expands weekly savings budget via weeklyOverrides map
  const addOneOffDeposit = async (depositData: {
    description: string;
    amount: number;
    date: string;
    payerMemberId?: string;
    notes?: string;
  }) => {
    if (!household) return;

    const safeAmount = Math.max(0, depositData.amount);
    const depositDateStr = depositData.date || new Date().toISOString().split('T')[0];
    const newDeposit: OneOffDeposit = {
      id: `dep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      description: depositData.description.trim() || 'One-off Deposit',
      amount: safeAmount,
      date: depositDateStr,
      payerMemberId: depositData.payerMemberId,
      notes: depositData.notes,
    };

    const updatedDeposits = [...(household.oneOffDeposits || []), newDeposit];
    const isVariable = household.incomeType === 'variable';

    // 1. Determine weekId based on deposit date
    const depositDateObj = new Date(depositDateStr + 'T12:00:00');
    const targetWeekRange = getWeekRange(depositDateObj, household.firstDayOfWeek || 'Monday', 0);
    const weekId = formatLocalDate(targetWeekRange.startDate);

    // 2. Identify Savings Category & Baseline Target
    const savingsCat = categories.find(
      (c) =>
        c.id === 'cat_savings' ||
        c.type === 'savings' ||
        c.group?.toLowerCase() === 'savings' ||
        c.name.toLowerCase().includes('saving')
    );
    const baselineSavings = savingsCat ? Number(savingsCat.baselineBudget) || 0 : 0;

    // 3. Calculate Expanded Savings Override
    const existingWeeklyOverrides = { ...(household.weeklyOverrides || {}) };
    const weekOverrides = { ...(existingWeeklyOverrides[weekId] || {}) };
    const existingSavingsOverride =
      weekOverrides.savings ?? (savingsCat ? weekOverrides[savingsCat.id] : undefined);

    const currentSavingsBudget =
      existingSavingsOverride !== undefined ? Number(existingSavingsOverride) : baselineSavings;
    const newSavingsBudget = currentSavingsBudget + safeAmount;

    const updatedWeekOverrides = {
      ...weekOverrides,
      savings: newSavingsBudget,
      ...(savingsCat ? { [savingsCat.id]: newSavingsBudget } : {}),
    };

    const updatedWeeklyOverrides = {
      ...existingWeeklyOverrides,
      [weekId]: updatedWeekOverrides,
    };

    let newBufferAmount = household.initialBufferAmount || 0;
    let targetBufferCat: Category | null = null;
    let updatedCategories = [...categories];

    if (isVariable) {
      newBufferAmount += safeAmount;
      const existingBuffer = categories.find(
        (c) => c.name.toLowerCase() === 'income buffer' || c.id === 'cat_income_buffer'
      );
      if (existingBuffer) {
        targetBufferCat = {
          ...existingBuffer,
          currentWeeklyBudget: (existingBuffer.currentWeeklyBudget || 0) + safeAmount,
        };
        updatedCategories = categories.map((c) => (c.id === targetBufferCat!.id ? targetBufferCat! : c));
        setCategories(updatedCategories);
      }
    }

    const updatedHousehold: Household = {
      ...household,
      oneOffDeposits: updatedDeposits,
      weeklyOverrides: updatedWeeklyOverrides,
      ...(isVariable ? { initialBufferAmount: newBufferAmount } : {}),
    };
    setHousehold(updatedHousehold);

    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        const householdRef = doc(db, 'households', household.id);
        const hhUpdates: any = {
          oneOffDeposits: updatedDeposits,
          [`weeklyOverrides.${weekId}.savings`]: newSavingsBudget,
          updatedAt: new Date().toISOString(),
        };
        if (savingsCat) {
          hhUpdates[`weeklyOverrides.${weekId}.${savingsCat.id}`] = newSavingsBudget;
        }
        if (isVariable) {
          hhUpdates.initialBufferAmount = newBufferAmount;
        }
        batch.update(householdRef, sanitizeFirestorePayload(hhUpdates));

        if (isVariable && targetBufferCat) {
          const catRef = doc(db, 'households', household.id, 'categories', (targetBufferCat as Category).id);
          batch.set(catRef, sanitizeFirestorePayload(targetBufferCat), { merge: true });
        }

        // Add feed item for deposit
        const now = Date.now();
        const payer = members.find((m) => m.userId === depositData.payerMemberId) || user;
        const feedRef = doc(db, 'households', household.id, 'feed', `feed_dep_${now}`);
        batch.set(
          feedRef,
          sanitizeFirestorePayload({
            id: `feed_dep_${now}`,
            type: 'transaction',
            content: `Logged one-off deposit of ${formatCurrency(safeAmount)}: "${newDeposit.description}" (+${formatCurrency(safeAmount)} added to ${weekId} Savings)`,
            authorId: user?.userId || 'usr_self',
            authorName: payer?.name || user?.name || 'Member',
            authorAvatar: user?.avatarUrl,
            timestamp: now,
            date: newDeposit.date,
          })
        );

        // If this week already has a completed check-in, update its totalSaved
        const completedCheckIn = (checkIns || []).find((ci) => {
          if (ci.status !== 'completed') return false;
          const cStart = ci.weekStartDate;
          const cEnd = ci.weekEndDate;
          return (
            (depositDateStr >= cStart && depositDateStr <= cEnd) ||
            ci.weekStartDate === weekId ||
            ci.id.includes(weekId)
          );
        });

        if (completedCheckIn) {
          const curSaved = typeof completedCheckIn.totalSaved === 'number' ? completedCheckIn.totalSaved : baselineSavings;
          const updatedTotalSaved = curSaved + safeAmount;
          const updatedCheckIn = {
            ...completedCheckIn,
            totalSaved: updatedTotalSaved,
          };
          setCheckIns((prev) =>
            prev.map((ci) => (ci.id === completedCheckIn.id ? updatedCheckIn : ci))
          );
          const ciRef = doc(db, 'households', household.id, 'checkIns', completedCheckIn.id);
          batch.update(ciRef, sanitizeFirestorePayload({
            totalSaved: updatedTotalSaved,
            updatedAt: new Date().toISOString(),
          }));
        }

        await batch.commit();
      } catch (err) {
        console.error('Firestore addOneOffDeposit error:', err);
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}`);
      }
    }

    showToast(`Logged deposit: ${formatCurrency(safeAmount)} (${newDeposit.description}). Expanded ${weekId} savings!`, 'success');
  };

  const deleteDeposit = async (depositId: string) => {
    if (!household) return;
    const target = (household.oneOffDeposits || []).find((d) => d.id === depositId);
    if (!target) return;
    const updatedDeposits = (household.oneOffDeposits || []).filter((d) => d.id !== depositId);

    const safeAmount = target.amount || 0;
    const depositDateStr = target.date || new Date().toISOString().split('T')[0];
    const depositDateObj = new Date(depositDateStr + 'T12:00:00');
    const targetWeekRange = getWeekRange(depositDateObj, household.firstDayOfWeek || 'Monday', 0);
    const weekId = formatLocalDate(targetWeekRange.startDate);

    const savingsCat = categories.find(
      (c) =>
        c.id === 'cat_savings' ||
        c.type === 'savings' ||
        c.group?.toLowerCase() === 'savings' ||
        c.name.toLowerCase().includes('saving')
    );
    const baselineSavings = savingsCat ? Number(savingsCat.baselineBudget) || 0 : 0;

    const existingWeeklyOverrides = { ...(household.weeklyOverrides || {}) };
    const weekOverrides = { ...(existingWeeklyOverrides[weekId] || {}) };
    const currentSavingsVal = weekOverrides.savings ?? (savingsCat ? weekOverrides[savingsCat.id] : undefined);

    let shouldDeleteSavingsOverride = false;
    let newSavingsBudget = baselineSavings;

    if (currentSavingsVal !== undefined) {
      newSavingsBudget = Number(currentSavingsVal) - safeAmount;
      if (newSavingsBudget <= baselineSavings) {
        shouldDeleteSavingsOverride = true;
        delete weekOverrides.savings;
        if (savingsCat) {
          delete weekOverrides[savingsCat.id];
        }
      } else {
        weekOverrides.savings = newSavingsBudget;
        if (savingsCat) {
          weekOverrides[savingsCat.id] = newSavingsBudget;
        }
      }
    }

    if (Object.keys(weekOverrides).length === 0) {
      delete existingWeeklyOverrides[weekId];
    } else {
      existingWeeklyOverrides[weekId] = weekOverrides;
    }

    const updatedHousehold: Household = {
      ...household,
      oneOffDeposits: updatedDeposits,
      weeklyOverrides: existingWeeklyOverrides,
    };
    setHousehold(updatedHousehold);

    if (isFirebaseConfigured && db) {
      try {
        const householdRef = doc(db, 'households', household.id);
        const hhUpdates: any = {
          oneOffDeposits: updatedDeposits,
          updatedAt: new Date().toISOString(),
        };

        if (shouldDeleteSavingsOverride) {
          hhUpdates[`weeklyOverrides.${weekId}.savings`] = deleteField();
          if (savingsCat) {
            hhUpdates[`weeklyOverrides.${weekId}.${savingsCat.id}`] = deleteField();
          }
          if (Object.keys(weekOverrides).length === 0) {
            hhUpdates[`weeklyOverrides.${weekId}`] = deleteField();
          }
        } else if (currentSavingsVal !== undefined) {
          hhUpdates[`weeklyOverrides.${weekId}.savings`] = newSavingsBudget;
          if (savingsCat) {
            hhUpdates[`weeklyOverrides.${weekId}.${savingsCat.id}`] = newSavingsBudget;
          }
        }

        await updateDoc(householdRef, hhUpdates);
      } catch (err) {
        console.error('Firestore deleteDeposit error:', err);
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}`);
      }
    }

    showToast(`Deleted deposit "${target?.description || ''}" (${formatCurrency(target?.amount || 0)}).`);
  };

  const updateDeposit = async (depositId: string, updates: Partial<OneOffDeposit>) => {
    if (!household) return;
    const currentDeposits = household.oneOffDeposits || [];
    const target = currentDeposits.find((d) => d.id === depositId);
    if (!target) return;

    const oldAmount = target.amount || 0;
    const newAmount = updates.amount !== undefined ? Number(updates.amount) : oldAmount;
    const amountDiff = newAmount - oldAmount;

    const oldDateStr = target.date || new Date().toISOString().split('T')[0];
    const newDateStr = updates.date || oldDateStr;

    const updatedDeposit: OneOffDeposit = {
      ...target,
      ...updates,
      amount: newAmount,
      date: newDateStr,
      description: updates.description !== undefined ? updates.description.trim() : target.description,
    };

    const updatedDeposits = currentDeposits.map((d) => (d.id === depositId ? updatedDeposit : d));

    // Handle weeklyOverrides adjustment if amount or date changed
    const firstDay = household.firstDayOfWeek || 'Monday';
    const oldWeekRange = getWeekRange(new Date(oldDateStr + 'T12:00:00'), firstDay, 0);
    const oldWeekId = formatLocalDate(oldWeekRange.startDate);
    const newWeekRange = getWeekRange(new Date(newDateStr + 'T12:00:00'), firstDay, 0);
    const newWeekId = formatLocalDate(newWeekRange.startDate);

    const savingsCat = categories.find(
      (c) =>
        c.id === 'cat_savings' ||
        c.type === 'savings' ||
        c.group?.toLowerCase() === 'savings' ||
        c.name.toLowerCase().includes('saving')
    );
    const baselineSavings = savingsCat ? Number(savingsCat.baselineBudget) || 0 : 0;

    const existingWeeklyOverrides = { ...(household.weeklyOverrides || {}) };

    if (oldWeekId === newWeekId) {
      if (amountDiff !== 0) {
        const weekOverrides = { ...(existingWeeklyOverrides[newWeekId] || {}) };
        const currentSavingsVal = weekOverrides.savings ?? (savingsCat ? weekOverrides[savingsCat.id] : baselineSavings);
        const nextSavings = Math.max(baselineSavings, Number(currentSavingsVal) + amountDiff);
        if (nextSavings <= baselineSavings) {
          delete weekOverrides.savings;
          if (savingsCat) delete weekOverrides[savingsCat.id];
        } else {
          weekOverrides.savings = nextSavings;
          if (savingsCat) weekOverrides[savingsCat.id] = nextSavings;
        }
        if (Object.keys(weekOverrides).length === 0) {
          delete existingWeeklyOverrides[newWeekId];
        } else {
          existingWeeklyOverrides[newWeekId] = weekOverrides;
        }
      }
    } else {
      // Deduct old from oldWeekId, add new to newWeekId
      const oldWeekOverrides = { ...(existingWeeklyOverrides[oldWeekId] || {}) };
      const curOldSavings = oldWeekOverrides.savings ?? (savingsCat ? oldWeekOverrides[savingsCat.id] : baselineSavings);
      const nextOldSavings = Math.max(baselineSavings, Number(curOldSavings) - oldAmount);
      if (nextOldSavings <= baselineSavings) {
        delete oldWeekOverrides.savings;
        if (savingsCat) delete oldWeekOverrides[savingsCat.id];
      } else {
        oldWeekOverrides.savings = nextOldSavings;
        if (savingsCat) oldWeekOverrides[savingsCat.id] = nextOldSavings;
      }
      if (Object.keys(oldWeekOverrides).length === 0) {
        delete existingWeeklyOverrides[oldWeekId];
      } else {
        existingWeeklyOverrides[oldWeekId] = oldWeekOverrides;
      }

      const newWeekOverrides = { ...(existingWeeklyOverrides[newWeekId] || {}) };
      const curNewSavings = newWeekOverrides.savings ?? (savingsCat ? newWeekOverrides[savingsCat.id] : baselineSavings);
      const nextNewSavings = Number(curNewSavings) + newAmount;
      if (nextNewSavings > baselineSavings) {
        newWeekOverrides.savings = nextNewSavings;
        if (savingsCat) newWeekOverrides[savingsCat.id] = nextNewSavings;
        existingWeeklyOverrides[newWeekId] = newWeekOverrides;
      }
    }

    const updatedHousehold: Household = {
      ...household,
      oneOffDeposits: updatedDeposits,
      weeklyOverrides: existingWeeklyOverrides,
    };
    setHousehold(updatedHousehold);

    // Synchronize check-ins if amount or week changed
    if (amountDiff !== 0 || oldWeekId !== newWeekId) {
      if (oldWeekId === newWeekId) {
        const completedCheckIn = (checkIns || []).find((ci) => {
          if (ci.status !== 'completed') return false;
          const cStart = ci.weekStartDate;
          const cEnd = ci.weekEndDate;
          return (
            (oldDateStr >= cStart && oldDateStr <= cEnd) ||
            ci.weekStartDate === oldWeekId ||
            ci.id.includes(oldWeekId)
          );
        });
        if (completedCheckIn) {
          const curSaved = typeof completedCheckIn.totalSaved === 'number' ? completedCheckIn.totalSaved : baselineSavings;
          const updatedTotalSaved = Math.max(0, curSaved + amountDiff);
          setCheckIns((prev) =>
            prev.map((ci) => (ci.id === completedCheckIn.id ? { ...ci, totalSaved: updatedTotalSaved } : ci))
          );
          if (isFirebaseConfigured && db) {
            const ciRef = doc(db, 'households', household.id, 'checkIns', completedCheckIn.id);
            updateDoc(ciRef, sanitizeFirestorePayload({ totalSaved: updatedTotalSaved, updatedAt: new Date().toISOString() }));
          }
        }
      } else {
        const oldCi = (checkIns || []).find((ci) => {
          if (ci.status !== 'completed') return false;
          const cStart = ci.weekStartDate;
          const cEnd = ci.weekEndDate;
          return (oldDateStr >= cStart && oldDateStr <= cEnd) || ci.weekStartDate === oldWeekId || ci.id.includes(oldWeekId);
        });
        const newCi = (checkIns || []).find((ci) => {
          if (ci.status !== 'completed') return false;
          const cStart = ci.weekStartDate;
          const cEnd = ci.weekEndDate;
          return (newDateStr >= cStart && newDateStr <= cEnd) || ci.weekStartDate === newWeekId || ci.id.includes(newWeekId);
        });

        if (oldCi) {
          const curSaved = typeof oldCi.totalSaved === 'number' ? oldCi.totalSaved : baselineSavings;
          const updatedTotalSaved = Math.max(0, curSaved - oldAmount);
          setCheckIns((prev) =>
            prev.map((ci) => (ci.id === oldCi.id ? { ...ci, totalSaved: updatedTotalSaved } : ci))
          );
          if (isFirebaseConfigured && db) {
            const ciRef = doc(db, 'households', household.id, 'checkIns', oldCi.id);
            updateDoc(ciRef, sanitizeFirestorePayload({ totalSaved: updatedTotalSaved, updatedAt: new Date().toISOString() }));
          }
        }

        if (newCi) {
          const curSaved = typeof newCi.totalSaved === 'number' ? newCi.totalSaved : baselineSavings;
          const updatedTotalSaved = Math.max(0, curSaved + newAmount);
          setCheckIns((prev) =>
            prev.map((ci) => (ci.id === newCi.id ? { ...ci, totalSaved: updatedTotalSaved } : ci))
          );
          if (isFirebaseConfigured && db) {
            const ciRef = doc(db, 'households', household.id, 'checkIns', newCi.id);
            updateDoc(ciRef, sanitizeFirestorePayload({ totalSaved: updatedTotalSaved, updatedAt: new Date().toISOString() }));
          }
        }
      }
    }

    if (isFirebaseConfigured && db) {
      try {
        const householdRef = doc(db, 'households', household.id);
        await updateDoc(
          householdRef,
          sanitizeFirestorePayload({
            oneOffDeposits: updatedDeposits,
            weeklyOverrides: existingWeeklyOverrides,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (err) {
        console.error('Firestore updateDeposit error:', err);
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}`);
      }
    }

    showToast('Deposit updated.', 'success');
  };

  // Category Mutations
  const createCategory = async (catData: Omit<Category, 'id'>) => {
    const newId = `cat_${catData.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const newCategory: Category = {
      ...catData,
      id: newId,
      totalLogged: 0,
      transactionCount: 0,
    };

    setCategories((prev) => [...prev, newCategory]);

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const catRef = doc(db, 'households', household.id, 'categories', newId);
        await setDoc(catRef, sanitizeFirestorePayload(newCategory));
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.CREATE, `households/${household.id}/categories/${newId}`);
        showToast(`Error creating category: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
    showToast(`Added "${newCategory.name}" bucket.`);
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const catRef = doc(db, 'households', household.id, 'categories', id);
        await updateDoc(catRef, sanitizeFirestorePayload(updates));
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/categories/${id}`);
        showToast(`Error updating category: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
  };

  const deleteCategory = async (id: string) => {
    const target = categories.find((c) => c.id === id);
    setCategories((prev) => prev.filter((c) => c.id !== id));

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const catRef = doc(db, 'households', household.id, 'categories', id);
        await deleteDoc(catRef);
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.DELETE, `households/${household.id}/categories/${id}`);
        showToast(`Error deleting category: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
    showToast(`Deleted category ${target?.name || ''}.`);
  };

  const saveCategoryAllocations = async (updatedCategories: Category[]) => {
    setCategories(updatedCategories);

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const batch = writeBatch(db);
        updatedCategories.forEach((cat) => {
          const catRef = doc(db, 'households', household.id, 'categories', cat.id);
          batch.set(catRef, sanitizeFirestorePayload(cat), { merge: true });
        });
        await batch.commit();
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/categories`);
        showToast(`Error saving allocations: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
    showToast('Category allocations updated successfully.');
  };

  // Savings Goal Mutations
  const createSavingsGoal = async (goalData: Omit<SavingsGoal, 'id'>) => {
    const newId = `goal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newGoal: SavingsGoal = {
      ...goalData,
      id: newId,
      currentAmount: goalData.currentAmount || 0,
      isAchieved: false,
    };

    setSavingsGoals((prev) => [...prev, newGoal]);

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const goalRef = doc(db, 'households', household.id, 'savingsGoals', newId);
        await setDoc(goalRef, sanitizeFirestorePayload(newGoal));
      } catch (err) {
        console.error('Firestore Write Failed for savings goal:', err);
        handleFirestoreError(err, OperationType.CREATE, `households/${household.id}/savingsGoals/${newId}`);
        showToast(`Error creating savings goal: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
    showToast(`Created savings goal "${newGoal.name}"!`, 'success');
  };

  const updateSavingsGoal = async (id: string, updates: Partial<SavingsGoal>) => {
    setSavingsGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const goalRef = doc(db, 'households', household.id, 'savingsGoals', id);
        await updateDoc(goalRef, sanitizeFirestorePayload(updates));
      } catch (err) {
        console.error('Firestore Update Failed for savings goal:', err);
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/savingsGoals/${id}`);
        showToast(`Error updating savings goal: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
  };

  const deleteSavingsGoal = async (id: string) => {
    const target = savingsGoals.find((g) => g.id === id);
    setSavingsGoals((prev) => prev.filter((g) => g.id !== id));

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const goalRef = doc(db, 'households', household.id, 'savingsGoals', id);
        await deleteDoc(goalRef);
      } catch (err) {
        console.error('Firestore Delete Failed for savings goal:', err);
        handleFirestoreError(err, OperationType.DELETE, `households/${household.id}/savingsGoals/${id}`);
        showToast(`Error deleting savings goal: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
    showToast(`Removed goal "${target?.name || ''}".`);
  };

  const allocateSavingsToGoals = async (allocations: Record<string, number>) => {
    if (!household) return;
    const updatedGoals = savingsGoals.map((g) => {
      const allocated = Number(allocations[g.id]) || 0;
      if (allocated > 0) {
        const newCurrent = (g.currentAmount || 0) + allocated;
        const isAchieved = newCurrent >= (g.targetAmount || 0);
        return {
          ...g,
          currentAmount: newCurrent,
          isAchieved,
          achievedAt: isAchieved && !g.isAchieved ? new Date().toISOString().split('T')[0] : g.achievedAt,
        };
      }
      return g;
    });

    setSavingsGoals(updatedGoals);

    if (isFirebaseConfigured && db && household.id) {
      try {
        const batch = writeBatch(db);
        for (const [goalId, amount] of Object.entries(allocations)) {
          if (amount > 0) {
            const goal = updatedGoals.find((g) => g.id === goalId);
            if (goal) {
              const goalRef = doc(db, 'households', household.id, 'savingsGoals', goalId);
              batch.set(goalRef, sanitizeFirestorePayload(goal), { merge: true });
            }
          }
        }
        await batch.commit();
      } catch (err) {
        console.error('Firestore allocateSavingsToGoals error:', err);
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/savingsGoals`);
      }
    }

    showToast('Savings goals successfully funded!', 'success');
  };

  // Universal Staging & Confirmation Flow
  const openStagingModal = (initial?: StagedExpense | StagedExpense[]) => {
    const defaultCategoryId = categories[0]?.id || 'cat_general';
    const defaultLoggedBy = user?.userId || 'usr_self';
    const todayStr = new Date().toISOString().split('T')[0];

    if (Array.isArray(initial) && initial.length > 0) {
      setStagedExpenses(initial);
    } else if (initial && !Array.isArray(initial)) {
      setStagedExpenses([initial]);
    } else {
      setStagedExpenses([
        {
          amount: 0,
          description: '',
          categoryId: defaultCategoryId,
          date: todayStr,
          loggedByUserId: defaultLoggedBy,
        },
      ]);
    }
    setIsStagingModalOpen(true);
  };

  const closeStagingModal = () => {
    setIsStagingModalOpen(false);
    setStagedExpenses([]);
  };

  const addStagedItem = (item?: Partial<StagedExpense>) => {
    const defaultCategoryId = categories[0]?.id || 'cat_general';
    const defaultLoggedBy = user?.userId || 'usr_self';
    const todayStr = new Date().toISOString().split('T')[0];

    setStagedExpenses((prev) => [
      ...prev,
      {
        amount: item?.amount || 0,
        description: item?.description || '',
        categoryId: item?.categoryId || defaultCategoryId,
        date: item?.date || todayStr,
        loggedByUserId: item?.loggedByUserId || defaultLoggedBy,
        receiptImgUrl: item?.receiptImgUrl,
      },
    ]);
  };

  const updateStagedItem = (index: number, updates: Partial<StagedExpense>) => {
    setStagedExpenses((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  const removeStagedItem = (index: number) => {
    setStagedExpenses((prev) => prev.filter((_, idx) => idx !== index));
  };

  const confirmAllStagedExpenses = async () => {
    if (!household || stagedExpenses.length === 0) return;

    const validItems = stagedExpenses.filter((it) => Number(it.amount) > 0);
    if (validItems.length === 0) {
      showToast('Please enter an amount for at least one item before confirming.');
      return;
    }

    const now = Date.now();
    const depositItems = validItems.filter(isExpenseOneTimeDeposit);
    const regularExpenseItems = validItems.filter((it) => !isExpenseOneTimeDeposit(it));

    // 1. Process One-Time Deposits
    if (depositItems.length > 0) {
      const firstDay = household.firstDayOfWeek || 'Monday';
      const savingsCat = categories.find(
        (c) =>
          c.type === 'savings' ||
          c.group === 'Savings' ||
          c.group?.toLowerCase() === 'savings' ||
          c.id === 'cat_savings' ||
          c.name.toLowerCase().includes('saving')
      );
      const baseSavings = savingsCat ? Number(savingsCat.baselineBudget) || 0 : 0;

      let updatedHouseholdDeposits = [...(household.oneOffDeposits || [])];
      let updatedWeeklyOverrides = { ...(household.weeklyOverrides || {}) };

      depositItems.forEach((item, idx) => {
        const depDateStr = item.date || new Date().toISOString().split('T')[0];
        const safeAmount = Number(item.amount);
        const newDeposit: OneOffDeposit = {
          id: `dep_${now}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          amount: safeAmount,
          description: item.description?.trim() || 'One-off Deposit',
          date: depDateStr,
          payerMemberId: item.loggedByUserId || user?.userId || 'usr_self',
          notes: (item.tags || []).join(', '),
        };
        updatedHouseholdDeposits.push(newDeposit);

        // Calculate and update expanded savings override
        const depDateObj = new Date(depDateStr + 'T12:00:00');
        const targetWeekRange = getWeekRange(depDateObj, firstDay, 0);
        const weekId = formatLocalDate(targetWeekRange.startDate);

        const weekOverrides = { ...(updatedWeeklyOverrides[weekId] || {}) };
        const currentSavings =
          weekOverrides.savings ??
          (savingsCat ? weekOverrides[savingsCat.id] : undefined) ??
          baseSavings;
        const nextSavings = Number(currentSavings) + safeAmount;

        updatedWeeklyOverrides[weekId] = {
          ...weekOverrides,
          savings: nextSavings,
          ...(savingsCat ? { [savingsCat.id]: nextSavings } : {}),
        };
      });

      setHousehold((prev) =>
        prev
          ? {
              ...prev,
              oneOffDeposits: updatedHouseholdDeposits,
              weeklyOverrides: updatedWeeklyOverrides,
            }
          : prev
      );

      if (isFirebaseConfigured && db && household.id) {
        const hhRef = doc(db, 'households', household.id);
        updateDoc(
          hhRef,
          sanitizeFirestorePayload({
            oneOffDeposits: updatedHouseholdDeposits,
            weeklyOverrides: updatedWeeklyOverrides,
            updatedAt: new Date().toISOString(),
          })
        ).catch(console.error);
      }
    }

    // 2. Process Regular Expenses
    const createdExpenses: Expense[] = regularExpenseItems.map((item, idx) => {
      const resolvedCategoryId =
        item.categoryId && categories.some((c) => c.id === item.categoryId)
          ? item.categoryId
          : categories[0]?.id || '';

      const dateStr = item.date || new Date().toISOString().split('T')[0];

      let ts = now;
      if (dateStr) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          ts = new Date(
            parseInt(parts[0], 10),
            parseInt(parts[1], 10) - 1,
            parseInt(parts[2], 10),
            12,
            0,
            0
          ).getTime();
        } else {
          ts = new Date(dateStr).getTime() || now;
        }
      }

      return {
        id: `exp_${now}_${idx}`,
        amount: Number(item.amount),
        description: item.description.trim() || 'Logged Expense',
        categoryId: resolvedCategoryId,
        date: dateStr,
        timestamp: ts,
        loggedByUserId: item.loggedByUserId || user?.userId || 'usr_self',
        receiptImgUrl: item.receiptImgUrl || undefined,
        billFrequency: item.billFrequency || undefined,
        tags: item.tags && item.tags.length > 0 ? item.tags : undefined,
        subcategory: item.subcategory || undefined,
        depositDestination: item.depositDestination || undefined,
        targetGoalId: item.targetGoalId || undefined,
      };
    });

    // Process goal deposits
    createdExpenses.forEach((exp) => {
      if (exp.depositDestination === 'goal' && exp.targetGoalId) {
        allocateSavingsToGoals({ [exp.targetGoalId]: exp.amount });
      }
    });

    if (createdExpenses.length > 0) {
      // 1. Optimistic local state update
      setExpenses((prev) => [...createdExpenses, ...prev]);

      setCategories((prevCats) =>
        prevCats.map((cat) => {
          const matching = createdExpenses.filter((e) => e.categoryId === cat.id);
          if (matching.length === 0) return cat;
          const sumAmount = matching.reduce((s, e) => s + e.amount, 0);
          return {
            ...cat,
            totalLogged: (Number(cat.totalLogged) || 0) + sumAmount,
            transactionCount: (Number(cat.transactionCount) || 0) + matching.length,
          };
        })
      );

      // 2. Live Firestore Batch Writes
      if (isFirebaseConfigured && db && household?.id) {
        try {
          const batch = writeBatch(db);
          const categoryIncrements: Record<string, { amount: number; count: number }> = {};

          createdExpenses.forEach((exp) => {
            const expRef = doc(db, 'households', household.id, 'expenses', exp.id);
            const expPayload = {
              id: exp.id,
              amount: exp.amount,
              description: exp.description,
              categoryId: exp.categoryId,
              date: exp.date,
              timestamp: exp.timestamp,
              createdAt: serverTimestamp(),
              loggedByUserId: exp.loggedByUserId,
              receiptImgUrl: exp.receiptImgUrl || null,
              billFrequency: exp.billFrequency || null,
              tags: exp.tags || null,
              subcategory: exp.subcategory || null,
              depositDestination: exp.depositDestination || null,
              targetGoalId: exp.targetGoalId || null,
            };
            batch.set(expRef, sanitizeFirestorePayload(expPayload));

            if (exp.categoryId) {
              if (!categoryIncrements[exp.categoryId]) {
                categoryIncrements[exp.categoryId] = { amount: 0, count: 0 };
              }
              categoryIncrements[exp.categoryId].amount += exp.amount;
              categoryIncrements[exp.categoryId].count += 1;
            }
          });

          // Update each parent category document using Firestore increment()
          Object.entries(categoryIncrements).forEach(([catId, { amount, count }]) => {
            const catRef = doc(db, 'households', household.id, 'categories', catId);
            batch.update(catRef, {
              totalLogged: increment(amount),
              transactionCount: increment(count),
            });
          });

          // Add activity feed item
          const feedRef = doc(db, 'households', household.id, 'feed', `feed_${now}`);
          const totalAmount = createdExpenses.reduce((sum, e) => sum + e.amount, 0);
          batch.set(
            feedRef,
            sanitizeFirestorePayload({
              id: `feed_${now}`,
              type: 'transaction',
              content: `Logged ${createdExpenses.length} expense${createdExpenses.length > 1 ? 's' : ''} totaling $${totalAmount.toFixed(2)}`,
              authorId: user?.userId || 'usr_self',
              authorName: user?.name || 'Member',
              authorAvatar: user?.avatarUrl,
              timestamp: now,
              date: new Date(now).toISOString().split('T')[0],
            })
          );

          await batch.commit();
        } catch (err) {
          console.error('Firestore Write Failed:', err);
          handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/expenses`);
          showToast(`Firestore Write Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      }
    }

    closeStagingModal();
    const totalCount = depositItems.length + createdExpenses.length;
    showToast(`${totalCount} item${totalCount > 1 ? 's' : ''} logged and synced to household.`);
  };

  const deleteExpense = async (id: string) => {
    const targetExpense = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));

    if (targetExpense && targetExpense.categoryId) {
      setCategories((prevCats) =>
        prevCats.map((cat) => {
          if (cat.id !== targetExpense.categoryId) return cat;
          return {
            ...cat,
            totalLogged: Math.max(0, (Number(cat.totalLogged) || 0) - targetExpense.amount),
            transactionCount: Math.max(0, (Number(cat.transactionCount) || 0) - 1),
          };
        })
      );
    }

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const batch = writeBatch(db);
        const expRef = doc(db, 'households', household.id, 'expenses', id);
        batch.delete(expRef);

        if (targetExpense?.categoryId) {
          const catRef = doc(db, 'households', household.id, 'categories', targetExpense.categoryId);
          batch.update(catRef, {
            totalLogged: increment(-targetExpense.amount),
            transactionCount: increment(-1),
          });
        }

        await batch.commit();
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.DELETE, `households/${household.id}/expenses/${id}`);
        showToast(`Error deleting expense: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
    showToast('Expense removed.');
  };

  const addExpense = async (expData: Omit<Expense, 'id'>) => {
    if (isExpenseOneTimeDeposit(expData)) {
      await addOneOffDeposit({
        amount: Number(expData.amount),
        description: expData.description?.trim() || 'One-off Deposit',
        date: expData.date || new Date().toISOString().split('T')[0],
        payerMemberId: expData.loggedByUserId,
        notes: (expData.tags || []).join(', '),
      });
      return;
    }
    const now = Date.now();
    let ts = expData.timestamp;
    if (!ts && expData.date) {
      const parts = expData.date.split('-');
      if (parts.length === 3) {
        ts = new Date(
          parseInt(parts[0], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[2], 10),
          12,
          0,
          0
        ).getTime();
      } else {
        ts = new Date(expData.date).getTime() || now;
      }
    }
    const newExpense: Expense = {
      id: `exp_${now}_${Math.random().toString(36).substr(2, 6)}`,
      amount: Number(expData.amount),
      description: expData.description?.trim() || 'Logged Expense',
      categoryId: expData.categoryId,
      date: expData.date || new Date().toISOString().split('T')[0],
      timestamp: ts || now,
      loggedByUserId: expData.loggedByUserId || user?.userId || 'usr_self',
      receiptImgUrl: expData.receiptImgUrl,
      billFrequency: expData.billFrequency,
    };

    // 1. Optimistic update
    setExpenses((prev) => [newExpense, ...prev]);

    if (newExpense.categoryId) {
      setCategories((prevCats) =>
        prevCats.map((cat) => {
          if (cat.id !== newExpense.categoryId) return cat;
          return {
            ...cat,
            totalLogged: (Number(cat.totalLogged) || 0) + newExpense.amount,
            transactionCount: (Number(cat.transactionCount) || 0) + 1,
          };
        })
      );
    }

    // 2. Live Firestore
    if (isFirebaseConfigured && db && household?.id) {
      try {
        const batch = writeBatch(db);
        const expRef = doc(db, 'households', household.id, 'expenses', newExpense.id);
        batch.set(
          expRef,
          sanitizeFirestorePayload({
            ...newExpense,
            createdAt: serverTimestamp(),
          })
        );

        if (newExpense.categoryId) {
          const catRef = doc(db, 'households', household.id, 'categories', newExpense.categoryId);
          batch.update(catRef, {
            totalLogged: increment(newExpense.amount),
            transactionCount: increment(1),
          });
        }

        const feedRef = doc(db, 'households', household.id, 'feed', `feed_${now}`);
        batch.set(
          feedRef,
          sanitizeFirestorePayload({
            id: `feed_${now}`,
            type: 'transaction',
            content: `Logged expense "${newExpense.description}" for $${newExpense.amount.toFixed(2)}`,
            authorId: user?.userId || 'usr_self',
            authorName: user?.name || 'Member',
            authorAvatar: user?.avatarUrl,
            timestamp: now,
            date: newExpense.date,
          })
        );

        await batch.commit();
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/expenses`);
        showToast(`Firestore Write Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }

    showToast(`Logged $${newExpense.amount.toFixed(2)} for ${newExpense.description}`);
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const expRef = doc(db, 'households', household.id, 'expenses', id);
        await updateDoc(expRef, sanitizeFirestorePayload(updates));
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/expenses/${id}`);
        showToast(`Error updating expense: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
    showToast('Expense updated.');
  };

  // Add Transaction Comment (Expenses & Deposits)
  const addTransactionComment = async (expenseId: string, text: string) => {
    if (!text.trim()) return;

    const activeMember = members.find((m) => m.userId === user?.userId) || members[0] || {
      userId: user?.userId || 'usr_self',
      name: user?.name || 'Member',
      avatarUrl: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };

    const targetExpense = expenses.find((e) => e.id === expenseId);
    const targetDeposit = !targetExpense ? (household?.oneOffDeposits || []).find((d) => d.id === expenseId) : undefined;
    const now = Date.now();
    const commentId = `comment_${now}_${Math.random().toString(36).substr(2, 4)}`;

    const newComment: TransactionComment = {
      id: commentId,
      expenseId,
      authorId: activeMember.userId,
      authorName: activeMember.name,
      authorAvatar: activeMember.avatarUrl,
      text: text.trim(),
      timestamp: now,
    };

    if (targetExpense) {
      const cat = categories.find((c) => c.id === targetExpense?.categoryId);
      let updatedComments: TransactionComment[] = [];
      setExpenses((prev) =>
        prev.map((e) => {
          if (e.id === expenseId) {
            const comments = e.comments ? [...e.comments, newComment] : [newComment];
            updatedComments = comments;
            return { ...e, comments };
          }
          return e;
        })
      );

      const feedItemId = `feed_comment_${now}`;
      const feedItem: FeedItem = {
        id: feedItemId,
        type: 'comment',
        content: text.trim(),
        authorId: activeMember.userId,
        authorName: activeMember.name,
        authorAvatar: activeMember.avatarUrl,
        timestamp: now,
        date: new Date(now).toISOString().split('T')[0],
        linkedExpenseId: expenseId,
        linkedExpense: {
          id: targetExpense.id,
          description: targetExpense.description,
          categoryName: cat?.name || 'Category',
          categoryIcon: cat?.icon || 'tag',
          amount: targetExpense.amount,
          date: targetExpense.date,
          payerName: members.find((m) => m.userId === targetExpense.loggedByUserId)?.name || 'Member',
        },
      };

      setFeedItems((prev) => [feedItem, ...prev]);

      if (isFirebaseConfigured && db && household?.id) {
        try {
          const batch = writeBatch(db);
          const expRef = doc(db, 'households', household.id, 'expenses', expenseId);
          batch.update(expRef, sanitizeFirestorePayload({ comments: updatedComments }));

          const feedRef = doc(db, 'households', household.id, 'feed', feedItemId);
          batch.set(feedRef, sanitizeFirestorePayload(feedItem));

          await batch.commit();
        } catch (err) {
          console.error('Firestore Write Failed:', err);
          handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/feed/${feedItemId}`);
          showToast(`Error posting comment: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      }
    } else if (targetDeposit && household) {
      const updatedDeposits = (household.oneOffDeposits || []).map((d) => {
        if (d.id === expenseId) {
          const comments = d.comments ? [...d.comments, newComment] : [newComment];
          return { ...d, comments };
        }
        return d;
      });

      setHousehold((prev) => (prev ? { ...prev, oneOffDeposits: updatedDeposits } : prev));

      const feedItemId = `feed_comment_${now}`;
      const feedItem: FeedItem = {
        id: feedItemId,
        type: 'comment',
        content: text.trim(),
        authorId: activeMember.userId,
        authorName: activeMember.name,
        authorAvatar: activeMember.avatarUrl,
        timestamp: now,
        date: new Date(now).toISOString().split('T')[0],
        linkedExpenseId: expenseId,
        linkedExpense: {
          id: targetDeposit.id,
          description: targetDeposit.description,
          categoryName: 'One-Off Deposit',
          categoryIcon: 'dollar-sign',
          amount: targetDeposit.amount,
          date: targetDeposit.date,
          payerName: members.find((m) => m.userId === targetDeposit.payerMemberId)?.name || 'Member',
        },
      };

      setFeedItems((prev) => [feedItem, ...prev]);

      if (isFirebaseConfigured && db) {
        try {
          const batch = writeBatch(db);
          const hhRef = doc(db, 'households', household.id);
          batch.update(hhRef, sanitizeFirestorePayload({ oneOffDeposits: updatedDeposits, updatedAt: new Date().toISOString() }));

          const feedRef = doc(db, 'households', household.id, 'feed', feedItemId);
          batch.set(feedRef, sanitizeFirestorePayload(feedItem));

          await batch.commit();
        } catch (err) {
          console.error('Firestore Write Failed for Deposit Comment:', err);
        }
      }
    }

    showToast('Comment posted to activity feed!');
  };

  // Add or Toggle Transaction Reaction (Expenses & Deposits)
  const addTransactionReaction = async (expenseId: string, emoji: string) => {
    const activeMember = members.find((m) => m.userId === user?.userId) || members[0] || {
      userId: user?.userId || 'usr_self',
      name: user?.name || 'Member',
      avatarUrl: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };

    const targetDef = getReactionDef(emoji);
    const now = Date.now();
    let updatedReactionsForFirestore: TransactionReaction[] = [];
    let isAdding = true;
    let targetExpenseSnapshot: Expense | undefined;
    const targetDepositSnapshot = (household?.oneOffDeposits || []).find((d) => d.id === expenseId);

    // Check if expense
    const expExists = expenses.some((e) => e.id === expenseId);

    if (expExists) {
      setExpenses((prev) => {
        const exp = prev.find((e) => e.id === expenseId);
        if (!exp) return prev;
        targetExpenseSnapshot = exp;

        const currentReactions = exp.reactions ? [...exp.reactions] : [];
        const existingIdx = currentReactions.findIndex(
          (r) =>
            r.authorId === activeMember.userId &&
            (r.emoji === targetDef.id || getReactionDef(r.emoji).id === targetDef.id)
        );

        if (existingIdx >= 0) {
          isAdding = false;
          updatedReactionsForFirestore = currentReactions.filter((_, idx) => idx !== existingIdx);
        } else {
          isAdding = true;
          const newReaction: TransactionReaction = {
            id: `react_${now}_${Math.random().toString(36).substring(2, 6)}`,
            expenseId,
            authorId: activeMember.userId,
            authorName: activeMember.name,
            authorAvatar: activeMember.avatarUrl,
            emoji: targetDef.id,
            timestamp: now,
          };
          updatedReactionsForFirestore = [...currentReactions, newReaction];
        }

        return prev.map((e) => {
          if (e.id === expenseId) {
            return { ...e, reactions: updatedReactionsForFirestore };
          }
          return e;
        });
      });

      const cat = categories.find((c) => c.id === targetExpenseSnapshot?.categoryId);

      if (isAdding) {
        const feedItemId = `feed_reaction_${now}`;
        const amountFormatted = targetExpenseSnapshot?.amount !== undefined ? formatCurrency(targetExpenseSnapshot.amount) : '$0.00';
        const feedItem: FeedItem = {
          id: feedItemId,
          type: 'reaction',
          emoji: targetDef.id,
          content: `${activeMember.name} reacted with ${targetDef.label} to ${targetExpenseSnapshot?.description || 'expense'} (${amountFormatted})`,
          authorId: activeMember.userId,
          authorName: activeMember.name,
          authorAvatar: activeMember.avatarUrl,
          timestamp: now,
          date: new Date(now).toISOString().split('T')[0],
          linkedExpenseId: expenseId,
          linkedExpense: targetExpenseSnapshot
            ? {
                id: targetExpenseSnapshot.id,
                description: targetExpenseSnapshot.description,
                categoryName: cat?.name || 'Category',
                categoryIcon: cat?.icon || 'tag',
                amount: targetExpenseSnapshot.amount,
                date: targetExpenseSnapshot.date,
                payerName: members.find((m) => m.userId === targetExpenseSnapshot?.loggedByUserId)?.name || 'Member',
              }
            : undefined,
        };

        setFeedItems((prev) => [feedItem, ...prev]);

        if (isFirebaseConfigured && db && household?.id) {
          try {
            const batch = writeBatch(db);
            const expRef = doc(db, 'households', household.id, 'expenses', expenseId);
            batch.update(expRef, sanitizeFirestorePayload({ reactions: updatedReactionsForFirestore }));

            const feedRef = doc(db, 'households', household.id, 'feed', feedItemId);
            batch.set(feedRef, sanitizeFirestorePayload(feedItem));

            await batch.commit();
          } catch (err) {
            console.error('Firestore Write Failed:', err);
            handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/feed/${feedItemId}`);
            showToast(`Error adding reaction: ${err instanceof Error ? err.message : String(err)}`, 'error');
          }
        }
      } else {
        if (isFirebaseConfigured && db && household?.id) {
          try {
            const expRef = doc(db, 'households', household.id, 'expenses', expenseId);
            await updateDoc(expRef, sanitizeFirestorePayload({ reactions: updatedReactionsForFirestore }));
          } catch (err) {
            console.error('Firestore Write Failed:', err);
            handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/expenses/${expenseId}`);
            showToast(`Error updating reaction: ${err instanceof Error ? err.message : String(err)}`, 'error');
          }
        }
      }
    } else if (targetDepositSnapshot && household) {
      // Toggle reaction on deposit
      let updatedDeposits: OneOffDeposit[] = [];
      const curReactions = targetDepositSnapshot.reactions ? [...targetDepositSnapshot.reactions] : [];
      const existingIdx = curReactions.findIndex(
        (r) =>
          r.authorId === activeMember.userId &&
          (r.emoji === targetDef.id || getReactionDef(r.emoji).id === targetDef.id)
      );

      if (existingIdx >= 0) {
        isAdding = false;
        updatedReactionsForFirestore = curReactions.filter((_, idx) => idx !== existingIdx);
      } else {
        isAdding = true;
        const newReaction: TransactionReaction = {
          id: `react_${now}_${Math.random().toString(36).substring(2, 6)}`,
          expenseId,
          authorId: activeMember.userId,
          authorName: activeMember.name,
          authorAvatar: activeMember.avatarUrl,
          emoji: targetDef.id,
          timestamp: now,
        };
        updatedReactionsForFirestore = [...curReactions, newReaction];
      }

      updatedDeposits = (household.oneOffDeposits || []).map((d) =>
        d.id === expenseId ? { ...d, reactions: updatedReactionsForFirestore } : d
      );

      setHousehold((prev) => (prev ? { ...prev, oneOffDeposits: updatedDeposits } : prev));

      if (isAdding) {
        const feedItemId = `feed_reaction_${now}`;
        const feedItem: FeedItem = {
          id: feedItemId,
          type: 'reaction',
          emoji: targetDef.id,
          content: `${activeMember.name} reacted with ${targetDef.label} to deposit "${targetDepositSnapshot.description}" (${formatCurrency(targetDepositSnapshot.amount)})`,
          authorId: activeMember.userId,
          authorName: activeMember.name,
          authorAvatar: activeMember.avatarUrl,
          timestamp: now,
          date: new Date(now).toISOString().split('T')[0],
          linkedExpenseId: expenseId,
          linkedExpense: {
            id: targetDepositSnapshot.id,
            description: targetDepositSnapshot.description,
            categoryName: 'One-Off Deposit',
            categoryIcon: 'dollar-sign',
            amount: targetDepositSnapshot.amount,
            date: targetDepositSnapshot.date,
            payerName: members.find((m) => m.userId === targetDepositSnapshot.payerMemberId)?.name || 'Member',
          },
        };

        setFeedItems((prev) => [feedItem, ...prev]);

        if (isFirebaseConfigured && db) {
          try {
            const batch = writeBatch(db);
            const hhRef = doc(db, 'households', household.id);
            batch.update(hhRef, sanitizeFirestorePayload({ oneOffDeposits: updatedDeposits, updatedAt: new Date().toISOString() }));

            const feedRef = doc(db, 'households', household.id, 'feed', feedItemId);
            batch.set(feedRef, sanitizeFirestorePayload(feedItem));

            await batch.commit();
          } catch (err) {
            console.error('Firestore Write Failed for Deposit Reaction:', err);
          }
        }
      } else {
        if (isFirebaseConfigured && db) {
          try {
            const hhRef = doc(db, 'households', household.id);
            await updateDoc(hhRef, sanitizeFirestorePayload({ oneOffDeposits: updatedDeposits, updatedAt: new Date().toISOString() }));
          } catch (err) {
            console.error('Firestore Write Failed for Deposit Reaction:', err);
          }
        }
      }
    }
  };

  // Post General Feed Message
  const postFeedMessage = async (content: string) => {
    if (!content.trim()) return;

    const activeMember = members.find((m) => m.userId === user?.userId) || members[0] || {
      userId: user?.userId || 'usr_self',
      name: user?.name || 'Member',
      avatarUrl: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };

    const now = Date.now();
    const feedItemId = `feed_msg_${now}`;
    const feedItem: FeedItem = {
      id: feedItemId,
      type: 'message',
      content: content.trim(),
      authorId: activeMember.userId,
      authorName: activeMember.name,
      authorAvatar: activeMember.avatarUrl,
      timestamp: now,
      date: new Date(now).toISOString().split('T')[0],
    };

    setFeedItems((prev) => [feedItem, ...prev]);

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const feedRef = doc(db, 'households', household.id, 'feed', feedItemId);
        await setDoc(feedRef, sanitizeFirestorePayload(feedItem));
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/feed/${feedItemId}`);
        showToast(`Error posting message: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }

    showToast('Message posted to household feed!');
  };

  // Complete Weekly Check-In Mutation
  const completeWeeklyCheckIn = async (data: {
    weekStartDate: string;
    weekEndDate: string;
    notes?: string;
    decisions: CategoryRolloverDecision[];
    totalSaved: number;
    totalSpent: number;
    totalBudget: number;
  }) => {
    if (!household) return;

    const now = Date.now();
    const checkInId = `checkin_${now}`;
    const newCheckIn: CheckIn = {
      id: checkInId,
      fiscalWeekId: getFiscalWeekId(data.weekStartDate, household?.fiscalYearEndMonth || 12),
      weekStartDate: data.weekStartDate,
      weekEndDate: data.weekEndDate,
      completedByUserId: user?.userId || 'usr_self',
      completedByName: user?.name || 'Household Member',
      timestamp: now,
      status: 'completed',
      notes: data.notes || '',
      totalSaved: data.totalSaved,
      totalSpent: data.totalSpent,
      totalBudget: data.totalBudget,
      decisions: data.decisions,
    };

    // Calculate future weeks strictly in the fiscal month after current week
    const currentWeekStart = new Date(data.weekStartDate + (data.weekStartDate.length === 10 ? 'T12:00:00' : ''));
    const currentWeekEnd = new Date(data.weekEndDate + (data.weekEndDate.length === 10 ? 'T12:00:00' : ''));
    const currentWeekRange: DateRange = {
      startDate: currentWeekStart,
      endDate: currentWeekEnd,
      label: `${data.weekStartDate} – ${data.weekEndDate}`,
    };

    const futureWeeks = getFutureWeeksInFiscalMonth(currentWeekRange, household);

    // Build the weeklyOverrides map for FUTURE week IDs only
    // STRICT RULE: Baseline categories remain completely untouched in Firestore and state.
    const newWeeklyOverrides: Record<string, Record<string, number>> = {
      ...(household.weeklyOverrides || {}),
    };

    const householdDocUpdates: Record<string, any> = {
      lastCheckInAt: now,
    };

    futureWeeks.forEach((fw) => {
      const fwId = getWeekId(fw, household.firstDayOfWeek || 'Monday');
      if (!newWeeklyOverrides[fwId]) {
        newWeeklyOverrides[fwId] = {};
      }
      data.decisions.forEach((dec) => {
        const cat = categories.find((c) => c.id === dec.categoryId);
        const targetBudget = dec.newWeeklyBudget;
        
        // Write to future week override payload
        householdDocUpdates[`weeklyOverrides.${fwId}.${dec.categoryId}`] = targetBudget;
        newWeeklyOverrides[fwId][dec.categoryId] = targetBudget;

        if (cat?.name) {
          const slug = cat.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const altSlug = cat.name.toLowerCase().replace(/\s+/g, '');
          if (slug) {
            householdDocUpdates[`weeklyOverrides.${fwId}.${slug}`] = targetBudget;
            newWeeklyOverrides[fwId][slug] = targetBudget;
          }
          if (altSlug && altSlug !== slug) {
            householdDocUpdates[`weeklyOverrides.${fwId}.${altSlug}`] = targetBudget;
            newWeeklyOverrides[fwId][altSlug] = targetBudget;
          }
        }
      });
    });

    // Update household in local state (WITHOUT mutating categories)
    setHousehold((prev) => (prev ? { ...prev, weeklyOverrides: newWeeklyOverrides, lastCheckInAt: now } : prev));
    setCheckIns((prev) => [newCheckIn, ...prev]);

    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);

        // Add immutable checkin doc for the historical record
        const checkinRef = doc(db, 'households', household.id, 'checkins', checkInId);
        batch.set(checkinRef, sanitizeFirestorePayload(newCheckIn));

        // Update household document with future weeklyOverrides ONLY (no past or current week IDs, baseline untouched)
        const householdRef = doc(db, 'households', household.id);
        batch.update(householdRef, sanitizeFirestorePayload(householdDocUpdates));

        // Add activity feed item - date set to the Sunday of the checked-in week
        const checkinSunday = data.weekEndDate || formatLocalDate(new Date(data.weekStartDate));
        const feedRef = doc(db, 'households', household.id, 'feed', `feed_${now}`);
        const feedPayload: FeedItem = {
          id: `feed_${now}`,
          type: 'checkin',
          content: `Completed Weekly Check-In: Banked $${data.totalSaved} in savings pot and balanced category budgets.`,
          authorId: user?.userId || 'usr_self',
          authorName: user?.name || 'Member',
          authorAvatar: user?.avatarUrl,
          timestamp: now,
          date: checkinSunday,
          linkedCheckInId: checkInId,
          weekStartDate: data.weekStartDate,
          weekEndDate: data.weekEndDate,
          metadata: {
            checkInId,
            totalSaved: data.totalSaved,
            totalSpent: data.totalSpent,
            totalBudget: data.totalBudget,
          },
        };
        batch.set(feedRef, sanitizeFirestorePayload(feedPayload));
        setFeedItems((prev) => [feedPayload, ...prev]);

        await batch.commit();
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/checkins`);
        showToast(`Firestore Write Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }

    closeWeeklyCheckInModal();
    showToast(`Weekly Check-In completed. $${data.totalSaved} banked into savings pot.`);
  };

  // Delete Historical Weekly Check-In & State Reversal (Removes check-in and its feed items)
  const deleteWeeklyCheckIn = async (checkInId: string) => {
    if (!household) return;

    const targetCheckIn = checkIns.find((c) => c.id === checkInId);
    if (!targetCheckIn) {
      console.warn(`[HouseholdContext] Check-in ${checkInId} not found.`);
      return;
    }

    // 1. Calculate future weeks in this fiscal month that were affected by this check-in
    const checkInWeekStart = new Date(
      targetCheckIn.weekStartDate + (targetCheckIn.weekStartDate.length === 10 ? 'T12:00:00' : '')
    );
    const checkInWeekEnd = new Date(
      targetCheckIn.weekEndDate + (targetCheckIn.weekEndDate.length === 10 ? 'T12:00:00' : '')
    );
    const checkInWeekRange: DateRange = {
      startDate: checkInWeekStart,
      endDate: checkInWeekEnd,
      label: `${targetCheckIn.weekStartDate} – ${targetCheckIn.weekEndDate}`,
    };

    const futureWeeks = getFutureWeeksInFiscalMonth(checkInWeekRange, household);
    const futureWeekIds = new Set(futureWeeks.map((fw) => getWeekId(fw, household.firstDayOfWeek || 'Monday')));

    // Clean weeklyOverrides: remove overrides for these future week IDs
    const currentWeeklyOverrides = household.weeklyOverrides || {};
    const updatedWeeklyOverrides: Record<string, Record<string, number>> = {};
    const householdDocUpdates: Record<string, any> = {};

    // Explicitly target all future week IDs affected by this check-in with deleteField()
    futureWeekIds.forEach((fwId) => {
      householdDocUpdates[`weeklyOverrides.${fwId}`] = deleteField();
    });

    Object.entries(currentWeeklyOverrides).forEach(([wId, catOverrides]) => {
      if (futureWeekIds.has(wId)) {
        householdDocUpdates[`weeklyOverrides.${wId}`] = deleteField();
      } else {
        updatedWeeklyOverrides[wId] = catOverrides as Record<string, number>;
      }
    });

    // 2. Identify and remove any feed items associated with this deleted check-in
    const feedItemsToDelete = feedItems.filter(
      (it) =>
        it.linkedCheckInId === checkInId ||
        it.metadata?.checkInId === checkInId ||
        (it.type === 'checkin' && (
          it.id === `feed_${targetCheckIn.timestamp}` ||
          it.date === targetCheckIn.weekEndDate ||
          it.weekEndDate === targetCheckIn.weekEndDate ||
          it.weekStartDate === targetCheckIn.weekStartDate ||
          (it.content && it.content.includes(targetCheckIn.weekStartDate))
        ))
    );
    const feedItemIdsToDelete = new Set(feedItemsToDelete.map((it) => it.id));

    // 3. Optimistic local state update (Remove check-in, update overrides, delete feed items)
    setCheckIns((prev) => prev.filter((c) => c.id !== checkInId));
    setHousehold((prev) => (prev ? { ...prev, weeklyOverrides: updatedWeeklyOverrides } : prev));
    setFeedItems((prev) => prev.filter((it) => !feedItemIdsToDelete.has(it.id)));

    showToast('Weekly check-in removed from feed and budget prorations reversed.', 'info');

    // 4. Firestore Deletion of checkin document and associated feed item documents
    if (isFirebaseConfigured && db && household?.id) {
      try {
        const batch = writeBatch(db);

        // Delete checkin document
        const checkinRef = doc(db, 'households', household.id, 'checkins', checkInId);
        batch.delete(checkinRef);

        // Delete associated feed items from Firestore
        feedItemsToDelete.forEach((fi) => {
          const feedDocRef = doc(db, 'households', household.id, 'feed', fi.id);
          batch.delete(feedDocRef);
        });

        // Update household document with cleaned weeklyOverrides
        if (Object.keys(householdDocUpdates).length > 0) {
          const householdRef = doc(db, 'households', household.id);
          batch.update(householdRef, householdDocUpdates);
        }

        await batch.commit();
      } catch (err) {
        console.error('Firestore Check-In Deletion Failed:', err);
        handleFirestoreError(err, OperationType.DELETE, `households/${household.id}/checkins/${checkInId}`);
        showToast(`Failed to delete check-in from cloud: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
  };

  // Update notes/reflection for a completed check-in
  const updateCheckInNotes = async (checkInId: string, notes: string) => {
    if (!household) return;

    // Optimistically update local check-in
    setCheckIns((prev) =>
      prev.map((c) => (c.id === checkInId ? { ...c, notes } : c))
    );

    showToast('Reflection comment updated.');

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const checkinRef = doc(db, 'households', household.id, 'checkins', checkInId);
        await updateDoc(checkinRef, { notes, updatedAt: new Date().toISOString() });

        const now = Date.now();
        const feedRef = doc(db, 'households', household.id, 'feed', `feed_note_${now}`);
        await setDoc(
          feedRef,
          sanitizeFirestorePayload({
            id: `feed_note_${now}`,
            type: 'checkin',
            content: `Updated Weekly Reflection: "${notes}"`,
            authorId: user?.userId || 'usr_self',
            authorName: user?.name || 'Member',
            authorAvatar: user?.avatarUrl,
            timestamp: now,
            date: formatLocalDate(new Date(now)),
          })
        );
      } catch (err) {
        console.error('Failed to update check-in notes in Firestore:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/checkins/${checkInId}`);
        showToast(`Failed to update comment: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }
  };

  // Update check-in record values (e.g. from post-checkin transaction mutation)
  const updateCheckIn = async (checkInId: string, updates: Partial<CheckIn>) => {
    if (!household) return;

    // Optimistically update local check-in
    setCheckIns((prev) =>
      prev.map((c) => (c.id === checkInId ? { ...c, ...updates } : c))
    );

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const checkinRef = doc(db, 'households', household.id, 'checkins', checkInId);
        await updateDoc(
          checkinRef,
          sanitizeFirestorePayload({
            ...updates,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (err) {
        console.error('Failed to update check-in in Firestore:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/checkins/${checkInId}`);
      }
    }
  };

  // Trigger Fresh Start (Resolves missed weeks with $0 on-budget expenses)
  const triggerFreshStartAction = async () => {
    if (!household) return;

    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    // Reset weeklyOverrides to empty
    setHousehold((prev) => (prev ? { ...prev, weeklyOverrides: {}, lastFreshStartAt: now } : prev));

    const freshCheckIn: CheckIn = {
      id: `checkin_fresh_${now}`,
      fiscalWeekId: getFiscalWeekId(todayStr, household.fiscalYearEndMonth || 12),
      weekStartDate: todayStr,
      weekEndDate: todayStr,
      completedByUserId: user?.userId || 'usr_self',
      completedByName: user?.name || 'Fresh Start',
      timestamp: now,
      status: 'completed',
      notes: 'Fresh Start Auto-Budget Assumption: All gap weeks resolved on-budget.',
      totalSaved: 0,
      totalSpent: 0,
      totalBudget: categories.reduce((sum, c) => sum + (Number(c.baselineBudget) || 0), 0),
    };
    setCheckIns((prev) => [freshCheckIn, ...prev]);

    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);

        // Add checkin doc
        const checkinRef = doc(db, 'households', household.id, 'checkins', freshCheckIn.id);
        batch.set(checkinRef, sanitizeFirestorePayload(freshCheckIn));

        // Update household: reset weeklyOverrides and set lastFreshStartAt
        const householdRef = doc(db, 'households', household.id);
        batch.update(
          householdRef,
          sanitizeFirestorePayload({
            weeklyOverrides: {},
            lastFreshStartAt: now,
          })
        );

        // Add feed note
        const feedRef = doc(db, 'households', household.id, 'feed', `feed_fresh_${now}`);
        batch.set(
          feedRef,
          sanitizeFirestorePayload({
            id: `feed_fresh_${now}`,
            type: 'freshStart',
            content: `Applied Fresh Start: Reset all category budgets to baseline targets.`,
            authorId: user?.userId || 'usr_self',
            authorName: user?.name || 'Member',
            authorAvatar: user?.avatarUrl,
            timestamp: now,
            date: todayStr,
          })
        );

        await batch.commit();
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/fresh_start`);
        showToast(`Firestore Write Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }

    showToast('Fresh Start applied. All past-due blockers resolved with on-budget baseline assumptions.');
  };

  // Execute Month-End Hard Reset
  const executeMonthEndResetAction = async () => {
    if (!household) return;

    const now = Date.now();
    // Monthly Reviews should display on the Sunday of the last day of the fiscal month
    const fiscalMonthOfReset = getFiscalMonthForDate(new Date(now), household?.fiscalYearEndMonth || 12);
    const lastDaySundayStr = formatLocalDate(fiscalMonthOfReset.endDate);

    // Monthly Reset: Roll-overs only happen within a month.
    // At the end of the month, the budget is reset to default baseline and weeklyOverrides is cleared.
    setHousehold((prev) => (prev ? { ...prev, weeklyOverrides: {}, lastMonthEndReset: now } : prev));

    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);

        const householdRef = doc(db, 'households', household.id);
        batch.update(
          householdRef,
          sanitizeFirestorePayload({
            weeklyOverrides: {},
            lastMonthEndReset: now,
          })
        );

        const feedRef = doc(db, 'households', household.id, 'feed', `feed_month_reset_${now}`);
        const feedPayload: FeedItem = {
          id: `feed_month_reset_${now}`,
          type: 'monthEndReset',
          content: `Month-End Reset: All category budgets refreshed for the new calendar month.`,
          authorId: user?.userId || 'usr_self',
          authorName: user?.name || 'Member',
          authorAvatar: user?.avatarUrl,
          timestamp: now,
          date: lastDaySundayStr,
        };
        batch.set(feedRef, sanitizeFirestorePayload(feedPayload));
        setFeedItems((prev) => [feedPayload, ...prev]);

        await batch.commit();
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/month_end_reset`);
        showToast(`Firestore Write Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }

    showToast('Month-End Hard Reset executed. All category budgets returned to baseline values.');
  };

  // Apply Extra Paycheck Decision (Savings / Prorate / Custom)
  const applyExtraPaycheckDecision = async (decision: ExtraPaycheckDecision) => {
    if (!household) return;

    const currentDecisions = household.extraPaycheckDecisions || {};
    const updatedDecisions = {
      ...currentDecisions,
      [decision.monthKey]: decision,
    };

    let updatedCats = [...categories];

    if (decision.option === 'savings') {
      // Allocate 100% of extra income to Savings group category
      const savingsCat = updatedCats.find((c) => c.group === 'Savings' || c.name.toLowerCase().includes('savings')) || updatedCats[updatedCats.length - 1];
      if (savingsCat) {
        updatedCats = updatedCats.map((c) =>
          c.id === savingsCat.id
            ? { ...c, currentWeeklyBudget: (c.currentWeeklyBudget || c.baselineBudget) + decision.totalExtraIncome }
            : c
        );
      }
    } else if (decision.option === 'prorate') {
      // Prorate across all categories according to baselineBudget proportions
      const totalBaseline = updatedCats.reduce((s, c) => s + (c.baselineBudget || 1), 0);
      if (totalBaseline > 0) {
        let remainder = decision.totalExtraIncome;
        updatedCats = updatedCats.map((c, idx) => {
          const isLast = idx === updatedCats.length - 1;
          const portion = isLast ? remainder : Math.round(decision.totalExtraIncome * ((c.baselineBudget || 1) / totalBaseline));
          remainder -= portion;
          return {
            ...c,
            currentWeeklyBudget: (c.currentWeeklyBudget || c.baselineBudget) + portion,
          };
        });
      }
    } else if (decision.option === 'extra_week_buffer') {
      // Option C: Prorate for the extra week to maintain standard baseline, route remainder to savings
      const totalBaseline = updatedCats.reduce((s, c) => s + (c.baselineBudget || 1), 0);
      const extraWeekNeed = decision.extraWeekBufferAmount !== undefined ? decision.extraWeekBufferAmount : Math.min(decision.totalExtraIncome, totalBaseline);
      const savingsRemainder = decision.savingsPortion !== undefined ? decision.savingsPortion : Math.max(0, decision.totalExtraIncome - extraWeekNeed);

      if (totalBaseline > 0 && extraWeekNeed > 0) {
        let remainder = extraWeekNeed;
        updatedCats = updatedCats.map((c, idx) => {
          const isLast = idx === updatedCats.length - 1;
          const portion = isLast ? remainder : Math.round(extraWeekNeed * ((c.baselineBudget || 1) / totalBaseline));
          remainder -= portion;
          return {
            ...c,
            currentWeeklyBudget: (c.currentWeeklyBudget || c.baselineBudget) + portion,
          };
        });
      }

      if (savingsRemainder > 0) {
        const savingsCat = updatedCats.find((c) => c.group === 'Savings' || c.name.toLowerCase().includes('savings')) || updatedCats[updatedCats.length - 1];
        if (savingsCat) {
          updatedCats = updatedCats.map((c) =>
            c.id === savingsCat.id
              ? { ...c, currentWeeklyBudget: (c.currentWeeklyBudget || c.baselineBudget) + savingsRemainder }
              : c
          );
        }
      }
    } else if (decision.option === 'custom' && decision.customPercentages) {
      // Custom percentage allocation per category
      updatedCats = updatedCats.map((c) => {
        const pct = decision.customPercentages?.[c.id] || 0;
        const addAmount = Math.round((decision.totalExtraIncome * pct) / 100);
        return {
          ...c,
          currentWeeklyBudget: (c.currentWeeklyBudget || c.baselineBudget) + addAmount,
        };
      });
    }

    // Optimistic update
    setHousehold({ ...household, extraPaycheckDecisions: updatedDecisions });
    setCategories(updatedCats);

    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    const feedItem: FeedItem = {
      id: `feed_extra_pay_${now}`,
      type: 'message',
      content: `🎉 Extra Paycheck Allocated: Added $${decision.totalExtraIncome} via ${
        decision.option === 'savings'
          ? 'Option A (100% Savings Pot)'
          : decision.option === 'prorate'
          ? 'Option B (Proportional Baseline Split)'
          : decision.option === 'extra_week_buffer'
          ? 'Option C (Extra Week Buffer & Savings Remainder)'
          : 'Option D (Custom Category Split)'
      }.`,
      authorId: user?.userId || 'usr_self',
      authorName: user?.name || 'Member',
      authorAvatar: user?.avatarUrl,
      timestamp: now,
      date: todayStr,
    };

    setFeedItems((prev) => [feedItem, ...prev]);

    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        const householdRef = doc(db, 'households', household.id);
        batch.update(
          householdRef,
          sanitizeFirestorePayload({
            extraPaycheckDecisions: updatedDecisions,
          })
        );

        updatedCats.forEach((c) => {
          const catRef = doc(db, 'households', household.id, 'categories', c.id);
          batch.update(
            catRef,
            sanitizeFirestorePayload({
              currentWeeklyBudget: c.currentWeeklyBudget,
            })
          );
        });

        const feedRef = doc(db, 'households', household.id, 'feed', feedItem.id);
        batch.set(feedRef, sanitizeFirestorePayload(feedItem));

        await batch.commit();
      } catch (err) {
        console.error('Firestore Write Failed for Extra Paycheck:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/extra_paycheck`);
        showToast(`Error saving allocation: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }

    showToast(`Extra paycheck of $${decision.totalExtraIncome} successfully allocated!`, 'success');
  };

  const resetHouseholdToOnboarding = () => {
    setHousehold(null);
    setMembers([]);
    setCategories([]);
    setExpenses([]);
    setCheckIns([]);
    setFeedItems([]);
    setIsOnboarding(true);
  };

  // Tag CRUD & Cascading DB Updates
  const addCustomTag = async (tag: string, categoryId?: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId);
      if (cat) {
        const existing = cat.subcategories || [];
        if (!existing.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
          const updated = [...existing, trimmed];
          await updateCategory(categoryId, { subcategories: updated });
        }
      }
    }
    showToast(`Added tag "${trimmed}"`, 'success');
  };

  const renameTag = async (oldTag: string, newTag: string, categoryId?: string) => {
    const trimmedOld = oldTag.trim();
    const trimmedNew = newTag.trim();
    if (!trimmedOld || !trimmedNew || trimmedOld.toLowerCase() === trimmedNew.toLowerCase()) return;

    // 1. Atomic local state update for immediate reactive UI
    setExpenses((prev) =>
      prev.map((exp) => {
        if (!exp.tags || !exp.tags.some((t) => t.trim().toLowerCase() === trimmedOld.toLowerCase())) {
          return exp;
        }
        return {
          ...exp,
          tags: exp.tags.map((t) => (t.trim().toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : t)),
        };
      })
    );

    setCategories((prev) =>
      prev.map((cat) => {
        if (!cat.subcategories || !cat.subcategories.some((t) => t.trim().toLowerCase() === trimmedOld.toLowerCase())) {
          return cat;
        }
        return {
          ...cat,
          subcategories: cat.subcategories.map((t) =>
            t.trim().toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : t
          ),
        };
      })
    );

    // 2. Cascading Batch Update in Firestore across all historical transaction documents
    if (household?.id && isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        const affectedExpenses = expenses.filter((e) =>
          e.tags?.some((t) => t.trim().toLowerCase() === trimmedOld.toLowerCase())
        );

        affectedExpenses.forEach((exp) => {
          const updatedTags = (exp.tags || []).map((t) =>
            t.trim().toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : t
          );
          const expRef = doc(db, 'households', household.id, 'expenses', exp.id);
          batch.update(expRef, sanitizeFirestorePayload({ tags: updatedTags }));
        });

        // Also update subcategories array on categories
        categories.forEach((cat) => {
          if (cat.subcategories && cat.subcategories.some((t) => t.trim().toLowerCase() === trimmedOld.toLowerCase())) {
            const updatedSubs = cat.subcategories.map((t) =>
              t.trim().toLowerCase() === trimmedOld.toLowerCase() ? trimmedNew : t
            );
            const catRef = doc(db, 'households', household.id, 'categories', cat.id);
            batch.update(catRef, sanitizeFirestorePayload({ subcategories: updatedSubs }));
          }
        });

        await batch.commit();
        showToast(`Renamed tag "${trimmedOld}" to "${trimmedNew}" across all transactions!`, 'success');
      } catch (err) {
        console.error('Firestore tag rename batch failed:', err);
        showToast('Error updating historical transactions', 'error');
      }
    } else {
      showToast(`Renamed tag "${trimmedOld}" to "${trimmedNew}"!`, 'success');
    }
  };

  const deleteTag = async (tagToDelete: string, categoryId?: string) => {
    const trimmed = tagToDelete.trim();
    if (!trimmed) return;

    // 1. Atomic local state update for immediate reactive UI
    setExpenses((prev) =>
      prev.map((exp) => {
        if (!exp.tags || !exp.tags.some((t) => t.trim().toLowerCase() === trimmed.toLowerCase())) {
          return exp;
        }
        return {
          ...exp,
          tags: exp.tags.filter((t) => t.trim().toLowerCase() !== trimmed.toLowerCase()),
        };
      })
    );

    setCategories((prev) =>
      prev.map((cat) => {
        if (!cat.subcategories || !cat.subcategories.some((t) => t.trim().toLowerCase() === trimmed.toLowerCase())) {
          return cat;
        }
        return {
          ...cat,
          subcategories: cat.subcategories.filter(
            (t) => t.trim().toLowerCase() !== trimmed.toLowerCase()
          ),
        };
      })
    );

    // 2. Cascading Batch Update in Firestore across all historical transaction documents
    if (household?.id && isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        const affectedExpenses = expenses.filter((e) =>
          e.tags?.some((t) => t.trim().toLowerCase() === trimmed.toLowerCase())
        );

        affectedExpenses.forEach((exp) => {
          const updatedTags = (exp.tags || []).filter(
            (t) => t.trim().toLowerCase() !== trimmed.toLowerCase()
          );
          const expRef = doc(db, 'households', household.id, 'expenses', exp.id);
          batch.update(expRef, sanitizeFirestorePayload({ tags: updatedTags }));
        });

        // Also remove from category subcategories
        categories.forEach((cat) => {
          if (cat.subcategories && cat.subcategories.some((t) => t.trim().toLowerCase() === trimmed.toLowerCase())) {
            const updatedSubs = cat.subcategories.filter(
              (t) => t.trim().toLowerCase() !== trimmed.toLowerCase()
            );
            const catRef = doc(db, 'households', household.id, 'categories', cat.id);
            batch.update(catRef, sanitizeFirestorePayload({ subcategories: updatedSubs }));
          }
        });

        await batch.commit();
        showToast(`Removed tag "${trimmed}" from all transactions!`, 'info');
      } catch (err) {
        console.error('Firestore tag delete batch failed:', err);
        showToast('Error removing tag from transactions', 'error');
      }
    } else {
      showToast(`Removed tag "${trimmed}"!`, 'info');
    }
  };

  return (
    <HouseholdContext.Provider
      value={{
        user,
        household,
        members,
        categories,
        expenses,
        checkIns,
        feedItems,
        isLoading,
        isHouseholdLoading,
        activeTab,
        setActiveTab,
        isOnboarding,
        setIsOnboarding,

        selectedLedgerCategoryId,
        setSelectedLedgerCategoryId,
        navigateToCategoryLedger,
        ledgerDateRangeLabel,
        setLedgerDateRangeLabel,

        addTransactionComment,
        addTransactionReaction,
        postFeedMessage,

        timeframeMode,
        setTimeframeMode,
        timeframeOffset,
        setTimeframeOffset,
        resetTimeframeToCurrent,
        activeDateRange,

        isStagingModalOpen,
        stagedExpenses,
        openStagingModal,
        closeStagingModal,
        addStagedItem,
        updateStagedItem,
        removeStagedItem,
        confirmAllStagedExpenses,

        isLogExpenseModalOpen,
        logExpenseInitialCategory,
        isCategoryLockedInModal,
        openLogExpenseModal,
        closeLogExpenseModal,
        addCustomTag,
        renameTag,
        deleteTag,

        isWeeklyCheckInModalOpen,
        weeklyCheckInTargetRange,
        openWeeklyCheckInModal,
        closeWeeklyCheckInModal,
        isMonthlyRetroModalOpen,
        openMonthlyRetroModal,
        closeMonthlyRetroModal,
        isAllocationModalOpen,
        openAllocationModal,
        closeAllocationModal,
        completeWeeklyCheckIn,
        deleteWeeklyCheckIn,
        updateCheckInNotes,
        updateCheckIn,
        triggerFreshStartAction,
        executeMonthEndResetAction,

        createCategory,
        updateCategory,
        deleteCategory,
        saveCategoryAllocations,

        savingsGoals,
        createSavingsGoal,
        updateSavingsGoal,
        deleteSavingsGoal,
        allocateSavingsToGoals,

        addExpense,
        deleteExpense,
        updateExpense,

        toastMessage,
        toastType,
        showToast,

        signInWithGoogle,
        switchActiveMember,
        signOut,
        deleteAccount,
        completeOnboarding,
        joinHouseholdWithSyncCode,
        getHouseholdBySyncCode,
        leaveHousehold,
        removeHouseholdMember,
        updateHousehold,
        updateMemberIncome,
        addOneOffDeposit,
        updateDeposit,
        deleteDeposit,
        applyExtraPaycheckDecision,
        resetHouseholdToOnboarding,

        userHouseholds,
        switchHousehold,
        triggerAutomatedDrawdown,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
};
