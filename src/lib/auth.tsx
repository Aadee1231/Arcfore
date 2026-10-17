import { LOCAL_USER_ID } from '@/lib/db/database';
import { useAuth, useUser } from '@clerk/expo';
import React, { createContext, useContext } from 'react';

/**
 * App-wide auth facade. Arcfore is local-first: everything works without an
 * account, scoped to a single local profile (`local-user`). If Clerk is
 * configured AND the user chooses to sign in, `userId` becomes the Clerk id —
 * used only for API identification, never required for app features.
 *
 * Screens call `useAuthUser()` — never Clerk's `useAuth` directly — so the app
 * boots fine when Clerk isn't configured (ClerkProvider is skipped entirely).
 */
export interface AuthUser {
  userId: string | null;
  /** True only when a real Clerk session exists. Local use is always allowed. */
  isSignedIn: boolean;
  isLoaded: boolean;
  displayName: string | null;
  email: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthUser>({
  userId: LOCAL_USER_ID,
  isSignedIn: false,
  isLoaded: true,
  displayName: null,
  email: null,
  getToken: async () => null,
  signOut: async () => {},
});

export function useAuthUser(): AuthUser {
  return useContext(AuthContext);
}

/** Bridges Clerk's signal-based useAuth into AuthContext. Mount only under ClerkProvider. */
export function ClerkAuthBridge({ children }: { children: React.ReactNode }) {
  const { userId, isSignedIn, isLoaded, getToken, signOut } = useAuth();
  const { user } = useUser();
  return (
    <AuthContext.Provider
      value={{
        userId: isSignedIn && userId ? userId : LOCAL_USER_ID,
        isSignedIn: !!isSignedIn,
        isLoaded,
        displayName: user?.fullName ?? user?.firstName ?? user?.username ?? null,
        email: user?.primaryEmailAddress?.emailAddress ?? null,
        getToken: async () => (await getToken({ skipCache: false })) ?? null,
        signOut: async () => {
          await signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Identity used when Clerk isn't configured: a single local profile. */
export const LOCAL_AUTH: AuthUser = {
  userId: LOCAL_USER_ID,
  isSignedIn: false,
  isLoaded: true,
  displayName: null,
  email: null,
  getToken: async () => null,
  signOut: async () => {},
};

export { AuthContext };
