import React from 'react';
import {
  HeartHandshake,
  Lightbulb,
  Heart,
  AlertTriangle,
  Sparkles,
  Coffee,
} from 'lucide-react';

export interface EarthToneReactionDef {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'sage' | 'beige' | 'brown' | 'rose' | 'amber' | 'sky' | 'dark-green';
  bgClass: string;
  activeBgClass: string;
  borderClass: string;
  activeBorderClass: string;
  textClass: string;
  activeTextClass: string;
  iconColor: string;
}

export const EARTH_TONE_REACTIONS: EarthToneReactionDef[] = [
  {
    id: 'thank_you',
    label: 'Thank you',
    shortLabel: 'Thanks',
    icon: HeartHandshake,
    tone: 'sage',
    bgClass: 'bg-sage-50 hover:bg-sage-100/80',
    activeBgClass: 'bg-sage-100',
    borderClass: 'border-sage-300',
    activeBorderClass: 'border-sage-500',
    textClass: 'text-sage-900',
    activeTextClass: 'text-dark-green-950 font-black',
    iconColor: 'text-sage-700',
  },
  {
    id: 'good_idea',
    label: 'Good idea',
    shortLabel: 'Good idea',
    icon: Lightbulb,
    tone: 'beige',
    bgClass: 'bg-[#FAF6EE] hover:bg-[#F3ECE0]',
    activeBgClass: 'bg-[#EFE5D3]',
    borderClass: 'border-[#E4D8C5]',
    activeBorderClass: 'border-[#8F6C47]',
    textClass: 'text-[#68523A]',
    activeTextClass: 'text-[#473725] font-black',
    iconColor: 'text-[#8F6C47]',
  },
  {
    id: 'love_you',
    label: 'Love you',
    shortLabel: 'Love you',
    icon: Heart,
    tone: 'brown',
    bgClass: 'bg-[#FDF4F0] hover:bg-[#F6E5DE]',
    activeBgClass: 'bg-[#EED8CE]',
    borderClass: 'border-[#E6CEC3]',
    activeBorderClass: 'border-[#94553F]',
    textClass: 'text-[#7D4936]',
    activeTextClass: 'text-[#562F21] font-black',
    iconColor: 'text-[#94553F]',
  },
  {
    id: 'yikes',
    label: 'Yikes',
    shortLabel: 'Yikes',
    icon: AlertTriangle,
    tone: 'beige',
    bgClass: 'bg-[#FDF8EE] hover:bg-[#F6EED9]',
    activeBgClass: 'bg-[#EEE2C3]',
    borderClass: 'border-[#E6D7B7]',
    activeBorderClass: 'border-[#9E7A3D]',
    textClass: 'text-[#73582A]',
    activeTextClass: 'text-[#4F3C1A] font-black',
    iconColor: 'text-[#9E7A3D]',
  },
  {
    id: 'so_excited',
    label: 'So excited',
    shortLabel: 'Excited',
    icon: Sparkles,
    tone: 'sky',
    bgClass: 'bg-sky-50 hover:bg-sky-100/80',
    activeBgClass: 'bg-sky-100',
    borderClass: 'border-sky-200',
    activeBorderClass: 'border-sky-400',
    textClass: 'text-sky-900',
    activeTextClass: 'text-sky-950 font-black',
    iconColor: 'text-sky-700',
  },
  {
    id: 'needed_that',
    label: 'Needed that so bad',
    shortLabel: 'Needed that',
    icon: Coffee,
    tone: 'dark-green',
    bgClass: 'bg-emerald-50/70 hover:bg-emerald-100/70',
    activeBgClass: 'bg-emerald-100',
    borderClass: 'border-emerald-200',
    activeBorderClass: 'border-dark-green-700',
    textClass: 'text-dark-green-900',
    activeTextClass: 'text-dark-green-950 font-black',
    iconColor: 'text-dark-green-800',
  },
];

/**
 * Normalizes legacy emoji or reaction key to an EarthToneReactionDef.
 */
