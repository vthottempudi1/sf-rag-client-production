"use client";

import React, { use, useState, useEffect } from "react";
import { ConversationsList } from "@/components/projects/ConversationsList";
import { KnowledgeBaseSidebar } from "@/components/projects/KnowledgeBaseSidebar";
import { FileDetailsModal } from "@/components/projects/FileDetailsModal";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { NotFound } from "@/components/ui/NotFound";
import toast from "react-hot-toast";
import { Project, Chat, ProjectDocument, ProjectSettings } from "@/lib/types";
import { useRouter } from "next/navigation";




interface ProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface ProjectData {
  project: Project | null;
  chats: Chat[];
  documents: ProjectDocument[];
  settings: ProjectSettings |null;
}

function ProjectPage({ params }: ProjectPageProps) {
  const { id: projectId } = use(params);
  const { getToken, userId } = useAuth();
  const router = useRouter();

  //Data state
  const [data, setData] = useState<ProjectData>({
    project: null,
    chats: [],
    documents: [],
    settings: null,
  })

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreatingChat, setIsCreatingChat] = useState(false);



  // UI states
  const [activeTab, setActiveTab] = useState<"documents" | "settings">(
    "documents"
  );

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );

  //load all data


  useEffect(() => {
    const loadAllData = async () => {
      if (!userId) return;

      try {
        setLoading(true);
        setError(null);

        const token = await getToken();

        const [projectRes, chatsRes, documentsRes, settingsRes] = await Promise.all([
          apiClient.get(`/api/projects/${projectId}`, token),
          apiClient.get(`/api/projects/${projectId}/chats`, token),
          apiClient.get(`/api/projects/${projectId}/documents`, token),
          apiClient.get(`/api/projects/${projectId}/settings`, token),
        ]);

        // Log the documents API response to verify structure
        console.log("Documents API response:", documentsRes.data);

        // Extract documents array - handle both wrapped and unwrapped responses
        const documentsData = documentsRes.data?.data || documentsRes.data || [];
        
        // Filter out invalid documents without IDs and log any issues
        const validDocuments = Array.isArray(documentsData)
          ? documentsData.filter((doc: any) => {
              if (!doc || !doc.id) {
                console.warn("Invalid document found (missing id):", doc);
                return false;
              }
              return true;
            })
          : [];

        console.log("Valid documents with IDs:", validDocuments);

        // Check for duplicate IDs
        const ids = validDocuments.map((doc: any) => doc.id);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
          console.error("WARNING: Duplicate document IDs detected!", validDocuments);
        }

        const projectData = (projectRes as any)?.data?.data ?? (projectRes as any)?.data ?? null;
        const chatsData = (chatsRes as any)?.data?.data ?? (chatsRes as any)?.data ?? [];
        const settingsData = (settingsRes as any)?.data?.data ?? (settingsRes as any)?.data ?? null;

        setData({
          project: projectData,
          chats: Array.isArray(chatsData) ? chatsData : [],
          documents: validDocuments,
          settings: settingsData,
        });
      } catch (err) {
        console.error("Error loading project data:", err);
        setError(err instanceof Error ? err.message : "Failed to load project data");
        toast.error("Failed to load project data.");
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, [userId, projectId]);

  useEffect(() => {
    const hasProcessingDocuments = data.documents.some(
      (doc) =>
        doc.processing_status &&
        ! ["completed", "failed"].includes(doc.processing_status)
    );

    if (!hasProcessingDocuments) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const token = await getToken();
        const documentsRes = await apiClient.get(
          `/api/projects/${projectId}/files`,
          token
        );
        const rawDocs = (documentsRes as any)?.data;
        const docs = Array.isArray(rawDocs?.data)
          ? rawDocs.data
          : Array.isArray(rawDocs)
            ? rawDocs
            : [];

        setData((prev) => ({
          ...prev,
          documents: docs,
        }));
      } catch (err) {
        console.error("Error polling document statuses:", err);
      }
    }, 2000);
    return () => clearInterval(pollInterval);
  }, [data.documents, projectId, getToken]);


  //   Chat-related methods
  const handleCreateNewChat = async () => {
    try {
      setIsCreatingChat(true);
      const token = await getToken();

      const chatNumber = Date.now() % 10000;

      const result = await apiClient.post(
        "/api/chats",
        {
          title: `Chat #${chatNumber}`,
          project_id: projectId,
        },
        token
      );
      if ((result as any)?.error) {
        throw new Error((result as any).error);
      }
      const rawChat = (result as any)?.data;
      const savedChat = rawChat?.data ?? rawChat;

      if (savedChat && savedChat.id) {
        router.push(`/projects/${projectId}/chats/${savedChat.id}`);
        setData((prev) => ({
          ...prev,
          chats: [savedChat, ...prev.chats],
        }));
        toast.success("Chat Created successfully!");
      } else {
        toast.error("Failed to create chat: No chat ID returned.");
      }
    } catch (err) {
      toast.error("Failed to create chat.");
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!userId) return;

    try {
      const token = await getToken();

      await apiClient.delete(`/api/chats/${chatId}`, token);

      // update local state
      setData((prev) => ({
        ...prev,
        chats: prev.chats.filter((chat) => chat.id !== chatId),
      }));
      toast.success("Chat deleted successfully!");

    } catch (err) {
      console.error("Error deleting chat:", err);
      toast.error("Failed to delete chat.");
    }

    // Update local state
    setData((prev) => ({
      ...prev,
      chats: prev.chats.filter((chat) => chat.id !== chatId),
    }))
  };

  const handleChatClick = (chatId: string) => {
    router.push(`/projects/${projectId}/chats/${chatId}`);
  };

  //   Document-related methods
  const handleDocumentUpload = async (files: File[]) => {
    if (!userId) {
      toast.error("Please sign in to upload documents");
      return;
    }

    if (!files || files.length === 0) {
      toast.error("No files selected");
      return;
    }

    const token = await getToken();
    if (!token) {
      toast.error("Authentication failed. Please sign in again.");
      return;
    }

    const uploadedDocuments: ProjectDocument[] = [];
    let failedUploads = 0;

    // Show initial toast
    toast.loading(`Uploading ${files.length} file(s)...`, { id: 'upload-progress' });

    // Process all files in parallel
    const uploadPromises = files.map(async (file) => {
      try {
        console.log(`Starting upload for: ${file.name}`);
        
        // Step1: Get presigned URL
      const uploadData = await apiClient.post(
        `/api/projects/${projectId}/files/upload-url`, 
        {
          filename: file.name,
          file_size: file.size,
          file_type: file.type,
        }, 
        token
      );
      if ((uploadData as any)?.error) {
        throw new Error((uploadData as any).error);
      }
        
        console.log(`Upload URL response for ${file.name}:`, uploadData);
        
        // Extract data - handle wrapped responses
        const uploadInfo = uploadData.data?.data || uploadData.data;
        const { upload_url, s3_key } = uploadInfo;

        if (!upload_url || !s3_key) {
          throw new Error(`Invalid upload URL response for ${file.name}`);
        }

        console.log(`Uploading ${file.name} to S3...`);

        // Step2: Upload to S3
        await apiClient.uploadToS3(upload_url, file);

        console.log(`S3 upload complete for ${file.name}, confirming...`);

        // Step3: Confirm upload to the server 
      const confirmResponse = await apiClient.post(
        `/api/projects/${projectId}/files/confirm`,
        {
          s3_key,
        },
        token
      );
      if ((confirmResponse as any)?.error) {
        throw new Error((confirmResponse as any).error);
      }
        
        console.log(`Confirm response for ${file.name}:`, confirmResponse);

        // Extract document data - handle wrapped responses
        const documentData = confirmResponse.data?.data || confirmResponse.data;
        
        if (documentData && documentData.id) {
          uploadedDocuments.push(documentData);
          console.log(`Successfully uploaded: ${file.name}`);
        } else {
          console.error(`Document data missing ID for ${file.name}:`, documentData);
          failedUploads++;
        }
      } catch (err: any) {
        failedUploads++;
        const errorMessage = err?.response?.data?.detail || err?.message || 'Unknown error';
        console.error(`Error uploading ${file.name}:`, errorMessage, err);
        toast.error(`Failed to upload ${file.name}: ${errorMessage}`);
      }
    });

    await Promise.allSettled(uploadPromises);

    // Dismiss loading toast
    toast.dismiss('upload-progress');

    // Update local state with successfully uploaded documents
    // Filter out any documents without IDs
    const validUploadedDocs = uploadedDocuments.filter(doc => doc && doc.id);

    if (validUploadedDocs.length > 0) {
      setData((prev) => ({
        ...prev,
        documents: [...validUploadedDocs, ...prev.documents],
      }));
      
      if (failedUploads > 0) {
        toast.success(`${validUploadedDocs.length} file(s) uploaded successfully. ${failedUploads} failed.`);
      } else {
        toast.success(`${validUploadedDocs.length} file(s) uploaded successfully!`);
      }
    } else {
      toast.error("Failed to upload documents. Please check console for details.");
    }
  };



  
  const handleDocumentDelete = async (documentId: string) => {
    if (!userId) return;
    
    try {
      const token = await getToken();
      await apiClient.delete(`/api/projects/${projectId}/files/${documentId}`, token);

      // Update local state -remove the deleted documents
      setData((prev) => ({
        ...prev,
        documents: prev.documents.filter((doc) => doc.id !== documentId),
      }));

      toast.success("Document deleted successfully!");
    } catch (err) {
      console.error("Error deleting document:", err);
      toast.error("Failed to delete document.");
    }
  };

  const handleUrlAdd = async (url: string) => {
    if (!userId) return

    try {
      const token = await getToken();
      
      const result = await apiClient.post(
        `/api/projects/${projectId}/urls`,
        { url },
        token
      );
      if ((result as any)?.error) {
        throw new Error((result as any).error);
      }

      const newDocument = result.data;
      
      // Update local state
      setData((prev) => ({
        ...prev,
        documents: [newDocument, ...prev.documents]
      }));

      toast.success("URL added successfully!");


      console.log(result);
      } catch (err) {

      console.error("Error adding URL:", err);
      toast.error("Failed to add URL.");
    }
  };

  const handleOpenDocument = (documentId: string) => {
    console.log("Open document", documentId);
    setSelectedDocumentId(documentId);
  };

  // Project settings

  const handleDraftSettings = (updates: any) => {
    

    setData((prev) => {
      // If no settings exist yet, we can't update them
      if (!prev.settings) {
        return prev;
      }
      // Merge updates into existing settings
      return {
        ...prev,
        settings: {
          ...prev.settings,
          ...updates,
        },
      };
    });
  };

  const handlePublishSettings = async () => {
    if(!userId || !data.settings) {
      toast.error("Cannot update settings. User not authenticated or settings missing.");
      return;
    }

    try {
      const token = await getToken();

      const result = await apiClient.put(`/api/projects/${projectId}/settings`, data.settings, token);

      const updatedSettings = result.data;

      setData((prev) => ({
        ...prev,
        settings: updatedSettings,
      }));

      toast.success("Settings updated successfully!");
    } catch (err) {
      console.error("Error updating settings:", err);
      toast.error("Failed to update settings.");
    }

  };

  if (loading) {
    return <div>Loading Porject...</div>;
  }

  if(!data.project) {
    return <div>Error loading project: {error}</div>;
  }

  const selectedDocument = selectedDocumentId
    ? data.documents.find((doc) => doc.id == selectedDocumentId)
    : null;

  return (
    <>
      <div className="flex h-screen bg-[#0d1117] gap-4 p-4">
        <ConversationsList
          project={data.project}
          conversations={data.chats}
          error={error}
          loading={isCreatingChat}
          onCreateNewChat={handleCreateNewChat}
          onChatClick={handleChatClick}
          onDeleteChat={handleDeleteChat}
        />

        {/* KnowledgeBase Sidebar */}
        <KnowledgeBaseSidebar
          activeTab={activeTab}
          onSetActiveTab={setActiveTab}
          projectDocuments={data.documents}
          onDocumentUpload={handleDocumentUpload}
          onDocumentDelete={handleDocumentDelete}
          onOpenDocument={handleOpenDocument}
          onUrlAdd={handleUrlAdd}
          projectSettings={data.settings}
          settingsError={null}
          settingsLoading={false}
          onUpdateSettings={handleDraftSettings}
          onApplySettings={handlePublishSettings}
        />
      </div>
      {selectedDocument && (
        <FileDetailsModal
          document={selectedDocument}
          onClose={() => setSelectedDocumentId(null)}
        />
      )}
    </>
  );
}

export default ProjectPage;


//--------------------------------------------------------------------------------------------------------------
