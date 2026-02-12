import { describe, expect, it } from "vitest";
import { deriveOrgContextState } from "./orgContextState";

type TestOrganization = {
  _id: string;
  clerkId: string;
  name: string;
  role?: string;
};

function makeOrganization(id: string, role?: string): TestOrganization {
  return {
    _id: id,
    clerkId: `clerk_${id}`,
    name: `Org ${id}`,
    role,
  };
}

describe("deriveOrgContextState", () => {
  it("multi-org with missing claim is not ready and auto-selects an admin org", () => {
    const firstOrganization = makeOrganization("org_a", "member");
    const secondOrganization = makeOrganization("org_b", "admin");

    const state = deriveOrgContextState({
      organizations: [firstOrganization, secondOrganization],
      orgId: null,
      backendActiveOrgClerkId: null,
      isAuthLoaded: true,
      isOrganizationListLoaded: true,
      hasFetchedOrganizations: true,
      hasFetchedBackendActiveOrg: true,
      canSetActive: true,
      isSwitching: false,
      pendingOrgClerkId: null,
    });

    expect(state.activeOrg).toBeNull();
    expect(state.isOrgContextReady).toBe(false);
    expect(state.isResolvingOrgContext).toBe(true);
    expect(state.shouldAutoSelect).toBe(true);
    expect(state.autoSelectTarget?._id).toBe(secondOrganization._id);
    expect(state.shouldRefreshOrgClaim).toBe(false);
  });

  it("multi-org with missing claim falls back to first org when no admin role exists", () => {
    const firstOrganization = makeOrganization("org_a", "member");
    const secondOrganization = makeOrganization("org_b", "cleaner");

    const state = deriveOrgContextState({
      organizations: [firstOrganization, secondOrganization],
      orgId: null,
      backendActiveOrgClerkId: null,
      isAuthLoaded: true,
      isOrganizationListLoaded: true,
      hasFetchedOrganizations: true,
      hasFetchedBackendActiveOrg: true,
      canSetActive: true,
      isSwitching: false,
      pendingOrgClerkId: null,
    });

    expect(state.activeOrg).toBeNull();
    expect(state.isOrgContextReady).toBe(false);
    expect(state.isResolvingOrgContext).toBe(true);
    expect(state.shouldAutoSelect).toBe(true);
    expect(state.autoSelectTarget?._id).toBe(firstOrganization._id);
    expect(state.shouldRefreshOrgClaim).toBe(false);
  });

  it("multi-org with valid claim is ready and does not auto-select", () => {
    const firstOrganization = makeOrganization("org_a");
    const secondOrganization = makeOrganization("org_b");

    const state = deriveOrgContextState({
      organizations: [firstOrganization, secondOrganization],
      orgId: secondOrganization.clerkId,
      backendActiveOrgClerkId: secondOrganization.clerkId,
      isAuthLoaded: true,
      isOrganizationListLoaded: true,
      hasFetchedOrganizations: true,
      hasFetchedBackendActiveOrg: true,
      canSetActive: true,
      isSwitching: false,
      pendingOrgClerkId: null,
    });

    expect(state.activeOrg?._id).toBe(secondOrganization._id);
    expect(state.isOrgContextReady).toBe(true);
    expect(state.isResolvingOrgContext).toBe(false);
    expect(state.shouldAutoSelect).toBe(false);
    expect(state.autoSelectTarget).toBeNull();
    expect(state.shouldRefreshOrgClaim).toBe(false);
  });

  it("multi-org with stale claim is not ready and re-selects", () => {
    const firstOrganization = makeOrganization("org_a");
    const secondOrganization = makeOrganization("org_b");

    const state = deriveOrgContextState({
      organizations: [firstOrganization, secondOrganization],
      orgId: "clerk_missing",
      backendActiveOrgClerkId: null,
      isAuthLoaded: true,
      isOrganizationListLoaded: true,
      hasFetchedOrganizations: true,
      hasFetchedBackendActiveOrg: true,
      canSetActive: true,
      isSwitching: false,
      pendingOrgClerkId: null,
    });

    expect(state.activeOrg).toBeNull();
    expect(state.hasStaleOrgClaim).toBe(true);
    expect(state.isOrgContextReady).toBe(false);
    expect(state.isResolvingOrgContext).toBe(true);
    expect(state.shouldAutoSelect).toBe(true);
    expect(state.shouldRefreshOrgClaim).toBe(false);
  });

  it("single-org with no claim is ready", () => {
    const onlyOrganization = makeOrganization("org_only");

    const state = deriveOrgContextState({
      organizations: [onlyOrganization],
      orgId: null,
      backendActiveOrgClerkId: onlyOrganization.clerkId,
      isAuthLoaded: true,
      isOrganizationListLoaded: true,
      hasFetchedOrganizations: true,
      hasFetchedBackendActiveOrg: true,
      canSetActive: true,
      isSwitching: false,
      pendingOrgClerkId: null,
    });

    expect(state.activeOrg?._id).toBe(onlyOrganization._id);
    expect(state.isOrgContextReady).toBe(true);
    expect(state.isResolvingOrgContext).toBe(false);
    expect(state.shouldAutoSelect).toBe(true);
    expect(state.shouldRefreshOrgClaim).toBe(false);
  });

  it("no organizations shows access-required state", () => {
    const state = deriveOrgContextState({
      organizations: [],
      orgId: null,
      backendActiveOrgClerkId: null,
      isAuthLoaded: true,
      isOrganizationListLoaded: true,
      hasFetchedOrganizations: true,
      hasFetchedBackendActiveOrg: true,
      canSetActive: true,
      isSwitching: false,
      pendingOrgClerkId: null,
    });

    expect(state.hasNoOrganizations).toBe(true);
    expect(state.isOrgContextReady).toBe(false);
    expect(state.isResolvingOrgContext).toBe(false);
    expect(state.shouldAutoSelect).toBe(false);
    expect(state.shouldRefreshOrgClaim).toBe(false);
  });

  it("switching or pending claim keeps context blocked", () => {
    const firstOrganization = makeOrganization("org_a");
    const secondOrganization = makeOrganization("org_b");

    const switchingState = deriveOrgContextState({
      organizations: [firstOrganization, secondOrganization],
      orgId: firstOrganization.clerkId,
      backendActiveOrgClerkId: firstOrganization.clerkId,
      isAuthLoaded: true,
      isOrganizationListLoaded: true,
      hasFetchedOrganizations: true,
      hasFetchedBackendActiveOrg: true,
      canSetActive: true,
      isSwitching: true,
      pendingOrgClerkId: secondOrganization.clerkId,
    });
    expect(switchingState.isOrgContextReady).toBe(false);
    expect(switchingState.isResolvingOrgContext).toBe(true);
    expect(switchingState.shouldRefreshOrgClaim).toBe(false);

    const waitingState = deriveOrgContextState({
      organizations: [firstOrganization, secondOrganization],
      orgId: firstOrganization.clerkId,
      backendActiveOrgClerkId: firstOrganization.clerkId,
      isAuthLoaded: true,
      isOrganizationListLoaded: true,
      hasFetchedOrganizations: true,
      hasFetchedBackendActiveOrg: true,
      canSetActive: true,
      isSwitching: false,
      pendingOrgClerkId: secondOrganization.clerkId,
    });
    expect(waitingState.isOrgContextReady).toBe(false);
    expect(waitingState.isResolvingOrgContext).toBe(true);
    expect(waitingState.shouldRefreshOrgClaim).toBe(false);
  });

  it("multi-org waits for backend claim alignment before ready", () => {
    const firstOrganization = makeOrganization("org_a");
    const secondOrganization = makeOrganization("org_b");

    const missingBackendState = deriveOrgContextState({
      organizations: [firstOrganization, secondOrganization],
      orgId: secondOrganization.clerkId,
      backendActiveOrgClerkId: null,
      isAuthLoaded: true,
      isOrganizationListLoaded: true,
      hasFetchedOrganizations: true,
      hasFetchedBackendActiveOrg: false,
      canSetActive: true,
      isSwitching: false,
      pendingOrgClerkId: null,
    });
    expect(missingBackendState.isOrgContextReady).toBe(false);
    expect(missingBackendState.isResolvingOrgContext).toBe(true);
    expect(missingBackendState.shouldRefreshOrgClaim).toBe(false);

    const mismatchedBackendState = deriveOrgContextState({
      organizations: [firstOrganization, secondOrganization],
      orgId: secondOrganization.clerkId,
      backendActiveOrgClerkId: firstOrganization.clerkId,
      isAuthLoaded: true,
      isOrganizationListLoaded: true,
      hasFetchedOrganizations: true,
      hasFetchedBackendActiveOrg: true,
      canSetActive: true,
      isSwitching: false,
      pendingOrgClerkId: null,
    });
    expect(mismatchedBackendState.isOrgContextReady).toBe(false);
    expect(mismatchedBackendState.isResolvingOrgContext).toBe(true);
    expect(mismatchedBackendState.shouldRefreshOrgClaim).toBe(true);
    expect(mismatchedBackendState.refreshOrgClaimTargetClerkId).toBe(secondOrganization.clerkId);
  });
});
