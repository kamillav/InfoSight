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

// Enhanced function to clean JSON response from GPT
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Starting transcript reprocessing...');

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all completed submissions that have transcripts but might need KPI re-extraction
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .eq('status', 'completed')
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false });

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      throw submissionsError;
    }

    console.log(`Found ${submissions?.length || 0} completed submissions with transcripts`);

    let processedCount = 0;
    let updatedCount = 0;

    for (const submission of submissions || []) {
      try {
        console.log(`Processing submission ${submission.id}...`);

        // Check if this submission already has good KPI data
        const hasGoodKPIs = submission.extracted_kpis && submission.extracted_kpis.length > 0;
        
        // Get transcript text
        let transcriptText = '';
        if (typeof submission.transcript === 'string') {
          transcriptText = submission.transcript;
        } else if (submission.transcript && typeof submission.transcript === 'object') {
          transcriptText = JSON.stringify(submission.transcript);
        }

        if (!transcriptText || transcriptText.length < 50) {
          console.log(`Skipping submission ${submission.id} - insufficient transcript data`);
          continue;
        }

        // Enhanced analysis prompt focused on KPI extraction
        const analysisPrompt = `
You are analyzing a business submission transcript. Your PRIMARY GOAL is to extract specific, measurable KPIs and business metrics.

TRANSCRIPT CONTENT:
${transcriptText}

ADDITIONAL NOTES:
${submission.notes || 'No additional notes provided'}

CRITICAL ANALYSIS INSTRUCTIONS:

You MUST extract comprehensive business metrics and insights from the content above. Focus heavily on:

1. **NUMERICAL DATA EXTRACTION**: Find ALL numbers, percentages, monetary values, quantities, timeframes, and measurable metrics
2. **FINANCIAL METRICS**: Revenue, sales, costs, profits, budgets, ROI, growth rates, market share, margins, targets
3. **PERFORMANCE INDICATORS**: Customer metrics, conversion rates, efficiency scores, productivity measures, quality metrics, satisfaction scores, completion rates, response times
4. **COMPARATIVE DATA**: Before/after comparisons, year-over-year growth, benchmarks, targets vs. actuals, variance analysis
5. **TIME-BASED METRICS**: Quarterly results, monthly performance, annual figures, project timelines, deadlines
6. **OPERATIONAL METRICS**: Process improvements, cost savings, time reductions, quality improvements, customer feedback scores

EXTRACTION REQUIREMENTS:
- Extract EVERY quantifiable metric you can find, no matter how small
- Include the source context for each KPI (what it measures, time period, etc.)
- Focus on business-relevant metrics that would be valuable for dashboard analytics
- If you see any numbers, percentages, or measurable achievements, extract them as KPIs
- Even simple metrics like "completed 3 tasks" should become "Tasks Completed: 3"

You MUST respond with ONLY a valid JSON object. NO markdown formatting, NO code blocks, NO explanations outside the JSON.

Format your response as this exact JSON structure:
{
  "key_points": ["Specific achievement or insight 1", "Specific achievement or insight 2", "Specific achievement or insight 3", "Specific achievement or insight 4", "Specific achievement or insight 5"],
  "extracted_kpis": ["Metric Name: Specific Value with Units", "Another Metric: Quantified Result", "Performance Indicator: Measured Outcome", "Business Metric: Actual Number", "Achievement Metric: Concrete Result"],
  "sentiment": "positive|negative|neutral",
  "ai_quotes": ["Relevant quote from transcript 1", "Important statement 2", "Key insight 3"]
}

CRITICAL: Extract ACTUAL NUMBERS and QUANTIFIABLE ACHIEVEMENTS. If there are any metrics, percentages, or measurable outcomes mentioned in the transcript, they MUST be extracted as KPIs. DO NOT return empty arrays unless there are truly no quantifiable metrics in the content.
`;

        console.log(`Sending analysis for submission ${submission.id} to GPT-4o...`);

        const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
                content: 'You are an expert business analyst that specializes in extracting specific, measurable KPIs and metrics from transcripts. You MUST respond with valid JSON only, without any markdown formatting or code blocks. Your primary focus is finding concrete numbers, percentages, monetary values, and quantifiable business achievements. You should extract EVERY quantifiable metric you find, no matter how small. Be thorough and aggressive in finding metrics - even simple accomplishments should be quantified.'
              },
              {
                role: 'user',
                content: analysisPrompt
              }
            ],
            temperature: 0.1,
          }),
        });

        let analysisResult = {
          key_points: hasGoodKPIs ? submission.key_points : ['Content reprocessed successfully'],
          extracted_kpis: hasGoodKPIs ? submission.extracted_kpis : [],
          sentiment: submission.sentiment || 'neutral',
          ai_quotes: submission.ai_quotes || []
        };

        if (!analysisResponse.ok) {
          const errorText = await analysisResponse.text();
          console.error(`GPT-4o API error for submission ${submission.id}:`, errorText);
          
          // If we have good existing KPIs, don't overwrite them
          if (hasGoodKPIs) {
            console.log(`Keeping existing KPIs for submission ${submission.id}`);
            processedCount++;
            continue;
          }
        } else {
          try {
            const gptResponse = await analysisResponse.json();
            const content = gptResponse.choices[0]?.message?.content;
            if (content) {
              console.log(`Raw GPT response for ${submission.id}:`, content.substring(0, 200) + '...');
              
              // Clean the JSON response to remove any markdown formatting
              const cleanedContent = cleanJsonResponse(content);
              console.log(`Cleaned content for ${submission.id}:`, cleanedContent.substring(0, 200) + '...');
              
              const newAnalysisResult = JSON.parse(cleanedContent);
              
              // Only update if we got better results or if we didn't have good KPIs before
              if (!hasGoodKPIs || (newAnalysisResult.extracted_kpis?.length > (submission.extracted_kpis?.length || 0))) {
                analysisResult = newAnalysisResult;
                console.log(`New analysis for ${submission.id}:`, {
                  keyPointsCount: analysisResult.key_points?.length || 0,
                  kpisCount: analysisResult.extracted_kpis?.length || 0,
                  sentiment: analysisResult.sentiment,
                  quotesCount: analysisResult.ai_quotes?.length || 0
                });
              } else {
                console.log(`Keeping existing better KPIs for submission ${submission.id}`);
              }
            }
          } catch (parseError) {
            console.error(`Error parsing GPT response for ${submission.id}:`, parseError);
            // Keep existing data if we can't parse new results
            if (hasGoodKPIs) {
              console.log(`Keeping existing KPIs due to parse error for submission ${submission.id}`);
              processedCount++;
              continue;
            }
          }
        }

        // Update submission with results
        const updateData = {
          key_points: analysisResult.key_points,
          extracted_kpis: analysisResult.extracted_kpis,
          sentiment: analysisResult.sentiment,
          ai_quotes: analysisResult.ai_quotes,
          updated_at: new Date().toISOString(),
        };

        console.log(`Updating submission ${submission.id} with:`, {
          keyPointsCount: analysisResult.key_points?.length,
          kpisCount: analysisResult.extracted_kpis?.length,
          sentiment: analysisResult.sentiment
        });

        const { error: updateError } = await supabase
          .from('submissions')
          .update(updateData)
          .eq('id', submission.id);

        if (updateError) {
          console.error(`Error updating submission ${submission.id}:`, updateError);
        } else {
          console.log(`Successfully updated submission ${submission.id}`);
          updatedCount++;
        }

        processedCount++;

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing submission ${submission.id}:`, error);
        // Continue with next submission
      }
    }

    console.log(`Reprocessing completed: ${processedCount} processed, ${updatedCount} updated`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reprocessing completed: ${processedCount} submissions processed, ${updatedCount} updated`,
        processedCount,
        updatedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transcript reprocessing:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
