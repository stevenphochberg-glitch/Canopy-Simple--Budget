import React from 'react';
import {
  ShoppingBag,
  ShoppingCart,
  Coffee,
  Sparkles,
  Home,
  FileText,
  PiggyBank,
  TrendingUp,
  Tag,
  Car,
  Utensils,
  Smartphone,
  Zap,
  Folder,
  Layers,
  Heart,
  Briefcase,
  Gift,
  Shield,
  Plane,
  Baby,
} from 'lucide-react';

interface CategoryIconProps {
  name?: string;
  group?: string;
  icon?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const getCategoryLucideIcon = (iconOrName?: string, group?: string) => {
  const key = (iconOrName || group || '').toLowerCase();

  if (key === 'shopping-cart' || key.includes('grocery') || key.includes('groceries') || key.includes('food') || key.includes('market') || key.includes('supermarket')) {
    return ShoppingCart;
  }
  if (key === 'shopping-bag' || key.includes('essential') || key.includes('need') || key.includes('supplies') || key.includes('shopping')) {
    return ShoppingBag;
  }
  if (key === 'utensils' || key.includes('dining') || key.includes('restaurant') || key.includes('eat') || key.includes('lunch') || key.includes('dinner')) {
    return Utensils;
  }
  if (key === 'sparkles' || key.includes('fun') || key.includes('entertainment') || key.includes('hobby') || key.includes('leisure')) {
    return Sparkles;
  }
  if (key === 'coffee' || key.includes('coffee') || key.includes('cafe') || key.includes('drinks') || key.includes('starbucks')) {
    return Coffee;
  }
  if (key === 'file-text' || key.includes('bill') || key.includes('fixed') || key.includes('utility') || key.includes('utilities')) {
    return FileText;
  }
  if (key === 'home' || key.includes('rent') || key.includes('mortgage') || key.includes('housing') || key.includes('home')) {
    return Home;
  }
  if (key === 'car' || key.includes('transit') || key.includes('gas') || key.includes('car') || key.includes('transport') || key.includes('fuel')) {
    return Car;
  }
  if (key === 'smartphone' || key.includes('phone') || key.includes('subscription') || key.includes('stream') || key.includes('tech')) {
    return Smartphone;
  }
  if (key === 'piggy-bank' || key.includes('saving') || key.includes('vault') || key.includes('emergency')) {
    return PiggyBank;
  }
  if (key === 'trending-up' || key.includes('invest') || key.includes('stock') || key.includes('growth')) {
    return TrendingUp;
  }
  if (key === 'plane' || key.includes('travel') || key.includes('trip') || key.includes('vacation') || key.includes('flight')) {
    return Plane;
  }
  if (key === 'baby' || key.includes('kid') || key.includes('child') || key.includes('baby') || key.includes('daycare')) {
    return Baby;
  }
  if (key === 'heart' || key.includes('health') || key.includes('medical') || key.includes('care') || key.includes('pharmacy')) {
    return Heart;
  }

  // Group fallbacks
  if (group === 'Essentials') return ShoppingBag;
  if (group === 'Fun Money') return Sparkles;
  if (group === 'Bills') return FileText;
  if (group === 'Savings') return PiggyBank;

  return Tag;
};

export const getCategoryEmoji = (iconOrName?: string, group?: string): string => {
  const key = (iconOrName || group || '').toLowerCase();

  if (key === 'shopping-cart' || key.includes('grocery') || key.includes('groceries') || key.includes('food') || key.includes('market')) {
    return '🛒';
  }
  if (key === 'shopping-bag' || key.includes('essential') || key.includes('need') || key.includes('supplies')) {
    return '🛍️';
  }
  if (key === 'utensils' || key.includes('dining') || key.includes('restaurant') || key.includes('eat')) {
    return '🍽️';
  }
  if (key === 'sparkles' || key.includes('fun') || key.includes('entertainment') || key.includes('hobby')) {
    return '✨';
  }
  if (key === 'coffee' || key.includes('coffee') || key.includes('cafe')) {
    return '☕';
  }
  if (key === 'file-text' || key.includes('bill') || key.includes('fixed') || key.includes('utility')) {
    return '📄';
  }
  if (key === 'home' || key.includes('rent') || key.includes('mortgage') || key.includes('housing') || key.includes('home')) {
    return '🏠';
  }
  if (key === 'car' || key.includes('transit') || key.includes('gas') || key.includes('car') || key.includes('transport')) {
    return '🚗';
  }
  if (key === 'smartphone' || key.includes('phone') || key.includes('subscription') || key.includes('stream')) {
    return '📱';
  }
  if (key === 'piggy-bank' || key.includes('saving') || key.includes('vault') || key.includes('emergency')) {
    return '🐷';
  }
  if (key === 'trending-up' || key.includes('invest') || key.includes('stock') || key.includes('growth')) {
    return '📈';
  }
  if (key === 'plane' || key.includes('travel') || key.includes('trip') || key.includes('vacation')) {
    return '✈️';
  }
  if (key === 'baby' || key.includes('kid') || key.includes('child') || key.includes('baby') || key.includes('daycare')) {
    return '👶';
  }
  if (key === 'heart' || key.includes('health') || key.includes('medical') || key.includes('care')) {
    return '❤️';
  }

  if (group === 'Essentials') return '🛍️';
  if (group === 'Fun Money') return '✨';
  if (group === 'Bills') return '📄';
  if (group === 'Savings') return '🐷';

  return '🏷️';
};

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name,
  group,
  icon,
  className = 'w-5 h-5',
}) => {
  const IconComponent = getCategoryLucideIcon(icon || name, group);
  return <IconComponent className={className} />;
};
