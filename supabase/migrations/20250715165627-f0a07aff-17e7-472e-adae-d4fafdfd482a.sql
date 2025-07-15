
-- Add foreign key relationship between submissions and profiles tables
ALTER TABLE public.submissions 
ADD CONSTRAINT submissions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
