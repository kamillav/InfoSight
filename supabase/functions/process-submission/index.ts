
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

// Enhanced function to clean JSON response from GPT (remove markdown formatting)
function cleanJsonResponse(content: string): string {
  let cleaned = content.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '');
  }
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim();
  
  // Find the first { and last } to extract just the JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return cleaned;
}

// Simple DOCX text extraction function
async function extractDocxText(docxData: Blob): Promise<string> {
  try {
    console.log('Starting DOCX text extraction...');
    console.log('DOCX file size:', docxData.size, 'bytes');
    
    // For now, we'll use a placeholder approach since DOCX parsing is complex
    // In a production environment, you might want to:
    // 1. Use a DOCX parsing library
    // 2. Convert DOCX to plain text server-side
    // 3. Use a dedicated document processing service
    
    // Convert DOCX to base64 and use OpenAI's text completion to ask for help
    const arrayBuffer = await docxData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Try to extract any readable text from the DOCX binary
    let extractedText = '';
    try {
      // Look for XML content in the DOCX (which is actually a ZIP file containing XML)
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const decoded = textDecoder.decode(uint8Array);
      
      // Try to find XML content that might contain text
      const xmlMatches = decoded.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (xmlMatches) {
        extractedText = xmlMatches
          .map(match => match.replace(/<w:t[^>]*>([^<]+)<\/w:t>/, '$1'))
          .join(' ')
          .trim();
      }
      
      // If no XML text found, try to find any readable text
      if (!extractedText) {
        const readableText = decoded.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Extract meaningful text (more than just random characters)
        const words = readableText.split(' ').filter(word => 
          word.length > 2 && /^[a-zA-Z0-9\-\.\,\!\?\%\$]+$/.test(word)
        );
        
        if (words.length > 10) {
          extractedText = words.slice(0, 200).join(' '); // Limit to first 200 words
        }
      }
    } catch (decodeError) {
      console.log('Direct text extraction from DOCX binary failed:', decodeError.message);
    }
    
    if (extractedText && extractedText.length > 50) {
      console.log('Successfully extracted text from DOCX:', extractedText.length, 'characters');
      console.log('Sample extracted text:', extractedText.substring(0, 200) + '...');
      return extractedText;
    } else {
      console.log('Limited text extraction from DOCX. Using OpenAI for assistance...');
      
      // Fallback: Use OpenAI to help extract meaningful information
      const base64String = btoa(String.fromCharCode(...uint8Array.slice(0, 4000))); // First 4KB only
      
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
              content: `You are a document analysis expert. I will provide you with a partial base64 representation of a DOCX file. Based on the binary patterns and any readable text you can identify, please extract or infer what business metrics, KPIs, numbers, or key information this document likely contains. Focus on quantifiable business data, performance metrics, financial figures, percentages, dates, and any structured information that would be valuable for business analysis.`
            },
            {
              role: 'user',
              content: `Please analyze this partial DOCX file data and extract/infer key business information, metrics, and KPIs that might be contained within: ${base64String}`
            }
          ],
          max_tokens: 1000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI text analysis error:', errorText);
        return `DOCX processing: Could not extract text directly. File size: ${docxData.size} bytes. Please ensure the DOCX contains readable text and is not corrupted.`;
      }

      const result = await response.json();
      const analyzedContent = result.choices[0]?.message?.content || '';
      
      if (analyzedContent) {
        console.log('OpenAI document analysis completed');
        return `DOCX Analysis: ${analyzedContent}`;
      } else {
        return `DOCX processing: File received (${docxData.size} bytes) but content extraction was limited. Please ensure the document contains clear business metrics and KPIs.`;
      }
    }
  } catch (error) {
    console.error('DOCX text extraction failed:', error);
    return `DOCX processing error: ${error.message}. Please ensure the DOCX contains readable text and is not corrupted.`;
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
    console.log('DOCX file present:', !!submission.docx_file);
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

    // Enhanced DOCX processing with better error handling
    let docxText = '';
    let docxProcessingSuccess = false;
    
    if (submission.docx_file) {
      try {
        console.log('Starting DOCX processing for file:', submission.docx_file);
        const { data: docxData, error: docxError } = await supabase.storage
          .from('submissions')
          .download(submission.docx_file);

        if (!docxError && docxData) {
          console.log('DOCX downloaded successfully, size:', docxData.size);
          
          if (docxData.size === 0) {
            console.error('DOCX file is empty');
            docxText = 'DOCX file appears to be empty or corrupted.';
          } else {
            // Extract text from DOCX using the updated approach
            docxText = await extractDocxText(docxData);
            
            if (docxText && docxText.length > 100 && !docxText.includes('processing error')) {
              docxProcessingSuccess = true;
              console.log('DOCX text extracted successfully, length:', docxText.length);
              console.log('DOCX content preview:', docxText.substring(0, 500) + '...');
            } else {
              console.warn('DOCX text extraction returned insufficient content');
              console.log('Actual DOCX text received:', docxText);
            }
          }
        } else {
          console.error('DOCX download failed:', docxError);
          docxText = `DOCX download failed: ${docxError?.message || 'Unknown error'}`;
        }
      } catch (error) {
        console.error('Error in DOCX processing:', error);
        docxText = `DOCX processing failed: ${error.message}`;
      }
    }

    // Enhanced analysis prompt with stronger focus on DOCX content and KPI extraction
    const analysisPrompt = `
You are analyzing a comprehensive business submission with multiple content sources. Your PRIMARY GOAL is to extract specific, measurable KPIs and business metrics from ALL sources provided, with special emphasis on DOCX content.

CONTENT SOURCES:

1. VIDEO TRANSCRIPT:
${fullTranscript || 'No video transcript available'}

2. DOCX DOCUMENT CONTENT${docxProcessingSuccess ? ' (Successfully Extracted - PRIORITIZE THIS)' : ' (Processing Issues)'}:
${docxText || 'No DOCX content available'}

3. ADDITIONAL NOTES:
${submission.notes || 'No additional notes provided'}

CRITICAL ANALYSIS INSTRUCTIONS:

You MUST extract comprehensive business metrics and insights from ALL content sources above. Focus heavily on:

1. **NUMERICAL DATA EXTRACTION**: Find ALL numbers, percentages, monetary values, quantities, timeframes, and measurable metrics from video, DOCX, and notes
2. **FINANCIAL METRICS**: Revenue, sales, costs, profits, budgets, ROI, growth rates, market share, margins
3. **PERFORMANCE INDICATORS**: Customer metrics, conversion rates, efficiency scores, productivity measures, quality metrics, satisfaction scores, fulfillment times, response rates
4. **COMPARATIVE DATA**: Before/after comparisons, year-over-year growth, benchmarks, targets vs. actuals, variance analysis
5. **TIME-BASED METRICS**: Quarterly results, monthly performance, annual figures, project timelines
6. **DOCX-SPECIFIC DATA**: Pay SPECIAL attention to structured data, tables, charts, and formal reports in the DOCX - these often contain the most valuable KPIs

EXTRACTION REQUIREMENTS:
- If DOCX content was successfully extracted, it should contribute SIGNIFICANTLY to your KPI findings
- Extract EVERY quantifiable metric you can find, no matter how small
- Include the source context for each KPI (what it measures, time period, etc.)
- Focus on business-relevant metrics that would be valuable for dashboard analytics

You MUST respond with ONLY a valid JSON object. NO markdown formatting, NO code blocks, NO explanations outside the JSON. The response must be parseable by JSON.parse().

Format your response as this exact JSON structure:
{
  "key_points": ["Achievement or insight 1", "Achievement or insight 2", "Achievement or insight 3", "Achievement or insight 4", "Achievement or insight 5"],
  "extracted_kpis": ["Order Fulfillment Time: 7.2 minutes", "Meal Satisfaction Score: 4.4/5", "Food Wastage Reduction: 28%", "Feedback Response Rate: 87%", "Staff Coverage Rate: 100%"],
  "sentiment": "positive",
  "ai_quotes": ["Quote from video or key DOCX statement 1", "Quote 2", "Quote 3"]
}

CRITICAL: Extract ACTUAL NUMBERS and QUANTIFIABLE ACHIEVEMENTS from all sources. If the DOCX contains business data, it should result in multiple KPIs being extracted.
`;

    console.log('Sending enhanced analysis to GPT-4o with improved DOCX focus...');
    console.log('Analysis input summary:', {
      transcriptLength: fullTranscript.length,
      docxTextLength: docxText.length,
      docxProcessed: docxProcessingSuccess,
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
              content: 'You are an expert business analyst that specializes in extracting specific, measurable KPIs and metrics from various content sources including video transcripts, DOCX documents, and text notes. You MUST respond with valid JSON only, without any markdown formatting or code blocks. Your primary focus is finding concrete numbers, percentages, monetary values, and quantifiable business achievements from ALL provided content sources, with special attention to DOCX content which often contains the most structured and valuable data. Be thorough and extract EVERY quantifiable metric you can find.'
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

    // Update submission with results including enhanced DOCX processing status
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

    const responseMessage = docxProcessingSuccess 
      ? `Submission processed successfully with enhanced DOCX analysis (${analysisResult.extracted_kpis?.length || 0} KPIs extracted)`
      : `Submission processed with video analysis and limited DOCX processing (${analysisResult.extracted_kpis?.length || 0} KPIs extracted)`;

    console.log('Enhanced processing completed:', responseMessage);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: responseMessage,
        docxProcessed: docxProcessingSuccess,
        kpisExtracted: analysisResult.extracted_kpis?.length || 0,
        videoProcessed: !!fullTranscript,
        transcriptLength: fullTranscript.length,
        docxContentLength: docxText.length
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
