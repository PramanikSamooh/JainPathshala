"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import type { User } from "@shared/types/user";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    firebaseUser: null,
    userData: null,
    loading: true,
    error: null,
  });

  async function fetchUserData(firebaseUser: FirebaseUser, retries = 3) {
    try {
      const userDoc = await getDoc(doc(getClientDb(), "users", firebaseUser.uid));
      if (userDoc.exists()) {
        setState({
          firebaseUser,
          userData: userDoc.data() as User,
          loading: false,
          error: null,
        });
      } else if (retries > 0) {
        // User document not yet created (Cloud Function may be processing)
        // Retry after a delay
        setTimeout(() => fetchUserData(firebaseUser, retries - 1), 2000);
      } else {
        setState({
          firebaseUser,
          userData: null,
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      // Firestore permission error — likely new user whose claims haven't propagated yet
      // The Cloud Function sets claims async, so retry after a delay
      if (retries > 0) {
        console.log("Waiting for user document to be created...");
        setTimeout(() => fetchUserData(firebaseUser, retries - 1), 2000);
      } else {
        console.error("Error fetching user data:", err);
        setState({
          firebaseUser,
          userData: null,
          loading: false,
          error: null,
        });
      }
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getClientAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUserData(firebaseUser);
      } else {
        setState({
          firebaseUser: null,
          userData: null,
          loading: false,
          error: null,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  async function refreshUser() {
    if (state.firebaseUser) {
      await fetchUserData(state.firebaseUser);
    }
  }

  return (
    <AuthContext.Provider value={{ ...state, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
