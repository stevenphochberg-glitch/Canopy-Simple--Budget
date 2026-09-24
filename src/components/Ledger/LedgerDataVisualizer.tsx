import React, { useState, useMemo } from 'react';
import { Category, Expense, OneOffDeposit, Household, CheckIn, HouseholdMember } from '../../types';
import { formatCurrency, getProratedExpenseAmount, calculateCategorySpending, formatLocalDate } from '../../lib/calculations';
import { getFiscalMonthForDate, getFiscalYearMonths, getFiscalQuarterForDate, getFiscalWeekId } from '../../lib/fiscal445';
import { PieChart, BarChart3, Info, Layers, Tag as TagIcon, Sparkles } from 'lucide-react';

export type ChartGroupingMode = 'categories' | 'tags' | 'both';

export interface LedgerDateRangeMeta {
  startDate: Date;
  endDate: Date;
  label: string;
  filterType: string;
  isShorterThanMonth: boolean;
  isIncompleteMonth: boolean;
}

interface LedgerDataVisualizerProps {
  activeTabCategory: Category | null; // null for All Transactions, or specific category
  selectedTabId: string | null; // null, 'deposits', or category.id
  expenses: Expense[];
  deposits?: OneOffDeposit[];
  household: Household | null;
  categories: Category[];
  dateRangeMeta: LedgerDateRangeMeta;
  checkIns?: CheckIn[];
  members?: HouseholdMember[];
}

// Master Earth Tone Palette for Pie Charts and Visualizations
const EARTH_TONE_PALETTE = [
  '#588157', // Sage Green (Essentials base)
  '#DDA15E', // Warm Amber / Ochre (Fun Money base)
  '#4A6B6C', // Slate Green / Steel (Bills base)
  '#BC6C25', // Warm Terracotta / Brown
  '#7F9A95', // Muted Teal
  '#8F6C47', // Deep Ochre Brown
  '#C98A75', // Warm Coral
  '#6B8E23', // Olive
  '#3A5A40', // Forest Green
  '#B8A78F', // Warm Beige
  '#B39283', // Soft Muted Rose
  '#9B8281', // Dusty Mauve
];

// Harmonic monochromatic tint ramps for nested/grouped subcategories
const MONOCHROMATIC_RAMPS: Record<number, string[]> = {
  0: ['#2D4A3E', '#3D6352', '#4D7D66', '#5E967B', '#70B090', '#88C2A5', '#A5D4BC', '#C2E5D3'], // Sage / Forest green
  1: ['#784A1E', '#965C25', '#B5702E', '#D48537', '#E09C55', '#EAB478', '#F2CC9D', '#F9E3C5'], // Amber / Ochre
  2: ['#1E2E38', '#2A3E4B', '#375060', '#466477', '#57798F', '#6D90A6', '#87A8BD', '#A6C2D4'], // Slate / Steel
  3: ['#6E332A', '#8A4035', '#A64F42', '#C15F50', '#D07669', '#DE8E82', '#EBA89E', '#F6C3BC'], // Terracotta / Coral
  4: ['#23433E', '#2F5953', '#3C7068', '#4B887E', '#5DA195', '#73B8AC', '#8ECFC3', '#ABE3D8'], // Muted Teal
  5: ['#3D2E24', '#523E30', '#694F3E', '#80614C', '#97755D', '#AD8B72', '#C4A48D', '#DA9480'], // Deep Ochre Brown
  6: ['#4E5D32', '#5F723D', '#718849', '#849E56', '#98B365', '#ABC876', '#BEDC89', '#D2F09E'], // Olive
};

function getMonochromaticColor(catIdx: number, itemIdx: number, totalItems: number): string {
  const ramp = MONOCHROMATIC_RAMPS[catIdx % Object.keys(MONOCHROMATIC_RAMPS).length] || MONOCHROMATIC_RAMPS[0];
  if (totalItems <= 1) return ramp[2] || ramp[0];
  const rampIdx = Math.min(ramp.length - 1, Math.floor((itemIdx / Math.max(1, totalItems - 1)) * (ramp.length - 1)));
  return ramp[rampIdx] || ramp[itemIdx % ramp.length];
}

/**
 * Extracts the exact finalized banked savings amount from a completed check-in record.
 */
function getCheckInSavingsAmount(checkIn: CheckIn): number {
  if (checkIn.totalSaved !== undefined && checkIn.totalSaved !== null && !isNaN(Number(checkIn.totalSaved))) {
    return Number(checkIn.totalSaved);
  }
  if (checkIn.decisions && checkIn.decisions.length > 0) {
    return checkIn.decisions.reduce((sum, d) => {
      if (d.savingsContribution) return sum + Number(d.savingsContribution);
      if (d.choice === 'savings') return sum + (d.difference > 0 ? Number(d.difference) : 0);
      return sum;
    }, 0);
  }
  return 0;
}

/**
 * Resolves the strict fiscal week identifier (e.g., "2026-W37") for a check-in.
 */
function getCheckInFiscalWeekId(ci: CheckIn, fiscalYearEndMonth: number = 12): string {
  if (ci.fiscalWeekId) return ci.fiscalWeekId;
  return getFiscalWeekId(ci.weekStartDate || ci.weekEndDate || ci.timestamp, fiscalYearEndMonth);
}

/**
 * Checks if a completed check-in corresponds strictly to a specific weekly time block.
 */
function checkInMatchesWeek(ci: CheckIn, wStart: Date, fiscalYearEndMonth: number = 12): boolean {
  if (ci.status !== 'completed') return false;
  const targetWeekId = getFiscalWeekId(wStart, fiscalYearEndMonth);
  return getCheckInFiscalWeekId(ci, fiscalYearEndMonth) === targetWeekId;
}

