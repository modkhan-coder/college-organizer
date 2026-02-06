-- Grant permissions to authenticated users
GRANT ALL ON TABLE public.user_feedback TO service_role;
GRANT SELECT, INSERT ON TABLE public.user_feedback TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Re-create the insert policy to be sure
DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.user_feedback;

CREATE POLICY "Users can insert their own feedback"
ON public.user_feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ensure the admin policy is also correct (viewing)
DROP POLICY IF EXISTS "Admin can view all feedback" ON public.user_feedback;

CREATE POLICY "Admin can view all feedback"
ON public.user_feedback
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR
  ((select email from auth.users where id = auth.uid()) = 'modkhan20@gmail.com')
);
