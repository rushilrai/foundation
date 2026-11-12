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
import type * as lib_metadata_read from "../lib/metadata/read.js";
import type * as lib_metadata_sites_googleMaps from "../lib/metadata/sites/googleMaps.js";
import type * as lib_metadata_sites_googleShare from "../lib/metadata/sites/googleShare.js";
import type * as lib_metadata_sites_hackerNews from "../lib/metadata/sites/hackerNews.js";
import type * as lib_metadata_sites_index from "../lib/metadata/sites/index.js";
import type * as lib_metadata_sites_instagram from "../lib/metadata/sites/instagram.js";
import type * as lib_metadata_sites_npm from "../lib/metadata/sites/npm.js";
import type * as lib_metadata_sites_pinterest from "../lib/metadata/sites/pinterest.js";
import type * as lib_metadata_sites_reddit from "../lib/metadata/sites/reddit.js";
import type * as lib_metadata_sites_stackExchange from "../lib/metadata/sites/stackExchange.js";
import type * as lib_metadata_sites_types from "../lib/metadata/sites/types.js";
import type * as lib_metadata_sites_x from "../lib/metadata/sites/x.js";
import type * as lib_metadata_sites_youtube from "../lib/metadata/sites/youtube.js";
import type * as lib_metadata_url from "../lib/metadata/url.js";
import type * as lib_text from "../lib/text.js";
import type * as modules_auth_helpers from "../modules/auth/helpers.js";
import type * as modules_auth_queries from "../modules/auth/queries.js";
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
  "lib/metadata/read": typeof lib_metadata_read;
  "lib/metadata/sites/googleMaps": typeof lib_metadata_sites_googleMaps;
  "lib/metadata/sites/googleShare": typeof lib_metadata_sites_googleShare;
  "lib/metadata/sites/hackerNews": typeof lib_metadata_sites_hackerNews;
  "lib/metadata/sites/index": typeof lib_metadata_sites_index;
  "lib/metadata/sites/instagram": typeof lib_metadata_sites_instagram;
  "lib/metadata/sites/npm": typeof lib_metadata_sites_npm;
  "lib/metadata/sites/pinterest": typeof lib_metadata_sites_pinterest;
  "lib/metadata/sites/reddit": typeof lib_metadata_sites_reddit;
  "lib/metadata/sites/stackExchange": typeof lib_metadata_sites_stackExchange;
  "lib/metadata/sites/types": typeof lib_metadata_sites_types;
  "lib/metadata/sites/x": typeof lib_metadata_sites_x;
  "lib/metadata/sites/youtube": typeof lib_metadata_sites_youtube;
  "lib/metadata/url": typeof lib_metadata_url;
  "lib/text": typeof lib_text;
  "modules/auth/helpers": typeof modules_auth_helpers;
  "modules/auth/queries": typeof modules_auth_queries;
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
