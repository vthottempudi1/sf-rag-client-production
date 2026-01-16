"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
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
  created_at: string;
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
      const result = await apiClient.get("/api/projects/", token);
      const { data } = result || {};
      setProjects(data);
    } catch (err) {
      setError(err);
      toast.error("Failed to load projects");
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
      const savedProject = result?.data || {};
      setProjects((prev) => [savedProject, ...prev]);
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

  useEffect(() => {
    if (userId) {
      loadProjects();
    }
  }, [userId]);

  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner message="Loading projects..." />;
  }

  return (
    <div>
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
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        onCreateProject={handleCreateProject}
        isLoading={isCreating}
      />
    </div>
  );
}

export default ProjectsPage;
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
