import { z } from "zod";

const verifiedProfile = z.object({ email: z.email(), email_verified: z.literal(true) });
type EmailAccount = { id: string; role?: string; status?: string };

export async function allowGoogleSignIn(profile: unknown, lookup: {
  isLinked: () => Promise<boolean>;
  findByEmail: (email: string) => Promise<EmailAccount | null>;
  currentUserId: () => Promise<string | null>;
}) {
  const parsed = verifiedProfile.safeParse(profile);
  if (!parsed.success) return false;
  if (await lookup.isLinked()) return true;
  const existing = await lookup.findByEmail(parsed.data.email.trim().toLowerCase());
  if (existing && ["super_admin", "admin"].includes(existing.role ?? "")) {
    // Matching an OAuth email never adds an authentication method to a
    // privileged account without an already authenticated original identity.
    return existing.status === "active" && await lookup.currentUserId() === existing.id;
  }
  return true;
}
