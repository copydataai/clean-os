/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bookingDb from "../bookingDb.js";
import type * as bookingRequests from "../bookingRequests.js";
import type * as bookings from "../bookings.js";
import type * as cardDb from "../cardDb.js";
import type * as cardWebhooks from "../cardWebhooks.js";
import type * as cleanerDb from "../cleanerDb.js";
import type * as cleaners from "../cleaners.js";
import type * as clerkWebhooks from "../clerkWebhooks.js";
import type * as customers from "../customers.js";
import type * as dashboard from "../dashboard.js";
import type * as http from "../http.js";
import type * as httpHandlers_clerkActions from "../httpHandlers/clerkActions.js";
import type * as httpHandlers_stripeActions from "../httpHandlers/stripeActions.js";
import type * as httpHandlers_tallyActions from "../httpHandlers/tallyActions.js";
import type * as queries from "../queries.js";
import type * as quoteRequests from "../quoteRequests.js";
import type * as schedule from "../schedule.js";
import type * as stripeActions from "../stripeActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bookingDb: typeof bookingDb;
  bookingRequests: typeof bookingRequests;
  bookings: typeof bookings;
  cardDb: typeof cardDb;
  cardWebhooks: typeof cardWebhooks;
  cleanerDb: typeof cleanerDb;
  cleaners: typeof cleaners;
  clerkWebhooks: typeof clerkWebhooks;
  customers: typeof customers;
  dashboard: typeof dashboard;
  http: typeof http;
  "httpHandlers/clerkActions": typeof httpHandlers_clerkActions;
  "httpHandlers/stripeActions": typeof httpHandlers_stripeActions;
  "httpHandlers/tallyActions": typeof httpHandlers_tallyActions;
  queries: typeof queries;
  quoteRequests: typeof quoteRequests;
  schedule: typeof schedule;
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

export declare const components: {};
