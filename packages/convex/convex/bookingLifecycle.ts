import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { mapOperationalStatusToFunnel } from "./bookingStateMachine";
import { assertRecordInActiveOrg, requireActiveOrganization } from "./lib/orgContext";

const rowTypeValidator = v.union(v.literal("booking"), v.literal("pre_booking"));

const operationalStatusValidator = v.union(
  v.literal("pending_card"),
  v.literal("card_saved"),
  v.literal("scheduled"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("payment_failed"),
  v.literal("charged"),
  v.literal("cancelled"),
  v.literal("failed")
);

const funnelStageValidator = v.union(
  v.literal("requested"),
  v.literal("quoted"),
  v.literal("confirmed"),
  v.literal("card_saved"),
  v.literal("scheduled"),
  v.literal("in_progress"),
  v.literal("service_completed"),
  v.literal("payment_failed"),
  v.literal("charged"),
  v.literal("cancelled")
);

type EmailDeliverySnapshot = {
  sendId: Id<"emailSends">;
  status:
    | "queued"
    | "sent"
    | "delivered"
    | "delivery_delayed"
    | "failed"
    | "skipped";
  provider: string;
  updatedAt: number;
  errorCode?: string;
  errorMessage?: string;
};

async function resolveEmailDeliverySnapshot(
  ctx: any,
  sendId?: Id<"emailSends"> | null
): Promise<EmailDeliverySnapshot | null> {
  if (!sendId) {
    return null;
  }

  const send = await ctx.db.get(sendId);
  if (!send) {
    return null;
  }

  return {
    sendId: send._id,
    status: send.status as EmailDeliverySnapshot["status"],
    provider: send.provider,
    updatedAt: send.updatedAt,
    errorCode: send.errorCode,
    errorMessage: send.errorMessage,
  };
}

function derivePreBookingFunnelStage(args: {
  requestStatus?: string;
  quoteStatus?: string;
  quoteRequestStatus?: string;
}) {
  if (args.requestStatus === "confirmed" || args.quoteStatus === "accepted") {
    return "confirmed" as const;
  }

  if (
    args.quoteStatus === "sent" ||
    args.quoteStatus === "expired" ||
    args.quoteStatus === "send_failed" ||
    args.quoteRequestStatus === "quoted"
  ) {
    return "quoted" as const;
  }

  if (args.quoteRequestStatus === "confirmed") {
    return "confirmed" as const;
  }

  return "requested" as const;
}

function encodeCursor(data: Record<string, string | number>) {
  return encodeURIComponent(JSON.stringify(data));
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null;
  try {
    return JSON.parse(decodeURIComponent(cursor)) as {
      key: string;
    };
  } catch {
    return null;
  }
}

export const getUnifiedFunnelStage = query({
  args: {
    bookingId: v.optional(v.id("bookings")),
    requestId: v.optional(v.id("bookingRequests")),
    quoteRequestId: v.optional(v.id("quoteRequests")),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    if (!args.bookingId && !args.requestId && !args.quoteRequestId) {
      throw new Error("Provide bookingId, requestId, or quoteRequestId");
    }

    if (args.bookingId) {
      const booking = await ctx.db.get(args.bookingId);
      if (!booking) return null;
      assertRecordInActiveOrg(booking.organizationId, organization._id);

      return {
        bookingId: booking._id,
        bookingRequestId: booking.bookingRequestId,
        quoteRequestId: null,
        operationalStatus: booking.status,
        funnelStage: mapOperationalStatusToFunnel(booking.status),
      };
    }

    if (args.requestId) {
      const request = await ctx.db.get(args.requestId);
      if (!request) return null;
      assertRecordInActiveOrg(request.organizationId, organization._id);

      if (request.bookingId) {
        const booking = await ctx.db.get(request.bookingId);
        if (!booking) return null;

        return {
          bookingId: booking._id,
          bookingRequestId: request._id,
          quoteRequestId: request.quoteRequestId ?? null,
          operationalStatus: booking.status,
          funnelStage: mapOperationalStatusToFunnel(booking.status),
        };
      }

      const quote = request.quoteRequestId
        ? await ctx.db
            .query("quotes")
            .withIndex("by_org_quote_request", (q) =>
              q.eq("organizationId", organization._id).eq("quoteRequestId", request.quoteRequestId!)
            )
            .first()
        : null;
      const quoteRequest = request.quoteRequestId
        ? await ctx.db.get(request.quoteRequestId)
        : null;

      return {
        bookingId: null,
        bookingRequestId: request._id,
        quoteRequestId: request.quoteRequestId ?? null,
        operationalStatus: null,
        funnelStage: derivePreBookingFunnelStage({
          requestStatus: request.status,
          quoteStatus: quote?.status,
          quoteRequestStatus: quoteRequest?.requestStatus,
        }),
      };
    }

    const quoteRequest = await ctx.db.get(args.quoteRequestId!);
    if (!quoteRequest) return null;
    assertRecordInActiveOrg(quoteRequest.organizationId, organization._id);

    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_org_quote_request", (q) =>
        q.eq("organizationId", organization._id).eq("quoteRequestId", quoteRequest._id)
      )
      .first();

    const linkedBookingRequestId = quoteRequest.bookingRequestId ?? quote?.bookingRequestId;
    const linkedBookingRequest = linkedBookingRequestId
      ? await ctx.db.get(linkedBookingRequestId)
      : null;

    if (linkedBookingRequest?.bookingId) {
      const booking = await ctx.db.get(linkedBookingRequest.bookingId);
      if (!booking) return null;

      return {
        bookingId: booking._id,
        bookingRequestId: linkedBookingRequest._id,
        quoteRequestId: quoteRequest._id,
        operationalStatus: booking.status,
        funnelStage: mapOperationalStatusToFunnel(booking.status),
      };
    }

    return {
      bookingId: null,
      bookingRequestId: linkedBookingRequest?._id ?? null,
      quoteRequestId: quoteRequest._id,
      operationalStatus: null,
      funnelStage: derivePreBookingFunnelStage({
        requestStatus: linkedBookingRequest?.status,
        quoteStatus: quote?.status,
        quoteRequestStatus: quoteRequest.requestStatus,
      }),
    };
  },
});

