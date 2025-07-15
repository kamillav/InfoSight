
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WordCloudChart } from './charts/WordCloudChart';
import { KPIChart } from './charts/KPIChart';
import { SentimentChart } from './charts/SentimentChart';
import { Users, TrendingUp, MessageSquare, BarChart3 } from 'lucide-react';

interface AdminData {
  totalUsers: number;
  totalSubmissions: number;
  avgSentiment: number;
  topKPIs: Array<{ name: string; count: number }>;
  userQuotes: Array<{
    user: string;
    quote: string;
    kpis: string[];
    date: string;
    sentiment: string;
  }>;
  wordFrequency: Array<{ word: string; frequency: number }>;
  sentimentTrend: Array<{ date: string; positive: number; neutral: number; negative: number }>;
}

export const AdminView = () => {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      // Mock admin data - in real app, this would fetch aggregated data from database
      const mockData: AdminData = {
        totalUsers: 15,
        totalSubmissions: 42,
        avgSentiment: 75,
        topKPIs: [
          { name: 'Conversion Rate', count: 12 },
          { name: 'Lead Quality', count: 10 },
          { name: 'Customer Satisfaction', count: 8 },
          { name: 'Team Collaboration', count: 7 },
          { name: 'Response Time', count: 5 }
        ],
        userQuotes: [
          {
            user: 'John Doe',
            quote: 'We implemented a new qualification framework that resulted in 25% higher conversion rates',
            kpis: ['Conversion Rate', 'Lead Quality'],
            date: '2024-01-15',
            sentiment: 'positive'
          },
          {
            user: 'Jane Smith',
            quote: 'The team collaborated effectively on the new CRM integration',
            kpis: ['Team Collaboration', 'System Integration'],
            date: '2024-01-14',
            sentiment: 'positive'
          },
          {
            user: 'Mike Johnson',
            quote: 'Maintained our customer satisfaction scores despite initial challenges',
            kpis: ['Customer Satisfaction', 'Problem Resolution'],
            date: '2024-01-13',
            sentiment: 'neutral'
          }
        ],
        wordFrequency: [
          { word: 'improvement', frequency: 15 },
          { word: 'team', frequency: 12 },
          { word: 'customer', frequency: 10 },
          { word: 'quality', frequency: 8 },
          { word: 'process', frequency: 7 },
          { word: 'collaboration', frequency: 6 },
          { word: 'conversion', frequency: 5 },
          { word: 'satisfaction', frequency: 4 }
        ],
        sentimentTrend: [
          { date: '2024-01-08', positive: 60, neutral: 30, negative: 10 },
          { date: '2024-01-15', positive: 75, neutral: 20, negative: 5 },
          { date: '2024-01-22', positive: 80, neutral: 15, negative: 5 }
        ]
      };
      
      setTimeout(() => {
        setData(mockData);
        setLoading(false);
      }, 1000);
    };

    fetchAdminData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) return null;

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{data.totalUsers}</p>
                <p className="text-sm text-gray-600">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{data.totalSubmissions}</p>
                <p className="text-sm text-gray-600">Total Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{data.avgSentiment}%</p>
                <p className="text-sm text-gray-600">Avg Positive Sentiment</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{data.topKPIs.length}</p>
                <p className="text-sm text-gray-600">Tracked KPIs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="wordcloud">Word Cloud</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment Trend</TabsTrigger>
          <TabsTrigger value="quotes">User Quotes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Mentioned KPIs</CardTitle>
                <CardDescription>Most frequently mentioned business metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <KPIChart data={data.topKPIs} />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest submissions from team members</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.userQuotes.slice(0, 3).map((quote, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <p className="text-sm font-medium">{quote.user}</p>
                      <p className="text-xs text-gray-500">{new Date(quote.date).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-700 mt-1 italic">"{quote.quote}"</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="wordcloud" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Word Cloud Analysis</CardTitle>
              <CardDescription>Most frequently used terms across all submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <WordCloudChart data={data.wordFrequency} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sentiment" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Trend Over Time</CardTitle>
              <CardDescription>Team sentiment analysis across weekly submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <SentimentChart data={data.sentimentTrend} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="quotes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Quotes with KPIs</CardTitle>
              <CardDescription>Key insights and associated business metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Quote</TableHead>
                    <TableHead>KPIs</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.userQuotes.map((quote, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{quote.user}</TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm italic">"{quote.quote}"</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {quote.kpis.map((kpi, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {kpi}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getSentimentColor(quote.sentiment)}>
                          {quote.sentiment}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(quote.date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
