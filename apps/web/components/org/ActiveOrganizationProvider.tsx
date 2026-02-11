"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import { deriveOrgContextState } from "./orgContextState";

export type UserOrganization = {
  _id: Id<"organizations">;
  clerkId: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  role?: string;
};

type ActiveOrganizationContextValue = {
  activeOrg: UserOrganization | null;
  organizations: UserOrganization[];
  isLoading: boolean;
  isSwitching: boolean;
  isOrgContextReady: boolean;
  isResolvingOrgContext: boolean;
  hasNoOrganizations: boolean;
  switchOrganization: (organization: UserOrganization) => Promise<void>;
};

export const ActiveOrganizationContext =
  createContext<ActiveOrganizationContextValue | null>(null);

function sortOrganizations(organizations: UserOrganization[]): UserOrganization[] {
  return [...organizations].sort((left, right) => {
    const nameComparison = left.name.localeCompare(right.name);
    if (nameComparison !== 0) {
      return nameComparison;
    }
    return String(left._id).localeCompare(String(right._id));
  });
}

export default function ActiveOrganizationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { orgId, isLoaded: isAuthLoaded } = useAuth();
  const { isLoaded: isOrganizationListLoaded, setActive } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });
  const rawOrganizations = useQuery(api.queries.getUserOrganizations);
  const rawBackendActiveOrganization = useQuery(api.queries.getActiveOrganization);
  const [isSwitching, setIsSwitching] = useState(false);
  const [pendingOrgClerkId, setPendingOrgClerkId] = useState<string | null>(null);
  const pendingOrgStartedAtRef = useRef<number | null>(null);
  const autoSelectInFlightRef = useRef(false);
  const lastAutoSelectAttemptRef = useRef<string | null>(null);
  const claimRefreshInFlightRef = useRef(false);
  const lastClaimRefreshAtRef = useRef(0);
  const claimRefreshAttemptsRef = useRef(0);
  const CLAIM_REFRESH_COOLDOWN_MS = 3000;
  const MAX_CLAIM_REFRESH_ATTEMPTS = 3;
  const PENDING_ORG_TIMEOUT_MS = 10000;

  const organizations = useMemo(
    () => sortOrganizations((rawOrganizations ?? []) as UserOrganization[]),
    [rawOrganizations]
  );

  const contextState = useMemo(
    () =>
      deriveOrgContextState({
        organizations,
        orgId,
        backendActiveOrgClerkId:
          (rawBackendActiveOrganization as { clerkId?: string } | null | undefined)?.clerkId ?? null,
        isAuthLoaded,
        isOrganizationListLoaded,
        hasFetchedOrganizations: rawOrganizations !== undefined,
        hasFetchedBackendActiveOrg: rawBackendActiveOrganization !== undefined,
        canSetActive: typeof setActive === "function",
        isSwitching,
        pendingOrgClerkId,
      }),
    [
      organizations,
      orgId,
      isAuthLoaded,
      isOrganizationListLoaded,
      rawOrganizations,
      rawBackendActiveOrganization,
      setActive,
      isSwitching,
      pendingOrgClerkId,
    ]
  );

  const switchOrganization = useCallback(
    async (organization: UserOrganization) => {
      if (typeof setActive !== "function") {
        return;
      }
      if (!organization.clerkId) {
        return;
      }

      if (orgId && orgId === organization.clerkId) {
        return;
      }

      setIsSwitching(true);
      setPendingOrgClerkId(organization.clerkId);
      pendingOrgStartedAtRef.current = Date.now();
      try {
        await setActive({ organization: organization.clerkId });
      } catch (error) {
        setPendingOrgClerkId(null);
        pendingOrgStartedAtRef.current = null;
        throw error;
      } finally {
        setIsSwitching(false);
      }
    },
    [orgId, setActive]
  );

  useEffect(() => {
    if (!pendingOrgClerkId) {
      return;
    }

    if (orgId === pendingOrgClerkId) {
      setPendingOrgClerkId(null);
      pendingOrgStartedAtRef.current = null;
      return;
    }

    const pendingOrgStillExists = organizations.some(
      (organization) => organization.clerkId === pendingOrgClerkId
    );
    if (!pendingOrgStillExists) {
      setPendingOrgClerkId(null);
      pendingOrgStartedAtRef.current = null;
      return;
    }

    const startedAt = pendingOrgStartedAtRef.current;
    if (startedAt && Date.now() - startedAt > PENDING_ORG_TIMEOUT_MS) {
      setPendingOrgClerkId(null);
      pendingOrgStartedAtRef.current = null;
      lastAutoSelectAttemptRef.current = null;
    }
  }, [organizations, orgId, pendingOrgClerkId]);

  useEffect(() => {
    const target = contextState.autoSelectTarget;
    if (!contextState.shouldAutoSelect || !target?.clerkId || typeof setActive !== "function") {
      lastAutoSelectAttemptRef.current = null;
      return;
    }

    if (pendingOrgClerkId === target.clerkId || orgId === target.clerkId) {
      return;
    }

    if (autoSelectInFlightRef.current && lastAutoSelectAttemptRef.current === target.clerkId) {
      return;
    }

    if (lastAutoSelectAttemptRef.current === target.clerkId) {
      return;
    }

    autoSelectInFlightRef.current = true;
    lastAutoSelectAttemptRef.current = target.clerkId;
    setIsSwitching(true);
    setPendingOrgClerkId(target.clerkId);
    pendingOrgStartedAtRef.current = Date.now();
    void setActive({ organization: target.clerkId })
      .catch(() => {
        lastAutoSelectAttemptRef.current = null;
        setPendingOrgClerkId(null);
        pendingOrgStartedAtRef.current = null;
      })
      .finally(() => {
        autoSelectInFlightRef.current = false;
        setIsSwitching(false);
      });
  }, [contextState.autoSelectTarget, contextState.shouldAutoSelect, orgId, pendingOrgClerkId, setActive]);

  useEffect(() => {
    claimRefreshAttemptsRef.current = 0;
  }, [orgId]);

  useEffect(() => {
    const targetOrgClerkId = contextState.refreshOrgClaimTargetClerkId;
    if (!contextState.shouldRefreshOrgClaim || !targetOrgClerkId || typeof setActive !== "function") {
      claimRefreshAttemptsRef.current = 0;
      return;
    }

    if (claimRefreshInFlightRef.current) {
      return;
    }

    const now = Date.now();
    if (now - lastClaimRefreshAtRef.current < CLAIM_REFRESH_COOLDOWN_MS) {
      return;
    }

    if (claimRefreshAttemptsRef.current >= MAX_CLAIM_REFRESH_ATTEMPTS) {
      return;
    }

    claimRefreshInFlightRef.current = true;
    claimRefreshAttemptsRef.current += 1;
    lastClaimRefreshAtRef.current = now;
    setIsSwitching(true);
    void setActive({ organization: targetOrgClerkId }).finally(() => {
      claimRefreshInFlightRef.current = false;
      setIsSwitching(false);
    });
  }, [
    contextState.refreshOrgClaimTargetClerkId,
    contextState.shouldRefreshOrgClaim,
    setActive,
  ]);

  const contextValue = useMemo<ActiveOrganizationContextValue>(
    () => ({
      activeOrg: contextState.activeOrg,
      organizations,
      isLoading: contextState.isLoading,
      isSwitching,
      isOrgContextReady: contextState.isOrgContextReady,
      isResolvingOrgContext: contextState.isResolvingOrgContext,
      hasNoOrganizations: contextState.hasNoOrganizations,
      switchOrganization,
    }),
    [
      contextState.activeOrg,
      organizations,
      contextState.isLoading,
      isSwitching,
      contextState.isOrgContextReady,
      contextState.isResolvingOrgContext,
      contextState.hasNoOrganizations,
      switchOrganization,
    ]
  );

  return (
    <ActiveOrganizationContext.Provider value={contextValue}>
      {children}
    </ActiveOrganizationContext.Provider>
  );
}
