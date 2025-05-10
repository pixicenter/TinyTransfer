'use client';

import React, { useEffect, useState } from "react";
import { useSettings } from "../../lib/SettingsContext";
import { useThemeStyles } from "../../lib/useThemeStyles";
import { useLocale } from "../../lib/LocaleContext";
import Link from 'next/link';
import Image from 'next/image';

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings } = useSettings();
  const styles = useThemeStyles();
  const { t, setLocale } = useLocale();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Add the download-page class to the body
  useEffect(() => {
    // Add the class to cancel the background
    document.documentElement.classList.add('download-page');
    document.body.classList.add('download-page');
    
    // Clean up on unmount
    return () => {
      document.documentElement.classList.remove('download-page');
      document.body.classList.remove('download-page');
    };
  }, []);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
          const data = await response.json();
          setIsLoggedIn(data.isAuthenticated);
        }
      } catch (error) {
        console.error(t('errors.authCheckFailed'), error);
        setIsLoggedIn(false);
      }
    };

    checkAuth();
  }, [t]);

  const handleLanguageChange = (newLocale: 'en' | 'ro') => {
    setLocale(newLocale);
    // Save the visitor preference in localStorage
    localStorage.setItem('preferredLocale', newLocale);
  };

  return (
    <div className="download-page flex flex-col min-h-screen" style={{ backgroundColor: '', background: 'none' }}>
      {/* Header only for admins */}
      {isLoggedIn && (
        <header className={`${styles.cardBg} shadow-sm sticky top-0 z-10`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <Link href="/dashboard" className={`${styles.headingText} font-bold text-xl flex items-center transition-transform hover:scale-105 duration-200`}>
                  {(settings.logo_type === 'file' && ((settings.theme === 'dark' && settings.logo_url_dark) || (settings.theme === 'light' && settings.logo_url_light))) ? (
                    <Image 
                      src={settings.theme === 'dark' ? settings.logo_url_dark! : settings.logo_url_light!} 
                      alt={settings.app_name} 
                      className="h-8 w-auto mr-2" 
                      width={32}
                      height={32}
                    />
                  ) : (settings.logo_type === 'url' && ((settings.theme === 'dark' && settings.logo_url_dark) || (settings.theme === 'light' && settings.logo_url_light))) ? (
                    <Image 
                      src={settings.theme === 'dark' ? settings.logo_url_dark! : settings.logo_url_light!} 
                      alt={settings.app_name} 
                      className="h-8 w-auto mr-2" 
                      width={32}
                      height={32}
                    />
                  ) : (
                    <svg className="w-8 h-8 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                  {settings.app_name}
                </Link>
              </div>
              
              <div className="hidden md:flex items-center space-x-4">
                <Link href="/dashboard" className={`px-3 py-2 rounded-md text-sm font-medium ${styles.primaryText} hover:bg-indigo-50 dark:hover:bg-gray-800 transition-colors`}>
                  {t('header.dashboard')}
                </Link>
                <Link href="/transfers" className={`px-3 py-2 rounded-md text-sm font-medium ${styles.primaryText} hover:bg-indigo-50 dark:hover:bg-gray-800 transition-colors`}>
                  {t('header.transfers')}
                </Link>
                <Link href="/admin/settings" className={`px-3 py-2 rounded-md text-sm font-medium ${styles.primaryText} hover:bg-indigo-50 dark:hover:bg-gray-800 transition-colors`}>
                  {t('header.settings')}
                </Link>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/auth/logout', { method: 'POST' });
                      if (response.ok) {
                        setIsLoggedIn(false);
                        window.location.href = '/';
                      }
                    } catch (error) {
                      console.error(t('errors.logoutError'), error);
                    }
                  }}
                  className="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  {t('auth.logout')}
                </button>
              </div>
              
              {/* Mobile menu for admins */}
              <div className="md:hidden">
                <button 
                  onClick={() => {
                    const menuElement = document.getElementById('mobile-menu');
                    if (menuElement) {
                      menuElement.classList.toggle('hidden');
                    }
                  }}
                  className={`${styles.cardTitle} hover:${styles.hoverCard} inline-flex items-center justify-center p-2 rounded-md focus:outline-none`}
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Mobile menu for admins */}
            <div id="mobile-menu" className="hidden md:hidden">
              <div className={`px-2 pt-2 pb-3 space-y-1 sm:px-3 ${styles.cardBg}`}>
                <Link href="/dashboard" className={`block px-3 py-2 rounded-md text-base font-medium ${styles.primaryText} hover:bg-indigo-50 dark:hover:bg-gray-800 transition-colors`}>
                  {t('header.dashboard')}
                </Link>
                <Link href="/transfers" className={`block px-3 py-2 rounded-md text-base font-medium ${styles.primaryText} hover:bg-indigo-50 dark:hover:bg-gray-800 transition-colors`}>
                  {t('header.transfers')}
                </Link>
                <Link href="/admin/settings" className={`block px-3 py-2 rounded-md text-base font-medium ${styles.primaryText} hover:bg-indigo-50 dark:hover:bg-gray-800 transition-colors`}>
                  {t('header.settings')}
                </Link>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/auth/logout', { method: 'POST' });
                      if (response.ok) {
                        setIsLoggedIn(false);
                        window.location.href = '/';
                      }
                    } catch (error) {
                      console.error(t('errors.logoutError'), error);
                    }
                  }}
                  className={`block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors`}
                >
                  {t('auth.logout')}
                </button>
              </div>
            </div>
          </div>
        </header>
      )}
      
      <main className="download-page flex-grow" >
        {children}
      </main>
      
      {/* Minimal footer - only for admins */}
      {isLoggedIn && (
        <footer className={`${styles.cardBg} py-6`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between space-y-3 md:space-y-0">
              <p className={`text-center md:text-left text-sm ${styles.secondaryText}`}>
                {t('footer.poweredBy')} {settings.app_name || 'TinyTransfer'} &copy; {new Date().getFullYear()}
              </p>
              <p className={`text-center md:text-right text-sm ${styles.secondaryText}`}>
                {t('footer.tagline')}
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
} 