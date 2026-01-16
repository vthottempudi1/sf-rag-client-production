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

  const filteredProjects = (projects || []).filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="px-4 pb-8 pt-6 text-xs text-white/40">
            Workspace settings
          </div>
        </aside>
        <main className="flex flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-6 md:px-10">
            <div>
              <h1 className="text-2xl font-semibold">Projects</h1>
              <p className="text-sm text-white/60">{filteredProjects.length} projects</p>
            </div>
            <div className="flex items-center gap-3">
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
    </div>
  );
}

export default ProjectsPage;
