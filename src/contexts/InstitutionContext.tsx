"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { doc, getDoc } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type { Institution } from "@shared/types/institution";
import { INSTITUTION_COOKIE_NAME } from "@/lib/utils/constants";

interface InstitutionContextValue {
  institution: Institution | null;
  institutionId: string | null;
  loading: boolean;
}

const InstitutionContext = createContext<InstitutionContextValue>({
  institution: null,
  institutionId: null,
  loading: true,
});

function getInstitutionIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${INSTITUTION_COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const institutionId = getInstitutionIdFromCookie();

  useEffect(() => {
    async function fetchInstitution() {
      if (!institutionId) {
        setLoading(false);
        return;
      }

      // Check sessionStorage cache (30-minute TTL)
      const cacheKey = `inst_${institutionId}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 30 * 60 * 1000) {
            setInstitution(data as Institution);
            setLoading(false);
            return;
          }
        }
      } catch {
        // sessionStorage unavailable or corrupt — continue to fetch
      }

      try {
        const instDoc = await getDoc(doc(getClientDb(), "institutions", institutionId));
        if (instDoc.exists()) {
          const data = { id: instDoc.id, ...instDoc.data() } as Institution;
          setInstitution(data);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
          } catch {
            // sessionStorage full or unavailable — ignore
          }
        }
      } catch (err) {
        console.error("Error fetching institution:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchInstitution();
  }, [institutionId]);

  // Apply institution branding colors as CSS custom properties
  useEffect(() => {
    if (!institution?.branding) return;
    const root = document.documentElement;
    const b = institution.branding;
    const vars: [string, string | undefined][] = [
      ["--brand-primary", b.primaryColor],
      ["--brand-secondary", b.secondaryColor],
      ["--brand-accent", b.accentColor],
      ["--brand-header-bg", b.headerBgColor],
    ];
    for (const [prop, value] of vars) {
      if (value) root.style.setProperty(prop, value);
    }
  }, [institution]);

  return (
    <InstitutionContext.Provider
      value={{ institution, institutionId, loading }}
    >
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution(): InstitutionContextValue {
  return useContext(InstitutionContext);
}
