
-- Create table for storing AI processing results
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- File references
  video_files JSONB NOT NULL, -- Array of video file paths/URLs
  pdf_file TEXT, -- PDF file path/URL
  notes TEXT,
  
  -- AI processing results
  transcript JSONB, -- Transcripts for each video
  key_points TEXT[],
  extracted_kpis TEXT[],
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  ai_quotes TEXT[],
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  processing_error TEXT
);

-- Create table for admin-defined KPIs
CREATE TABLE public.kpi_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  target_value DECIMAL,
  unit TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for user KPI performance tracking
CREATE TABLE public.user_kpi_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
  value DECIMAL NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, kpi_id, period_start, period_end)
);

-- Enable RLS on all tables
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_kpi_performance ENABLE ROW LEVEL SECURITY;

-- RLS policies for submissions
CREATE POLICY "Users can view their own submissions" 
  ON public.submissions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own submissions" 
  ON public.submissions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own submissions" 
  ON public.submissions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all submissions" 
  ON public.submissions FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS policies for KPI definitions
CREATE POLICY "Everyone can view active KPI definitions" 
  ON public.kpi_definitions FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Admins can manage KPI definitions" 
  ON public.kpi_definitions FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS policies for user KPI performance
CREATE POLICY "Users can view their own KPI performance" 
  ON public.user_kpi_performance FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all KPI performance" 
  ON public.user_kpi_performance FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "System can create KPI performance records" 
  ON public.user_kpi_performance FOR INSERT 
  WITH CHECK (true);

-- Create storage bucket for video and PDF files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('submissions', 'submissions', false);

-- Storage policies
CREATE POLICY "Users can upload their own files" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'submissions' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own files" 
  ON storage.objects FOR SELECT 
  USING (
    bucket_id = 'submissions' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all submission files" 
  ON storage.objects FOR SELECT 
  USING (
    bucket_id = 'submissions' AND 
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
