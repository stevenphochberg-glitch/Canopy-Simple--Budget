import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserProfile,
  Household,
  HouseholdMember,
  OnboardingData,
  ActiveTab,
  Category,
  Expense,
  StagedExpense,
  TimeframeMode,
  DateRange,
  CheckIn,
  CategoryRolloverDecision,
  FeedItem,
  TransactionComment,
  TransactionReaction,
} from '../types';
import {
  generateSyncCode,
  getCheckInDay,
  calculateWeeklyPool,
  normalizeToWeekly,
  getDefaultCategories,
  getWeekRange,
  getMonthRange,
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
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';

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

  // Multi-Path Log Expense Modal State (Manual, AI Quick Note, Scan)
  isLogExpenseModalOpen: boolean;
  logExpenseInitialCategory: Category | null;
  openLogExpenseModal: (initialCategory?: Category | null) => void;
  closeLogExpenseModal: () => void;

  // Check-In Modals & Actions (Phase 4)
  isWeeklyCheckInModalOpen: boolean;
  openWeeklyCheckInModal: () => void;
  closeWeeklyCheckInModal: () => void;
  isMonthlyRetroModalOpen: boolean;
  openMonthlyRetroModal: () => void;
  closeMonthlyRetroModal: () => void;

  // Category Allocation / Budget Management Modal
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
  showToast: (msg: string) => void;

  // Auth & Household Core
  signInWithGoogle: () => Promise<void>;
  switchActiveMember: (memberId: string) => void;
  signOut: () => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
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
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const m1 = members[0] || {
    userId: 'usr_1',
    name: 'Alex Miller',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  };
  const m2 = members[1] || {
    userId: 'usr_2',
    name: 'Jordan Taylor',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  };

  const firstExp = expenses[0] || {
    id: 'exp_init_1',
    description: 'Whole Foods Market (Weekly Groceries)',
    amount: 142.5,
    categoryId: categories[0]?.id || 'cat_groceries',
    date: new Date(now - 1 * dayMs).toISOString().split('T')[0],
    loggedByUserId: m1.userId,
  };

  const firstCat = categories.find((c) => c.id === firstExp.categoryId) || categories[0] || {
    name: 'Essentials',
    icon: 'shopping-bag',
  };

  return [
    {
      id: 'feed_init_1',
      type: 'comment',
      content: 'Stocked up on groceries and pantry essentials for the week.',
      authorId: m1.userId,
      authorName: m1.name,
      authorAvatar: m1.avatarUrl,
      timestamp: now - 3 * 3600 * 1000,
      date: new Date(now - 3 * 3600 * 1000).toISOString().split('T')[0],
      linkedExpenseId: firstExp.id,
      linkedExpense: {
        id: firstExp.id,
        description: firstExp.description,
        categoryName: firstCat.name,
        categoryIcon: firstCat.icon || 'shopping-bag',
        amount: firstExp.amount,
        date: firstExp.date,
        payerName: m1.name,
      },
    },
    {
      id: 'feed_init_2',
      type: 'reaction',
      emoji: 'confirmed',
      content: `${m2.name} reviewed and confirmed "${firstExp.description}"`,
      authorId: m2.userId,
      authorName: m2.name,
      authorAvatar: m2.avatarUrl,
      timestamp: now - 2 * 3600 * 1000,
      date: new Date(now - 2 * 3600 * 1000).toISOString().split('T')[0],
      linkedExpenseId: firstExp.id,
      linkedExpense: {
        id: firstExp.id,
        description: firstExp.description,
        categoryName: firstCat.name,
        categoryIcon: firstCat.icon || 'shopping-bag',
        amount: firstExp.amount,
        date: firstExp.date,
        payerName: m1.name,
      },
    },
    {
      id: 'feed_init_3',
      type: 'checkin',
      content: 'Completed Weekly Check-In: Banked $68.00 in the shared Emergency Savings Pot and balanced all category budgets.',
      authorId: m1.userId,
      authorName: m1.name,
      authorAvatar: m1.avatarUrl,
      timestamp: now - 2 * dayMs,
      date: new Date(now - 2 * dayMs).toISOString().split('T')[0],
      metadata: {
        totalSaved: 68,
        totalSpent: 420,
        totalBudget: 500,
      },
    },
  ];
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Current user state
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    return saved ? JSON.parse(saved) : null;
  });

  // Current household state
  const [household, setHousehold] = useState<Household | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HOUSEHOLD);
    return saved ? JSON.parse(saved) : null;
  });

  // Current members state
  const [members, setMembers] = useState<HouseholdMember[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    return saved ? JSON.parse(saved) : [];
  });

  // Categories list
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    return saved ? JSON.parse(saved) : [];
  });

  // Expenses list
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return saved ? JSON.parse(saved) : [];
  });

  // CheckIns list (Phase 4)
  const [checkIns, setCheckIns] = useState<CheckIn[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CHECKINS);
    return saved ? JSON.parse(saved) : [];
  });

  // Feed Items list (Phase 5)
  const [feedItems, setFeedItems] = useState<FeedItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.FEED);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return getInitialFeedItems(null, [], [], []);
  });

  // Lateral Category Drill-Down Navigation State (Phase 5)
  const [selectedLedgerCategoryId, setSelectedLedgerCategoryId] = useState<string | null>(null);

  const navigateToCategoryLedger = (catId: string | null) => {
    setSelectedLedgerCategoryId(catId);
    setActiveTab('ledger');
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);

  // Timeframe state
  const [timeframeMode, setTimeframeMode] = useState<TimeframeMode>('week');
  const [timeframeOffset, setTimeframeOffset] = useState<number>(0);

  // Staging Modal state
  const [isStagingModalOpen, setIsStagingModalOpen] = useState<boolean>(false);
  const [stagedExpenses, setStagedExpenses] = useState<StagedExpense[]>([]);

  // Multi-Path Log Expense Modal State (Manual, Quick Note AI, Scan)
  const [isLogExpenseModalOpen, setIsLogExpenseModalOpen] = useState<boolean>(false);
  const [logExpenseInitialCategory, setLogExpenseInitialCategory] = useState<Category | null>(null);

  const openLogExpenseModal = (initialCategory?: Category | null) => {
    setLogExpenseInitialCategory(initialCategory || null);
    setIsLogExpenseModalOpen(true);
  };

  const closeLogExpenseModal = () => {
    setIsLogExpenseModalOpen(false);
    setLogExpenseInitialCategory(null);
  };

  // Phase 4 Check-In Modals State
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

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

  // Live Firebase Auth Listener
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const profile: UserProfile = {
            userId: firebaseUser.uid,
            name: firebaseUser.displayName || 'Canopy Member',
            email: firebaseUser.email || '',
            avatarUrl: firebaseUser.photoURL || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
            activeHouseholdId: household?.id || null,
            createdAt: new Date().toISOString(),
          };
          setUser(profile);
          if (!household) {
            setIsOnboarding(true);
          }
        }
      });
      return () => unsubscribe();
    }
  }, [household]);

  // Live Firestore Subscriptions for Household, Categories, Members, Expenses, CheckIns, and Feed
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !household?.id) return;

    const householdId = household.id;

    // 1. Subscribe to Household Document
    const householdRef = doc(db, 'households', householdId);
    const unsubHousehold = onSnapshot(
      householdRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Household;
          setHousehold({ ...data, id: docSnap.id });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `households/${householdId}`)
    );

    // 2. Subscribe to Categories Subcollection
    const categoriesRef = collection(db, 'households', householdId, 'categories');
    const unsubCategories = onSnapshot(
      categoriesRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const fetchedCats: Category[] = snapshot.docs.map((d) => ({
            ...(d.data() as Category),
            id: d.id,
          }));
          setCategories(fetchedCats);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `households/${householdId}/categories`)
    );

    // 3. Subscribe to Members Subcollection
    const membersRef = collection(db, 'households', householdId, 'members');
    const unsubMembers = onSnapshot(
      membersRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const fetchedMembers: HouseholdMember[] = snapshot.docs.map((d) => d.data() as HouseholdMember);
          setMembers(fetchedMembers);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `households/${householdId}/members`)
    );

    // 4. Subscribe to Expenses Subcollection
    const expensesRef = collection(db, 'households', householdId, 'expenses');
    const unsubExpenses = onSnapshot(
      query(expensesRef, orderBy('timestamp', 'desc')),
      (snapshot) => {
        const fetchedExp: Expense[] = snapshot.docs.map((d) => ({
          ...(d.data() as Expense),
          id: d.id,
        }));
        setExpenses(fetchedExp);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `households/${householdId}/expenses`)
    );

    // 5. Subscribe to CheckIns Subcollection
    const checkinsRef = collection(db, 'households', householdId, 'checkins');
    const unsubCheckins = onSnapshot(
      query(checkinsRef, orderBy('timestamp', 'desc')),
      (snapshot) => {
        const fetchedCheckins: CheckIn[] = snapshot.docs.map((d) => ({
          ...(d.data() as CheckIn),
          id: d.id,
        }));
        setCheckIns(fetchedCheckins);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `households/${householdId}/checkins`)
    );

    // 6. Subscribe to Feed Subcollection
    const feedRef = collection(db, 'households', householdId, 'feed');
    const unsubFeed = onSnapshot(
      query(feedRef, orderBy('timestamp', 'desc')),
      (snapshot) => {
        if (!snapshot.empty) {
          const fetchedFeed: FeedItem[] = snapshot.docs.map((d) => ({
            ...(d.data() as FeedItem),
            id: d.id,
          }));
          setFeedItems(fetchedFeed);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `households/${householdId}/feed`)
    );

    return () => {
      unsubHousehold();
      unsubCategories();
      unsubMembers();
      unsubExpenses();
      unsubCheckins();
      unsubFeed();
    };
  }, [household?.id]);

  // Google Sign-In with real Firebase GoogleAuthProvider
  const signInWithGoogle = async () => {
    if (isFirebaseConfigured && auth && googleProvider) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;
        const profile: UserProfile = {
          userId: fbUser.uid,
          name: fbUser.displayName || 'Canopy Member',
          email: fbUser.email || '',
          avatarUrl: fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          activeHouseholdId: household?.id || null,
          createdAt: new Date().toISOString(),
        };
        setUser(profile);
        if (!household) {
          setIsOnboarding(true);
        }
        showToast(`Welcome to Canopy, ${profile.name.split(' ')[0]}!`);
      } catch (err: any) {
        console.error('Google Sign In Error:', err);
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

    const syncCode = generateSyncCode();
    const householdId = `hh_${Date.now()}`;
    const totalWeeklyPool = calculateWeeklyPool(data.members);
    const lastDay = getCheckInDay(data.firstDayOfWeek);

    const newHousehold: Household = {
      id: householdId,
      name: `${user.name.split(' ')[0]}'s Household`,
      syncCode,
      accountType: data.accountType,
      roommateCount: data.accountType === 'roommate' ? data.roommateCount : undefined,
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
        batch.set(householdRef, newHousehold);

        // Write User doc
        const userRef = doc(db, 'users', user.userId);
        batch.set(userRef, updatedUser, { merge: true });

        // Write Members
        data.members.forEach((m) => {
          const memberRef = doc(db, 'households', householdId, 'members', m.userId);
          batch.set(memberRef, m);
        });

        // Write Categories
        initialCategories.forEach((cat) => {
          const catRef = doc(db, 'households', householdId, 'categories', cat.id);
          batch.set(catRef, cat);
        });

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `households/${householdId}`);
      }
    }

    showToast('Household setup complete. Categories and budget initialized.');
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
        await updateDoc(householdRef, updated);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}`);
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

    if (household) {
      const updatedHousehold = { ...household, weeklyIncomePool: newPool };
      setHousehold(updatedHousehold);

      if (isFirebaseConfigured && db) {
        try {
          const memberRef = doc(db, 'households', household.id, 'members', memberId);
          const targetMember = updatedMembers.find((m) => m.userId === memberId);
          if (targetMember) {
            await setDoc(memberRef, targetMember, { merge: true });
          }
          const householdRef = doc(db, 'households', household.id);
          await updateDoc(householdRef, { weeklyIncomePool: newPool });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/members/${memberId}`);
        }
      }
    }
    showToast('Income & weekly pool updated.');
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
        await setDoc(catRef, newCategory);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `households/${household.id}/categories/${newId}`);
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
        await updateDoc(catRef, updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/categories/${id}`);
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
        handleFirestoreError(err, OperationType.DELETE, `households/${household.id}/categories/${id}`);
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
          batch.set(catRef, cat, { merge: true });
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/categories`);
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
    const validItems = stagedExpenses.filter((it) => it.amount > 0);
    if (validItems.length === 0) {
      showToast('Please enter an amount for at least one item before confirming.');
      return;
    }

    const now = Date.now();
    const createdExpenses: Expense[] = validItems.map((item, idx) => ({
      id: `exp_${now}_${idx}`,
      amount: Number(item.amount),
      description: item.description.trim() || 'Logged Expense',
      categoryId: item.categoryId || categories[0]?.id || 'cat_groceries',
      date: item.date || new Date().toISOString().split('T')[0],
      timestamp: item.date ? new Date(item.date).getTime() : now,
      loggedByUserId: item.loggedByUserId || user?.userId || 'usr_self',
      receiptImgUrl: item.receiptImgUrl,
    }));

    // Update local state immediately
    setExpenses((prev) => [...createdExpenses, ...prev]);

    // Live Firestore Writes
    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        createdExpenses.forEach((exp) => {
          const expRef = doc(db, 'households', household.id, 'expenses', exp.id);
          batch.set(expRef, exp);
        });

        // Also add an activity feed item
        const feedRef = doc(db, 'households', household.id, 'feed', `feed_${now}`);
        const totalAmount = createdExpenses.reduce((sum, e) => sum + e.amount, 0);
        batch.set(feedRef, {
          id: `feed_${now}`,
          type: 'transaction',
          content: `Logged ${createdExpenses.length} expense${createdExpenses.length > 1 ? 's' : ''} totaling $${totalAmount}`,
          authorId: user?.userId || 'usr_self',
          timestamp: now,
        });

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/expenses`);
      }
    }

    closeStagingModal();
    showToast(`${createdExpenses.length} expense${createdExpenses.length > 1 ? 's' : ''} logged and synced to household budget.`);
  };

  const deleteExpense = async (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));

    if (isFirebaseConfigured && db && household?.id) {
      try {
        const expRef = doc(db, 'households', household.id, 'expenses', id);
        await deleteDoc(expRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `households/${household.id}/expenses/${id}`);
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
        await updateDoc(expRef, updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/expenses/${id}`);
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
        batch.update(expRef, { comments: updatedComments });

        const feedRef = doc(db, 'households', household.id, 'feed', feedItemId);
        batch.set(feedRef, feedItem);

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/feed/${feedItemId}`);
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
          batch.update(expRef, { reactions: updatedReactions });

          const feedRef = doc(db, 'households', household.id, 'feed', feedItemId);
          batch.set(feedRef, feedItem);

          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/feed/${feedItemId}`);
        }
      }
    } else {
      if (isFirebaseConfigured && db && household?.id) {
        try {
          const expRef = doc(db, 'households', household.id, 'expenses', expenseId);
          await updateDoc(expRef, { reactions: updatedReactions });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `households/${household.id}/expenses/${expenseId}`);
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
        await setDoc(feedRef, feedItem);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/feed/${feedItemId}`);
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
      notes: data.notes,
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
          batch.update(catRef, {
            currentWeeklyBudget: dec.newWeeklyBudget,
          });
        });

        // Add checkin doc
        const checkinRef = doc(db, 'households', household.id, 'checkins', checkInId);
        batch.set(checkinRef, newCheckIn);

        // Update household doc
        const householdRef = doc(db, 'households', household.id);
        batch.update(householdRef, {
          checkInPending: false,
          checkInStatus: 'completed',
          lastCheckInAt: now,
        });

        // Add activity feed item
        const feedRef = doc(db, 'households', household.id, 'feed', `feed_${now}`);
        batch.set(feedRef, {
          id: `feed_${now}`,
          type: 'checkin',
          content: `Completed Weekly Check-In: Banked $${data.totalSaved} in savings pot and balanced category budgets.`,
          authorId: user?.userId || 'usr_self',
          timestamp: now,
        });

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/checkins`);
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
          batch.update(catRef, {
            currentWeeklyBudget: c.baselineBudget,
          });
        });

        // Add $0 placeholder expenses
        placeholderExpenses.forEach((exp) => {
          const expRef = doc(db, 'households', household.id, 'expenses', exp.id);
          batch.set(expRef, exp);
        });

        // Add checkin doc
        const checkinRef = doc(db, 'households', household.id, 'checkins', freshCheckIn.id);
        batch.set(checkinRef, freshCheckIn);

        // Update household
        const householdRef = doc(db, 'households', household.id);
        batch.update(householdRef, {
          checkInPending: false,
          checkInStatus: 'completed',
          lastFreshStartAt: now,
        });

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/fresh_start`);
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
          batch.update(catRef, {
            currentWeeklyBudget: c.baselineBudget,
          });
        });

        const householdRef = doc(db, 'households', household.id);
        batch.update(householdRef, {
          lastMonthEndReset: now,
        });

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `households/${household.id}/month_end_reset`);
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
        showToast,

        signInWithGoogle,
        switchActiveMember,
        signOut,
        completeOnboarding,
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
