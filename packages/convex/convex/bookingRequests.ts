import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { assertRecordInActiveOrg, requireActiveOrganization } from "./lib/orgContext";
import { resolveCanonicalBookingRoute, resolvePublicBookingContext } from "./lib/publicBookingContext";

const FALLBACK_LOOKBACK_DAYS = 7;
const FALLBACK_SAMPLE_SIZE = 10;

export const createRequest = internalMutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    requestResponseId: v.optional(v.string()),
    requestFormId: v.optional(v.string()),
    quoteRequestId: v.optional(v.id("quoteRequests")),
    email: v.optional(v.string()),
    contactDetails: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    accessMethod: v.optional(v.array(v.string())),
    accessInstructions: v.optional(v.string()),
    parkingInstructions: v.optional(v.string()),
    floorTypes: v.optional(v.array(v.string())),
    finishedBasement: v.optional(v.string()),
    delicateSurfaces: v.optional(v.string()),
    attentionAreas: v.optional(v.string()),
    pets: v.optional(v.array(v.string())),
    homeDuringCleanings: v.optional(v.string()),
    scheduleAdjustmentWindows: v.optional(v.array(v.string())),
    timingShiftOk: v.optional(v.string()),
    additionalNotes: v.optional(v.string()),
    rawRequestPayload: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Id<"bookingRequests">> => {
    const customerId = args.email
      ? await ctx.runMutation(internal.customers.ensureLifecycleCustomer, {
          organizationId: args.organizationId,
          email: args.email,
          contactDetails: args.contactDetails,
          phone: args.phoneNumber,
          source: "booking_request",
        })
      : undefined;

    const now = Date.now();
    const requestId = await ctx.db.insert("bookingRequests", {
      organizationId: args.organizationId,
      status: "requested",
      requestResponseId: args.requestResponseId,
      requestFormId: args.requestFormId,
      quoteRequestId: args.quoteRequestId,
      customerId,
      email: args.email,
      contactDetails: args.contactDetails,
      phoneNumber: args.phoneNumber,
      accessMethod: args.accessMethod,
      accessInstructions: args.accessInstructions,
      parkingInstructions: args.parkingInstructions,
      floorTypes: args.floorTypes,
      finishedBasement: args.finishedBasement,
      delicateSurfaces: args.delicateSurfaces,
      attentionAreas: args.attentionAreas,
      pets: args.pets,
      homeDuringCleanings: args.homeDuringCleanings,
      scheduleAdjustmentWindows: args.scheduleAdjustmentWindows,
      timingShiftOk: args.timingShiftOk,
      additionalNotes: args.additionalNotes,
      rawRequestPayload: args.rawRequestPayload,
      createdAt: now,
      updatedAt: now,
    });

    if (customerId) {
      await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
        customerId,
        bookingRequestId: requestId,
        quoteRequestId: args.quoteRequestId,
      });
    }

    return requestId;
  },
});

