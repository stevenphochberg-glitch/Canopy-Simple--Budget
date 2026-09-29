import React, { useState, useMemo } from 'react';
import { Category, Expense, TimeframeMode, DateRange, CheckIn } from '../../types';
import {
  formatCurrency,
  getCategoryBudgetForTimeframe,
  calculateCategorySpending,
  getWeekId,
  getCategoryEffectiveWeeklyBudget,
  getWeekRange,
  formatLocalDate,
} from '../../lib/calculations';
import { getFiscalMonthForDate } from '../../lib/fiscal445';
import { Plus, AlertCircle, CheckCircle2, ChevronRight, ChevronDown, ShieldCheck, PiggyBank, MoreHorizontal } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';
import { CategoryIcon } from '../Common/CategoryIcon';
import { BudgetProgressBar } from '../Common/BudgetProgressBar';

interface CategoryCardProps {
  category: Category;
  expenses: Expense[];
  timeframeMode: TimeframeMode;
  dateRange: DateRange;
  onQuickLog: (category: Category) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  expenses,
  timeframeMode,
  dateRange,
  onQuickLog,
  isExpanded: propIsExpanded,
  onToggleExpand,
}) => {
  const { household, navigateToCategoryLedger, checkIns, categories } = useHousehold();
  const [localIsExpanded, setLocalIsExpanded] = useState(false);
  const isExpanded = propIsExpanded !== undefined ? propIsExpanded : localIsExpanded;

  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setLocalIsExpanded((prev) => !prev);
    }
  };

  const [coverageMode, setCoverageMode] = useState<'desc' | 'amount' | 'percent'>('desc');
  const [protectedMode, setProtectedMode] = useState<'desc' | 'amount' | 'percent'>('desc');
  const [depositMode, setDepositMode] = useState<'desc' | 'amount' | 'percent'>('desc');

  const cycleMode = (current: 'desc' | 'amount' | 'percent') => {
    if (current === 'desc') return 'amount';
    if (current === 'amount') return 'percent';
    return 'desc';
  };

  const isSavings = category.type === 'savings' || category.group === 'Savings';
  const categoryType = isSavings ? 'savings' : 'expense';

  // Active week ID for weekly overrides check
  const activeWeekId = getWeekId(dateRange, household?.firstDayOfWeek || 'Monday');
  const {
    budget: effectiveWeeklyBudget,
    baseline: baselineBudget,
    isOverridden,
    overrideAmount,
  } = getCategoryEffectiveWeeklyBudget(category, activeWeekId, household);

  // Budget for current timeframe:
  const isMonthView = timeframeMode === 'month';
  const fiscalMonth = getFiscalMonthForDate(dateRange.startDate, household?.fiscalYearEndMonth || 12);
  const weeksInMonth = fiscalMonth.weekCount || 4;

  const budgetForTimeframe = isMonthView
    ? baselineBudget * weeksInMonth
    : effectiveWeeklyBudget;

  const isProratedWeek = !isMonthView && isOverridden && overrideAmount !== undefined;

  // Calculate actual spending in this active date range
  const { totalSpent, count } = calculateCategorySpending(
    expenses,
    category.id,
    dateRange.startDate,
    dateRange.endDate
  );

  // Completed check-in status for this week or previous week
  const startStr = formatLocalDate(dateRange.startDate);
  const endStr = formatLocalDate(dateRange.endDate);

  const thisWeekCheckIn = useMemo<CheckIn | undefined>(() => {
    return (checkIns || []).find(
      (c) =>
        c.status === 'completed' &&
        (c.weekEndDate === endStr || c.weekStartDate === startStr || c.id.includes(startStr))
    );
  }, [checkIns, startStr, endStr]);

  const hasThisWeekCheckIn = !!thisWeekCheckIn;

  const prevWeekRange = useMemo(() => {
    const targetDate = new Date(dateRange.startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    return getWeekRange(targetDate, household?.firstDayOfWeek || 'Monday', 0);
  }, [dateRange.startDate, household?.firstDayOfWeek]);

  const hasPrevWeekCheckIn = useMemo(() => {
    const pStart = formatLocalDate(prevWeekRange.startDate);
    const pEnd = formatLocalDate(prevWeekRange.endDate);
    return (checkIns || []).some(
      (c) =>
        c.status === 'completed' &&
        (c.weekEndDate === pEnd || c.weekStartDate === pStart || c.id.includes(pStart))
    );
  }, [checkIns, prevWeekRange]);

  const isSavingsFunded = hasPrevWeekCheckIn || hasThisWeekCheckIn;
  const effectiveSpent = isSavings
    ? (!isMonthView ? (isSavingsFunded ? budgetForTimeframe : (totalSpent > 0 ? totalSpent : 0)) : totalSpent)
    : totalSpent;

  const remaining = budgetForTimeframe - effectiveSpent;
  const isOverBudget = !isSavings && remaining < 0;
  const percentage = budgetForTimeframe > 0 ? Math.round((effectiveSpent / budgetForTimeframe) * 100) : 0;

  // Decision breakdown for post-check-in stacked segment visualization
  const categoryDecision = useMemo(() => {
    if (!thisWeekCheckIn || !thisWeekCheckIn.decisions) return null;
    return thisWeekCheckIn.decisions.find((d) => d.categoryId === category.id) || null;
  }, [thisWeekCheckIn, category.id]);

  // Deposits this active week
  const depositsThisWeek = useMemo(() => {
    return (household?.oneOffDeposits || []).filter((dep) => {
      const depDate = new Date(dep.date + 'T12:00:00');
      return depDate >= dateRange.startDate && depDate <= dateRange.endDate;
    });
  }, [household?.oneOffDeposits, dateRange]);

  const depositTotalThisWeek = useMemo(() => {
    return depositsThisWeek.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [depositsThisWeek]);

  const isDepositExpansion = isSavings && (
    depositTotalThisWeek > 0 ||
    (overrideAmount !== undefined && overrideAmount > baselineBudget)
  );

  const depositAmount = isSavings
    ? (depositTotalThisWeek > 0
        ? depositTotalThisWeek
        : (overrideAmount !== undefined && overrideAmount > baselineBudget ? overrideAmount - baselineBudget : 0))
    : 0;

  // WATERFALL MATH ENGINE:
  // 1. Calculate all expense categories pacings in the current timeframe
  const expensePacings = useMemo(() => {
    return (categories || [])
      .filter((c) => c.type !== 'savings' && c.group?.toLowerCase() !== 'bills' && c.name?.toLowerCase() !== 'bills' && c.group?.toLowerCase() !== 'savings')
      .map((cat) => {
        const catBudget = isMonthView
          ? (cat.baselineBudget || 0) * weeksInMonth
          : getCategoryEffectiveWeeklyBudget(
              cat,
              getWeekId(dateRange, household?.firstDayOfWeek || 'Monday'),
              household
            ).budget;

        const { totalSpent: catSpent } = calculateCategorySpending(
          expenses,
          cat.id,
          dateRange.startDate,
          dateRange.endDate
        );
        const diff = catBudget - catSpent;
        return {
          categoryId: cat.id,
          budget: catBudget,
          spent: catSpent,
          diff,
          surplus: Math.max(0, diff),
          deficit: Math.max(0, -diff),
        };
      });
  }, [categories, isMonthView, weeksInMonth, dateRange, household, expenses]);

  // 2. Global Transfer Pot & Deficit calculations
  const { totalTransferPot, totalDeficit, netDeficit, potUsedForCoverage } = useMemo(() => {
    let pot = 0;
    let def = 0;

    if (thisWeekCheckIn?.decisions && thisWeekCheckIn.decisions.length > 0) {
      thisWeekCheckIn.decisions.forEach((d) => {
        const isSav = d.choice === 'savings' && d.categoryName?.toLowerCase().includes('savings');
        if (!isSav) {
          if (d.difference > 0) {
            pot += d.difference;
          } else if (d.difference < 0) {
            def += Math.abs(d.difference);
          }
        }
      });
    } else {
      expensePacings.forEach((p) => {
        pot += p.surplus;
        def += p.deficit;
      });
    }

    const net = Math.max(0, def - pot);
    const potUsed = Math.min(pot, def);

    return {
      totalTransferPot: pot,
      totalDeficit: def,
      netDeficit: net,
      potUsedForCoverage: potUsed,
    };
  }, [thisWeekCheckIn, expensePacings]);

  // 3. For this individual underspent expense category:
  const { categoryOverspendCoverage, categoryLeftoverSurplus } = useMemo(() => {
    if (isSavings) return { categoryOverspendCoverage: 0, categoryLeftoverSurplus: 0 };
    const mySurplus = Math.max(0, remaining);
    if (mySurplus <= 0 || totalTransferPot <= 0) {
      return { categoryOverspendCoverage: 0, categoryLeftoverSurplus: 0 };
    }
    // Proportional share of the pot used for overspend coverage
    const coverageShare = mySurplus * (potUsedForCoverage / totalTransferPot);
    const leftover = Math.max(0, mySurplus - coverageShare);
    return {
      categoryOverspendCoverage: coverageShare,
      categoryLeftoverSurplus: leftover,
    };
  }, [isSavings, remaining, totalTransferPot, potUsedForCoverage]);

  // 4. For overspent expense categories:
  const { categoryTransfersCovered, categorySavingsCovered } = useMemo(() => {
    if (isSavings || remaining >= 0) {
      return { categoryTransfersCovered: 0, categorySavingsCovered: 0 };
    }
    const def = Math.abs(remaining);
    const transfersShare = totalDeficit > 0 ? (def / totalDeficit) * potUsedForCoverage : 0;
    const savingsShare = Math.max(0, def - transfersShare);
    return {
      categoryTransfersCovered: transfersShare,
      categorySavingsCovered: savingsShare,
    };
  }, [isSavings, remaining, totalDeficit, potUsedForCoverage]);

  // 5. For Savings Category:
  // savingsDeducted is strictly the net deficit (after Transfer Pot absorbs deficits)
  const savingsDeducted = useMemo(() => {
    if (!isSavings) return 0;
    return netDeficit;
  }, [isSavings, netDeficit]);

  // Protected savings (baseline budget that survived check-in)
  const protectedSavings = useMemo(() => {
    if (!isSavings) return 0;
    return Math.max(0, baselineBudget - savingsDeducted);
  }, [isSavings, baselineBudget, savingsDeducted]);

  // True banked amount (Target Budget minus funds used for Overspend Coverage)
  const targetBudget = useMemo(() => {
    if (!isSavings) return budgetForTimeframe;
    return Math.max(
      baselineBudget + depositAmount,
      budgetForTimeframe,
      overrideAmount !== undefined ? overrideAmount : 0
    );
  }, [isSavings, baselineBudget, depositAmount, budgetForTimeframe, overrideAmount]);

  const amountActuallyBanked = useMemo(() => {
    if (!isSavings) return 0;
    return Math.max(0, targetBudget - savingsDeducted);
  }, [isSavings, targetBudget, savingsDeducted]);

  // Total pool for segmented savings bar
  const totalPool = useMemo(() => {
    if (!isSavings) return 0;
    return Math.max(targetBudget, savingsDeducted + amountActuallyBanked, 1);
  }, [isSavings, targetBudget, savingsDeducted, amountActuallyBanked]);

  // Determine icon background style based on bucket color/group
  let iconBg = 'bg-sage-100 text-dark-green-900 border-sage-300';
  if (category.group === 'Fun Money' || category.color === 'sky-blue') {
    iconBg = 'bg-sky-blue-100 text-sky-blue-900 border-sky-blue-300';
  } else if (category.group === 'Bills' || category.color === 'brown') {
    iconBg = 'bg-beige-100 text-brown-800 border-beige-300';
  } else if (isSavings) {
    iconBg = 'bg-dark-green-100 text-dark-green-900 border-dark-green-300';
  }

  return (
    <div
      id={`cat-card-${category.id}`}
      onClick={() => navigateToCategoryLedger(category.id)}
      className={`bg-white border-2 hover:border-dark-green-700/60 hover:ring-1 hover:ring-dark-green-700/20 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-2 group cursor-pointer ${
        isOverBudget
          ? 'border-alert-red-300 bg-alert-red-50/20'
          : 'border-sage-300'
      }`}
    >
      {/* Top Header (Div 2): Icon, Name, Category Type Badge, Quick Log & Chevron */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${iconBg}`}>
            <CategoryIcon name={category.name} group={category.group} icon={category.icon} className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-dark-green-900 text-base sm:text-lg truncate group-hover:text-dark-green-700 transition-colors flex items-center gap-1.5">
              {category.name}
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 text-dark-green-600 transition-opacity" />
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <span
                className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                  isSavings
                    ? 'bg-sage-100 text-dark-green-900 border-sage-300'
                    : 'bg-beige-100 text-brown-800 border-beige-300'
                }`}
              >
                {isSavings ? 'Savings' : 'Expense'}
              </span>
              {isSavings ? (
                isDepositExpansion && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sage-100 text-dark-green-900 border border-sage-300">
                    One-Time Deposit +{formatCurrency(depositAmount)}
                  </span>
                )
              ) : (
                isProratedWeek && overrideAmount !== undefined && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-sky-blue-100 text-sky-blue-900 border border-sky-blue-300">
                    Prorated {overrideAmount > baselineBudget ? '+' : ''}
                    {formatCurrency(overrideAmount - baselineBudget)}
                  </span>
                )
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Expense cards retain the + CTA, Savings card removes it */}
          {!isSavings && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickLog(category);
              }}
              id={`quick-log-${category.id}`}
              title={`Log expense for ${category.name}`}
              className="p-2 sm:p-2.5 rounded-xl bg-beige-100 hover:bg-dark-green-800 hover:text-white text-dark-green-900 transition-colors cursor-pointer border border-beige-300"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* Chevron Toggle Button to collapse/expand metrics row */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpand();
            }}
            id={`toggle-metrics-${category.id}`}
            title={isExpanded ? 'Collapse budget metrics' : 'Expand budget metrics'}
            aria-label={isExpanded ? 'Collapse budget metrics' : 'Expand budget metrics'}
            className="p-2 sm:p-2.5 rounded-xl bg-beige-100 hover:bg-beige-200 text-dark-green-900 transition cursor-pointer border border-beige-300 flex items-center justify-center"
          >
            <ChevronDown
              className={`w-4 h-4 text-dark-green-800 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Metrics Row (Div 1) & Progress Bar (Div 2) Container */}
      <div className="space-y-2">
        {/* Div 1: Metrics Row with faint line breaks - Collapsed by default */}
        {isExpanded && (
          <div className="border-y border-beige-200/80 py-2 sm:py-2.5 my-0.5 animate-fadeIn">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
                  {isSavings ? 'Savings Target' : 'Logged / Budget'}
                </span>
                <div className="text-base sm:text-xl font-black font-mono text-dark-green-900 tracking-tight flex items-baseline gap-1 flex-wrap">
                  {isSavings ? (
                    hasThisWeekCheckIn ? (
                      <>
                        <span>{formatCurrency(amountActuallyBanked)}</span>
                        <span className="text-xs font-normal text-brown-700 ml-1">
                          / {formatCurrency(targetBudget)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>{formatCurrency(targetBudget)}</span>
                        <span className="text-xs font-normal text-brown-700 ml-1">
                          allocated
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      <span>{formatCurrency(effectiveSpent)}</span>
                      <span className="text-xs font-normal text-brown-700 ml-1">
                        /{' '}
                        {isProratedWeek && overrideAmount !== undefined ? (
                          <span className="inline-flex items-baseline gap-1">
                            <span
                              className="line-through text-dark-grey-600/70 font-semibold"
                              title={`Global Baseline Budget: ${formatCurrency(baselineBudget)}`}
                            >
                              {formatCurrency(baselineBudget)}
                            </span>
                            <span
                              className="font-extrabold text-dark-green-900"
                              title={`Active Weekly Override: ${formatCurrency(overrideAmount)}`}
                            >
                              {formatCurrency(overrideAmount)}
                            </span>
                          </span>
                        ) : (
                          formatCurrency(budgetForTimeframe)
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Right Status Indicator */}
              <div className="text-right space-y-0.5 flex-shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
                  Status
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  {isSavings ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center justify-end gap-1.5 text-sage-800 font-bold text-[11px]">
                        {hasThisWeekCheckIn ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-sage-600 flex-shrink-0" />
                            <span>{formatCurrency(amountActuallyBanked)} Banked</span>
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3.5 h-3.5 text-sage-600 shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="2" y="5" width="20" height="14" rx="7" />
                              <circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none" />
                              <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
                              <circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none" />
                            </svg>
                            <span>{formatCurrency(targetBudget)} Allocated</span>
                          </>
                        )}
                      </div>
                      {hasThisWeekCheckIn && savingsDeducted > 0 && (
                        <div className="flex items-center justify-end gap-1 text-dark-grey-600 text-[11px] font-bold tracking-tight">
                          <svg
                            className="w-3.5 h-3.5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="#F5EFEB"
                            stroke="#8C6239"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <line x1="12" y1="9" x2="12" y2="13" stroke="#8C6239" />
                            <line x1="12" y1="17" x2="12.01" y2="17" stroke="#8C6239" />
                          </svg>
                          <span>
                            {formatCurrency(savingsDeducted)} used in coverage
                          </span>
                        </div>
                      )}
                    </div>
                  ) : isOverBudget ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center justify-end gap-1 text-alert-red-700 font-bold text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 text-alert-red-600 flex-shrink-0" />
                        <span>Exceeded by {formatCurrency(Math.abs(remaining))}</span>
                      </div>
                      {hasThisWeekCheckIn && (
                        <>
                          {categoryTransfersCovered > 0 && (
                            <div className="flex items-center justify-end gap-1 text-dark-grey-600 text-[11px] font-bold tracking-tight">
                              <svg
                                className="w-3.5 h-3.5 shrink-0"
                                viewBox="0 0 24 24"
                                fill="#F5EFEB"
                                stroke="#8C6239"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <line x1="12" y1="9" x2="12" y2="13" stroke="#8C6239" />
                                <line x1="12" y1="17" x2="12.01" y2="17" stroke="#8C6239" />
                              </svg>
                              <span>
                                {formatCurrency(categoryTransfersCovered)} covered from transfers
                              </span>
                            </div>
                          )}
                          {categorySavingsCovered > 0 && (
                            <div className="flex items-center justify-end gap-1 text-dark-grey-600 text-[11px] font-bold tracking-tight">
                              <svg
                                className="w-3.5 h-3.5 shrink-0"
                                viewBox="0 0 24 24"
                                fill="#F5EFEB"
                                stroke="#8C6239"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <line x1="12" y1="9" x2="12" y2="13" stroke="#8C6239" />
                                <line x1="12" y1="17" x2="12.01" y2="17" stroke="#8C6239" />
                              </svg>
                              <span>
                                {formatCurrency(categorySavingsCovered)} covered from savings
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center justify-end gap-1 text-sage-800 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sage-600 flex-shrink-0" />
                        <span>
                          {hasThisWeekCheckIn
                            ? `${formatCurrency(remaining)} unspent`
                            : `On track (${formatCurrency(remaining)} unspent)`}
                        </span>
                      </div>
                      {hasThisWeekCheckIn && categoryOverspendCoverage > 0 && (
                        <div className="flex items-center justify-end gap-1 text-dark-grey-600 text-[11px] font-bold tracking-tight">
                          <svg
                            className="w-3.5 h-3.5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="#F5EFEB"
                            stroke="#8C6239"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <line x1="12" y1="9" x2="12" y2="13" stroke="#8C6239" />
                            <line x1="12" y1="17" x2="12.01" y2="17" stroke="#8C6239" />
                          </svg>
                          <span>
                            {formatCurrency(categoryOverspendCoverage)} used in coverage
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Div 2: Progress Bar & Allocation Metrics - Always visible */}
        <div className="space-y-1.5 pt-0.5">
            {isSavings ? (
              hasThisWeekCheckIn || savingsDeducted > 0 || depositAmount > 0 ? (
                /* Segmented flex container for Savings in post-check-in / deposit state with surrounding border */
                <div
                  className="w-full h-5 sm:h-5.5 rounded-full border border-beige-300/90 bg-beige-100/60 p-0.5 flex items-center gap-1.5 sm:gap-2 relative shadow-2xs"
                  title={`Target: ${formatCurrency(targetBudget)} | ${hasThisWeekCheckIn ? 'Banked' : 'Allocated'}: ${formatCurrency(hasThisWeekCheckIn ? amountActuallyBanked : targetBudget)} | Covered Overspend: ${formatCurrency(savingsDeducted)}`}
                >
                  {/* Segment 1 (Overspend Coverage Pill) */}
                  {savingsDeducted > 0 && (
                    <div
                      style={{ width: `${(savingsDeducted / totalPool) * 100}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverageMode((prev) => cycleMode(prev));
                      }}
                      className="h-full bg-brown-700 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 flex-shrink-0 cursor-pointer hover:brightness-110 active:scale-95 select-none"
                      title={`Overspend coverage: ${formatCurrency(savingsDeducted)} (${Math.round((savingsDeducted / totalPool) * 100)}%) - Click to toggle display`}
                    >
                      <span className="truncate text-[#F5F5DC] drop-shadow-xs">
                        {coverageMode === 'desc'
                          ? 'Coverage'
                          : coverageMode === 'amount'
                          ? formatCurrency(savingsDeducted)
                          : `${Math.round((savingsDeducted / totalPool) * 100)}%`}
                      </span>
                    </div>
                  )}

                  {/* 1st Selected Div: Segment 2 (Protected / Allocated Savings Pill) */}
                  {protectedSavings > 0 && (
                    <div
                      style={{ width: `${(protectedSavings / totalPool) * 100}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setProtectedMode((prev) => cycleMode(prev));
                      }}
                      className="h-full bg-dark-green-900 text-sage-200 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 cursor-pointer hover:brightness-110 active:scale-95 select-none"
                      title={`${hasThisWeekCheckIn ? 'Protected savings' : 'Allocated savings'}: ${formatCurrency(protectedSavings)} (${Math.round((protectedSavings / totalPool) * 100)}%) - Click to toggle display`}
                    >
                      <span className="truncate text-sage-200 drop-shadow-xs">
                        {protectedMode === 'desc'
                          ? '$'
                          : protectedMode === 'amount'
                          ? formatCurrency(protectedSavings)
                          : `${Math.round((protectedSavings / totalPool) * 100)}%`}
                      </span>
                    </div>
                  )}

                  {/* 2nd Selected Div: Segment 3 (One-Time Deposit Pill) */}
                  {depositAmount > 0 && (
                    <div
                      style={{ width: `${(depositAmount / totalPool) * 100}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDepositMode((prev) => cycleMode(prev));
                      }}
                      className="h-full bg-sage-400 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1.5 overflow-hidden whitespace-nowrap transition-all duration-300 cursor-pointer hover:brightness-105 active:scale-95 select-none"
                      title={`One-time deposit: ${formatCurrency(depositAmount)} (${Math.round((depositAmount / totalPool) * 100)}%) - Click to toggle display`}
                    >
                      <span className="truncate text-sage-950 font-bold">
                        {depositMode === 'desc'
                          ? 'One-time deposit'
                          : depositMode === 'amount'
                          ? formatCurrency(depositAmount)
                          : `${Math.round((depositAmount / totalPool) * 100)}%`}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Pre-Check-In 100% Allocated Hashed Progress Bar */
                <div
                  className="w-full h-5 sm:h-5.5 rounded-full border border-beige-300/90 bg-beige-100/60 p-0.5 relative shadow-2xs"
                  title={`Target: ${formatCurrency(targetBudget)} | Allocated: ${formatCurrency(targetBudget)} (100% allocated)`}
                >
                  <div
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, #6B9F6D, #6B9F6D 6px, #EDE4DC 6px, #EDE4DC 12px)',
                    }}
                    className="w-full h-full rounded-full border border-sage-500/80 transition-all duration-300"
                  />
                </div>
              )
            ) : (
              <BudgetProgressBar
                categoryType={categoryType}
                spent={effectiveSpent}
                budget={budgetForTimeframe}
                heightClass="h-5 sm:h-5.5"
                showSurplusSplit={!isSavings && hasThisWeekCheckIn && categoryDecision !== null && (categoryOverspendCoverage > 0 || categoryLeftoverSurplus > 0)}
                surplusChoice={
                  categoryDecision?.choice === 'rollover'
                    ? 'rollover'
                    : categoryDecision?.choice === 'savings'
                    ? 'savings'
                    : null
                }
                overspendCoverageAmount={categoryOverspendCoverage}
                leftoverSurplusAmount={categoryLeftoverSurplus}
              />
            )}

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-dark-grey-600 font-medium">
                {isSavings
                  ? hasThisWeekCheckIn
                    ? `${Math.round((amountActuallyBanked / (targetBudget || 1)) * 100)}% of target banked`
                    : `${Math.round((targetBudget / (targetBudget || 1)) * 100)}% of target allocated`
                  : `${percentage}% of ${timeframeMode === 'week' ? 'weekly' : 'monthly'} allocation`}
              </span>
              <span className="text-brown-800 font-medium">
                {isSavings
                  ? hasThisWeekCheckIn
                    ? depositAmount > 0
                      ? `+${formatCurrency(depositAmount)} deposit`
                      : `${formatCurrency(amountActuallyBanked)} banked`
                    : depositAmount > 0
                    ? `+${formatCurrency(depositAmount)} deposit`
                    : `${formatCurrency(targetBudget)} allocated`
                  : `${count} ${count === 1 ? 'entry' : 'entries'}`}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };
