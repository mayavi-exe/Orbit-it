/**
 * Clerk-backed auth context shim.
 * Provides the same `useAuth()` API used by legacy screens,
 * backed by Clerk's useAuth + the /api/users/me endpoint.
 */
import React, { createContext, useContext } from "react";
import { useAuth as useClerkAuth } from "@clerk/expo";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  bio?: string | null;
  gender?: string | null;
  age?: number | null;
  interests?: string[];
  clubs?: string[];
  profilePhotos?: string[];
  collegeId?: string;
  college?: { id: string; name: string; domain: string; location: string } | null;
  isEmailVerified?: boolean;
  profileCompleted?: boolean;
  isProfilePublic?: boolean;
  showAge?: boolean;
  showGender?: boolean;
};

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { signOut, isSignedIn } = useClerkAuth();
  const queryClient = useQueryClient();

  const { data: meData, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: !!isSignedIn,
      retry: false,
    },
  });

  const user: AuthUser | null = meData
    ? {
        id: meData.id,
        name: meData.name,
        email: meData.email ?? "",
        username: meData.username,
        bio: meData.bio,
        gender: meData.gender,
        age: meData.age,
        interests: meData.interests,
        clubs: meData.clubs,
        profilePhotos: meData.profilePhotos,
        collegeId: meData.collegeId,
        college: meData.college ?? null,
        isEmailVerified: meData.isEmailVerified,
        profileCompleted: meData.profileCompleted,
        isProfilePublic: meData.isProfilePublic,
        showAge: meData.showAge,
        showGender: meData.showGender,
      }
    : null;

  const logout = async () => {
    await signOut();
    queryClient.clear();
  };

  const updateUser = (_updates: Partial<AuthUser>) => {
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
