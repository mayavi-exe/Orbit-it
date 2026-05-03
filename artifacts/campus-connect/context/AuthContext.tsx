import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
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
  accessToken: string | null;
  isLoading: boolean;
  login: (data: { user: AuthUser; accessToken: string; refreshToken: string }) => Promise<void>;
  register: (data: { user: AuthUser; accessToken: string; refreshToken: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const raw = await AsyncStorage.getItem("auth");
      if (raw) {
        const { user: savedUser, accessToken: savedToken } = JSON.parse(raw);
        setUser(savedUser);
        setAccessToken(savedToken);
        tokenRef.current = savedToken;
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: { user: AuthUser; accessToken: string; refreshToken: string }) => {
    setUser(data.user);
    setAccessToken(data.accessToken);
    tokenRef.current = data.accessToken;
    await AsyncStorage.setItem("auth", JSON.stringify(data));
  };

  const register = async (data: { user: AuthUser; accessToken: string; refreshToken: string }) => {
    setUser(data.user);
    setAccessToken(data.accessToken);
    tokenRef.current = data.accessToken;
    await AsyncStorage.setItem("auth", JSON.stringify(data));
  };

  const logout = async () => {
    setUser(null);
    setAccessToken(null);
    tokenRef.current = null;
    await AsyncStorage.removeItem("auth");
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
