import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireAuthenticatedUser } from "./lib/orgContext";

export const backfillBookingRequestOrganizations = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const limit = Math.min(Math.max(args.limit ?? 5000, 1), 20000);

    const requests = await ctx.db.query("bookingRequests").collect();
    const missingOrganization = requests.filter((request) => !request.organizationId).slice(0, limit);

    let patched = 0;
    let unresolvedNoQuoteRequest = 0;
    let unresolvedNoQuoteOrg = 0;

    for (const request of missingOrganization) {
      if (!request.quoteRequestId) {
        unresolvedNoQuoteRequest += 1;
        continue;
      }

      const quoteRequest = await ctx.db.get(request.quoteRequestId);
      if (!quoteRequest?.organizationId) {
        unresolvedNoQuoteOrg += 1;
        continue;
      }

      patched += 1;
      if (!dryRun) {
        await ctx.db.patch(request._id, {
          organizationId: quoteRequest.organizationId,
          updatedAt: Date.now(),
        });
      }
    }

    return {
      dryRun,
      scanned: missingOrganization.length,
      patched,
      unresolvedNoQuoteRequest,
      unresolvedNoQuoteOrg,
    };
  },
});

export const getBookingRequestOrganizationBackfillReport = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const requests = await ctx.db.query("bookingRequests").collect();
    const missingOrganization = requests.filter((request) => !request.organizationId);

    const resolvable: Array<any> = [];
    const unresolved: Array<any> = [];
    let resolvableCount = 0;
    let unresolvedCount = 0;
    let orgConflictCount = 0;
    const conflictSamples: Array<any> = [];

    for (const request of requests) {
      if (!request.quoteRequestId) {
        continue;
      }
      const quoteRequest = await ctx.db.get(request.quoteRequestId);
      if (
        request.organizationId &&
        quoteRequest?.organizationId &&
        request.organizationId !== quoteRequest.organizationId
      ) {
        orgConflictCount += 1;
        if (conflictSamples.length < limit) {
          conflictSamples.push({
            requestId: request._id,
            requestOrganizationId: request.organizationId,
            quoteRequestId: request.quoteRequestId,
            quoteRequestOrganizationId: quoteRequest.organizationId,
          });
        }
      }
    }

    for (const request of missingOrganization) {
      const quoteRequest = request.quoteRequestId
        ? await ctx.db.get(request.quoteRequestId)
        : null;
      if (quoteRequest?.organizationId) {
        resolvableCount += 1;
        if (resolvable.length < limit) {
          resolvable.push({
            requestId: request._id,
            quoteRequestId: request.quoteRequestId,
            organizationId: quoteRequest.organizationId,
          });
        }
      } else {
        unresolvedCount += 1;
        if (unresolved.length < limit) {
          unresolved.push({
            requestId: request._id,
            quoteRequestId: request.quoteRequestId ?? null,
          });
        }
      }
    }

    return {
      counts: {
        missingOrganizationId: missingOrganization.length,
        resolvableFromQuoteRequest: resolvableCount,
        unresolved: unresolvedCount,
        orgConflictCount,
      },
      samples: {
        resolvable,
        unresolved,
        conflicts: conflictSamples,
      },
    };
  },
});
