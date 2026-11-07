// ============================================================
// Internal User Interface
// Represents the full user domain entity including password hash.
// passwordHash must NEVER be returned to callers or API responses.
// ============================================================

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

