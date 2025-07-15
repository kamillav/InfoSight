
-- Add DELETE policy for submissions so admins can delete any submission
CREATE POLICY "Admins can delete any submission" 
ON public.submissions 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'::app_role
  )
);

-- Add DELETE policy for users to delete their own submissions
CREATE POLICY "Users can delete their own submissions" 
ON public.submissions 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);
