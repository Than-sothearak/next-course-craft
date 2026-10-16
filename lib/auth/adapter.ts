import type { Adapter, AdapterUser } from "next-auth/adapters";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/models/User";

const providerProfileSchema = z.object({
  name: z.string().trim().max(160).nullable().optional(),
  email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
  emailVerified: z.date().nullable().optional(),
  image: z.url().max(2048).refine((value) => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS image URL.").nullable().optional(),
});

// Auth.js uses the native MongoDB driver, so Mongoose defaults do not run here.
export function approvalAdapter(adapter: Adapter): Adapter {
  return {
    ...adapter,
    async createUser(user) {
      await connectToDatabase();
      await User.init();
      const now = new Date();
      const profile = providerProfileSchema.parse(user);
      const record = {
        ...profile,
        id: new ObjectId().toHexString(),
        emailVerified: profile.emailVerified ?? null,
        role: "viewer",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      return adapter.createUser!(record);
    },
    async updateUser(user) {
      // Only provider profile fields can be updated during OAuth. Authorization
      // state is exclusively changed through administration or maintenance.
      const update: Partial<AdapterUser> & Pick<AdapterUser, "id"> = { id: user.id, ...providerProfileSchema.partial().parse(user) };
      return adapter.updateUser!(update);
    },
    getUserByEmail(email) {
      return adapter.getUserByEmail!(email.trim().toLowerCase());
    },
  };
}
