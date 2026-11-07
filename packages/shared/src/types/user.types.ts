// ============================================================
// Safe User & Profile Types
// Used across frontend, backend, and worker.
// Never includes passwordHash or private secrets.
// ============================================================

/** Safe user entity without credentials */
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** User profile representation */
export type UserProfile = SafeUser;
