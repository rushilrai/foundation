/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as configs_ai from "../configs/ai.js";
import type * as configs_rateLimiter from "../configs/rateLimiter.js";
import type * as http from "../http.js";
import type * as lib_metadata_fetch from "../lib/metadata/fetch.js";
import type * as lib_metadata_parse from "../lib/metadata/parse.js";
import type * as lib_metadata_url from "../lib/metadata/url.js";
import type * as modules_auth_helpers from "../modules/auth/helpers.js";
import type * as modules_auth_queries from "../modules/auth/queries.js";
import type * as modules_link_actions from "../modules/link/actions.js";
import type * as modules_link_ai from "../modules/link/ai.js";
import type * as modules_link_helpers from "../modules/link/helpers.js";
import type * as modules_link_mutations from "../modules/link/mutations.js";
import type * as modules_link_nodeActions from "../modules/link/nodeActions.js";
import type * as modules_link_queries from "../modules/link/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "configs/ai": typeof configs_ai;
  "configs/rateLimiter": typeof configs_rateLimiter;
  http: typeof http;
  "lib/metadata/fetch": typeof lib_metadata_fetch;
  "lib/metadata/parse": typeof lib_metadata_parse;
  "lib/metadata/url": typeof lib_metadata_url;
  "modules/auth/helpers": typeof modules_auth_helpers;
  "modules/auth/queries": typeof modules_auth_queries;
  "modules/link/actions": typeof modules_link_actions;
  "modules/link/ai": typeof modules_link_ai;
  "modules/link/helpers": typeof modules_link_helpers;
  "modules/link/mutations": typeof modules_link_mutations;
  "modules/link/nodeActions": typeof modules_link_nodeActions;
  "modules/link/queries": typeof modules_link_queries;
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
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
