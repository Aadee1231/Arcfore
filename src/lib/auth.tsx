import React, { createContext, useContext } from 'react';
import { useAuth, useUser } from '@clerk/expo';
import { config } from '@/lib/config';

/**
 * App-wide auth facade. Screens call `useAuthUser()` — never Clerk's `useAuth`
 * directly — so the app can boot in dev/preview mode without a Clerk key
 * (ClerkProvider is skipped entirely in that case and any bare useAuth call
 * would crash the tree).
 */
export interface AuthUser {
  userId: string | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  /** Display name from the identity provider (dev: 'Demo'). */
  displayName: string | null;
  /** Primary email (dev: null). */
  email: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthUser>({
  userId: null,
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
        userId: userId ?? null,
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

/** Signed-in identity used when Clerk isn't configured (dev preview / demo). */
export const DEV_AUTH: AuthUser = {
  userId: config.devUserId ?? 'dev-preview',
  isSignedIn: true,
  isLoaded: true,
  displayName: 'Demo',
  email: null,
  getToken: async () => null,
  signOut: async () => {},
};

export { AuthContext };