/**
 * Checks if a completed check-in falls within an overall date range.
 */
function isCheckInInRange(ci: CheckIn, start: Date, end: Date): boolean {
  if (ci.status !== 'completed') return false;
  const startMs = start.getTime();
  const endMs = end.getTime();
  const ciStartStr = ci.weekStartDate;
  const ciEndStr = ci.weekEndDate || ci.weekStartDate;
  const ciStartMs = ciStartStr ? new Date(ciStartStr + (ciStartStr.length === 10 ? 'T00:00:00' : '')).getTime() : 0;
  const ciEndMs = ciEndStr ? new Date(ciEndStr + (ciEndStr.length === 10 ? 'T23:59:59' : '')).getTime() : 0;
  const ciTimestampMs = typeof ci.timestamp === 'number' ? ci.timestamp : (ci.timestamp ? new Date(ci.timestamp).getTime() : 0);

  if (ciStartMs > 0 && ciEndMs > 0) {
    const mid = (ciStartMs + ciEndMs) / 2;
    if (mid >= startMs && mid <= endMs) return true;
    if (ciStartMs <= endMs && ciEndMs >= startMs) return true;
  }
  if (ciTimestampMs > 0) {
    if (ciTimestampMs >= startMs && ciTimestampMs <= endMs) return true;
  }
  return false;
}

