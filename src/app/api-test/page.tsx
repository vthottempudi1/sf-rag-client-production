'use client';

import { useApi } from '@/hooks/useApi';
import { api } from '@/lib/api';

export default function ApiTestPage() {
  const { data: healthData, loading: healthLoading, error: healthError } = useApi<{ status: string }>('/health');
  const { data: rootData, loading: rootLoading, error: rootError, refetch: refetchRoot } = useApi<{ message: string }>('/', { immediate: false });

  const handleTestRoot = async () => {
    const response = await api.root();
    if (response.data) {
      alert(`Success: ${response.data.message}`);
    } else {
      alert(`Error: ${response.error}`);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">API Connection Test</h1>
      
      <div className="space-y-6">
        {/* Health Check */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Health Check (Auto-loaded)</h2>
          {healthLoading && <p>Loading...</p>}
          {healthError && <p className="text-red-500">Error: {healthError}</p>}
          {healthData && (
            <div className="text-green-600">
              <p>Status: {healthData.status}</p>
            </div>
          )}
        </div>

        {/* Root Endpoint */}
        <div className="border p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Root Endpoint</h2>
          <div className="space-y-2">
            <button
              onClick={() => refetchRoot()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Test Root Endpoint (Hook)
            </button>
            <button
              onClick={handleTestRoot}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ml-2"
            >
              Test Root Endpoint (Direct)
            </button>
            {rootLoading && <p>Loading...</p>}
            {rootError && <p className="text-red-500">Error: {rootError}</p>}
            {rootData && (
              <div className="text-green-600">
                <p>Message: {rootData.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* API URL Info */}
        <div className="border p-4 rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold mb-2">Configuration</h2>
          <p>API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}</p>
          <p className="text-sm text-gray-600 mt-2">
            Make sure your FastAPI server is running on port 8000
          </p>
        </div>
      </div>
    </div>
  );
}
