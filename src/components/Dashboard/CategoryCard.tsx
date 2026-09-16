import React, { useMemo } from 'react';
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
import { Plus, AlertCircle, CheckCircle2, ChevronRight, ShieldCheck, PiggyBank } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';
import { CategoryIcon } from '../Common/CategoryIcon';
import { BudgetProgressBar } from '../Common/BudgetProgressBar';

interface CategoryCardProps {
  category: Category;
  expenses: Expense[];
  timeframeMode: TimeframeMode;
  dateRange: DateRange;
  onQuickLog: (category: Category) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  expenses,
  timeframeMode,
  dateRange,
  onQuickLog,
}) => {
  const { household, navigateToCategoryLedger, checkIns, categories } = useHousehold();

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

  // 4. For Savings Category:
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
    iconBg = 'bg-sage-100 text-dark-green-900 border-sage-300';
  }

  return (
    <div
      id={`cat-card-${category.id}`}
      onClick={() => navigateToCategoryLedger(category.id)}
      className={`bg-white border hover:border-dark-green-700/60 hover:ring-1 hover:ring-dark-green-700/20 rounded-2xl p-5 sm:p-6 min-h-[240px] sm:min-h-[255px] shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 group cursor-pointer ${
        isOverBudget
          ? 'border-alert-red-300 bg-alert-red-50/20'
          : 'border-beige-200/90'
      }`}
    >
      {/* Top Header: Icon, Name, Category Type Badge, Quick Log */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${iconBg}`}>
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

        {/* Expense cards retain the + CTA, Savings card removes it */}
        {!isSavings && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickLog(category);
            }}
            id={`quick-log-${category.id}`}
            title={`Log expense for ${category.name}`}
            className="p-2.5 rounded-xl bg-beige-100 hover:bg-dark-green-800 hover:text-white text-dark-green-900 transition-colors cursor-pointer border border-beige-300"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Metrics Row: Spent / Budget & Status */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              {isSavings ? 'Savings Target' : 'Logged / Budget'}
            </span>
            <div className="text-lg sm:text-2xl font-black font-mono text-dark-green-900 tracking-tight flex items-baseline gap-1 flex-wrap">
              {isSavings ? (
                <>
                  <span>{formatCurrency(amountActuallyBanked)}</span>
                  <span className="text-xs font-normal text-brown-700 ml-1">
                    / {formatCurrency(targetBudget)}
                  </span>
                </>
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

          {/* Right Status */}
          <div className="text-right space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-dark-grey-600 block">
              {isSavings ? 'Status' : isOverBudget ? 'Over Budget' : 'Remaining'}
            </span>
            <div
              className={`text-sm sm:text-base font-extrabold font-mono ${
                isSavings
                  ? 'text-dark-green-900'
                  : isOverBudget
                  ? 'text-alert-red-600'
                  : 'text-sage-800'
              }`}
            >
              {isSavings ? (
                depositAmount > 0 ? (
                  <span>+{formatCurrency(depositAmount)} deposit</span>
                ) : savingsDeducted > 0 ? (
                  <span className="text-brown-700">-{formatCurrency(savingsDeducted)} used</span>
                ) : (
                  <span>{formatCurrency(amountActuallyBanked)} saved</span>
                )
              ) : isOverBudget ? (
                `-${formatCurrency(Math.abs(remaining))}`
              ) : (
                `${formatCurrency(remaining)} left`
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="space-y-1.5 pt-1">
          {isSavings && (hasThisWeekCheckIn || savingsDeducted > 0 || depositAmount > 0) ? (
            /* Segmented flex container for Savings in post-check-in / deposit state */
            <div
              className="w-full h-5 sm:h-5.5 rounded-full overflow-hidden flex bg-beige-100 border border-beige-300 relative shadow-inner p-0"
              title={`Target: ${formatCurrency(targetBudget)} | Banked: ${formatCurrency(amountActuallyBanked)} | Covered Overspend: ${formatCurrency(savingsDeducted)}`}
            >
              {/* Segment 1 (Overspend Coverage):
                  - Value: savingsDeducted
                  - Visuals: Solid earth-tone brown background
                  - Text: "Overspend coverage"
              */}
              {savingsDeducted > 0 && (
                <div
                  style={{ width: `${(savingsDeducted / totalPool) * 100}%` }}
                  className="h-full bg-brown-700 text-white flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1 overflow-hidden whitespace-nowrap transition-all duration-300"
                  title={`Overspend coverage: ${formatCurrency(savingsDeducted)}`}
                >
                  <span className="truncate drop-shadow-xs">Overspend coverage</span>
                </div>
              )}

              {/* The "Total Saved" Grouping Outline:
                  Wrap Segment 2 and Segment 3 together in a single continuous dark green border.
              */}
              {(protectedSavings > 0 || depositAmount > 0) && (
                <div
                  style={{ width: `${((protectedSavings + depositAmount) / totalPool) * 100}%` }}
                  className={`h-full flex overflow-hidden border border-dark-green-800 relative z-10 ${
                    savingsDeducted === 0 ? 'rounded-full' : 'rounded-r-full'
                  }`}
                >
                  {/* Segment 2 (Protected Savings):
                      - Value: protectedSavings
                      - Visuals: Solid dark green background
                      - Text: "Protected"
                  */}
                  {protectedSavings > 0 && (
                    <div
                      style={{ width: `${(protectedSavings / (protectedSavings + depositAmount)) * 100}%` }}
                      className="h-full bg-dark-green-900 text-white flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1 overflow-hidden whitespace-nowrap transition-all duration-300"
                      title={`Protected savings: ${formatCurrency(protectedSavings)}`}
                    >
                      <span className="truncate drop-shadow-xs">Protected</span>
                    </div>
                  )}

                  {/* Segment 3 (One-Time Deposit):
                      - Value: depositAmount
                      - Visuals: Solid sage green background
                      - Text: "One-time deposit"
                  */}
                  {depositAmount > 0 && (
                    <div
                      style={{ width: `${(depositAmount / (protectedSavings + depositAmount)) * 100}%` }}
                      className="h-full bg-sage-400 text-dark-green-950 flex items-center justify-center text-[9px] sm:text-[10px] font-bold px-1 overflow-hidden whitespace-nowrap border-l border-dark-green-800/40 transition-all duration-300"
                      title={`One-time deposit: ${formatCurrency(depositAmount)}`}
                    >
                      <span className="truncate">One-time deposit</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <BudgetProgressBar
              categoryType={categoryType}
              spent={effectiveSpent}
              budget={budgetForTimeframe}
              heightClass="h-2.5"
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
                ? `${Math.round((amountActuallyBanked / (targetBudget || 1)) * 100)}% of target allocation`
                : `${percentage}% of ${timeframeMode === 'week' ? 'weekly' : 'monthly'} allocation`}
            </span>
            <span className="text-brown-800 font-medium">
              {isSavings
                ? depositAmount > 0
                  ? `+${formatCurrency(depositAmount)} deposit`
                  : `${formatCurrency(amountActuallyBanked)} banked`
                : `${count} ${count === 1 ? 'entry' : 'entries'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Status Tag */}
      <div className="pt-2 border-t border-beige-100 flex items-center justify-between text-[11px]">
        {isSavings ? (
          <div className="flex items-center gap-1.5 text-dark-green-900 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-sage-700" />
            <span>
              {formatCurrency(amountActuallyBanked)} Banked to Savings
            </span>
          </div>
        ) : isOverBudget ? (
          <div className="flex items-center gap-1 text-alert-red-700 font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-alert-red-600" />
            <span>Exceeded by {formatCurrency(Math.abs(remaining))}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-sage-800 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-sage-600" />
            <span>On track ({formatCurrency(remaining)} unspent)</span>
          </div>
        )}

        <span className="text-[10px] text-dark-grey-600 font-mono">
          {timeframeMode === 'week' ? 'Weekly' : 'Monthly'}
        </span>
      </div>
    </div>
  );
};