export const confirmRequest = internalMutation({
  args: {
    organizationId: v.optional(v.id("organizations")),
    requestId: v.optional(v.id("bookingRequests")),
    email: v.optional(v.string()),
    confirmationResponseId: v.optional(v.string()),
    confirmationFormId: v.optional(v.string()),
    quoteRequestId: v.optional(v.id("quoteRequests")),
    contactDetails: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    accessMethod: v.optional(v.array(v.string())),
    accessInstructions: v.optional(v.string()),
    parkingInstructions: v.optional(v.string()),
    floorTypes: v.optional(v.array(v.string())),
    finishedBasement: v.optional(v.string()),
    delicateSurfaces: v.optional(v.string()),
    attentionAreas: v.optional(v.string()),
    pets: v.optional(v.array(v.string())),
    homeDuringCleanings: v.optional(v.string()),
    scheduleAdjustmentWindows: v.optional(v.array(v.string())),
    timingShiftOk: v.optional(v.string()),
    additionalNotes: v.optional(v.string()),
    rawConfirmationPayload: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Id<"bookingRequests"> | null> => {
    let request = args.requestId ? await ctx.db.get(args.requestId) : null;
    const normalizedEmail = args.email?.trim().toLowerCase();

    if (!request && args.email) {
      const candidates = args.organizationId
        ? await ctx.db
            .query("bookingRequests")
            .withIndex("by_org_email", (q) =>
              q.eq("organizationId", args.organizationId).eq("email", args.email!)
            )
            .order("desc")
            .take(FALLBACK_SAMPLE_SIZE)
        : await ctx.db
            .query("bookingRequests")
            .withIndex("by_email", (q) => q.eq("email", args.email!))
            .order("desc")
            .take(FALLBACK_SAMPLE_SIZE);

      const normalizedCandidates =
        normalizedEmail && normalizedEmail !== args.email
          ? args.organizationId
            ? await ctx.db
                .query("bookingRequests")
                .withIndex("by_org_email", (q) =>
                  q.eq("organizationId", args.organizationId!).eq("email", normalizedEmail)
                )
                .order("desc")
                .take(FALLBACK_SAMPLE_SIZE)
            : await ctx.db
                .query("bookingRequests")
                .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
                .order("desc")
                .take(FALLBACK_SAMPLE_SIZE)
          : [];

      const cutoff = Date.now() - FALLBACK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
      request =
        [...candidates, ...normalizedCandidates].find(
          (candidate) => candidate.createdAt >= cutoff
        ) ?? null;
    }

    if (!request) {
      if (args.requestId) {
        return null;
      }
      const customerId = args.email
        ? await ctx.runMutation(internal.customers.ensureLifecycleCustomer, {
            organizationId: args.organizationId,
            email: args.email,
            contactDetails: args.contactDetails,
            phone: args.phoneNumber,
            source: "booking_request",
          })
        : undefined;

      const now = Date.now();
      const createdId = await ctx.db.insert("bookingRequests", {
        organizationId: args.organizationId,
        status: "confirmed",
        confirmationResponseId: args.confirmationResponseId,
        confirmationFormId: args.confirmationFormId,
        quoteRequestId: args.quoteRequestId,
        customerId,
        email: args.email,
        contactDetails: args.contactDetails,
        phoneNumber: args.phoneNumber,
        accessMethod: args.accessMethod,
        accessInstructions: args.accessInstructions,
        parkingInstructions: args.parkingInstructions,
        floorTypes: args.floorTypes,
        finishedBasement: args.finishedBasement,
        delicateSurfaces: args.delicateSurfaces,
        attentionAreas: args.attentionAreas,
        pets: args.pets,
        homeDuringCleanings: args.homeDuringCleanings,
        scheduleAdjustmentWindows: args.scheduleAdjustmentWindows,
        timingShiftOk: args.timingShiftOk,
        additionalNotes: args.additionalNotes,
        rawConfirmationPayload: args.rawConfirmationPayload,
        createdAt: now,
        updatedAt: now,
        confirmedAt: now,
      });

      if (customerId) {
        await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
          customerId,
          bookingRequestId: createdId,
          quoteRequestId: args.quoteRequestId,
        });
      }

      if (args.quoteRequestId) {
        await ctx.runMutation(internal.quoteRequests.markConfirmed, {
          quoteRequestId: args.quoteRequestId,
        });
      }
      await ctx.runMutation(internal.quotes.onBookingRequestConfirmed, {
        bookingRequestId: createdId,
      });
      return createdId;
    }

    const nextEmail = args.email ?? request.email;
    const nextOrganizationId = args.organizationId ?? request.organizationId;
    const nextQuoteRequestId = args.quoteRequestId ?? request.quoteRequestId;
    const customerId = nextEmail
      ? await ctx.runMutation(internal.customers.ensureLifecycleCustomer, {
          organizationId: nextOrganizationId,
          email: nextEmail,
          contactDetails: args.contactDetails ?? request.contactDetails,
          phone: args.phoneNumber ?? request.phoneNumber,
          source: "booking_request",
        })
      : request.customerId;

    await ctx.db.patch(request._id, {
      organizationId: nextOrganizationId,
      status: "confirmed",
      confirmationResponseId: args.confirmationResponseId,
      confirmationFormId: args.confirmationFormId,
      quoteRequestId: nextQuoteRequestId,
      customerId,
      email: nextEmail,
      contactDetails: args.contactDetails ?? request.contactDetails,
      phoneNumber: args.phoneNumber ?? request.phoneNumber,
      accessMethod: args.accessMethod ?? request.accessMethod,
      accessInstructions: args.accessInstructions ?? request.accessInstructions,
      parkingInstructions: args.parkingInstructions ?? request.parkingInstructions,
      floorTypes: args.floorTypes ?? request.floorTypes,
      finishedBasement: args.finishedBasement ?? request.finishedBasement,
      delicateSurfaces: args.delicateSurfaces ?? request.delicateSurfaces,
      attentionAreas: args.attentionAreas ?? request.attentionAreas,
      pets: args.pets ?? request.pets,
      homeDuringCleanings: args.homeDuringCleanings ?? request.homeDuringCleanings,
      scheduleAdjustmentWindows: args.scheduleAdjustmentWindows ?? request.scheduleAdjustmentWindows,
      timingShiftOk: args.timingShiftOk ?? request.timingShiftOk,
      additionalNotes: args.additionalNotes ?? request.additionalNotes,
      rawConfirmationPayload: args.rawConfirmationPayload,
      updatedAt: Date.now(),
      confirmedAt: Date.now(),
    });

    if (customerId) {
      await ctx.runMutation(internal.customers.linkLifecycleRecordsToCustomer, {
        customerId,
        bookingRequestId: request._id,
        quoteRequestId: nextQuoteRequestId,
      });
    }

    if (nextQuoteRequestId) {
      await ctx.runMutation(internal.quoteRequests.markConfirmed, {
        quoteRequestId: nextQuoteRequestId,
      });
    }

    await ctx.runMutation(internal.quotes.onBookingRequestConfirmed, {
      bookingRequestId: request._id,
    });

    return request._id;
  },
});

