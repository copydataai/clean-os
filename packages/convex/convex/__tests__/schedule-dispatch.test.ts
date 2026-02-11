import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { createTestOrganization } from "./helpers/orgTestUtils";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../bookingStateMachine.ts": () => import("../bookingStateMachine"),
  "../bookingLifecycle.ts": () => import("../bookingLifecycle"),
  "../bookingDb.ts": () => import("../bookingDb"),
  "../bookings.ts": () => import("../bookings"),
  "../cleaners.ts": () => import("../cleaners"),
  "../schedule.ts": () => import("../schedule"),
  "../customers.ts": () => import("../customers"),
};

async function createAuthedOrgClient(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  clerkOrgId: string
) {
  const clerkUserId = `authed_${Math.random().toString(36).slice(2, 10)}`;
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: clerkUserId,
      email: `${clerkUserId}@example.com`,
      firstName: "Test",
      lastName: "Authed",
    });
    await ctx.db.insert("organizationMemberships", {
      clerkId: `membership_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      organizationId,
      role: "owner",
    });
  });
  return t.withIdentity({
    subject: clerkUserId,
    orgId: clerkOrgId,
  });
}

describe.sequential("schedule dispatch query", () => {
  it("returns checklist rollups per booking in dispatch payload", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, clerkOrgId } = await createTestOrganization(t);
    const authed = await createAuthedOrgClient(t, organizationId, clerkOrgId);
    const now = Date.now();
    const date = "2026-02-13";

    const { bookingWithChecklistId, assignmentId, bookingWithoutChecklistId } = await t.run(
      async (ctx) => {
        const bookingWithChecklistId = await ctx.db.insert("bookings", {
          organizationId,
          email: "a@example.com",
          customerName: "Checklist Booking",
          status: "in_progress",
          serviceDate: date,
          createdAt: now,
          updatedAt: now,
        });
        const bookingWithoutChecklistId = await ctx.db.insert("bookings", {
          organizationId,
          email: "b@example.com",
          customerName: "No Checklist Booking",
          status: "scheduled",
          serviceDate: date,
          createdAt: now + 1,
          updatedAt: now + 1,
        });

        const assignmentId = await ctx.db.insert("bookingAssignments", {
          bookingId: bookingWithChecklistId,
          cleanerId: undefined,
          crewId: undefined,
          role: "primary",
          status: "in_progress",
          assignedAt: now,
          clockedInAt: now,
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("bookingChecklistItems", {
          bookingAssignmentId: assignmentId,
          bookingId: bookingWithChecklistId,
          label: "Task 1",
          sortOrder: 1,
          isCompleted: true,
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("bookingChecklistItems", {
          bookingAssignmentId: assignmentId,
          bookingId: bookingWithChecklistId,
          label: "Task 2",
          sortOrder: 2,
          isCompleted: false,
          createdAt: now,
          updatedAt: now,
        });

        return { bookingWithChecklistId, assignmentId, bookingWithoutChecklistId };
      }
    );

    const dispatch = await authed.query(api.schedule.getDispatchDay, { date });
    const bookingWithChecklist = dispatch.bookings.find(
      (booking: any) => booking._id === bookingWithChecklistId
    );
    const bookingWithoutChecklist = dispatch.bookings.find(
      (booking: any) => booking._id === bookingWithoutChecklistId
    );

    expect(bookingWithChecklist).toBeTruthy();
    expect(bookingWithChecklist?.checklist).toEqual({
      total: 2,
      completed: 1,
      complete: false,
    });
    expect(bookingWithoutChecklist).toBeTruthy();
    expect(bookingWithoutChecklist?.checklist).toEqual({
      total: 0,
      completed: 0,
      complete: true,
    });

    const assignmentWithChecklist = bookingWithChecklist?.assignments.cleaners ?? [];
    expect(assignmentWithChecklist.length).toBe(0);
    expect(assignmentId).toBeTruthy();
  });
});
