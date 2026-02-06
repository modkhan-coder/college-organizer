-- Phase 16: Fix Permissions for AI Content

-- Ensure the table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.course_ai_content (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    study_guide text,
    quiz_data jsonb,
    chat_history jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_course_content UNIQUE (course_id)
);

-- Enable RLS
ALTER TABLE public.course_ai_content ENABLE ROW LEVEL SECURITY;

-- Grant Permissions (CRITICAL FIX)
GRANT ALL ON public.course_ai_content TO authenticated;
GRANT ALL ON public.course_ai_content TO service_role;

-- Re-apply policies just in case
DROP POLICY IF EXISTS "Users can manage own AI content" ON public.course_ai_content;
DROP POLICY IF EXISTS "Users can view own AI content" ON public.course_ai_content;
DROP POLICY IF EXISTS "Users can upsert own AI content" ON public.course_ai_content;
DROP POLICY IF EXISTS "Users can update own AI content" ON public.course_ai_content;

CREATE POLICY "Users can manage own AI content" 
ON public.course_ai_content FOR ALL
USING (
    exists (
        select 1 from public.courses 
        where courses.id = course_ai_content.course_id 
        and courses.user_id = auth.uid()
    )
);
