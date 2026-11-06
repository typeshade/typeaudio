import { SCALAR_FUNCTIONS } from "../scalarFunctions.ts";
export const FUNCTIONS = new Set(SCALAR_FUNCTIONS);
// TypeShade lowers the author-facing ** operator to an internal pow helper.
export const HELPERS = new Set([...SCALAR_FUNCTIONS, "pow"]);
