import { FiscalMonth, ExtraPaycheckInfo, HouseholdMember, PaySchedule, DateRange } from '../types';

export const FISCAL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Checks if a given fiscal year is a 53-week fiscal year under the 4-4-5 accounting convention.
 * In 4-4-5 calendars, a year normally has 52 weeks (364 days).
 * Every 5-6 years, a 53rd week is added to Quarter 4 (Month 12 has 6 weeks)
 * when the drift between 364 days and solar 365.25 days accumulates to a full week.
 */
export function is53WeekFiscalYear(year: number, fiscalYearEndMonth: number = 12): boolean {
  // Determine standard start Monday of this fiscal year and next fiscal year
  const startThis = getFiscalYearStartMonday(year, fiscalYearEndMonth);
  const startNext = getFiscalYearStartMonday(year + 1, fiscalYearEndMonth);
  const diffDays = Math.round((startNext.getTime() - startThis.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 371; // 53 weeks = 371 days
}

/**
 * Finds the Monday that begins the fiscal year.
 * Anchor date for 2026 is strictly Monday, January 5, 2026.
 * Weeks strictly start on Monday and end on Sunday.
 */
export function getFiscalYearStartMonday(year: number, fiscalYearEndMonth: number = 12): Date {
  if (year === 2026 && fiscalYearEndMonth === 12) {
    return new Date(2026, 0, 5, 0, 0, 0, 0);
  }

  const startMonthIndex = fiscalYearEndMonth === 12 ? 0 : fiscalYearEndMonth % 12;
  const startCalendarYear = fiscalYearEndMonth === 12 ? year : year - 1;

  const firstDay = new Date(startCalendarYear, startMonthIndex, 1, 0, 0, 0, 0);

  // Align to first Monday on or after the 1st of the month
  const dayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const daysUntilMonday = (8 - dayOfWeek) % 7;
  const startMonday = new Date(firstDay);
  startMonday.setDate(1 + daysUntilMonday);
  startMonday.setHours(0, 0, 0, 0);
  return startMonday;
}

/**
 * Generates the full 4-4-5 (or 4-4-5 with 53rd leap week) calendar months for a fiscal year.
 * Divided into 4 quarters:
 * Q1: M1 (4 wks), M2 (4 wks), M3 (5 wks)
 * Q2: M4 (4 wks), M5 (4 wks), M6 (5 wks)
 * Q3: M7 (4 wks), M8 (4 wks), M9 (5 wks)
 * Q4: M10 (4 wks), M11 (4 wks), M12 (5 or 6 wks)
 */
export function getFiscalYearMonths(year: number, fiscalYearEndMonth: number = 12): FiscalMonth[] {
  const is53 = is53WeekFiscalYear(year, fiscalYearEndMonth);
  const startMonday = getFiscalYearStartMonday(year, fiscalYearEndMonth);

  // Weeks per month in 4-4-5 calendar
  const weekPattern = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, is53 ? 6 : 5];

  const months: FiscalMonth[] = [];
  let currentStart = new Date(startMonday);

  for (let i = 0; i < 12; i++) {
    const weekCount = weekPattern[i];
    const durationDays = weekCount * 7;

    const startDate = new Date(currentStart);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + durationDays - 1);
    endDate.setHours(23, 59, 59, 999);

    const quarter = Math.floor(i / 3) + 1;
    const startCalendarMonthIdx = (fiscalYearEndMonth === 12 ? i : (fiscalYearEndMonth + i) % 12);
    const monthName = FISCAL_MONTH_NAMES[startCalendarMonthIdx];

    const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    months.push({
      fiscalMonthNumber: i + 1,
      quarter,
      weekCount,
      name: `${monthName} (Q${quarter} • ${weekCount} wks)`,
      monthName,
      startDate,
      endDate,
      label: `${startLabel} – ${endLabel}`,
    });

    // Advance to next month's Monday
    currentStart = new Date(endDate);
    currentStart.setDate(endDate.getDate() + 1);
    currentStart.setHours(0, 0, 0, 0);
  }

  return months;
}

/**
 * Finds the Fiscal Month corresponding to any given date.
 */
export function getFiscalMonthForDate(date: Date, fiscalYearEndMonth: number = 12): FiscalMonth {
  const targetTime = date.getTime();
  const year = date.getFullYear();

  // Check current year and neighboring years
  for (const y of [year - 1, year, year + 1]) {
    const fMonths = getFiscalYearMonths(y, fiscalYearEndMonth);
    for (const fm of fMonths) {
      if (targetTime >= fm.startDate.getTime() && targetTime <= fm.endDate.getTime()) {
        return fm;
      }
    }
  }

  // Fallback to first month of current year
  const defaultMonths = getFiscalYearMonths(year, fiscalYearEndMonth);
  return defaultMonths[0];
}

