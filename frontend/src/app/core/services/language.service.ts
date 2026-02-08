import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export type SupportedLanguageCode = 'en' | 'fr';

export interface LanguageOption {
  language: string;
  code: SupportedLanguageCode;
  type: string;
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly storageKey = 'omnia.language';

  readonly languages: LanguageOption[] = [
    {
      language: 'English',
      code: 'en',
      type: 'US',
      icon: '/assets/images/flag/icon-flag-en.svg',
    },
    {
      language: 'Français',
      code: 'fr',
      type: 'FR',
      icon: '/assets/images/flag/icon-flag-fr.svg',
    },
  ];

  constructor(
    private readonly translate: TranslateService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  async init(): Promise<void> {
    const supportedCodes = this.languages.map((lang) => lang.code);

    this.translate.addLangs(supportedCodes);
    this.translate.setDefaultLang('fr');

    const initialLanguage =
      this.getSavedLanguage() ?? this.detectBrowserLanguage() ?? 'fr';

    await firstValueFrom(this.translate.use(initialLanguage));
    this.applyHtmlLang(initialLanguage);
  }

  getCurrentLanguage(): SupportedLanguageCode {
    const current = this.translate.currentLang as
      | SupportedLanguageCode
      | undefined;

    if (current && this.isSupported(current)) {
      return current;
    }

    return this.getSavedLanguage() ?? 'fr';
  }

  getSelectedLanguageOption(): LanguageOption {
    const code = this.getCurrentLanguage();
    return this.languages.find((lang) => lang.code === code) ?? this.languages[0];
  }

  async setLanguage(code: SupportedLanguageCode): Promise<void> {
    if (!this.isSupported(code)) {
      return;
    }

    this.saveLanguage(code);
    await firstValueFrom(this.translate.use(code));
    this.applyHtmlLang(code);
  }

  private isSupported(code: string): code is SupportedLanguageCode {
    return this.languages.some((lang) => lang.code === code);
  }

  private getSavedLanguage(): SupportedLanguageCode | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const saved = localStorage.getItem(this.storageKey);

    if (saved && this.isSupported(saved)) {
      return saved;
    }

    return null;
  }

  private saveLanguage(code: SupportedLanguageCode): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.storageKey, code);
  }

  private detectBrowserLanguage(): SupportedLanguageCode | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const browserLang = this.translate.getBrowserLang();

    if (browserLang && this.isSupported(browserLang)) {
      return browserLang;
    }

    return null;
  }

  private applyHtmlLang(code: SupportedLanguageCode): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.document.documentElement.lang = code;
  }
}

