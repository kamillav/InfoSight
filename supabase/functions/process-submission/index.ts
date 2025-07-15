
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get submission details
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      throw new Error('Submission not found');
    }

    console.log('Processing submission:', submissionId);

    let fullTranscript = '';
    const videoFile = submission.video_files as { path: string; name: string };

    // Process the video file
    try {
      console.log('Downloading video from:', videoFile.path);
      
      // Download video from storage
      const { data: videoData, error: downloadError } = await supabase.storage
        .from('submissions')
        .download(videoFile.path);

      if (downloadError || !videoData) {
        console.error('Error downloading video:', downloadError);
        throw new Error('Failed to download video file');
      }

      console.log('Video downloaded, size:', videoData.size);

      // Convert video blob to audio and send to Whisper
      const formData = new FormData();
      formData.append('file', videoData, 'video.webm');
      formData.append('model', 'whisper-1');

      console.log('Sending to OpenAI Whisper...');

      const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: formData,
      });

      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error('Whisper API error:', errorText);
        throw new Error(`Whisper API error: ${errorText}`);
      }

      const transcriptionResult = await transcriptionResponse.json();
      fullTranscript = transcriptionResult.text;
      console.log('Transcription completed, length:', fullTranscript.length);
    } catch (error) {
      console.error('Error processing video:', error);
      throw error;
    }

    // Process PDF if present
    let pdfText = '';
    if (submission.pdf_file) {
      try {
        const { data: pdfData, error: pdfError } = await supabase.storage
          .from('submissions')
          .download(submission.pdf_file);

        if (!pdfError && pdfData) {
          // For now, we'll just note that PDF was uploaded
          // In a production app, you'd use a PDF parsing library
          pdfText = 'PDF document uploaded (text extraction not implemented in demo)';
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
            content: 'You are an AI assistant that analyzes work updates and extracts key insights. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
      }),
    });

    let analysisResult = {
      key_points: ['Content processed successfully'],
      extracted_kpis: [],
      sentiment: 'neutral',
      ai_quotes: []
    };

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('GPT-4 API error:', errorText);
    } else {
      const gptResponse = await analysisResponse.json();
      try {
        analysisResult = JSON.parse(gptResponse.choices[0].message.content);
        console.log('Analysis completed:', analysisResult);
      } catch (parseError) {
        console.error('Error parsing GPT response:', parseError);
      }
    }

    // Update submission with results
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
      throw updateError;
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
      const { submissionId } = await req.json();
      
      if (submissionId) {
        await supabase
          .from('submissions')
          .update({
            status: 'error',
            processing_error: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', submissionId);
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
