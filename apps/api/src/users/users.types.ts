// ============================================================
// User DTO and Input Types
// ============================================================

export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
}
