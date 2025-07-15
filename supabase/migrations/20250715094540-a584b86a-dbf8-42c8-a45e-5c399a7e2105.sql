
-- Insert profile for existing user kamilla.trn@infosys.com
-- First, get the user ID from auth.users and insert into profiles
INSERT INTO public.profiles (id, email, name)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data ->> 'name', email) as name
FROM auth.users 
WHERE email = 'kamilla.trn@infosys.com'
ON CONFLICT (id) DO NOTHING;

-- Insert admin role for this user
INSERT INTO public.user_roles (user_id, role)
SELECT 
  id,
  'admin'::app_role
FROM auth.users 
WHERE email = 'kamilla.trn@infosys.com'
ON CONFLICT (user_id, role) DO NOTHING;
