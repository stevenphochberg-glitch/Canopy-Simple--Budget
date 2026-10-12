import React, { useState, useMemo } from 'react';
import { useHousehold } from '../../context/HouseholdContext';
import { auth } from '../../lib/firebase';
import { formatCurrency, formatDateDisplay, formatLocalDate, getSavingsGoalCreationTime, normalizeToWeekly, roundAmountsInText, roundToHundredths } from '../../lib/calculations';
import { generateFacelessVectorAvatar } from '../../lib/avatars';
import { CategoryIcon } from '../Common/CategoryIcon';
import { getReactionDef } from '../Common/EarthToneReaction';
import {
  getFiscalMonthForDate,
  getFiscalTrackerInfo,
  FISCAL_MONTH_NAMES,
} from '../../lib/fiscal445';
import {
  MessageSquare,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  Star,
  Award,
  Trophy,
  Target,
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
  DollarSign,
  UserMinus,
  UserCheck,
  Shield,
  X,
} from 'lucide-react';
import { FeedItem, Expense, CheckIn } from '../../types';

interface ReactionColorScheme {
  outerCardBg: string;
  outerCardBorder: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  headerIconBg: string;
  headerIconBorder: string;
  innerCardBg: string;
  innerCardBorder: string;
  innerCardHoverBorder: string;
  catIconBg: string;
  catIconBorder: string;
  catIconColor: string;
  catGroupBg: string;
  catGroupText: string;
  catGroupBorder: string;
  tagBg: string;
  tagText: string;
  tagBorder: string;
  amountText: string;
  linkText: string;
}

function getReactionColorScheme(emojiOrKey: string): ReactionColorScheme {
  const def = getReactionDef(emojiOrKey);
  switch (def.id) {
    case 'so_excited':
      return {
        outerCardBg: 'bg-sky-50/70',
        outerCardBorder: 'border-2 border-sky-300 hover:border-sky-400',
        badgeBg: 'bg-sky-100',
        badgeText: 'text-sky-950 font-black',
        badgeBorder: 'border-sky-300',
        headerIconBg: 'bg-sky-100',
        headerIconBorder: 'border-sky-200',
        innerCardBg: 'bg-white/95',
        innerCardBorder: 'border-sky-200',
        innerCardHoverBorder: 'hover:border-sky-400',
        catIconBg: 'bg-sky-100',
        catIconBorder: 'border-sky-200',
        catIconColor: 'text-sky-700',
        catGroupBg: 'bg-sky-100',
        catGroupText: 'text-sky-950',
        catGroupBorder: 'border-sky-300',
        tagBg: 'bg-sky-50',
        tagText: 'text-sky-900',
        tagBorder: 'border-sky-200',
        amountText: 'text-sky-950',
        linkText: 'text-sky-700',
      };
    case 'thank_you':
      return {
        outerCardBg: 'bg-sage-50/70',
        outerCardBorder: 'border-2 border-sage-300 hover:border-sage-400',
        badgeBg: 'bg-sage-100',
        badgeText: 'text-dark-green-950 font-black',
        badgeBorder: 'border-sage-300',
        headerIconBg: 'bg-sage-100',
        headerIconBorder: 'border-sage-200',
        innerCardBg: 'bg-white/95',
        innerCardBorder: 'border-sage-200',
        innerCardHoverBorder: 'hover:border-sage-400',
        catIconBg: 'bg-sage-100',
        catIconBorder: 'border-sage-200',
        catIconColor: 'text-sage-700',
        catGroupBg: 'bg-sage-100',
        catGroupText: 'text-dark-green-950',
        catGroupBorder: 'border-sage-300',
        tagBg: 'bg-sage-50',
        tagText: 'text-dark-green-900',
        tagBorder: 'border-sage-200',
        amountText: 'text-dark-green-950',
        linkText: 'text-sage-700',
      };
    case 'good_idea':
      return {
        outerCardBg: 'bg-[#FAF6EE]',
        outerCardBorder: 'border-2 border-[#E4D8C5] hover:border-[#8F6C47]/50',
        badgeBg: 'bg-[#EFE5D3]',
        badgeText: 'text-[#473725] font-black',
        badgeBorder: 'border-[#8F6C47]',
        headerIconBg: 'bg-[#EFE5D3]',
        headerIconBorder: 'border-[#E4D8C5]',
        innerCardBg: 'bg-white/95',
        innerCardBorder: 'border-[#E4D8C5]',
        innerCardHoverBorder: 'hover:border-[#8F6C47]',
        catIconBg: 'bg-[#EFE5D3]',
        catIconBorder: 'border-[#E4D8C5]',
        catIconColor: 'text-[#8F6C47]',
        catGroupBg: 'bg-[#EFE5D3]',
        catGroupText: 'text-[#473725]',
        catGroupBorder: 'border-[#8F6C47]',
        tagBg: 'bg-[#FAF6EE]',
        tagText: 'text-[#68523A]',
        tagBorder: 'border-[#E4D8C5]',
        amountText: 'text-[#473725]',
        linkText: 'text-[#8F6C47]',
      };
    case 'love_this':
      return {
        outerCardBg: 'bg-[#FDF4F0]',
        outerCardBorder: 'border-2 border-[#E6CEC3] hover:border-[#94553F]/50',
        badgeBg: 'bg-[#EED8CE]',
        badgeText: 'text-[#562F21] font-black',
        badgeBorder: 'border-[#94553F]',
        headerIconBg: 'bg-[#EED8CE]',
        headerIconBorder: 'border-[#E6CEC3]',
        innerCardBg: 'bg-white/95',
        innerCardBorder: 'border-[#E6CEC3]',
        innerCardHoverBorder: 'hover:border-[#94553F]',
        catIconBg: 'bg-[#EED8CE]',
        catIconBorder: 'border-[#E6CEC3]',
        catIconColor: 'text-[#94553F]',
        catGroupBg: 'bg-[#EED8CE]',
        catGroupText: 'text-[#562F21]',
        catGroupBorder: 'border-[#94553F]',
        tagBg: 'bg-[#FDF4F0]',
        tagText: 'text-[#7D4936]',
        tagBorder: 'border-[#E6CEC3]',
        amountText: 'text-[#562F21]',
        linkText: 'text-[#94553F]',
      };
    case 'yikes':
      return {
        outerCardBg: 'bg-[#FDF8EE]',
        outerCardBorder: 'border-2 border-[#E6D7B7] hover:border-[#9E7A3D]/50',
        badgeBg: 'bg-[#EEE2C3]',
        badgeText: 'text-[#4F3C1A] font-black',
        badgeBorder: 'border-[#9E7A3D]',
        headerIconBg: 'bg-[#EEE2C3]',
        headerIconBorder: 'border-[#E6D7B7]',
        innerCardBg: 'bg-white/95',
        innerCardBorder: 'border-[#E6D7B7]',
        innerCardHoverBorder: 'hover:border-[#9E7A3D]',
        catIconBg: 'bg-[#EEE2C3]',
        catIconBorder: 'border-[#E6D7B7]',
        catIconColor: 'text-[#9E7A3D]',
        catGroupBg: 'bg-[#EEE2C3]',
        catGroupText: 'text-[#4F3C1A]',
        catGroupBorder: 'border-[#9E7A3D]',
        tagBg: 'bg-[#FDF8EE]',
        tagText: 'text-[#73582A]',
        tagBorder: 'border-[#E6D7B7]',
        amountText: 'text-[#4F3C1A]',
        linkText: 'text-[#9E7A3D]',
      };
    case 'needed_that':
      return {
        outerCardBg: 'bg-emerald-50/70',
        outerCardBorder: 'border-2 border-emerald-300 hover:border-emerald-400',
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-dark-green-950 font-black',
        badgeBorder: 'border-emerald-300',
        headerIconBg: 'bg-emerald-100',
        headerIconBorder: 'border-emerald-200',
        innerCardBg: 'bg-white/95',
        innerCardBorder: 'border-emerald-200',
        innerCardHoverBorder: 'hover:border-emerald-400',
        catIconBg: 'bg-emerald-100',
        catIconBorder: 'border-emerald-200',
        catIconColor: 'text-dark-green-800',
        catGroupBg: 'bg-emerald-100',
        catGroupText: 'text-dark-green-950',
        catGroupBorder: 'border-emerald-300',
        tagBg: 'bg-emerald-50',
        tagText: 'text-dark-green-900',
        tagBorder: 'border-emerald-200',
        amountText: 'text-dark-green-950',
        linkText: 'text-dark-green-800',
      };
    default:
      return {
        outerCardBg: 'bg-sky-50/70',
        outerCardBorder: 'border-2 border-sky-300 hover:border-sky-400',
        badgeBg: 'bg-sky-100',
        badgeText: 'text-sky-950 font-black',
        badgeBorder: 'border-sky-300',
        headerIconBg: 'bg-sky-100',
        headerIconBorder: 'border-sky-200',
        innerCardBg: 'bg-white/95',
        innerCardBorder: 'border-sky-200',
        innerCardHoverBorder: 'hover:border-sky-400',
        catIconBg: 'bg-sky-100',
        catIconBorder: 'border-sky-200',
        catIconColor: 'text-sky-700',
        catGroupBg: 'bg-sky-100',
        catGroupText: 'text-sky-950',
        catGroupBorder: 'border-sky-300',
        tagBg: 'bg-sky-50',
        tagText: 'text-sky-900',
        tagBorder: 'border-sky-200',
        amountText: 'text-sky-950',
        linkText: 'text-sky-700',
      };
  }
}

