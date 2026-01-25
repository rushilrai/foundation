/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as http from "../http.js";
import type * as modules_user_helpers from "../modules/user/helpers.js";
import type * as modules_user_http from "../modules/user/http.js";
import type * as modules_user_mutations from "../modules/user/mutations.js";
import type * as modules_user_queries from "../modules/user/queries.js";
import type * as modules_user_utils from "../modules/user/utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  http: typeof http;
  "modules/user/helpers": typeof modules_user_helpers;
  "modules/user/http": typeof modules_user_http;
  "modules/user/mutations": typeof modules_user_mutations;
  "modules/user/queries": typeof modules_user_queries;
  "modules/user/utils": typeof modules_user_utils;
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
