// Define type for sessionClaims
interface SessionClaims {
  metadata?: {
    role?: string;
  };
}

export type { SessionClaims };
