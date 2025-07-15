
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, TrendingUp, MessageSquare, Quote } from 'lucide-react';

interface Submission {
  id: string;
  date: string;
  transcript: string;
  keyPoints: string[];
  kpis: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  quotes: string[];
}

interface InsightsViewProps {
  userId: string;
}

export const InsightsView = ({ userId }: InsightsViewProps) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      // Mock data - in real app, this would fetch from database
      const mockSubmissions: Submission[] = [
        {
          id: '1',
          date: '2024-01-15',
          transcript: 'This week I focused on improving our lead generation process. We implemented a new qualification framework that resulted in 25% higher conversion rates. The team collaborated effectively on the new CRM integration, and we saw immediate improvements in lead quality and tracking accuracy.',
          keyPoints: [
            'Implemented new lead qualification framework',
            'Achieved 25% improvement in conversion rates',
            'Successful CRM integration and team collaboration'
          ],
          kpis: ['Conversion Rate', 'Lead Quality', 'Team Collaboration'],
          sentiment: 'positive',
          quotes: [
            'We implemented a new qualification framework that resulted in 25% higher conversion rates',
            'The team collaborated effectively on the new CRM integration'
          ]
        },
        {
          id: '2',
          date: '2024-01-08',
          transcript: 'Had some challenges this week with the client onboarding process. The new system had a few bugs that caused delays, but we managed to resolve them quickly. Despite the initial setbacks, we maintained our customer satisfaction scores and learned valuable lessons for future implementations.',
          keyPoints: [
            'Resolved system bugs in onboarding process',
            'Maintained customer satisfaction despite challenges',
            'Gained valuable implementation insights'
          ],
          kpis: ['Customer Satisfaction', 'System Reliability', 'Response Time'],
          sentiment: 'neutral',
          quotes: [
            'We managed to resolve them quickly',
            'Maintained our customer satisfaction scores'
          ]
        }
      ];
      
      setTimeout(() => {
        setSubmissions(mockSubmissions);
        setLoading(false);
      }, 1000);
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
                  {Math.round((submissions.filter(s => s.sentiment === 'positive').length / submissions.length) * 100)}%
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
                <Badge className={getSentimentColor(submission.sentiment)}>
                  {submission.sentiment}
                </Badge>
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
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm leading-relaxed">{submission.transcript}</p>
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
                        <p className="text-sm italic text-gray-700">"{quote}"</p>
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
