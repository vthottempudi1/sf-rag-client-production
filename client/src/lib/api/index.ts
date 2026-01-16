// // API Configuration

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// // Basic API Client function with authentication support


// export const apiClient = {
//     get: async (endpoint: string, token?: string | null) => {
//         const headers: HeadersInit = {};
//         if (token) {
//             headers['Authorization'] = `Bearer ${token}`;
//         }
        
//         const response = await fetch(`${API_BASE_URL}${endpoint}`, {
//             headers,
//         });

//         if (!response.ok) {
//             throw new Error(`API request failed with status ${response.status}`);
//         }
//         return response.json();

//     },

//     post:  async (endpoint: string, data: any,token?: string | null) => {
//         const headers: HeadersInit = {
//             'Content-Type': 'application/json',
//         };
//         if (token) {
//             headers['Authorization'] = `Bearer ${token}`;
//         }
        
//         const response = await fetch(`${API_BASE_URL}${endpoint}`, {
//             method: 'POST',
//             body: JSON.stringify(data),
//             headers,
//         });

//         if (!response.ok) {
//             throw new Error(`API request failed with status ${response.status}`);
//         }
//         return response.json();

//     },

//     put:  async (endpoint: string, data: any,token?: string | null) => {
//         const headers: HeadersInit = {
//             'Content-Type': 'application/json',
//         };
//         if (token) {
//             headers['Authorization'] = `Bearer ${token}`;
//         }
        
//         const response = await fetch(`${API_BASE_URL}${endpoint}`, {
//             method: 'PUT',
//             body: JSON.stringify(data),
//             headers,
//         });

//         if (!response.ok) {
//             throw new Error(`API request failed with status ${response.status}`);
//         }
//         return response.json();

//     },
    
//     delete:async (endpoint: string, token?: string | null) => {
//         const headers: HeadersInit = {};
//         if (token) {
//             headers['Authorization'] = `Bearer ${token}`;
//         }
        
//         const response = await fetch(`${API_BASE_URL}${endpoint}`, {
//             headers,
//             method: 'DELETE',
//         });

//         if (!response.ok) {
//             throw new Error(`API request failed with status ${response.status}`);
//         }
//         return response.json();
//     }


// // S3 upload utility as a named export
// // export const uploadToS3 = async (url: string, file: File) => {
// //     const response = await fetch(url, {
// //         method: 'PUT',
// //         body: file,
// //         headers: {
// //             'Content-Type': file.type
// //         },
// //     });

// //     if (!response.ok) {
// //         throw new Error(`S3 upload failed with status ${response.status}`);
// //     }
// //     return response; // S3 doesn't return JSON
// // };

// // ...existing code...

// // export const apiClient = {
// //     // ...existing methods...
// //     uploadToS3: async (url: string, file: File) => {
// //         const response = await fetch(url, {
// //             method: 'PUT',
// //             body: file,
// //             headers: {
// //                 'Content-Type': file.type
// //             },
// //         });

// //         if (!response.ok) {
// //             throw new Error(`S3 upload failed with status ${response.status}`);
// //         }
// //         return response; // S3 doesn't return JSON
// //     }
// // };


// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Basic API Client function with authentication support

export const apiClient = {
  get: async (endpoint: string, token?: string | null) => {
    const headers: HeadersInit = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  },

  post: async (endpoint: string, data: any, token?: string | null) => {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  },

  put: async (endpoint: string, data: any, token?: string | null) => {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  },

  delete: async (endpoint: string, token?: string | null) => {
    const headers: HeadersInit = {};

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  },
  uploadToS3: async (url: string, file: File) => {
    const response = await fetch(url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!response.ok) {
      throw new Error(`S3 Upload Error: ${response.status}`);
    }
    return response; // S3 doesn't return JSON
  },
};
