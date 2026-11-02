/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as automation from "../automation.js";
import type * as crons from "../crons.js";
import type * as devSeed from "../devSeed.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_hmac from "../lib/hmac.js";
import type * as lib_log from "../lib/log.js";
import type * as lib_payload from "../lib/payload.js";
import type * as lib_retry from "../lib/retry.js";
import type * as lib_validation from "../lib/validation.js";
import type * as loans from "../loans.js";
import type * as notifications from "../notifications.js";
import type * as tools from "../tools.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  automation: typeof automation;
  crons: typeof crons;
  devSeed: typeof devSeed;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/authz": typeof lib_authz;
  "lib/hmac": typeof lib_hmac;
  "lib/log": typeof lib_log;
  "lib/payload": typeof lib_payload;
  "lib/retry": typeof lib_retry;
  "lib/validation": typeof lib_validation;
  loans: typeof loans;
  notifications: typeof notifications;
  tools: typeof tools;
  users: typeof users;
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
