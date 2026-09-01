import React from 'react';

export const EARTH_TONE_EMOJIS = ['🌿', '☕', '👍', '✨', '💚', '👏', '💰', '🏡'] as const;
export type EarthToneEmoji = (typeof EARTH_TONE_EMOJIS)[number];

interface EarthToneReactionProps {
  reactions?: Array<{
    id: string;
    emoji: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
  }>;
  onReact: (emoji: string) => void;
  currentUserId?: string;
  className?: string;
}

export const EarthToneReaction: React.FC<EarthToneReactionProps> = ({
  reactions = [],
  onReact,
  currentUserId,
  className = '',
}) => {
  // Aggregate reaction counts
  const reactionMap = reactions.reduce<Record<string, { count: number; userReacted: boolean; names: string[] }>>(
    (acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = { count: 0, userReacted: false, names: [] };
      }
      acc[r.emoji].count += 1;
      if (r.authorName) acc[r.emoji].names.push(r.authorName);
      if (r.authorId === currentUserId) acc[r.emoji].userReacted = true;
      return acc;
    },
    {}
  );

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {/* Active Reaction Pills */}
      {Object.entries(reactionMap).map(([emoji, data]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          title={`Reacted by: ${data.names.join(', ')}`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
            data.userReacted
              ? 'bg-sage-100 border-dark-green-700 text-dark-green-900 shadow-2xs'
              : 'bg-white hover:bg-beige-100 border-beige-200 text-brown-800'
          }`}
        >
          <span>{emoji}</span>
          <span className="text-[11px]">{data.count}</span>
        </button>
      ))}

      {/* Quick Reaction Emoji Pickers */}
      <div className="flex items-center gap-0.5 ml-1">
        {EARTH_TONE_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            className="p-1 rounded-full hover:bg-beige-100 text-xs transition hover:scale-125 cursor-pointer"
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
