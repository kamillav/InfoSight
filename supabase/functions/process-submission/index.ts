
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

// Enhanced function to extract text from PDF using OpenAI's document processing
async function extractPDFText(pdfData: Blob, openaiApiKey: string): Promise<string> {
  try {
    console.log('Starting PDF text extraction using OpenAI...');
    
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
            content: 'You are a document processing assistant specializing in extracting business metrics and KPIs. Extract ALL text content from the provided PDF document, with special focus on numerical data, financial figures, performance metrics, percentages, dates, targets, and quantifiable business information. Preserve the structure and context of numbers. Return only the extracted text content without commentary.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all text from this PDF document. Pay special attention to:\n- Revenue figures and financial data\n- Performance metrics and KPIs\n- Percentages and growth rates\n- Targets and goals\n- Dates and time periods\n- Any quantifiable business data\n\nExtract the complete text content:'
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
    console.log('Extracted text preview:', extractedText.substring(0, 500) + '...');
    console.log('Total extracted text length:', extractedText.length);
    
    return extractedText;
    
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    // Return a descriptive fallback instead of empty string
    return 'PDF document was uploaded but text extraction encountered an error. Please check the document format and try again.';
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

    // Process PDF if present with enhanced text extraction
    let pdfText = '';
    let pdfProcessingSuccess = false;
    
    if (submission.pdf_file) {
      try {
        console.log('Processing PDF file:', submission.pdf_file);
        const { data: pdfData, error: pdfError } = await supabase.storage
          .from('submissions')
          .download(submission.pdf_file);

        if (!pdfError && pdfData) {
          console.log('PDF downloaded successfully, size:', pdfData.size);
          
          // Extract text from PDF using OpenAI with enhanced processing
          pdfText = await extractPDFText(pdfData, openaiApiKey);
          
          if (pdfText && pdfText.length > 50 && !pdfText.includes('extraction encountered an error')) {
            pdfProcessingSuccess = true;
            console.log('PDF text extracted successfully, length:', pdfText.length);
            console.log('PDF content preview:', pdfText.substring(0, 300) + '...');
          } else {
            console.warn('PDF text extraction returned minimal or error content');
            pdfText = 'PDF document was uploaded but minimal content could be extracted.';
          }
        } else {
          console.warn('PDF download failed:', pdfError);
          pdfText = 'PDF document was uploaded but could not be downloaded for processing.';
        }
      } catch (error) {
        console.error('Error processing PDF:', error);
        pdfText = `PDF document was uploaded but processing failed: ${error.message}`;
      }
    }

    // Enhanced analysis prompt that specifically incorporates PDF content and emphasizes KPI extraction
    const analysisPrompt = `
You are analyzing a comprehensive business submission with multiple content sources. Your primary goal is to extract specific, measurable KPIs and business metrics from ALL sources provided.

CONTENT SOURCES:

1. VIDEO TRANSCRIPT:
${fullTranscript || 'No video transcript available'}

2. PDF DOCUMENT CONTENT${pdfProcessingSuccess ? ' (Successfully Extracted)' : ' (Limited Extraction)'}:
${pdfText || 'No PDF content available'}

3. ADDITIONAL NOTES:
${submission.notes || 'No additional notes provided'}

ANALYSIS INSTRUCTIONS:

Please conduct a thorough analysis of ALL content sources above to extract comprehensive business metrics and insights. Focus heavily on:

1. **NUMERICAL DATA EXTRACTION**: Find all numbers, percentages, monetary values, quantities, timeframes, and measurable metrics from video, PDF, and notes
2. **FINANCIAL METRICS**: Revenue, costs, profits, budgets, ROI, growth rates, market share
3. **PERFORMANCE INDICATORS**: Customer metrics, operational efficiency, quality scores, productivity measures
4. **COMPARATIVE DATA**: Before/after comparisons, year-over-year growth, benchmarks, targets vs. actuals
5. **TIME-BASED METRICS**: Quarterly results, monthly performance, project timelines
6. **PDF-SPECIFIC DATA**: Pay special attention to structured data, tables, charts, and formal reports in the PDF

IMPORTANT: If PDF content was successfully extracted, prioritize finding KPIs from both video and PDF sources equally. The PDF often contains more structured and detailed metrics.

Extract and format the following in JSON:

1. **KEY_POINTS**: 5-7 main business achievements, goals, or important insights from ALL sources
2. **EXTRACTED_KPIS**: Specific, measurable metrics with format "Metric Name: Value Unit" (e.g., "Revenue: $50,000", "Customer Growth: 25%", "Processing Time: 2.5 hours", "Market Share: 15%"). Include ALL quantifiable data found.
3. **SENTIMENT**: Overall business sentiment (positive, neutral, or negative)
4. **NOTABLE_QUOTES**: 2-4 impactful direct quotes from video transcript or key statements from PDF/notes

Focus on extracting ACTUAL NUMBERS and QUANTIFIABLE ACHIEVEMENTS from all sources, especially the PDF content.

Respond ONLY with this JSON format:
{
  "key_points": ["Achievement or insight 1", "Achievement or insight 2", "Achievement or insight 3", "Achievement or insight 4", "Achievement or insight 5"],
  "extracted_kpis": ["Revenue: $X", "Growth Rate: X%", "Customer Count: X users", "Efficiency: X%"],
  "sentiment": "positive|neutral|negative",
  "ai_quotes": ["Quote from video or key PDF statement 1", "Quote 2", "Quote 3"]
}
`;

    console.log('Sending comprehensive analysis to GPT-4 with enhanced PDF focus...');

    const analysisResponse = await withTimeout(
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert business analyst that specializes in extracting specific, measurable KPIs and metrics from various content sources including video transcripts, PDF documents, and text notes. Always respond with valid JSON only. Focus on finding concrete numbers, percentages, monetary values, and quantifiable business achievements from ALL provided content sources, with special attention to PDF content which often contains structured data.'
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

    console.log('GPT-4 analysis response status:', analysisResponse.status);

    let analysisResult = {
      key_points: ['Content processed successfully'],
      extracted_kpis: [],
      sentiment: 'neutral',
      ai_quotes: []
    };

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('GPT-4 API error response:', errorText);
      console.warn('Using default analysis result due to GPT-4 API error');
    } else {
      try {
        const gptResponse = await analysisResponse.json();
        const content = gptResponse.choices[0]?.message?.content;
        if (content) {
          console.log('Raw GPT response content:', content);
          analysisResult = JSON.parse(content);
          console.log('Comprehensive analysis completed successfully:', analysisResult);
          console.log('Extracted KPIs count:', analysisResult.extracted_kpis?.length || 0);
          if (analysisResult.extracted_kpis?.length > 0) {
            console.log('Sample KPIs:', analysisResult.extracted_kpis.slice(0, 3));
          }
        } else {
          console.error('No content in GPT-4 response');
        }
      } catch (parseError) {
        console.error('Error parsing GPT response:', parseError);
        console.log('Raw content that failed to parse:', gptResponse.choices[0]?.message?.content);
        console.warn('Using default analysis result due to parsing error');
      }
    }

    // Update submission with results including PDF processing status
    console.log('Updating submission with comprehensive results...');
    const updateData = {
      transcript: fullTranscript,
      key_points: analysisResult.key_points,
      extracted_kpis: analysisResult.extracted_kpis,
      sentiment: analysisResult.sentiment,
      ai_quotes: analysisResult.ai_quotes,
      status: 'completed',
      updated_at: new Date().toISOString(),
    };

    console.log('Update data being saved:', {
      ...updateData,
      transcript: `${fullTranscript.length} characters`,
      key_points_count: analysisResult.key_points?.length,
      kpis_count: analysisResult.extracted_kpis?.length,
      quotes_count: analysisResult.ai_quotes?.length
    });

    const { error: updateError } = await supabase
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId);

    if (updateError) {
      console.error('Error updating submission:', updateError);
      throw updateError;
    }

    console.log('Submission updated successfully');

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
      ? 'Submission processed successfully with comprehensive PDF and video analysis'
      : 'Submission processed successfully with video analysis and limited PDF processing';

    console.log('Processing completed:', responseMessage);

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
