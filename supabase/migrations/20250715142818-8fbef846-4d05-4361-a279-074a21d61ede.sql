
-- Rename pdf_file column to docx_file in submissions table
ALTER TABLE public.submissions 
RENAME COLUMN pdf_file TO docx_file;
