/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as __tests___helpers_orgTestUtils from "../__tests__/helpers/orgTestUtils.js";
import type * as bookingDb from "../bookingDb.js";
import type * as bookingLifecycle from "../bookingLifecycle.js";
import type * as bookingRequestOrgMigration from "../bookingRequestOrgMigration.js";
import type * as bookingRequests from "../bookingRequests.js";
import type * as bookingStateMachine from "../bookingStateMachine.js";
import type * as bookings from "../bookings.js";
import type * as cardDb from "../cardDb.js";
import type * as cardWebhooks from "../cardWebhooks.js";
import type * as cleanerInsights from "../cleanerInsights.js";
import type * as cleaners from "../cleaners.js";
import type * as clerkWebhooks from "../clerkWebhooks.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as emailActions from "../emailActions.js";
import type * as emailDashboard from "../emailDashboard.js";
import type * as emailEvents from "../emailEvents.js";
import type * as emailRenderers from "../emailRenderers.js";
import type * as emailSender from "../emailSender.js";
import type * as emailSends from "../emailSends.js";
import type * as emailSuppressions from "../emailSuppressions.js";
import type * as emailTriggers from "../emailTriggers.js";
import type * as http from "../http.js";
import type * as httpHandlers_clerkActions from "../httpHandlers/clerkActions.js";
import type * as httpHandlers_stripeActions from "../httpHandlers/stripeActions.js";
import type * as httpHandlers_tallyActions from "../httpHandlers/tallyActions.js";
import type * as integrations from "../integrations.js";
import type * as integrationsNode from "../integrationsNode.js";
import type * as lib_bookingFlowDebug from "../lib/bookingFlowDebug.js";
import type * as lib_orgContext from "../lib/orgContext.js";
import type * as lib_publicBookingContext from "../lib/publicBookingContext.js";
import type * as lib_tallyMappings from "../lib/tallyMappings.js";
import type * as lib_tallyRuntime from "../lib/tallyRuntime.js";
import type * as payments from "../payments.js";
import type * as paymentsNode from "../paymentsNode.js";
import type * as pdf_quotePdf from "../pdf/quotePdf.js";
import type * as queries from "../queries.js";
import type * as quoteContent from "../quoteContent.js";
import type * as quoteOrgMigration from "../quoteOrgMigration.js";
import type * as quotePricing from "../quotePricing.js";
import type * as quoteProfiles from "../quoteProfiles.js";
import type * as quoteReminderActions from "../quoteReminderActions.js";
import type * as quoteRequests from "../quoteRequests.js";
import type * as quoteSendActions from "../quoteSendActions.js";
import type * as quotes from "../quotes.js";
import type * as resend from "../resend.js";
import type * as schedule from "../schedule.js";
import type * as sequences from "../sequences.js";
import type * as stripeActions from "../stripeActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "__tests__/helpers/orgTestUtils": typeof __tests___helpers_orgTestUtils;
  bookingDb: typeof bookingDb;
  bookingLifecycle: typeof bookingLifecycle;
  bookingRequestOrgMigration: typeof bookingRequestOrgMigration;
  bookingRequests: typeof bookingRequests;
  bookingStateMachine: typeof bookingStateMachine;
  bookings: typeof bookings;
  cardDb: typeof cardDb;
  cardWebhooks: typeof cardWebhooks;
  cleanerInsights: typeof cleanerInsights;
  cleaners: typeof cleaners;
  clerkWebhooks: typeof clerkWebhooks;
  crons: typeof crons;
  customers: typeof customers;
  dashboard: typeof dashboard;
  emailActions: typeof emailActions;
  emailDashboard: typeof emailDashboard;
  emailEvents: typeof emailEvents;
  emailRenderers: typeof emailRenderers;
  emailSender: typeof emailSender;
  emailSends: typeof emailSends;
  emailSuppressions: typeof emailSuppressions;
  emailTriggers: typeof emailTriggers;
  http: typeof http;
  "httpHandlers/clerkActions": typeof httpHandlers_clerkActions;
  "httpHandlers/stripeActions": typeof httpHandlers_stripeActions;
  "httpHandlers/tallyActions": typeof httpHandlers_tallyActions;
  integrations: typeof integrations;
  integrationsNode: typeof integrationsNode;
  "lib/bookingFlowDebug": typeof lib_bookingFlowDebug;
  "lib/orgContext": typeof lib_orgContext;
  "lib/publicBookingContext": typeof lib_publicBookingContext;
  "lib/tallyMappings": typeof lib_tallyMappings;
  "lib/tallyRuntime": typeof lib_tallyRuntime;
  payments: typeof payments;
  paymentsNode: typeof paymentsNode;
  "pdf/quotePdf": typeof pdf_quotePdf;
  queries: typeof queries;
  quoteContent: typeof quoteContent;
  quoteOrgMigration: typeof quoteOrgMigration;
  quotePricing: typeof quotePricing;
  quoteProfiles: typeof quoteProfiles;
  quoteReminderActions: typeof quoteReminderActions;
  quoteRequests: typeof quoteRequests;
  quoteSendActions: typeof quoteSendActions;
  quotes: typeof quotes;
  resend: typeof resend;
  schedule: typeof schedule;
  sequences: typeof sequences;
  stripeActions: typeof stripeActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      cleanupAbandonedEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      cleanupOldEmails: FunctionReference<
        "mutation",
        "internal",
        { olderThan?: number },
        null
      >;
      createManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          replyTo?: Array<string>;
          subject: string;
          to: Array<string> | string;
        },
        string
      >;
      get: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bcc?: Array<string>;
          bounced?: boolean;
          cc?: Array<string>;
          clicked?: boolean;
          complained: boolean;
          createdAt: number;
          deliveryDelayed?: boolean;
          errorMessage?: string;
          failed?: boolean;
          finalizedAt: number;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          opened: boolean;
          replyTo: Array<string>;
          resendId?: string;
          segment: number;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        } | null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          bounced: boolean;
          clicked: boolean;
          complained: boolean;
          deliveryDelayed: boolean;
          errorMessage: string | null;
          failed: boolean;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        } | null
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          bcc?: Array<string>;
          cc?: Array<string>;
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject?: string;
          template?: {
            id: string;
            variables?: Record<string, string | number>;
          };
          text?: string;
          to: Array<string>;
        },
        string
      >;
      updateManualEmail: FunctionReference<
        "mutation",
        "internal",
        {
          emailId: string;
          errorMessage?: string;
          resendId?: string;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced"
            | "failed";
        },
        null
      >;
    };
  };
};
