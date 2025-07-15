
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

// Timeout wrapper for promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// Function to clean JSON response from GPT (remove markdown formatting)
function cleanJsonResponse(content: string): string {
  // Remove markdown code blocks if present
  let cleaned = content.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '');
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

// Enhanced function to extract text from PDF using OpenAI's document processing
async function extractPDFText(pdfData: Blob, openaiApiKey: string): Promise<string> {
  try {
    console.log('Starting enhanced PDF text extraction using OpenAI...');
    console.log('PDF file size:', pdfData.size, 'bytes');
    
    // Convert PDF to base64 for OpenAI API
    const arrayBuffer = await pdfData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const base64String = btoa(String.fromCharCode(...uint8Array));
    
    console.log('PDF converted to base64, size:', base64String.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert document processor specializing in extracting business metrics, KPIs, and quantifiable data from documents. Your task is to extract ALL text content from the provided PDF document with special emphasis on:

1. Revenue figures and financial data (sales, costs, profits, margins)
2. Performance metrics and KPIs (growth rates, conversion rates, efficiency metrics)
3. Percentages and ratios (market share, satisfaction scores, completion rates)
4. Targets, goals, and benchmarks
5. Dates and time periods associated with metrics
6. Customer metrics (acquisition, retention, satisfaction)
7. Operational metrics (productivity, quality scores, processing times)
8. Any numerical data with context

Extract the complete text content while preserving structure and context around numbers. Focus on making quantifiable business data clearly accessible for analysis.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please extract all text from this PDF document. Pay special attention to numerical data and business metrics. I need comprehensive extraction of:

- Financial figures (revenue, costs, profits, budgets)
- Performance indicators (KPIs, metrics, scores)
- Percentages and growth rates
- Targets and actual results
- Time-based data (quarterly, monthly, yearly figures)
- Customer and operational metrics
- Any tables or structured data containing numbers

Extract ALL text content completely, maintaining context around numerical values:`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64String}`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    console.log('OpenAI PDF processing response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI PDF processing error:', errorText);
      throw new Error(`OpenAI PDF processing failed: ${errorText}`);
    }

    const result = await response.json();
    const extractedText = result.choices[0]?.message?.content || '';
    console.log('PDF text extraction completed successfully');
    console.log('Extracted text preview:', extractedText.substring(0, 800) + '...');
    console.log('Total extracted text length:', extractedText.length);
    
    if (extractedText.length < 50) {
      console.warn('Warning: Very short text extracted from PDF. May indicate processing issue.');
    }
    
    return extractedText;
    
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    return `PDF processing error: ${error.message}. Please ensure the PDF contains readable text and is not corrupted.`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { submissionId } = await req.json();

    if (!submissionId) {
      throw new Error('Submission ID is required');
    }

    console.log('Processing submission:', submissionId);

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get submission details
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      console.error('Submission not found:', submissionError);
      throw new Error('Submission not found');
    }

    console.log('Found submission:', submission.id);
    console.log('PDF file present:', !!submission.pdf_file);
    console.log('Video files present:', !!submission.video_files);

    let fullTranscript = '';
    const videoFile = submission.video_files;

    // Validate video file structure
    if (!videoFile || !videoFile.path) {
      throw new Error('Invalid video file structure');
    }

    // Process the video file with timeout (10 minutes)
    try {
      console.log('Downloading video from:', videoFile.path);
      
      // Download video from storage
      const { data: videoData, error: downloadError } = await supabase.storage
        .from('submissions')
        .download(videoFile.path);

      if (downloadError || !videoData) {
        console.error('Error downloading video:', downloadError);
        throw new Error(`Failed to download video file: ${downloadError?.message || 'Unknown error'}`);
      }

      console.log('Video downloaded successfully, size:', videoData.size);

      // Convert video blob to audio and send to Whisper with timeout
      const formData = new FormData();
      formData.append('file', videoData, videoFile.name || 'video.webm');
      formData.append('model', 'whisper-1');

      console.log('Sending to OpenAI Whisper API...');

      const transcriptionResponse = await withTimeout(
        fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: formData,
        }),
        600000 // 10 minutes timeout
      );

      console.log('Whisper API response status:', transcriptionResponse.status);

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error('Whisper API error response:', errorText);
        throw new Error(`Whisper API error (${transcriptionResponse.status}): ${errorText}`);
      }

      const transcriptionResult = await transcriptionResponse.json();
      fullTranscript = transcriptionResult.text || '';
      console.log('Transcription completed successfully, length:', fullTranscript.length);
      
    } catch (error) {
      console.error('Error processing video with Whisper:', error);
      
      // Check if it's a timeout error
      if (error.message.includes('timed out')) {
        await supabase
          .from('submissions')
          .update({
            status: 'failed',
            processing_error: 'Processing timed out after 10 minutes. Please try with a shorter video.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', submissionId);
        
        return new Response(
          JSON.stringify({ error: 'Processing timed out after 10 minutes' }),
          {
            status: 408,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      throw new Error(`Video processing failed: ${error.message}`);
    }

    // Enhanced PDF processing with better error handling
    let pdfText = '';
    let pdfProcessingSuccess = false;
    
    if (submission.pdf_file) {
      try {
        console.log('Starting PDF processing for file:', submission.pdf_file);
        const { data: pdfData, error: pdfError } = await supabase.storage
          .from('submissions')
          .download(submission.pdf_file);

        if (!pdfError && pdfData) {
          console.log('PDF downloaded successfully, size:', pdfData.size);
          
          if (pdfData.size === 0) {
            console.error('PDF file is empty');
            pdfText = 'PDF file appears to be empty or corrupted.';
          } else {
            // Extract text from PDF using enhanced OpenAI processing
            pdfText = await extractPDFText(pdfData, openaiApiKey);
            
            if (pdfText && pdfText.length > 100 && !pdfText.includes('processing error')) {
              pdfProcessingSuccess = true;
              console.log('PDF text extracted successfully, length:', pdfText.length);
              console.log('PDF content preview:', pdfText.substring(0, 500) + '...');
            } else {
              console.warn('PDF text extraction returned insufficient content');
              console.log('Actual PDF text received:', pdfText);
            }
          }
        } else {
          console.error('PDF download failed:', pdfError);
          pdfText = `PDF download failed: ${pdfError?.message || 'Unknown error'}`;
        }
      } catch (error) {
        console.error('Error in PDF processing:', error);
        pdfText = `PDF processing failed: ${error.message}`;
      }
    }

    // Enhanced analysis prompt with stronger focus on PDF content and KPI extraction
    const analysisPrompt = `
You are analyzing a comprehensive business submission with multiple content sources. Your PRIMARY GOAL is to extract specific, measurable KPIs and business metrics from ALL sources provided, with special emphasis on PDF content.

CONTENT SOURCES:

1. VIDEO TRANSCRIPT:
${fullTranscript || 'No video transcript available'}

2. PDF DOCUMENT CONTENT${pdfProcessingSuccess ? ' (Successfully Extracted - PRIORITIZE THIS)' : ' (Processing Issues)'}:
${pdfText || 'No PDF content available'}

3. ADDITIONAL NOTES:
${submission.notes || 'No additional notes provided'}

CRITICAL ANALYSIS INSTRUCTIONS:

You MUST extract comprehensive business metrics and insights from ALL content sources above. Focus heavily on:

1. **NUMERICAL DATA EXTRACTION**: Find ALL numbers, percentages, monetary values, quantities, timeframes, and measurable metrics from video, PDF, and notes
2. **FINANCIAL METRICS**: Revenue, sales, costs, profits, budgets, ROI, growth rates, market share, margins
3. **PERFORMANCE INDICATORS**: Customer metrics, conversion rates, efficiency scores, productivity measures, quality metrics
4. **COMPARATIVE DATA**: Before/after comparisons, year-over-year growth, benchmarks, targets vs. actuals, variance analysis
5. **TIME-BASED METRICS**: Quarterly results, monthly performance, annual figures, project timelines
6. **PDF-SPECIFIC DATA**: Pay SPECIAL attention to structured data, tables, charts, and formal reports in the PDF - these often contain the most valuable KPIs

EXTRACTION REQUIREMENTS:
- If PDF content was successfully extracted, it should contribute SIGNIFICANTLY to your KPI findings
- Extract EVERY quantifiable metric you can find, no matter how small
- Include the source context for each KPI (what it measures, time period, etc.)
- Focus on business-relevant metrics that would be valuable for dashboard analytics

Extract and format the following in JSON:

1. **KEY_POINTS**: 5-7 main business achievements, goals, or important insights from ALL sources, prioritizing PDF findings
2. **EXTRACTED_KPIS**: Extensive list of specific, measurable metrics with format "Metric Name: Value Unit" (e.g., "Revenue Q1 2024: $250,000", "Customer Satisfaction: 87%", "Conversion Rate: 12.5%", "Processing Time Reduction: 30%"). Include ALL quantifiable data found across ALL sources.
3. **SENTIMENT**: Overall business sentiment (positive, neutral, or negative)
4. **NOTABLE_QUOTES**: 2-4 impactful direct quotes from video transcript or key statements from PDF/notes

CRITICAL: Extract ACTUAL NUMBERS and QUANTIFIABLE ACHIEVEMENTS from all sources. If the PDF contains business data, it should result in multiple KPIs being extracted.

Respond ONLY with this JSON format (no markdown formatting):
{
  "key_points": ["Achievement or insight 1", "Achievement or insight 2", "Achievement or insight 3", "Achievement or insight 4", "Achievement or insight 5"],
  "extracted_kpis": ["Revenue Q1: $X", "Growth Rate YoY: X%", "Customer Count: X users", "Efficiency Improvement: X%", "Market Share: X%", "Conversion Rate: X%"],
  "sentiment": "positive|neutral|negative",
  "ai_quotes": ["Quote from video or key PDF statement 1", "Quote 2", "Quote 3"]
}
`;

    console.log('Sending enhanced analysis to GPT-4o with PDF focus...');
    console.log('Analysis input summary:', {
      transcriptLength: fullTranscript.length,
      pdfTextLength: pdfText.length,
      pdfProcessed: pdfProcessingSuccess,
      notesLength: submission.notes?.length || 0
    });

    const analysisResponse = await withTimeout(
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert business analyst that specializes in extracting specific, measurable KPIs and metrics from various content sources including video transcripts, PDF documents, and text notes. You MUST respond with valid JSON only, without any markdown formatting or code blocks. Your primary focus is finding concrete numbers, percentages, monetary values, and quantifiable business achievements from ALL provided content sources, with special attention to PDF content which often contains the most structured and valuable data. Be thorough and extract EVERY quantifiable metric you can find.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          temperature: 0.1,
        }),
      }),
      300000 // 5 minutes timeout for analysis
    );

    console.log('GPT-4o analysis response status:', analysisResponse.status);

    let analysisResult = {
      key_points: ['Content processed successfully'],
      extracted_kpis: [],
      sentiment: 'neutral',
      ai_quotes: []
    };

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('GPT-4o API error response:', errorText);
      console.warn('Using default analysis result due to GPT-4o API error');
    } else {
      try {
        const gptResponse = await analysisResponse.json();
        const content = gptResponse.choices[0]?.message?.content;
        if (content) {
          console.log('Raw GPT response content:', content);
          
          // Clean the JSON response to remove any markdown formatting
          const cleanedContent = cleanJsonResponse(content);
          console.log('Cleaned content for parsing:', cleanedContent);
          
          analysisResult = JSON.parse(cleanedContent);
          console.log('Enhanced analysis completed successfully:', {
            keyPointsCount: analysisResult.key_points?.length || 0,
            kpisCount: analysisResult.extracted_kpis?.length || 0,
            sentiment: analysisResult.sentiment,
            quotesCount: analysisResult.ai_quotes?.length || 0
          });
          
          if (analysisResult.extracted_kpis?.length > 0) {
            console.log('Sample extracted KPIs:', analysisResult.extracted_kpis.slice(0, 5));
          } else {
            console.warn('WARNING: No KPIs were extracted from the content!');
          }
        } else {
          console.error('No content in GPT-4o response');
        }
      } catch (parseError) {
        console.error('Error parsing GPT response:', parseError);
        console.log('Raw content that failed to parse:', content);
        console.warn('Using default analysis result due to parsing error');
      }
    }

    // Update submission with results including enhanced PDF processing status
    console.log('Updating submission with enhanced results...');
    const updateData = {
      transcript: fullTranscript,
      key_points: analysisResult.key_points,
      extracted_kpis: analysisResult.extracted_kpis,
      sentiment: analysisResult.sentiment,
      ai_quotes: analysisResult.ai_quotes,
      status: 'completed',
      updated_at: new Date().toISOString(),
    };

    console.log('Final update data being saved:', {
      transcriptLength: fullTranscript.length,
      keyPointsCount: analysisResult.key_points?.length,
      kpisCount: analysisResult.extracted_kpis?.length,
      quotesCount: analysisResult.ai_quotes?.length,
      sentiment: analysisResult.sentiment
    });

    const { error: updateError } = await supabase
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId);

    if (updateError) {
      console.error('Error updating submission:', updateError);
      throw updateError;
    }

    console.log('Submission updated successfully with enhanced processing');

    // Delete the video file after successful processing to save storage space
    try {
      console.log('Deleting video file to save storage space:', videoFile.path);
      const { error: deleteError } = await supabase.storage
        .from('submissions')
        .remove([videoFile.path]);

      if (deleteError) {
        console.error('Error deleting video file:', deleteError);
      } else {
        console.log('Video file deleted successfully');
      }
    } catch (deleteError) {
      console.error('Error during file deletion:', deleteError);
    }

    const responseMessage = pdfProcessingSuccess 
      ? `Submission processed successfully with enhanced PDF analysis (${analysisResult.extracted_kpis?.length || 0} KPIs extracted)`
      : `Submission processed with video analysis and limited PDF processing (${analysisResult.extracted_kpis?.length || 0} KPIs extracted)`;

    console.log('Enhanced processing completed:', responseMessage);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: responseMessage,
        pdfProcessed: pdfProcessingSuccess,
        kpisExtracted: analysisResult.extracted_kpis?.length || 0,
        videoProcessed: !!fullTranscript,
        transcriptLength: fullTranscript.length,
        pdfContentLength: pdfText.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing submission:', error);

    // Update submission status to failed
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { submissionId } = await req.json().catch(() => ({}));
      
      if (submissionId) {
        await supabase
          .from('submissions')
          .update({
            status: 'failed',
            processing_error: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', submissionId);
        
        console.log('Updated submission status to failed for:', submissionId);
      }
    } catch (updateError) {
      console.error('Error updating failed status:', updateError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
