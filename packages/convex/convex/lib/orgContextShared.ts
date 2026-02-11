import type { Doc } from "../_generated/dataModel";

export type MembershipWithOrganization = Doc<"organizationMemberships"> & {
  organization: Doc<"organizations">;
};

export function normalizeOrgClaim(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function compareMemberships(
  left: MembershipWithOrganization,
  right: MembershipWithOrganization
): number {
  return (
    left.organization.name.localeCompare(right.organization.name) ||
    String(left.organization._id).localeCompare(String(right.organization._id))
  );
}
