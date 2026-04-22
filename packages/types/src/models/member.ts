export interface Cohort {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Member {
  id: string;
  userId: string;
  cohortId: string;
  cohort?: Cohort;
  roleTitle: string;
  headshotUrl: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  isActive: boolean;
  displayOrder: number;
  name: string;
  email: string;
}

export interface MemberPublic {
  id: string;
  name: string;
  roleTitle: string;
  headshotUrl: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  displayOrder: number;
  cohort: string;
}
