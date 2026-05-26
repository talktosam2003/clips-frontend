"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "../app/lib/mockApi";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Use sessionStorage so the session is cleared when the browser tab closes.
    // Validate the stored shape before trusting it.
    try {
      const storedUser = sessionStorage.getItem("clipcash_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof parsed.id === "string" &&
          typeof parsed.email === "string" &&
          typeof parsed.onboardingStep === "number" &&
          !("password" in parsed) // reject any object that somehow has a password field
        ) {
          setUserState(parsed as User);
        } else {
          sessionStorage.removeItem("clipcash_user");
        }
      }
    } catch {
      sessionStorage.removeItem("clipcash_user");
    }
    setIsLoading(false);
  }, []);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      // Only persist the public, non-sensitive fields — never include passwords
      const safeUser: User = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        username: newUser.username,
        onboardingStep: newUser.onboardingStep,
        profile: newUser.profile,
      };
      sessionStorage.setItem("clipcash_user", JSON.stringify(safeUser));
    } else {
      sessionStorage.removeItem("clipcash_user");
    }
  };

  // Basic routing logic based on auth state
  useEffect(() => {
    if (isLoading) return;

    if (user) {
      if (pathname === "/login" || pathname === "/signup" || pathname === "/") {
        if (user.onboardingStep === 1 || user.onboardingStep === 2) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      } else if (pathname === "/onboarding") {
        if (user.onboardingStep > 2) {
          router.push("/dashboard");
        }
      }
    } else {
      if (pathname === "/dashboard" || pathname === "/onboarding" || pathname === "/earnings") {
        router.push("/login");
      }
    }
  }, [user, isLoading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
