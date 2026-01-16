import PocketBase from "pocketbase";

// Use environment variable or default to the Next.js proxy.
const PB_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || "/api/pb";

export const pb = new PocketBase(PB_URL);

// Optional: Disable auto-cancellation if needed
pb.autoCancellation(false);
