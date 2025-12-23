"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { ArrowLeft, FileText, Settings, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const result = await apiClient.get(`/api/projects/${projectId}`, token);
      
      const projectData = (result?.data as any)?.data;
      if (projectData) {
        setProject(projectData);
      } else {
        toast.error("Project not found");
        router.push('/projects');
      }
    } catch (err) {
      console.error("Error loading project:", err);
      toast.error("Failed to load project");
      router.push('/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/projects');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Projects
        </button>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
              {project.description && (
                <p className="text-gray-400 text-lg">{project.description}</p>
              )}
              <p className="text-gray-500 text-sm mt-4">
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>
            </div>
            
            <button
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              onClick={() => toast.error("Delete functionality coming soon")}
            >
              <Trash2 size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Project Content Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Documents Section */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="text-blue-500" size={24} />
              <h2 className="text-xl font-semibold">Documents</h2>
            </div>
            <p className="text-gray-400">No documents yet. Upload documents to get started.</p>
          </div>

          {/* Settings Section */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="text-purple-500" size={24} />
              <h2 className="text-xl font-semibold">Project Settings</h2>
            </div>
            <p className="text-gray-400">Configure RAG settings and preferences.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
