"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";

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
  const { orgId } = useAuth();
  const { isLoaded: isOrganizationListLoaded, setActive } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });
  const rawOrganizations = useQuery(api.queries.getUserOrganizations);
  const [isSwitching, setIsSwitching] = useState(false);

  const organizations = useMemo(
    () => sortOrganizations((rawOrganizations ?? []) as UserOrganization[]),
    [rawOrganizations]
  );

  const activeOrg = useMemo(() => {
    if (organizations.length === 0) {
      return null;
    }

    const byActiveClaim = orgId
      ? organizations.find((organization) => organization.clerkId === orgId) ?? null
      : null;

    if (byActiveClaim) {
      return byActiveClaim;
    }

    if (organizations.length === 1) {
      return organizations[0];
    }

    return null;
  }, [organizations, orgId]);

  const switchOrganization = useCallback(
    async (organization: UserOrganization) => {
      if (!organization.clerkId) {
        return;
      }

      if (orgId && orgId === organization.clerkId) {
        return;
      }

      setIsSwitching(true);
      try {
        await setActive?.({ organization: organization.clerkId });
      } finally {
        setIsSwitching(false);
      }
    },
    [orgId, setActive]
  );

  useEffect(() => {
    if (!isOrganizationListLoaded || isSwitching) {
      return;
    }

    if (orgId) {
      return;
    }

    if (organizations.length === 0) {
      return;
    }

    const firstOrganization = organizations[0];
    if (!firstOrganization?.clerkId) {
      return;
    }

    setIsSwitching(true);
    void setActive?.({ organization: firstOrganization.clerkId }).finally(() => {
      setIsSwitching(false);
    });
  }, [isOrganizationListLoaded, isSwitching, orgId, organizations, setActive]);

  const hasNoOrganizations = rawOrganizations !== undefined && organizations.length === 0;
  const isLoading = rawOrganizations === undefined || !isOrganizationListLoaded;

  const contextValue = useMemo<ActiveOrganizationContextValue>(
    () => ({
      activeOrg,
      organizations,
      isLoading,
      isSwitching,
      hasNoOrganizations,
      switchOrganization,
    }),
    [activeOrg, organizations, isLoading, isSwitching, hasNoOrganizations, switchOrganization]
  );

  return (
    <ActiveOrganizationContext.Provider value={contextValue}>
      {children}
    </ActiveOrganizationContext.Provider>
  );
}
