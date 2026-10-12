import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const client = uri ? new MongoClient(uri) : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: client ? MongoDBAdapter(client) : undefined,
  providers: [GitHub],
  trustHost: true,
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
