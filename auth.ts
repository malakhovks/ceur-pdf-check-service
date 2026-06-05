import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const TEST_PROVIDER_ID = "test-login";

function testAuthEnabled() {
  return process.env.AUTH_TEST_MODE === "true";
}

const providers: NextAuthConfig["providers"] = [Google];

if (testAuthEnabled()) {
  providers.push(
    Credentials({
      id: TEST_PROVIDER_ID,
      name: "Test Login",
      credentials: {
        token: { label: "Token", type: "password" },
      },
      authorize(credentials) {
        const expectedToken = process.env.AUTH_TEST_LOGIN_TOKEN;
        const providedToken = credentials.token;

        if (!expectedToken || typeof providedToken !== "string" || providedToken !== expectedToken) {
          return null;
        }

        return {
          id: "test-user",
          name: "Test User",
          email: "test.user@example.com",
        };
      },
    }),
  );
}

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth({
  providers,
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider === "google") {
        const googleProfile = profile as { email?: unknown; email_verified?: unknown } | undefined;
        return typeof googleProfile?.email === "string"
          && (googleProfile.email_verified === true || googleProfile.email_verified === "true");
      }

      if (account?.provider === TEST_PROVIDER_ID) {
        return testAuthEnabled();
      }

      return false;
    },
  },
});
