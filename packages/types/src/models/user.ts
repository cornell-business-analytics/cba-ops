export type UserRole = "member" | "pm" | "director" | "eboard";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  role_title?: string | null;
  is_active: boolean;
}

export interface UserSession {
  id: string;
  user_id: string;
  is_revoked: boolean;
}

export interface AllowedEmail {
  id: string;
  email: string;
  addedById: string | null;
  createdAt: string;
}
