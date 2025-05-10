'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import translations, { LanguageCode, Translations } from './translations';
import { useSettings } from './SettingsContext';

interface LocaleContextType {
  locale: LanguageCode;
  setLocale: (locale: LanguageCode) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'en',
  setLocale: () => {},
  t: () => '',
});

interface LocaleProviderProps {
  children: ReactNode;
}

export const LocaleProvider: React.FC<LocaleProviderProps> = ({ children }) => {
  const { settings } = useSettings();
  const [locale, setLocaleState] = useState<LanguageCode>('en');

  useEffect(() => {
    // Update the language according to the application settings
    if (settings.language && (settings.language === 'en' || settings.language === 'ro')) {
      setLocaleState(settings.language);
    }
  }, [settings.language]);

  const setLocale = (newLocale: LanguageCode) => {
    setLocaleState(newLocale);
  };

  // Function for getting the translation
  const t = (key: string): string => {
    // Split the key by dots to navigate in the object structure
    const keys = key.split('.');
    
    let translation: any = translations[locale];
    
    // Iterate through the object structure to find the value corresponding to the key
    for (const k of keys) {
      if (translation && translation[k] !== undefined) {
        translation = translation[k];
      } else {
        // If the translation is not found, try in English
        console.warn(`Translation key not found: ${key} in ${locale}`);
        
        let fallbackTranslation = translations['en'];
        for (const fallbackKey of keys) {
          if (fallbackTranslation && fallbackTranslation[fallbackKey] !== undefined) {
            fallbackTranslation = fallbackTranslation[fallbackKey];
          } else {
            // If the translation is not found in English, return the key
            return key;
          }
        }
        
        return typeof fallbackTranslation === 'string' ? fallbackTranslation : key;
      }
    }
    
    return typeof translation === 'string' ? translation : key;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = () => useContext(LocaleContext);

export default LocaleContext; 