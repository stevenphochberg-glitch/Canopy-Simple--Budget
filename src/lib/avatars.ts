/**
 * Earth-Tone Faceless Vector Avatar Generator
 * Generates clean, generic, faceless "circle head on shoulders" vector avatars
 * using the established Canopy earth-tone palette without stock photos.
 */

export interface AvatarTheme {
  id: string;
  name: string;
  bgColor: string;
  fgColor: string;
}

export const EARTH_TONE_AVATAR_THEMES: AvatarTheme[] = [
  { id: 'dark_green', name: 'Dark Green on Forest', bgColor: '#2D3E2F', fgColor: '#A3B899' },
  { id: 'brown_beige', name: 'Brown on Beige', bgColor: '#EDE7DC', fgColor: '#7C5E43' },
  { id: 'sky_blue', name: 'Sky Blue on Ocean', bgColor: '#E0F2FE', fgColor: '#0369A1' },
  { id: 'sage_olive', name: 'Sage on Olive', bgColor: '#DCE5D8', fgColor: '#4A6B46' },
  { id: 'terracotta', name: 'Terracotta on Cream', bgColor: '#FDF4EB', fgColor: '#B85D36' },
  { id: 'warm_taupe', name: 'Warm Taupe', bgColor: '#F2ECE4', fgColor: '#6B584C' },
  { id: 'slate', name: 'Deep Slate', bgColor: '#334155', fgColor: '#94A3B8' },
  { id: 'sandstone', name: 'Sandstone Gold', bgColor: '#FAF3E0', fgColor: '#8C6D37' },
];

/**
 * Generates an SVG Data URI for a faceless vector avatar with a head circle and shoulder arc.
 */
export function generateFacelessVectorAvatar(themeIndex: number = 0): string {
  const theme = EARTH_TONE_AVATAR_THEMES[Math.abs(themeIndex) % EARTH_TONE_AVATAR_THEMES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="50" fill="${theme.bgColor}"/>
  <circle cx="50" cy="37" r="17" fill="${theme.fgColor}"/>
  <path d="M 22 88 C 22 65, 34 58, 50 58 C 66 58, 78 65, 78 88 Z" fill="${theme.fgColor}"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_AVATARS: string[] = EARTH_TONE_AVATAR_THEMES.map((_, i) =>
  generateFacelessVectorAvatar(i)
);
