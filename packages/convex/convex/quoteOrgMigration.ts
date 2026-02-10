import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuthenticatedUser } from "./lib/orgContext";

type ResolvedOrgId = Id<"organizations"> | undefined;

async function resolveQuoteRequestOrganization(ctx: any, quoteRequest: any): Promise<ResolvedOrgId> {
  if (quoteRequest.organizationId) {
    return quoteRequest.organizationId;
  }

  if (quoteRequest.bookingRequestId) {
    const bookingRequest = await ctx.db.get(quoteRequest.bookingRequestId);
    if (bookingRequest?.organizationId) {
      return bookingRequest.organizationId;
    }
  }

  return undefined;
}

async function resolveQuoteOrganization(ctx: any, quote: any): Promise<ResolvedOrgId> {
  if (quote.organizationId) {
    return quote.organizationId;
  }

  const quoteRequest = await ctx.db.get(quote.quoteRequestId);
  if (quoteRequest?.organizationId) {
    return quoteRequest.organizationId;
  }

  if (quote.bookingRequestId) {
    const bookingRequest = await ctx.db.get(quote.bookingRequestId);
    if (bookingRequest?.organizationId) {
      return bookingRequest.organizationId;
    }
  }

  return undefined;
}

export const backfillQuoteOrganizations = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;

    const quoteRequests = await ctx.db.query("quoteRequests").collect();
    let quoteRequestsPatched = 0;
    for (const quoteRequest of quoteRequests) {
      if (quoteRequest.organizationId) {
        continue;
      }
      const organizationId = await resolveQuoteRequestOrganization(ctx, quoteRequest);
      if (!organizationId) {
        continue;
      }
      quoteRequestsPatched += 1;
      if (!dryRun) {
        await ctx.db.patch(quoteRequest._id, {
          organizationId,
          updatedAt: Date.now(),
        });
      }
    }

    const quotes = await ctx.db.query("quotes").collect();
    let quotesPatched = 0;
    for (const quote of quotes) {
      if (quote.organizationId) {
        continue;
      }
      const organizationId = await resolveQuoteOrganization(ctx, quote);
      if (!organizationId) {
        continue;
      }
      quotesPatched += 1;
      if (!dryRun) {
        await ctx.db.patch(quote._id, {
          organizationId,
          updatedAt: Date.now(),
        });
      }
    }

    const quoteRevisions = await ctx.db.query("quoteRevisions").collect();
    let revisionsPatched = 0;
    for (const revision of quoteRevisions) {
      if (revision.organizationId) {
        continue;
      }
      const quote = await ctx.db.get(revision.quoteId);
      const organizationId = quote?.organizationId;
      if (!organizationId) {
        continue;
      }
      revisionsPatched += 1;
      if (!dryRun) {
        await ctx.db.patch(revision._id, {
          organizationId,
        });
      }
    }

    const reminderEvents = await ctx.db.query("quoteReminderEvents").collect();
    let remindersPatched = 0;
    for (const event of reminderEvents) {
      if (event.organizationId) {
        continue;
      }

      const quote = await ctx.db.get(event.quoteId);
      const quoteRequest = await ctx.db.get(event.quoteRequestId);
      const organizationId = quote?.organizationId ?? quoteRequest?.organizationId;
      if (!organizationId) {
        continue;
      }

      remindersPatched += 1;
      if (!dryRun) {
        await ctx.db.patch(event._id, {
          organizationId,
        });
      }
    }

    return {
      dryRun,
      quoteRequestsPatched,
      quotesPatched,
      revisionsPatched,
      remindersPatched,
    };
  },
});

export const getQuoteOrganizationBackfillReport = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 250);

    const [quoteRequests, quotes, revisions, reminderEvents] = await Promise.all([
      ctx.db.query("quoteRequests").collect(),
      ctx.db.query("quotes").collect(),
      ctx.db.query("quoteRevisions").collect(),
      ctx.db.query("quoteReminderEvents").collect(),
    ]);

    const unresolvedQuoteRequests = quoteRequests
      .filter((row) => !row.organizationId)
      .slice(0, limit)
      .map((row) => row._id);

    const unresolvedQuotes = quotes
      .filter((row) => !row.organizationId)
      .slice(0, limit)
      .map((row) => row._id);

    const unresolvedRevisions = revisions
      .filter((row) => !row.organizationId)
      .slice(0, limit)
      .map((row) => row._id);

    const unresolvedReminderEvents = reminderEvents
      .filter((row) => !row.organizationId)
      .slice(0, limit)
      .map((row) => row._id);

    return {
      unresolvedCounts: {
        quoteRequests: quoteRequests.filter((row) => !row.organizationId).length,
        quotes: quotes.filter((row) => !row.organizationId).length,
        quoteRevisions: revisions.filter((row) => !row.organizationId).length,
        quoteReminderEvents: reminderEvents.filter((row) => !row.organizationId).length,
      },
      samples: {
        quoteRequests: unresolvedQuoteRequests,
        quotes: unresolvedQuotes,
        quoteRevisions: unresolvedRevisions,
        quoteReminderEvents: unresolvedReminderEvents,
      },
    };
  },
});
