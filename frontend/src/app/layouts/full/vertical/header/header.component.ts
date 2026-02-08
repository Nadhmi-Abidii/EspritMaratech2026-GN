import {
  Component,
  Output,
  EventEmitter,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { navItems } from '../sidebar/sidebar-data';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { AuthService } from 'src/app/core/services/auth.service';
import { AuthUser } from 'src/app/core/models/auth.models';
import { NavItem } from '../sidebar/nav-item/nav-item';
import { LanguageOption, LanguageService } from 'src/app/core/services/language.service';

interface notifications {
  id: number;
  img: string;
  title: string;
  subtitle: string;
}

interface profiledd {
  id: number;
  img: string;
  title: string;
  subtitle: string;
  link: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    NgScrollbarModule,
    TablerIconsModule,
    MaterialModule,
    TranslateModule,
  ],
  templateUrl: './header.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class HeaderComponent {
  @Input() showToggle = true;
  @Input() toggleChecked = false;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  showFiller = false;
  currentUser: AuthUser | null = null;
  topNavItems: NavItem[] = [];

  public selectedLanguage: LanguageOption = {
    language: 'Français',
    code: 'fr',
    type: 'FR',
    icon: '/assets/images/flag/icon-flag-fr.svg',
  };

  public languages: LanguageOption[] = [];

  constructor(
    public dialog: MatDialog,
    private readonly authService: AuthService,
    private readonly languageService: LanguageService
  ) {
    this.languages = this.languageService.languages;
    this.selectedLanguage = this.languageService.getSelectedLanguageOption();
    this.refreshNavigation();
    this.authService.session$.subscribe(() => {
      this.refreshNavigation();
    });
  }

  openDialog() {
    const dialogRef = this.dialog.open(AppSearchDialogComponent);

    dialogRef.afterClosed().subscribe((result) => {
      console.log(`Dialog result: ${result}`);
    });
  }

  changeLanguage(lang: LanguageOption): void {
    void this.languageService.setLanguage(lang.code);
    this.selectedLanguage = lang;
  }

  notifications: notifications[] = [
    {
      id: 1,
      img: '/assets/images/profile/user-1.jpg',
      title: 'NOTIF.ROMAN_JOINED_TITLE',
      subtitle: 'NOTIF.CONGRATULATE',
    },
    {
      id: 2,
      img: '/assets/images/profile/user-2.jpg',
      title: 'NOTIF.NEW_MESSAGE_TITLE',
      subtitle: 'NOTIF.NEW_MESSAGE_SUBTITLE',
    },
    {
      id: 3,
      img: '/assets/images/profile/user-3.jpg',
      title: 'NOTIF.NEW_PAYMENT_TITLE',
      subtitle: 'NOTIF.CHECK_EARNINGS',
    },
    {
      id: 4,
      img: '/assets/images/profile/user-4.jpg',
      title: 'NOTIF.JOLLY_FINISHED_TITLE',
      subtitle: 'NOTIF.ASSIGN_NEW_TASKS',
    },
    {
      id: 5,
      img: '/assets/images/profile/user-5.jpg',
      title: 'NOTIF.ROMAN_JOINED_TITLE',
      subtitle: 'NOTIF.CONGRATULATE',
    },
  ];

  profiledd: profiledd[] = [
    {
      id: 1,
      img: '/assets/images/svgs/icon-account.svg',
      title: 'PROFILE_MENU.MY_PROFILE',
      subtitle: 'PROFILE_MENU.ACCOUNT_DETAILS',
      link: '/charity/profile',
    },
    {
      id: 2,
      img: '/assets/images/svgs/icon-inbox.svg',
      title: 'NAV.FAMILIES',
      subtitle: 'PROFILE_MENU.MANAGE_FAMILIES',
      link: '/charity/families',
    },
    {
      id: 3,
      img: '/assets/images/svgs/icon-tasks.svg',
      title: 'NAV.VISITS',
      subtitle: 'PROFILE_MENU.TRACK_FIELD_VISITS',
      link: '/charity/visits',
    },
  ];

  logout(): void {
    this.authService.logout(true);
  }

  private refreshNavigation(): void {
    const isAuthenticated = this.authService.isAuthenticated();
    this.currentUser = this.authService.getCurrentUser();
    const role = this.currentUser?.role;

    this.topNavItems = navItems.filter((item) => {
      if (!item.displayName || !item.route?.startsWith('/charity')) {
        return false;
      }

      if (item.hideWhenAuthenticated && isAuthenticated) {
        return false;
      }

      if (item.requiresAuth && !isAuthenticated) {
        return false;
      }

      if (item.roles?.length) {
        return !!role && item.roles.includes(role);
      }

      return true;
    });
  }
}

@Component({
  selector: 'search-dialog',
  standalone: true,
  imports: [RouterModule, MaterialModule, TablerIconsModule, FormsModule, TranslateModule],
  templateUrl: 'search-dialog.component.html',
})
export class AppSearchDialogComponent {
  searchText: string = '';
  navItems: NavItem[] = [];
  navItemsData: NavItem[] = [];

  constructor(private authService: AuthService) {
    this.refreshNavigation();
    this.authService.session$.subscribe(() => {
      this.refreshNavigation();
    });
  }

  // filtered = this.navItemsData.find((obj) => {
  //   return obj.displayName == this.searchinput;
  // });

  private refreshNavigation(): void {
    const isAuthenticated = this.authService.isAuthenticated();
    const role = this.authService.getCurrentUser()?.role;

    this.navItems = navItems;
    this.navItemsData = navItems.filter((item) => {
      if (!item.displayName) {
        return false;
      }

      if (item.hideWhenAuthenticated && isAuthenticated) {
        return false;
      }

      if (item.requiresAuth && !isAuthenticated) {
        return false;
      }

      if (item.roles?.length) {
        return !!role && item.roles.includes(role);
      }

      return true;
    });
  }
}
