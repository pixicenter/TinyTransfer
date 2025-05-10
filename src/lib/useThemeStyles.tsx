'use client';

import { useSettings } from './SettingsContext';

/**
 * Hook that provides Tailwind CSS styles based on the current theme
 * @returns An object with the CSS classes for different elements
 */
export function useThemeStyles() {
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';

  return {
    // Backgrounds
    pageBg: isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-blue-50 to-indigo-50',
    cardBg: isDark ? 'bg-gray-800 backdrop-blur-sm bg-opacity-90 shadow-lg' : 'bg-white backdrop-blur-sm bg-opacity-90 shadow-lg',
    
    // Texts
    headingText: isDark ? 'text-white' : 'text-indigo-900',
    cardTitle: isDark ? 'text-gray-100' : 'text-gray-900',
    subText: isDark ? 'text-gray-300' : 'text-gray-600',
    secondaryText: isDark ? 'text-gray-400' : 'text-gray-500',
    labelText: isDark ? 'text-gray-300' : 'text-gray-700',
    
    // UI elements
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    input: isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500',
    radioInput: isDark ? 'border-gray-600 bg-gray-700 focus:ring-indigo-500' : 'border-gray-300 bg-white focus:ring-indigo-500',
    skeletonBg: isDark ? 'bg-gray-700' : 'bg-gray-200',
    
    // Accent colors
    primaryBg: isDark ? 'bg-indigo-900/30' : 'bg-indigo-50',
    primaryText: isDark ? 'text-indigo-400' : 'text-indigo-600',
    successBg: isDark ? 'bg-green-900/30' : 'bg-green-50',
    successText: isDark ? 'text-green-400' : 'text-green-600',
    warningBg: isDark ? 'bg-yellow-900/30' : 'bg-yellow-50',
    warningText: isDark ? 'text-yellow-400' : 'text-yellow-600',
    dangerBg: isDark ? 'bg-red-900/30' : 'bg-red-50',
    dangerText: isDark ? 'text-red-400' : 'text-red-600',
    
    // Hover and focus
    hoverCard: isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50',
    
    // Links
    link: isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800',
    
    // Misc
    divider: isDark ? 'border-gray-700' : 'border-gray-200',
  };
} 