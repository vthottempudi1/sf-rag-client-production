"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";
import { ProjectDocument } from "@/lib/types";
import { GenericStep } from "./document-details/GenericStep";
import { PartitioningStep } from "./document-details/PartitioningStep";
import { ChunkingStep } from "./document-details/ChunkingStep";
import { SummarisingStep } from "./document-details/SummarisingStep";
import { ChunksViewer } from "./document-details/ChunksViewer";
import { PipelineTabs } from "./document-details/PipelineTabs";
import { DetailInspector } from "./document-details/DetailInspector";
import { ModalHeader } from "./document-details/ModalHeader";
import { Modal } from "./document-details/Modal";

interface FileDetailsModalProps {
  document: ProjectDocument;
  initialChunkId?: string;
  onClose: () => void;
}

const PIPELINE_STEPS = [
  {
    id: "uploading",
    name: "Upload to S3",
    description: "Uploading file to secure cloud storage",
  },
  {
    id: "queued",
    name: "Queued",
    description: "File queued for processing",
  },
  {
    id: "partitioning",
    name: "Partitioning",
    description: "Processing and extracting text, images, and tables",
  },
  {
    id: "chunking",
    name: "Chunking",
    description: "Creating semantic chunks",
  },
  {
    id: "summarising",
    name: "Summarisation",
    description: "Enhancing content with AI summaries for images and tables",
  },
  {
    id: "vectorization",
    name: "Vectorization & Storage",
    description: "Generating embeddings and storing in vector database",
  },
  {
    id: "completed",
    name: "View Chunks",
    description: "View processed document chunks",
  },
];

