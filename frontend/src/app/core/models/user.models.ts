import { AuthUser, UserRole } from './auth.models';

export type ManagedUser = AuthUser;

export interface UserFilters {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface UserCreatePayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  isActive?: boolean;
  assignedZones?: string[];
  assignedFamilies?: string[];
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  assignedZones?: string[];
  assignedFamilies?: string[];
}
