import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";

export const sha256 = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

/** Receipts are append-only. A second run needs a new directory. */
export async function writeReceipt(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
}
