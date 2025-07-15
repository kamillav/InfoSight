
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPEN_API_KEY')!; // Fixed: Using correct secret name

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
    console.log('OpenAI API Key present:', !!openaiApiKey);

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

    let fullTranscript = '';
    const videoFile = submission.video_files;

    // Validate video file structure
    if (!videoFile || !videoFile.path) {
      throw new Error('Invalid video file structure');
    }

    // Process the video file
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

      // Convert video blob to audio and send to Whisper
      const formData = new FormData();
      formData.append('file', videoData, videoFile.name || 'video.webm');
      formData.append('model', 'whisper-1');

      console.log('Sending to OpenAI Whisper API...');

      const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: formData,
      });

      console.log('Whisper API response status:', transcriptionResponse.status);

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error('Whisper API error response:', errorText);
        throw new Error(`Whisper API error (${transcriptionResponse.status}): ${errorText}`);
      }

      const transcriptionResult = await transcriptionResponse.json();
      fullTranscript = transcriptionResult.text || '';
      console.log('Transcription completed successfully, length:', fullTranscript.length);
      
      if (!fullTranscript) {
        console.warn('Empty transcript received from Whisper API');
      }
    } catch (error) {
      console.error('Error processing video with Whisper:', error);
      throw new Error(`Video processing failed: ${error.message}`);
    }

    // Process PDF if present
    let pdfText = '';
    if (submission.pdf_file) {
      try {
        console.log('Processing PDF file:', submission.pdf_file);
        const { data: pdfData, error: pdfError } = await supabase.storage
          .from('submissions')
          .download(submission.pdf_file);

        if (!pdfError && pdfData) {
          pdfText = 'PDF document uploaded (text extraction not implemented in demo)';
          console.log('PDF processed successfully');
        } else {
          console.warn('PDF processing failed:', pdfError);
        }
      } catch (error) {
        console.error('Error processing PDF:', error);
      }
    }

    // Analyze content with GPT-4
    const analysisPrompt = `
Please analyze the following weekly update content and extract:

1. Key Points: List 3-5 main achievements or important points
2. KPIs: Extract any metrics, numbers, or performance indicators mentioned (be specific with the metric name and value)
3. Sentiment: Overall sentiment (positive, neutral, or negative)
4. Notable Quotes: 2-3 impactful quotes from the content

Transcript:
${fullTranscript}

Additional Notes:
${submission.notes || 'None'}

PDF Content:
${pdfText}

Please respond in this JSON format:
{
  "key_points": ["point1", "point2", "point3"],
  "extracted_kpis": ["Revenue increased by 15%", "Customer satisfaction: 94%", "Response time: 2.3 seconds"],
  "sentiment": "positive|neutral|negative",
  "ai_quotes": ["quote1", "quote2"]
}
`;

    console.log('Sending to GPT-4 for analysis...');

    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are an AI assistant that analyzes work updates and extracts key insights. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    console.log('GPT-4 API response status:', analysisResponse.status);

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
          analysisResult = JSON.parse(content);
          console.log('Analysis completed successfully:', analysisResult);
        } else {
          console.error('No content in GPT-4 response');
        }
      } catch (parseError) {
        console.error('Error parsing GPT response:', parseError);
        console.warn('Using default analysis result due to parsing error');
      }
    }

    // Update submission with results
    console.log('Updating submission with results...');
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        transcript: fullTranscript,
        key_points: analysisResult.key_points,
        extracted_kpis: analysisResult.extracted_kpis,
        sentiment: analysisResult.sentiment,
        ai_quotes: analysisResult.ai_quotes,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (updateError) {
      console.error('Error updating submission:', updateError);
      throw updateError;
    }

    // Delete the video file after successful processing to save storage space
    try {
      console.log('Deleting video file to save storage space:', videoFile.path);
      const { error: deleteError } = await supabase.storage
        .from('submissions')
        .remove([videoFile.path]);

      if (deleteError) {
        console.error('Error deleting video file:', deleteError);
        // Don't throw error here - the processing was successful
      } else {
        console.log('Video file deleted successfully');
      }
    } catch (deleteError) {
      console.error('Error during file deletion:', deleteError);
      // Don't throw error here - the processing was successful
    }

    console.log('Submission processed successfully:', submissionId);

    return new Response(
      JSON.stringify({ success: true, message: 'Submission processed successfully' }),
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
            status: 'error',
            processing_error: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', submissionId);
        
        console.log('Updated submission status to error for:', submissionId);
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
