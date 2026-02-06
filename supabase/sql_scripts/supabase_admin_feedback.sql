-- Allow specific admin email to view ALL feedback
create policy "Admin can view all feedback"
  on public.user_feedback for select
  using (
    (select email from auth.users where id = auth.uid()) = 'modkhan20@gmail.com'
  );

-- Allow specific admin email to update status
create policy "Admin can update feedback status"
  on public.user_feedback for update
  using (
    (select email from auth.users where id = auth.uid()) = 'modkhan20@gmail.com'
  )
  with check (
    (select email from auth.users where id = auth.uid()) = 'modkhan20@gmail.com'
  );
