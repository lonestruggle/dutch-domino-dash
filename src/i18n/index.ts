import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import nl from './locales/nl.json';
import en from './locales/en.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      nl: { translation: nl },
      en: { translation: en },
    },
    fallbackLng: 'nl',
    supportedLngs: ['nl', 'en'],
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'lang',
    },
    returnNull: false,
  });

export default i18n;

export const setAppLanguage = (lng: 'nl' | 'en') => {
  void i18n.changeLanguage(lng);
  try { localStorage.setItem('lang', lng); } catch { /* ignore */ }
};