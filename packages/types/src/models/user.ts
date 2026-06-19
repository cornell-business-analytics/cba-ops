export type UserRole = "member" | "pm" | "director" | "eboard";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  role_title?: string | null;
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
