import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Fraunces } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default async function HomePage() {
  const { userId } = await auth();

  // If user is signed in, redirect to projects page
  if (userId) {
    redirect("/projects");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_circle_at_15%_10%,rgba(56,189,248,0.18),transparent_45%),radial-gradient(900px_circle_at_85%_5%,rgba(34,197,94,0.18),transparent_40%),radial-gradient(700px_circle_at_70%_75%,rgba(251,191,36,0.14),transparent_42%),linear-gradient(135deg,#0b0b0f_0%,#0f172a_35%,#0b0b0f_100%)] text-white">
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16 sm:px-10">
        <div className="grid w-full gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70">
              NextGenSoft
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
              Secure AI Workspace
            </div>
            <div className="space-y-5">
              <h1 className={`${fraunces.className} text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl`}>
                Welcome to the NextGenSoft RAG workspace
              </h1>
              <p className="max-w-xl text-base text-white/70 sm:text-lg">
                A focused environment for organizing documents, managing shared projects, and chatting
                with private context. Sign in to continue.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/sign-in"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-white/20 transition hover:-translate-y-0.5 hover:shadow-white/30"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
              >
                Create account
              </Link>
            </div>
            <div className="grid gap-4 text-sm text-white/60 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Role-based access
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Member-only chats
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                Secure uploads
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -left-8 top-10 h-24 w-24 rounded-3xl bg-emerald-400/20 blur-2xl" />
            <div className="absolute right-8 top-0 h-28 w-28 rounded-full bg-sky-400/20 blur-2xl" />
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Workspace status</p>
                  <h2 className={`${fraunces.className} text-2xl font-semibold`}>Ready for secure sharing</h2>
                  <p className="text-sm text-white/60">
                    Invite members, keep chats private per user, and centralize project documents.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
                    <span className="text-white/70">Projects</span>
                    <span className="font-semibold text-white">Live</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
                    <span className="text-white/70">Member access</span>
                    <span className="font-semibold text-white">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
                    <span className="text-white/70">Chat privacy</span>
                    <span className="font-semibold text-white">Isolated</span>
                  </div>
                </div>
                <Link
                  href="/sign-in"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-300/90 px-6 py-3 text-sm font-semibold text-black transition hover:bg-emerald-200"
                >
                  Continue to workspace
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
