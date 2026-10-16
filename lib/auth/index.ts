import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { MongoClient, ObjectId } from "mongodb";
import { approvalAdapter } from "./adapter";
import { allowGoogleSignIn } from "./google-linking";

const uri = process.env.MONGODB_URI;
const client = uri ? new MongoClient(uri) : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: client ? approvalAdapter(MongoDBAdapter(client)) : undefined,
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    GitHub,
  ],
  trustHost: true,
  events: {
    async signIn({ user, account }) {
      if (client && user.id && ObjectId.isValid(user.id)) {
        await client.db().collection("users").updateOne(
          { _id: new ObjectId(user.id) },
          { $set: { lastLoginAt: new Date(), updatedAt: new Date() } },
        );
        await client.db().collection("auditlogs").insertOne({
          actorId: new ObjectId(user.id), action: "users.signin", targetType: "user", targetId: new ObjectId(user.id),
          metadata: { provider: account?.provider === "google" ? "google" : "github" }, createdAt: new Date(),
        });
      }
    },
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        return allowGoogleSignIn(profile, {
          isLinked: async () => Boolean(client && await client.db().collection("accounts").findOne({ provider: "google", providerAccountId: account.providerAccountId }, { projection: { _id: 1 } })),
          findByEmail: async (email) => {
            const existing = client ? await client.db().collection("users").findOne({ email }, { projection: { _id: 1, role: 1, status: 1 } }) : null;
            return existing ? { id: existing._id.toString(), role: existing.role, status: existing.status } : null;
          },
          currentUserId: async () => (await auth())?.user?.id ?? null,
        });
      }
      return true;
    },
    session({ session, user }) {
      if (session.user && user) session.user.id = user.id;
      return session;
    },
  },
});
