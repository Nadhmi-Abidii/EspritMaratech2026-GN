import { NavItem } from './nav-item/nav-item';

export const navItems: NavItem[] = [
  {
    navCap: 'NAV.OMNIA_CHARITY',
    requiresAuth: true,
  },
  {
    displayName: 'NAV.HOME',
    iconName: 'layout-dashboard',
    route: '/charity/home',
    roles: ['admin', 'coordinator', 'responsible', 'volunteer'],
    requiresAuth: true,
  },
  {
    displayName: 'NAV.FAMILIES',
    iconName: 'home-heart',
    route: '/charity/families',
    roles: ['admin', 'coordinator', 'responsible', 'volunteer'],
    requiresAuth: true,
  },
  {
    displayName: 'NAV.BENEFICIARIES',
    iconName: 'users-group',
    route: '/charity/beneficiaries',
    roles: ['admin', 'coordinator', 'responsible'],
    requiresAuth: true,
  },
  {
    displayName: 'NAV.AIDS',
    iconName: 'hand-click',
    route: '/charity/aids',
    roles: ['admin', 'coordinator', 'responsible', 'volunteer'],
    requiresAuth: true,
  },
  {
    displayName: 'NAV.VISITS',
    iconName: 'map-pin',
    route: '/charity/visits',
    roles: ['admin', 'coordinator', 'responsible', 'volunteer'],
    requiresAuth: true,
  },
  {
    displayName: 'NAV.ADMIN_DASHBOARD',
    iconName: 'shield-lock',
    route: '/charity/admin',
    roles: ['admin'],
    requiresAuth: true,
  },
  {
    displayName: 'NAV.POSTS',
    iconName: 'notes',
    route: '/charity/posts',
    roles: ['admin', 'responsible'],
    requiresAuth: true,
  },
  {
    displayName: 'NAV.PROFILE',
    iconName: 'user-circle',
    route: '/charity/profile',
    roles: ['admin', 'coordinator', 'responsible', 'volunteer'],
    requiresAuth: true,
  },
  {
    displayName: 'NAV.LOGIN',
    iconName: 'login',
    route: '/authentication/login',
    hideWhenAuthenticated: true,
  },
];
