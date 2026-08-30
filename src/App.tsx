/**
 * Canopy Budgeting App - Phase 2 Master Architecture
 * My Budget Dashboard, Universal Staging & Live Firestore Ledger
 */
import React, { useState } from 'react';
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
import {
  LayoutDashboard,
  Receipt,
  CheckCircle,
  Activity,
  Settings,
  Users,
  Shield,
  Plus,
} from 'lucide-react';
import { ActiveTab } from './types';

const MainLayout: React.FC = () => {
  const {
    user,
    household,
    isOnboarding,
    activeTab,
    setActiveTab,
    toastMessage,
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
            <span>+ Log Expense</span>
          </button>

          {/* Navigation Links */}
          <div className="bg-white border border-beige-200/90 rounded-2xl p-3 shadow-xs space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`desktop-sidebar-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-dark-green-800 text-white shadow-xs'
                      : 'text-dark-grey-800 hover:bg-beige-100 hover:text-dark-green-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Household Info Card */}
          <div className="bg-white border border-beige-200/90 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-dark-green-900">
              <Shield className="w-3.5 h-3.5 text-sage-600" />
              <span className="truncate">{household.name || 'Household'}</span>
            </div>
            <p className="text-[11px] text-brown-700">
              Sync Code:{' '}
              <span className="font-mono font-bold text-dark-green-900">
                {household.syncCode}
              </span>
            </p>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-[11px] font-bold rounded-xl transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-brown-700" />
              <span>Manage Roster</span>
            </button>
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
        <div className="fixed bottom-16 sm:bottom-6 right-6 z-50 px-4 py-3 bg-dark-green-900 text-white text-xs font-bold rounded-2xl shadow-xl border border-sage-700/60 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {toastMessage}
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