export function FileDetailsModal({
  document: initialDocument,
  initialChunkId,
  onClose,
}: FileDetailsModalProps) {
  const [document, setDocument] = useState(initialDocument);
  const [activeTab, setActiveTab] = useState<string>(document.processing_status || "uploading");
  const { getToken, userId } = useAuth();

  const [selectedChunk, setSelectedChunk] = useState<any>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [idWarning, setIdWarning] = useState<string | null>(null);

  const currentStatus = document.processing_status || "uploading";
  const isProcessingComplete = currentStatus === "completed";
  const processingDetails = document?.processing_details as any;
  const currentStep = PIPELINE_STEPS.find((s) => s.id === activeTab);

  // Polling for document status updates
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Keep local document in sync when parent passes an updated record
  useEffect(() => {
    setDocument(initialDocument);
  }, [initialDocument]);

  useEffect(() => {
    // Only poll if not completed or failed
    if (!document.id || ["completed", "failed"].includes(document.processing_status)) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }
    const poll = async () => {
      const token = await getToken();
      if (!token) return;
      try {
        // Fetch the latest document record
        const res = await apiClient.get(`/api/projects/${document.project_id}/files/${document.id}`, token);
        const latest = res.data || (res as any)?.data;
        if (latest && latest.processing_status && latest.processing_status !== document.processing_status) {
          setDocument((prev) => ({ ...prev, ...latest }));
        }
      } catch (err) {
        // Optionally handle error
      }
    };
    pollingRef.current = setInterval(poll, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id, document.processing_status]);

  // Helper to check for valid UUID (simple regex)
  function isValidUUID(id: string | undefined | null) {
    return !!id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
  }

  const getStepStatus = (stepId: string) => {
    const currentPos = PIPELINE_STEPS.findIndex(
      (step) => step.id === currentStatus
    );
    const stepPos = PIPELINE_STEPS.findIndex((step) => step.id === stepId);

    if (stepPos < currentPos) return "completed";
    if (stepPos === currentPos) return "processing";
    return "pending";
  };

  // Load chunks when document processing is complete
  const loadChunks = async () => {
    if (!document?.project_id || !document?.id || !userId) {
      setIdWarning("Missing project or file ID. Cannot load chunks.");
      return;
    }
    if (!isValidUUID(document.project_id) || !isValidUUID(document.id)) {
      setIdWarning("This document has an invalid or legacy ID and cannot be loaded or deleted. Please re-upload or contact support.");
      return;
    }
    setIdWarning(null);

    console.log("[ChunksViewer] Using project_id and file_id:", {
      project_id: document.project_id,
      file_id: document.id,
    });

    const token = await getToken();
    if (!token) {
      setChunks([]);
      return;
    }

    try {
      setChunksLoading(true);
      // Try primary chunks endpoint
      const fetchChunks = async (path: string) => {
        const res = await apiClient.get(path, token);
        let chunksArr: any[] = [];
        if (Array.isArray(res.data)) {
          chunksArr = res.data;
        } else if (res.data && Array.isArray((res.data as any).data)) {
          chunksArr = (res.data as any).data;
        }
        return chunksArr;
      };

      let chunksArr: any[] = [];
      try {
        chunksArr = await fetchChunks(`/api/projects/${document.project_id}/files/${document.id}/chunks`);
      } catch (e) {
        console.error("[ChunksViewer] primary chunks endpoint failed, trying alias", e);
        // Fallback alias (without /files/)
        chunksArr = await fetchChunks(`/api/projects/${document.project_id}/${document.id}/chunks`);
      }

      const normalizedChunks = chunksArr.map((chunk: any) => ({
        id: chunk.id,
        type: chunk.type,
        content: chunk.content,
        original_content: chunk.original_content,
        page: chunk.page_number,
        chunkIndex: chunk.chunk_index,
        chars: chunk.char_count,
      }));

      setChunks(normalizedChunks);
    } catch (error) {
      console.error("Error loading chunks:", error);
      setChunks([]);
    } finally {
      setChunksLoading(false);
    }
  };

  useEffect(() => {
    if (isProcessingComplete) {
      loadChunks();
    }
  }, [isProcessingComplete, document.id]);

  // Load chunks when user navigates to "completed" tab after processing
  useEffect(() => {
    if (activeTab === "completed" && !chunksLoading && chunks.length === 0) {
      loadChunks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isProcessingComplete]);

  useEffect(() => {
    if (!initialChunkId || chunks.length === 0) return;
    const match = chunks.find((chunk) => chunk.id === initialChunkId);
    if (match) {
      setSelectedChunk(match);
      setActiveTab("completed");
    }
  }, [initialChunkId, chunks]);

  useEffect(() => {
    if (document) {
      setActiveTab(document.processing_status || "uploading");
      setSelectedChunk(null);
      setChunks([]);
    }
  }, [document.id, document.processing_status]);

  return (
    <Modal onClose={onClose}>
      <ModalHeader document={document} onClose={onClose} />

      {idWarning ? (
        <div style={{ color: "red", padding: 16, background: "#2a1a1a", borderRadius: 8, margin: 16 }}>
          <b>Document Error:</b> {idWarning}
        </div>
      ) : (
        <>
          <PipelineTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={PIPELINE_STEPS.map((step) => ({
              id: step.id,
              name: step.name,
              enabled:
                step.id === "completed"
                  ? isProcessingComplete
                  : getStepStatus(step.id) !== "pending",
              icon: <div></div>,
            }))}
          />

          <div className="flex-1 flex overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-[#1a1a1a]">
              {/* Show Chunks Viewer if completed */}
              {activeTab === "completed" && (isProcessingComplete || chunks.length > 0) && (
                <ChunksViewer
                  chunks={chunks}
                  chunksLoading={chunksLoading}
                  selectedChunk={selectedChunk}
                  onSelectChunk={setSelectedChunk}
                />
              )}

              {/* Show Partitioning Step */}
              {activeTab === "partitioning" && (
                <PartitioningStep
                  status={getStepStatus("partitioning")}
                  elementsFound={processingDetails?.partitioning?.elements_found}
                />
              )}

              {/* Show Chunking Step */}
              {activeTab === "chunking" && (
                <ChunkingStep
                  status={getStepStatus("chunking")}
                  chunkingData={processingDetails?.chunking}
                  chunks={chunks}
                  partitioningData={processingDetails?.partitioning}
                />
              )}

              {/* Show Summarising Step */}
              {activeTab === "summarising" && (
                <SummarisingStep
                  status={getStepStatus("summarising")}
                  summarisingData={processingDetails?.summarising}
                />
              )}

              {/* Show Generic Steps for other steps */}
              {!["completed", "partitioning", "chunking", "summarising"].includes(
                activeTab
              ) && (
                <GenericStep
                  stepName={currentStep?.name || "Processing"}
                  description={currentStep?.description || "Processing step"}
                  status={getStepStatus(activeTab)}
                />
              )}
            </div>
            {/* Inspector */}
            <DetailInspector
              selectedChunk={selectedChunk}
              isProcessingComplete={isProcessingComplete}
            />
          </div>
        </>
      )}
    </Modal>
  );
}
