
-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'team_lead', 'user');

-- Create user roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Create submissions table for storing video/PDF uploads and insights
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  video_url TEXT,
  pdf_url TEXT,
  insights JSONB,
  kpis JSONB,
  sentiment_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create KPIs management table
CREATE TABLE public.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_global BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user roles
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_roles WHERE user_roles.user_id = $1 ORDER BY 
    CASE 
      WHEN role = 'admin' THEN 1
      WHEN role = 'team_lead' THEN 2
      ELSE 3
    END
  LIMIT 1;
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for submissions
CREATE POLICY "Users can view their own submissions" ON public.submissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own submissions" ON public.submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions" ON public.submissions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions" ON public.submissions
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for KPIs
CREATE POLICY "Users can view global KPIs" ON public.kpis
  FOR SELECT USING (is_global = true OR created_by = auth.uid());

CREATE POLICY "Users can create their own KPIs" ON public.kpis
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can manage all KPIs" ON public.kpis
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := NEW.email;
  
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id, 
    user_email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(user_email, '@', 1))
  );
  
  -- Assign admin role to kamilla.trn@infosys.com
  IF user_email = 'kamilla.trn@infosys.com' THEN
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically create profile and assign roles on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default KPIs for the platform
INSERT INTO public.kpis (name, description, created_by, is_global) 
SELECT 
  name,
  description,
  (SELECT id FROM auth.users WHERE email = 'kamilla.trn@infosys.com' LIMIT 1),
  true
FROM (VALUES 
  ('Conversion Rate', 'Percentage of leads converted to customers'),
  ('Lead Quality', 'Quality score of incoming leads'),
  ('Customer Satisfaction', 'Customer satisfaction rating'),
  ('Team Collaboration', 'Team collaboration effectiveness score'),
  ('Response Time', 'Average response time to customer inquiries'),
  ('Revenue Growth', 'Monthly revenue growth percentage'),
  ('Project Completion Rate', 'Percentage of projects completed on time')
) AS default_kpis(name, description);
