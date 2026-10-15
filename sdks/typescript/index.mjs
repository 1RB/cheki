/**
 * cheki - ESM wrapper that re-exports the CommonJS build.
 *
 * This file enables `import { Cheki } from "cheki-verify"` in ES module
 * environments (Node.js ESM, bundlers with ESM output) while the
 * primary compiled build remains CommonJS (`index.js`).
 */

import cjs from "./index.js";

export const Cheki = cjs.Cheki;
export const ChekiError = cjs.ChekiError;
export const ChekiAPIError = cjs.ChekiAPIError;
export const ChekiRateLimitError = cjs.ChekiRateLimitError;
export const ChekiPayloadTooLargeError = cjs.ChekiPayloadTooLargeError;
export const ChekiValidationError = cjs.ChekiValidationError;
export const ChekiNetworkError = cjs.ChekiNetworkError;
export const ChekiTimeoutError = cjs.ChekiTimeoutError;
export const isVerified = cjs.isVerified;
export const parseRetryAfter = cjs.parseRetryAfter;
export const DEFAULT_TIMEOUT_MS = cjs.DEFAULT_TIMEOUT_MS;
export const MAX_RETRIES = cjs.MAX_RETRIES;
export const MAX_BATCH_SIZE = cjs.MAX_BATCH_SIZE;
export const RECOMMENDED_BATCH_CHUNK = cjs.RECOMMENDED_BATCH_CHUNK;
export const RECEIPT_DOWNLOAD_BANKS = cjs.RECEIPT_DOWNLOAD_BANKS;

export default cjs.default;
