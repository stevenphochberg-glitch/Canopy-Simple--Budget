import React from 'react';
import { formatCurrency } from '../../lib/calculations';
import { Shield, AlertCircle, TrendingUp, Info } from 'lucide-react';

interface RunwayVisualizerProps {
  incomeBufferAmount: number;
  baselineWeeklyBurnRate: number;
  targetWeeks?: number; // default 12 weeks of runway benchmark
  onOpenBufferModal?: () => void;
}

export const RunwayVisualizer: React.FC<RunwayVisualizerProps> = ({
  incomeBufferAmount,
  baselineWeeklyBurnRate,
  targetWeeks = 12,
  onOpenBufferModal,
}) => {
  const safeBurnRate = Math.max(0, baselineWeeklyBurnRate || 0);
  const safeBuffer = Math.max(0, incomeBufferAmount || 0);

  // Runway in weeks = Total Income Buffer ÷ Baseline Weekly Burn Rate
  const runwayWeeks = safeBurnRate > 0 ? safeBuffer / safeBurnRate : 0;
  const formattedWeeks = runwayWeeks.toFixed(1);

  // Runway percentage relative to benchmark target (12 weeks)
  const runwayPct = Math.min(100, Math.max(0, Math.round((runwayWeeks / targetWeeks) * 100)));

  // Dynamic Color Logic per Directive:
  // 100% down to >50%: Solid Dark Green fill
  // 50% down to >25%: Sage Green fill
  // 25% down to >0%: Muted earthy yellow fill
  // 0% (Empty): Internal fill vanishes entirely, leaving only a Light Red outline
  let fillColor = '#264B34'; // Solid Dark Green
  let fillClass = 'bg-[#264B34]';
  let statusBadge = {
    text: 'Healthy Runway (>50%)',
    bg: 'bg-dark-green-100 text-dark-green-900 border-dark-green-300',
  };

  if (runwayPct === 0 || safeBuffer === 0) {
    fillColor = 'transparent';
    fillClass = 'bg-transparent';
    statusBadge = {
      text: 'Alert: 0% Runway Depleted',
      bg: 'bg-red-50 text-red-700 border-red-300',
    };
  } else if (runwayPct <= 25) {
    fillColor = '#D4A359'; // Muted earthy yellow
    fillClass = 'bg-[#D4A359]';
    statusBadge = {
      text: 'Low Runway (0–25%)',
      bg: 'bg-amber-50 text-amber-900 border-amber-300',
    };
  } else if (runwayPct <= 50) {
    fillColor = '#648F64'; // Sage Green
    fillClass = 'bg-[#648F64]';
    statusBadge = {
      text: 'Moderate Runway (25–50%)',
      bg: 'bg-sage-100 text-dark-green-900 border-sage-300',
    };
  }

  const isEmpty = runwayPct === 0 || safeBuffer === 0;

  return (
    <div
      id="runway-forecast-card"
      className="bg-white border-2 border-brown-800/80 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs space-y-4"
    >
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-beige-200/70 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-dark-green-900 text-white rounded-2xl shadow-2xs">
            <Shield className="w-5 h-5 text-sage-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-dark-green-800 bg-sage-100 px-2 py-0.5 rounded-full">
                Variable Income Buffer
              </span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${statusBadge.bg}`}
              >
                {statusBadge.text}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-dark-green-900 mt-0.5">
              Runway Forecast & Buffer Health
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onOpenBufferModal && (
            <button
              onClick={onOpenBufferModal}
              className="text-xs font-bold text-dark-green-900 hover:text-dark-green-950 underline cursor-pointer"
            >
              Manage Buffer
            </button>
          )}
        </div>
      </div>

      {/* Runway Core Metrics Display */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-white border border-beige-200 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
            Total Income Buffer
          </span>
          <div className="text-xl sm:text-2xl font-black text-dark-green-900 tracking-tight mt-0.5">
            {formatCurrency(safeBuffer)}
          </div>
          <span className="text-[11px] text-brown-700">Dedicated reserve holding tank</span>
        </div>

        <div className="p-3.5 bg-white border border-beige-200 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
            Baseline Weekly Burn Rate
          </span>
          <div className="text-xl sm:text-2xl font-black text-dark-green-900 tracking-tight mt-0.5">
            {formatCurrency(safeBurnRate)}
            <span className="text-xs font-semibold text-brown-700 ml-1">/ wk</span>
          </div>
          <span className="text-[11px] text-brown-700">Minimum essentials & bills need</span>
        </div>

        <div className="p-3.5 bg-white border border-beige-200 rounded-2xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-dark-grey-600 block">
            Calculated Runway
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span
              className={`text-xl sm:text-2xl font-black tracking-tight ${
                isEmpty ? 'text-red-600' : 'text-dark-green-900'
              }`}
            >
              {formattedWeeks}
            </span>
            <span className="text-xs font-bold text-brown-800">weeks of secure runway</span>
          </div>
          <span className="text-[11px] text-brown-700">
            Target: {targetWeeks} weeks benchmark ({runwayPct}%)
          </span>
        </div>
      </div>

      {/* Runway Visualizer: Straight Progress Bar wrapped in the Canopy Woven Arch Line Style */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs font-extrabold text-dark-green-900">
          <div className="flex items-center gap-1.5">
            <span>Woven Arch Runway Metric</span>
            <span className="text-[11px] text-brown-700 font-normal">
              ({safeBuffer > 0 ? `${formatCurrency(safeBuffer)} available` : '0 available'})
            </span>
          </div>
          <span
            className={`font-black ${
              isEmpty
                ? 'text-red-600'
                : runwayPct > 50
                ? 'text-dark-green-900'
                : runwayPct > 25
                ? 'text-sage-800'
                : 'text-amber-800'
            }`}
          >
            {runwayPct}% funded ({formattedWeeks} wks)
          </span>
        </div>

        {/* Woven Arch SVG Visualizer with Continuous Uniform Line Weight */}
        <div className="relative w-full overflow-hidden p-1">
          <svg
            viewBox="0 0 800 68"
            className="w-full h-auto drop-shadow-2xs select-none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Outer Arch Gradient matching Canopy logo */}
              <linearGradient id="canopyArchGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#264B34" />
                <stop offset="50%" stopColor="#4D724D" />
                <stop offset="100%" stopColor="#264B34" />
              </linearGradient>

              {/* Clip path for the straight horizontal interior track */}
              <clipPath id="straightTrackClip">
                <rect x="70" y="24" width="660" height="20" rx="10" />
              </clipPath>
            </defs>

            {/* Left Woven Arch Terminal Curve (Uniform Line Weight 5) */}
            <path
              d="M 18 52 C 18 16, 75 16, 75 34"
              stroke="#264B34"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              opacity="0.9"
            />
            <path
              d="M 28 52 C 28 26, 68 26, 68 40"
              stroke="#648F64"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              opacity="0.75"
            />

            {/* Right Woven Arch Terminal Curve (Uniform Line Weight 5) */}
            <path
              d="M 782 52 C 782 16, 725 16, 725 34"
              stroke="#264B34"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              opacity="0.9"
            />
            <path
              d="M 772 52 C 772 26, 732 26, 732 40"
              stroke="#648F64"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
              opacity="0.75"
            />

            {/* Top Woven Canopy Keystone & Center Vault Arch */}
            <path
              d="M 370 12 C 385 4, 415 4, 430 12"
              stroke="#264B34"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="400" cy="14" r="3.5" fill="#264B34" />

            {/* Connecting Cross Ties from Canopy Logo */}
            <path d="M 68 28 L 76 36" stroke="#E6DEC9" strokeWidth="3" strokeLinecap="round" />
            <path d="M 732 28 L 724 36" stroke="#E6DEC9" strokeWidth="3" strokeLinecap="round" />

            {/* Background Track of the Straight Progress Bar */}
            <rect
              x="70"
              y="24"
              width="660"
              height="20"
              rx="10"
              fill="#F4EFE6"
              stroke={isEmpty ? '#EF4444' : '#E6DEC9'}
              strokeWidth={isEmpty ? '2.5' : '1.5'}
            />

            {/* Interior Fill with Dynamic Color Logic */}
            {!isEmpty && (
              <g clipPath="url(#straightTrackClip)">
                <rect
                  x="70"
                  y="24"
                  width={(660 * runwayPct) / 100}
                  height="20"
                  fill={fillColor}
                  className="transition-all duration-700 ease-out"
                />
                {/* Subtle highlight sheen on filled track */}
                <rect
                  x="70"
                  y="25"
                  width={(660 * runwayPct) / 100}
                  height="4"
                  fill="#FFFFFF"
                  opacity="0.25"
                />
              </g>
            )}

            {/* Empty Alert: If 0%, display explicit light red outline alert */}
            {isEmpty && (
              <rect
                x="70"
                y="24"
                width="660"
                height="20"
                rx="10"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.5"
                strokeDasharray="6 4"
              />
            )}
          </svg>
        </div>

        {/* Informational Guidance Footer */}
        <div className="flex items-center justify-between text-[11px] text-brown-700 px-1">
          <div className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-sage-700 shrink-0" />
            <span>
              {isEmpty
                ? 'Buffer empty. Immediate deposits needed to secure upcoming weekly allocations.'
                : runwayPct > 50
                ? 'Comfortable buffer. Weekly category drawdowns are fully supported.'
                : 'Buffer below target. Deposits replenish this runway automatically.'}
            </span>
          </div>
          <span className="font-semibold text-dark-green-900 hidden sm:inline">
            12-Week Safety Baseline
          </span>
        </div>
      </div>
    </div>
  );
};
