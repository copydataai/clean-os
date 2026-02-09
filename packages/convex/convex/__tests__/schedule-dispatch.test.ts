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
  "../schedule.ts": () => import("../schedule"),
};

describe.sequential("schedule dispatch query", () => {
  it("returns checklist rollups per booking in dispatch payload", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const date = "2026-02-13";

    const { bookingWithChecklistId, assignmentId, bookingWithoutChecklistId } = await t.run(
      async (ctx) => {
        const bookingWithChecklistId = await ctx.db.insert("bookings", {
          email: "a@example.com",
          customerName: "Checklist Booking",
          status: "in_progress",
          serviceDate: date,
          createdAt: now,
          updatedAt: now,
        });
        const bookingWithoutChecklistId = await ctx.db.insert("bookings", {
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

    const dispatch = await t.query(api.schedule.getDispatchDay, { date });
    const bookingWithChecklist = dispatch.bookings.find(
      (booking) => booking._id === bookingWithChecklistId
    );
    const bookingWithoutChecklist = dispatch.bookings.find(
      (booking) => booking._id === bookingWithoutChecklistId
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