export const createFromDashboard = mutation({
  args: {
    mode: v.union(v.literal("new"), v.literal("existing")),
    existingQuoteRequestId: v.optional(v.id("quoteRequests")),
    contact: v.object({
      firstName: v.string(),
      lastName: v.string(),
      email: v.string(),
      phone: v.string(),
    }),
    quote: v.object({
      service: v.string(),
      serviceType: v.string(),
      frequency: v.optional(v.string()),
      squareFootage: v.number(),
      address: v.string(),
      addressLine2: v.optional(v.string()),
      postalCode: v.string(),
      city: v.string(),
      state: v.string(),
      additionalNotes: v.optional(v.string()),
    }),
    request: v.object({
      accessMethod: v.optional(v.array(v.string())),
      accessInstructions: v.optional(v.string()),
      parkingInstructions: v.optional(v.string()),
      floorTypes: v.optional(v.array(v.string())),
      finishedBasement: v.optional(v.string()),
      delicateSurfaces: v.optional(v.string()),
      attentionAreas: v.optional(v.string()),
      pets: v.optional(v.array(v.string())),
      homeDuringCleanings: v.optional(v.string()),
      scheduleAdjustmentWindows: v.optional(v.array(v.string())),
      timingShiftOk: v.optional(v.string()),
      additionalNotes: v.optional(v.string()),
    }),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    bookingRequestId: Id<"bookingRequests">;
    quoteRequestId: Id<"quoteRequests">;
    reusedQuote: boolean;
  }> => {
    const { organization } = await requireActiveOrganization(ctx);
    const firstName = args.contact.firstName.trim();
    const lastName = args.contact.lastName.trim();
    const contactDetails = `${firstName} ${lastName}`.trim();
    const quoteEmail = args.contact.email.trim();
    const quotePhone = args.contact.phone.trim();

    console.info("[Dashboard Request] createFromDashboard.start", {
      organizationId: organization._id,
      mode: args.mode,
      existingQuoteRequestId: args.existingQuoteRequestId ?? null,
    });

    try {
      if (args.mode === "existing") {
        if (!args.existingQuoteRequestId) {
          throw new Error("EXISTING_QUOTE_REQUEST_ID_REQUIRED");
        }

        const existingQuote = await ctx.db.get(args.existingQuoteRequestId);
        if (!existingQuote) {
          throw new Error("QUOTE_REQUEST_NOT_FOUND");
        }
        assertRecordInActiveOrg(existingQuote.organizationId, organization._id);

        if (existingQuote.bookingRequestId) {
          throw new Error("QUOTE_ALREADY_LINKED_TO_REQUEST");
        }

        const existingFirstName = (existingQuote.firstName || firstName).trim();
        const existingLastName = (existingQuote.lastName || lastName).trim();
        const existingContactDetails = `${existingFirstName} ${existingLastName}`.trim();
        const existingEmail = (existingQuote.email || quoteEmail).trim();
        const existingPhone = (existingQuote.phone || quotePhone).trim();

        const bookingRequestId: Id<"bookingRequests"> = await ctx.runMutation(
          internal.bookingRequests.createRequest,
          {
            organizationId: organization._id,
            quoteRequestId: existingQuote._id,
            email: existingEmail || undefined,
            contactDetails: existingContactDetails || undefined,
            phoneNumber: existingPhone || undefined,
            accessMethod: args.request.accessMethod,
            accessInstructions: args.request.accessInstructions,
            parkingInstructions: args.request.parkingInstructions,
            floorTypes: args.request.floorTypes,
            finishedBasement: args.request.finishedBasement,
            delicateSurfaces: args.request.delicateSurfaces,
            attentionAreas: args.request.attentionAreas,
            pets: args.request.pets,
            homeDuringCleanings: args.request.homeDuringCleanings,
            scheduleAdjustmentWindows: args.request.scheduleAdjustmentWindows,
            timingShiftOk: args.request.timingShiftOk,
            additionalNotes: args.request.additionalNotes,
          }
        );

        await ctx.runMutation(internal.quoteRequests.linkBookingRequestId, {
          quoteRequestId: existingQuote._id,
          bookingRequestId,
        });

        console.info("[Dashboard Request] createFromDashboard.success", {
          organizationId: organization._id,
          mode: args.mode,
          bookingRequestId,
          quoteRequestId: existingQuote._id,
          reusedQuote: true,
        });

        return {
          bookingRequestId,
          quoteRequestId: existingQuote._id,
          reusedQuote: true,
        };
      }

      const bookingRequestId: Id<"bookingRequests"> = await ctx.runMutation(
        internal.bookingRequests.createRequest,
        {
          organizationId: organization._id,
          email: quoteEmail,
          contactDetails: contactDetails || undefined,
          phoneNumber: quotePhone || undefined,
          accessMethod: args.request.accessMethod,
          accessInstructions: args.request.accessInstructions,
          parkingInstructions: args.request.parkingInstructions,
          floorTypes: args.request.floorTypes,
          finishedBasement: args.request.finishedBasement,
          delicateSurfaces: args.request.delicateSurfaces,
          attentionAreas: args.request.attentionAreas,
          pets: args.request.pets,
          homeDuringCleanings: args.request.homeDuringCleanings,
          scheduleAdjustmentWindows: args.request.scheduleAdjustmentWindows,
          timingShiftOk: args.request.timingShiftOk,
          additionalNotes: args.request.additionalNotes,
        }
      );

      const quoteRequestId: Id<"quoteRequests"> = await ctx.runMutation(
        internal.quoteRequests.createQuoteRequest,
        {
          organizationId: organization._id,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          email: quoteEmail || undefined,
          phone: quotePhone || undefined,
          service: args.quote.service,
          serviceType: args.quote.serviceType,
          frequency: args.quote.frequency,
          squareFootage: args.quote.squareFootage,
          address: args.quote.address,
          addressLine2: args.quote.addressLine2,
          postalCode: args.quote.postalCode,
          city: args.quote.city,
          state: args.quote.state,
          additionalNotes: args.quote.additionalNotes,
          bookingRequestId,
        }
      );

      await ctx.runMutation(internal.bookingRequests.linkQuoteRequestToRequest, {
        requestId: bookingRequestId,
        quoteRequestId,
      });

      console.info("[Dashboard Request] createFromDashboard.success", {
        organizationId: organization._id,
        mode: args.mode,
        bookingRequestId,
        quoteRequestId,
        reusedQuote: false,
      });

      return {
        bookingRequestId,
        quoteRequestId,
        reusedQuote: false,
      };
    } catch (error) {
      console.warn("[Dashboard Request] createFromDashboard.error", {
        organizationId: organization._id,
        mode: args.mode,
        existingQuoteRequestId: args.existingQuoteRequestId ?? null,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

export const getRequestById = internalQuery({
  args: { id: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getLatestRequestByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookingRequests")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .order("desc")
      .first();
  },
});

export const linkBookingToRequest = internalMutation({
  args: {
    requestId: v.id("bookingRequests"),
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      bookingId: args.bookingId,
      updatedAt: Date.now(),
    });
  },
});

export const linkQuoteRequestToRequest = internalMutation({
  args: {
    requestId: v.id("bookingRequests"),
    quoteRequestId: v.id("quoteRequests"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      quoteRequestId: args.quoteRequestId,
      updatedAt: Date.now(),
    });
  },
});

export const markLinkSent = mutation({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Booking request not found");
    }
    if (request.organizationId !== organization._id) {
      throw new Error("ORG_MISMATCH");
    }

    await ctx.db.patch(args.requestId, {
      linkSentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markLinkSentInternal = internalMutation({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      linkSentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markConfirmLinkSentInternal = internalMutation({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, {
      confirmLinkSentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markConfirmLinkSent = mutation({
  args: { requestId: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Booking request not found");
    }
    if (request.organizationId !== organization._id) {
      throw new Error("ORG_MISMATCH");
    }

    await ctx.db.patch(args.requestId, {
      confirmLinkSentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getById = query({
  args: { id: v.id("bookingRequests") },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const request = await ctx.db.get(args.id);
    if (!request) {
      return null;
    }
    if (request.organizationId !== organization._id) {
      throw new Error("ORG_MISMATCH");
    }

    const canonicalRoute = await resolveCanonicalBookingRoute(ctx, request._id);
    return {
      ...request,
      canonicalBookingHandle: canonicalRoute.errorCode ? null : canonicalRoute.canonicalSlug,
    };
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const limit = args.limit ?? 20;

    let requests;
    if (args.status) {
      const status = args.status;
      requests = await ctx.db
        .query("bookingRequests")
        .withIndex("by_org_status", (q) =>
          q.eq("organizationId", organization._id).eq("status", status)
        )
        .order("desc")
        .take(limit);
    } else {
      requests = await ctx.db
        .query("bookingRequests")
        .withIndex("by_organization", (q) => q.eq("organizationId", organization._id))
        .order("desc")
        .take(limit);
    }

    const withBookingStatus = await Promise.all(
      requests.map(async (request) => {
        const canonicalRoute = await resolveCanonicalBookingRoute(ctx, request._id);
        const canonicalBookingHandle = canonicalRoute.errorCode ? null : canonicalRoute.canonicalSlug;

        if (!request.bookingId) {
          return { ...request, bookingStatus: null, canonicalBookingHandle };
        }
        const booking = await ctx.db.get(request.bookingId);
        return {
          ...request,
          bookingStatus: booking?.status ?? null,
          canonicalBookingHandle,
        };
      })
    );
    return withBookingStatus;
  },
});

export const listByStatus = query({
  args: {
    status: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireActiveOrganization(ctx);
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("bookingRequests")
      .withIndex("by_org_status", (q) =>
        q.eq("organizationId", organization._id).eq("status", args.status)
      )
      .order("desc")
      .take(limit);
  },
});

export const resolvePublicBookingRoute = query({
  args: {
    requestId: v.id("bookingRequests"),
  },
  handler: async (ctx, args) => {
    const route = await resolveCanonicalBookingRoute(ctx, args.requestId);
    if (route.errorCode) {
      return null;
    }

    return {
      handle: route.canonicalSlug,
      organizationId: route.organizationId,
    };
  },
});

export const resolveCanonicalBookingRouteInternal = internalQuery({
  args: {
    requestId: v.id("bookingRequests"),
  },
  handler: async (ctx, args) => {
    const route = await resolveCanonicalBookingRoute(ctx, args.requestId);
    if (route.errorCode) {
      return null;
    }

    return {
      handle: route.canonicalSlug,
      organizationId: route.organizationId,
    };
  },
});

export const getPublicBookingContext = query({
  args: {
    requestId: v.id("bookingRequests"),
  },
  handler: async (ctx, args) => {
    return await resolvePublicBookingContext(ctx, args.requestId);
  },
});