export const listUnifiedLifecycleRows = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    rowType: v.optional(rowTypeValidator),
    operationalStatus: v.optional(operationalStatusValidator),
    funnelStage: v.optional(funnelStageValidator),
    search: v.optional(v.string()),
    serviceDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const scanSize = 2000;
    const search = (args.search ?? "").trim().toLowerCase();

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(scanSize);
    const bookingRows = bookings.map((booking) => ({
      rowType: "booking" as const,
      rowId: `booking:${booking._id}`,
      bookingId: booking._id,
      bookingRequestId: booking.bookingRequestId ?? null,
      quoteRequestId: null,
      customerName: booking.customerName ?? null,
      email: booking.email,
      operationalStatus: booking.status,
      funnelStage: mapOperationalStatusToFunnel(booking.status),
      serviceDate: booking.serviceDate ?? null,
      serviceType: booking.serviceType ?? null,
      amount: booking.amount ?? null,
      cardRequestEmailDelivery: null,
      confirmationEmailDelivery: null,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    }));

    const requests = await ctx.db
      .query("bookingRequests")
      .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .take(scanSize);
    const pendingRequests = requests.filter((request) => !request.bookingId);

    const preBookingRows = await Promise.all(
      pendingRequests.map(async (request) => {
        const cardRequestEmailDelivery = await resolveEmailDeliverySnapshot(
          ctx,
          request.cardRequestEmailSendId
        );
        const confirmationEmailDelivery = await resolveEmailDeliverySnapshot(
          ctx,
          request.confirmationEmailSendId
        );
        const quote = request.quoteRequestId
          ? await ctx.db
              .query("quotes")
              .withIndex("by_org_quote_request", (q) =>
                q.eq("organizationId", organization._id).eq("quoteRequestId", request.quoteRequestId!)
              )
              .first()
          : null;

        return {
          rowType: "pre_booking" as const,
          rowId: `pre_booking:${request._id}`,
          bookingId: null,
          bookingRequestId: request._id,
          quoteRequestId: request.quoteRequestId ?? null,
          customerName: request.contactDetails ?? null,
          email: request.email ?? null,
          operationalStatus: null,
          funnelStage: derivePreBookingFunnelStage({
            requestStatus: request.status,
            quoteStatus: quote?.status,
          }),
          serviceDate: null,
          serviceType: null,
          amount: null,
          cardRequestEmailDelivery,
          confirmationEmailDelivery,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        };
      })
    );

    let filteredRows = [...bookingRows, ...preBookingRows];

    if (args.rowType) {
      filteredRows = filteredRows.filter((row) => row.rowType === args.rowType);
    }

    if (args.operationalStatus) {
      filteredRows = filteredRows.filter(
        (row) => row.operationalStatus === args.operationalStatus
      );
    }

    if (args.funnelStage) {
      filteredRows = filteredRows.filter((row) => row.funnelStage === args.funnelStage);
    }

    if (args.serviceDate) {
      filteredRows = filteredRows.filter((row) => row.serviceDate === args.serviceDate);
    }

    if (search) {
      filteredRows = filteredRows.filter((row) => {
        const haystack = [
          row.customerName ?? "",
          row.email ?? "",
          row.bookingId ?? "",
          row.bookingRequestId ?? "",
          row.quoteRequestId ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    filteredRows.sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return b.rowId.localeCompare(a.rowId);
    });

    const decodedCursor = decodeCursor(args.cursor);
    const startIndex = decodedCursor
      ? Math.max(
          0,
          filteredRows.findIndex(
            (row) => `${row.createdAt}:${row.rowId}` === decodedCursor.key
          ) + 1
        )
      : 0;
    const rows = filteredRows.slice(startIndex, startIndex + limit);
    const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
    const nextCursor =
      startIndex + limit < filteredRows.length && lastRow
        ? encodeCursor({ key: `${lastRow.createdAt}:${lastRow.rowId}` })
        : null;

    return {
      rows: rows.map(({ rowId: _rowId, ...row }) => row),
      nextCursor,
    };
  },
});

