import React, { useMemo } from 'react';
import { CalendarMode, DayOfWeek } from '../../types';
import { DAYS_OF_WEEK, getCheckInDay } from '../../lib/calculations';
import { getFiscalYearMonths, FISCAL_MONTH_NAMES } from '../../lib/fiscal445';
import { ArrowLeft, ArrowRight, Calendar, Info, Clock, CheckCircle2 } from 'lucide-react';

interface CalendarStepProps {
  calendarMode: CalendarMode;
  setCalendarMode: (mode: CalendarMode) => void;
  firstDayOfWeek: DayOfWeek;
  setFirstDayOfWeek: (day: DayOfWeek) => void;
  fiscalYearEndMonth?: number;
  setFiscalYearEndMonth?: (month: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export const CalendarStep: React.FC<CalendarStepProps> = ({
  calendarMode,
  setCalendarMode,
  firstDayOfWeek,
  setFirstDayOfWeek,
  fiscalYearEndMonth = 12,
  setFiscalYearEndMonth,
  onNext,
  onBack,
}) => {
  const checkInDay = getCheckInDay(firstDayOfWeek);

  const fiscalMonths = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return getFiscalYearMonths(currentYear, fiscalYearEndMonth);
  }, [fiscalYearEndMonth]);

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left space-y-1">
        <h2 className="text-2xl font-bold text-dark-green-900">Calendar & Check-in Rhythm</h2>
        <p className="text-sm text-brown-700">
          Configure how Canopy structures your fiscal budget periods and scheduled accountability check-ins.
        </p>
      </div>

