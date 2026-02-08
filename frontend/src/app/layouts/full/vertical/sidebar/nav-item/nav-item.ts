import { UserRole } from 'src/app/core/models/auth.models';

export interface NavItem {
    displayName?: string;
    disabled?: boolean;
    external?: boolean;
    twoLines?: boolean;
    chip?: boolean;
    iconName?: string;
    navCap?: string;
    chipContent?: string;
    chipClass?: string;
    subtext?: string;
    route?: string;
    children?: NavItem[];
    ddType?: string;
    roles?: UserRole[];
    requiresAuth?: boolean;
    hideWhenAuthenticated?: boolean;
}