/**
 * Calculates start and end Date for a given fiscal month offset from a reference date.
 * Strictly adheres to the 4-4-5 fiscal calendar and accounts for where the reference date falls
 * within its active fiscal month.
 */
export function getFiscalMonthRange(
  refDate: Date,
  monthOffset: number = 0,
  fiscalYearEndMonth: number = 12
): DateRange {
  const currentFM = getFiscalMonthForDate(refDate, fiscalYearEndMonth);

  let targetYear = currentFM.startDate.getFullYear();
  let targetMonthIdx = (currentFM.fiscalMonthNumber - 1) + monthOffset;

  while (targetMonthIdx < 0) {
    targetMonthIdx += 12;
    targetYear -= 1;
  }
  while (targetMonthIdx >= 12) {
    targetMonthIdx -= 12;
    targetYear += 1;
  }

  const yearMonths = getFiscalYearMonths(targetYear, fiscalYearEndMonth);
  const targetFM = yearMonths[targetMonthIdx] || currentFM;

  const startMonth = targetFM.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endMonth = targetFM.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return {
    startDate: targetFM.startDate,
    endDate: targetFM.endDate,
    label: `${targetFM.monthName} ${targetFM.startDate.getFullYear()} (${startMonth} – ${endMonth})`,
  };
}

export interface FiscalQuarter {
  quarterNumber: number;
  quarterName: string;
  startDate: Date;
  endDate: Date;
  months: FiscalMonth[];
}

/**
 * Finds the Fiscal Quarter corresponding to any given date.
 */
export function getFiscalQuarterForDate(date: Date, fiscalYearEndMonth: number = 12): FiscalQuarter {
  const targetTime = date.getTime();
  const year = date.getFullYear();

  for (const y of [year - 1, year, year + 1]) {
    const fMonths = getFiscalYearMonths(y, fiscalYearEndMonth);
    for (let q = 1; q <= 4; q++) {
      const qMonths = fMonths.filter((m) => m.quarter === q);
      if (qMonths.length > 0) {
        const startDate = qMonths[0].startDate;
        const endDate = qMonths[qMonths.length - 1].endDate;
        if (targetTime >= startDate.getTime() && targetTime <= endDate.getTime()) {
          return {
            quarterNumber: q,
            quarterName: `Q${q}`,
            startDate,
            endDate,
            months: qMonths,
          };
        }
      }
    }
  }

  const defaultMonths = getFiscalYearMonths(year, fiscalYearEndMonth);
  const q1Months = defaultMonths.slice(0, 3);
  return {
    quarterNumber: 1,
    quarterName: 'Q1',
    startDate: q1Months[0].startDate,
    endDate: q1Months[q1Months.length - 1].endDate,
    months: q1Months,
  };
}

export interface FiscalTrackerInfo {
  quarter: number;
  weekOfFiscalMonth: number;
  fiscalMonthNumber: number;
  monthWeekCount: number;
  weekOfFiscalYear: number;
  label: string; // e.g. "Fiscal Tracker: Q3 W1 of M9(5 weeks) W35"
}

/**
 * Calculates the exact fiscal tracker coordinates for a given date in 4-4-5 format:
 * Format: "Fiscal Tracker: Q[#] W[#] of M[#]([#] weeks) W[#]"
 * e.g. "Fiscal Tracker: Q3 W1 of M9(5 weeks) W35"
 */
