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
import type * as bookings from "../bookings.js";
import type * as cardDb from "../cardDb.js";
import type * as cardWebhooks from "../cardWebhooks.js";
import type * as clerkWebhooks from "../clerkWebhooks.js";
import type * as http from "../http.js";
import type * as queries from "../queries.js";
import type * as stripeActions from "../stripeActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bookingDb: typeof bookingDb;
  bookings: typeof bookings;
  cardDb: typeof cardDb;
  cardWebhooks: typeof cardWebhooks;
  clerkWebhooks: typeof clerkWebhooks;
  http: typeof http;
  queries: typeof queries;
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
