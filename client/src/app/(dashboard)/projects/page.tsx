"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation'; // Import

import { ProjectsGrid } from '@/components/projects/ProjectsGrid';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

import toast from "react-hot-toast";
import { apiClient } from '@/lib/api';


interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  clerk_id: string;
}

function ProjectsPage () {
  // JWT token
  const { getToken, userId } = useAuth();

  // Debug: Log Clerk JWT token to console
  useEffect(() => {
    async function fetchToken() {
      const token = await getToken();
      console.log("JWT token:", token); // This is the JWT you need!
    }
    fetchToken();
  }, [getToken]);
  //Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  //UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const router = useRouter();

  // Business logic functions

  const loadProjects = async () => {
    try {
      setLoading(true);

      const token = await getToken();
      const result = await apiClient.get("/api/projects", token ?? undefined)
      
      // Handle multiple possible response shapes
      // - { data: [...] }
      // - { message: "...", data: [...] }
      // - direct array
      const rawData = (result as any)?.data;
      const projectsData = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.data)
          ? rawData.data
          : Array.isArray((result as any))
            ? (result as any)
            : [];
      
      // Filter out invalid projects without IDs
      const validProjects = Array.isArray(projectsData) 
        ? projectsData.filter((p: any) => p && p.id)
        : [];
      
      setProjects(validProjects);

    } catch (err) {
      console.error("Error loading projects:", err);
      toast.error("Failed to load projects.");
      setProjects([]);
    } finally {
      setLoading(false);
    }

  };


  useEffect(() => {
    if (userId) {
      loadProjects();
    }
  }, [userId]);

  const handleCreateProject = async (name: string, description: string) => {
    setError(null);
    setIsCreating(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Authentication failed. Please sign in again.");
        setIsCreating(false);
        return;
      }
      const result = await apiClient.post(
        "/api/projects",
        { name, description },
        token
      );
      console.log("Full backend response:", result);

      // Try to extract the project from multiple possible response shapes
      let savedProject = undefined;
      const rawCreate = (result as any)?.data ?? result;
      if (rawCreate?.project && typeof rawCreate.project === 'object') {
        savedProject = rawCreate.project;
      } else if (rawCreate?.data && typeof rawCreate.data === 'object') {
        savedProject = rawCreate.data;
      } else if (rawCreate && typeof rawCreate === 'object') {
        savedProject = rawCreate;
      }

      if (savedProject && typeof savedProject === 'object' && savedProject.id) {
        setProjects((prev) => [savedProject, ...prev]);
        setShowCreateModal(false);
        toast.success("Project created successfully!");
      } else {
        // Provide more detailed error logging for debugging
        console.error("Project creation response missing ID.", {
          savedProject,
          result,
          idType: typeof savedProject?.id,
          keys: savedProject ? Object.keys(savedProject) : null
        });
        toast.error("Project created but missing ID. Please refresh or contact support.");
      }
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        toast.error(`Failed to create project: ${err.response.data.detail}`);
      } else {
        toast.error("Failed to create project. Please try again later.");
      }
      console.error("Error creating project:", err);
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleDeleteProject = async (projectId: string) => {
    try {
      setError(null)
      const token = await getToken();

      const result = await apiClient.delete(`/api/projects/${projectId}`, token ?? undefined);

      setProjects((prev) => prev.filter((project) => project.id !== projectId));

      toast.success("Project deleted successfully!");

    } catch (err) {
      toast.error("Failed to delete project.");
      console.error("Error deleting project:", err);
    }

  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  }

  const handleOpenModal = () => {
    setShowCreateModal(true);
  }
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
      project.description.toLowerCase().includes(searchQuery.toLowerCase()));


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
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
        onDeleteProject={handleDeleteProject}
        onCreateProject={handleOpenModal}
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
