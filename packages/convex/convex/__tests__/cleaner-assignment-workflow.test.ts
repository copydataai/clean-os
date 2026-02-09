import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules: Record<string, () => Promise<any>> = {
  "../_generated/api.ts": () => import("../_generated/api"),
  "../_generated/server.ts": () => import("../_generated/server"),
  "../bookingStateMachine.ts": () => import("../bookingStateMachine"),
  "../bookingLifecycle.ts": () => import("../bookingLifecycle"),
  "../bookingDb.ts": () => import("../bookingDb"),
  "../bookings.ts": () => import("../bookings"),
  "../cleaners.ts": () => import("../cleaners"),
};

async function insertScheduledBooking(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    return await ctx.db.insert("bookings", {
      email: "cleaner-test@example.com",
      customerName: "Cleaner Test",
      status: "scheduled",
      serviceDate: "2026-02-12",
      serviceWindowStart: "09:00",
      serviceWindowEnd: "11:00",
      createdAt: now,
      updatedAt: now,
    });
  });
}

async function insertAssignment(
  t: ReturnType<typeof convexTest>,
  bookingId: any,
  status: string
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    return await ctx.db.insert("bookingAssignments", {
      bookingId,
      cleanerId: undefined,
      crewId: undefined,
      role: "primary",
      status,
      assignedAt: now,
      confirmedAt: status === "confirmed" ? now : undefined,
      clockedInAt: status === "in_progress" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe.sequential("cleaner assignment workflow", () => {
  it("enforces assignment transition guards", async () => {
    const t = convexTest(schema, modules);
    const bookingId = await insertScheduledBooking(t);
    const assignmentId = await insertAssignment(t, bookingId, "pending");

    await expect(
      t.mutation(api.cleaners.confirmAssignment, { assignmentId })
    ).rejects.toThrow("transition pending -> confirmed is not allowed");

    await t.mutation(api.cleaners.respondToAssignment, {
      assignmentId,
      response: "accepted",
    });

    await expect(
      t.mutation(api.cleaners.respondToAssignment, {
        assignmentId,
        response: "declined",
      })
    ).rejects.toThrow("transition accepted -> declined is not allowed");
  });

  it("blocks clock-out until checklist is complete", async () => {
    const t = convexTest(schema, modules);
    const bookingId = await insertScheduledBooking(t);
    const assignmentId = await insertAssignment(t, bookingId, "in_progress");

    const checklistItemId = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("bookingChecklistItems", {
        bookingAssignmentId: assignmentId,
        bookingId,
        label: "Wipe all counters",
        sortOrder: 1,
        isCompleted: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    await expect(
      t.mutation(api.cleaners.clockOut, { assignmentId })
    ).rejects.toThrow("Cannot clock out before checklist is complete");

    await t.mutation(api.cleaners.toggleChecklistItem, {
      checklistItemId,
      isCompleted: true,
    });
    await t.mutation(api.cleaners.clockOut, { assignmentId });

    const after = await t.run(async (ctx) => {
      const assignment = await ctx.db.get(assignmentId);
      const booking = await ctx.db.get(bookingId);
      return { assignment, booking };
    });

    expect(after.assignment?.status).toBe("completed");
    expect(after.booking?.status).toBe("completed");
  });
});
