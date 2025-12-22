-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    clerk_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Project settings table
CREATE TABLE project_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    embedding_model TEXT NOT NULL,
    rag_strategy TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    chunks_per_search INTEGER NOT NULL,
    final_context_size INTEGER NOT NULL,
    similarity_threshold DECIMAL NOT NULL,
    number_of_queries INTEGER NOT NULL,
    reranking_enabled BOOLEAN NOT NULL,
    reranking_model TEXT NOT NULL,
    vector_weight DECIMAL NOT NULL,
    keyword_weight DECIMAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Project documents table
CREATE TABLE project_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    processing_status TEXT DEFAULT 'pending',
    processing_details JSONB DEFAULT '{}',
    task_id TEXT,
    source_type TEXT DEFAULT 'file',
    source_url TEXT,
    clerk_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Document chunks table
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    page_number INTEGER,
    char_count INTEGER NOT NULL,
    type JSONB DEFAULT '{}',
    original_content JSONB DEFAULT '{}',
    embedding vector(1536),
    fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Chats table
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    clerk_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    clerk_id TEXT NOT NULL REFERENCES users(clerk_id) ON DELETE CASCADE,
    citations JSONB DEFAULT '[]',
    trace_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX document_chunks_fts_idx ON document_chunks USING gin (fts);
CREATE INDEX document_chunks_embedding_hnsw_idx ON document_chunks USING hnsw (embedding vector_ip_ops);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert their own data" ON users
    FOR INSERT WITH CHECK (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for projects table
CREATE POLICY "Users can view their own projects" ON projects
    FOR SELECT USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can create their own projects" ON projects
    FOR INSERT WITH CHECK (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own projects" ON projects
    FOR UPDATE USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own projects" ON projects
    FOR DELETE USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for project_settings table
CREATE POLICY "Users can view settings for their projects" ON project_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = project_settings.project_id 
            AND projects.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

CREATE POLICY "Users can create settings for their projects" ON project_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = project_settings.project_id 
            AND projects.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

CREATE POLICY "Users can update settings for their projects" ON project_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = project_settings.project_id 
            AND projects.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- RLS Policies for project_documents table
CREATE POLICY "Users can view their own documents" ON project_documents
    FOR SELECT USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can create their own documents" ON project_documents
    FOR INSERT WITH CHECK (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own documents" ON project_documents
    FOR UPDATE USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own documents" ON project_documents
    FOR DELETE USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for document_chunks table
CREATE POLICY "Users can view chunks for their documents" ON document_chunks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_documents 
            WHERE project_documents.id = document_chunks.document_id 
            AND project_documents.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

CREATE POLICY "Users can create chunks for their documents" ON document_chunks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_documents 
            WHERE project_documents.id = document_chunks.document_id 
            AND project_documents.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

CREATE POLICY "Users can delete chunks for their documents" ON document_chunks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM project_documents 
            WHERE project_documents.id = document_chunks.document_id 
            AND project_documents.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- RLS Policies for chats table
CREATE POLICY "Users can view their own chats" ON chats
    FOR SELECT USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can create their own chats" ON chats
    FOR INSERT WITH CHECK (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own chats" ON chats
    FOR UPDATE USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own chats" ON chats
    FOR DELETE USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for messages table
CREATE POLICY "Users can view their own messages" ON messages
    FOR SELECT USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can create their own messages" ON messages
    FOR INSERT WITH CHECK (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own messages" ON messages
    FOR DELETE USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');