export function getFiscalTrackerInfo(
  date: Date,
  fiscalYearEndMonth: number = 12
): FiscalTrackerInfo {
  const targetTime = date.getTime();
  const year = date.getFullYear();

  let targetYear = year;
  let targetMonthIndex = 0;
  let targetFiscalMonth: FiscalMonth | null = null;
  let fiscalYearMonths: FiscalMonth[] = [];

  for (const y of [year - 1, year, year + 1]) {
    const fMonths = getFiscalYearMonths(y, fiscalYearEndMonth);
    const idx = fMonths.findIndex(
      (fm) => targetTime >= fm.startDate.getTime() && targetTime <= fm.endDate.getTime()
    );
    if (idx !== -1) {
      targetYear = y;
      targetMonthIndex = idx;
      targetFiscalMonth = fMonths[idx];
      fiscalYearMonths = fMonths;
      break;
    }
  }

  if (!targetFiscalMonth) {
    fiscalYearMonths = getFiscalYearMonths(year, fiscalYearEndMonth);
    targetFiscalMonth = fiscalYearMonths[0];
    targetMonthIndex = 0;
  }

  // Calculate week of fiscal month (1-indexed, clamped to month's weekCount)
  const daysFromMonthStart = Math.max(
    0,
    Math.floor((targetTime - targetFiscalMonth.startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const weekOfFiscalMonth = Math.min(
    targetFiscalMonth.weekCount,
    Math.floor(daysFromMonthStart / 7) + 1
  );

  // Calculate week of fiscal year (cumulative weeks of preceding fiscal months + current week)
  const precedingWeeks = fiscalYearMonths
    .slice(0, targetMonthIndex)
    .reduce((sum, m) => sum + m.weekCount, 0);
  const weekOfFiscalYear = precedingWeeks + weekOfFiscalMonth;

  const label = `Fiscal Tracker: Q${targetFiscalMonth.quarter} W${weekOfFiscalMonth} of M${targetFiscalMonth.fiscalMonthNumber}(${targetFiscalMonth.weekCount} weeks) W${weekOfFiscalYear}`;

  return {
    quarter: targetFiscalMonth.quarter,
    weekOfFiscalMonth,
    fiscalMonthNumber: targetFiscalMonth.fiscalMonthNumber,
    monthWeekCount: targetFiscalMonth.weekCount,
    weekOfFiscalYear,
    label,
  };
}

/**
 * Formats the fiscal tracker record string in the strict 4-4-5 format:
 * `W[Total Week] of Fiscal Year | W[Week of Month] of [Total Weeks in Month] for M[Month]`
 * e.g., "W14 of Fiscal Year | W2 of 4 for M4"
 */
export function formatFiscalRecordTrackerString(
  dateOrDateStr: Date | string | number | undefined | null,
  fiscalYearEndMonth: number = 12
): string {
  if (!dateOrDateStr) return '';
  let date: Date;
  if (typeof dateOrDateStr === 'number') {
    date = new Date(dateOrDateStr);
  } else if (typeof dateOrDateStr === 'string') {
    const parts = dateOrDateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
    } else {
      date = new Date(dateOrDateStr);
    }
  } else {
    date = dateOrDateStr;
  }
  if (isNaN(date.getTime())) return '';
  const info = getFiscalTrackerInfo(date, fiscalYearEndMonth);
  return `W${info.weekOfFiscalYear} of Fiscal Year | W${info.weekOfFiscalMonth} of ${info.monthWeekCount} for M${info.fiscalMonthNumber}`;
}

/**
 * Generates a strict fiscal week identifier in the format `YYYY-W##` (e.g., `2026-W37`).
 */
export function getFiscalWeekId(
  dateOrDateStr: Date | string | number | undefined | null,
  fiscalYearEndMonth: number = 12
): string {
  if (!dateOrDateStr) return '';
  let date: Date;
  if (typeof dateOrDateStr === 'number') {
    date = new Date(dateOrDateStr);
  } else if (typeof dateOrDateStr === 'string') {
    const parts = dateOrDateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
    } else {
      date = new Date(dateOrDateStr);
    }
  } else {
    date = dateOrDateStr;
  }
  if (isNaN(date.getTime())) return '';
  const info = getFiscalTrackerInfo(date, fiscalYearEndMonth);
  const year = date.getFullYear();
  return `${year}-W${info.weekOfFiscalYear}`;
}

/**
 * Forecasts all pay dates for a member within a specified date range based on their last pay date and schedule.
 */
export function forecastMemberPayDates(
  lastPayDateStr: string | undefined,
  schedule: PaySchedule,
  rangeStart: Date,
  rangeEnd: Date
): string[] {
  if (!lastPayDateStr || schedule === 'none') {
    return [];
  }

  // Parse last pay date as local noon
  const parts = lastPayDateStr.split('-');
  if (parts.length !== 3) return [];
  const baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
  if (isNaN(baseDate.getTime())) return [];

  const payDates: Date[] = [];
  const startTime = rangeStart.getTime();
  const endTime = rangeEnd.getTime();

  if (schedule === 'weekly') {
    // Every 7 days
    let current = new Date(baseDate);
    // Rewind to before rangeStart
    while (current.getTime() > startTime - 14 * 86400000) {
      current.setDate(current.getDate() - 7);
    }
    // Advance and collect
    while (current.getTime() <= endTime + 7 * 86400000) {
      if (current.getTime() >= startTime && current.getTime() <= endTime) {
        payDates.push(new Date(current));
      }
      current.setDate(current.getDate() + 7);
    }
  } else if (schedule === 'bi-weekly') {
    // Every 14 days
    let current = new Date(baseDate);
    // Rewind
    while (current.getTime() > startTime - 28 * 86400000) {
      current.setDate(current.getDate() - 14);
    }
    // Advance and collect
    while (current.getTime() <= endTime + 14 * 86400000) {
      if (current.getTime() >= startTime && current.getTime() <= endTime) {
        payDates.push(new Date(current));
      }
      current.setDate(current.getDate() + 14);
    }
  } else if (schedule === 'semi-monthly') {
    // 1st and 15th (or 15th and last day)
    const startYear = rangeStart.getFullYear();
    const endYear = rangeEnd.getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 0; m < 12; m++) {
        const d1 = new Date(y, m, 1, 12, 0, 0);
        const d2 = new Date(y, m, 15, 12, 0, 0);
        if (d1.getTime() >= startTime && d1.getTime() <= endTime) payDates.push(d1);
        if (d2.getTime() >= startTime && d2.getTime() <= endTime) payDates.push(d2);
      }
    }
  } else if (schedule === 'monthly') {
    // 1st of each calendar month
    const startYear = rangeStart.getFullYear();
    const endYear = rangeEnd.getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 0; m < 12; m++) {
        const d = new Date(y, m, baseDate.getDate() || 1, 12, 0, 0);
        if (d.getTime() >= startTime && d.getTime() <= endTime) payDates.push(d);
      }
    }
  }

  return payDates
    .sort((a, b) => a.getTime() - b.getTime())
    .map((d) => d.toISOString().split('T')[0]);
}

