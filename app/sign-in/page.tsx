import { redirect } from "next/navigation";
import { LogIn, ShieldCheck } from "lucide-react";
import { auth, signIn } from "../../auth";

async function signInWithGoogle() {
  "use server";

  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    throw new Error("Google OAuth is not configured.");
  }

  await signIn("google", { redirectTo: "/" });
}

async function signInWithTestUser() {
  "use server";

  if (process.env.AUTH_TEST_MODE !== "true") {
    throw new Error("Test authentication is disabled.");
  }

  await signIn("test-login", {
    token: process.env.AUTH_TEST_LOGIN_TOKEN,
    redirectTo: "/",
  });
}

export default async function SignInPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const testMode = process.env.AUTH_TEST_MODE === "true";

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(184,227,214,0.65),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(255,224,204,0.4),_transparent_24%),linear-gradient(180deg,_#eef4ee_0%,_#e7efe7_52%,_#dde7df_100%)] px-4 py-8 text-slate-900">
      <section className="surface w-full max-w-md rounded-[30px] px-5 py-6 sm:px-7 sm:py-7" data-testid="sign-in-panel">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-emerald-50 text-emerald-800">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight text-slate-950">CEUR PDF Check</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Sign in with Google to upload manuscripts and run CEUR validation reports.</p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <form action={signInWithGoogle}>
            <button
              type="submit"
              disabled={!googleConfigured}
              className={googleConfigured
                ? "reference-dark inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                : "reference-disabled inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold"}
            >
              <LogIn className="h-4 w-4" />
              Sign in with Google
            </button>
          </form>

          {!googleConfigured ? (
            <p className="rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Google OAuth is not configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET before deployment.
            </p>
          ) : null}

          {testMode ? (
            <form action={signInWithTestUser}>
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-full border border-white/70 bg-white/78 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              >
                Use test account
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </main>
  );
}
