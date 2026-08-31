/**
 * Canopy Budgeting App - Universal Household State & Persistence Engine
 * Phase 5 Master Context: Live Firestore Subscriptions, Dynamic Allocations, Real-time Feeds & Social Interactions
 */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
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
  TimeframeMode,
  DateRange,
  FeedItem,
  TransactionComment,
  TransactionReaction,
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
} from '../lib/calculations';
import { auth, db, googleProvider, isFirebaseConfigured, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
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
  Timestamp,
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

interface HouseholdContextType {
  user: UserProfile | null;
  household: Household | null;
  members: HouseholdMember[];
  categories: Category[];
  expenses: Expense[];
  checkIns: CheckIn[];
  feedItems: FeedItem[];
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOnboarding: boolean;
  setIsOnboarding: (val: boolean) => void;
  
  // Lateral Category Drill-Down Navigation State (Phase 5)
  selectedLedgerCategoryId: string | null;
  setSelectedLedgerCategoryId: (catId: string | null) => void;
  navigateToCategoryLedger: (catId: string | null) => void;

  // Social Feed & Transaction Interactions (Phase 5)
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
  logExpenseInitialCategory: string | null;
  openLogExpenseModal: (categoryId?: string) => void;
  closeLogExpenseModal: () => void;

  // CheckIn & Retrospective modals
  isWeeklyCheckInModalOpen: boolean;
  openWeeklyCheckInModal: () => void;
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
  triggerFreshStartAction: () => Promise<void>;
  executeMonthEndResetAction: () => Promise<void>;

  // Category mutations
  createCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  saveCategoryAllocations: (updatedCategories: Category[]) => Promise<void>;

  // Expense mutations
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
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  joinHouseholdWithSyncCode: (syncCode: string) => Promise<{ success: boolean; message?: string }>;
  leaveHousehold: () => Promise<void>;
  updateHousehold: (updated: Partial<Household>) => Promise<void>;
  updateMemberIncome: (memberId: string, rawIncome: number, schedule: HouseholdMember['incomeSchedule'], hasProvided: boolean) => Promise<void>;
  resetHouseholdToOnboarding: () => void;
}

const STORAGE_KEYS = {
  USER: 'canopy_user_v2',
  HOUSEHOLD: 'canopy_household_v2',
  MEMBERS: 'canopy_members_v2',
  CATEGORIES: 'canopy_categories_v2',
  EXPENSES: 'canopy_expenses_v2',
  CHECKINS: 'canopy_checkins_v2',
  FEED: 'canopy_feed_v2',
};

function getInitialFeedItems(
  household: Household | null,
  members: HouseholdMember[],
  expenses: Expense[],
  categories: Category[]
): FeedItem[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const memberMap = new Map(members.map((m) => [m.userId, m.name]));

  const items: FeedItem[] = [];

  // Seed expense feed items
  expenses.slice(0, 8).forEach((exp) => {
    const cat = catMap.get(exp.categoryId);
    const payerName = memberMap.get(exp.loggedByUserId) || 'Household Member';
    const member = members.find((m) => m.userId === exp.loggedByUserId);

    items.push({
      id: `feed_exp_${exp.id}`,
      type: 'transaction',
      content: `Logged $${exp.amount.toFixed(2)} for ${exp.description}`,
      authorId: exp.loggedByUserId,
      authorName: payerName,
      authorAvatar: member?.avatarUrl,
      timestamp: exp.timestamp || Date.now(),
      date: exp.date,
      linkedExpenseId: exp.id,
      linkedExpense: {
        id: exp.id,
        description: exp.description,
        categoryName: cat?.name || 'General',
        categoryIcon: cat?.icon || 'tag',
        amount: exp.amount,
        date: exp.date,
        payerName,
      },
    });
  });

  // Seed household welcome note if available
  if (household) {
    items.push({
      id: 'feed_welcome_1',
      type: 'message',
      content: `🌿 Welcome to Canopy! Sync Code: ${household.syncCode}. Real-time balance and category ledgers are live.`,
      authorId: 'system',
      authorName: 'Canopy System',
      authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      timestamp: Date.now() - 86400000 * 2,
      date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    });
  }

  return items.sort((a, b) => b.timestamp - a.timestamp);
}

// Phase 2 Default Categories Template (Weekly Normalized)
const DEFAULT_CATEGORIES_PRESETS = [
  { name: 'Groceries & Household', baselineBudget: 220, icon: 'shopping-cart', isFixed: false },
  { name: 'Dining Out & Drinks', baselineBudget: 150, icon: 'coffee', isFixed: false },
  { name: 'Rent & Utilities', baselineBudget: 650, icon: 'home', isFixed: true },
  { name: 'Transportation & Gas', baselineBudget: 90, icon: 'car', isFixed: false },
  { name: 'Subscriptions & Media', baselineBudget: 35, icon: 'film', isFixed: true },
  { name: 'Entertainment & Fun', baselineBudget: 80, icon: 'smile', isFixed: false },
  { name: 'Personal Care & Health', baselineBudget: 45, icon: 'heart', isFixed: false },
];

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Primary State
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    // Default guest profile
    return {
      userId: 'usr_guest_demo',
      name: 'Alex Rivera',
      email: 'alex.rivera@example.com',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      activeHouseholdId: 'hh_default_demo',
      createdAt: new Date().toISOString(),
    };
  });

  const [household, setHousehold] = useState<Household | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HOUSEHOLD);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      id: 'hh_default_demo',
      name: "Rivera & Jordan's Canopy",
      syncCode: 'CNP-8X2',
      accountType: 'couple',
      roommateCount: null,
      weeklyIncomePool: 1850,
      calendarMode: 'weekly',
      firstDayOfWeek: 'Monday',
      lastDayOfWeek: 'Sunday',
      createdById: 'usr_guest_demo',
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    };
  });

  const [members, setMembers] = useState<HouseholdMember[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        userId: 'usr_guest_demo',
        name: 'Alex Rivera',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        rawIncome: 2400,
        incomeSchedule: 'bi-weekly',
        normalizedWeeklyIncome: 1107.69,
        hasProvidedIncome: true,
        isCurrentUser: true,
      },
      {
        userId: 'usr_jordan_demo',
        name: 'Jordan Miller',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        rawIncome: 3200,
        incomeSchedule: 'monthly',
        normalizedWeeklyIncome: 738.46,
        hasProvidedIncome: true,
        isCurrentUser: false,
      },
    ];
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return DEFAULT_CATEGORIES_PRESETS.map((p, idx) => ({
      id: `cat_${idx + 1}`,
      name: p.name,
      baselineBudget: p.baselineBudget,
      currentWeeklyBudget: p.baselineBudget,
      icon: p.icon,
      isFixed: p.isFixed,
      totalLogged: 0,
      transactionCount: 0,
    }));
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    const today = new Date();
    const formatDate = (offsetDays: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().split('T')[0];
    };

    return [
      {
        id: 'exp_1',
        amount: 84.5,
        description: 'Trader Joe’s Weekly Restock',
        categoryId: 'cat_1',
        date: formatDate(1),
        timestamp: Date.now() - 86400000,
        loggedByUserId: 'usr_guest_demo',
      },
      {
        id: 'exp_2',
        amount: 38.0,
        description: 'Taqueria Dinner & Margaritas',
        categoryId: 'cat_2',
        date: formatDate(2),
        timestamp: Date.now() - 86400000 * 2,
        loggedByUserId: 'usr_jordan_demo',
      },
      {
        id: 'exp_3',
        amount: 45.0,
        description: 'Shell Gasoline Fill-up',
        categoryId: 'cat_4',
        date: formatDate(3),
        timestamp: Date.now() - 86400000 * 3,
        loggedByUserId: 'usr_guest_demo',
      },
      {
        id: 'exp_4',
        amount: 15.99,
        description: 'Spotify Family Subscription',
        categoryId: 'cat_5',
        date: formatDate(4),
        timestamp: Date.now() - 86400000 * 4,
        loggedByUserId: 'usr_jordan_demo',
      },
      {
        id: 'exp_5',
        amount: 650.0,
        description: 'Weekly Rent Contribution',
        categoryId: 'cat_3',
        date: formatDate(5),
        timestamp: Date.now() - 86400000 * 5,
        loggedByUserId: 'usr_guest_demo',
      },
    ];
  });

  const [checkIns, setCheckIns] = useState<CheckIn[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CHECKINS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [feedItems, setFeedItems] = useState<FeedItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FEED);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return getInitialFeedItems(household, members, expenses, categories);
  });

  // UI Navigation & View Modes
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);

  // Lateral Category Drill-Down Navigation State (Phase 5)
  const [selectedLedgerCategoryId, setSelectedLedgerCategoryId] = useState<string | null>(null);

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
  const [logExpenseInitialCategory, setLogExpenseInitialCategory] = useState<string | null>(null);

  const openLogExpenseModal = (categoryId?: string) => {
    setLogExpenseInitialCategory(categoryId || null);
    setIsLogExpenseModalOpen(true);
  };

  const closeLogExpenseModal = () => {
    setIsLogExpenseModalOpen(false);
    setLogExpenseInitialCategory(null);
  };

  // CheckIn & Retrospective Modals State
  const [isWeeklyCheckInModalOpen, setIsWeeklyCheckInModalOpen] = useState<boolean>(false);
  const [isMonthlyRetroModalOpen, setIsMonthlyRetroModalOpen] = useState<boolean>(false);
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState<boolean>(false);

  const openWeeklyCheckInModal = () => setIsWeeklyCheckInModalOpen(true);
  const closeWeeklyCheckInModal = () => setIsWeeklyCheckInModalOpen(false);
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
    if (timeframeMode === 'week') {
      return getWeekRange(now, firstDay, timeframeOffset);
    } else {
      return getMonthRange(now, timeframeOffset);
    }
  }, [timeframeMode, timeframeOffset, household?.firstDayOfWeek]);

  const resetTimeframeToCurrent = () => {
    setTimeframeOffset(0);
  };

  // Local storage persistence fallbacks
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [user]);

  useEffect(() => {
    if (household) {
      localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, JSON.stringify(household));
    } else {
      localStorage.removeItem(STORAGE_KEYS.HOUSEHOLD);
    }
  }, [household]);

  useEffect(() => {
    if (members.length > 0) {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    } else {
      localStorage.removeItem(STORAGE_KEYS.MEMBERS);
    }
  }, [members]);

  useEffect(() => {
    if (categories.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
    }
  }, [categories]);

  useEffect(() => {
    if (expenses.length > 0) {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    } else {
      localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    }
  }, [expenses]);

  useEffect(() => {
    if (checkIns.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(checkIns));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CHECKINS);
    }
  }, [checkIns]);

  useEffect(() => {
    if (feedItems.length > 0) {
      localStorage.setItem(STORAGE_KEYS.FEED, JSON.stringify(feedItems));
    } else {
      localStorage.removeItem(STORAGE_KEYS.FEED);
    }
  }, [feedItems]);

  // Live Firebase Auth Listener & Session Binding
  useEffect(() => {
    if (isFirebaseConfigured && auth && db) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            // 1. Fetch user doc from Firestore
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userDocRef);

            let activeHouseholdId: string | null = null;
            let userProfileName = firebaseUser.displayName || 'Canopy Member';
            let userProfileAvatar =
              firebaseUser.photoURL ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

            if (userSnap.exists()) {
              const userData = userSnap.data();
              activeHouseholdId = userData.activeHouseholdId || null;
              if (userData.name) userProfileName = userData.name;
              if (userData.avatarUrl) userProfileAvatar = userData.avatarUrl;
            }

            // If activeHouseholdId exists, load that specific households/{householdId} doc
            if (activeHouseholdId) {
              const householdDocRef = doc(db, 'households', activeHouseholdId);
              const hhSnap = await getDoc(householdDocRef);
              if (hhSnap.exists()) {
                const loadedHousehold = { ...(hhSnap.data() as Household), id: hhSnap.id };
                setHousehold(loadedHousehold);
                const profile: UserProfile = {
                  userId: firebaseUser.uid,
                  name: userProfileName,
                  email: firebaseUser.email || '',
                  avatarUrl: userProfileAvatar,
                  activeHouseholdId,
                  createdAt: new Date().toISOString(),
                };
                setUser(profile);
                setIsOnboarding(false);
                return;
              }
            }

            // Fallback: check if user created any household
            const hhQuery = query(collection(db, 'households'), where('createdById', '==', firebaseUser.uid));
            const hhSnapshot = await getDocs(hhQuery);
            if (!hhSnapshot.empty) {
              const foundHhDoc = hhSnapshot.docs[0];
              activeHouseholdId = foundHhDoc.id;
              const loadedHousehold = { ...(foundHhDoc.data() as Household), id: foundHhDoc.id };
              setHousehold(loadedHousehold);

              // Update user doc with linked activeHouseholdId
              await setDoc(
                userDocRef,
                sanitizeFirestorePayload({
                  userId: firebaseUser.uid,
                  name: userProfileName,
                  email: firebaseUser.email || '',
                  avatarUrl: userProfileAvatar,
                  activeHouseholdId,
                  updatedAt: new Date().toISOString(),
                }),
                { merge: true }
              );

              const profile: UserProfile = {
                userId: firebaseUser.uid,
                name: userProfileName,
                email: firebaseUser.email || '',
                avatarUrl: userProfileAvatar,
                activeHouseholdId,
                createdAt: new Date().toISOString(),
              };
              setUser(profile);
              setIsOnboarding(false);
              return;
            }

            // If no household document exists for this user, open onboarding
            const profile: UserProfile = {
              userId: firebaseUser.uid,
              name: userProfileName,
              email: firebaseUser.email || '',
              avatarUrl: userProfileAvatar,
              activeHouseholdId: null,
              createdAt: new Date().toISOString(),
            };
            setUser(profile);
            setIsOnboarding(true);
          } catch (err) {
            console.error('Firestore Error loading user session:', err);
            showToast(`Session load error: ${err instanceof Error ? err.message : String(err)}`, 'error');
            setIsOnboarding(true);
          }
        } else {
          // Logged out
          setUser(null);
          setHousehold(null);
          setMembers([]);
          setCategories([]);
          setExpenses([]);
          setCheckIns([]);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Live Firestore Subscriptions for Household, Categories, Members, Expenses, CheckIns, and Feed
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !household?.id) return;

    const householdId = household.id;

    // Household document listener
    const unsubHousehold = onSnapshot(
      doc(db, 'households', householdId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Household;
          setHousehold({ ...data, id: snapshot.id });
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.READ, `households/${householdId}`);
      }
    );

    // Categories listener
    const unsubCategories = onSnapshot(
      collection(db, 'households', householdId, 'categories'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedCats = snapshot.docs.map((d) => ({
            ...(d.data() as Category),
            id: d.id,
          }));
          setCategories(loadedCats);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.READ, `households/${householdId}/categories`);
      }
    );

    // Members listener
    const unsubMembers = onSnapshot(
      collection(db, 'households', householdId, 'members'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedMembers = snapshot.docs.map((d) => ({
            ...(d.data() as HouseholdMember),
            userId: d.id,
            isCurrentUser: d.id === user?.userId,
          }));
          setMembers(loadedMembers);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.READ, `households/${householdId}/members`);
      }
    );

    // Expenses listener
    const unsubExpenses = onSnapshot(
      collection(db, 'households', householdId, 'expenses'),
      (snapshot) => {
        const loadedExpenses = snapshot.docs.map((d) => {
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
        loadedExpenses.sort((a, b) => b.timestamp - a.timestamp);
        setExpenses(loadedExpenses);
      },
      (err) => {
        handleFirestoreError(err, OperationType.READ, `households/${householdId}/expenses`);
      }
    );

    // CheckIns listener
    const unsubCheckIns = onSnapshot(
      collection(db, 'households', householdId, 'checkins'),
      (snapshot) => {
        const loadedCheckIns = snapshot.docs.map((d) => ({
          ...(d.data() as CheckIn),
          id: d.id,
        }));
        loadedCheckIns.sort((a, b) => b.timestamp - a.timestamp);
        setCheckIns(loadedCheckIns);
      },
      (err) => {
        handleFirestoreError(err, OperationType.READ, `households/${householdId}/checkins`);
      }
    );

    // Activity Feed listener
    const unsubFeed = onSnapshot(
      collection(db, 'households', householdId, 'feed'),
      (snapshot) => {
        if (!snapshot.empty) {
          const loadedFeed = snapshot.docs.map((d) => ({
            ...(d.data() as FeedItem),
            id: d.id,
          }));
          loadedFeed.sort((a, b) => b.timestamp - a.timestamp);
          setFeedItems(loadedFeed);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.READ, `households/${householdId}/feed`);
      }
    );

    return () => {
      unsubHousehold();
      unsubCategories();
      unsubMembers();
      unsubExpenses();
      unsubCheckIns();
      unsubFeed();
    };
  }, [household?.id, user?.userId]);

  // Google Sign-In with real Firebase GoogleAuthProvider
  const signInWithGoogle = async () => {
    if (isFirebaseConfigured && auth && googleProvider && db) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;

        const userDocRef = doc(db, 'users', fbUser.uid);
        const userSnap = await getDoc(userDocRef);

        let activeHouseholdId: string | null = null;
        let userName = fbUser.displayName || 'Canopy Member';
        let avatarUrl =
          fbUser.photoURL ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

        if (userSnap.exists()) {
          const uData = userSnap.data();
          activeHouseholdId = uData.activeHouseholdId || null;
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
              createdAt: new Date().toISOString(),
            })
          );
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
            setIsOnboarding(true);
          }
        } else {
          // Check if user previously created a household
          const hhQuery = query(collection(db, 'households'), where('createdById', '==', fbUser.uid));
          const hhSnapshot = await getDocs(hhQuery);
          if (!hhSnapshot.empty) {
            const foundHhDoc = hhSnapshot.docs[0];
            activeHouseholdId = foundHhDoc.id;
            const loadedHousehold = { ...(foundHhDoc.data() as Household), id: foundHhDoc.id };
            setHousehold(loadedHousehold);
            await setDoc(userDocRef, sanitizeFirestorePayload({ activeHouseholdId }), { merge: true });
            setIsOnboarding(false);
            setActiveTab('dashboard');
          } else {
            setIsOnboarding(true);
          }
        }

        const profile: UserProfile = {
          userId: fbUser.uid,
          name: userName,
          email: fbUser.email || '',
          avatarUrl,
          activeHouseholdId,
          createdAt: new Date().toISOString(),
        };
        setUser(profile);
        showToast(`Welcome to Canopy, ${userName.split(' ')[0]}!`);
      } catch (err: any) {
        console.error('Firestore Write Failed:', err);
        showToast(`Sign in error: ${err.message || String(err)}`, 'error');
        throw err;
      }
    } else {
      // Fallback for preview container when env vars are pending
      const fbUserId = `usr_${Date.now()}`;
      const profile: UserProfile = {
        userId: fbUserId,
        name: 'Steven Hochberg',
        email: 'steven.p.hochberg@gmail.com',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        activeHouseholdId: household?.id || null,
        createdAt: new Date().toISOString(),
      };
      setUser(profile);
      if (!household) {
        setIsOnboarding(true);
      }
      showToast('Signed in as Steven Hochberg');
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
    setIsOnboarding(false);
    localStorage.clear();
  };

  // Complete Onboarding & Live Firestore writes
  const completeOnboarding = async (data: OnboardingData) => {
    if (!user) return;

    const syncCode = data.syncCode || household?.syncCode || generateSyncCode();
    const householdId = household?.id || `hh_${Date.now()}`;
    const totalWeeklyPool = calculateWeeklyPool(data.members);
    const lastDay = getCheckInDay(data.firstDayOfWeek);

    const isRoommate = data.accountType?.toLowerCase() === 'roommate';
    const newHousehold: Household = {
      id: householdId,
      name: `${user.name.split(' ')[0]}'s Household`,
      syncCode,
      accountType: data.accountType,
      roommateCount: isRoommate ? Number(data.roommateCount) || 3 : null,
      weeklyIncomePool: totalWeeklyPool,
      calendarMode: data.calendarMode,
      firstDayOfWeek: data.firstDayOfWeek,
      lastDayOfWeek: lastDay,
      createdById: user.userId,
      createdAt: new Date().toISOString(),
    };

    const initialCategories = getDefaultCategories(totalWeeklyPool);

    const updatedUser: UserProfile = {
      ...user,
      activeHouseholdId: householdId,
    };

    // 1. Update Local React State immediately for responsive UI
    setHousehold(newHousehold);
    setMembers(data.members);
    setCategories(initialCategories);
    setUser(updatedUser);
    setIsOnboarding(false);
    setActiveTab('dashboard');

    // 2. Perform Live Firestore Writes if configured
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

        await batch.commit();
      } catch (error) {
        console.error('Firestore Write Failed:', error);
        handleFirestoreError(error, OperationType.WRITE, `households/${householdId}`);
        showToast(`Firestore Write Failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }

    showToast('Household setup complete. Categories and budget initialized.');
  };

  // Join Existing Household by 6-character Sync Code
  const joinHouseholdWithSyncCode = async (syncCode: string): Promise<{ success: boolean; message?: string }> => {
    const rawClean = syncCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!rawClean || rawClean.length < 4) {
      return { success: false, message: 'Please enter a valid 6-character sync code.' };
    }

    if (isFirebaseConfigured && db) {
      try {
        const householdsRef = collection(db, 'households');
        const q = query(householdsRef);
        const snapshot = await getDocs(q);

        const targetDoc = snapshot.docs.find((d) => {
          const sc = d.data().syncCode;
          return sc && sc.toString().toUpperCase().replace(/[^A-Z0-9]/g, '') === rawClean;
        });

        if (!targetDoc) {
          return { success: false, message: `No household found with sync code "${syncCode.trim()}". Check the code and try again.` };
        }

        const targetHouseholdData = { ...targetDoc.data(), id: targetDoc.id } as Household;
        const targetHouseholdId = targetDoc.id;

        const activeUser = user || {
          userId: `usr_${Date.now()}`,
          name: 'Household Member',
          email: 'member@canopy.local',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          activeHouseholdId: targetHouseholdId,
        };

        const updatedUser: UserProfile = {
          ...activeUser,
          activeHouseholdId: targetHouseholdId,
        };

        const newMember: HouseholdMember = {
          userId: updatedUser.userId,
          name: updatedUser.name,
          avatarUrl: updatedUser.avatarUrl,
          rawIncome: 1800,
          incomeSchedule: 'bi-weekly',
          normalizedWeeklyIncome: normalizeToWeekly(1800, 'bi-weekly'),
          hasProvidedIncome: true,
          isCurrentUser: true,
        };

        const batch = writeBatch(db);
        const userRef = doc(db, 'users', updatedUser.userId);
        batch.set(userRef, sanitizeFirestorePayload(updatedUser), { merge: true });

        const memberRef = doc(db, 'households', targetHouseholdId, 'members', updatedUser.userId);
        batch.set(memberRef, sanitizeFirestorePayload(newMember), { merge: true });

        await batch.commit();

        setUser(updatedUser);
        setHousehold(targetHouseholdData);
        setIsOnboarding(false);
        setActiveTab('dashboard');
        showToast(`Successfully connected to ${targetHouseholdData.name || 'household'}!`);
        return { success: true };
      } catch (err: any) {
        console.error('Firestore Write Failed:', err);
        showToast(`Failed to join household: ${err.message || String(err)}`, 'error');
        return { success: false, message: err.message || 'Failed to join household.' };
      }
    } else {
      // Local demo fallback
      const mockHh: Household = {
        id: `hh_joined_${Date.now()}`,
        name: `Shared Household (${syncCode.trim().toUpperCase()})`,
        syncCode: syncCode.trim().toUpperCase(),
        accountType: 'couple',
        weeklyIncomePool: 2400,
        calendarMode: 'weekly',
        firstDayOfWeek: 'Monday',
        lastDayOfWeek: 'Sunday',
        createdById: 'partner_usr',
        createdAt: new Date().toISOString(),
      };
      setHousehold(mockHh);
      if (user) {
        setUser({ ...user, activeHouseholdId: mockHh.id });
      }
      setCategories(getDefaultCategories(2400));
      setIsOnboarding(false);
      setActiveTab('dashboard');
      showToast(`Joined shared household (${syncCode.trim().toUpperCase()})!`);
      return { success: true };
    }
  };

  // Leave Current Household (preserves user profile & account history)
  const leaveHousehold = async () => {
    if (user) {
      const updatedUser: UserProfile = {
        ...user,
        activeHouseholdId: null,
      };
      setUser(updatedUser);
      if (isFirebaseConfigured && db) {
        try {
          const userRef = doc(db, 'users', user.userId);
          await setDoc(userRef, sanitizeFirestorePayload(updatedUser), { merge: true });
        } catch (err) {
          console.error('Firestore Write Failed:', err);
          showToast(`Error updating user record: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      }
    }
    setHousehold(null);
    setMembers([]);
    setCategories([]);
    setExpenses([]);
    setCheckIns([]);
    setIsOnboarding(true);
    showToast('Left current household. You can now join an existing household or create a new one.');
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
    hasProvided: boolean
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
    showToast(`Added "${newCategory.name}" category.`);
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

  // Universal Staging & Confirmation Flow
  const openStagingModal = (initial?: StagedExpense | StagedExpense[]) => {
    const defaultCategoryId = categories[0]?.id || 'cat_groceries';
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
    const defaultCategoryId = categories[0]?.id || 'cat_groceries';
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

    // Filter valid items with positive amount
    const validItems = stagedExpenses.filter((it) => Number(it.amount) > 0);
    if (validItems.length === 0) {
      showToast('Please enter an amount for at least one item before confirming.');
      return;
    }

    const now = Date.now();
    const createdExpenses: Expense[] = validItems.map((item, idx) => {
      // Resolve categoryId to a guaranteed existing household category ID
      const resolvedCategoryId =
        item.categoryId && categories.some((c) => c.id === item.categoryId)
          ? item.categoryId
          : categories[0]?.id || '';

      const dateStr = item.date || new Date().toISOString().split('T')[0];

      // Parse timestamp safely using local midday to eliminate timezone shift bugs
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
      };
    });

    // 1. Optimistic local state update for expenses
    setExpenses((prev) => [...createdExpenses, ...prev]);

    // 2. Optimistic local state update for categories (totalLogged & transactionCount)
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

    // 3. Live Firestore Batch Writes
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

        // Also add an activity feed item
        const feedRef = doc(db, 'households', household.id, 'feed', `feed_${now}`);
        const totalAmount = createdExpenses.reduce((sum, e) => sum + e.amount, 0);
        batch.set(
          feedRef,
          sanitizeFirestorePayload({
            id: `feed_${now}`,
            type: 'transaction',
            content: `Logged ${createdExpenses.length} expense${createdExpenses.length > 1 ? 's' : ''} totaling $${totalAmount.toFixed(2)}`,
            authorId: user?.userId || 'usr_self',
            timestamp: now,
          })
        );

        await batch.commit();
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/expenses`);
        showToast(`Firestore Write Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }

    closeStagingModal();
    showToast(`${createdExpenses.length} expense${createdExpenses.length > 1 ? 's' : ''} logged and synced to household budget.`);
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

  // Phase 5: Add Transaction Comment
  const addTransactionComment = async (expenseId: string, text: string) => {
    if (!text.trim()) return;

    const activeMember = members.find((m) => m.userId === user?.userId) || members[0] || {
      userId: user?.userId || 'usr_self',
      name: user?.name || 'Member',
      avatarUrl: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };

    const targetExpense = expenses.find((e) => e.id === expenseId);
    const cat = categories.find((c) => c.id === targetExpense?.categoryId);
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

    // 1. Update expense comments in local state
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

    // 2. Create feed item for social stream
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
      linkedExpense: targetExpense
        ? {
            id: targetExpense.id,
            description: targetExpense.description,
            categoryName: cat?.name || 'Category',
            categoryIcon: cat?.icon || 'tag',
            amount: targetExpense.amount,
            date: targetExpense.date,
            payerName: members.find((m) => m.userId === targetExpense.loggedByUserId)?.name || 'Member',
          }
        : undefined,
    };

    setFeedItems((prev) => [feedItem, ...prev]);

    // 3. Live Firestore sync
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

    showToast('Comment posted to activity feed!');
  };

  // Phase 5: Add or Toggle Transaction Reaction
  const addTransactionReaction = async (expenseId: string, emoji: string) => {
    const activeMember = members.find((m) => m.userId === user?.userId) || members[0] || {
      userId: user?.userId || 'usr_self',
      name: user?.name || 'Member',
      avatarUrl: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };

    const targetExpense = expenses.find((e) => e.id === expenseId);
    const cat = categories.find((c) => c.id === targetExpense?.categoryId);
    const now = Date.now();

    let updatedReactions: TransactionReaction[] = [];
    let isAdding = true;

    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id === expenseId) {
          const current = e.reactions || [];
          const existingIdx = current.findIndex(
            (r) => r.authorId === activeMember.userId && r.emoji === emoji
          );

          if (existingIdx >= 0) {
            // Toggle off
            isAdding = false;
            updatedReactions = current.filter((_, idx) => idx !== existingIdx);
          } else {
            // Add new reaction
            isAdding = true;
            const newReaction: TransactionReaction = {
              id: `react_${now}_${Math.random().toString(36).substr(2, 4)}`,
              expenseId,
              authorId: activeMember.userId,
              authorName: activeMember.name,
              authorAvatar: activeMember.avatarUrl,
              emoji,
              timestamp: now,
            };
            updatedReactions = [...current, newReaction];
          }
          return { ...e, reactions: updatedReactions };
        }
        return e;
      })
    );

    // If adding, post to Feed
    if (isAdding) {
      const feedItemId = `feed_reaction_${now}`;
      const feedItem: FeedItem = {
        id: feedItemId,
        type: 'reaction',
        emoji,
        content: `${activeMember.name} reacted with ${emoji}`,
        authorId: activeMember.userId,
        authorName: activeMember.name,
        authorAvatar: activeMember.avatarUrl,
        timestamp: now,
        date: new Date(now).toISOString().split('T')[0],
        linkedExpenseId: expenseId,
        linkedExpense: targetExpense
          ? {
              id: targetExpense.id,
              description: targetExpense.description,
              categoryName: cat?.name || 'Category',
              categoryIcon: cat?.icon || 'tag',
              amount: targetExpense.amount,
              date: targetExpense.date,
              payerName: members.find((m) => m.userId === targetExpense.loggedByUserId)?.name || 'Member',
            }
          : undefined,
      };

      setFeedItems((prev) => [feedItem, ...prev]);

      if (isFirebaseConfigured && db && household?.id) {
        try {
          const batch = writeBatch(db);
          const expRef = doc(db, 'households', household.id, 'expenses', expenseId);
          batch.update(expRef, sanitizeFirestorePayload({ reactions: updatedReactions }));

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
          await updateDoc(expRef, sanitizeFirestorePayload({ reactions: updatedReactions }));
        } catch (err) {
          console.error('Firestore Write Failed:', err);
          handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/expenses/${expenseId}`);
          showToast(`Error updating reaction: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      }
    }
  };

  // Phase 5: Post General Feed Message
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

  // Phase 4: Complete Weekly Check-In Mutation
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

    // 1. Update local categories state with newWeeklyBudget
    const updatedCategories = categories.map((cat) => {
      const decision = data.decisions.find((d) => d.categoryId === cat.id);
      if (decision) {
        return {
          ...cat,
          currentWeeklyBudget: decision.newWeeklyBudget,
        };
      }
      return cat;
    });
    setCategories(updatedCategories);

    // 2. Append new checkin
    setCheckIns((prev) => [newCheckIn, ...prev]);

    // 3. Update household checkInPending status
    setHousehold((prev) =>
      prev
        ? {
            ...prev,
            checkInPending: false,
            checkInStatus: 'completed',
          }
        : null
    );

    // 4. Live Firestore batch mutation
    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);

        // Update category currentWeeklyBudget values
        data.decisions.forEach((dec) => {
          const catRef = doc(db, 'households', household.id, 'categories', dec.categoryId);
          batch.update(
            catRef,
            sanitizeFirestorePayload({
              currentWeeklyBudget: dec.newWeeklyBudget,
            })
          );
        });

        // Add checkin doc
        const checkinRef = doc(db, 'households', household.id, 'checkins', checkInId);
        batch.set(checkinRef, sanitizeFirestorePayload(newCheckIn));

        // Update household doc
        const householdRef = doc(db, 'households', household.id);
        batch.update(
          householdRef,
          sanitizeFirestorePayload({
            checkInPending: false,
            checkInStatus: 'completed',
            lastCheckInAt: now,
          })
        );

        // Add activity feed item
        const feedRef = doc(db, 'households', household.id, 'feed', `feed_${now}`);
        batch.set(
          feedRef,
          sanitizeFirestorePayload({
            id: `feed_${now}`,
            type: 'checkin',
            content: `Completed Weekly Check-In: Banked $${data.totalSaved} in savings pot and balanced category budgets.`,
            authorId: user?.userId || 'usr_self',
            timestamp: now,
          })
        );

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

  // Phase 4: Trigger Fresh Start (Resolves missed weeks with $0 on-budget expenses)
  const triggerFreshStartAction = async () => {
    if (!household) return;

    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Reset all categories to baseline
    const resetCats = categories.map((cat) => ({
      ...cat,
      currentWeeklyBudget: cat.baselineBudget,
    }));
    setCategories(resetCats);

    // 2. Generate placeholder $0 Fresh Start expenses
    const placeholderExpenses: Expense[] = categories.map((cat, idx) => ({
      id: `exp_fresh_${now}_${idx}`,
      amount: 0,
      description: 'Fresh Start (On-Budget Assumption)',
      categoryId: cat.id,
      date: todayStr,
      timestamp: now,
      loggedByUserId: user?.userId || 'usr_self',
    }));
    setExpenses((prev) => [...placeholderExpenses, ...prev]);

    // 3. Create completed CheckIn record
    const freshCheckIn: CheckIn = {
      id: `checkin_fresh_${now}`,
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

    // 4. Update household status
    setHousehold((prev) =>
      prev
        ? {
            ...prev,
            checkInPending: false,
            checkInStatus: 'completed',
          }
        : null
    );

    // 5. Live Firestore Batch Writes
    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);

        // Reset category budgets
        resetCats.forEach((c) => {
          const catRef = doc(db, 'households', household.id, 'categories', c.id);
          batch.update(
            catRef,
            sanitizeFirestorePayload({
              currentWeeklyBudget: c.baselineBudget,
            })
          );
        });

        // Add $0 placeholder expenses
        placeholderExpenses.forEach((exp) => {
          const expRef = doc(db, 'households', household.id, 'expenses', exp.id);
          batch.set(expRef, sanitizeFirestorePayload(exp));
        });

        // Add checkin doc
        const checkinRef = doc(db, 'households', household.id, 'checkins', freshCheckIn.id);
        batch.set(checkinRef, sanitizeFirestorePayload(freshCheckIn));

        // Update household
        const householdRef = doc(db, 'households', household.id);
        batch.update(
          householdRef,
          sanitizeFirestorePayload({
            checkInPending: false,
            checkInStatus: 'completed',
            lastFreshStartAt: now,
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

  // Phase 4: Execute Month-End Hard Reset
  const executeMonthEndResetAction = async () => {
    if (!household) return;

    const now = Date.now();

    // Reset all categories to baseline
    const resetCats = categories.map((cat) => ({
      ...cat,
      currentWeeklyBudget: cat.baselineBudget,
    }));
    setCategories(resetCats);

    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        resetCats.forEach((c) => {
          const catRef = doc(db, 'households', household.id, 'categories', c.id);
          batch.update(
            catRef,
            sanitizeFirestorePayload({
              currentWeeklyBudget: c.baselineBudget,
            })
          );
        });

        const householdRef = doc(db, 'households', household.id);
        batch.update(
          householdRef,
          sanitizeFirestorePayload({
            lastMonthEndReset: now,
          })
        );

        await batch.commit();
      } catch (err) {
        console.error('Firestore Write Failed:', err);
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/month_end_reset`);
        showToast(`Firestore Write Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
      }
    }

    showToast('Month-End Hard Reset executed. All category budgets returned to baseline values.');
  };

  const resetHouseholdToOnboarding = () => {
    setHousehold(null);
    setMembers([]);
    setCategories([]);
    setExpenses([]);
    setCheckIns([]);
    setIsOnboarding(true);
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
        activeTab,
        setActiveTab,
        isOnboarding,
        setIsOnboarding,

        selectedLedgerCategoryId,
        setSelectedLedgerCategoryId,
        navigateToCategoryLedger,

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
        openLogExpenseModal,
        closeLogExpenseModal,

        isWeeklyCheckInModalOpen,
        openWeeklyCheckInModal,
        closeWeeklyCheckInModal,
        isMonthlyRetroModalOpen,
        openMonthlyRetroModal,
        closeMonthlyRetroModal,
        isAllocationModalOpen,
        openAllocationModal,
        closeAllocationModal,
        completeWeeklyCheckIn,
        triggerFreshStartAction,
        executeMonthEndResetAction,

        createCategory,
        updateCategory,
        deleteCategory,
        saveCategoryAllocations,

        deleteExpense,
        updateExpense,

        toastMessage,
        toastType,
        showToast,

        signInWithGoogle,
        switchActiveMember,
        signOut,
        completeOnboarding,
        joinHouseholdWithSyncCode,
        leaveHousehold,
        updateHousehold,
        updateMemberIncome,
        resetHouseholdToOnboarding,
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
