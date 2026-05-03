import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";

type User = any; // simplified

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const authData = await AsyncStorage.getItem("auth");
      if (authData) {
        const { user: savedUser, accessToken } = JSON.parse(authData);
        setUser(savedUser);
        tokenRef.current = accessToken;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: any) => {
    setUser(data.user);
    tokenRef.current = data.accessToken;
    await AsyncStorage.setItem("auth", JSON.stringify(data));
  };

  const register = async (data: any) => {
    setUser(data.user);
    tokenRef.current = data.accessToken;
    await AsyncStorage.setItem("auth", JSON.stringify(data));
  };

  const logout = async () => {
    setUser(null);
    tokenRef.current = null;
    await AsyncStorage.removeItem("auth");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
