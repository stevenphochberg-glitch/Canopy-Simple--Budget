import React, { useState, useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { formatCurrency, formatDateDisplay } from '../../lib/calculations';
import { CategoryIcon } from '../Common/CategoryIcon';
import { getReactionDef } from '../Common/EarthToneReaction';
import {
  getFiscalMonthForDate,
  getFiscalTrackerInfo,
  FISCAL_MONTH_NAMES,
} from '../../lib/fiscal445';
import {
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Star,
  Calendar as CalendarIcon,
  List,
  Send,
  User,
  Tag,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  Smile,
  Receipt,
  Heart,
  ThumbsUp,
  Flame,
  Clock,
  ArrowRight,
  Sprout,
  Activity,
} from 'lucide-react';
import { FeedItem } from '../../types';

export const FeedView: React.FC = () => {
  const {
    feedItems,
    household,
    members,
    user,
    expenses,
    checkIns,
    postFeedMessage,
    navigateToCategoryLedger,
    categories,
    openWeeklyCheckInModal,
    openMonthlyRetroModal,
  } = useHousehold();

  const [viewMode, setViewMode] = useState<'stream' | 'calendar'>('stream');
  const [filterType, setFilterType] = useState<string>('all');
  const [messageInput, setMessageInput] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // Calendar State: Anchor Date for 4-4-5 Fiscal Month
  const [calendarAnchorDate, setCalendarAnchorDate] = useState<Date>(() => new Date());

  // Calculate Active Fiscal Month & Tracker Info (Strict 4-4-5 Accounting Schedule)
  const fiscalMonth = useMemo(() => {
    return getFiscalMonthForDate(calendarAnchorDate, household?.fiscalYearEndMonth || 12);
  }, [calendarAnchorDate, household?.fiscalYearEndMonth]);

  const fiscalTracker = useMemo(() => {
    return getFiscalTrackerInfo(fiscalMonth.startDate, household?.fiscalYearEndMonth || 12);
  }, [fiscalMonth.startDate, household?.fiscalYearEndMonth]);

  // Filtered Feed Items
  const filteredFeedItems = useMemo(() => {
    return feedItems
      .filter((item) => {
        // Date filter from calendar anchor
        if (selectedDateFilter && item.date !== selectedDateFilter) {
          return false;
        }
        // Type filter
        if (filterType === 'transactions' && item.type !== 'transaction') return false;
        if (filterType === 'social' && item.type !== 'comment' && item.type !== 'reaction' && item.type !== 'message') return false;
        if (filterType === 'checkins' && item.type !== 'checkin' && item.type !== 'freshStart' && item.type !== 'monthEndReset') return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [feedItems, filterType, selectedDateFilter]);

  const handlePostMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    postFeedMessage(messageInput.trim());
    setMessageInput('');
  };

  // 4-4-5 Fiscal Calendar Grid Headers: Standard Monday - Sunday
  const FISCAL_DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Calendar computations strictly enforcing 4-4-5 Fiscal Month Structure
  const calendarData = useMemo(() => {
    // 1. Build an aggregate map of all logged household transactions per date
    const dailyExpensesMap: Record<string, { totalSpent: number; count: number }> = {};
    expenses.forEach((exp) => {
      const amount = Number(exp.amount) || 0;
      if (amount <= 0) return;
      let dStr = exp.date;
      if (!dStr && exp.timestamp) {
        dStr = new Date(exp.timestamp).toISOString().split('T')[0];
      }
      if (dStr) {
        if (!dailyExpensesMap[dStr]) {
          dailyExpensesMap[dStr] = { totalSpent: 0, count: 0 };
        }
        dailyExpensesMap[dStr].totalSpent += amount;
        dailyExpensesMap[dStr].count += 1;
      }
    });

    // 2. Map of date string YYYY-MM-DD -> items summary
    const daysMap: Record<
      string,
      {
        items: FeedItem[];
        commentCount: number;
        hasCheckin: boolean;
        hasStar: boolean;
        totalDailySpent: number;
        transactionCount: number;
      }
    > = {};

    // Helper to initialize day entry
    const getOrInitDay = (dStr: string) => {
      if (!daysMap[dStr]) {
        daysMap[dStr] = {
          items: [],
          commentCount: 0,
          hasCheckin: false,
          hasStar: false,
          totalDailySpent: dailyExpensesMap[dStr]?.totalSpent || 0,
          transactionCount: dailyExpensesMap[dStr]?.count || 0,
        };
      }
      return daysMap[dStr];
    };

    // Populate from feedItems
    feedItems.forEach((item) => {
      const dStr = item.date || new Date(item.timestamp).toISOString().split('T')[0];
      const entry = getOrInitDay(dStr);
      entry.items.push(item);

      // Chat bubbles for comments / notes
      if (item.type === 'comment' || item.type === 'message') {
        entry.commentCount += 1;
      }
      // Green checkmarks for completed weekly check-ins
      if (item.type === 'checkin') {
        entry.hasCheckin = true;
      }
      // Stars for monthly reviews & major milestones
      if (item.type === 'monthEndReset' || item.type === 'freshStart' || (item.metadata?.totalSaved && item.metadata.totalSaved > 50)) {
        entry.hasStar = true;
      }
      // Fallback if expense was only captured in feedItem
      if (item.linkedExpense?.amount && !dailyExpensesMap[dStr]) {
        entry.totalDailySpent += item.linkedExpense.amount;
        entry.transactionCount += 1;
      }
    });

    // Populate completed check-ins directly from checkIns collection
    checkIns.forEach((c) => {
      if (c.status === 'completed') {
        if (c.weekEndDate) {
          const entry = getOrInitDay(c.weekEndDate);
          entry.hasCheckin = true;
        }
        if (c.timestamp) {
          const cDate = new Date(c.timestamp).toISOString().split('T')[0];
          const entry = getOrInitDay(cDate);
          entry.hasCheckin = true;
        }
      }
    });

    // Populate monthly review star from household lastMonthEndReset
    if (household?.lastMonthEndReset) {
      const resetDateStr = new Date(household.lastMonthEndReset).toISOString().split('T')[0];
      const entry = getOrInitDay(resetDateStr);
      entry.hasStar = true;
    }

    const days = [];
    const current = new Date(fiscalMonth.startDate);
    const end = new Date(fiscalMonth.endDate);

    let weekNumber = 1;
    let dayInWeekIndex = 0;

    while (current.getTime() <= end.getTime()) {
      const dateStr = current.toISOString().split('T')[0];
      const dayNumber = current.getDate();
      const monthShort = current.toLocaleDateString('en-US', { month: 'short' });

      // Ensure day entry exists
      const meta = getOrInitDay(dateStr);

      days.push({
        date: new Date(current),
        dayNumber,
        monthShort,
        dateStr,
        fiscalWeekNumber: weekNumber,
        meta,
      });

      dayInWeekIndex++;
      if (dayInWeekIndex === 7) {
        dayInWeekIndex = 0;
        weekNumber++;
      }

      current.setDate(current.getDate() + 1);
    }

    return { fiscalMonth, fiscalTracker, days, dailyExpensesMap };
  }, [fiscalMonth, fiscalTracker, feedItems, expenses, checkIns, household?.lastMonthEndReset]);

  const prevFiscalMonth = () => {
    // Jump 7 days before the start of the current fiscal month into previous fiscal month
    const prevDate = new Date(fiscalMonth.startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    setCalendarAnchorDate(prevDate);
  };

  const nextFiscalMonth = () => {
    // Jump 7 days past the end of the current fiscal month into next fiscal month
    const nextDate = new Date(fiscalMonth.endDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    setCalendarAnchorDate(nextDate);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header Banner & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-beige-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sage-100 text-dark-green-950 border border-sage-300">
              Household Social Feed
            </span>
            <span className="text-xs text-dark-grey-600">
              Live Activity Stream & Interactive Calendar
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-dark-green-900 tracking-tight">
            Activity Stream & Community
          </h1>
          <p className="text-xs sm:text-sm text-brown-700">
            Real-time feed of purchases, weekly check-in celebrations, member comments, and emoji reactions.
          </p>
        </div>

        {/* View Mode Toggle: Stream vs Calendar */}
        <div className="inline-flex p-1 bg-beige-100/90 rounded-2xl border border-beige-200 self-start sm:self-auto">
          <button
            id="feed-view-stream-btn"
            onClick={() => setViewMode('stream')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              viewMode === 'stream'
                ? 'bg-dark-green-900 text-white shadow-xs'
                : 'text-dark-green-900 hover:bg-beige-200/70'
            }`}
          >
            <List className="w-4 h-4" />
            <span>Feed Stream</span>
          </button>
          <button
            id="feed-view-calendar-btn"
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              viewMode === 'calendar'
                ? 'bg-dark-green-900 text-white shadow-xs'
                : 'text-dark-green-900 hover:bg-beige-200/70'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Calendar View</span>
          </button>
        </div>
      </div>

      {/* QUICK MESSAGE COMPOSER */}
      <div className="bg-white border border-beige-200/90 rounded-3xl p-4 sm:p-5 shadow-xs">
        <form onSubmit={handlePostMessage} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-beige-100 border border-beige-200 flex items-center justify-center overflow-hidden flex-shrink-0">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-5 h-5 text-brown-700" />
            )}
          </div>
          <input
            id="feed-message-input"
            type="text"
            placeholder={`Share an update, celebration, or reminder with ${household?.name || 'your household'}...`}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-beige-50 border border-beige-200 rounded-2xl text-xs sm:text-sm text-dark-green-900 placeholder:text-dark-grey-600 focus:outline-hidden focus:border-dark-green-700 focus:bg-white transition"
          />
          <button
            id="feed-send-btn"
            type="submit"
            disabled={!messageInput.trim()}
            className="px-4 py-2.5 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Post</span>
          </button>
        </form>
      </div>

      {/* CALENDAR VIEW (4-4-5 FISCAL MONTH ENFORCED) */}
      {viewMode === 'calendar' && (
        <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
          {/* Fiscal Month Header & Navigation */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-beige-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-dark-green-950 bg-sage-100 border border-sage-300 px-2.5 py-0.5 rounded-full">
                  Fiscal Month {fiscalMonth.fiscalMonthNumber} (Q{fiscalMonth.quarter} &bull; {fiscalMonth.weekCount} Weeks)
                </span>
                <span className="text-xs font-extrabold text-brown-700 bg-beige-100/80 border border-beige-200 px-2.5 py-0.5 rounded-full">
                  {fiscalMonth.label}
                </span>
                {selectedDateFilter && (
                  <button
                    onClick={() => setSelectedDateFilter(null)}
                    className="text-xs font-bold text-sage-900 bg-sage-50 border border-sage-200 px-2.5 py-0.5 rounded-full hover:bg-sage-100 transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>Filtering: {selectedDateFilter}</span>
                    <span className="text-brown-700 font-black">&times;</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl sm:text-2xl font-black text-dark-green-900 tracking-tight">
                  {fiscalMonth.name}
                </h2>
                <span className="text-xs font-extrabold text-sage-800 hidden sm:inline">
                  &bull; {fiscalTracker.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={prevFiscalMonth}
                className="p-2 rounded-xl bg-beige-50 hover:bg-beige-100 border border-beige-200 text-dark-green-900 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="Previous Fiscal Month"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev Month</span>
              </button>
              <button
                onClick={() => setCalendarAnchorDate(new Date())}
                className="px-3 py-2 rounded-xl bg-beige-50 hover:bg-beige-100 border border-beige-200 text-xs font-bold text-dark-green-900 transition cursor-pointer"
              >
                Current Month
              </button>
              <button
                onClick={nextFiscalMonth}
                className="p-2 rounded-xl bg-beige-50 hover:bg-beige-100 border border-beige-200 text-dark-green-900 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="Next Fiscal Month"
              >
                <span className="hidden sm:inline">Next Month</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Iconography Legend */}
          <div className="flex items-center gap-4 text-xs font-semibold text-brown-700 flex-wrap bg-beige-50/70 p-3 rounded-2xl border border-beige-200">
            <span className="text-dark-green-900 font-extrabold">Fiscal Calendar Indicators:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-sage-100 border border-sage-300 flex items-center justify-center text-dark-green-900">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span>Weekly Check-In</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-gold-100 border border-gold-300 flex items-center justify-center text-gold-900">
                <Star className="w-3.5 h-3.5 fill-gold-500 text-gold-700" />
              </div>
              <span>Monthly Review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-beige-200 border border-beige-300 flex items-center justify-center text-dark-green-900">
                <MessageSquare className="w-3 h-3" />
              </div>
              <span>Comments & Notes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="px-2 py-0.5 rounded-md bg-white border border-beige-300 font-mono font-black text-dark-green-900 text-[10px] shadow-2xs">
                $0.00
              </div>
              <span>Daily Transaction Total</span>
            </div>
          </div>

          {/* 4-4-5 Fiscal Calendar Grid (Exactly 4, 5, or 6 full weeks starting Monday) */}
          <div className="grid grid-cols-7 gap-2">
            {FISCAL_DAY_HEADERS.map((dayName) => (
              <div
                key={dayName}
                className="text-center font-black text-[11px] uppercase tracking-wider text-dark-green-900 py-1 bg-beige-50/80 rounded-xl border border-beige-100"
              >
                {dayName}
              </div>
            ))}

            {calendarData.days.map((cell) => {
              const isSelected = selectedDateFilter === cell.dateStr;
              const hasActivity = cell.meta.items.length > 0 || cell.meta.totalDailySpent > 0;
              const isToday =
                cell.dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedDateFilter(null);
                    } else {
                      setSelectedDateFilter(cell.dateStr);
                    }
                  }}
                  className={`min-h-[130px] sm:min-h-[145px] p-2 sm:p-2.5 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group ${
                    isSelected
                      ? 'bg-sage-50 border-dark-green-800 ring-2 ring-dark-green-800/20 shadow-xs'
                      : isToday
                      ? 'bg-white border-sage-400 shadow-2xs ring-1 ring-sage-300'
                      : hasActivity
                      ? 'bg-white hover:bg-beige-50 border-beige-200 hover:border-beige-300'
                      : 'bg-white/70 hover:bg-beige-50 border-beige-100'
                  }`}
                >
                  {/* Top: Month Label & Day Number */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black ${
                        isToday
                          ? 'px-1.5 py-0.5 rounded-md bg-dark-green-900 text-white flex items-center justify-center'
                          : 'text-dark-green-900'
                      }`}
                    >
                      {cell.monthShort} {cell.dayNumber}
                    </span>
                    <span className="text-[9px] font-extrabold text-brown-600 bg-beige-100/70 px-1 rounded-sm">
                      W{cell.fiscalWeekNumber}
                    </span>
                  </div>

                  {/* Middle: Vertically Stacked Indicators (Icons) */}
                  <div className="flex-1 flex flex-col justify-center gap-1 my-1">
                    {cell.meta.hasCheckin && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-dark-green-900 bg-sage-100/90 px-1.5 py-0.5 rounded-md border border-sage-300" title="Weekly Check-In Completed">
                        <CheckCircle2 className="w-3 h-3 text-dark-green-700 shrink-0" />
                        <span className="truncate hidden sm:inline">Check-in</span>
                      </div>
                    )}
                    {cell.meta.hasStar && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-gold-950 bg-gold-100/90 px-1.5 py-0.5 rounded-md border border-gold-300" title="Monthly Review / Major Milestone">
                        <Star className="w-3 h-3 fill-gold-500 text-gold-700 shrink-0" />
                        <span className="truncate hidden sm:inline">Review</span>
                      </div>
                    )}
                    {cell.meta.commentCount > 0 && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-dark-green-900 bg-beige-200/90 px-1.5 py-0.5 rounded-md border border-beige-300" title={`${cell.meta.commentCount} Notes`}>
                        <MessageSquare className="w-3 h-3 text-dark-green-800 shrink-0" />
                        <span className="truncate">{cell.meta.commentCount} <span className="hidden sm:inline">note{cell.meta.commentCount > 1 ? 's' : ''}</span></span>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Daily Aggregate Transaction Dollar Total */}
                  <div className="mt-auto pt-1">
                    {cell.meta.totalDailySpent > 0 ? (
                      <div
                        className="w-full flex items-center justify-between px-1.5 py-0.5 bg-dark-green-900/5 group-hover:bg-dark-green-900/10 border border-dark-green-900/15 rounded-md text-dark-green-950 shadow-2xs transition"
                        title={`Total Logged: ${formatCurrency(cell.meta.totalDailySpent)} across ${cell.meta.transactionCount} transaction${cell.meta.transactionCount === 1 ? '' : 's'}`}
                      >
                        <span className="text-[9px] font-black text-sage-800 uppercase tracking-tight hidden sm:inline">
                          Total
                        </span>
                        <span className="text-[10px] sm:text-xs font-mono font-black text-dark-green-900 truncate">
                          {formatCurrency(cell.meta.totalDailySpent)}
                        </span>
                      </div>
                    ) : cell.meta.items.length > 0 ? (
                      <span className="block text-center text-[9px] font-bold text-brown-700 truncate">
                        {cell.meta.items.length} {cell.meta.items.length === 1 ? 'event' : 'events'}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Day Detail Banner with Clear Date Filter */}
          {selectedDateFilter && (
            <div className="bg-sage-50 border border-sage-300 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-extrabold text-dark-green-900 block">
                  Date Filter Active: {formatDateDisplay(selectedDateFilter)}
                </span>
                <span className="text-xs text-brown-700">
                  Total Logged: <strong className="text-dark-green-900 font-bold">{formatCurrency(calendarData.dailyExpensesMap[selectedDateFilter]?.totalSpent || 0)}</strong>
                  {calendarData.dailyExpensesMap[selectedDateFilter]?.count
                    ? ` (${calendarData.dailyExpensesMap[selectedDateFilter].count} transaction${calendarData.dailyExpensesMap[selectedDateFilter].count > 1 ? 's' : ''})`
                    : ' (No transactions logged)'}
                  {' '}&bull; Showing all activity recorded on this day.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDateFilter(null)}
                  className="px-3.5 py-1.5 bg-beige-100 hover:bg-beige-200 border border-beige-300 text-brown-800 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Clear Date Filter
                </button>
                <button
                  onClick={() => setViewMode('stream')}
                  className="px-3.5 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <span>View in Stream</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FILTER TABS */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: 'All Activity' },
            { id: 'social', label: 'Notes & Reactions' },
            { id: 'transactions', label: 'Transactions' },
            { id: 'checkins', label: 'Check-Ins & Retros' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                filterType === tab.id
                  ? 'bg-dark-green-900 text-white border-dark-green-900 shadow-2xs'
                  : 'bg-white text-dark-green-900 hover:bg-beige-100 border-beige-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {selectedDateFilter && (
          <button
            onClick={() => setSelectedDateFilter(null)}
            className="text-xs font-bold text-brown-700 hover:text-dark-green-900 underline cursor-pointer"
          >
            Clear Date Anchor ({selectedDateFilter})
          </button>
        )}
      </div>

      {/* ACTIVITY FEED STREAM LIST */}
      {filteredFeedItems.length === 0 ? (
        <div className="bg-white border border-beige-200 rounded-3xl p-10 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-beige-100 border border-beige-200 flex items-center justify-center text-dark-green-900 mx-auto">
            <MessageSquare className="w-7 h-7 text-sage-800" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-extrabold text-dark-green-900">
              No activity matching filters
            </h3>
            <p className="text-xs text-brown-700">
              {selectedDateFilter
                ? `No feed items were posted on ${selectedDateFilter}.`
                : 'Post an update above or log expenses to see live activity in the stream.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFeedItems.map((item) => {
            const isCheckin = item.type === 'checkin' || item.type === 'freshStart' || item.type === 'monthEndReset';
            const isReaction = item.type === 'reaction';
            const isComment = item.type === 'comment';
            const isTransaction = item.type === 'transaction';

            // Dynamically resolve category from linked expense or category name
            const matchedCategory = item.linkedExpense?.categoryId
              ? categories.find((c) => c.id === item.linkedExpense?.categoryId)
              : item.linkedExpense?.categoryName
              ? categories.find((c) => c.name.toLowerCase() === item.linkedExpense?.categoryName?.toLowerCase())
              : undefined;

            const resolvedCatIcon = matchedCategory?.icon || item.linkedExpense?.categoryIcon;
            const resolvedCatName = matchedCategory?.name || item.linkedExpense?.categoryName;
            const resolvedCatGroup = matchedCategory?.group;

            return (
              <div
                key={item.id}
                id={`feed-item-${item.id}`}
                className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs hover:border-beige-300 transition-all space-y-3.5"
              >
                {/* Author Info & Timestamp */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-beige-100 border border-beige-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.authorAvatar ? (
                        <img
                          src={item.authorAvatar}
                          alt={item.authorName || 'Member'}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-5 h-5 text-brown-700" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-dark-green-900 text-sm">
                          {item.authorName || 'Household Member'}
                        </span>
                        {isCheckin && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sage-100 text-dark-green-950 border border-sage-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-sage-700" />
                            <span>Check-In</span>
                          </span>
                        )}
                        {isReaction && (() => {
                          const def = getReactionDef(item.emoji);
                          const IconComp = def.icon;
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${def.bgClass} ${def.borderClass} ${def.textClass}`}>
                              <IconComp className={`w-3.5 h-3.5 ${def.iconColor}`} />
                              <span>{def.label}</span>
                            </span>
                          );
                        })()}
                      </div>
                      <span className="text-[11px] text-brown-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Icon Indicator (Dynamic Category Icon) */}
                  <div className="w-8 h-8 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900">
                    {isCheckin ? (
                      <Sprout className="w-4 h-4 text-sage-800" />
                    ) : isReaction ? (() => {
                      const def = getReactionDef(item.emoji);
                      const IconComp = def.icon;
                      return <IconComp className={`w-4 h-4 ${def.iconColor}`} />;
                    })() : resolvedCatName || resolvedCatIcon ? (
                      <CategoryIcon name={resolvedCatName} group={resolvedCatGroup} icon={resolvedCatIcon} className="w-4 h-4" />
                    ) : isTransaction ? (
                      <Receipt className="w-4 h-4 text-dark-green-800" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-dark-green-800" />
                    )}
                  </div>
                </div>

                {/* Content Message */}
                <div className="pl-13 space-y-3">
                  <p className="text-xs sm:text-sm text-dark-green-950 leading-relaxed font-medium">
                    {item.content}
                  </p>

                  {/* LINKED TRANSACTION GRAPHIC / CARD */}
                  {item.linkedExpense && (
                    <div
                      onClick={() => navigateToCategoryLedger(null)}
                      className="bg-beige-50/80 hover:bg-beige-100/90 border border-beige-200 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 flex-shrink-0 group-hover:scale-105 transition-transform">
                          <CategoryIcon name={resolvedCatName} group={resolvedCatGroup} icon={resolvedCatIcon} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-dark-green-900 text-xs sm:text-sm truncate">
                            {item.linkedExpense.description}
                          </h4>
                          <span className="text-[11px] text-brown-700">
                            {resolvedCatName || item.linkedExpense.categoryName} &bull; Paid by {item.linkedExpense.payerName || 'Member'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="font-black text-dark-green-900 font-mono text-sm sm:text-base block">
                          {formatCurrency(item.linkedExpense.amount)}
                        </span>
                        <span className="text-[10px] text-sage-800 font-bold group-hover:underline">
                          View in Ledger &rarr;
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Check-In Decision / Metadata summary */}
                  {item.metadata && (
                    <div className="bg-sage-50/80 border border-sage-200 rounded-2xl p-3 flex items-center gap-4 text-xs font-semibold text-dark-green-900 flex-wrap">
                      {item.metadata.totalSaved !== undefined && (
                        <span>
                          Banked to Savings: <strong className="font-bold text-sage-900">{formatCurrency(item.metadata.totalSaved)}</strong>
                        </span>
                      )}
                      {item.metadata.totalSpent !== undefined && (
                        <span>
                          Total Spent: <strong className="font-bold">{formatCurrency(item.metadata.totalSpent)}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
