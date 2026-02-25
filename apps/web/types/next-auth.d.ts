/**
 * NextAuth.js Type Extensions
 *
 * Extends the default session and JWT types with custom user properties.
 */

import type { UserRole } from '@nextcalc/database';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image: string;
      role: UserRole;
    };
  }

  interface User {
    role?: UserRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    version?: number;
  }
}
