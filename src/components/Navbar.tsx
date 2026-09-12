import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { ActiveTab } from '../types';
import { calculateCheckInStatus } from '../lib/checkInCalculations';
import { getFiscalMonthForDate } from '../lib/fiscal445';
import {
  LayoutDashboard,
  Receipt,
  CheckCircle,
  Activity,
  Settings,
  Copy,
  Check,
  Users,
  LogOut,
  ChevronDown,
  Plus,
  SlidersHorizontal,
  Shield,
  Key,
  KeyRound,
  ArrowLeftRight,
  UserMinus,
  Loader2,
  X,
  AlertTriangle,
  Home,
} from 'lucide-react';

interface NavbarProps {
  onOpenProfileModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenProfileModal }) => {
  const {
    user,
    household,
    userHouseholds,
    switchHousehold,
    members,
    expenses,
    checkIns,
    activeTab,
    setActiveTab,
    switchActiveMember,
    signOut,
    openLogExpenseModal,
    openAllocationModal,
    joinHouseholdWithSyncCode,
    getHouseholdBySyncCode,
    leaveHousehold,
  } = useHousehold();
  const [copiedSync, setCopiedSync] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Click-outside listener for the Account dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowMemberDropdown(false);
      }
    };

    if (showMemberDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMemberDropdown]);

  // Reactive Review Due Status for Check-in Alert Badge
  const reviewDueStatus = useMemo(() => {
    if (!household) return { isDue: false, isPastDue: false };
    const statusInfo = calculateCheckInStatus(household, checkIns, expenses);
    const isWeeklyDue = statusInfo.isPastDue || statusInfo.status === 'pending' || statusInfo.status === 'past-due';

    if (isWeeklyDue) {
      return {
        isDue: true,
        isPastDue: statusInfo.isPastDue,
      };
    }

    const fiscalMonth = getFiscalMonthForDate(new Date(), household.fiscalYearEndMonth || 12);
    const monthEndTime = fiscalMonth.endDate.getTime();
    const finalWeekStartTime = monthEndTime - 7 * 24 * 60 * 60 * 1000;
    const isMonthEnd = new Date().getTime() >= finalWeekStartTime;

    if (isMonthEnd) {
      const hasCompletedMonthCheckin = (checkIns || []).some((c) => {
        const cEndTime = new Date(c.weekEndDate).getTime();
        return cEndTime >= finalWeekStartTime && c.status === 'completed';
      });
      if (!hasCompletedMonthCheckin) {
        return {
          isDue: true,
          isPastDue: new Date().getTime() > monthEndTime,
        };
      }
    }

    return { isDue: false, isPastDue: false };
  }, [household, checkIns, expenses]);

  // Switch / Join Modal State
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [foundPlaceholders, setFoundPlaceholders] = useState<Array<{ userId: string; name: string; avatarUrl: string }>>([]);
  const [selectedPlaceholderId, setSelectedPlaceholderId] = useState<string | null>(null);
  const [joinStep, setJoinStep] = useState<'code' | 'claim'>('code');

  // Leave Household Confirmation Modal State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStep, setLeaveStep] = useState<'confirm' | 'choice'>('confirm');
  const [isLeaving, setIsLeaving] = useState(false);

  const handleCopySync = () => {
    if (household?.syncCode) {
      navigator.clipboard.writeText(household.syncCode);
      setCopiedSync(true);
      setTimeout(() => setCopiedSync(false), 2000);
    }
  };

  const handleLookupOrJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      if (joinStep === 'code') {
        const info = await getHouseholdBySyncCode(joinCodeInput.trim());
        if (!info) {
          setJoinError('No household found with that sync code. Please verify and try again.');
          setIsJoining(false);
          return;
        }
        const placeholders = info.members.filter((m) => m.isPlaceholder);
        if (placeholders.length > 0) {
          setFoundPlaceholders(placeholders);
          setSelectedPlaceholderId(placeholders[0].userId);
          setJoinStep('claim');
          setIsJoining(false);
          return;
        }
      }

      const res = await joinHouseholdWithSyncCode(
        joinCodeInput.trim(),
        selectedPlaceholderId || undefined
      );
      if (res.success) {
        setShowJoinModal(false);
        setJoinCodeInput('');
        setJoinStep('code');
        setFoundPlaceholders([]);
        setSelectedPlaceholderId(null);
      } else {
        setJoinError(res.message || 'Household not found with that code.');
      }
    } catch (err: any) {
      setJoinError(err.message || 'Failed to switch household.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveOptionChoice = async (choice: 'new_household' | 'sign_out') => {
    setIsLeaving(true);
    try {
      await leaveHousehold();
      if (choice === 'sign_out') {
        await signOut();
      }
    } finally {
      setIsLeaving(false);
      setShowLeaveModal(false);
      setLeaveStep('confirm');
    }
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'dashboard', label: 'My Budget', icon: LayoutDashboard },
    { id: 'ledger', label: 'Ledger', icon: Receipt },
    { id: 'checkin', label: 'Check-in', icon: CheckCircle },
    { id: 'feed', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Top Header Bar (Desktop & Mobile) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-beige-200 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo (Icon only, no text word) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              aria-label="Household Dashboard"
              className="flex items-center focus:outline-none cursor-pointer group text-left"
            >
              <img
                src="/logo.jpeg"
                alt="App Logo"
                className="w-9 h-9 rounded-xl object-cover border border-beige-300 group-hover:scale-105 transition-transform shadow-xs"
              />
            </button>
          </div>

          {/* Right Header Elements */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Log Expense CTA Button */}
            <button
              id="header-log-expense-btn"
              onClick={() => openLogExpenseModal()}
              className="hidden sm:flex items-center justify-center px-4 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-xs transition cursor-pointer"
            >
              <span>Log Expense</span>
            </button>

            {/* Account & Administrative Dropdown Menu */}
            <div ref={accountMenuRef} className="relative">
              <button
                id="user-profile-menu-btn"
                onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                className={`flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full border transition cursor-pointer ${
                  showMemberDropdown
                    ? 'bg-sage-100 border-sage-400 ring-2 ring-sage-300/50'
                    : 'bg-sage-50 hover:bg-sage-100 border-sage-200'
                }`}
                title="Open Account & Settings Menu"
              >
                <img
                  src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt={user?.name || 'User'}
                  className="w-7 h-7 rounded-full object-cover border border-sage-400"
                />
                <span className="text-xs font-bold text-dark-green-900 hidden sm:inline truncate max-w-[100px]">
                  {user?.name?.split(' ')[0] || 'Account'}
                </span>
                <ChevronDown className={`w-3 h-3 text-dark-green-800 transition-transform ${showMemberDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu Container (closed via click-outside ref listener) */}

              {/* Dropdown Menu Container */}
              {showMemberDropdown && (
                <div
                  className="absolute right-0 mt-2 w-72 sm:w-80 max-h-[60vh] overflow-y-auto bg-white border border-beige-200 rounded-3xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3 overscroll-contain"
                >
                  {/* User Profile Header */}
                  <div className="p-3 bg-beige-50/80 border border-beige-200/80 rounded-2xl space-y-1">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                        alt={user?.name || 'User'}
                        className="w-10 h-10 rounded-full object-cover border border-sage-400"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-dark-green-900 truncate">
                          {user?.name || 'Household Member'}
                        </p>
                        <p className="text-[11px] text-dark-grey-600 truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-brown-700">
                        {household?.name || 'Household'}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-sage-800 bg-sage-100/90 px-2 py-0.5 rounded-md border border-sage-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-sage-600" />
                        Live Synced
                      </div>
                    </div>
                  </div>

                  {/* Household Switcher Section */}
                  <div className="space-y-1 pt-1 border-t border-beige-100">
                    <div className="flex items-center justify-between px-2 py-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brown-700">
                        Households ({userHouseholds.length || 1})
                      </p>
                      <button
                        id="add-household-btn"
                        type="button"
                        onClick={() => {
                          setShowMemberDropdown(false);
                          setShowJoinModal(true);
                        }}
                        className="text-[10px] font-bold text-dark-green-800 hover:text-dark-green-950 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Join Another</span>
                      </button>
                    </div>

                    <div className="space-y-1">
                      {userHouseholds && userHouseholds.length > 0 ? (
                        userHouseholds.map((hh) => {
                          const isActive = hh.id === household?.id;
                          return (
                            <button
                              key={hh.id}
                              type="button"
                              onClick={() => {
                                if (!isActive) {
                                  switchHousehold(hh.id);
                                }
                                setShowMemberDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition cursor-pointer ${
                                isActive
                                  ? 'bg-sage-100 font-bold text-dark-green-950 border border-sage-300'
                                  : 'hover:bg-beige-50 text-dark-grey-800 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${
                                    isActive ? 'bg-dark-green-800 text-white' : 'bg-beige-200 text-brown-800'
                                  }`}
                                >
                                  <Home className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-bold leading-tight">{hh.name || 'Household'}</p>
                                  <p className="text-[10px] text-brown-600 font-mono">{hh.syncCode}</p>
                                </div>
                              </div>
                              {isActive && (
                                <span className="text-[10px] bg-dark-green-800 text-white font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Active
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        household && (
                          <div className="px-2.5 py-1.5 rounded-xl bg-sage-100/70 border border-sage-200 text-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Home className="w-3.5 h-3.5 text-dark-green-800" />
                              <span className="font-bold text-dark-green-950">{household.name}</span>
                            </div>
                            <span className="text-[10px] bg-dark-green-800 text-white font-bold px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Relocated Administrative Actions */}
                  <div className="space-y-1 pt-1 border-t border-beige-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brown-700 px-2 py-0.5">
                      Administration
                    </p>

                    {/* Manage Budget */}
                    <button
                      id="dropdown-manage-budget-btn"
                      onClick={() => {
                        setShowMemberDropdown(false);
                        openAllocationModal();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-dark-green-900 hover:bg-sage-50 rounded-xl transition cursor-pointer text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-800 group-hover:bg-sage-200 transition">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span>Manage Budget</span>
                        <p className="text-[10px] font-normal text-brown-700">
                          Adjust pool allocation & buckets
                        </p>
                      </div>
                    </button>

                    {/* Settings */}
                    <button
                      id="dropdown-settings-btn"
                      onClick={() => {
                        setShowMemberDropdown(false);
                        setActiveTab('settings');
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-dark-green-900 hover:bg-sage-50 rounded-xl transition cursor-pointer text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-beige-100 border border-beige-300 flex items-center justify-center text-brown-800 group-hover:bg-beige-200 transition">
                        <Settings className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span>Settings</span>
                        <p className="text-[10px] font-normal text-brown-700">
                          Household preferences & pay cycles
                        </p>
                      </div>
                    </button>

                    {/* Household Members */}
                    <button
                      id="dropdown-roster-btn"
                      onClick={() => {
                        setShowMemberDropdown(false);
                        onOpenProfileModal();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-dark-green-900 hover:bg-sage-50 rounded-xl transition cursor-pointer text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-beige-100 border border-beige-300 flex items-center justify-center text-brown-800 group-hover:bg-beige-200 transition">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span>Household Roster</span>
                        <p className="text-[10px] font-normal text-brown-700">
                          Manage members & individual incomes
                        </p>
                      </div>
                    </button>

                    {/* Switch / Join Household */}
                    <button
                      id="dropdown-switch-join-btn"
                      onClick={() => {
                        setShowMemberDropdown(false);
                        setShowJoinModal(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-dark-green-900 hover:bg-sage-50 rounded-xl transition cursor-pointer text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-800 group-hover:bg-sage-200 transition">
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span>Switch / Join Household</span>
                        <p className="text-[10px] font-normal text-brown-700">
                          Connect with a different sync code
                        </p>
                      </div>
                    </button>

                    {/* Leave Current Household */}
                    <button
                      id="dropdown-leave-household-btn"
                      onClick={() => {
                        setShowMemberDropdown(false);
                        setShowLeaveModal(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-50 rounded-xl transition cursor-pointer text-left group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 group-hover:bg-amber-200 transition">
                        <UserMinus className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <span>Leave Current Household</span>
                        <p className="text-[10px] font-normal text-amber-700">
                          Detach from active budget
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Switch Household Profile (if > 1 member) */}
                  {members.length > 1 && (
                    <div className="pt-2 border-t border-beige-100 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brown-700 px-2 py-0.5">
                        Switch Active Member:
                      </p>
                      {members.map((m) => (
                        <button
                          key={m.userId}
                          onClick={(e) => {
                            e.stopPropagation();
                            switchActiveMember(m.userId);
                            setShowMemberDropdown(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-xs transition cursor-pointer ${
                            m.userId === user?.userId
                              ? 'bg-sage-100 font-bold text-dark-green-900 border border-sage-300'
                              : 'hover:bg-beige-50 text-dark-grey-800'
                          }`}
                        >
                          <img
                            src={m.avatarUrl}
                            alt={m.name}
                            className="w-6 h-6 rounded-full object-cover border border-beige-300"
                          />
                          <span className="flex-1 truncate">{m.name}</span>
                          {m.userId === user?.userId && (
                            <Check className="w-3.5 h-3.5 text-dark-green-700" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Sign Out */}
                  <div className="pt-2 border-t border-beige-100">
                    <button
                      id="dropdown-signout-btn"
                      onClick={() => {
                        setShowMemberDropdown(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 rounded-xl transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-red-600" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar with Centrally Elevated Log Expense Button */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-beige-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {/* Left items: Dashboard, Ledger */}
        <button
          id="mobile-nav-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-dark-green-900 font-bold'
              : 'text-dark-grey-600 hover:text-dark-green-800'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-transform ${
              activeTab === 'dashboard' ? 'bg-sage-100 text-dark-green-800 scale-105' : ''
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">My Budget</span>
        </button>

        <button
          id="mobile-nav-ledger"
          onClick={() => setActiveTab('ledger')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
            activeTab === 'ledger'
              ? 'text-dark-green-900 font-bold'
              : 'text-dark-grey-600 hover:text-dark-green-800'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-transform ${
              activeTab === 'ledger' ? 'bg-sage-100 text-dark-green-800 scale-105' : ''
            }`}
          >
            <Receipt className="w-4 h-4" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Ledger</span>
        </button>

        {/* Prominent Elevated Center CTA: + Log Expense */}
        <div className="relative -top-3">
          <button
            id="mobile-nav-center-log-btn"
            onClick={() => openLogExpenseModal()}
            className="w-12 h-12 rounded-full bg-dark-green-800 hover:bg-dark-green-900 text-white shadow-lg flex items-center justify-center transition-transform active:scale-95 cursor-pointer border-2 border-white"
            title="Log Expense (Universal Staging)"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Right items: Check-in, Activity */}
        <button
          id="mobile-nav-checkin"
          onClick={() => setActiveTab('checkin')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer relative ${
            activeTab === 'checkin'
              ? 'text-dark-green-900 font-bold'
              : 'text-dark-grey-600 hover:text-dark-green-800'
          }`}
        >
          <div
            className={`relative p-1 rounded-lg transition-transform ${
              activeTab === 'checkin' ? 'bg-sage-100 text-dark-green-800 scale-105' : ''
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            {reviewDueStatus.isDue && (
              <span
                id="mobile-checkin-notification-dot"
                className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-600 rounded-full ring-2 ring-white"
                title="Review due"
                aria-label="Review due alert"
              />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Check-in</span>
        </button>

        <button
          id="mobile-nav-feed"
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
            activeTab === 'feed'
              ? 'text-dark-green-900 font-bold'
              : 'text-dark-grey-600 hover:text-dark-green-800'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-transform ${
              activeTab === 'feed' ? 'bg-sage-100 text-dark-green-800 scale-105' : ''
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Activity</span>
        </button>
      </nav>

      {/* Switch / Join Household Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-beige-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sage-100 border border-sage-300 flex items-center justify-center text-dark-green-900">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-dark-green-900">
                    Switch / Join Household
                  </h3>
                  <p className="text-xs text-brown-700">
                    Connect to a shared budget using a sync code.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinError(null);
                }}
                className="p-1.5 rounded-xl hover:bg-beige-100 text-brown-700 hover:text-dark-green-900 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLookupOrJoin} className="space-y-4">
              {joinStep === 'code' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-dark-green-900 block">
                    6-Character Sync Code
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    required
                    placeholder="e.g. CNP-8X2"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-beige-50 border border-beige-300 rounded-2xl font-mono text-lg font-black tracking-widest text-dark-green-950 uppercase focus:outline-none focus:border-dark-green-800 focus:bg-white"
                  />
                  <p className="text-[11px] text-dark-grey-600">
                    Your individual profile history and attribution will be preserved.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-sage-50 border border-sage-200 rounded-2xl">
                    <p className="text-xs font-bold text-dark-green-900 mb-1">
                      Choose Your Household Profile
                    </p>
                    <p className="text-[11px] text-brown-700">
                      The household creator created placeholder profiles. Select which one is you:
                    </p>
                  </div>

                  <div className="space-y-2">
                    {foundPlaceholders.map((p) => (
                      <button
                        key={p.userId}
                        type="button"
                        onClick={() => setSelectedPlaceholderId(p.userId)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                          selectedPlaceholderId === p.userId
                            ? 'bg-sage-100 border-dark-green-800 ring-2 ring-sage-300/60'
                            : 'bg-white border-beige-200 hover:bg-beige-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img src={p.avatarUrl} alt={p.name} className="w-8 h-8 rounded-full object-cover border border-sage-300" />
                          <div>
                            <span className="text-xs font-bold text-dark-green-900 block">{p.name}</span>
                            <span className="text-[10px] text-dark-grey-600">Claim this profile slot</span>
                          </div>
                        </div>
                        {selectedPlaceholderId === p.userId && (
                          <Check className="w-4 h-4 text-dark-green-800" />
                        )}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setSelectedPlaceholderId(null)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition cursor-pointer ${
                        selectedPlaceholderId === null
                          ? 'bg-sage-100 border-dark-green-800 ring-2 ring-sage-300/60'
                          : 'bg-white border-beige-200 hover:bg-beige-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-beige-200 border border-beige-300 flex items-center justify-center text-brown-800 font-bold text-xs">
                          +
                        </div>
                        <div>
                          <span className="text-xs font-bold text-dark-green-900 block">Join as New Member</span>
                          <span className="text-[10px] text-dark-grey-600">Add yourself as an additional member</span>
                        </div>
                      </div>
                      {selectedPlaceholderId === null && (
                        <Check className="w-4 h-4 text-dark-green-800" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {joinError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (joinStep === 'claim') {
                      setJoinStep('code');
                    } else {
                      setShowJoinModal(false);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl border border-beige-300 text-xs font-bold text-brown-800 hover:bg-beige-50 cursor-pointer"
                >
                  {joinStep === 'claim' ? 'Back' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isJoining || (joinStep === 'code' && !joinCodeInput.trim())}
                  className="px-5 py-2.5 rounded-xl bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-xs font-bold text-white shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <span>{joinStep === 'claim' ? 'Confirm & Join' : 'Lookup Household'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Household Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-beige-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 flex-shrink-0">
                <UserMinus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-dark-green-900">
                  Leave Current Household?
                </h3>
                <p className="text-xs text-brown-700">
                  {household?.name || 'Current Household'}
                </p>
              </div>
            </div>

            {leaveStep === 'confirm' ? (
              <>
                <p className="text-xs text-dark-grey-700 leading-relaxed bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-2xl">
                  Leaving will detach your active profile from this household budget. You will no longer have access to this shared budget unless you re-join with the sync code.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-beige-300 text-xs font-bold text-brown-800 hover:bg-beige-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveStep('choice')}
                    className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-xs font-bold text-white shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <span>Continue</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-bold text-dark-green-900">
                  What would you like to do next?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isLeaving}
                    onClick={() => handleLeaveOptionChoice('new_household')}
                    className="flex items-center justify-center gap-2 p-3 bg-white hover:bg-sage-50 border border-sage-300 hover:border-dark-green-700 text-dark-green-900 font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isLeaving ? <Loader2 className="w-4 h-4 animate-spin text-dark-green-800" /> : <Home className="w-4 h-4 text-dark-green-800" />}
                    <span>Set up a new household</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLeaving}
                    onClick={() => handleLeaveOptionChoice('sign_out')}
                    className="flex items-center justify-center gap-2 p-3 bg-white hover:bg-beige-50 border border-beige-300 hover:border-brown-400 text-brown-900 font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isLeaving ? <Loader2 className="w-4 h-4 animate-spin text-brown-700" /> : <LogOut className="w-4 h-4 text-brown-700" />}
                    <span>Sign out</span>
                  </button>
                </div>
                <div className="pt-1 flex justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLeaveModal(false);
                      setLeaveStep('confirm');
                    }}
                    className="text-xs text-dark-grey-600 hover:underline cursor-pointer"
                  >
                    Stay in household
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
