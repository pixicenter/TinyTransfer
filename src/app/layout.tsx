'use client';

import React, { useEffect } from "react";
import { Inter } from "next/font/google";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { SettingsProvider, useSettings } from "../lib/SettingsContext";
import { usePathname } from "next/navigation";
import "./globals.css";
import { LocaleProvider, useLocale } from '../lib/LocaleContext';

const inter = Inter({ subsets: ["latin"] });

// The wrapper component that allows access to the settings
function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings } = useSettings();
  const { locale } = useLocale();
  const isDownloadPage = pathname.startsWith('/download/');
  const isLoginPage = pathname.startsWith('/auth/login');
  const isSetupPage = pathname.startsWith('/auth/setup');
  const isRootPage = pathname === '/';
  // Apply the theme to the body and documentHTML
  useEffect(() => {
    // Set the theme to body and html
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    
    // Update the page title
    document.title = settings.app_name || 'TinyTransfer';
    
    // Update the lang attribute of the HTML element
    document.documentElement.lang = locale;
  }, [settings, locale]);

  // Color classes for theme - not applied on download pages
  const bgColor = isDownloadPage 
    ? '' 
    : (settings.theme === 'dark' 
      ? 'bg-gray-900 text-white' 
      : 'bg-gray-50 text-gray-900');

  return (
    <div className={`flex flex-col min-h-screen ${bgColor}`}>
      {/* Display Header and Footer only if we are not on the download page */}
      {!isDownloadPage && !isLoginPage && !isSetupPage && !isRootPage && <Header />}
      <main className={`flex-grow ${isDownloadPage ? '' : ''}`}>
        {children}
      </main>
      {!isDownloadPage && !isLoginPage && !isSetupPage && !isRootPage && <Footer />}
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SettingsProvider>
          <LocaleProvider>
            <AppContent>
              {children}
            </AppContent>
          </LocaleProvider>
        </SettingsProvider>
      </body>
    </html>
  )
}
