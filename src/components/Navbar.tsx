import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { ActiveTab } from '../types';
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
} from 'lucide-react';

interface NavbarProps {
  onOpenProfileModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenProfileModal }) => {
  const {
    user,
    household,
    members,
    activeTab,
    setActiveTab,
    switchActiveMember,
    signOut,
    openLogExpenseModal,
    openAllocationModal,
  } = useHousehold();
  const [copiedSync, setCopiedSync] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  const handleCopySync = () => {
    if (household?.syncCode) {
      navigator.clipboard.writeText(household.syncCode);
      setCopiedSync(true);
      setTimeout(() => setCopiedSync(false), 2000);
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
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('dashboard')}
              aria-label="Household Dashboard"
              className="flex items-center gap-2.5 focus:outline-none cursor-pointer group text-left"
            >
              <img
                src="/logo.jpeg"
                alt="App Logo"
                className="w-9 h-9 rounded-xl object-cover border border-beige-300 group-hover:scale-105 transition-transform shadow-xs"
              />
              {household?.name && (
                <span className="text-xs font-bold text-dark-green-900 hidden sm:block">
                  {household.name}
                </span>
              )}
            </button>
          </div>

          {/* Right Header Elements */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Log Expense CTA Button */}
            <button
              id="header-log-expense-btn"
              onClick={() => openLogExpenseModal()}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-extrabold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Log Expense</span>
            </button>

            {/* Account & Administrative Dropdown Menu */}
            <div className="relative">
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

              {/* Invisible backdrop for outside-click dismissal */}
              {showMemberDropdown && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMemberDropdown(false)}
                />
              )}

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

                  {/* Relocated Household Sync Code Box */}
                  {household?.syncCode && (
                    <div className="p-3 bg-white border border-beige-200 rounded-2xl shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-dark-green-900">
                          <Key className="w-3.5 h-3.5 text-brown-700" />
                          <span>Household Sync Code</span>
                        </div>
                        <span className="text-[10px] text-dark-grey-600">Share with partner</span>
                      </div>

                      <div className="flex items-center justify-between bg-beige-50 border border-beige-200 px-3 py-2 rounded-xl">
                        <span className="font-mono text-sm font-extrabold text-dark-green-950 tracking-wider">
                          {household.syncCode}
                        </span>
                        <button
                          id="dropdown-copy-sync-code"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopySync();
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-beige-300 hover:bg-beige-100 text-xs font-bold text-dark-green-900 transition cursor-pointer shadow-2xs"
                        >
                          {copiedSync ? (
                            <>
                              <Check className="w-3 h-3 text-sage-600" />
                              <span className="text-sage-700 text-[11px]">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-brown-700" />
                              <span className="text-[11px]">Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

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
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition cursor-pointer ${
            activeTab === 'checkin'
              ? 'text-dark-green-900 font-bold'
              : 'text-dark-grey-600 hover:text-dark-green-800'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-transform ${
              activeTab === 'checkin' ? 'bg-sage-100 text-dark-green-800 scale-105' : ''
            }`}
          >
            <CheckCircle className="w-4 h-4" />
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
    </>
  );
};