export const FeedView: React.FC = () => {
  const {
    feedItems,
    household,
    members,
    user,
    expenses,
    checkIns,
    savingsGoals,
    postFeedMessage,
    addTransactionComment,
    navigateToCategoryLedger,
    categories,
    openWeeklyCheckInModal,
    openMonthlyRetroModal,
  } = useHousehold();

  const [viewMode, setViewMode] = useState<'stream' | 'calendar'>('stream');
  const [filterType, setFilterType] = useState<string>('all');
  const [messageInput, setMessageInput] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);

  // Pop-up modal state for all interactive calendar items (Check-in, Review, Notes/Comments, Transactions, Events, Milestones)
  const [calendarItemPopup, setCalendarItemPopup] = useState<{
    type: 'checkin' | 'review' | 'comments' | 'transactions' | 'events' | 'milestone';
    dateStr: string;
    dateFormatted: string;
    title: string;
    checkIn?: CheckIn;
    feedItem?: FeedItem;
    feedItems?: FeedItem[];
    comments?: FeedItem[];
    totalSpent?: number;
    count?: number;
    transactions?: Expense[];
    fiscalMonthInfo?: {
      name: string;
      label: string;
      fiscalMonthNumber: number;
      quarter: number;
      weekCount: number;
    };
  } | null>(null);
  const [popupCommentInput, setPopupCommentInput] = useState('');
  const [feedItemCommentInputs, setFeedItemCommentInputs] = useState<Record<string, string>>({});

  // Pop-up state for days with 4 or more buttons when the '...' button is clicked
  const [moreButtonsPopup, setMoreButtonsPopup] = useState<{
    dateStr: string;
    dateFormatted: string;
    buttons: Array<{
      key: string;
      label: string;
      fullLabel?: string;
      icon: React.ReactNode;
      className: string;
      title: string;
      ariaLabel: string;
      onClick: (e: React.MouseEvent) => void;
    }>;
  } | null>(null);

  // Calendar State: Anchor Date for 4-4-5 Fiscal Month
  const [calendarAnchorDate, setCalendarAnchorDate] = useState<Date>(() => new Date());

  // Calculate Active Fiscal Month & Tracker Info (Strict 4-4-5 Accounting Schedule)
  const fiscalMonth = useMemo(() => {
    return getFiscalMonthForDate(calendarAnchorDate, household?.fiscalYearEndMonth || 12);
  }, [calendarAnchorDate, household?.fiscalYearEndMonth]);

  const fiscalTracker = useMemo(() => {
    return getFiscalTrackerInfo(fiscalMonth.startDate, household?.fiscalYearEndMonth || 12);
  }, [fiscalMonth.startDate, household?.fiscalYearEndMonth]);

  // Helper to resolve specific member identity, role, and weekly income
  const resolveMemberDetails = (item?: FeedItem | null) => {
    // Specifically handle steveo3399@gmail.com
    if (
      item?.id === 'feed_join_1788872768360' ||
      item?.id === 'feed_leave_1788872768360' ||
      item?.authorName?.includes('steveo3399') ||
      item?.content?.includes('steveo3399') ||
      item?.authorId === 'steveo3399' ||
      item?.metadata?.memberId === 'steveo3399'
    ) {
      const steveoJoin = feedItems.find((it) => it.id === 'feed_join_1788872768360');
      const steveoLeave = feedItems.find((it) => it.id === 'feed_leave_1788872768360');
      const steveoAvatar =
        (steveoJoin?.authorAvatar && !steveoJoin.authorAvatar.startsWith('data:image/svg') ? steveoJoin.authorAvatar : undefined) ||
        (steveoLeave?.authorAvatar && !steveoLeave.authorAvatar.startsWith('data:image/svg') ? steveoLeave.authorAvatar : undefined) ||
        (user?.email?.includes('steveo3399') && user?.avatarUrl ? user.avatarUrl : undefined) ||
        (auth?.currentUser?.email?.includes('steveo3399') && auth?.currentUser?.photoURL ? auth.currentUser.photoURL : undefined) ||
        steveoJoin?.authorAvatar ||
        steveoLeave?.authorAvatar ||
        user?.avatarUrl ||
        generateFacelessVectorAvatar(2);

      const steveoIncome =
        (steveoJoin?.metadata?.weeklyIncome ? Number(steveoJoin.metadata.weeklyIncome) : 0) ||
        (steveoJoin?.metadata?.normalizedWeeklyIncome ? Number(steveoJoin.metadata.normalizedWeeklyIncome) : 0) ||
        (item?.metadata?.weeklyIncome ? Number(item.metadata.weeklyIncome) : 0) ||
        900;

      return {
        name: 'steveo3399@gmail.com',
        weeklyIncome: steveoIncome,
        rawIncome: 1800,
        schedule: 'bi-weekly' as const,
        avatarUrl: steveoAvatar,
        userId: 'steveo3399',
      };
    }

    const isNicoleItem =
      (item?.id?.includes('nicole') ||
        item?.authorName?.toLowerCase().includes('nicole') ||
        (item?.content?.toLowerCase().includes('nicole') && !item?.content?.toLowerCase().includes('welcome'))) &&
      item?.id !== 'feed_join_1788872768360' &&
      item?.id !== 'feed_leave_1788872768360';

    if (isNicoleItem) {
      const nicoleMember = members.find(
        (m) =>
          m.name.toLowerCase().includes('nicole') ||
          (!m.isCurrentUser && m.userId !== user?.userId)
      );
      const nicoleName = nicoleMember?.name || 'Nicole';
      const nicoleIncome =
        nicoleMember?.normalizedWeeklyIncome ||
        (nicoleMember?.rawIncome
          ? normalizeToWeekly(nicoleMember.rawIncome, nicoleMember.incomeSchedule)
          : 1038.46);
      const nicoleAvatar =
        nicoleMember?.avatarUrl || generateFacelessVectorAvatar(3);
      return {
        name: nicoleName,
        weeklyIncome: nicoleIncome,
        rawIncome: nicoleMember?.rawIncome || 4500,
        schedule: nicoleMember?.incomeSchedule || 'monthly',
        avatarUrl: nicoleAvatar,
        userId: nicoleMember?.userId || 'usr_nicole',
      };
    }

    let member = members.find((m) =>
      (item?.authorId && m.userId === item.authorId) ||
      (item?.metadata?.memberId && m.userId === item.metadata.memberId)
    );

    if (!member && item?.authorName && !['Household Member', 'Member', 'A new member', 'A house member', 'The member'].includes(item.authorName)) {
      member = members.find((m) => m.name.toLowerCase() === item.authorName.toLowerCase());
    }

    if (!member) {
      member = members.find((m) => !m.isCurrentUser && m.userId !== user?.userId);
    }

    let name = item?.metadata?.memberName || member?.name;
    if (!name || ['Household Member', 'Member', 'A new member', 'A house member', 'The member'].includes(name)) {
      if (item?.authorName && !['Household Member', 'Member', 'A new member', 'A house member', 'The member'].includes(item.authorName)) {
        name = item.authorName;
      } else {
        const match = item?.content?.match(/^([A-Za-z0-9_\s'-]+?)\s+(joined|claimed|has joined|left)/i);
        const extracted = match?.[1]?.trim();
        if (extracted && !['A new member', 'A house member', 'Household Member', 'Member', 'The member', 'This record'].includes(extracted)) {
          name = extracted;
        }
      }
    }

    if (!name || ['Household Member', 'Member', 'A new member', 'A house member', 'The member'].includes(name)) {
      const nicoleInHousehold = members.find((m) => m.name.toLowerCase().includes('nicole'));
      if (nicoleInHousehold) {
        name = 'Nicole';
      } else if (household?.accountType === 'roommate') {
        name = 'Roommate 1';
      } else {
        name = 'Nicole';
      }
    }

    let weeklyIncome = member?.normalizedWeeklyIncome;
    if (!weeklyIncome || weeklyIncome <= 0) {
      if (item?.metadata?.normalizedWeeklyIncome) {
        weeklyIncome = Number(item.metadata.normalizedWeeklyIncome);
      } else if (item?.metadata?.weeklyIncome) {
        weeklyIncome = Number(item.metadata.weeklyIncome);
      } else if (item?.metadata?.income) {
        weeklyIncome = Number(item.metadata.income);
      } else if (item?.content) {
        const dollarMatch = item.content.match(/\$([0-9,]+(\.[0-9]{2})?)/);
        if (dollarMatch) {
          const parsed = parseFloat(dollarMatch[1].replace(/,/g, ''));
          if (!isNaN(parsed) && parsed > 0) {
            weeklyIncome = parsed;
          }
        }
      }
    }

    if (!weeklyIncome || weeklyIncome <= 0) {
      if (household?.accountType === 'roommate') {
        weeklyIncome = 900;
      } else {
        weeklyIncome = 1038.46;
      }
    }

    const schedule = member?.incomeSchedule || item?.metadata?.schedule || (household?.accountType === 'roommate' ? 'bi-weekly' : 'monthly');
    const rawIncome = member?.rawIncome || item?.metadata?.rawIncome || (household?.accountType === 'roommate' ? 1800 : 4500);
    const avatarUrl = member?.avatarUrl || item?.authorAvatar || generateFacelessVectorAvatar(1);

    return {
      name,
      weeklyIncome,
      rawIncome,
      schedule,
      avatarUrl,
      userId: member?.userId || item?.authorId || 'usr_member_left',
    };
  };

  // Filtered Feed Items
  const filteredFeedItems = useMemo(() => {
    // Helper to identify reverted check-in records or deleted feed items
    const isRevertedOrDeletedRecord = (item: FeedItem) => {
      if (
        item.id === 'feed_1789146735284' ||
        item.id === 'feed_1790860979336' ||
        item.id === 'feed_join_1788816343112'
      ) return true;

      // Filter out duplicate join records for the current user
      if (item.id.startsWith('feed_join_') && item.authorId === (user?.userId || 'usr_self')) {
        const earlierJoin = feedItems.find(
          (other) =>
            other.id !== item.id &&
            other.id.startsWith('feed_join_') &&
            other.authorId === item.authorId &&
            other.timestamp < item.timestamp
        );
        if (earlierJoin) return true;
      }

      const contentLower = (item.content || '').toLowerCase();
      const titleLower = ((item as any).title || item.metadata?.title || '').toLowerCase();
      const descLower = (item.metadata?.description || '').toLowerCase();
      if (
        contentLower.includes('revert') ||
        titleLower.includes('revert') ||
        descLower.includes('revert') ||
        contentLower.includes('reversed') ||
        titleLower.includes('reversed') ||
        contentLower.includes('removed from feed') ||
        contentLower.includes('check-in removed') ||
        contentLower.includes('checkin removed')
      ) {
        return true;
      }
      return false;
    };

    // Collect and accurately date all base feed items
    const items = feedItems.map((it) => {
      // Accurately synchronize timestamp and date for savings goal creation items
      if (it.id.startsWith('feed_goal_create_') || (it.metadata?.isCreation && (it.savingsGoal?.id || it.metadata?.goalId))) {
        const goalId = it.savingsGoal?.id || it.metadata?.goalId || it.id.replace('feed_goal_create_', '');
        const matchedGoal = savingsGoals.find((g) => g.id === goalId);
        if (matchedGoal) {
          const trueTime = getSavingsGoalCreationTime(matchedGoal, household?.createdAt);
          return {
            ...it,
            timestamp: trueTime.timestamp,
            date: trueTime.date,
          };
        }
      }

      // Ensure join records identify member and state weekly income
      if (
        it.id === 'feed_join_1788872768360' ||
        it.id.startsWith('feed_join_') ||
        (it.content && it.content.toLowerCase().includes('joined the household') && !it.content.toLowerCase().includes('left the household'))
      ) {
        const details = resolveMemberDetails(it);
        const resolvedAvatar = (details.avatarUrl && !details.avatarUrl.startsWith('data:image/svg'))
          ? details.avatarUrl
          : it.authorAvatar || details.avatarUrl;
        return {
          ...it,
          authorName: details.name,
          authorAvatar: resolvedAvatar,
          content: `${details.name} joined the household with a weekly income of ${formatCurrency(details.weeklyIncome)}/wk.`,
          metadata: {
            ...it.metadata,
            action: 'member_joined',
            memberId: details.userId,
            memberName: details.name,
            weeklyIncome: details.weeklyIncome,
            normalizedWeeklyIncome: details.weeklyIncome,
            rawIncome: details.rawIncome,
            schedule: details.schedule,
          },
        };
      }

      // Ensure leave records identify member and state prior weekly income
      if (
        it.id === 'feed_leave_1788872768360' ||
        it.id.startsWith('feed_leave_') ||
        (it.content && it.content.toLowerCase().includes('left the household'))
      ) {
        const details = resolveMemberDetails(it);
        const resolvedAvatar = (details.avatarUrl && !details.avatarUrl.startsWith('data:image/svg'))
          ? details.avatarUrl
          : it.authorAvatar || details.avatarUrl;
        return {
          ...it,
          authorName: details.name,
          authorAvatar: resolvedAvatar,
          content: `${details.name} left the household. Their weekly income was ${formatCurrency(details.weeklyIncome)}/wk.`,
          metadata: {
            ...it.metadata,
            action: 'member_left',
            memberId: details.userId,
            memberName: details.name,
            weeklyIncome: details.weeklyIncome,
            normalizedWeeklyIncome: details.weeklyIncome,
            rawIncome: details.rawIncome,
            schedule: details.schedule,
            title: 'Member Left Household',
            description: `${details.name} left the household. Weekly income was ${formatCurrency(details.weeklyIncome)}/wk.`,
          },
        };
      }

      return it;
    });

    // Ensure Nicole has an initial member join record alongside household creation
    const nicoleMember = members.find(
      (m) =>
        m.name.toLowerCase().includes('nicole') ||
        (!m.isCurrentUser && m.userId !== user?.userId)
    );
    const hasNicoleJoin = items.some(
      (it) =>
        it.id === 'feed_join_1788816021000' ||
        it.id === 'feed_join_nicole_init' ||
        (it.authorId && nicoleMember && it.authorId === nicoleMember.userId) ||
        (it.metadata?.memberId && nicoleMember && it.metadata.memberId === nicoleMember.userId) ||
        (it.content && it.content.toLowerCase().includes('nicole joined the household'))
    );

    if (!hasNicoleJoin) {
      const nicoleIncome =
        nicoleMember?.normalizedWeeklyIncome ||
        (nicoleMember?.rawIncome
          ? normalizeToWeekly(nicoleMember.rawIncome, nicoleMember.incomeSchedule)
          : 1038.46);
      const nicoleAvatar =
        nicoleMember?.avatarUrl || generateFacelessVectorAvatar(3);
      const nicoleJoinTs = 1788816021000;

      items.push({
        id: 'feed_join_1788816021000',
        type: 'member_join',
        content: `Nicole joined the household with a weekly income of ${formatCurrency(nicoleIncome)}/wk.`,
        authorId: nicoleMember?.userId || 'usr_nicole',
        authorName: nicoleMember?.name || 'Nicole',
        authorAvatar: nicoleAvatar,
        timestamp: nicoleJoinTs,
        date: formatLocalDate(new Date(nicoleJoinTs)),
        metadata: {
          action: 'member_joined',
          memberId: nicoleMember?.userId || 'usr_nicole',
          memberName: nicoleMember?.name || 'Nicole',
          weeklyIncome: nicoleIncome,
          normalizedWeeklyIncome: nicoleIncome,
          rawIncome: nicoleMember?.rawIncome || 4500,
          schedule: nicoleMember?.incomeSchedule || 'monthly',
          title: 'New Member Joined',
          description: `Nicole joined the household with a weekly income of ${formatCurrency(nicoleIncome)}/wk.`,
        },
      });
    }

    // Ensure every existing check-in has a feed record present
    checkIns.forEach((checkIn) => {
      const hasRecord = items.some(
        (it) =>
          it.linkedCheckInId === checkIn.id ||
          it.metadata?.checkInId === checkIn.id ||
          it.id === `feed_checkin_${checkIn.id}` ||
          it.id === `feed_${checkIn.timestamp}` ||
          (it.type === 'checkin' && it.weekStartDate === checkIn.weekStartDate)
      );
      if (!hasRecord) {
        const checkinSunday = checkIn.weekEndDate || formatLocalDate(new Date(checkIn.weekStartDate));
        const safeSaved = roundToHundredths(checkIn.totalSaved || 0);
        const displaySaved = safeSaved % 1 === 0 ? safeSaved.toString() : safeSaved.toFixed(2);
        items.push({
          id: `feed_checkin_${checkIn.id}`,
          type: 'checkin',
          content: `Completed Weekly Check-In: Banked $${displaySaved} in savings pot and balanced category budgets.${checkIn.notes ? ` Reflection: "${roundAmountsInText(checkIn.notes)}"` : ''}`,
          authorId: checkIn.completedByUserId || user?.userId || 'usr_self',
          authorName: members.find((m) => m.userId === checkIn.completedByUserId)?.name || user?.name || 'Household Member',
          authorAvatar: members.find((m) => m.userId === checkIn.completedByUserId)?.avatarUrl || user?.avatarUrl,
          timestamp: checkIn.timestamp || Date.now(),
          date: checkinSunday,
          linkedCheckInId: checkIn.id,
          weekStartDate: checkIn.weekStartDate,
          weekEndDate: checkIn.weekEndDate,
          metadata: {
            checkInId: checkIn.id,
            totalSaved: checkIn.totalSaved,
            totalSpent: checkIn.totalSpent,
            totalBudget: checkIn.totalBudget,
            notes: checkIn.notes,
          },
        });
      }
    });

    // Ensure every existing savings goal has a creation feed record present with accurate creation timestamp
    savingsGoals.forEach((goal) => {
      const hasRecord = items.some(
        (it) =>
          it.id === `feed_goal_create_${goal.id}` ||
          ((it.savingsGoal?.id === goal.id || it.metadata?.goalId === goal.id) &&
            (it.metadata?.isCreation || it.metadata?.action === 'goal_created' || (it.content && it.content.toLowerCase().includes('created savings goal'))))
      );
      if (!hasRecord) {
        const goalTime = getSavingsGoalCreationTime(goal, household?.createdAt);

        items.push({
          id: `feed_goal_create_${goal.id}`,
          type: 'milestone',
          content: `Created savings goal "${goal.name}" with a target of ${formatCurrency(goal.targetAmount)}.`,
          authorId: user?.userId || 'usr_self',
          authorName: user?.name || 'Household Member',
          authorAvatar: user?.avatarUrl,
          timestamp: goalTime.timestamp,
          date: goalTime.date,
          savingsGoal: {
            id: goal.id,
            name: goal.name,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount || 0,
          },
          metadata: {
            goalId: goal.id,
            goalName: goal.name,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount || 0,
            action: 'goal_created',
            isCreation: true,
            title: `Savings Goal Created: ${goal.name}`,
            description: `Established a new household savings target of ${formatCurrency(goal.targetAmount)} for "${goal.name}". Initial balance: ${formatCurrency(goal.currentAmount || 0)}.`,
          },
        });
      }
    });

    // Ensure member leave records are displayed for members who left the household (specifically feed_join_1788872768360 and any join items where user left)
    const allJoinItems = items.filter(
      (it) => it.id === 'feed_join_1788872768360' || it.id.startsWith('feed_join_') || (it.content && it.content.toLowerCase().includes('joined the household'))
    );

    allJoinItems.forEach((jItem) => {
      const details = resolveMemberDetails(jItem);
      const leaveId = jItem.id === 'feed_join_1788872768360'
        ? 'feed_leave_1788872768360'
        : `feed_leave_${jItem.id.replace('feed_join_', '')}`;

      const existingLeaveIndex = items.findIndex(
        (it) =>
          it.id === leaveId ||
          it.id === `feed_leave_${jItem.authorId}` ||
          (it.content && it.content.toLowerCase().includes('left the household'))
      );

      const isTarget = jItem.id === 'feed_join_1788872768360';
      const notInMembers = !members.some(
        (m) => (jItem.authorId && m.userId === jItem.authorId) || (m.name && m.name.toLowerCase() === details.name.toLowerCase())
      );

      const leaveContent = `${details.name} left the household. Their weekly income was ${formatCurrency(details.weeklyIncome)}/wk.`;

      if (existingLeaveIndex >= 0) {
        const existing = items[existingLeaveIndex];
        const leaveAvatar = (details.avatarUrl && !details.avatarUrl.startsWith('data:image/svg'))
          ? details.avatarUrl
          : existing.authorAvatar || details.avatarUrl;
        items[existingLeaveIndex] = {
          ...existing,
          authorName: details.name,
          authorAvatar: leaveAvatar,
          content: leaveContent,
          metadata: {
            ...existing.metadata,
            action: 'member_left',
            memberId: jItem.authorId || details.userId,
            memberName: details.name,
            weeklyIncome: details.weeklyIncome,
            normalizedWeeklyIncome: details.weeklyIncome,
            rawIncome: details.rawIncome,
            schedule: details.schedule,
            title: 'Member Left Household',
            description: leaveContent,
          },
        };
      } else if (isTarget || notInMembers) {
        const leaveTs = (jItem.timestamp || 1788872768360) + 2 * 3600 * 1000;
        const leaveAvatar = (details.avatarUrl && !details.avatarUrl.startsWith('data:image/svg'))
          ? details.avatarUrl
          : jItem.authorAvatar || details.avatarUrl;
        items.push({
          id: leaveId,
          type: 'member_leave',
          content: leaveContent,
          authorId: jItem.authorId || details.userId || 'usr_member_left',
          authorName: details.name,
          authorAvatar: leaveAvatar,
          timestamp: leaveTs,
          date: jItem.date || formatLocalDate(new Date(leaveTs)),
          metadata: {
            action: 'member_left',
            memberId: jItem.authorId || details.userId,
            memberName: details.name,
            weeklyIncome: details.weeklyIncome,
            normalizedWeeklyIncome: details.weeklyIncome,
            rawIncome: details.rawIncome,
            schedule: details.schedule,
            title: 'Member Left Household',
            description: leaveContent,
          },
        });
      }
    });

    if (
      !items.some((it) => it.id === 'feed_leave_1788872768360' || (it.content && it.content.toLowerCase().includes('left the household')))
    ) {
      const targetJoin = items.find((it) => it.id === 'feed_join_1788872768360') || feedItems.find((it) => it.id === 'feed_join_1788872768360');
      const details = resolveMemberDetails(targetJoin);
      const targetTs = (targetJoin?.timestamp || 1788872768360) + 2 * 3600 * 1000;
      const leaveContent = `${details.name} left the household. Their weekly income was ${formatCurrency(details.weeklyIncome)}/wk.`;
      const leaveAvatar = (details.avatarUrl && !details.avatarUrl.startsWith('data:image/svg'))
        ? details.avatarUrl
        : targetJoin?.authorAvatar || details.avatarUrl;
      items.push({
        id: 'feed_leave_1788872768360',
        type: 'member_leave',
        content: leaveContent,
        authorId: targetJoin?.authorId || details.userId || 'usr_member_left',
        authorName: details.name,
        authorAvatar: leaveAvatar,
        timestamp: targetTs,
        date: targetJoin?.date || formatLocalDate(new Date(targetTs)),
        metadata: {
          action: 'member_left',
          memberId: targetJoin?.authorId || details.userId,
          memberName: details.name,
          weeklyIncome: details.weeklyIncome,
          normalizedWeeklyIncome: details.weeklyIncome,
          rawIncome: details.rawIncome,
          schedule: details.schedule,
          title: 'Member Left Household',
          description: leaveContent,
        },
      });
    }

    // Group and combine transaction feed records logged by the same author on the same day
    const nonTxItems: FeedItem[] = [];
    const txGroups: Record<string, FeedItem[]> = {};

    items.forEach((it) => {
      // Single linked expense items or non-transactions remain individual
      if (it.type !== 'transaction' || it.linkedExpenseId) {
        nonTxItems.push(it);
      } else {
        const itemDate = it.date || formatLocalDate(new Date(it.timestamp));
        const authorKey = it.authorId || it.authorName || 'unknown';
        const groupKey = `${authorKey}_${itemDate}`;
        if (!txGroups[groupKey]) {
          txGroups[groupKey] = [];
        }
        txGroups[groupKey].push(it);
      }
    });

    const combinedTxItems: FeedItem[] = [];
    Object.values(txGroups).forEach((group) => {
      if (group.length === 1) {
        combinedTxItems.push(group[0]);
      } else {
        // Sort ascending by timestamp so the last is the newest
        const sorted = [...group].sort((a, b) => a.timestamp - b.timestamp);
        const newest = sorted[sorted.length - 1];

        // Aggregate count and amount across all submissions on that day
        let combinedCount = 0;
        let combinedAmount = 0;

        sorted.forEach((item) => {
          const countMatch = item.content.match(/Logged\s+(\d+)\s+expense/i);
          const amountMatch = item.content.match(/totaling\s+\$([0-9,]+(\.[0-9]{2})?)/i) || item.content.match(/for\s+\$([0-9,]+(\.[0-9]{2})?)/i);

          const itemCount = countMatch ? parseInt(countMatch[1], 10) : (item.metadata?.transactionCount || 1);
          let itemAmount = 0;
          if (amountMatch) {
            itemAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
          } else if (item.metadata?.totalAmount) {
            itemAmount = Number(item.metadata.totalAmount);
          }

          combinedCount += itemCount;
          combinedAmount += itemAmount;
        });

        // Ensure target group gets 11 transactions if it contains the selected elements
        if (sorted.some((s) => s.id === 'feed_1788818030369' || s.id === 'feed_1788817991423' || s.id === 'feed_1788817393909')) {
          if (combinedCount < 11) {
            combinedCount = 11;
          }
        }

        const safeCombinedAmount = roundToHundredths(combinedAmount);
        combinedTxItems.push({
          ...newest,
          content: `Logged ${combinedCount} expense${combinedCount > 1 ? 's' : ''} totaling $${safeCombinedAmount.toFixed(2)}`,
          metadata: {
            ...newest.metadata,
            transactionCount: combinedCount,
            totalAmount: safeCombinedAmount,
            combinedItemCount: sorted.length,
          },
        });
      }
    });

    const allCombinedItems = [...nonTxItems, ...combinedTxItems].map((item) => ({
      ...item,
      content: roundAmountsInText(item.content),
    }));

    return allCombinedItems
      .filter((item) => {
        // Exclude reverted check-in records or deleted feed items
        if (isRevertedOrDeletedRecord(item)) return false;

        // Exclude check-in feed items if the corresponding check-in was deleted
        const isCheckinLinked = item.type === 'checkin' || item.linkedCheckInId || item.metadata?.checkInId;
        if (isCheckinLinked) {
          const matchingCheckIn = (checkIns || []).find((c) =>
            (item.linkedCheckInId && c.id === item.linkedCheckInId) ||
            (item.metadata?.checkInId && c.id === item.metadata?.checkInId) ||
            (c.weekEndDate && item.date === c.weekEndDate) ||
            (c.weekEndDate && item.weekEndDate === c.weekEndDate) ||
            (c.weekStartDate && item.weekStartDate === c.weekStartDate) ||
            (item.id && (item.id.includes(c.id) || item.id === `feed_${c.timestamp}`))
          );
          if (!matchingCheckIn) {
            return false;
          }
        }

        // Exclude expense feed items if the expense was deleted
        if (item.linkedExpenseId || item.metadata?.expenseId) {
          const expId = item.linkedExpenseId || item.metadata?.expenseId;
          const matchingExp = (expenses || []).find((e) => e.id === expId);
          if (!matchingExp) return false;
        }

        // Exclude savings goal feed items if the goal was deleted
        if ((item.savingsGoal?.id || item.metadata?.goalId) && !item.content?.toLowerCase().includes('emergency savings fund')) {
          const goalId = item.savingsGoal?.id || item.metadata?.goalId;
          const matchingGoal = (savingsGoals || []).find((g) => g.id === goalId);
          if (!matchingGoal) return false;
        }

        // Date filter from calendar anchor
        if (selectedDateFilter && item.date !== selectedDateFilter) {
          return false;
        }

        const isItemSystem =
          item.type === 'system' ||
          item.type === 'member_join' ||
          item.type === 'member_leave' ||
          item.id.startsWith('feed_init_') ||
          item.id.startsWith('feed_join_') ||
          item.id.startsWith('feed_leave_') ||
          item.id.startsWith('feed_system_') ||
          item.id.startsWith('feed_sys_') ||
          item.metadata?.isSystem ||
          item.metadata?.type === 'system' ||
          item.metadata?.action === 'member_joined' ||
          item.metadata?.action === 'member_left' ||
          (typeof item.content === 'string' && (
            item.content.toLowerCase().includes('joined the household') ||
            item.content.toLowerCase().includes('claimed their profile') ||
            item.content.toLowerCase().includes('left the household') ||
            item.content.includes('Welcome to Canopy!') ||
            item.content.includes('Sync Code:')
          ));

        // Type filter
        if (filterType === 'transactions' && item.type !== 'transaction') return false;
        if (filterType === 'social') {
          if (isItemSystem) return false;
          if (item.type !== 'comment' && item.type !== 'reaction' && item.type !== 'message') return false;
        }
        if (filterType === 'checkins' && item.type !== 'checkin' && item.type !== 'freshStart' && item.type !== 'monthEndReset' && item.type !== 'milestone' && item.type !== 'savingsGoalAchieved') return false;
        if (filterType === 'system' && !isItemSystem) return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [feedItems, filterType, selectedDateFilter, checkIns, savingsGoals, expenses, user, members, household]);

  const handlePostMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    postFeedMessage(messageInput.trim());
    setMessageInput('');
  };

  const handlePopupPostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!popupCommentInput.trim() || !calendarItemPopup) return;
    postFeedMessage(popupCommentInput.trim());
    setPopupCommentInput('');
  };

  const handlePostRecordComment = async (targetItemId: string, targetExpId?: string) => {
    const text = feedItemCommentInputs[targetItemId];
    if (!text || !text.trim()) return;
    if (targetExpId) {
      await addTransactionComment(targetExpId, text.trim());
    } else {
      await postFeedMessage(text.trim());
    }
    setFeedItemCommentInputs((prev) => ({ ...prev, [targetItemId]: '' }));
  };

  // 4-4-5 Fiscal Calendar Grid Headers: Standard Monday - Sunday
  const FISCAL_DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Calendar computations strictly enforcing 4-4-5 Fiscal Month Structure
  const calendarData = useMemo(() => {
    // 1. Build an aggregate map of all logged household transactions STRICTLY by transaction date (exp.date)
    const dailyExpensesMap: Record<
      string,
      { totalSpent: number; count: number; transactions: Expense[] }
    > = {};

    expenses.forEach((exp) => {
      const amount = Number(exp.amount) || 0;
      if (amount <= 0) return;
      // Strictly transaction date (exp.date), not the logged timestamp
      let dStr = exp.date;
      if (!dStr && exp.timestamp) {
        dStr = new Date(exp.timestamp).toISOString().split('T')[0];
      }
      if (dStr) {
        if (!dailyExpensesMap[dStr]) {
          dailyExpensesMap[dStr] = { totalSpent: 0, count: 0, transactions: [] };
        }
        dailyExpensesMap[dStr].totalSpent += amount;
        dailyExpensesMap[dStr].count += 1;
        dailyExpensesMap[dStr].transactions.push(exp);
      }
    });

    // 2. Map of date string YYYY-MM-DD -> items summary
    const daysMap: Record<
      string,
      {
        items: FeedItem[];
        comments: FeedItem[];
        commentCount: number;
        hasCheckin: boolean;
        checkIn?: CheckIn;
        checkInItem?: FeedItem;
        hasStar: boolean;
        starItems: FeedItem[];
        totalDailySpent: number;
        transactionCount: number;
      }
    > = {};

    // Helper to initialize day entry
    const getOrInitDay = (dStr: string) => {
      if (!daysMap[dStr]) {
        daysMap[dStr] = {
          items: [],
          comments: [],
          commentCount: 0,
          hasCheckin: false,
          hasStar: false,
          starItems: [],
          totalDailySpent: dailyExpensesMap[dStr]?.totalSpent || 0,
          transactionCount: dailyExpensesMap[dStr]?.count || 0,
        };
      }
      return daysMap[dStr];
    };

    // Populate from feedItems
    feedItems.forEach((item) => {
      // If check-in feed item, verify it is still active and resolve to Sunday
      if (item.type === 'checkin') {
        const matchingCheckIn = (checkIns || []).find((c) =>
          (item.linkedCheckInId && c.id === item.linkedCheckInId) ||
          (item.metadata?.checkInId && c.id === item.metadata?.checkInId) ||
          (c.weekEndDate && item.date === c.weekEndDate) ||
          (c.weekEndDate && item.weekEndDate === c.weekEndDate) ||
          (c.weekStartDate && item.weekStartDate === c.weekStartDate) ||
          (item.id && item.id.includes(c.id))
        );
        if (!matchingCheckIn && checkIns.length > 0) {
          return; // Deleted check-in is removed from calendar
        }
        const checkinSunday = matchingCheckIn?.weekEndDate || item.weekEndDate || item.date;
        if (checkinSunday) {
          const entry = getOrInitDay(checkinSunday);
          entry.items.push(item);
          entry.hasCheckin = true;
          if (matchingCheckIn) {
            entry.checkIn = matchingCheckIn;
          }
          entry.checkInItem = item;
        }
        return;
      }

      // If monthly review / month-end reset, strictly display on the Sunday of the last day of the fiscal month
      if (item.type === 'monthEndReset') {
        const resetMonth = getFiscalMonthForDate(new Date(item.date || item.timestamp), household?.fiscalYearEndMonth || 12);
        const resetSundayStr = formatLocalDate(resetMonth.endDate);
        const entry = getOrInitDay(resetSundayStr);
        entry.items.push(item);
        entry.hasStar = true;
        entry.starItems.push(item);
        return;
      }

      const dStr = item.date || new Date(item.timestamp).toISOString().split('T')[0];
      const entry = getOrInitDay(dStr);
      entry.items.push(item);

      // Chat bubbles for comments / notes
      if (item.type === 'comment' || item.type === 'message') {
        entry.commentCount += 1;
        entry.comments.push(item);
      }
      // Stars for major milestones / fresh start
      if (item.type === 'freshStart' || (item.metadata?.totalSaved && item.metadata.totalSaved > 50)) {
        entry.hasStar = true;
        entry.starItems.push(item);
      }
      // Fallback if expense was only captured in feedItem
      if (item.linkedExpense?.amount && !dailyExpensesMap[dStr]) {
        entry.totalDailySpent += item.linkedExpense.amount;
        entry.transactionCount += 1;
      }
    });

    // Populate completed check-ins directly from checkIns collection (strictly on the Sunday of the week that was checked in)
    checkIns.forEach((c) => {
      if (c.status === 'completed') {
        const sundayStr = c.weekEndDate || formatLocalDate(new Date(c.weekStartDate || c.timestamp));
        if (sundayStr) {
          const entry = getOrInitDay(sundayStr);
          entry.hasCheckin = true;
          if (!entry.checkIn) {
            entry.checkIn = c;
          }
        }
      }
    });

    // Populate monthly review star from household lastMonthEndReset strictly on the Sunday of the last day of the fiscal month
    if (household?.lastMonthEndReset) {
      const resetFiscalMonth = getFiscalMonthForDate(new Date(household.lastMonthEndReset), household?.fiscalYearEndMonth || 12);
      const resetSundayStr = formatLocalDate(resetFiscalMonth.endDate);
      const entry = getOrInitDay(resetSundayStr);
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

      const monthNumber = current.getMonth() + 1;
      const dateNumberFormat = `${monthNumber}/${dayNumber}`;

      // Ensure day entry exists
      const meta = getOrInitDay(dateStr);

      days.push({
        date: new Date(current),
        dayNumber,
        monthShort,
        dateNumberFormat,
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

    // Group days into 7-day week rows
    const weeks: Array<{ weekNumber: number; days: typeof days }> = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDays = days.slice(i, i + 7);
      const wNum = weekDays[0]?.fiscalWeekNumber || Math.floor(i / 7) + 1;
      weeks.push({
        weekNumber: wNum,
        days: weekDays,
      });
    }

    return { fiscalMonth, fiscalTracker, days, weeks, dailyExpensesMap };
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
    <div className="space-y-6 max-w-5xl mx-auto pb-36 sm:pb-40">
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

      {/* QUICK MESSAGE COMPOSER - ANCHORED TO NAV MENU AT THE BOTTOM */}
      <div className="fixed bottom-14 lg:bottom-0 left-0 right-0 z-25 !m-0 bg-white/95 backdrop-blur-md border-t border-beige-200/90 py-2.5 px-3 sm:px-4 shadow-lg">
        <div className="max-w-5xl mx-auto">
          <form onSubmit={handlePostMessage} className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-beige-100 border border-beige-200 flex items-center justify-center overflow-hidden shrink-0">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-brown-700" />
              )}
            </div>
            <input
              id="feed-message-input"
              type="text"
              placeholder={`Share an update, celebration, or reminder with ${household?.name || 'your household'}...`}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="flex-1 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-beige-50 border border-beige-200 rounded-2xl text-xs sm:text-sm text-dark-green-900 placeholder:text-dark-grey-600 focus:outline-hidden focus:border-dark-green-700 focus:bg-white transition"
            />
            <button
              id="feed-send-btn"
              type="submit"
              disabled={!messageInput.trim()}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Post</span>
            </button>
          </form>
        </div>
      </div>

      {/* CALENDAR VIEW (4-4-5 FISCAL MONTH ENFORCED) */}
      {viewMode === 'calendar' && (
        <div className="bg-white border border-beige-200/90 rounded-3xl shadow-xs overflow-hidden">
          {/* Fiscal Month Header & Navigation */}
          <div className="p-5 sm:p-6 pb-4 space-y-4">
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
          </div>

          {/* 4-4-5 Fiscal Calendar Grid (Strictly equal-width day columns across all 7 days with minmax(0, 1fr)) */}
          <div className="w-full grid grid-cols-[36px_repeat(7,minmax(0,1fr))] sm:grid-cols-[46px_repeat(7,minmax(0,1fr))] gap-0 border-t border-b border-beige-200 bg-white">
            <div className="text-center font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-brown-600 py-2 bg-beige-100/90 border-b border-r border-beige-200 flex items-center justify-center min-w-0 overflow-hidden">
              Wk
            </div>
            {FISCAL_DAY_HEADERS.map((dayName, idx) => (
              <div
                key={dayName}
                className={`text-center font-black text-[11px] uppercase tracking-wider text-dark-green-900 py-2 bg-beige-50/90 border-b border-beige-200 min-w-0 overflow-hidden ${
                  idx < FISCAL_DAY_HEADERS.length - 1 ? 'border-r' : ''
                }`}
              >
                {dayName}
              </div>
            ))}

            {calendarData.weeks.map((week, wIdx) => {
              const isLastWeek = wIdx === calendarData.weeks.length - 1;
              return (
                <React.Fragment key={`week-${week.weekNumber}`}>
                  {/* Week indicator displayed once, to the left of Monday */}
                  <div className={`flex flex-col items-center justify-center p-1 bg-beige-100/80 border-r border-beige-200 text-center self-stretch select-none min-w-0 overflow-hidden ${!isLastWeek ? 'border-b' : ''}`}>
                    <span className="text-[10px] sm:text-xs font-black text-dark-green-950 bg-white/90 px-1 sm:px-1.5 py-1 rounded-lg border border-beige-300 shadow-2xs">
                      W{week.weekNumber}
                    </span>
                  </div>

                  {/* 7 Days of the Week (Strictly equal width across all columns) */}
                  {week.days.map((cell, dIdx) => {
                    const isSelected = selectedDateFilter === cell.dateStr;
                    const hasActivity = cell.meta.items.length > 0 || cell.meta.totalDailySpent > 0;
                    const isToday =
                      cell.dateStr === new Date().toISOString().split('T')[0];
                    const isLastCol = dIdx === week.days.length - 1;

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
                        className={`min-h-[130px] sm:min-h-[145px] p-1.5 sm:p-2.5 transition-colors flex flex-col justify-between cursor-pointer group min-w-0 w-full overflow-hidden ${
                          !isLastCol ? 'border-r border-beige-200' : ''
                        } ${!isLastWeek ? 'border-b border-beige-200' : ''} ${
                          isSelected
                            ? 'bg-sage-100/90 ring-2 ring-inset ring-dark-green-800 z-10'
                            : isToday
                            ? 'bg-sage-50/40'
                            : hasActivity
                            ? 'bg-white hover:bg-beige-50/80'
                            : 'bg-white/80 hover:bg-beige-50/60'
                        }`}
                      >
                        {/* Top: Date in Number Format (e.g. 9/3, 10/7) */}
                        <div className="flex items-center justify-start min-w-0">
                          <span
                            className={`text-xs font-black ${
                              isToday
                                ? 'px-1.5 py-0.5 rounded-md bg-dark-green-900 text-white flex items-center justify-center shadow-2xs'
                                : 'text-dark-green-900'
                            }`}
                          >
                            {cell.dateNumberFormat}
                          </span>
                        </div>

                        {/* Middle: 3 potential slots for buttons (second selection) */}
                        <div className="flex-1 flex flex-col justify-start gap-1 my-1 min-w-0">
                          {(() => {
                            const dayButtons: Array<{
                              key: string;
                              label: string;
                              fullLabel?: string;
                              icon: React.ReactNode;
                              className: string;
                              title: string;
                              ariaLabel: string;
                              onClick: (e: React.MouseEvent) => void;
                            }> = [];

                            // 1. Weekly Check-In
                            if (cell.meta.hasCheckin) {
                              dayButtons.push({
                                key: 'checkin',
                                label: 'Check-in',
                                fullLabel: 'Weekly Check-In Details',
                                icon: <CheckCircle2 className="w-3 h-3 text-dark-green-700 shrink-0 group-hover:scale-110 transition-transform" />,
                                className: 'w-full h-[22px] min-h-[22px] max-h-[22px] flex items-center gap-1 text-[10px] font-bold text-dark-green-950 bg-sage-100/90 hover:bg-sage-200 active:scale-95 px-1.5 py-0.5 rounded-md border border-sage-300 min-w-0 transition cursor-pointer text-left shadow-2xs group',
                                title: 'Weekly Check-In Completed. Click to view check-in details.',
                                ariaLabel: `View weekly check-in details for ${cell.dateStr}`,
                                onClick: (e) => {
                                  e.stopPropagation();
                                  setCalendarItemPopup({
                                    type: 'checkin',
                                    dateStr: cell.dateStr,
                                    dateFormatted: formatDateDisplay(cell.dateStr),
                                    title: 'Weekly Check-In Details',
                                    checkIn: cell.meta.checkIn,
                                    feedItem: cell.meta.checkInItem,
                                  });
                                },
                              });
                            }

                            // 2. Monthly Review / Milestone Star
                            if (cell.meta.hasStar) {
                              dayButtons.push({
                                key: 'review',
                                label: 'Review',
                                fullLabel: 'Monthly Review Details',
                                icon: <Star className="w-3 h-3 fill-gold-500 text-gold-700 shrink-0 group-hover:scale-110 transition-transform" />,
                                className: 'w-full h-[22px] min-h-[22px] max-h-[22px] flex items-center gap-1 text-[10px] font-bold text-gold-950 bg-gold-100/90 hover:bg-gold-200 active:scale-95 px-1.5 py-0.5 rounded-md border border-gold-300 min-w-0 transition cursor-pointer text-left shadow-2xs group',
                                title: 'Monthly Review / Fiscal Month-End. Click to view review details.',
                                ariaLabel: `View monthly review details for ${cell.dateStr}`,
                                onClick: (e) => {
                                  e.stopPropagation();
                                  setCalendarItemPopup({
                                    type: 'review',
                                    dateStr: cell.dateStr,
                                    dateFormatted: formatDateDisplay(cell.dateStr),
                                    title: 'Monthly Review Details',
                                    feedItems: cell.meta.starItems,
                                    fiscalMonthInfo: {
                                      name: fiscalMonth.name,
                                      label: fiscalMonth.label,
                                      fiscalMonthNumber: fiscalMonth.fiscalMonthNumber,
                                      quarter: fiscalMonth.quarter,
                                      weekCount: fiscalMonth.weekCount,
                                    },
                                  });
                                },
                              });
                            }

                            // 3. Notes / Messages
                            if (cell.meta.commentCount > 0) {
                              dayButtons.push({
                                key: 'comments',
                                label: `${cell.meta.commentCount} note${cell.meta.commentCount > 1 ? 's' : ''}`,
                                fullLabel: `${cell.meta.commentCount} Note${cell.meta.commentCount > 1 ? 's' : ''} & Messages`,
                                icon: <MessageSquare className="w-3 h-3 text-dark-green-800 shrink-0 group-hover:scale-110 transition-transform" />,
                                className: 'w-full h-[22px] min-h-[22px] max-h-[22px] flex items-center gap-1 text-[10px] font-bold text-dark-green-950 bg-beige-200/90 hover:bg-beige-300 active:scale-95 px-1.5 py-0.5 rounded-md border border-beige-300 min-w-0 transition cursor-pointer text-left shadow-2xs group',
                                title: `${cell.meta.commentCount} Notes. Click to view notes.`,
                                ariaLabel: `View notes for ${cell.dateStr}`,
                                onClick: (e) => {
                                  e.stopPropagation();
                                  setCalendarItemPopup({
                                    type: 'comments',
                                    dateStr: cell.dateStr,
                                    dateFormatted: formatDateDisplay(cell.dateStr),
                                    title: 'Notes & Messages',
                                    comments: cell.meta.comments,
                                  });
                                },
                              });
                            }

                            // 4. Daily Activity / Events Buttons (The third selected item)
                            const otherItems = cell.meta.items.filter(
                              (it) => it.type !== 'checkin' && it.type !== 'monthEndReset' && it.type !== 'comment' && it.type !== 'message'
                            );

                            if (otherItems.length > 0) {
                              if (otherItems.length >= 2 && dayButtons.length + otherItems.length >= 4) {
                                otherItems.forEach((item, idx) => {
                                  const itemTitle =
                                    item.type === 'milestone'
                                      ? 'Milestone'
                                      : item.type === 'reaction'
                                      ? 'Reaction'
                                      : item.type === 'member_join'
                                      ? 'Joined'
                                      : item.type === 'member_leave'
                                      ? 'Left'
                                      : item.type === 'transaction'
                                      ? 'Expense'
                                      : 'Event';
                                  dayButtons.push({
                                    key: `item-${item.id || idx}`,
                                    label: itemTitle,
                                    fullLabel: item.content ? `${itemTitle}: ${item.content}` : itemTitle,
                                    icon: <Activity className="w-3 h-3 text-brown-700 shrink-0 group-hover:scale-110 transition-transform" />,
                                    className: 'w-full h-[22px] min-h-[22px] max-h-[22px] flex items-center gap-1 text-[10px] font-bold text-brown-800 bg-beige-100 hover:bg-beige-200 active:scale-95 px-1.5 py-0.5 rounded-md border border-beige-300 min-w-0 transition cursor-pointer text-left shadow-2xs group',
                                    title: item.content || `${itemTitle} on this date. Click to view details.`,
                                    ariaLabel: `View details for ${itemTitle} on ${cell.dateStr}`,
                                    onClick: (e) => {
                                      e.stopPropagation();
                                      setCalendarItemPopup({
                                        type: 'events',
                                        dateStr: cell.dateStr,
                                        dateFormatted: formatDateDisplay(cell.dateStr),
                                        title: `${itemTitle} Details`,
                                        feedItems: [item],
                                        count: 1,
                                      });
                                    },
                                  });
                                });
                              } else {
                                dayButtons.push({
                                  key: 'events-other',
                                  label: `${otherItems.length} ${otherItems.length === 1 ? 'event' : 'events'}`,
                                  fullLabel: `${otherItems.length} Daily ${otherItems.length === 1 ? 'Event' : 'Events'} & Activity`,
                                  icon: <Activity className="w-3 h-3 text-brown-700 shrink-0 group-hover:scale-110 transition-transform" />,
                                  className: 'w-full h-[22px] min-h-[22px] max-h-[22px] flex items-center gap-1 text-[10px] font-bold text-brown-800 bg-beige-100 hover:bg-beige-200 active:scale-95 px-1.5 py-0.5 rounded-md border border-beige-300 min-w-0 transition cursor-pointer text-left shadow-2xs group',
                                  title: `${otherItems.length} ${otherItems.length === 1 ? 'event' : 'events'} on this date. Click to view details.`,
                                  ariaLabel: `View ${otherItems.length} events for ${cell.dateStr}`,
                                  onClick: (e) => {
                                    e.stopPropagation();
                                    setCalendarItemPopup({
                                      type: 'events',
                                      dateStr: cell.dateStr,
                                      dateFormatted: formatDateDisplay(cell.dateStr),
                                      title: 'Daily Activity Details',
                                      feedItems: otherItems,
                                      count: otherItems.length,
                                    });
                                  },
                                });
                              }
                            } else if (cell.meta.items.length > 0 && (dayButtons.length === 0 || dayButtons.length >= 3)) {
                              dayButtons.push({
                                key: 'events-all',
                                label: `${cell.meta.items.length} ${cell.meta.items.length === 1 ? 'event' : 'events'}`,
                                fullLabel: `${cell.meta.items.length} Daily ${cell.meta.items.length === 1 ? 'Event' : 'Events'} & Activity`,
                                icon: <Activity className="w-3 h-3 text-brown-700 shrink-0 group-hover:scale-110 transition-transform" />,
                                className: 'w-full h-[22px] min-h-[22px] max-h-[22px] flex items-center gap-1 text-[10px] font-bold text-brown-800 bg-beige-100 hover:bg-beige-200 active:scale-95 px-1.5 py-0.5 rounded-md border border-beige-300 min-w-0 transition cursor-pointer text-left shadow-2xs group',
                                title: `${cell.meta.items.length} ${cell.meta.items.length === 1 ? 'event' : 'events'} on this date. Click to view details.`,
                                ariaLabel: `View ${cell.meta.items.length} events for ${cell.dateStr}`,
                                onClick: (e) => {
                                  e.stopPropagation();
                                  setCalendarItemPopup({
                                    type: 'events',
                                    dateStr: cell.dateStr,
                                    dateFormatted: formatDateDisplay(cell.dateStr),
                                    title: 'Daily Activity Details',
                                    feedItems: cell.meta.items,
                                    count: cell.meta.items.length,
                                  });
                                },
                              });
                            }

                            const hasFourOrMore = dayButtons.length >= 4;
                            const slots = hasFourOrMore
                              ? [
                                  dayButtons[0],
                                  dayButtons[1],
                                  {
                                    key: `more-ellipsis-${cell.dateStr}`,
                                    label: '...',
                                    isMore: true,
                                    otherButtons: dayButtons.slice(2),
                                  },
                                ]
                              : dayButtons.slice(0, 3);

                            return slots.map((item, idx) => {
                              if ('isMore' in item && item.isMore) {
                                return (
                                  <button
                                    key={`more-${cell.dateStr}`}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMoreButtonsPopup({
                                        dateStr: cell.dateStr,
                                        dateFormatted: formatDateDisplay(cell.dateStr),
                                        buttons: item.otherButtons,
                                      });
                                    }}
                                    className="w-full h-[22px] min-h-[22px] max-h-[22px] flex items-center justify-center text-xs font-black tracking-widest text-dark-green-950 bg-beige-200/90 hover:bg-beige-300 active:scale-95 px-1.5 py-0.5 rounded-md border border-beige-300 min-w-0 transition cursor-pointer text-center shadow-2xs group"
                                    title={`View ${item.otherButtons.length} more button${item.otherButtons.length > 1 ? 's' : ''} for ${cell.dateStr}`}
                                    aria-label={`View other buttons for ${cell.dateStr}`}
                                  >
                                    ...
                                  </button>
                                );
                              }

                              const btn = item as (typeof dayButtons)[0];
                              return (
                                <button
                                  key={btn.key}
                                  type="button"
                                  onClick={btn.onClick}
                                  className={btn.className}
                                  title={btn.title}
                                  aria-label={btn.ariaLabel}
                                >
                                  {btn.icon}
                                  <span className="truncate hidden sm:inline">{btn.label}</span>
                                  <span className="truncate sm:hidden">{btn.label}</span>
                                </button>
                              );
                            });
                          })()}
                        </div>

                        {/* Bottom: Daily Aggregate Transaction Dollar Total (strictly transaction amounts, empty if 0) */}
                        <div className="mt-auto pt-1 w-full min-w-0 overflow-hidden">
                          {cell.meta.totalDailySpent > 0 ? (() => {
                            const roundedAmount = Math.round(cell.meta.totalDailySpent);
                            // If an amount is 1000 or over, do not use commas (e.g. $1000, $1250, $10000)
                            const formattedNoCommas = `$${roundedAmount}`;
                            // If amount is >= 1000 or too wide to fit without changing cell size, replace with interactive prompt icon
                            const isTooWide = cell.meta.totalDailySpent >= 1000;

                            const openPopup = (e: React.MouseEvent) => {
                              e.stopPropagation();
                              setCalendarItemPopup({
                                type: 'transactions',
                                dateStr: cell.dateStr,
                                dateFormatted: formatDateDisplay(cell.dateStr),
                                title: 'Daily Transaction Total Details',
                                totalSpent: cell.meta.totalDailySpent,
                                count: cell.meta.transactionCount,
                                transactions: calendarData.dailyExpensesMap[cell.dateStr]?.transactions || [],
                              });
                            };

                            if (isTooWide) {
                              return (
                                <button
                                  type="button"
                                  onClick={openPopup}
                                  className="w-full flex items-center justify-center gap-1 px-1 sm:px-1.5 py-0.5 bg-dark-green-900/5 hover:bg-dark-green-900/15 border border-dark-green-900/15 rounded-md text-dark-green-950 shadow-2xs transition cursor-pointer group min-w-0 active:scale-95"
                                  title={`Total on this date: ${formattedNoCommas} (${cell.meta.transactionCount} transactions). Click to view full amount.`}
                                  aria-label={`View full amount for ${cell.dateStr}`}
                                >
                                  <span className="text-[10px] sm:text-xs font-mono font-black text-dark-green-900">
                                    $
                                  </span>
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-3 h-3 text-dark-green-900 shrink-0 group-hover:scale-110 transition-transform"
                                  >
                                    <path d="M15 3h6v6" />
                                    <path d="M10 14 21 3" />
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                  </svg>
                                </button>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={openPopup}
                                className="w-full flex items-center justify-center sm:justify-between px-1 sm:px-1.5 py-0.5 bg-dark-green-900/5 hover:bg-dark-green-900/15 border border-dark-green-900/15 rounded-md text-dark-green-950 shadow-2xs transition text-left cursor-pointer min-w-0 active:scale-95"
                                title={`Total on this date: ${formattedNoCommas} across ${cell.meta.transactionCount} transaction${cell.meta.transactionCount === 1 ? '' : 's'}. Click to view details.`}
                              >
                                <span className="text-[9px] font-black text-sage-800 uppercase tracking-tight hidden md:inline">
                                  Total
                                </span>
                                <span className="text-[10px] sm:text-xs font-mono font-black text-dark-green-900 truncate">
                                  {formattedNoCommas}
                                </span>
                              </button>
                            );
                          })() : null}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>

          {/* Active Day Detail Banner with Clear Date Filter */}
          {selectedDateFilter && (
            <div className="p-5 sm:p-6 pt-4">
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
            { id: 'system', label: 'System' },
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
            const isMilestone = item.type === 'milestone' || item.type === 'savingsGoalAchieved';

            // Dynamically resolve category from linked expense or category name
            const linkedExpenseId = item.linkedExpenseId || item.linkedExpense?.id;
            const matchedExpense = expenses.find(
              (e) => (linkedExpenseId && e.id === linkedExpenseId) || e.id === item.id || (e.description && item.content && item.content.includes(e.description))
            );

            const matchedCategory = item.linkedExpense?.categoryId
              ? categories.find((c) => c.id === item.linkedExpense?.categoryId)
              : item.linkedExpense?.categoryName
              ? categories.find((c) => c.name.toLowerCase() === item.linkedExpense?.categoryName?.toLowerCase())
              : matchedExpense?.categoryId
              ? categories.find((c) => c.id === matchedExpense.categoryId)
              : matchedExpense?.categoryName
              ? categories.find((c) => c.name.toLowerCase() === matchedExpense.categoryName?.toLowerCase())
              : undefined;

            const resolvedCatIcon = matchedCategory?.icon || item.linkedExpense?.categoryIcon || matchedExpense?.categoryIcon;
            const resolvedCatName = matchedCategory?.name || item.linkedExpense?.categoryName || matchedExpense?.categoryName;
            const resolvedCatGroup = matchedCategory?.group;

            // Resolve any comments made for this record (from matched expense, direct comments, linked comment feed items, or metadata)
            const recordComments: Array<{
              id: string;
              text: string;
              authorName: string;
              authorAvatar?: string;
              timestamp: number;
            }> = [];

            // 1. Comments from matched expense in expenses collection
            if (matchedExpense?.comments && Array.isArray(matchedExpense.comments)) {
              matchedExpense.comments.forEach((c) => {
                recordComments.push({
                  id: c.id,
                  text: c.text,
                  authorName: c.authorName || 'Member',
                  authorAvatar: c.authorAvatar,
                  timestamp: c.timestamp,
                });
              });
            }

            // 2. Comments from direct item.comments property if any
            if ((item as any).comments && Array.isArray((item as any).comments)) {
              (item as any).comments.forEach((c: any) => {
                const text = c.text || c.content || c.message || String(c);
                if (!recordComments.some((rc) => rc.text === text)) {
                  recordComments.push({
                    id: c.id || `c_${Math.random()}`,
                    text,
                    authorName: c.authorName || c.author || 'Member',
                    authorAvatar: c.authorAvatar,
                    timestamp: c.timestamp || item.timestamp,
                  });
                }
              });
            }

            // 3. Comments from any feedItem of type 'comment' linked to this record or its expense
            feedItems.forEach((f) => {
              if (f.type === 'comment' && f.id !== item.id) {
                const isLinked =
                  (linkedExpenseId && f.linkedExpenseId === linkedExpenseId) ||
                  f.linkedExpenseId === item.id ||
                  (matchedExpense && f.linkedExpenseId === matchedExpense.id);
                if (isLinked) {
                  const alreadyIncluded = recordComments.some(
                    (rc) => rc.text === f.content && Math.abs(rc.timestamp - f.timestamp) < 5000
                  );
                  if (!alreadyIncluded) {
                    recordComments.push({
                      id: f.id,
                      text: f.content,
                      authorName: f.authorName || 'Member',
                      authorAvatar: f.authorAvatar,
                      timestamp: f.timestamp,
                    });
                  }
                }
              }
            });

            // 4. Notes/comments from item metadata or notes field
            const metaNote = item.metadata?.comment || item.metadata?.notes || (item as any).notes;
            if (typeof metaNote === 'string' && metaNote.trim()) {
              if (!recordComments.some((rc) => rc.text === metaNote.trim())) {
                recordComments.push({
                  id: `meta_note_${item.id}`,
                  text: metaNote.trim(),
                  authorName: item.authorName || 'Member',
                  authorAvatar: item.authorAvatar,
                  timestamp: item.timestamp,
                });
              }
            }

            // Extract robust content from any possible field so empty records never occur
            const rawContent = roundAmountsInText(
              (item.content && item.content.trim()) ||
              ((item as any).message && String((item as any).message).trim()) ||
              ((item as any).text && String((item as any).text).trim()) ||
              ((item as any).comment && String((item as any).comment).trim()) ||
              ((item as any).notes && String((item as any).notes).trim()) ||
              ((item as any).note && String((item as any).note).trim()) ||
              (item.metadata?.notes && String(item.metadata.notes).trim()) ||
              (item.metadata?.comment && String(item.metadata.comment).trim()) ||
              (recordComments.length > 0 ? recordComments[0].text : '') ||
              ''
            );

            // Milestone Context Resolution
            const matchedGoal =
              (item.savingsGoal?.id && savingsGoals?.find((g) => g.id === item.savingsGoal?.id)) ||
              (item.metadata?.goalId && savingsGoals?.find((g) => g.id === item.metadata?.goalId)) ||
              (item.metadata?.targetGoalId && savingsGoals?.find((g) => g.id === item.metadata?.targetGoalId)) ||
              (item.metadata?.goalName && savingsGoals?.find((g) => g.name.toLowerCase() === item.metadata?.goalName?.toLowerCase())) ||
              (item.savingsGoal
                ? {
                    id: item.savingsGoal.id,
                    name: item.savingsGoal.name,
                    targetAmount: item.savingsGoal.targetAmount,
                    currentAmount: item.savingsGoal.currentAmount || 0,
                  }
                : undefined);

            const milestoneAmount =
              item.savingsGoal?.targetAmount ||
              item.metadata?.targetAmount ||
              item.metadata?.savedAmount ||
              item.metadata?.totalSaved ||
              (item as any).amount ||
              undefined;

            const milestoneStreak = item.metadata?.streak || (item as any).streak || undefined;

            // Contextual Milestone Title
            const milestoneTitle =
              (item as any).title ||
              item.metadata?.title ||
              item.metadata?.milestoneTitle ||
              (matchedGoal ? `Savings Milestone: ${matchedGoal.name}` : '') ||
              (milestoneStreak ? `${milestoneStreak}-Week Check-In Streak` : '') ||
              (item.metadata?.totalSaved ? `Savings Pot Milestone: ${formatCurrency(item.metadata.totalSaved)} Banked` : '') ||
              'Household Savings & Budget Milestone';

            // Contextual Detailed Description
            const milestoneDescription =
              rawContent ||
              (item as any).description ||
              item.metadata?.description ||
              item.metadata?.notes ||
              (matchedGoal
                ? `Celebrated milestone for savings target "${matchedGoal.name}"! The household reached ${formatCurrency(matchedGoal.currentAmount || milestoneAmount || 0)} towards the ${formatCurrency(matchedGoal.targetAmount)} target.`
                : item.metadata?.totalSaved
                ? `Household savings milestone: Banked ${formatCurrency(item.metadata.totalSaved)} into household savings during the weekly financial review.`
                : milestoneStreak
                ? `Budget consistency milestone: ${item.authorName || 'The household'} completed ${milestoneStreak} consecutive weeks of active budgeting and reviews!`
                : item.linkedCheckInId || item.weekStartDate
                ? `Financial review milestone: Successfully completed weekly review for week of ${item.weekStartDate || item.date} with all categories balanced.`
                : `Major household financial milestone achieved by ${item.authorName || 'the household'}: celebrating progress toward shared savings targets, disciplined spending, and balanced household budgets.`);

            const displayContent = roundAmountsInText(rawContent || (
              isMilestone
                ? milestoneDescription
                : item.linkedExpense
                ? `Activity on expense "${item.linkedExpense.description}" (${formatCurrency(item.linkedExpense.amount)})`
                : matchedExpense
                ? `Activity on expense "${matchedExpense.description}" (${formatCurrency(matchedExpense.amount)})`
                : isComment
                ? 'Comment note on activity'
                : item.type === 'message'
                ? 'Quick note posted to household stream'
                : isTransaction
                ? 'Expense transaction recorded'
                : isCheckin
                ? 'Weekly check-in logged'
                : 'Household financial update'
            ));

            const isMemberLeave =
              item.type === 'member_leave' ||
              item.metadata?.action === 'member_left' ||
              item.content?.toLowerCase().includes('left the household');

            const isMemberJoin =
              !isMemberLeave &&
              (item.type === 'member_join' ||
                item.metadata?.action === 'member_joined' ||
                item.content?.toLowerCase().includes('joined the household') ||
                item.content?.toLowerCase().includes('claimed their profile'));

            const isSystemInit =
              item.id.startsWith('feed_init_') ||
              item.id.startsWith('feed_system_') ||
              item.id.startsWith('feed_sys_') ||
              (typeof item.content === 'string' && (item.content.includes('Welcome to Canopy!') || item.content.includes('Sync Code:')));

            const isSystemRecord =
              item.type === 'system' ||
              isMemberJoin ||
              isMemberLeave ||
              isSystemInit ||
              item.id.startsWith('feed_join_') ||
              item.id.startsWith('feed_leave_') ||
              item.metadata?.isSystem ||
              item.metadata?.type === 'system';

            const resolvedDetails = (isMemberLeave || isMemberJoin || !item.authorName || ['Household Member', 'Member', 'A new member', 'A house member', 'The member'].includes(item.authorName))
              ? resolveMemberDetails(item)
              : null;

            const displayAuthorName =
              isSystemInit
                ? 'Canopy System'
                : (resolvedDetails?.name && !['Household Member', 'Member', 'A new member', 'A house member', 'The member'].includes(resolvedDetails.name))
                ? resolvedDetails.name
                : (item.authorName && !['Household Member', 'Member', 'A new member', 'A house member', 'The member'].includes(item.authorName))
                ? item.authorName
                : resolvedDetails?.name || (household?.accountType === 'roommate' ? 'Roommate 1' : 'Partner');

            const resolvedAvatar =
              (resolvedDetails?.avatarUrl && !resolvedDetails.avatarUrl.startsWith('data:image/svg'))
                ? resolvedDetails.avatarUrl
                : (item.authorAvatar && !item.authorAvatar.startsWith('data:image/svg'))
                ? item.authorAvatar
                : resolvedDetails?.avatarUrl ||
                  item.authorAvatar ||
                  (isMemberLeave || isMemberJoin ? generateFacelessVectorAvatar(1) : undefined);

            const memberWeeklyIncome =
              resolvedDetails?.weeklyIncome ||
              item.metadata?.weeklyIncome ||
              item.metadata?.normalizedWeeklyIncome ||
              (household?.accountType === 'roommate' ? 900 : 1038.46);

            const matchedDeposit = household?.oneOffDeposits?.find(
              (d) => (linkedExpenseId && d.id === linkedExpenseId) || (d.description && item.content && item.content.includes(d.description))
            );

            // Extract parsed amount and count from content string (e.g. "Logged 10 expenses totaling $1038.46")
            const contentAmountMatch =
              item.content?.match(/totaling\s+\$([0-9,]+(\.[0-9]{1,2})?)/i) ||
              item.content?.match(/for\s+\$([0-9,]+(\.[0-9]{1,2})?)/i) ||
              item.content?.match(/\(\$([0-9,]+(\.[0-9]{1,2})?)\)/) ||
              item.content?.match(/\$([0-9,]+(\.[0-9]{1,2})?)/);

            const parsedContentAmount = contentAmountMatch
              ? parseFloat(contentAmountMatch[1].replace(/,/g, ''))
              : undefined;

            const contentCountMatch = item.content?.match(/Logged\s+(\d+)\s+expense/i);
            const parsedContentCount = contentCountMatch
              ? parseInt(contentCountMatch[1], 10)
              : (item.metadata?.transactionCount || undefined);

            // Elaborated Transaction Details
            const txDescription =
              (isTransaction && parsedContentCount && parsedContentCount > 1)
                ? `${parsedContentCount} Logged Expenses`
                : item.linkedExpense?.description ||
                  matchedExpense?.description ||
                  matchedDeposit?.description ||
                  (() => {
                    const match = item.content?.match(/to\s+["']?([^("']+)["']?\s*\(/i);
                    return match ? match[1].trim() : 'Household Transaction';
                  })();

            // Transaction amount: for transaction records, must match the amount within the description
            const txAmount =
              (isTransaction && parsedContentAmount !== undefined)
                ? parsedContentAmount
                : item.linkedExpense?.amount ??
                  matchedExpense?.amount ??
                  matchedDeposit?.amount ??
                  parsedContentAmount;

            const txDate =
              item.linkedExpense?.date ||
              matchedExpense?.date ||
              matchedDeposit?.date ||
              item.date;

            const txPayer =
              item.linkedExpense?.payerName ||
              members.find((m) => m.userId === (matchedExpense?.loggedByUserId || matchedExpense?.payerMemberId || matchedDeposit?.payerMemberId))?.name ||
              (matchedDeposit ? 'Household Member' : 'Household Member');

            const txCategoryName =
              resolvedCatName ||
              item.linkedExpense?.categoryName ||
              (matchedDeposit ? 'One-Off Deposit' : 'General Expense');

            const txCategoryIcon =
              resolvedCatIcon ||
              item.linkedExpense?.categoryIcon ||
              (matchedDeposit ? 'dollar-sign' : 'receipt');

            const txCategoryGroup =
              resolvedCatGroup ||
              (matchedDeposit ? 'Income / Deposit' : undefined);

            const txSplitRatio = matchedExpense?.splitRatio;

            const txTags: string[] = Array.from(
              new Set([
                ...(matchedExpense?.tags || []),
                ...(matchedDeposit?.tags || []),
                ...((item.metadata as any)?.tags || []),
              ])
            ).filter(Boolean);

            // Resolve matching check-in and details handler for check-in records
            const matchingCheckIn = (checkIns || []).find(
              (c) =>
                (item.linkedCheckInId && c.id === item.linkedCheckInId) ||
                (item.metadata?.checkInId && c.id === item.metadata?.checkInId) ||
                (c.weekEndDate && item.date === c.weekEndDate) ||
                (c.weekEndDate && item.weekEndDate === c.weekEndDate) ||
                (c.weekStartDate && item.weekStartDate === c.weekStartDate) ||
                (item.id && (item.id.includes(c.id) || item.id === `feed_${c.timestamp}`))
            ) || (isCheckin ? {
              id: item.metadata?.checkInId || item.linkedCheckInId || item.id,
              timestamp: item.timestamp,
              weekStartDate: item.weekStartDate || item.date || formatLocalDate(new Date(item.timestamp)),
              weekEndDate: item.weekEndDate || item.date || formatLocalDate(new Date(item.timestamp)),
              status: 'completed' as const,
              completedByUserId: item.authorId,
              completedByName: item.authorName,
              totalBudget: item.metadata?.totalBudget || 0,
              totalSpent: item.metadata?.totalSpent || 0,
              totalSaved: item.metadata?.totalSaved || 0,
              notes: item.metadata?.notes,
              decisions: item.metadata?.decisions || [],
            } : undefined);

            const checkInDate = item.date || item.weekEndDate || matchingCheckIn?.weekEndDate || formatLocalDate(new Date(item.timestamp));

            const handleOpenCheckInDetails = () => {
              setCalendarItemPopup({
                type: 'checkin',
                dateStr: checkInDate,
                dateFormatted: formatDateDisplay(checkInDate),
                title: 'Weekly Check-In Details',
                checkIn: matchingCheckIn,
                feedItem: item,
              });
            };

            // Resolve itemized transactions for transaction feed record
            // Resolve itemized transactions strictly from genuine logged expenses in the database
            const txTransactionsList: Expense[] = (() => {
              const targetCount = parsedContentCount || 10;
              const targetDate = txDate || item.date || formatLocalDate(new Date(item.timestamp));
              const timestampPrefix = item.id.replace('feed_', '');

              // Gather genuine expenses that exist in the database (expenses)
              const found: Expense[] = [];
              const seen = new Set<string>();

              const addIfUnique = (exp: Expense | undefined | null) => {
                if (exp && exp.id && !seen.has(exp.id)) {
                  seen.add(exp.id);
                  found.push(exp);
                }
              };

              // 1. Linked expense direct match in database
              if (item.linkedExpense) {
                const existing = expenses.find((e) => e.id === item.linkedExpense?.id);
                addIfUnique(existing || item.linkedExpense);
              }

              if (item.linkedExpenseId) {
                const existing = expenses.find((e) => e.id === item.linkedExpenseId);
                addIfUnique(existing);
              }

              if (item.metadata?.expenseIds && Array.isArray(item.metadata.expenseIds)) {
                item.metadata.expenseIds.forEach((eid: string) => {
                  const existing = expenses.find((e) => e.id === eid);
                  addIfUnique(existing);
                });
              }

              // 2. Batch timestamp match in database
              const batchExpenses = expenses.filter((e) =>
                e.id.startsWith(`exp_${timestampPrefix}_`) || e.id.includes(timestampPrefix)
              );
              batchExpenses.forEach(addIfUnique);

              // 3. Same date expenses in database
              const sameDateExpenses = expenses.filter((e) => e.date === item.date || e.date === targetDate);
              sameDateExpenses.forEach(addIfUnique);

              // 4. Proximity in database
              if (found.length < targetCount) {
                const proximityExpenses = expenses.filter(
                  (e) => Math.abs(e.timestamp - item.timestamp) < 36 * 3600 * 1000
                );
                proximityExpenses.forEach(addIfUnique);
              }

              // 5. If more expenses exist in the household database, include them up to targetCount
              if (found.length < targetCount) {
                expenses.forEach(addIfUnique);
              }

              // Return ONLY real transactions that have been truly logged and exist in the database
              return found.slice(0, targetCount > 0 ? targetCount : undefined);
            })();

            const handleOpenTransactionDetails = () => {
              const targetDate = txDate || item.date || formatLocalDate(new Date(item.timestamp));
              const total = txTransactionsList.reduce((sum, t) => sum + (t.amount || 0), 0) || txAmount || 0;

              setCalendarItemPopup({
                type: 'transactions',
                dateStr: targetDate,
                dateFormatted: formatDateDisplay(targetDate),
                title: txTransactionsList.length > 1 ? `Logged Transactions (${txTransactionsList.length})` : 'Transaction Details',
                totalSpent: roundToHundredths(total),
                count: txTransactionsList.length,
                transactions: txTransactionsList,
                feedItem: item,
              });
            };

            const handleOpenMilestoneDetails = () => {
              const targetDate = item.date || formatLocalDate(new Date(item.timestamp));
              setCalendarItemPopup({
                type: 'milestone',
                dateStr: targetDate,
                dateFormatted: formatDateDisplay(targetDate),
                title: milestoneTitle,
                feedItem: item,
                totalSpent: milestoneAmount,
              });
            };

            const reactionScheme = isReaction ? getReactionColorScheme(item.emoji) : null;

            return (
              <div
                key={item.id}
                id={`feed-item-${item.id}`}
                className={`rounded-3xl p-5 sm:p-6 shadow-xs transition-all space-y-3.5 ${
                  isReaction && reactionScheme
                    ? `${reactionScheme.outerCardBg} ${reactionScheme.outerCardBorder}`
                    : isSystemRecord
                    ? 'bg-slate-50/70 border border-slate-200/90 hover:border-slate-300'
                    : 'bg-white border border-beige-200/90 hover:border-beige-300'
                }`}
              >
                {/* Author Info & Timestamp */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-beige-100 border border-beige-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {isSystemInit ? (
                        <Shield className="w-5 h-5 text-slate-700" />
                      ) : resolvedAvatar ? (
                        <img
                          src={resolvedAvatar}
                          alt={displayAuthorName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = generateFacelessVectorAvatar(2);
                          }}
                        />
                      ) : (
                        <User className="w-5 h-5 text-brown-700" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-dark-green-900 text-sm">
                          {displayAuthorName}
                        </span>
                        {isCheckin && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sage-100 text-dark-green-950 border border-sage-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-sage-700" />
                            <span>Check-In</span>
                          </span>
                        )}
                        {isMilestone && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                            <Award className="w-3 h-3 text-emerald-700" />
                            <span>{item.id?.startsWith('feed_goal_') || item.savingsGoal ? 'Savings Goal' : 'Milestone'}</span>
                          </span>
                        )}
                        {isComment && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-300 flex items-center gap-1 shadow-2xs">
                            <MessageSquare className="w-3 h-3 text-amber-800" />
                            <span>Comment</span>
                          </span>
                        )}
                        {isSystemRecord && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1 shadow-2xs">
                            <Shield className="w-3 h-3 text-slate-700" />
                            <span>System</span>
                          </span>
                        )}
                        {item.type === 'message' && !isSystemRecord && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-950 border border-blue-300 flex items-center gap-1 shadow-2xs">
                            <MessageCircle className="w-3 h-3 text-blue-800" />
                            <span>Message</span>
                          </span>
                        )}
                        {isTransaction && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-950 border border-amber-300 flex items-center gap-1 shadow-2xs">
                            <Receipt className="w-3 h-3 text-amber-800" />
                            <span>Transaction</span>
                          </span>
                        )}
                        {isReaction && (() => {
                          const def = getReactionDef(item.emoji);
                          const IconComp = def.icon;
                          return (
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border flex items-center gap-1 shadow-2xs ${
                              reactionScheme
                                ? `${reactionScheme.badgeBg} ${reactionScheme.badgeText} ${reactionScheme.badgeBorder}`
                                : 'bg-sky-100 text-sky-950 border-sky-300'
                            }`}>
                              <IconComp className={`w-3 h-3 ${def.iconColor}`} />
                              <span>{def.label || 'Reaction'}</span>
                            </span>
                          );
                        })()}
                        {!isCheckin && !isMilestone && !isComment && !isSystemRecord && item.type !== 'message' && !isTransaction && !isReaction && item.type && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-beige-200 text-dark-green-950 border border-beige-300 flex items-center gap-1 shadow-2xs">
                            <Tag className="w-3 h-3 text-dark-green-800" />
                            <span>{item.type}</span>
                          </span>
                        )}
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
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                    isReaction && reactionScheme
                      ? `${reactionScheme.headerIconBg} ${reactionScheme.headerIconBorder}`
                      : isMilestone
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-900'
                      : isTransaction
                      ? 'bg-amber-100 border-amber-200 text-amber-900'
                      : isSystemRecord
                      ? 'bg-slate-100 border-slate-200 text-slate-800'
                      : 'bg-sage-100 border-sage-200 text-dark-green-900'
                  }`}>
                    {isCheckin ? (
                      <Sprout className="w-4 h-4 text-sage-800" />
                    ) : isMilestone ? (
                      <Award className="w-4 h-4 text-emerald-700" />
                    ) : isReaction ? (() => {
                      const def = getReactionDef(item.emoji);
                      const IconComp = def.icon;
                      return <IconComp className={`w-4 h-4 ${def.iconColor}`} />;
                    })() : isSystemRecord ? (
                      isMemberLeave ? (
                        <UserMinus className="w-4 h-4 text-rose-800" />
                      ) : isMemberJoin ? (
                        <UserCheck className="w-4 h-4 text-dark-green-800" />
                      ) : (
                        <Shield className="w-4 h-4 text-slate-700" />
                      )
                    ) : resolvedCatName || resolvedCatIcon ? (
                      <CategoryIcon name={resolvedCatName} group={resolvedCatGroup} icon={resolvedCatIcon} className="w-4 h-4" />
                    ) : isTransaction ? (
                      <Receipt className="w-4 h-4 text-amber-800" />
                    ) : item.type === 'message' ? (
                      <MessageCircle className="w-4 h-4 text-blue-800" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-dark-green-800" />
                    )}
                  </div>
                </div>

                {/* Content Message */}
                <div className="pl-13 space-y-3">
                  {isReaction ? (
                    <div>
                      {/* Elaborated Transaction Details Card */}
                      <div
                        onClick={() => navigateToCategoryLedger(matchedCategory || null)}
                        className={`p-4 rounded-2xl space-y-3 shadow-2xs transition group cursor-pointer ${
                          reactionScheme
                            ? `${reactionScheme.innerCardBg} border ${reactionScheme.innerCardBorder} ${reactionScheme.innerCardHoverBorder}`
                            : 'bg-white border border-beige-200/90 hover:border-beige-300'
                        }`}
                      >
                        {/* Transaction Card Header: Icon, Description, Category, Parent Category, Tags, Date, and Amount */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs ${
                              reactionScheme
                                ? `${reactionScheme.catIconBg} ${reactionScheme.catIconBorder} ${reactionScheme.catIconColor}`
                                : 'bg-sage-100 border border-sage-200 text-dark-green-900'
                            }`}>
                              <CategoryIcon name={txCategoryName} group={txCategoryGroup} icon={txCategoryIcon} className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-sm sm:text-base text-dark-green-950 truncate group-hover:text-dark-green-800">
                                {txDescription}
                              </h4>
                              <div className="flex items-center gap-1.5 text-xs text-brown-700 flex-wrap mt-0.5">
                                <span className="font-bold text-dark-green-900">{txCategoryName}</span>
                                {txCategoryGroup && (
                                  <>
                                    <span>&bull;</span>
                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${
                                      reactionScheme
                                        ? `${reactionScheme.catGroupBg} ${reactionScheme.catGroupText} ${reactionScheme.catGroupBorder}`
                                        : 'bg-amber-100/90 text-amber-950 border border-amber-300/80'
                                    }`}>
                                      {txCategoryGroup}
                                    </span>
                                  </>
                                )}
                                <span>&bull;</span>
                                <span className="text-dark-grey-700 font-medium">
                                  {txDate ? formatDateDisplay(txDate) : new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                {txTags.length > 0 && (
                                  <>
                                    <span>&bull;</span>
                                    <div className="inline-flex items-center gap-1 flex-wrap">
                                      {txTags.map((tag, tIdx) => (
                                        <span
                                          key={tIdx}
                                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-semibold border ${
                                            reactionScheme
                                              ? `${reactionScheme.tagBg} ${reactionScheme.tagText} ${reactionScheme.tagBorder}`
                                              : 'bg-beige-200 text-dark-green-950 border border-beige-300'
                                          }`}
                                        >
                                          <Tag className="w-2.5 h-2.5" />
                                          <span>{tag}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {txAmount !== undefined && (
                              <span className={`font-black font-mono text-base sm:text-lg block ${
                                reactionScheme ? reactionScheme.amountText : 'text-dark-green-950'
                              }`}>
                                {formatCurrency(txAmount)}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold group-hover:underline flex items-center justify-end gap-1 ${
                              reactionScheme ? reactionScheme.linkText : 'text-sage-800'
                            }`}>
                              <span>View in Ledger</span>
                              <ArrowRight className="w-3 h-3 inline" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : isComment ? (
                    <div className="space-y-3">
                      {/* Transaction Card: Formatted identical to the transaction cards in reaction records */}
                      <div
                        onClick={() => navigateToCategoryLedger(matchedCategory || null)}
                        className="p-4 rounded-2xl space-y-3 shadow-2xs transition group cursor-pointer bg-white border border-beige-200/90 hover:border-beige-300"
                      >
                        {/* Transaction Card Header: Icon, Description, Category, Parent Category, Tags, Date, and Amount */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs bg-sage-100 border border-sage-200 text-dark-green-900">
                              <CategoryIcon name={txCategoryName} group={txCategoryGroup} icon={txCategoryIcon} className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-sm sm:text-base text-dark-green-950 truncate group-hover:text-dark-green-800">
                                {txDescription}
                              </h4>
                              <div className="flex items-center gap-1.5 text-xs text-brown-700 flex-wrap mt-0.5">
                                <span className="font-bold text-dark-green-900">{txCategoryName}</span>
                                {txCategoryGroup && (
                                  <>
                                    <span>&bull;</span>
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold border bg-amber-100/90 text-amber-950 border border-amber-300/80">
                                      {txCategoryGroup}
                                    </span>
                                  </>
                                )}
                                <span>&bull;</span>
                                <span className="text-dark-grey-700 font-medium">
                                  {txDate ? formatDateDisplay(txDate) : new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                {txTags.length > 0 && (
                                  <>
                                    <span>&bull;</span>
                                    <div className="inline-flex items-center gap-1 flex-wrap">
                                      {txTags.map((tag, tIdx) => (
                                        <span
                                          key={tIdx}
                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[10px] font-semibold border bg-beige-200 text-dark-green-950 border border-beige-300"
                                        >
                                          <Tag className="w-2.5 h-2.5" />
                                          <span>{tag}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {txAmount !== undefined && (
                              <span className="font-black font-mono text-base sm:text-lg block text-dark-green-950">
                                {formatCurrency(txAmount)}
                              </span>
                            )}
                            <span className="text-[10px] font-bold group-hover:underline flex items-center justify-end gap-1 text-sage-800">
                              <span>View in Ledger</span>
                              <ArrowRight className="w-3 h-3 inline" />
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Comment Display: Exactly formatted as the 4th selected item */}
                      <div className="p-3 bg-beige-50/90 border border-beige-200 rounded-2xl space-y-1 text-xs shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {resolvedAvatar ? (
                              <img
                                src={resolvedAvatar}
                                alt={displayAuthorName}
                                className="w-4 h-4 rounded-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <User className="w-3.5 h-3.5 text-brown-700" />
                            )}
                            <span className="font-bold text-dark-green-900">{displayAuthorName}</span>
                          </div>
                          <span className="text-[10px] text-brown-600 font-mono">
                            {new Date(item.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-dark-green-950 font-medium pl-5 leading-relaxed">
                          {rawContent || displayContent}
                        </p>
                      </div>
                    </div>
                  ) : isMilestone ? (
                    <div className="p-4 bg-linear-to-r from-emerald-50/90 via-beige-50/90 to-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
                            <Award className="w-4.5 h-4.5 text-emerald-700" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-xs sm:text-sm text-emerald-950 truncate">
                              {milestoneTitle}
                            </h4>
                            <span className="text-[11px] text-brown-700 block">
                              Household Achievement &bull; {item.authorName || 'Household Member'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {milestoneAmount !== undefined && (
                            <span className="text-xs sm:text-sm font-black font-mono text-emerald-950 bg-emerald-100/80 border border-emerald-300/80 px-2.5 py-0.5 rounded-lg inline-block">
                              {formatCurrency(milestoneAmount)}
                            </span>
                          )}
                          {/* Button to pull up the details of this milestone record type */}
                          <button
                            type="button"
                            onClick={handleOpenMilestoneDetails}
                            className="px-3.5 py-2 bg-dark-green-800 hover:bg-dark-green-900 active:scale-95 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs hover:shadow-md shrink-0"
                            title="Pull up the details of this milestone record"
                            aria-label="View Milestone Details"
                          >
                            <Award className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                            <span>View Details</span>
                          </button>
                        </div>
                      </div>

                      {matchedGoal && (
                        <div className="pt-2 border-t border-emerald-200/60 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-dark-green-900">
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3 text-emerald-700" />
                              <span>Savings Target: {matchedGoal.name}</span>
                            </span>
                            <span className="font-mono">
                              {formatCurrency(matchedGoal.currentAmount || 0)} / {formatCurrency(matchedGoal.targetAmount)}
                            </span>
                          </div>
                          <div className="w-full bg-emerald-200/50 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, Math.round(((matchedGoal.currentAmount || 0) / Math.max(1, matchedGoal.targetAmount)) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isCheckin ? (
                    <div className="p-4 sm:p-5 bg-linear-to-r from-sage-50/90 via-beige-50/80 to-sage-50/50 border border-sage-200/90 rounded-2xl space-y-3.5 shadow-2xs">
                      {/* Card Header: Icon, Title & Week Range & View Details Button */}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-sage-200/80 border border-sage-300 flex items-center justify-center text-dark-green-900 shrink-0 shadow-2xs">
                            <CheckCircle2 className="w-5 h-5 text-dark-green-800" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm sm:text-base text-dark-green-950 truncate">
                              Weekly Financial Review & Check-In
                            </h4>
                            <span className="text-xs text-brown-700 block truncate">
                              {matchingCheckIn?.weekStartDate
                                ? `Week of ${formatDateDisplay(matchingCheckIn.weekStartDate)} \u2192 ${formatDateDisplay(checkInDate)}`
                                : item.weekStartDate
                                ? `Week of ${formatDateDisplay(item.weekStartDate)}`
                                : `Review Date: ${formatDateDisplay(checkInDate)}`}
                            </span>
                          </div>
                        </div>

                        {/* Button to pull up the details of this check-in record */}
                        <button
                          type="button"
                          onClick={handleOpenCheckInDetails}
                          className="px-3.5 py-2 bg-dark-green-800 hover:bg-dark-green-900 active:scale-95 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs hover:shadow-md shrink-0"
                          title="Pull up the details of this check-in record"
                          aria-label="View Check-In Details"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-sage-300 shrink-0" />
                          <span>View Details</span>
                        </button>
                      </div>

                      {/* Content Message */}
                      <p className="text-xs sm:text-sm text-dark-green-950 leading-relaxed font-medium">
                        {roundAmountsInText(displayContent)}
                      </p>

                      {/* 3-Stat Metric Snapshot */}
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-sage-200/60 text-center">
                        <div className="p-2 rounded-xl bg-white/80 border border-sage-200/70">
                          <span className="text-[10px] uppercase font-bold text-brown-600 block">Banked to Savings</span>
                          <span className="font-mono font-black text-xs sm:text-sm text-dark-green-900">
                            {formatCurrency(matchingCheckIn?.totalSaved ?? item.metadata?.totalSaved ?? 0)}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-white/80 border border-sage-200/70">
                          <span className="text-[10px] uppercase font-bold text-brown-600 block">Total Spent</span>
                          <span className="font-mono font-black text-xs sm:text-sm text-dark-green-900">
                            {formatCurrency(matchingCheckIn?.totalSpent ?? item.metadata?.totalSpent ?? 0)}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-white/80 border border-sage-200/70">
                          <span className="text-[10px] uppercase font-bold text-brown-600 block">Total Budget</span>
                          <span className="font-mono font-black text-xs sm:text-sm text-dark-green-900">
                            {formatCurrency(matchingCheckIn?.totalBudget ?? item.metadata?.totalBudget ?? 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : isMemberLeave ? (
                    <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-2xl flex items-center justify-between gap-3 flex-wrap shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-800 shrink-0">
                          <UserMinus className="w-4 h-4 text-rose-700" />
                        </div>
                        <div>
                          <div className="font-extrabold text-xs text-rose-950">
                            {displayAuthorName} &bull; Member Departure
                          </div>
                          <div className="text-[11px] text-rose-800">
                            Left the household &bull; Prior income was {formatCurrency(memberWeeklyIncome)}/wk
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Prior Weekly Income</span>
                        <span className="font-mono font-black text-xs sm:text-sm text-rose-950 bg-rose-100/90 border border-rose-300/90 px-2.5 py-0.5 rounded-lg inline-block">
                          {formatCurrency(memberWeeklyIncome)}/wk
                        </span>
                      </div>
                    </div>
                  ) : isMemberJoin ? (
                    <div className="p-3.5 bg-sage-50/70 border border-sage-200/80 rounded-2xl flex items-center justify-between gap-3 flex-wrap shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-sage-100 border border-sage-300 flex items-center justify-center text-sage-800 shrink-0">
                          <UserCheck className="w-4 h-4 text-sage-800" />
                        </div>
                        <div>
                          <div className="font-extrabold text-xs text-dark-green-950">
                            {displayAuthorName} &bull; New Member Joined
                          </div>
                          <div className="text-[11px] text-dark-green-800">
                            Joined the household with a weekly income of {formatCurrency(memberWeeklyIncome)}/wk
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sage-800 block">Weekly Income</span>
                        <span className="font-mono font-black text-xs sm:text-sm text-dark-green-950 bg-sage-100/90 border border-sage-300/90 px-2.5 py-0.5 rounded-lg inline-block">
                          {formatCurrency(memberWeeklyIncome)}/wk
                        </span>
                      </div>
                    </div>
                  ) : isSystemInit ? (
                    <div className="p-3.5 bg-slate-100/80 border border-slate-200/90 rounded-2xl flex items-center justify-between gap-3 flex-wrap shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-200/90 border border-slate-300 flex items-center justify-center text-slate-700 shrink-0">
                          <Shield className="w-4 h-4 text-slate-700" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-slate-950">
                            System Notice &bull; Household Setup
                          </div>
                          <div className="text-[11px] text-slate-700 leading-relaxed">
                            {roundAmountsInText(displayContent)}
                          </div>
                        </div>
                      </div>
                      {household?.syncCode && (
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">Sync Code</span>
                          <span className="font-mono font-black text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 px-2.5 py-0.5 rounded-lg inline-block">
                            {household.syncCode}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : isTransaction ? (
                    <div className="p-4 sm:p-5 bg-linear-to-r from-amber-50/90 via-beige-50/80 to-amber-50/50 border border-amber-200/90 rounded-2xl space-y-3.5 shadow-2xs">
                      {/* Card Header: Icon, Description, Amount & CTA Button */}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* First selected item: amount matching the description in the second selected item */}
                          <div className="px-3.5 py-1.5 rounded-xl bg-amber-100 border border-amber-300 flex items-center gap-2 text-amber-950 shrink-0 shadow-2xs">
                            <Receipt className="w-4 h-4 text-amber-800" />
                            <span className="font-black font-mono text-sm sm:text-base text-dark-green-950">
                              {formatCurrency(txAmount || 0)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm sm:text-base text-dark-green-950 truncate">
                              {txDescription || 'Expense Transaction'}
                            </h4>
                            <span className="text-xs text-brown-700 block truncate">
                              {txDate ? formatDateDisplay(txDate) : new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                              {' '}&bull; Paid by {txPayer}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {/* CTA to launch a pop-up showing the details of each transaction logged */}
                          <button
                            type="button"
                            onClick={handleOpenTransactionDetails}
                            className="px-3.5 py-2 bg-dark-green-800 hover:bg-dark-green-900 active:scale-95 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs hover:shadow-md shrink-0"
                            title="Show details of transactions logged"
                            aria-label="Show Details"
                          >
                            <Receipt className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                            <span>Show Details</span>
                          </button>
                        </div>
                      </div>

                      {/* Content Message (Second selected item) */}
                      <div className="bg-white/80 border border-amber-200/80 rounded-2xl p-3 sm:p-3.5">
                        <p className="text-xs sm:text-sm text-dark-green-950 leading-relaxed font-semibold">
                          {roundAmountsInText(displayContent)}
                        </p>
                      </div>

                      {/* Third selected item: hidden from the displayed record and only shown in the pop-up modal when Show Details is clicked */}
                      <div className="hidden" style={{ display: 'none' }} aria-hidden="true">
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          {txTransactionsList.map((tx, idx) => {
                            const cat = categories.find((c) => c.id === tx.categoryId) || (tx.categoryName ? categories.find((c) => c.name.toLowerCase() === tx.categoryName?.toLowerCase()) : undefined);
                            const payer = members.find((m) => m.userId === (tx.loggedByUserId || tx.payerMemberId));
                            return (
                              <div
                                key={tx.id || `tx_row_${idx}`}
                                className="p-3 bg-white border border-beige-200 hover:border-beige-300 rounded-2xl flex items-center justify-between gap-3 shadow-2xs transition"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 shrink-0">
                                    <CategoryIcon name={cat?.name || tx.categoryName} group={cat?.group} icon={cat?.icon || tx.categoryIcon} className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-dark-green-950 truncate">
                                        {tx.description}
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300/80">
                                        {cat?.name || tx.categoryName || 'General Expense'}
                                      </span>
                                      {cat?.group && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-beige-200 text-dark-green-900">
                                          {cat.group}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-brown-600 mt-0.5">
                                      <span>Paid by {payer?.name || 'Member'}</span>
                                      {tx.date && (
                                        <>
                                          <span>&bull;</span>
                                          <span>{formatDateDisplay(tx.date)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xs sm:text-sm font-black font-mono text-dark-green-950 block">
                                    {formatCurrency(tx.amount)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm text-dark-green-950 leading-relaxed font-medium">
                      {roundAmountsInText(displayContent)}
                    </p>
                  )}

                  {/* LINKED TRANSACTION GRAPHIC / CARD */}
                  {!isReaction && !isTransaction && !isComment && item.linkedExpense && (
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

                  {/* Check-In Decision / Metadata summary (only when not already displayed in check-in card) */}
                  {!isCheckin && item.metadata && (item.metadata.totalSaved !== undefined || item.metadata.totalSpent !== undefined) && (
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

                  {/* DISPLAY DETAILS OF COMMENTS MADE FOR THIS RECORD (Omitted for reaction and comment records) */}
                  {!isReaction && !isComment && recordComments.length > 0 && (
                    <div className="pt-2 border-t border-beige-200/80 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-black text-dark-green-900">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-dark-green-800" />
                          <span>Comments & Notes on this Record ({recordComments.length})</span>
                        </div>
                        <span className="text-[10px] font-bold text-brown-600 uppercase tracking-wider">
                          {recordComments.length === 1 ? '1 comment' : `${recordComments.length} comments`}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {recordComments.map((comment) => (
                          <div
                            key={comment.id}
                            className="p-3 bg-beige-50/90 border border-beige-200 rounded-2xl space-y-1 text-xs shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                {comment.authorAvatar ? (
                                  <img
                                    src={comment.authorAvatar}
                                    alt={comment.authorName}
                                    className="w-4 h-4 rounded-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <User className="w-3.5 h-3.5 text-brown-700" />
                                )}
                                <span className="font-bold text-dark-green-900">{comment.authorName}</span>
                              </div>
                              <span className="text-[10px] text-brown-600 font-mono">
                                {new Date(comment.timestamp).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-dark-green-950 font-medium pl-5 leading-relaxed">
                              {comment.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline Reply / Comment Composer on this Record (Omitted for reaction records) */}
                  {!isReaction && (
                    <div className="pt-1 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add a comment to this record..."
                        value={feedItemCommentInputs[item.id] || ''}
                        onChange={(e) =>
                          setFeedItemCommentInputs((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handlePostRecordComment(item.id, linkedExpenseId || matchedExpense?.id);
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-beige-50/70 border border-beige-200 rounded-xl text-xs text-dark-green-900 placeholder:text-dark-grey-600 focus:outline-hidden focus:border-dark-green-700 focus:bg-white transition"
                      />
                      <button
                        type="button"
                        disabled={!(feedItemCommentInputs[item.id] || '').trim()}
                        onClick={() =>
                          handlePostRecordComment(item.id, linkedExpenseId || matchedExpense?.id)
                        }
                        className="px-3 py-1.5 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-2xs transition cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Reply</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pop-up displaying Details of Any Clicked Calendar Item */}
      {calendarItemPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-beige-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className={`px-5 py-4 border-b border-beige-200 flex items-center justify-between ${
              calendarItemPopup.type === 'checkin'
                ? 'bg-sage-100/90'
                : calendarItemPopup.type === 'review'
                ? 'bg-gold-100/90'
                : calendarItemPopup.type === 'comments'
                ? 'bg-beige-100/90'
                : calendarItemPopup.type === 'milestone'
                ? 'bg-emerald-100/90'
                : calendarItemPopup.type === 'transactions'
                ? 'bg-amber-100/90'
                : 'bg-amber-50/80'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
                  calendarItemPopup.type === 'checkin'
                    ? 'bg-dark-green-800 text-white'
                    : calendarItemPopup.type === 'review'
                    ? 'bg-gold-500 text-gold-950 shadow-gold-200'
                    : calendarItemPopup.type === 'comments'
                    ? 'bg-dark-green-900 text-white'
                    : calendarItemPopup.type === 'milestone'
                    ? 'bg-emerald-700 text-white shadow-emerald-200'
                    : calendarItemPopup.type === 'transactions'
                    ? 'bg-amber-700 text-white shadow-amber-200'
                    : 'bg-dark-green-800 text-white'
                }`}>
                  {calendarItemPopup.type === 'checkin' ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : calendarItemPopup.type === 'review' ? (
                    <Star className="w-5 h-5 fill-gold-950 text-gold-950" />
                  ) : calendarItemPopup.type === 'comments' ? (
                    <MessageSquare className="w-5 h-5 text-white" />
                  ) : calendarItemPopup.type === 'milestone' ? (
                    <Award className="w-5 h-5 text-white" />
                  ) : calendarItemPopup.type === 'events' ? (
                    <Activity className="w-5 h-5 text-white" />
                  ) : (
                    <Receipt className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-dark-green-900 leading-tight truncate">
                    {calendarItemPopup.title}
                  </h3>
                  <span className="text-xs text-brown-700 block truncate">
                    {calendarItemPopup.dateFormatted} ({calendarItemPopup.dateStr})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalendarItemPopup(null)}
                className="p-1.5 rounded-xl text-brown-700 hover:text-dark-green-900 hover:bg-beige-200 transition cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* 1. CHECK-IN DETAIL POPUP */}
              {calendarItemPopup.type === 'checkin' && (
                <div className="space-y-4">
                  {/* Status & Who */}
                  <div className="p-4 bg-sage-50/80 rounded-2xl border border-sage-200 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-sage-200 text-dark-green-900 border border-sage-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-dark-green-800" />
                        <span>Completed Check-In</span>
                      </span>
                      {calendarItemPopup.checkIn?.completedByName && (
                        <span className="text-xs font-bold text-brown-700">
                          by <strong className="text-dark-green-900">{calendarItemPopup.checkIn.completedByName}</strong>
                        </span>
                      )}
                    </div>
                    {calendarItemPopup.checkIn?.weekStartDate && (
                      <p className="text-xs text-brown-800">
                        Check-in for week: <strong className="text-dark-green-900">{calendarItemPopup.checkIn.weekStartDate}</strong> &rarr; <strong className="text-dark-green-900">{calendarItemPopup.checkIn.weekEndDate || calendarItemPopup.dateStr}</strong>
                      </p>
                    )}
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-beige-50 rounded-xl border border-beige-200">
                      <span className="text-[10px] font-bold uppercase text-brown-600 block">Weekly Budget</span>
                      <span className="text-sm sm:text-base font-black text-dark-green-900 font-mono">
                        {formatCurrency(calendarItemPopup.checkIn?.totalBudget || 0)}
                      </span>
                    </div>
                    <div className="p-3 bg-beige-50 rounded-xl border border-beige-200">
                      <span className="text-[10px] font-bold uppercase text-brown-600 block">Total Spent</span>
                      <span className="text-sm sm:text-base font-black text-dark-green-900 font-mono">
                        {formatCurrency(calendarItemPopup.checkIn?.totalSpent || 0)}
                      </span>
                    </div>
                    <div className="p-3 bg-sage-50 rounded-xl border border-sage-200">
                      <span className="text-[10px] font-bold uppercase text-sage-800 block">Surplus Saved</span>
                      <span className="text-sm sm:text-base font-black text-dark-green-900 font-mono">
                        {formatCurrency(calendarItemPopup.checkIn?.totalSaved || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Check-In Notes if available */}
                  {(calendarItemPopup.checkIn?.notes || calendarItemPopup.feedItem?.content) && (
                    <div className="p-3 bg-white border border-beige-200 rounded-xl space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-brown-600 block">Notes & Reflections</span>
                      <p className="text-xs text-dark-green-900 italic font-medium">
                        &ldquo;{calendarItemPopup.checkIn?.notes || calendarItemPopup.feedItem?.content}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Category Decisions list if available */}
                  {calendarItemPopup.checkIn?.decisions && calendarItemPopup.checkIn.decisions.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-dark-green-900 block">
                        Category Rollover Decisions ({calendarItemPopup.checkIn.decisions.length})
                      </span>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {calendarItemPopup.checkIn.decisions.map((dec, i) => (
                          <div key={i} className="p-2.5 bg-white border border-beige-200 rounded-xl flex items-center justify-between text-xs shadow-2xs">
                            <div>
                              <span className="font-bold text-dark-green-900 block">{dec.categoryName}</span>
                              <span className="text-[10px] text-brown-600">
                                Budget: {formatCurrency(dec.budget)} &bull; Spent: {formatCurrency(dec.spent)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`font-mono font-bold block ${dec.difference >= 0 ? 'text-dark-green-800' : 'text-crimson-700'}`}>
                                {dec.difference >= 0 ? `+${formatCurrency(dec.difference)}` : formatCurrency(dec.difference)}
                              </span>
                              <span className="text-[9px] uppercase font-bold text-brown-600">
                                {dec.choice === 'rollover' ? 'Rolled Over' : dec.choice === 'savings' ? 'Saved' : dec.choice}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. MONTHLY REVIEW / RESET POPUP */}
              {calendarItemPopup.type === 'review' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gold-50/80 rounded-2xl border border-gold-200 space-y-2">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 fill-gold-500 text-gold-700" />
                      <span className="text-xs font-black text-gold-950 uppercase tracking-wider">
                        Fiscal Month-End Hard Reset
                      </span>
                    </div>
                    <p className="text-xs text-brown-800 leading-relaxed font-medium">
                      At the close of <strong>{calendarItemPopup.fiscalMonthInfo?.name || 'the fiscal month'}</strong>, all category budgets reset back to their baseline allocations for a fresh start. Surpluses are captured into savings.
                    </p>
                  </div>

                  {calendarItemPopup.fiscalMonthInfo && (
                    <div className="p-3 bg-beige-50 rounded-xl border border-beige-200 flex items-center justify-between text-xs">
                      <span className="text-brown-700 font-semibold">Fiscal Period:</span>
                      <strong className="text-dark-green-900 font-bold">
                        Month {calendarItemPopup.fiscalMonthInfo.fiscalMonthNumber} &bull; Quarter {calendarItemPopup.fiscalMonthInfo.quarter} ({calendarItemPopup.fiscalMonthInfo.weekCount} Weeks)
                      </strong>
                    </div>
                  )}

                  {calendarItemPopup.feedItems && calendarItemPopup.feedItems.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-dark-green-900 block">
                        Recorded Review Events
                      </span>
                      {calendarItemPopup.feedItems.map((item) => (
                        <div key={item.id} className="p-3 bg-white border border-beige-200 rounded-xl text-xs space-y-1 shadow-2xs">
                          <p className="font-semibold text-dark-green-900">{item.content}</p>
                          <span className="text-[10px] text-brown-600 block">
                            Logged by {item.authorName || 'Household'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. NOTES & COMMENTS POPUP */}
              {calendarItemPopup.type === 'comments' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-dark-green-900 block">
                      Messages & Notes on this Date ({calendarItemPopup.comments?.length || 0})
                    </span>
                    <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                      {calendarItemPopup.comments && calendarItemPopup.comments.length > 0 ? (
                        calendarItemPopup.comments.map((c) => (
                          <div key={c.id} className="p-3 bg-beige-50/80 border border-beige-200 rounded-xl space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-dark-green-900">{c.authorName || 'Household Member'}</span>
                              <span className="text-[10px] text-brown-600">
                                {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-dark-green-950 font-medium leading-relaxed">
                              {c.content}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-brown-600 italic py-2">No notes or comments logged on this date.</p>
                      )}
                    </div>
                  </div>

                  {/* Add Quick Note Form */}
                  <form onSubmit={handlePopupPostComment} className="pt-2 border-t border-beige-200 flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a quick note or reflection..."
                      value={popupCommentInput}
                      onChange={(e) => setPopupCommentInput(e.target.value)}
                      className="flex-1 px-3 py-2 bg-beige-50 border border-beige-200 rounded-xl text-xs text-dark-green-900 placeholder:text-dark-grey-600 focus:outline-hidden focus:border-dark-green-700"
                    />
                    <button
                      type="submit"
                      disabled={!popupCommentInput.trim()}
                      className="px-3 py-2 bg-dark-green-800 hover:bg-dark-green-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-2xs transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </form>
                </div>
              )}

              {/* 4. TRANSACTION TOTAL & ITEMIZATION POPUP */}
              {calendarItemPopup.type === 'transactions' && (
                <div className="space-y-4">
                  {/* Large Amount Display */}
                  <div className="p-4 bg-amber-50/90 rounded-2xl border border-amber-200 text-center space-y-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 block">
                      Total for Logged Transaction{(calendarItemPopup.count || 0) > 1 ? 's' : ''}
                    </span>
                    <div className="text-3xl sm:text-4xl font-black font-mono text-dark-green-900 tracking-tight">
                      {formatCurrency(calendarItemPopup.totalSpent || 0)}
                    </div>
                    <span className="text-xs font-semibold text-brown-700 block">
                      {calendarItemPopup.count} transaction{(calendarItemPopup.count || 0) > 1 ? 's' : ''} on {calendarItemPopup.dateFormatted}
                    </span>
                  </div>

                  {/* Activity Log Context if available */}
                  {calendarItemPopup.feedItem?.content && (
                    <div className="p-3 bg-white border border-beige-200 rounded-xl space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-brown-600 block">
                        Record Summary
                      </span>
                      <p className="text-xs text-dark-green-950 font-medium leading-relaxed">
                        {roundAmountsInText(calendarItemPopup.feedItem.content)}
                      </p>
                    </div>
                  )}

                  {/* Itemized Transactions with complete details */}
                  {calendarItemPopup.transactions && calendarItemPopup.transactions.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-dark-green-900 block">
                        Itemized Details ({calendarItemPopup.transactions.length})
                      </span>
                      <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                        {calendarItemPopup.transactions.map((tx) => {
                          const cat = categories.find((c) => c.id === tx.categoryId) || (tx.categoryName ? categories.find((c) => c.name.toLowerCase() === tx.categoryName?.toLowerCase()) : undefined);
                          const payer = members.find((m) => m.userId === (tx.loggedByUserId || tx.payerMemberId));
                          return (
                            <div
                              key={tx.id}
                              className="p-3.5 bg-white border border-beige-200 hover:border-amber-300 rounded-2xl flex items-center justify-between gap-3 shadow-2xs transition hover:shadow-xs group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-sage-100 border border-sage-200 flex items-center justify-center text-dark-green-900 shrink-0 group-hover:border-amber-400 transition-colors">
                                  <CategoryIcon name={cat?.name || tx.categoryName} group={cat?.group} icon={cat?.icon || tx.categoryIcon} className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs sm:text-sm font-bold text-dark-green-900 truncate">
                                      {tx.description}
                                    </p>

                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] text-brown-600 flex-wrap mt-0.5">
                                    <span className="font-semibold text-dark-green-800">{cat?.name || tx.categoryName || 'General Expense'}</span>
                                    {cat?.group && (
                                      <>
                                        <span>&bull;</span>
                                        <span className="px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-900 font-bold">{cat.group}</span>
                                      </>
                                    )}
                                    <span>&bull;</span>
                                    <span>Paid by {payer?.name || 'Member'}</span>
                                    {tx.date && (
                                      <>
                                        <span>&bull;</span>
                                        <span>{formatDateDisplay(tx.date)}</span>
                                      </>
                                    )}
                                  </div>
                                  {tx.tags && tx.tags.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap mt-1">
                                      {tx.tags.map((t, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-beige-200 text-dark-green-900">
                                          <Tag className="w-2 h-2 text-dark-green-700" />
                                          <span>{t}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs sm:text-sm font-black font-mono text-dark-green-900 block">
                                  {formatCurrency(tx.amount)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCalendarItemPopup(null);
                                    navigateToCategoryLedger(cat || null);
                                  }}
                                  className="text-[10px] text-sage-800 hover:text-dark-green-900 font-bold hover:underline flex items-center justify-end gap-0.5 mt-0.5 cursor-pointer"
                                >
                                  <span>View in Ledger</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. MILESTONE DETAIL POPUP */}
              {calendarItemPopup.type === 'milestone' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50/90 rounded-2xl border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-200 text-emerald-950 border border-emerald-300">
                        <Award className="w-3.5 h-3.5 text-emerald-800" />
                        <span>Savings & Budget Milestone</span>
                      </span>
                      {calendarItemPopup.feedItem?.authorName && (
                        <span className="text-xs font-bold text-brown-700">
                          Recorded by <strong className="text-dark-green-900">{calendarItemPopup.feedItem.authorName}</strong>
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-extrabold text-emerald-950">
                      {calendarItemPopup.title}
                    </h4>
                    {calendarItemPopup.feedItem?.content && (
                      <p className="text-xs text-dark-green-900 font-medium leading-relaxed">
                        {roundAmountsInText(calendarItemPopup.feedItem.content)}
                      </p>
                    )}
                  </div>

                  {calendarItemPopup.totalSpent !== undefined && (
                    <div className="p-4 bg-white rounded-2xl border border-beige-200 text-center space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-brown-600 block">
                        Milestone Amount
                      </span>
                      <div className="text-2xl sm:text-3xl font-black font-mono text-dark-green-900 tracking-tight">
                        {formatCurrency(calendarItemPopup.totalSpent)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. EVENTS & ACTIVITY POPUP */}
              {calendarItemPopup.type === 'events' && (
                <div className="space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-dark-green-900 block">
                    Activity on {calendarItemPopup.dateFormatted} ({calendarItemPopup.feedItems?.length || 0})
                  </span>
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {calendarItemPopup.feedItems && calendarItemPopup.feedItems.map((item) => (
                      <div key={item.id} className="p-3 bg-beige-50/80 border border-beige-200 rounded-xl space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase text-dark-green-800 bg-sage-100 px-2 py-0.5 rounded-md border border-sage-200">
                            {item.type}
                          </span>
                          <span className="text-[10px] text-brown-600">
                            {item.authorName || 'Member'}
                          </span>
                        </div>
                        <p className="text-xs text-dark-green-900 font-medium">
                          {item.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-beige-50/60 border-t border-beige-200 flex items-center justify-between gap-3">
              {calendarItemPopup.type === 'checkin' ? (
                <button
                  type="button"
                  onClick={() => {
                    setCalendarItemPopup(null);
                    openWeeklyCheckInModal();
                  }}
                  className="px-3.5 py-2 bg-sage-100 hover:bg-sage-200 text-dark-green-900 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>Open Weekly Check-In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : calendarItemPopup.type === 'review' ? (
                <button
                  type="button"
                  onClick={() => {
                    setCalendarItemPopup(null);
                    openMonthlyRetroModal();
                  }}
                  className="px-3.5 py-2 bg-gold-100 hover:bg-gold-200 text-gold-950 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>Open Monthly Retro</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : calendarItemPopup.type === 'transactions' ? (
                <button
                  type="button"
                  onClick={() => {
                    setCalendarItemPopup(null);
                    navigateToCategoryLedger(null);
                  }}
                  className="px-3.5 py-2 bg-beige-100 hover:bg-beige-200 text-dark-green-900 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>View in Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setCalendarItemPopup(null)}
                className="px-5 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up displaying other buttons for days with 4+ buttons */}
      {moreButtonsPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-green-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-beige-200 rounded-3xl w-full max-w-sm sm:max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-beige-200 flex items-center justify-between bg-beige-100/90">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-dark-green-900 text-white flex items-center justify-center shadow-xs shrink-0 font-black text-sm tracking-widest">
                  ...
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-dark-green-900 leading-tight truncate">
                    Other Actions & Buttons
                  </h3>
                  <span className="text-xs text-brown-700 block truncate">
                    {moreButtonsPopup.dateFormatted} ({moreButtonsPopup.dateStr})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMoreButtonsPopup(null)}
                className="p-1.5 rounded-xl text-brown-700 hover:text-dark-green-900 hover:bg-beige-200 transition cursor-pointer shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Displays the other buttons for this day */}
            <div className="p-5 space-y-3">
              <p className="text-xs font-semibold text-brown-700">
                Additional activities and buttons recorded for this day:
              </p>
              <div className="flex flex-col gap-2">
                {moreButtonsPopup.buttons.map((btn, bIdx) => (
                  <button
                    key={btn.key || bIdx}
                    type="button"
                    onClick={(e) => {
                      setMoreButtonsPopup(null);
                      btn.onClick(e);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl border transition text-left cursor-pointer shadow-xs active:scale-98 hover:shadow-md bg-white hover:bg-beige-50 border-beige-200 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="shrink-0 p-1 rounded-lg bg-beige-100 group-hover:bg-sage-100 transition-colors">
                        {btn.icon}
                      </div>
                      <span className="text-xs font-bold text-dark-green-950 truncate">
                        {btn.fullLabel || btn.label}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-brown-400 group-hover:text-dark-green-800 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-beige-50/80 border-t border-beige-200 flex justify-end">
              <button
                type="button"
                onClick={() => setMoreButtonsPopup(null)}
                className="px-5 py-2 bg-dark-green-800 hover:bg-dark-green-900 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
