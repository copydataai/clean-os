import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const users = defineTable({
  clerkId: v.string(),
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
})
  .index("by_clerk_id", ["clerkId"]);

const organizations = defineTable({
  clerkId: v.string(),
  name: v.string(),
  slug: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
})
  .index("by_clerk_id", ["clerkId"]);

const organizationMemberships = defineTable({
  clerkId: v.string(), // membership ID from Clerk
  userId: v.id("users"),
  organizationId: v.id("organizations"),
  role: v.string(), // "admin", "member", etc.
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_user", ["userId"])
  .index("by_organization", ["organizationId"])
  .index("by_user_and_org", ["userId", "organizationId"]);

export default defineSchema({
  users,
  organizations,
  organizationMemberships,
});