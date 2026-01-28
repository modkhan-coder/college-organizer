-- Phase 15: AI Content Persistence

-- Table for storing generated AI content per course (Study Guide, Quiz, Chat)
CREATE TABLE IF NOT EXISTS public.course_ai_content (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    study_guide text, -- Markdown content
    quiz_data jsonb, -- JSON object { questions: [] }
    chat_history jsonb, -- JSON array [{ role, content }]
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_course_content UNIQUE (course_id)
);

-- Enable RLS
ALTER TABLE public.course_ai_content ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can View their own course content (via course_id -> user_id check)
CREATE POLICY "Users can view own AI content" 
ON public.course_ai_content FOR SELECT 
USING (
    exists (
        select 1 from public.courses 
        where courses.id = course_ai_content.course_id 
        and courses.user_id = auth.uid()
    )
);

-- Users can Insert/Update their own course content
CREATE POLICY "Users can upsert own AI content" 
ON public.course_ai_content FOR INSERT 
WITH CHECK (
    exists (
        select 1 from public.courses 
        where courses.id = course_ai_content.course_id 
        and courses.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update own AI content" 
ON public.course_ai_content FOR UPDATE 
USING (
    exists (
        select 1 from public.courses 
        where courses.id = course_ai_content.course_id 
        and courses.user_id = auth.uid()
    )
);
