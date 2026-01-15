import PocketBase from "pocketbase";

// Use environment variable or default to localhost
const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8090";

export const pb = new PocketBase(PB_URL);

// Optional: Disable auto-cancellation if needed
pb.autoCancellation(false);
