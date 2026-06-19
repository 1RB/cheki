/**
 * cheki — ESM wrapper that re-exports the CommonJS build.
 *
 * This file enables `import { Cheki } from "cheki"` in ES module
 * environments (Node.js ESM, bundlers with ESM output) while the
 * primary compiled build remains CommonJS (`index.js`).
 */

import cjs from "./index.js";

export const Cheki = cjs.Cheki;
export const ChekiError = cjs.ChekiError;
export const ChekiAPIError = cjs.ChekiAPIError;
export const ChekiNetworkError = cjs.ChekiNetworkError;
export const ChekiTimeoutError = cjs.ChekiTimeoutError;

export default cjs.default;