      {/* Mode Selector Toggle Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <button
          type="button"
          id="calendar-mode-weekly-btn"
          onClick={() => setCalendarMode('weekly')}
          className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
            calendarMode === 'weekly'
              ? 'bg-sage-50 border-dark-green-700 ring-2 ring-dark-green-700/20 shadow-sm'
              : 'bg-white border-beige-200 hover:border-sage-300 hover:bg-beige-50/50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div
                className={`p-2 rounded-lg ${
                  calendarMode === 'weekly'
                    ? 'bg-dark-green-800 text-white'
                    : 'bg-beige-100 text-dark-green-800'
                }`}
              >
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold bg-sage-200 text-dark-green-900 px-2.5 py-0.5 rounded-full">
                4-4-5 Fiscal Engine
              </span>
            </div>
            <h3 className="font-bold text-dark-green-900 text-base">4-4-5 Fiscal Weekly Cycle</h3>
            <p className="text-xs text-dark-grey-600 mt-1 leading-relaxed">
              13-week quarters (4-4-5 weeks per month). Perfectly harmonizes with weekly and bi-weekly paychecks.
            </p>
          </div>
        </button>

        <button
          type="button"
          id="calendar-mode-monthly-btn"
          onClick={() => setCalendarMode('monthly')}
          className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
            calendarMode === 'monthly'
              ? 'bg-sage-50 border-dark-green-700 ring-2 ring-dark-green-700/20 shadow-sm'
              : 'bg-white border-beige-200 hover:border-sage-300 hover:bg-beige-50/50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div
                className={`p-2 rounded-lg ${
                  calendarMode === 'monthly'
                    ? 'bg-dark-green-800 text-white'
                    : 'bg-beige-100 text-dark-green-800'
                }`}
              >
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold bg-beige-200 text-brown-900 px-2 py-0.5 rounded-full">
                Standard
              </span>
            </div>
            <h3 className="font-bold text-dark-green-900 text-base">Standard Calendar Month</h3>
            <p className="text-xs text-dark-grey-600 mt-1 leading-relaxed">
              Track purely by calendar months (1st to last day). Bypasses 4-4-5 weekly fiscal periods.
            </p>
          </div>
        </button>
      </div>

      {/* Mode-Specific Configuration */}
      {calendarMode === 'weekly' ? (
        <div className="p-5 bg-white border border-beige-200 rounded-2xl space-y-4 shadow-sm">
          <div className="space-y-1">
            <label className="text-sm font-bold text-dark-green-900 block">
              Select First Day of the Week
            </label>
            <p className="text-xs text-brown-700">
              Your 7-day budget cycle begins on this morning.
            </p>
          </div>

          {/* Day of Week Selector Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = firstDayOfWeek === day;
              return (
                <button
                  key={day}
                  type="button"
                  id={`day-select-${day.toLowerCase()}`}
                  onClick={() => setFirstDayOfWeek(day)}
                  className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition text-center cursor-pointer border ${
                    isSelected
                      ? 'bg-dark-green-800 text-white border-dark-green-800 shadow-sm'
                      : 'bg-beige-50/70 border-beige-200 text-dark-green-900 hover:bg-sage-100'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Dynamic Check-in Notification Banner */}
          <div className="mt-4 p-4 bg-sage-50 border border-sage-200 rounded-xl flex items-start gap-3">
            <div className="p-2 bg-sage-200/80 text-dark-green-900 rounded-lg mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold uppercase tracking-wider text-dark-green-800">
                Scheduled Check-In Day
              </p>
              <p className="text-sm font-semibold text-dark-green-900">
                Your weekly check-in will take place every{' '}
                <span className="underline decoration-sage-500 decoration-2 font-extrabold text-dark-green-950">
                  {checkInDay}
                </span>{' '}
                evening (the final day of your 7-day cycle).
              </p>
              <p className="text-xs text-dark-grey-600">
                This closes your weekly ledger, reviews category spending, and rolls over unspent funds.
              </p>
            </div>
          </div>

          {/* 4-4-5 Fiscal Schedule Preview */}
          <div className="p-4 bg-beige-50/70 border border-beige-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-dark-green-900">4-4-5 Fiscal Calendar Quarters (52/53 Weeks)</span>
              <span className="text-[10px] text-brown-700">4 Quarters &bull; 13 Weeks each</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[1, 2, 3, 4].map((q) => {
                const qMonths = fiscalMonths.filter((m) => m.quarter === q);
                return (
                  <div key={q} className="p-2.5 bg-white border border-beige-200 rounded-lg space-y-1">
                    <div className="font-extrabold text-dark-green-900 text-[11px]">Quarter {q}</div>
                    <div className="text-[10px] text-dark-grey-600 space-y-0.5">
                      {qMonths.map((m) => (
                        <div key={m.fiscalMonthNumber} className="flex justify-between">
                          <span>{m.monthName}</span>
                          <span className="font-bold text-sage-800">{m.weekCount} wks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Monthly Mode Explanation Notice */
        <div className="p-5 bg-beige-100/70 border border-beige-300 rounded-2xl space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-brown-200 text-brown-900 rounded-lg mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-dark-green-900">
                Monthly Architecture Override Active
              </h4>
              <p className="text-xs text-brown-800 leading-relaxed">
                Budget totals and ledger thresholds will be calculated on standard calendar month boundaries (e.g. June 1 - June 30).
              </p>
            </div>
          </div>

          <div className="p-3 bg-white/80 border border-beige-200 rounded-xl text-xs text-brown-800">
            <strong>Important note on check-ins:</strong> Weekly habit check-ins will be replaced by a single comprehensive Monthly Review on the final calendar day of each month.
          </div>
        </div>
      )}

      {/* Household Fiscal Year-End Configuration */}
      <div className="p-4 sm:p-5 bg-white border border-beige-200 rounded-2xl space-y-2 shadow-xs">
        <div className="flex items-center gap-2 text-dark-green-900 font-extrabold text-sm">
          <Calendar className="w-4 h-4 text-sage-700" />
          <span>Household Fiscal Year-End Month</span>
        </div>
        <p className="text-xs text-brown-700">
          Used to calculate the 4-4-5 accounting calendar (four 13-week quarters: 4-4-5 weeks per quarter).
        </p>
        <div className="pt-1 max-w-sm">
          <select
            id="fiscal-year-end-month-select"
            value={fiscalYearEndMonth}
            onChange={(e) => setFiscalYearEndMonth?.(parseInt(e.target.value, 10))}
            className="w-full px-3.5 py-2.5 bg-beige-50/70 border border-beige-300 rounded-xl text-dark-green-900 font-bold text-sm focus:bg-white focus:outline-none focus:border-dark-green-700 cursor-pointer"
          >
            {FISCAL_MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name} (Month {idx + 1}) {idx === 11 ? '— Standard (Default)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Actions */}
      <div className="pt-4 flex items-center justify-between">
        <button
          type="button"
          id="calendar-step-back-btn"
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 border border-beige-300 hover:bg-beige-100 text-dark-green-900 font-semibold text-sm rounded-xl transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          id="calendar-step-next-btn"
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 bg-dark-green-800 hover:bg-dark-green-900 text-white font-semibold text-sm rounded-xl transition shadow-sm cursor-pointer"
        >
          <span>Generate Household Code</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
