'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSettings } from '../lib/SettingsContext';
import { useLocale } from '../lib/LocaleContext';
import Image from 'next/image';

export default function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { settings } = useSettings();
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Check if the user is a visitor on the download page
  const isVisitorOnDownloadPage = pathname?.startsWith('/download/');

  // Check if the user is authenticated
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
  }, [pathname, t]);

  // Logout function
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        setIsLoggedIn(false);
        router.push('/');
      }
    } catch (error) {
      console.error(t('errors.logoutError'), error);
    }
  };

  // CSS classes for theme
  const bgColor = settings.theme === 'dark' ? 'bg-gray-900' : 'bg-white';
  const textColor = settings.theme === 'dark' ? 'text-white' : 'text-indigo-600';
  const navTextColor = settings.theme === 'dark' ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-indigo-600';

  return (
    <header className={`${bgColor} shadow-md`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link href={isLoggedIn ? "/dashboard" : "/"} className={`${textColor} font-bold text-xl flex items-center`}>
              {(settings.logo_type === 'file' && ((settings.theme === 'dark' && settings.logo_url_dark) || (settings.theme === 'light' && settings.logo_url_light))) ? (
                <Image 
                  src={settings.theme === 'dark' ? settings.logo_url_dark! : settings.logo_url_light!} 
                  alt={settings.app_name} 
                  width={32}
                  height={32}
                  className="h-8 w-auto mr-2"
                  unoptimized
                />
              ) : (settings.logo_type === 'url' && ((settings.theme === 'dark' && settings.logo_url_dark) || (settings.theme === 'light' && settings.logo_url_light))) ? (
                <Image 
                  src={settings.theme === 'dark' ? settings.logo_url_dark! : settings.logo_url_light!} 
                  alt={settings.app_name} 
                  width={32}
                  height={32}
                  className="h-8 w-auto mr-2"
                  unoptimized
                />
              ) : (
                <svg className="w-8 h-8 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
              {settings.app_name}
            </Link>
          </div>

          {!isVisitorOnDownloadPage && (
            <div className="hidden md:block">
              {isLoggedIn ? (
                <div className="ml-10 flex items-center space-x-4">
                  <Link href="/dashboard" className={`px-3 py-2 rounded-md text-sm font-medium ${pathname === '/dashboard' ? 'bg-indigo-600 text-white' : navTextColor}`}>
                    {t('header.dashboard')}
                  </Link>
                  <Link href="/transfers" className={`px-3 py-2 rounded-md text-sm font-medium ${pathname === '/transfers' ? 'bg-indigo-600 text-white' : navTextColor}`}>
                    {t('header.transfers')}
                  </Link>
                  <Link href="/admin/settings" className={`px-3 py-2 rounded-md text-sm font-medium ${pathname === '/admin/settings' ? 'bg-indigo-600 text-white' : navTextColor}`}>
                    {t('header.settings')}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    {t('auth.logout')}
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <div className="md:hidden">
            {!isVisitorOnDownloadPage && (
              isLoggedIn ? (
                <button 
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={`${settings.theme === 'dark' ? 'text-white' : 'text-gray-800'} hover:bg-gray-100 inline-flex items-center justify-center p-2 rounded-md focus:outline-none`}
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {menuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              ) : null
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && !isVisitorOnDownloadPage && isLoggedIn && (
        <div className="md:hidden">
          <div className={`px-2 pt-2 pb-3 space-y-1 sm:px-3 ${bgColor}`}>
            <Link href="/dashboard" className={`block px-3 py-2 rounded-md text-base font-medium ${pathname === '/dashboard' ? 'bg-indigo-600 text-white' : navTextColor}`}>
              {t('header.dashboard')}
            </Link>
            <Link href="/transfers" className={`block px-3 py-2 rounded-md text-base font-medium ${pathname === '/transfers' ? 'bg-indigo-600 text-white' : navTextColor}`}>
              {t('header.transfers')}
            </Link>
            <Link href="/admin/settings" className={`block px-3 py-2 rounded-md text-base font-medium ${pathname === '/admin/settings' ? 'bg-indigo-600 text-white' : navTextColor}`}>
              {t('header.settings')}
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-800"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      )}
    </header>
  );
} 