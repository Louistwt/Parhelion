import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import zh from "./locales/zh-Hant-HK";

export const LANGS = [
  { code: "en", short: "EN", label: "English" },
  { code: "zh-Hant-HK", short: "繁", label: "繁體中文" },
] as const;
export type Lang = (typeof LANGS)[number]["code"];

const KEY = "parhelion.lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "zh-Hant-HK") return saved;
  } catch {
    // storage blocked: fall back to the browser language
  }
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return prefs.some((l) => /^zh-(hk|mo|tw|hant)/i.test(l)) ? "zh-Hant-HK" : "en";
}

export function setLang(lang: Lang) {
  void i18n.changeLanguage(lang);
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // not remembered; still switches for this visit
  }
}

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, "zh-Hant-HK": { translation: zh } },
  lng: initialLang(),
  fallbackLng: "en",
  interpolation: { escapeValue: false }, // React escapes already
  returnNull: false,
});
document.documentElement.lang = i18n.language;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}

export default i18n;
