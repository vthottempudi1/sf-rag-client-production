export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1b1f,_#0b0b0c_55%)] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-white/10 bg-gradient-to-b from-[#14161a] via-[#101216] to-[#0b0b0c] md:flex">
          <div className="px-6 pb-6 pt-8 text-lg font-semibold tracking-wide">
            OpenSlate
          </div>
          <nav className="flex flex-1 flex-col gap-2 px-4">
            <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm text-white/90 shadow-sm transition hover:bg-white/10">
              New project
            </button>
            <button className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-left text-sm font-medium text-white">
              Projects
            </button>
          </nav>
          <div className="px-4 pb-8 pt-6 text-xs text-white/40">
            Workspace settings
          </div>
        </aside>

        <main className="flex flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-6 md:px-10">
            <div>
              <h1 className="text-2xl font-semibold">Projects</h1>
              <p className="text-sm text-white/60">0 projects</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-white/20">
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold text-black">
                  +
                </span>
                Create new
              </button>
              <button className="rounded-full border border-white/15 bg-white/5 p-2 text-white/70 transition hover:bg-white/10">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect x="4" y="4" width="7" height="7" rx="1.5" />
                  <rect x="13" y="4" width="7" height="7" rx="1.5" />
                  <rect x="4" y="13" width="7" height="7" rx="1.5" />
                  <rect x="13" y="13" width="7" height="7" rx="1.5" />
                </svg>
              </button>
              <button className="rounded-full border border-white/15 bg-white/5 p-2 text-white/70 transition hover:bg-white/10">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M5 7h14" />
                  <path d="M5 12h14" />
                  <path d="M5 17h14" />
                </svg>
              </button>
            </div>
          </header>

          <section className="flex flex-1 flex-col gap-8 px-6 py-8 md:px-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <input
                  className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-white/30 focus:bg-white/10"
                  placeholder="Search projects..."
                />
                <svg
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </div>
              <div className="text-sm text-white/50">Sort: Newest</div>
            </div>

            <div className="flex flex-1 items-center justify-center">
              <div className="flex max-w-md flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl text-white shadow-lg shadow-black/40">
                  +
                </div>
                <h2 className="text-xl font-semibold">Create your first project</h2>
                <p className="text-sm text-white/60">
                  Projects help you organize your documents and conversations.
                  Start by creating your first project.
                </p>
                <button className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black shadow-lg shadow-white/20 transition hover:-translate-y-0.5">
                  Create your first project
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