/**
 * Detects if the given fiscal month contains an Extra Paycheck ("Magic Month")
 * for any member in the household under 4-4-5 cadence.
 */
export function detectExtraPaycheckMonth(
  members: HouseholdMember[],
  fiscalMonth: FiscalMonth
): ExtraPaycheckInfo {
  let isExtra = false;
  let totalExtra = 0;
  const breakdown: ExtraPaycheckInfo['memberBreakdown'] = [];

  for (const member of members) {
    if (!member.hasProvidedIncome || member.rawIncome <= 0) continue;

    // Projected pay dates in this fiscal month
    const projectedDates = forecastMemberPayDates(
      member.lastPayDate,
      member.incomeSchedule,
      fiscalMonth.startDate,
      fiscalMonth.endDate
    );

    let standardCount = 2; // Default for bi-weekly / semi-monthly
    let expectedCount = projectedDates.length;

    if (member.incomeSchedule === 'weekly') {
      standardCount = 4; // Standard 4-week month
      // In 5-week or 6-week months, 5 or 6 paychecks occur
      if (expectedCount > standardCount) {
        const extraCount = expectedCount - standardCount;
        const extraAmount = member.rawIncome * extraCount;
        isExtra = true;
        totalExtra += extraAmount;
        breakdown.push({
          memberId: member.userId,
          memberName: member.name,
          paySchedule: member.incomeSchedule,
          expectedPaychecks: expectedCount,
          standardPaychecks: standardCount,
          extraCount,
          extraAmount,
          payDates: projectedDates,
        });
      }
    } else if (member.incomeSchedule === 'bi-weekly') {
      standardCount = 2; // Standard 2 paychecks per month
      // In 5-week month or 3-paycheck alignment, 3 paychecks land
      if (expectedCount >= 3) {
        const extraCount = expectedCount - 2;
        const extraAmount = member.rawIncome * extraCount;
        isExtra = true;
        totalExtra += extraAmount;
        breakdown.push({
          memberId: member.userId,
          memberName: member.name,
          paySchedule: member.incomeSchedule,
          expectedPaychecks: expectedCount,
          standardPaychecks: standardCount,
          extraCount,
          extraAmount,
          payDates: projectedDates,
        });
      }
    }
  }

  const monthKey = `${fiscalMonth.startDate.getFullYear()}-FM${fiscalMonth.fiscalMonthNumber}`;

  return {
    isExtraPaycheckMonth: isExtra,
    memberBreakdown: breakdown,
    totalExtraIncome: totalExtra,
    fiscalMonthName: fiscalMonth.monthName,
    monthKey,
    quarter: fiscalMonth.quarter,
  };
}
