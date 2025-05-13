'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export interface AppSettings {
  id: number;
  app_name: string;
  logo_url: string | null;
  logo_url_dark: string | null;
  logo_url_light: string | null;
  logo_type: 'url' | 'file';
  theme: 'light' | 'dark';
  language: 'ro' | 'en';
  slideshow_interval: number;
  slideshow_effect: 'fade' | 'slide' | 'zoom';
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: AppSettings = {
  id: 1,
  app_name: 'TinyTransfer',
  logo_url: null,
  logo_url_dark: null,
  logo_url_light: null,
  logo_type: 'url',
  theme: 'dark',
  language: 'en',
  slideshow_interval: 6000,
  slideshow_effect: 'fade'
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: async () => {},
  isLoading: true
});

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Check if we are on the download page (visitor) or in the admin panel
        const isDownloadPage = pathname?.startsWith('/download/');
        const isLoginPage = pathname?.startsWith('/auth/login');
        
        // Use the specific route based on the page
        const endpoint = isDownloadPage ? '/slideshow-settings' : isLoginPage ? '/slideshow-settings' : '/api/settings';
        
        
        const response = await fetch(endpoint);
        
        if (response.ok) {
          const data = await response.json();
          
          if (isDownloadPage) {
            // For the download page, integrate only the received settings with the default ones
            // to ensure compatibility with the AppSettings interface
            setSettings({
              ...defaultSettings,
              app_name: data.app_name,
              logo_url: data.logo_url,
              slideshow_interval: data.slideshow_interval,
              slideshow_effect: data.slideshow_effect as 'fade' | 'slide' | 'zoom',
            });
          } 
          else if (isLoginPage) {
            // For the login page, use all the received data
            setSettings({
              ...defaultSettings,
              app_name: data.app_name,
              logo_url: data.logo_url,
              logo_url_dark: data.logo_url_dark,
              logo_url_light: data.logo_url_light,
              logo_type: data.logo_type,
              language: data.language  
          });
        }
          else {
            // For the admin panel, use all the received data
            setSettings(data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [pathname]);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      setIsLoading(true);
      
      console.log('Sending settings update to server:', newSettings);
      
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
        credentials: 'include'
      });
      
      if (response.ok) {
        const updatedSettings = await response.json();
        console.log('Received updated settings from server:', updatedSettings);
        
        setSettings(updatedSettings);
        return updatedSettings;
      } else {
        const errorData = await response.json();
        console.error('Error from server during settings update:', errorData);
        throw new Error(errorData.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error during settings update:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);

export default SettingsContext; 