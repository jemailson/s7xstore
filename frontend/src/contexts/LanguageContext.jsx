import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../lib/translations';
import API from '../api';

const LanguageContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: 'pt', label: 'Português (BR)', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' }
];

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem('app_language');
    if (saved && (saved === 'pt' || saved === 'en' || saved === 'es')) {
      return saved;
    }
    return 'pt';
  });

  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('app_language');
    if (!saved) {
      setDetecting(true);
      API.detectLanguage()
        .then(res => {
          if (res?.language && (res.language === 'pt' || res.language === 'en' || res.language === 'es')) {
            setLanguageState(res.language);
            localStorage.setItem('app_language', res.language);
          }
        })
        .catch(() => {
        })
        .finally(() => {
          setDetecting(false);
        });
    }
  }, []);

  function setLanguage(lang) {
    if (lang === 'pt' || lang === 'en' || lang === 'es') {
      setLanguageState(lang);
      localStorage.setItem('app_language', lang);
    }
  }

  function t(key, params = {}) {
    let str = translations[language]?.[key] || translations['pt']?.[key] || key;
    if (typeof str === 'string' && Object.keys(params).length > 0) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      });
    }
    return str;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, supportedLanguages: SUPPORTED_LANGUAGES, detecting }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage deve ser usado dentro de um LanguageProvider');
  }
  return context;
}
