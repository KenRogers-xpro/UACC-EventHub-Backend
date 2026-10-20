-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: admins
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time VARCHAR(50),
    venue VARCHAR(255) NOT NULL,
    dress_code VARCHAR(100),
    rsvp_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    cover_image_url TEXT,
    created_by UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: invitees
CREATE TABLE IF NOT EXISTS invitees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: event_materials
CREATE TABLE IF NOT EXISTS event_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    cloudinary_public_id TEXT,
    file_type VARCHAR(50),
    file_size_kb NUMERIC,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_invitees_event_id ON invitees(event_id);
CREATE INDEX IF NOT EXISTS idx_invitees_token ON invitees(token);
CREATE INDEX IF NOT EXISTS idx_invitees_event_email ON invitees(event_id, email);
CREATE INDEX IF NOT EXISTS idx_materials_event_id ON event_materials(event_id);