export const getBookingLifecycleTimeline = query({
  args: {
    bookingId: v.id("bookings"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
    const decodedCursor = decodeCursor(args.cursor);
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) {
      return {
        rows: [],
        nextCursor: null,
      };
    }
    assertRecordInActiveOrg(booking.organizationId, organization._id);

    const events = await ctx.db
      .query("bookingLifecycleEvents")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();

    const sorted = [...events].sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return String(b._id).localeCompare(String(a._id));
    });

    const startIndex = decodedCursor
      ? Math.max(
          0,
          sorted.findIndex((row) => `${row.createdAt}:${row._id}` === decodedCursor.key) + 1
        )
      : 0;
    const pageRows = sorted.slice(startIndex, startIndex + limit);
    const lastRow = pageRows.length > 0 ? pageRows[pageRows.length - 1] : null;
    const nextCursor =
      startIndex + limit < sorted.length && lastRow
        ? encodeCursor({ key: `${lastRow.createdAt}:${lastRow._id}` })
        : null;

    const actorIds = [...new Set(pageRows.map((event) => event.actorUserId).filter(Boolean))];
    const actorDocs = await Promise.all(actorIds.map((id) => ctx.db.get(id!)));
    const actorMap = new Map(
      actorDocs
        .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
        .map((doc) => [doc._id, doc])
    );

    return {
      rows: pageRows.map((event) => {
        const actor = event.actorUserId ? actorMap.get(event.actorUserId) : null;
        return {
          _id: event._id,
          bookingId: event.bookingId,
          eventType: event.eventType,
          fromStatus: event.fromStatus ?? null,
          toStatus: event.toStatus ?? null,
          reason: event.reason ?? null,
          source: event.source,
          actorUserId: event.actorUserId ?? null,
          actorName: actor
            ? [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim() || actor.email
            : null,
          fromServiceDate: event.fromServiceDate ?? null,
          toServiceDate: event.toServiceDate ?? null,
          metadata: event.metadata ?? null,
          createdAt: event.createdAt,
        };
      }),
      nextCursor,
    };
  },
});