export function getReactionDef(reactionKeyOrEmoji: string): EarthToneReactionDef {
  const directMatch = EARTH_TONE_REACTIONS.find((r) => r.id === reactionKeyOrEmoji);
  if (directMatch) return directMatch;

  // Legacy emoji mappings
  if (reactionKeyOrEmoji === '🙏' || reactionKeyOrEmoji === '👏' || reactionKeyOrEmoji === '👍') {
    return EARTH_TONE_REACTIONS[0]; // thank_you
  }
  if (reactionKeyOrEmoji === '💡' || reactionKeyOrEmoji === '✨' || reactionKeyOrEmoji === '💰') {
    return EARTH_TONE_REACTIONS[1]; // good_idea
  }
  if (reactionKeyOrEmoji === '❤️' || reactionKeyOrEmoji === '💚' || reactionKeyOrEmoji === '🏡') {
    return EARTH_TONE_REACTIONS[2]; // love_you
  }
  if (reactionKeyOrEmoji === '😬' || reactionKeyOrEmoji === '🔥' || reactionKeyOrEmoji === '⚠️' || reactionKeyOrEmoji === 'Yikes') {
    return EARTH_TONE_REACTIONS[3]; // yikes
  }
  if (reactionKeyOrEmoji === '🎉' || reactionKeyOrEmoji === '🚀') {
    return EARTH_TONE_REACTIONS[4]; // so_excited
  }
  if (reactionKeyOrEmoji === '☕' || reactionKeyOrEmoji === '🌿' || reactionKeyOrEmoji === '🛒') {
    return EARTH_TONE_REACTIONS[5]; // needed_that
  }

  // Fallback to first
  return EARTH_TONE_REACTIONS[0];
}

interface EarthToneReactionProps {
  reactions?: Array<{
    id: string;
    emoji: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
  }>;
  onReact: (reactionId: string) => void;
  currentUserId?: string;
  className?: string;
}

export const EarthToneReaction: React.FC<EarthToneReactionProps> = ({
  reactions = [],
  onReact,
  currentUserId,
  className = '',
}) => {
  // Aggregate reaction counts grouped by normalized reaction id
  const reactionMap = reactions.reduce<
    Record<
      string,
      {
        count: number;
        userReacted: boolean;
        names: string[];
        def: EarthToneReactionDef;
      }
    >
  >((acc, r) => {
    const def = getReactionDef(r.emoji);
    const key = def.id;

    if (!acc[key]) {
      acc[key] = { count: 0, userReacted: false, names: [], def };
    }
    acc[key].count += 1;
    if (r.authorName && !acc[key].names.includes(r.authorName)) {
      acc[key].names.push(r.authorName);
    }
    if (r.authorId === currentUserId) {
      acc[key].userReacted = true;
    }
    return acc;
  }, {});

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* Active Reaction Pills */}
      {Object.entries(reactionMap).map(([key, data]) => {
        const { def, count, userReacted, names } = data;
        const IconComponent = def.icon;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onReact(def.id)}
            title={`Reacted with ${def.label} by: ${names.join(', ')}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
              userReacted
                ? `${def.activeBgClass} ${def.activeBorderClass} ${def.activeTextClass} ring-1 ring-dark-green-800/10`
                : `${def.bgClass} ${def.borderClass} ${def.textClass}`
            }`}
          >
            <IconComponent className={`w-3.5 h-3.5 ${def.iconColor} shrink-0`} />
            <span className="text-[11px] hidden sm:inline">{def.shortLabel}</span>
            <span className="font-mono text-[11px] font-black">{count}</span>
          </button>
        );
      })}

      {/* Quick Reaction Earth-Tone SVG Pickers */}
      <div className="flex items-center gap-1 ml-1 bg-beige-50/80 p-0.5 rounded-xl border border-beige-200">
        {EARTH_TONE_REACTIONS.map((def) => {
          const IconComponent = def.icon;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => onReact(def.id)}
              className={`p-1.5 rounded-lg border border-transparent hover:border-beige-300 ${def.bgClass} transition-all hover:scale-110 cursor-pointer`}
              title={def.label}
            >
              <IconComponent className={`w-3.5 h-3.5 ${def.iconColor}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
