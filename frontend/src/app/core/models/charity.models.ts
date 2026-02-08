import { UserRole } from './auth.models';

export type FamilyAidType = 'alimentaire' | 'medicaments' | 'aide_specifique';
export type AidType = 'alimentaire' | 'medication' | 'aide_specifique';
export type Gender = 'male' | 'female' | 'other';
export type HousingSituation =
  | 'proprietaire'
  | 'locataire'
  | 'heberge'
  | 'sans_logement'
  | 'autre';

export interface Geolocation {
  latitude: number;
  longitude: number;
}

export interface Famille {
  _id: string;
  name: string;
  address: string;
  postalCode: string;
  zone: string;
  zoneId?: string;
  phone: string;
  email?: string;
  numberOfPeople: number;
  date_de_naissance?: string;
  nombre_enfants?: number;
  occupation?: string;
  revenu_mensuel?: number;
  situation_logement?: HousingSituation;
  aidTypes: FamilyAidType[];
  observations?: string;
  donationGoal?: number;
  totalRaised?: number;
  goalReached?: boolean;
  visited?: boolean;
  lastVisitedAt?: string | null;
  geolocation?: Geolocation | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FamilleReference {
  _id: string;
  name?: string;
  postalCode?: string;
  zone?: string;
  zoneId?: string;
}

export interface Beneficiaire {
  _id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
  hasDisability: boolean;
  healthHistory?: string;
  famille: string | FamilleReference;
  createdAt?: string;
  updatedAt?: string;
}

export interface Aide {
  _id: string;
  type: AidType;
  quantity: number;
  aidDate: string;
  observations?: string;
  famille: string | FamilleReference;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Visite {
  _id: string;
  visitDate: string;
  notes?: string;
  aides: Array<string | Aide>;
  famille: string | FamilleReference;
  geolocation?: Geolocation | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FamilyFilters {
  search?: string;
  postalCode?: string;
  zone?: string;
  zoneId?: string;
  aidType?: FamilyAidType;
  visited?: boolean;
  goalReached?: boolean;
  page?: number;
  limit?: number;
}

export interface BeneficiaryFilters {
  familleId?: string;
  gender?: Gender;
  hasDisability?: boolean;
  page?: number;
  limit?: number;
}

export interface AidFilters {
  familleId?: string;
  type?: AidType;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface VisitFilters {
  familleId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface FamilyPayload {
  name: string;
  address: string;
  postalCode: string;
  zone?: string;
  zoneId?: string;
  phone: string;
  email?: string;
  numberOfPeople: number;
  date_de_naissance?: string;
  nombre_enfants?: number;
  occupation?: string;
  revenu_mensuel?: number;
  situation_logement?: HousingSituation;
  aidTypes: FamilyAidType[];
  observations?: string;
  donationGoal?: number;
  totalRaised?: number;
  visited?: boolean;
  geolocation?: Geolocation;
}

export interface ZoneResponsibleSummary {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  assignedZones?: string[];
}

export interface ZoneItem {
  _id: string;
  name: string;
  responsible: ZoneResponsibleSummary | null;
  assignedFamilies: FamilleReference[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ZoneResponsiblePayload {
  name: string;
  email: string;
  phone: string;
  password?: string;
}

export interface ZoneCreatePayload {
  name: string;
  responsibleId?: string | null;
  responsible?: ZoneResponsiblePayload;
}

export interface ZoneUpdatePayload {
  name?: string;
  responsibleId?: string | null;
  responsible?: Partial<ZoneResponsiblePayload>;
}

export interface BeneficiaryPayload {
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: Gender;
  hasDisability: boolean;
  healthHistory?: string;
  famille: string;
}

export interface AidPayload {
  type: AidType;
  quantity: number;
  aidDate?: string;
  observations?: string;
  famille: string;
}

export interface VisitPayload {
  visitDate?: string;
  notes?: string;
  aides?: string[];
  famille: string;
  geolocation?: Geolocation;
}
