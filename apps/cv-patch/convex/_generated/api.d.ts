/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assets_coverLetterTemplateData from "../assets/coverLetterTemplateData.js";
import type * as assets_resumeTemplateData from "../assets/resumeTemplateData.js";
import type * as configs_ai from "../configs/ai.js";
import type * as configs_rateLimiter from "../configs/rateLimiter.js";
import type * as http from "../http.js";
import type * as modules_common_cloudconvert from "../modules/common/cloudconvert.js";
import type * as modules_common_profileData from "../modules/common/profileData.js";
import type * as modules_common_rating from "../modules/common/rating.js";
import type * as modules_common_resumeData from "../modules/common/resumeData.js";
import type * as modules_common_textExtraction from "../modules/common/textExtraction.js";
import type * as modules_patch_actions from "../modules/patch/actions.js";
import type * as modules_patch_agent from "../modules/patch/agent.js";
import type * as modules_patch_docxTemplate from "../modules/patch/docxTemplate.js";
import type * as modules_patch_helpers from "../modules/patch/helpers.js";
import type * as modules_patch_mutations from "../modules/patch/mutations.js";
import type * as modules_patch_nodeActions from "../modules/patch/nodeActions.js";
import type * as modules_patch_queries from "../modules/patch/queries.js";
import type * as modules_patch_validation from "../modules/patch/validation.js";
import type * as modules_patch_voice from "../modules/patch/voice.js";
import type * as modules_profile_actions from "../modules/profile/actions.js";
import type * as modules_profile_agent from "../modules/profile/agent.js";
import type * as modules_profile_helpers from "../modules/profile/helpers.js";
import type * as modules_profile_mutations from "../modules/profile/mutations.js";
import type * as modules_profile_nodeActions from "../modules/profile/nodeActions.js";
import type * as modules_profile_queries from "../modules/profile/queries.js";
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
  "assets/coverLetterTemplateData": typeof assets_coverLetterTemplateData;
  "assets/resumeTemplateData": typeof assets_resumeTemplateData;
  "configs/ai": typeof configs_ai;
  "configs/rateLimiter": typeof configs_rateLimiter;
  http: typeof http;
  "modules/common/cloudconvert": typeof modules_common_cloudconvert;
  "modules/common/profileData": typeof modules_common_profileData;
  "modules/common/rating": typeof modules_common_rating;
  "modules/common/resumeData": typeof modules_common_resumeData;
  "modules/common/textExtraction": typeof modules_common_textExtraction;
  "modules/patch/actions": typeof modules_patch_actions;
  "modules/patch/agent": typeof modules_patch_agent;
  "modules/patch/docxTemplate": typeof modules_patch_docxTemplate;
  "modules/patch/helpers": typeof modules_patch_helpers;
  "modules/patch/mutations": typeof modules_patch_mutations;
  "modules/patch/nodeActions": typeof modules_patch_nodeActions;
  "modules/patch/queries": typeof modules_patch_queries;
  "modules/patch/validation": typeof modules_patch_validation;
  "modules/patch/voice": typeof modules_patch_voice;
  "modules/profile/actions": typeof modules_profile_actions;
  "modules/profile/agent": typeof modules_profile_agent;
  "modules/profile/helpers": typeof modules_profile_helpers;
  "modules/profile/mutations": typeof modules_profile_mutations;
  "modules/profile/nodeActions": typeof modules_profile_nodeActions;
  "modules/profile/queries": typeof modules_profile_queries;
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

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
