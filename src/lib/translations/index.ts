import en from './en';
import ro from './ro';

export interface Translations {
  [key: string]: any;
}

export type TranslationKey = string;

export type LanguageCode = 'en' | 'ro';

export const translations: Record<LanguageCode, Translations> = {
  en,
  ro
};

export default translations; 