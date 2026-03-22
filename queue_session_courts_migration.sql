-- Create the junction table for queue sessions and courts
CREATE TABLE public.queue_session_courts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    queue_session_id UUID NOT NULL REFERENCES public.queue_sessions(id) ON DELETE CASCADE,
    court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(queue_session_id, court_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.queue_session_courts ENABLE ROW LEVEL SECURITY;

-- Standard policies for queue_session_courts
CREATE POLICY "Enable read access for all users" 
ON public.queue_session_courts 
FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON public.queue_session_courts 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable update for session organizers" 
ON public.queue_session_courts 
FOR UPDATE 
TO authenticated 
USING (
    queue_session_id IN (SELECT id FROM queue_sessions WHERE organizer_id = auth.uid())
);

CREATE POLICY "Enable delete for session organizers" 
ON public.queue_session_courts 
FOR DELETE 
TO authenticated 
USING (
    queue_session_id IN (SELECT id FROM queue_sessions WHERE organizer_id = auth.uid())
);