export const LedgerDataVisualizer: React.FC<LedgerDataVisualizerProps> = ({
  activeTabCategory,
  selectedTabId,
  expenses,
  deposits = [],
  household,
  categories,
  dateRangeMeta,
  checkIns = [],
  members = [],
}) => {
  const [groupingMode, setGroupingMode] = useState<ChartGroupingMode>('categories');
  const [extendedGranularity, setExtendedGranularity] = useState<'month' | 'week'>('month');
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const isAllTransactionsTab = selectedTabId === null;
  const isDepositsTab = selectedTabId === 'deposits';
  const isSavingsTab =
    activeTabCategory?.id === 'cat_savings' ||
    activeTabCategory?.type === 'savings' ||
    activeTabCategory?.group?.toLowerCase() === 'savings' ||
    activeTabCategory?.name.toLowerCase().includes('saving');

  // --------------------------------------------------------------------------
  // BILLS EXCLUSION AUDIT & FIX (Directive 2)
  // If filter is explicitly set to 'Month' and it's a complete month, Bills MUST be included.
  // Only exclude Bills if filter is shorter than a month or is an incomplete ongoing month.
  // --------------------------------------------------------------------------
  const activeFilter = (dateRangeMeta.filterType || '').toLowerCase();
  const isMonthFilter = activeFilter === 'month';

  let excludeBillsFromAllChart = false;
  if (isAllTransactionsTab) {
    if (isMonthFilter) {
      // Complete month view: Bills are included. Ongoing incomplete month: Bills excluded.
      excludeBillsFromAllChart = dateRangeMeta.isIncompleteMonth;
    } else {
      // Week, custom shorter than a month, etc.
      excludeBillsFromAllChart = dateRangeMeta.isShorterThanMonth || activeFilter === 'week';
    }
  }

  // --------------------------------------------------------------------------
  // 1. ALL TRANSACTIONS & EXPENSE TABS PIE CHART DATA CALCULATION
  // --------------------------------------------------------------------------
  const { expenseSlices, totalExpenseAmount, incomeSlices, totalIncomeAmount } = useMemo(() => {
    const start = dateRangeMeta.startDate;
    const end = dateRangeMeta.endDate;
    const fiscalYearEnd = household?.fiscalYearEndMonth || 12;

    // Filter relevant expenses for active date range with dynamic proration
    const activeExpensesWithAmounts = expenses
      .map((exp) => {
        const prorated = getProratedExpenseAmount(exp, start, end, fiscalYearEnd);
        return { exp, prorated };
      })
      .filter((item) => item.prorated > 0);

    // Filter by category if on a specific category tab
    const targetExpenses = activeTabCategory
      ? activeExpensesWithAmounts.filter((item) => item.exp.categoryId === activeTabCategory.id)
      : activeExpensesWithAmounts;

    // Ordered list of expense slices
    let expSlices: Array<{ label: string; amount: number; color: string; subLabel?: string }> = [];

    if (isAllTransactionsTab) {
      if (groupingMode === 'categories') {
        // Group by Category (respecting bills exclusion rule)
        const catSlices: Array<{ label: string; amount: number; color: string; subLabel?: string }> = [];
        categories.forEach((cat, idx) => {
          if (cat.type === 'savings' || cat.group?.toLowerCase() === 'savings' || cat.name.toLowerCase().includes('saving')) {
            return;
          }
          const isBills = cat.group === 'Bills' || cat.name.toLowerCase().includes('bill');
          if (isBills && excludeBillsFromAllChart) {
            return;
          }

          const catTotal = targetExpenses
            .filter((item) => item.exp.categoryId === cat.id)
            .reduce((sum, item) => sum + item.prorated, 0);

          if (catTotal > 0) {
            catSlices.push({
              label: cat.name,
              amount: catTotal,
              color: EARTH_TONE_PALETTE[idx % EARTH_TONE_PALETTE.length],
            });
          }
        });
        expSlices = catSlices.sort((a, b) => b.amount - a.amount);
      } else if (groupingMode === 'tags') {
        // Group by individual tags across all categories + untagged
        const tagMap: Record<string, number> = {};
        let untaggedTotal = 0;

        targetExpenses.forEach((item) => {
          const cat = categories.find((c) => c.id === item.exp.categoryId);
          const isBills = cat?.group === 'Bills' || cat?.name.toLowerCase().includes('bill');
          if (isBills && excludeBillsFromAllChart) {
            return;
          }

          const tags = item.exp.tags || [];
          if (tags.length === 0) {
            untaggedTotal += item.prorated;
          } else {
            const splitAmount = item.prorated / tags.length;
            tags.forEach((tag) => {
              const cleanTag = tag.trim();
              tagMap[cleanTag] = (tagMap[cleanTag] || 0) + splitAmount;
            });
          }
        });

        const sortedTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]);
        sortedTags.forEach(([tag, amt], idx) => {
          expSlices.push({
            label: tag,
            amount: amt,
            color: EARTH_TONE_PALETTE[idx % EARTH_TONE_PALETTE.length],
          });
        });

        if (untaggedTotal > 0) {
          expSlices.push({
            label: 'Untagged',
            amount: untaggedTotal,
            color: '#B8A78F',
          });
        }
      } else {
        // ----------------------------------------------------------------------
        // "BOTH" GROUPING (Directive 1: Monochromatic scales, Sequential Category Grouping, [Category] - [Tag] Tooltips)
        // ----------------------------------------------------------------------
        const bothSlices: Array<{ label: string; amount: number; color: string; subLabel?: string }> = [];

        categories.forEach((cat, catIdx) => {
          if (cat.type === 'savings' || cat.group?.toLowerCase() === 'savings' || cat.name.toLowerCase().includes('saving')) {
            return;
          }
          const isBills = cat.group === 'Bills' || cat.name.toLowerCase().includes('bill');
          if (isBills && excludeBillsFromAllChart) {
            return;
          }

          const catItems = targetExpenses.filter((item) => item.exp.categoryId === cat.id);
          if (catItems.length === 0) return;

          // Aggregate tags within this category
          const catTagMap: Record<string, number> = {};
          let catUntaggedTotal = 0;

          catItems.forEach((item) => {
            const tags = item.exp.tags || [];
            if (tags.length === 0) {
              catUntaggedTotal += item.prorated;
            } else {
              const split = item.prorated / tags.length;
              tags.forEach((t) => {
                const clean = t.trim();
                catTagMap[clean] = (catTagMap[clean] || 0) + split;
              });
            }
          });

          // Sort tags for this category descending
          const catSortedTags = Object.entries(catTagMap).sort((a, b) => b[1] - a[1]);
          const totalCategoryItems = catSortedTags.length + (catUntaggedTotal > 0 ? 1 : 0);

          let itemIdx = 0;
          catSortedTags.forEach(([tag, amt]) => {
            bothSlices.push({
              label: `${cat.name} - ${tag}`,
              subLabel: cat.name,
              amount: amt,
              color: getMonochromaticColor(catIdx, itemIdx, totalCategoryItems),
            });
            itemIdx++;
          });

          if (catUntaggedTotal > 0) {
            bothSlices.push({
              label: `${cat.name} - Untagged`,
              subLabel: cat.name,
              amount: catUntaggedTotal,
              color: getMonochromaticColor(catIdx, itemIdx, totalCategoryItems),
            });
          }
        });

        expSlices = bothSlices;
      }
    } else if (!isSavingsTab && !isDepositsTab) {
      // Specific Expense Category tab: Hardcoded to split strictly by Tags and Untagged
      const catTagMap: Record<string, number> = {};
      let untaggedTotal = 0;

      targetExpenses.forEach((item) => {
        const tags = item.exp.tags || [];
        if (tags.length === 0) {
          untaggedTotal += item.prorated;
        } else {
          const split = item.prorated / tags.length;
          tags.forEach((tag) => {
            const clean = tag.trim();
            catTagMap[clean] = (catTagMap[clean] || 0) + split;
          });
        }
      });

      const sorted = Object.entries(catTagMap).sort((a, b) => b[1] - a[1]);
      sorted.forEach(([tag, amt], idx) => {
        expSlices.push({
          label: tag,
          amount: amt,
          color: EARTH_TONE_PALETTE[idx % EARTH_TONE_PALETTE.length],
        });
      });

      if (untaggedTotal > 0) {
        expSlices.push({
          label: 'Untagged',
          amount: untaggedTotal,
          color: '#B8A78F',
        });
      }
    }

    const expTotal = expSlices.reduce((sum, s) => sum + s.amount, 0);

    // --------------------------------------------------------------------------
    // INCOME PIE CHART MEMBER SPLIT (Directive 4)
    // Dynamic breakdown of scheduled income by Household Member + One-Off Deposits
    // --------------------------------------------------------------------------
    const incSlices: Array<{ label: string; amount: number; color: string; subLabel?: string }> = [];

    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const weeksRatio = days / 7;

    // 1. Scheduled Income split dynamically by Member
    if (members && members.length > 0) {
      let memberColorIdx = 0;
      members.forEach((m) => {
        const weeklyInc = Number(m.normalizedWeeklyIncome) || Number(m.rawIncome) || 0;
        const memberProportional = Math.round(weeklyInc * weeksRatio);
        if (memberProportional > 0) {
          incSlices.push({
            label: `${m.name}'s Income`,
            subLabel: 'Scheduled Paycheck',
            amount: memberProportional,
            color: EARTH_TONE_PALETTE[memberColorIdx % EARTH_TONE_PALETTE.length],
          });
          memberColorIdx++;
        }
      });
    }

    // Fallback if no individual member income was populated but household weekly pool exists
    if (incSlices.length === 0) {
      const weeklyPool = household?.weeklyIncomePool || 0;
      const basePoolIncome = Math.round(weeklyPool * weeksRatio);
      if (basePoolIncome > 0) {
        incSlices.push({
          label: 'Household Income Pool',
          subLabel: 'Scheduled Paychecks',
          amount: basePoolIncome,
          color: '#3A5A40',
        });
      }
    }

    // 2. One-off deposits in range with Member attribution
    const activeDeposits = (household?.oneOffDeposits || deposits || []).filter((d) => {
      const dDate = new Date(d.date + (d.date.length === 10 ? 'T12:00:00' : ''));
      const t = dDate.getTime();
      return t >= start.getTime() && t <= end.getTime();
    });

    activeDeposits.forEach((dep, idx) => {
      const payer = members.find((m) => m.userId === dep.payerMemberId);
      const payerPrefix = payer ? `${payer.name}: ` : '';
      const colorOffset = (members.length + idx + 3) % EARTH_TONE_PALETTE.length;

      incSlices.push({
        label: `${payerPrefix}${dep.description || 'One-Off Deposit'}`,
        subLabel: 'One-Off Deposit',
        amount: Number(dep.amount) || 0,
        color: EARTH_TONE_PALETTE[colorOffset],
      });
    });

    incSlices.sort((a, b) => b.amount - a.amount);
    const incTotal = incSlices.reduce((sum, s) => sum + s.amount, 0);

    return {
      expenseSlices: expSlices,
      totalExpenseAmount: expTotal,
      incomeSlices: incSlices,
      totalIncomeAmount: incTotal,
    };
  }, [
    expenses,
    deposits,
    categories,
    household,
    dateRangeMeta,
    activeTabCategory,
    isAllTransactionsTab,
    isSavingsTab,
    isDepositsTab,
    groupingMode,
    excludeBillsFromAllChart,
    members,
  ]);

  // --------------------------------------------------------------------------
  // 2. SAVINGS TAB BAR CHART DATA CALCULATION (Directive 4: Deterministic Time-Period Mapping)
  // Strictly derived from finalized historical checkIns.
  // Purged daily granularity.
  // Dynamic timeframe rendering with Month vs Week aggregation.
  // --------------------------------------------------------------------------
  const diffDays = Math.round((dateRangeMeta.endDate.getTime() - dateRangeMeta.startDate.getTime()) / (1000 * 60 * 60 * 24));
  const filterType = (dateRangeMeta.filterType || '').toLowerCase();
  const isWeekView = filterType === 'week' || (filterType === 'custom' && diffDays < 28);
  const isMonthView = filterType === 'month' || (filterType === 'custom' && diffDays >= 28 && diffDays < 84);
  const isExtendedView = !isWeekView && !isMonthView; // Quarter, Year, YTD, Last 12 Months, All Time, or custom >= 84 days

  const savingsTimelinePoints = useMemo(() => {
    if (!isSavingsTab || isWeekView) return [];

    const start = dateRangeMeta.startDate;
    const end = dateRangeMeta.endDate;
    const fiscalYearEnd = household?.fiscalYearEndMonth || 12;
    const now = Date.now();

    interface TimePoint {
      label: string;
      subLabel: string;
      bankedAmount: number | null;
      status: 'completed' | 'past_due' | 'future';
      isPastDue: boolean;
      isFuture: boolean;
    }

    const points: TimePoint[] = [];

    if (isMonthView) {
      // Month View: Deterministic mapping of weeks in this 4-4-5 Fiscal Month
      const fiscalMonth = getFiscalMonthForDate(start, fiscalYearEnd);
      const weekCount = fiscalMonth?.weekCount || 4;
      const mStart = fiscalMonth?.startDate || start;

      for (let w = 1; w <= weekCount; w++) {
        const wStart = new Date(mStart.getTime() + (w - 1) * 7 * 86400000);
        const wEnd = new Date(wStart.getTime() + 7 * 86400000 - 1);
        const currentChartPeriod = {
          id: getFiscalWeekId(wStart, fiscalYearEnd),
          label: `W${w}`,
          subLabel: `Week ${w} (${wStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${wEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
          isPast: wEnd.getTime() < now,
        };

        const match = (checkIns || []).find(
          (ci) => ci.status === 'completed' && getCheckInFiscalWeekId(ci, fiscalYearEnd) === currentChartPeriod.id
        );

        if (match !== undefined) {
          points.push({
            label: currentChartPeriod.label,
            subLabel: currentChartPeriod.subLabel,
            bankedAmount: getCheckInSavingsAmount(match),
            status: 'completed',
            isPastDue: false,
            isFuture: false,
          });
        } else if (currentChartPeriod.isPast) {
          points.push({
            label: currentChartPeriod.label,
            subLabel: currentChartPeriod.subLabel,
            bankedAmount: 0,
            status: 'past_due',
            isPastDue: true,
            isFuture: false,
          });
        } else {
          points.push({
            label: currentChartPeriod.label,
            subLabel: currentChartPeriod.subLabel,
            bankedAmount: null,
            status: 'future',
            isPastDue: false,
            isFuture: true,
          });
        }
      }
    } else {
      // Extended View: Quarter, Year, YTD, Last 12 Months, All Time (or custom >= 84 days)
      if (extendedGranularity === 'month') {
        // Aggregate by Fiscal Month
        const startYear = start.getFullYear();
        const endYear = end.getFullYear();
        const intersectingMonths: Array<{ monthName: string; quarter: number; fiscalMonthNumber: number; startDate: Date; endDate: Date; weekCount: number }> = [];

        for (let y = startYear - 1; y <= endYear + 1; y++) {
          const yearMonths = getFiscalYearMonths(y, fiscalYearEnd);
          for (const fm of yearMonths) {
            if (fm.endDate.getTime() >= start.getTime() && fm.startDate.getTime() <= end.getTime()) {
              intersectingMonths.push(fm);
            }
          }
        }

        intersectingMonths.forEach((fm) => {
          const isPast = fm.endDate.getTime() < now;
          const monthWeekIds = new Set<string>();
          for (let w = 1; w <= fm.weekCount; w++) {
            const wStart = new Date(fm.startDate.getTime() + (w - 1) * 7 * 86400000);
            monthWeekIds.add(getFiscalWeekId(wStart, fiscalYearEnd));
          }

          const monthCheckIns = (checkIns || []).filter(
            (ci) => ci.status === 'completed' && monthWeekIds.has(getCheckInFiscalWeekId(ci, fiscalYearEnd))
          );

          if (monthCheckIns.length > 0) {
            const totalBanked = monthCheckIns.reduce((sum, ci) => sum + getCheckInSavingsAmount(ci), 0);
            points.push({
              label: fm.monthName.slice(0, 3),
              subLabel: `${fm.monthName} (Q${fm.quarter} • M${fm.fiscalMonthNumber})`,
              bankedAmount: totalBanked,
              status: 'completed',
              isPastDue: false,
              isFuture: false,
            });
          } else if (isPast) {
            points.push({
              label: fm.monthName.slice(0, 3),
              subLabel: `${fm.monthName} (Q${fm.quarter} • M${fm.fiscalMonthNumber})`,
              bankedAmount: 0,
              status: 'past_due',
              isPastDue: true,
              isFuture: false,
            });
          } else {
            points.push({
              label: fm.monthName.slice(0, 3),
              subLabel: `${fm.monthName} (Q${fm.quarter} • M${fm.fiscalMonthNumber})`,
              bankedAmount: null,
              status: 'future',
              isPastDue: false,
              isFuture: true,
            });
          }
        });
      } else {
        // View by Week across extended timeframe
        let currentWStart = new Date(start);
        let wIdx = 1;

        while (currentWStart.getTime() <= end.getTime()) {
          const currentWEnd = new Date(Math.min(end.getTime(), currentWStart.getTime() + 7 * 86400000 - 1));
          const currentChartPeriod = {
            id: getFiscalWeekId(currentWStart, fiscalYearEnd),
            label: `W${wIdx}`,
            subLabel: `Week ${wIdx} (${currentWStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${currentWEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
            isPast: currentWEnd.getTime() < now,
          };

          const match = (checkIns || []).find(
            (ci) => ci.status === 'completed' && getCheckInFiscalWeekId(ci, fiscalYearEnd) === currentChartPeriod.id
          );

          if (match !== undefined) {
            points.push({
              label: currentChartPeriod.label,
              subLabel: currentChartPeriod.subLabel,
              bankedAmount: getCheckInSavingsAmount(match),
              status: 'completed',
              isPastDue: false,
              isFuture: false,
            });
          } else if (currentChartPeriod.isPast) {
            points.push({
              label: currentChartPeriod.label,
              subLabel: currentChartPeriod.subLabel,
              bankedAmount: 0,
              status: 'past_due',
              isPastDue: true,
              isFuture: false,
            });
          } else {
            points.push({
              label: currentChartPeriod.label,
              subLabel: currentChartPeriod.subLabel,
              bankedAmount: null,
              status: 'future',
              isPastDue: false,
              isFuture: true,
            });
          }

          currentWStart = new Date(currentWStart.getTime() + 7 * 86400000);
          wIdx++;
        }
      }
    }

    return points;
  }, [
    isSavingsTab,
    isWeekView,
    isMonthView,
    extendedGranularity,
    dateRangeMeta,
    checkIns,
    household,
  ]);

  // Total Banked across the filtered timeframe strictly from completed check-ins
  const totalSavingsBankedInTimeframe = useMemo(() => {
    const fiscalYearEnd = household?.fiscalYearEndMonth || 12;
    const start = dateRangeMeta.startDate;
    const end = dateRangeMeta.endDate;

    if (isWeekView) {
      const weekId = getFiscalWeekId(start, fiscalYearEnd);
      const match = (checkIns || []).find(
        (ci) => ci.status === 'completed' && getCheckInFiscalWeekId(ci, fiscalYearEnd) === weekId
      );
      return match ? getCheckInSavingsAmount(match) : 0;
    }

    return savingsTimelinePoints
      .filter((p) => p.status === 'completed' && typeof p.bankedAmount === 'number')
      .reduce((sum, p) => sum + (p.bankedAmount || 0), 0);
  }, [savingsTimelinePoints, isWeekView, dateRangeMeta, checkIns, household]);

  // Don't render if on Deposits tab
  if (isDepositsTab) {
    return null;
  }

  // --------------------------------------------------------------------------
  // RENDER HELPER: SVG DONUT / PIE CHART
  // --------------------------------------------------------------------------
  const renderPieChartSvg = (
    slices: Array<{ label: string; amount: number; color: string; subLabel?: string }>,
    total: number,
    title: string
  ) => {
    if (slices.length === 0 || total === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-beige-50/50 rounded-2xl border border-beige-200 text-center min-h-[220px]">
          <PieChart className="w-8 h-8 text-brown-400 mb-2" />
          <p className="text-xs font-bold text-dark-green-900">No {title.toLowerCase()} recorded</p>
          <p className="text-[11px] text-brown-700">No data found in {dateRangeMeta.label}</p>
        </div>
      );
    }

    let accumulatedAngle = 0;
    const size = 180;
    const center = size / 2;
    const radius = 68;
    const innerRadius = 42; // Donut hole

    const paths = slices.map((slice, idx) => {
      const percentage = slice.amount / total;
      const angle = percentage * 360;
      const startAngle = accumulatedAngle;
      const endAngle = accumulatedAngle + angle;
      accumulatedAngle += angle;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);

      const ix1 = center + innerRadius * Math.cos(startRad);
      const iy1 = center + innerRadius * Math.sin(startRad);
      const ix2 = center + innerRadius * Math.cos(endRad);
      const iy2 = center + innerRadius * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;
      const isSingle = slices.length === 1 || percentage >= 0.999;

      let d = '';
      if (isSingle) {
        d = `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.001} ${center - radius} M ${center} ${center - innerRadius} A ${innerRadius} ${innerRadius} 0 1 0 ${center - 0.001} ${center - innerRadius} Z`;
      } else {
        d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
      }

      const isHovered = hoveredSlice === slice.label;

      return (
        <path
          key={idx}
          d={d}
          fill={slice.color}
          stroke="#FAF7F2"
          strokeWidth="1.5"
          className="transition-all duration-200 cursor-pointer"
          style={{
            transform: isHovered ? 'scale(1.04)' : 'scale(1)',
            transformOrigin: `${center}px ${center}px`,
            opacity: hoveredSlice && !isHovered ? 0.45 : 1,
          }}
          onMouseEnter={() => setHoveredSlice(slice.label)}
          onMouseLeave={() => setHoveredSlice(null)}
        />
      );
    });

    const activeHoveredSliceObj = slices.find((s) => s.label === hoveredSlice);

    return (
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut SVG with Center Metric */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
            {paths}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
            {activeHoveredSliceObj ? (
              <>
                <span className="text-[10px] font-bold text-brown-700 truncate max-w-[100px]">
                  {activeHoveredSliceObj.label}
                </span>
                <span className="text-xs font-black font-mono text-dark-green-900 leading-tight">
                  {formatCurrency(activeHoveredSliceObj.amount)}
                </span>
                <span className="text-[9px] font-bold text-dark-green-800">
                  {Math.round((activeHoveredSliceObj.amount / total) * 100)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brown-700">Total</span>
                <span className="text-xs sm:text-sm font-black font-mono text-dark-green-900 leading-tight">
                  {formatCurrency(total)}
                </span>
                <span className="text-[9px] font-bold text-dark-green-800">{slices.length} items</span>
              </>
            )}
          </div>
        </div>

        {/* Legend List */}
        <div className="flex-1 w-full space-y-1.5 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-beige-300">
          {slices.map((slice, idx) => {
            const isHovered = hoveredSlice === slice.label;
            const pct = Math.round((slice.amount / total) * 100);
            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredSlice(slice.label)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={`flex items-center justify-between gap-2 p-1.5 rounded-xl transition cursor-pointer text-xs ${
                  isHovered ? 'bg-beige-100/90 shadow-2xs' : 'hover:bg-beige-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-md shrink-0 shadow-2xs"
                    style={{ backgroundColor: slice.color }}
                  />
                  <div className="min-w-0">
                    <span className="font-bold text-dark-green-900 truncate block">
                      {slice.label}
                    </span>
                    {slice.subLabel && slice.subLabel !== slice.label && (
                      <span className="text-[10px] text-brown-600 block leading-none">
                        {slice.subLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono font-black text-dark-green-900">
                    {formatCurrency(slice.amount)}
                  </span>
                  <span className="text-[10px] font-bold text-brown-700 w-8 text-right font-mono">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // 3. SAVINGS TAB: BAR CHART (MAPPING ACTUAL BANKED FUNDS WITH EXPLICIT DATA LABELS)
  // --------------------------------------------------------------------------
  if (isSavingsTab) {
    if (isWeekView) {
      // Week View Rule (Directive 4.1):
      // If the active Date Filter is set to "Week" (or custom < 1 month), do NOT render the BarChart component at all.
      // Display ONLY the "Total Banked in Timeframe" pill in the upper right, rendering the single aggregated sum for that week.
      return (
        <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900">
                <BarChart3 className="w-4 h-4 text-dark-green-800" />
              </div>
              <div>
                <h3 className="text-sm font-black text-dark-green-900">
                  Non-Accumulating Savings Rate
                </h3>
                <p className="text-[11px] text-brown-700">
                  Weekly timeframe focus ({dateRangeMeta.label})
                </p>
              </div>
            </div>

            <div className="px-3.5 py-1.5 bg-sage-50 border border-sage-200 rounded-full text-xs font-black text-dark-green-900 font-mono shadow-2xs">
              Total Banked in Timeframe: +{formatCurrency(totalSavingsBankedInTimeframe)}
            </div>
          </div>
        </div>
      );
    }

    const completedBankedAmounts = savingsTimelinePoints
      .filter((p) => p.status === 'completed' && typeof p.bankedAmount === 'number')
      .map((p) => p.bankedAmount as number);

    const maxVal = Math.max(...completedBankedAmounts, 100);
    const chartHeight = 175;
    const totalSlots = savingsTimelinePoints.length;
    const slotStep = 80;
    const chartWidth = Math.max(480, totalSlots * slotStep);
    const paddingX = 35;
    const paddingTop = 32;
    const paddingBottom = 26;

    const usableWidth = chartWidth - paddingX * 2;
    const usableHeight = chartHeight - paddingTop - paddingBottom;
    const slotWidth = totalSlots > 0 ? usableWidth / totalSlots : usableWidth;
    const barWidth = 44; // Fixed bar size (maxBarSize) so bars do not stretch infinitely

    return (
      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900">
              <BarChart3 className="w-4 h-4 text-dark-green-800" />
            </div>
            <div>
              <h3 className="text-sm font-black text-dark-green-900">
                Non-Accumulating Savings Rate
              </h3>
              <p className="text-[11px] text-brown-700">
                Actual banked funds per period ({isMonthView ? 'Weekly check-in breakdown' : extendedGranularity === 'month' ? 'Monthly summary' : 'Weekly check-in breakdown'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View by Month | View by Week toggle for Extended timeframes (Directive 4.3) */}
            {isExtendedView && (
              <div className="flex items-center gap-1 bg-beige-100/90 p-1 rounded-2xl border border-beige-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setExtendedGranularity('month')}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    extendedGranularity === 'month'
                      ? 'bg-white text-dark-green-950 shadow-xs border border-beige-300'
                      : 'text-brown-700 hover:text-dark-green-900'
                  }`}
                >
                  View by Month
                </button>
                <button
                  type="button"
                  onClick={() => setExtendedGranularity('week')}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                    extendedGranularity === 'week'
                      ? 'bg-white text-dark-green-950 shadow-xs border border-beige-300'
                      : 'text-brown-700 hover:text-dark-green-900'
                  }`}
                >
                  View by Week
                </button>
              </div>
            )}

            <div className="px-3.5 py-1.5 bg-sage-50 border border-sage-200 rounded-full text-xs font-black text-dark-green-900 font-mono shadow-2xs">
              Total Banked in Timeframe: +{formatCurrency(totalSavingsBankedInTimeframe)}
            </div>
          </div>
        </div>

        {/* SVG Bar Chart with Explicit Data Labels & Horizontal Scroll (Directive 4.2) */}
        <div className="relative w-full overflow-x-auto overflow-y-hidden">
          <div
            style={{ minWidth: `calc(${savingsTimelinePoints.length} * 80px)` }}
            className="w-full min-w-full"
          >
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto overflow-visible"
              style={{ minWidth: `${chartWidth}px`, height: `${chartHeight}px` }}
            >
              <defs>
                <linearGradient id="savingsBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#274D34" />
                  <stop offset="100%" stopColor="#1F4A2C" />
                </linearGradient>
                <linearGradient id="savingsBarHoverGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#31553C" />
                  <stop offset="100%" stopColor="#274D34" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line
                x1={paddingX}
                y1={paddingTop + usableHeight}
                x2={chartWidth - paddingX}
                y2={paddingTop + usableHeight}
                stroke="#E4D8C5"
                strokeWidth="1.5"
              />
              <line
                x1={paddingX}
                y1={paddingTop + usableHeight / 2}
                x2={chartWidth - paddingX}
                y2={paddingTop + usableHeight / 2}
                stroke="#E4D8C5"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <line
                x1={paddingX}
                y1={paddingTop}
                x2={chartWidth - paddingX}
                y2={paddingTop}
                stroke="#E4D8C5"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Bars and Explicit Data Labels */}
              {savingsTimelinePoints.map((pt, idx) => {
                const isHovered = hoveredPointIndex === idx;
                const slotCenterX = paddingX + (idx + 0.5) * slotWidth;
                const barX = slotCenterX - barWidth / 2;

                // Case 1: Completed Check-In with Banked Amount
                if (pt.status === 'completed' && typeof pt.bankedAmount === 'number') {
                  const valRatio = maxVal > 0 ? pt.bankedAmount / maxVal : 0;
                  const barHeight = pt.bankedAmount > 0 ? Math.max(6, valRatio * usableHeight) : 4;
                  const barY = paddingTop + usableHeight - barHeight;

                  return (
                    <g
                      key={idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                    >
                      {/* Explicit Top Data Label */}
                      <text
                        x={slotCenterX}
                        y={Math.max(15, barY - 7)}
                        textAnchor="middle"
                        className={`text-[11px] font-mono transition-all ${
                          isHovered ? 'font-black fill-emerald-800' : 'font-extrabold fill-dark-green-950'
                        }`}
                      >
                        {formatCurrency(pt.bankedAmount)}
                      </text>

                      {/* Solid Green Bar */}
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        rx={6}
                        ry={6}
                        fill={isHovered ? 'url(#savingsBarHoverGrad)' : 'url(#savingsBarGrad)'}
                        stroke={isHovered ? '#FAF7F2' : '#274D34'}
                        strokeWidth={isHovered ? 2 : 1}
                        className="transition-all duration-200"
                        style={{
                          filter: isHovered ? 'drop-shadow(0 2px 6px rgba(31, 74, 44, 0.35))' : 'none',
                        }}
                      />

                      {/* X-Axis Category / Time Period Label */}
                      <text
                        x={slotCenterX}
                        y={chartHeight - 8}
                        textAnchor="middle"
                        className={`text-[10px] font-mono transition-all ${
                          isHovered ? 'font-black fill-dark-green-950 underline' : 'font-extrabold fill-dark-green-900'
                        }`}
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                }

                // Case 2: Check-In Past Due (In the past with no completed check-in)
                if (pt.status === 'past_due') {
                  const placeholderHeight = Math.max(34, Math.round(usableHeight * 0.42));
                  const barY = paddingTop + usableHeight - placeholderHeight;

                  return (
                    <g
                      key={idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                    >
                      {/* Semantic Red Text Label */}
                      <text
                        x={slotCenterX}
                        y={Math.max(14, barY - 7)}
                        textAnchor="middle"
                        className="text-[9.5px] font-bold fill-red-600 font-sans tracking-tight"
                      >
                        Check-in past due
                      </text>

                      {/* Transparent Fill Bar with Dashed Semantic Red Border */}
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={placeholderHeight}
                        rx={6}
                        ry={6}
                        fill="rgba(239, 68, 68, 0.04)"
                        stroke="#EF4444"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        className="transition-all duration-200"
                        style={{
                          filter: isHovered ? 'drop-shadow(0 2px 6px rgba(239, 68, 68, 0.25))' : 'none',
                        }}
                      />

                      {/* X-Axis Category / Time Period Label in Red */}
                      <text
                        x={slotCenterX}
                        y={chartHeight - 8}
                        textAnchor="middle"
                        className="text-[10px] font-mono font-bold fill-red-600"
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                }

                // Case 3: Future Uncompleted Period
                // Render completely blank/empty column space on X-axis to maintain layout without bars or labels
                return (
                  <g key={idx}>
                    {/* Empty placeholder column maintaining layout */}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Hover Tooltip display */}
          {hoveredPointIndex !== null && savingsTimelinePoints[hoveredPointIndex] && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-dark-green-950 text-white px-3.5 py-2 rounded-xl shadow-lg text-xs flex items-center gap-2 pointer-events-none animate-in fade-in z-10 border border-dark-green-800">
              <span className="font-bold">{savingsTimelinePoints[hoveredPointIndex].subLabel}:</span>
              {savingsTimelinePoints[hoveredPointIndex].status === 'completed' ? (
                <span className="font-mono font-black text-emerald-300">
                  +{formatCurrency(savingsTimelinePoints[hoveredPointIndex].bankedAmount || 0)} banked
                </span>
              ) : savingsTimelinePoints[hoveredPointIndex].status === 'past_due' ? (
                <span className="font-mono font-bold text-red-300">
                  Check-in past due ($0 banked)
                </span>
              ) : (
                <span className="font-mono text-beige-300 italic">
                  Future week (uncompleted)
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 4. EXPENSE CATEGORY TABS (BILLS, ESSENTIALS, FUN MONEY): SINGLE PIE CHART
  // --------------------------------------------------------------------------
  if (!isAllTransactionsTab) {
    return (
      <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900">
              <TagIcon className="w-4 h-4 text-dark-green-800" />
            </div>
            <div>
              <h3 className="text-sm font-black text-dark-green-900">
                {activeTabCategory?.name} Tag Spending Distribution
              </h3>
              <p className="text-[11px] text-brown-700">
                Split by assigned tags & untagged transactions in {dateRangeMeta.label}
              </p>
            </div>
          </div>
        </div>

        {renderPieChartSvg(expenseSlices, totalExpenseAmount, `${activeTabCategory?.name || 'Category'} Expenses`)}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 5. ALL TRANSACTIONS TAB: 2 PIE CHARTS (EXPENSES & INCOME) WITH GROUP TOGGLE
  // --------------------------------------------------------------------------
  return (
    <div className="bg-white border border-beige-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
      {/* Top Header & Grouping Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-beige-200 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900">
            <PieChart className="w-4 h-4 text-dark-green-800" />
          </div>
          <div>
            <h3 className="text-sm font-black text-dark-green-900">
              Ledger Flow Visualizations
            </h3>
            <p className="text-[11px] text-brown-700">
              Comparative view of household expenses and income for {dateRangeMeta.label}
            </p>
          </div>
        </div>

        {/* Grouping Mode Toggle (Categories / Tags / Both) */}
        <div className="flex items-center gap-1 bg-beige-100/90 p-1 rounded-2xl border border-beige-200 shrink-0 self-start sm:self-auto">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-brown-700 px-2 flex items-center gap-1">
            <Layers className="w-3 h-3 text-brown-600" />
            Group By:
          </span>
          {(['categories', 'tags', 'both'] as ChartGroupingMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGroupingMode(mode)}
              className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer capitalize ${
                groupingMode === mode
                  ? 'bg-white text-dark-green-950 shadow-xs border border-beige-300'
                  : 'text-brown-700 hover:text-dark-green-900'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Exclusion Notice if applicable */}
      {excludeBillsFromAllChart && (
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Bills excluded from expense chart:</strong> Active timeframe is shorter than a month or is an ongoing month with partial bills.
          </span>
        </div>
      )}

      {/* 2 Side-by-Side Pie Charts: Expenses and Income */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1">
        {/* Chart 1: Expenses */}
        <div className="space-y-3 bg-beige-50/40 p-4 rounded-2xl border border-beige-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-dark-green-950 uppercase tracking-wider flex items-center gap-1.5">
              <TagIcon className="w-3.5 h-3.5 text-sage-700" />
              Expense Distribution ({groupingMode})
            </span>
            <span className="text-xs font-black font-mono text-dark-green-900">
              {formatCurrency(totalExpenseAmount)}
            </span>
          </div>
          {renderPieChartSvg(expenseSlices, totalExpenseAmount, 'Expenses')}
        </div>

        {/* Chart 2: Income */}
        <div className="space-y-3 bg-sage-50/40 p-4 rounded-2xl border border-sage-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-dark-green-950 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sage-700" />
              Income & Deposits Breakdown
            </span>
            <span className="text-xs font-black font-mono text-dark-green-900">
              {formatCurrency(totalIncomeAmount)}
            </span>
          </div>
          {renderPieChartSvg(incomeSlices, totalIncomeAmount, 'Income')}
        </div>
      </div>
    </div>
  );
};
