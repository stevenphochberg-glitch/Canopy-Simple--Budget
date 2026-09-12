/**
 * Canopy Budgeting App - Phase 2 Master Architecture
 * My Budget Dashboard, Universal Staging & Live Firestore Ledger
 */
import React, { useState, useMemo } from 'react';
import { HouseholdProvider, useHousehold } from './context/HouseholdContext';
import { LoginPage } from './components/LoginPage';
import { SetupWizard } from './components/SetupWizard/SetupWizard';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/Dashboard/DashboardView';
import { CategoryLedgerView } from './components/Ledger/CategoryLedgerView';
import { WeeklyCheckInView } from './components/CheckIn/WeeklyCheckInView';
import { FeedView } from './components/Feed/FeedView';
import { SettingsView } from './components/Settings/SettingsView';
import { UserProfileModal } from './components/Modals/UserProfileModal';
import { LogExpenseModal } from './components/Modals/LogExpenseModal';
import { ReviewAndConfirmModal } from './components/Staging/ReviewAndConfirmModal';
import { WeeklyCheckInModal } from './components/CheckIn/WeeklyCheckInModal';
import { MonthlyRetrospectiveModal } from './components/CheckIn/MonthlyRetrospectiveModal';
import { CategoryAllocationModal } from './components/Dashboard/CategoryAllocationModal';
import { calculateCheckInStatus } from './lib/checkInCalculations';
import { getFiscalMonthForDate } from './lib/fiscal445';
import {
  LayoutDashboard,
  Receipt,
  CheckCircle,
  Activity,
  Settings,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { ActiveTab } from './types';

const MainLayout: React.FC = () => {
  const {
    user,
    household,
    isLoading,
    isOnboarding,
    activeTab,
    setActiveTab,
    expenses,
    checkIns,
    toastMessage,
    toastType,
    openStagingModal,
    isLogExpenseModalOpen,
    logExpenseInitialCategory,
    openLogExpenseModal,
    closeLogExpenseModal,
    isWeeklyCheckInModalOpen,
    closeWeeklyCheckInModal,
    isMonthlyRetroModalOpen,
    closeMonthlyRetroModal,
    isAllocationModalOpen,
    closeAllocationModal,
  } = useHousehold();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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

  // 0. Initial Loading State while Firebase Auth resolves
  if (isLoading) {
    return (
      <div className="min-h-screen bg-beige-50 flex flex-col items-center justify-center p-6 selection:bg-sage-200">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-3xl bg-dark-green-800 flex items-center justify-center text-white shadow-md animate-pulse">
            <span className="text-2xl">🌿</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-black text-dark-green-950 tracking-wider">CANOPY</h2>
            <p className="text-xs text-dark-grey-600">Connecting to live household cloud...</p>
          </div>
        </div>
      </div>
    );
  }

  // 1. Not Authenticated -> Show Login
  if (!user) {
    return <LoginPage />;
  }

  // 2. Authenticated but in Onboarding / No Household -> Show Setup Wizard
  if (isOnboarding || !household) {
    return <SetupWizard />;
  }

  const navLinks: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'dashboard', label: 'My Budget', icon: LayoutDashboard },
    { id: 'ledger', label: 'Ledger', icon: Receipt },
    { id: 'checkin', label: 'Check-in', icon: CheckCircle },
    { id: 'feed', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // 3. Fully Onboarded Household -> Show Canopy Dashboard & Universal Staging
  return (
    <div className="min-h-screen bg-beige-50 flex flex-col selection:bg-sage-200">
      {/* Top Navbar */}
      <Navbar onOpenProfileModal={() => setIsProfileModalOpen(true)} />

      {/* Main Content Area with Desktop Sidebar */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex gap-8">
        {/* Desktop Sidebar (lg:) */}
        <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 space-y-6">
          {/* Quick Action */}
          <button
            id="sidebar-log-expense-btn"
            onClick={() => openLogExpenseModal()}
            className="w-full py-3 px-4 bg-dark-green-800 hover:bg-dark-green-900 text-white rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Expense</span>
          </button>

          {/* Navigation Links */}
          <div className="bg-white border border-beige-200/90 rounded-2xl p-3 shadow-xs space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const hasAlert = item.id === 'checkin' && reviewDueStatus.isDue;
              return (
                <button
                  key={item.id}
                  id={`desktop-sidebar-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-dark-green-800 text-white shadow-xs'
                      : 'text-dark-grey-800 hover:bg-beige-100 hover:text-dark-green-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {hasAlert && (
                    <span
                      id="desktop-checkin-notification-dot"
                      className="w-2.5 h-2.5 bg-red-600 rounded-full ring-2 ring-white shrink-0"
                      title="Review due"
                      aria-label="Review due alert"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Dynamic Main View */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <DashboardView onOpenProfileModal={() => setIsProfileModalOpen(true)} />
          )}
          {activeTab === 'ledger' && <CategoryLedgerView />}
          {activeTab === 'checkin' && <WeeklyCheckInView />}
          {activeTab === 'feed' && <FeedView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* User Profile & Multi-Device Switcher Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Multi-Path Log Expense Modal (Manual, AI Quick Note, Scan Receipt) */}
      <LogExpenseModal
        isOpen={isLogExpenseModalOpen}
        onClose={closeLogExpenseModal}
        initialCategory={logExpenseInitialCategory}
      />

      {/* Universal Staging & Confirmation Modal */}
      <ReviewAndConfirmModal />

      {/* Phase 4 Weekly Check-In Modal */}
      <WeeklyCheckInModal
        isOpen={isWeeklyCheckInModalOpen}
        onClose={closeWeeklyCheckInModal}
      />

      {/* Phase 4 Monthly Retrospective & Hard Reset Modal */}
      <MonthlyRetrospectiveModal
        isOpen={isMonthlyRetroModalOpen}
        onClose={closeMonthlyRetroModal}
      />

      {/* Category Allocation & Budget Management Modal */}
      <CategoryAllocationModal
        isOpen={isAllocationModalOpen}
        onClose={closeAllocationModal}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div
          id="global-toast-notification"
          className={`fixed bottom-16 sm:bottom-6 right-6 z-50 px-4 py-3 text-xs font-bold rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md ${
            toastType === 'error'
              ? 'bg-red-900 text-white border border-red-700/80 shadow-red-950/40'
              : 'bg-dark-green-900 text-white border border-sage-700/60'
          }`}
        >
          {toastType === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-sage-300 shrink-0" />
          )}
          <span className="leading-snug">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <HouseholdProvider>
      <MainLayout />
    </HouseholdProvider>
  );
}
