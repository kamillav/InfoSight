
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, TrendingUp, MessageSquare, Quote, FileText } from 'lucide-react';

interface Submission {
  id: string;
  userId: string;
  userName: string;
  date: string;
  videoFile: string;
  pdfFile?: string | null;
  notes: string;
  transcript: string;
  keyPoints: string[];
  kpis: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  quotes: string[];
  processed: boolean;
}

interface InsightsViewProps {
  userId: string;
}

export const InsightsView = ({ userId }: InsightsViewProps) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        // Get submissions from localStorage (will be replaced with Supabase)
        const allSubmissions = JSON.parse(localStorage.getItem('infosight_submissions') || '[]');
        
        // Filter submissions for current user
        const userSubmissions = allSubmissions.filter((sub: Submission) => sub.userId === userId);
        
        console.log('Fetched user submissions:', userSubmissions);
        setSubmissions(userSubmissions);
      } catch (error) {
        console.error('Error fetching submissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [userId]);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
          <p className="text-gray-600">Upload your first video to see insights here.</p>
        </div>
      </div>
    );
  }

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
                  {submissions.length > 0 ? Math.round((submissions.filter(s => s.sentiment === 'positive').length / submissions.length) * 100) : 0}%
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
                <p className="text-2xl font-bold">
                  {submissions.reduce((acc, s) => acc + s.keyPoints.length, 0)}
                </p>
                <p className="text-sm text-gray-600">Key Insights</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {submissions.map((submission) => (
          <Card key={submission.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Submission - {new Date(submission.date).toLocaleDateString()}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {submission.pdfFile && (
                    <Badge variant="outline" className="text-xs">
                      <FileText className="w-3 h-3 mr-1" />
                      PDF Included
                    </Badge>
                  )}
                  <Badge className={getSentimentColor(submission.sentiment)}>
                    {submission.sentiment}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="transcript" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="insights">Key Points</TabsTrigger>
                  <TabsTrigger value="kpis">KPIs</TabsTrigger>
                  <TabsTrigger value="quotes">Quotes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="transcript" className="mt-4">
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm leading-relaxed">{submission.transcript}</p>
                    </div>
                    {submission.notes && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-sm mb-2">Additional Notes:</h4>
                        <p className="text-sm text-gray-700">{submission.notes}</p>
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      <p>Video: {submission.videoFile}</p>
                      {submission.pdfFile && <p>PDF: {submission.pdfFile}</p>}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="insights" className="mt-4">
                  <div className="space-y-2">
                    {submission.keyPoints.map((point, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <p className="text-sm">{point}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="kpis" className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {submission.kpis.map((kpi, index) => (
                      <Badge key={index} variant="outline">
                        {kpi}
                      </Badge>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="quotes" className="mt-4">
                  <div className="space-y-3">
                    {submission.quotes.map((quote, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Quote className="w-4 h-4 text-gray-400 mt-0.5" />
                        <p className="text-sm italic text-gray-700">{quote}</p>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
