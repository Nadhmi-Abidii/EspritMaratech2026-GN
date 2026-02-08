import {
  Component,
  OnInit,
  Input,
  ChangeDetectorRef,
  OnChanges,
} from '@angular/core';
import { navItems } from './sidebar-data';
import { Router } from '@angular/router';
import { NavService } from '../../../../services/nav.service';
import { MediaMatcher } from '@angular/cdk/layout';
import { AppHorizontalNavItemComponent } from './nav-item/nav-item.component';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/core/services/auth.service';
import { NavItem } from '../../vertical/sidebar/nav-item/nav-item';

@Component({
  selector: 'app-horizontal-sidebar',
  standalone: true,
  imports: [AppHorizontalNavItemComponent, CommonModule],
  templateUrl: './sidebar.component.html',
})
export class AppHorizontalSidebarComponent implements OnInit {
  navItems: NavItem[] = [];
  parentActive = '';

  mobileQuery: MediaQueryList;
  private _mobileQueryListener: () => void;

  constructor(
    public navService: NavService,
    public router: Router,
    media: MediaMatcher,
    changeDetectorRef: ChangeDetectorRef,
    private authService: AuthService
  ) {
    this.mobileQuery = media.matchMedia('(min-width: 1100px)');
    this._mobileQueryListener = () => changeDetectorRef.detectChanges();
    this.mobileQuery.addListener(this._mobileQueryListener);
    this.router.events.subscribe(
      () => (this.parentActive = this.router.url.split('/')[1])
    );

    this.authService.session$.subscribe(() => {
      this.refreshNavItems();
    });
  }

  ngOnInit(): void {
    this.refreshNavItems();
  }

  private refreshNavItems(): void {
    const isAuthenticated = this.authService.isAuthenticated();
    const role = this.authService.getCurrentUser()?.role;

    this.navItems = navItems.filter((item) => {
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
