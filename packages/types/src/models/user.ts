export type UserRole = "member" | "pm" | "director" | "eboard";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
}

export interface UserSession {
  id: string;
  user_id: string;
  is_revoked: boolean;
}
