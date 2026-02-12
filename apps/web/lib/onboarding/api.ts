import { api } from "@clean-os/convex/api";

export const onboardingApi = {
  listRows: api.bookingLifecycle.listUnifiedLifecycleRows,
  getBookingTimeline: api.bookingLifecycle.getBookingLifecycleTimeline,

  listRecentRequests: api.bookingRequests.listRecent,
  getRequestById: api.bookingRequests.getById,
  createRequestFromDashboard: api.bookingRequests.createFromDashboard,
  markLinkSent: api.bookingRequests.markLinkSent,
  markConfirmLinkSent: api.bookingRequests.markConfirmLinkSent,

  getBooking: api.bookings.getBooking,
  createBookingFromRequest: api.bookings.createBookingFromRequest,
  markBookingCompleted: api.bookings.markJobCompleted,
  chargeBooking: api.bookings.chargeCompletedJob,
  cancelBooking: api.bookings.cancelBooking,
  rescheduleBooking: api.bookings.rescheduleBooking,
  overrideBookingStatus: api.bookings.adminOverrideBookingStatus,

  getQuoteRequestById: api.quoteRequests.getById,
  searchQuoteRequestsForLinking: api.quoteRequests.searchForRequestLinking,

  getBookingAssignments: api.cleaners.getBookingAssignments,

  getTallyLinksForActiveOrganization: api.integrations.getTallyFormLinksForActiveOrganization,

  sendConfirmationEmail: api.emailTriggers.sendConfirmationEmail,
  sendCardRequestEmail: api.emailTriggers.sendCardRequestEmail,
} as const;
