"use client";

import { useEffect, useState } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ProjectsGrid } from "@/components/projects/ProjectsGrid";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  description: string;
  created_at?: string;
  clerk_id: string;
}

function ProjectsPage() {
  // * Data States - What data we're tracking
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // * UI States - How the interface looks and behaves
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteProjectId, setInviteProjectId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<{ type: "idle" | "error" | "success"; message?: string }>({
    type: "idle",
  });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  // Clerk : https://clerk.com/docs/nextjs/reference/hooks/use-auth
  const { getToken, userId } = useAuth();
  const router = useRouter();

  /*
  ! Business Logic Functions - Core operations for this page:
  * - loadProjects: Get all projects from the server
  * - handleCreateProject: Make a new project with name and description
  * - handleDeleteProject: Delete a project by its ID
  */

  const loadProjects = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        setProjects([]);
        return;
      }
      const result = await apiClient.get("/api/projects/", token);
      const rawData = (result as any)?.data;
      const projectsData = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.data)
          ? rawData.data
          : [];
      setProjects(projectsData);
    } catch (err) {
      setError(err);
      toast.error("Failed to load projects");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (name: string, description: string) => {
    try {
      setError(null);
      setIsCreating(true);
      const token = await getToken();
      const result = await apiClient.post(
        "/api/projects/",
        { name, description },
        token
      );
      const rawProject = (result as any)?.data;
      const savedProject = (rawProject as any)?.data ?? rawProject ?? {};
      const normalizedProject = {
        ...savedProject,
        name: savedProject?.name || name,
        description: savedProject?.description || description,
        created_at: savedProject?.created_at || new Date().toISOString(),
      };
      setProjects((prev) => [normalizedProject, ...prev]);
      setShowCreateModal(false);
      toast.success("Project created successfully!");
    } catch (err) {
      toast.error("Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      setError(null);
      const token = await getToken();
      await apiClient.delete(`/api/projects/${projectId}`, token);
      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      toast.success("Project deleted successfully!");
    } catch (err) {
      toast.error("Failed to delete project");
    }
  };

  /*
  ! User Interaction Functions:
  * - handleProjectClick: Go to a specific project page when clicked
  * - handleOpenModal/handleCloseModal: Show/hide the new project form
  */

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const handleOpenModal = () => {
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
  };

  const submitInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteProjectId || !inviteEmail) {
      setInviteStatus({ type: "error", message: "Project ID and email are required." });
      return;
    }
    setInviteSubmitting(true);
    setInviteStatus({ type: "idle" });

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("You must be signed in to invite members.");
      }
      await apiClient.post(
        `/api/projects/${inviteProjectId}/members`,
        { email: inviteEmail, role: "viewer" },
        token
      );
      setInviteStatus({ type: "success", message: "Invite sent. Member now has viewer access." });
      setInviteEmail("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to invite member.";
      setInviteStatus({ type: "error", message });
    } finally {
      setInviteSubmitting(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadProjects();
    }
  }, [userId]);

  const filteredProjects = (projects || []).filter((project) => {
    const name = (project?.name ?? "").toLowerCase();
    const description = (project?.description ?? "").toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || description.includes(query);
  });

  if (loading) {
    return <LoadingSpinner message="Loading projects..." />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1b1f,_#0b0b0c_55%)] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-white/10 bg-gradient-to-b from-[#14161a] via-[#101216] to-[#0b0b0c] md:flex">
          <div className="px-6 pb-6 pt-8 text-lg font-semibold tracking-wide">
            NextgenSoft
          </div>
          <nav className="flex flex-1 flex-col gap-2 px-4">
            <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-sm text-white/90 shadow-sm transition hover:bg-white/10" onClick={handleOpenModal}>
              New project
            </button>
            <button className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-left text-sm font-medium text-white">
              Projects
            </button>
          </nav>
          <div className="mt-auto px-4 pb-6 pt-6 text-xs text-white/40">
            Workspace settings
          </div>
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-4">
            <SignedIn>
              <div className="flex items-center gap-3">
                <UserButton afterSignOutUrl="/sign-in" />
                <span className="text-xs text-white/70">Signed in</span>
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:bg-white/10">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </aside>
        <main className="flex flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-6 md:px-10">
            <div>
              <h1 className="text-2xl font-semibold">Projects</h1>
              <p className="text-sm text-white/60">{filteredProjects.length} projects</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                onClick={() => {
                  setInviteStatus({ type: "idle" });
                  setInviteOpen(true);
                }}
              >
                Invite member
              </button>
              <button className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-white/20" onClick={handleOpenModal}>
                <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold text-black">
                  +
                </span>
                Create new
              </button>
            </div>
          </header>
          <section className="flex-1">
            <ProjectsGrid
              projects={filteredProjects}
              loading={loading}
              error={error}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onProjectClick={handleProjectClick}
              onCreateProject={handleOpenModal}
              onDeleteProject={handleDeleteProject}
            />
          </section>
        </main>
        <CreateProjectModal
          isOpen={showCreateModal}
          onClose={handleCloseModal}
          onCreateProject={handleCreateProject}
          isLoading={isCreating}
        />
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-8">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0f1115] p-6 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Invite member</h2>
                <p className="mt-1 text-sm text-white/60">
                  Members get viewer access and can chat on this project.
                </p>
              </div>
              <button
                onClick={() => setInviteOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <form onSubmit={submitInvite} className="mt-6 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-white/40">Project ID</label>
                <input
                  value={inviteProjectId}
                  onChange={(event) => setInviteProjectId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/10"
                  placeholder="Paste project UUID"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-white/40">Member email</label>
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/10"
                  placeholder="name@company.com"
                  type="email"
                />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                <span>Role</span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  Viewer
                </span>
              </div>

              {inviteStatus.type !== "idle" && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    inviteStatus.type === "success"
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                      : "border-rose-400/30 bg-rose-400/10 text-rose-200"
                  }`}
                >
                  {inviteStatus.message}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black shadow-lg shadow-white/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {inviteSubmitting ? "Sending..." : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsPage;
