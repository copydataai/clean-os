type OrgRecord = {
  clerkId: string;
  role?: string | null;
};

type OrgContextInput<TOrganization extends OrgRecord> = {
  organizations: TOrganization[];
  orgId: string | null | undefined;
  backendActiveOrgClerkId: string | null;
  isAuthLoaded: boolean;
  isOrganizationListLoaded: boolean;
  hasFetchedOrganizations: boolean;
  hasFetchedBackendActiveOrg: boolean;
  canSetActive: boolean;
  isSwitching: boolean;
  pendingOrgClerkId: string | null;
};

export type OrgContextState<TOrganization extends OrgRecord> = {
  activeOrg: TOrganization | null;
  hasNoOrganizations: boolean;
  hasStaleOrgClaim: boolean;
  isLoading: boolean;
  isOrgContextReady: boolean;
  isResolvingOrgContext: boolean;
  shouldAutoSelect: boolean;
  autoSelectTarget: TOrganization | null;
  shouldRefreshOrgClaim: boolean;
  refreshOrgClaimTargetClerkId: string | null;
};

function findActiveOrg<TOrganization extends OrgRecord>(
  organizations: TOrganization[],
  orgId: string | null | undefined
): TOrganization | null {
  if (organizations.length === 0) {
    return null;
  }

  if (orgId) {
    const claimedOrganization = organizations.find((organization) => organization.clerkId === orgId) ?? null;
    if (claimedOrganization) {
      return claimedOrganization;
    }
  }

  if (organizations.length === 1) {
    return organizations[0];
  }

  return null;
}

const ADMIN_ROLES = new Set(["admin", "owner"]);
const ADMIN_SUFFIXES = [":admin", ":owner"];

function isAdminRole(role?: string | null): boolean {
  const normalized = (role ?? "").toLowerCase();
  return (
    ADMIN_ROLES.has(normalized) ||
    ADMIN_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

function findAutoSelectTarget<TOrganization extends OrgRecord>(
  organizations: TOrganization[]
): TOrganization | null {
  const adminOrganization = organizations.find((organization) => isAdminRole(organization.role));
  return adminOrganization ?? organizations[0] ?? null;
}

export function deriveOrgContextState<TOrganization extends OrgRecord>(
  input: OrgContextInput<TOrganization>
): OrgContextState<TOrganization> {
  const {
    organizations,
    orgId,
    backendActiveOrgClerkId,
    isAuthLoaded,
    isOrganizationListLoaded,
    hasFetchedOrganizations,
    hasFetchedBackendActiveOrg,
    canSetActive,
    isSwitching,
    pendingOrgClerkId,
  } = input;

  const hasNoOrganizations = hasFetchedOrganizations && organizations.length === 0;
  const isLoading = !isAuthLoaded || !isOrganizationListLoaded || !hasFetchedOrganizations;
  const activeOrg = findActiveOrg(organizations, orgId);
  const hasStaleOrgClaim = Boolean(orgId) && activeOrg === null;
  const isWaitingForPendingClaim = Boolean(pendingOrgClerkId && pendingOrgClerkId !== orgId);
  const expectedOrgClerkId = pendingOrgClerkId ?? orgId ?? activeOrg?.clerkId ?? null;

  const shouldAutoSelect =
    !isLoading &&
    canSetActive &&
    organizations.length > 0 &&
    !isSwitching &&
    !isWaitingForPendingClaim &&
    (!orgId || hasStaleOrgClaim);

  const requiresBackendConfirmation = organizations.length > 1;
  const isBackendAligned =
    !requiresBackendConfirmation ||
    (hasFetchedBackendActiveOrg &&
      Boolean(backendActiveOrgClerkId) &&
      Boolean(expectedOrgClerkId) &&
      backendActiveOrgClerkId === expectedOrgClerkId);
  const shouldRefreshOrgClaim =
    !isLoading &&
    canSetActive &&
    !isSwitching &&
    !isWaitingForPendingClaim &&
    requiresBackendConfirmation &&
    hasFetchedBackendActiveOrg &&
    Boolean(orgId) &&
    !hasStaleOrgClaim &&
    !isBackendAligned;

  const isOrgContextReady =
    !isLoading &&
    organizations.length > 0 &&
    !isSwitching &&
    !isWaitingForPendingClaim &&
    isBackendAligned &&
    (organizations.length === 1 || activeOrg !== null);

  const isResolvingOrgContext =
    !hasNoOrganizations &&
    !isOrgContextReady &&
    (
      isLoading ||
      isSwitching ||
      isWaitingForPendingClaim ||
      shouldAutoSelect ||
      !isBackendAligned
    );

  return {
    activeOrg,
    hasNoOrganizations,
    hasStaleOrgClaim,
    isLoading,
    isOrgContextReady,
    isResolvingOrgContext,
    shouldAutoSelect,
    autoSelectTarget: shouldAutoSelect ? findAutoSelectTarget(organizations) : null,
    shouldRefreshOrgClaim,
    refreshOrgClaimTargetClerkId: shouldRefreshOrgClaim ? orgId ?? null : null,
  };
}
