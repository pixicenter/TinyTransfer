'use client';

import React from 'react';
import { useSettings } from '../lib/SettingsContext';
import { useLocale } from '../lib/LocaleContext';

export default function Footer() {
  const { settings } = useSettings();
  const { t } = useLocale();
  const currentYear = new Date().getFullYear();

  // CSS classes for theme
  const bgColor = settings.theme === 'dark' ? 'bg-gray-900' : 'bg-white';
  const textColor = settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  return (
    <footer className={`${bgColor} shadow-inner`}>
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className={`${textColor} text-sm`}>
            &copy; {currentYear} {settings.app_name}. {t('footer.copyright')}
          </div>
          <div className="mt-2 md:mt-0">
            <p className={`${textColor} text-sm`}>
              {t('footer.tagline')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
} 