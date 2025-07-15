import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, TrendingUp, MessageSquare, Quote, FileText, Clock, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { KPIVisualizations } from './KPIVisualizations';
import type { Json } from '@/integrations/supabase/types';

interface Submission {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  video_files: Json;
  pdf_file?: string | null;
  notes: string | null;
  transcript: Json | null;
  key_points: string[] | null;
  extracted_kpis: string[] | null;
  sentiment: string | null;
  ai_quotes: string[] | null;
  status: string;
  processing_error?: string | null;
}

interface InsightsViewProps {
  userId: string;
}

export const InsightsView = ({ userId }: InsightsViewProps) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        console.log('Fetching submissions for user:', userId);
        
        const { data, error } = await supabase
          .from('submissions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching submissions:', error);
          toast({
            title: "Error loading submissions",
            description: "Failed to load your submissions. Please try again.",
            variant: "destructive"
          });
          return;
        }

        console.log('Fetched submissions:', data);
        setSubmissions((data as Submission[]) || []);
      } catch (error) {
        console.error('Error fetching submissions:', error);
        toast({
          title: "Error loading submissions",
          description: "Failed to load your submissions. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchSubmissions();
    }
  }, [userId, toast]);

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      case 'neutral': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVideoFiles = (videoFiles: Json): string[] => {
    if (Array.isArray(videoFiles)) {
      return videoFiles as string[];
    }
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h3>
          <p className="text-gray-600">Upload your first videos to see insights here.</p>
        </div>
      </div>
    );
  }

  const completedSubmissions = submissions.filter(s => s.status === 'completed');
  const positiveSubmissions = completedSubmissions.filter(s => s.sentiment === 'positive');
  const totalKeyPoints = completedSubmissions.reduce((acc, s) => acc + (s.key_points?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{submissions.length}</p>
                <p className="text-sm text-gray-600">Total Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {completedSubmissions.length > 0 
                    ? Math.round((positiveSubmissions.length / completedSubmissions.length) * 100) 
                    : 0}%
                </p>
                <p className="text-sm text-gray-600">Positive Sentiment</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{totalKeyPoints}</p>
                <p className="text-sm text-gray-600">Key Insights</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="visualizations" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visualizations" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            KPI Analytics
          </TabsTrigger>
          <TabsTrigger value="submissions" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Submission Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visualizations" className="space-y-6">
          <KPIVisualizations submissions={completedSubmissions} />
        </TabsContent>

        <TabsContent value="submissions" className="space-y-6">
          {submissions.map((submission) => (
            <Card key={submission.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Submission - {new Date(submission.created_at).toLocaleDateString()}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(submission.status)}>
                      {submission.status === 'processing' && <Clock className="w-3 h-3 mr-1" />}
                      {submission.status}
                    </Badge>
                    {submission.pdf_file && (
                      <Badge variant="outline" className="text-xs">
                        <FileText className="w-3 h-3 mr-1" />
                        PDF Included
                      </Badge>
                    )}
                    {submission.sentiment && (
                      <Badge className={getSentimentColor(submission.sentiment)}>
                        {submission.sentiment}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {submission.status === 'processing' ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-gray-600">Processing your submission...</p>
                      <p className="text-sm text-gray-500 mt-1">This may take up to 10 minutes</p>
                    </div>
                  </div>
                ) : submission.status === 'error' ? (
                  <div className="text-center py-8">
                    <div className="text-red-600 mb-2">
                      {submission.processing_error?.includes('timed out') ? 'Processing Timed Out' : 'Processing Failed'}
                    </div>
                    {submission.processing_error && (
                      <p className="text-sm text-gray-600">{submission.processing_error}</p>
                    )}
                  </div>
                ) : (
                  <Tabs defaultValue="transcript" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="transcript">Transcript</TabsTrigger>
                      <TabsTrigger value="insights">Key Points</TabsTrigger>
                      <TabsTrigger value="kpis">KPIs</TabsTrigger>
                      <TabsTrigger value="quotes">Quotes</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="transcript" className="mt-4">
                      <div className="space-y-4">
                        {submission.transcript ? (
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm leading-relaxed">
                              {typeof submission.transcript === 'string' 
                                ? submission.transcript 
                                : JSON.stringify(submission.transcript)}
                            </p>
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">Transcript not available</p>
                          </div>
                        )}
                        {submission.notes && (
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <h4 className="font-medium text-sm mb-2">Additional Notes:</h4>
                            <p className="text-sm text-gray-700">{submission.notes}</p>
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          <p>Video: {submission.video_files?.name || 'Unknown'}</p>
                          {submission.pdf_file && <p>PDF: Document included</p>}
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="insights" className="mt-4">
                      <div className="space-y-2">
                        {submission.key_points && submission.key_points.length > 0 ? (
                          submission.key_points.map((point, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                              <p className="text-sm">{point}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No key points extracted yet</p>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="kpis" className="mt-4">
                      <div className="space-y-2">
                        {submission.extracted_kpis && submission.extracted_kpis.length > 0 ? (
                          submission.extracted_kpis.map((kpi, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Badge variant="outline" className="text-sm">
                                {kpi}
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No KPIs extracted yet</p>
                        )}
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="quotes" className="mt-4">
                      <div className="space-y-3">
                        {submission.ai_quotes && submission.ai_quotes.length > 0 ? (
                          submission.ai_quotes.map((quote, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <Quote className="w-4 h-4 text-gray-400 mt-0.5" />
                              <p className="text-sm italic text-gray-700">{quote}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No quotes extracted yet</p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};
