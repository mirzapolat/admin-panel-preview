import PocketBase from "pocketbase";

// Use environment variable or default to localhost
const PB_URL =
  process.env.NEXT_PUBLIC_POCKETBASE_URL || "https://pb1.mirzapolat.com/";

export const pb = new PocketBase(PB_URL);

// Optional: Disable auto-cancellation if needed
pb.autoCancellation(false);
