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

  // JWT token
  const { getToken, userId } = useAuth();
  const router = useRouter();

  // Business logic functions

  const loadProjects = async () => {
    try {
      setLoading(true);

      const token = await getToken();
      const result = await apiClient.get("/api/projects", token)
      
      // apiClient wraps response in {data: ...}
      // backend returns {message: "...", data: [...]}
      // so we need result.data.data
      const projectsData = (result?.data as any)?.data || [];
      
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
    try {
      setError(null)
      setIsCreating(true);
      const token = await getToken();
      const result = await apiClient.post(
        "/api/projects",
        { name,
          description
        },
        token
      );

      // apiClient wraps response in {data: ...}
      // backend returns {message: "...", data: project}
      // so we need result.data.data
      const savedProject = (result?.data as any)?.data || {}
      
      // Only add project if it has an ID
      if (savedProject && savedProject.id) {
        setProjects((prev) => [savedProject, ...prev]);
        setShowCreateModal(false);
        toast.success("Project created successfully!");
      } else {
        console.error("Created project missing ID:", savedProject);
        toast.error("Project created but missing ID. Please refresh.");
      }

    } catch (err) {

      toast.error("Failed to create project.");
      console.error("Error creating project:", err);
    } finally {
      setIsCreating(false);
      
    }



  };
  
  const handleDeleteProject = async (projectId: string) => {
    try {
      setError(null)
      const token = await getToken();

      const result = await apiClient.delete(`/api/projects/${projectId}`, token);

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