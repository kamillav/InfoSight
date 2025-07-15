
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Target, Calendar } from 'lucide-react';

interface KPIVisualizationsProps {
  submissions: any[];
}

export const KPIVisualizations = ({ submissions }: KPIVisualizationsProps) => {
  // Process KPI data from submissions
  const processKPIData = () => {
    const kpiMap = new Map();
    const timelineData = [];
    
    submissions.forEach((submission) => {
      if (submission.extracted_kpis && submission.status === 'completed') {
        const date = new Date(submission.created_at).toLocaleDateString();
        
        submission.extracted_kpis.forEach((kpi: string) => {
          // Extract metric name and value
          const parts = kpi.split(':');
          if (parts.length >= 2) {
            const metricName = parts[0].trim();
            const value = parts[1].trim();
            
            // Try to extract numeric value
            const numericMatch = value.match(/[\d,]+\.?\d*/);
            const numericValue = numericMatch ? parseFloat(numericMatch[0].replace(/,/g, '')) : 1;
            
            if (kpiMap.has(metricName)) {
              kpiMap.set(metricName, kpiMap.get(metricName) + numericValue);
            } else {
              kpiMap.set(metricName, numericValue);
            }
          }
        });
        
        // Add to timeline
        timelineData.push({
          date,
          kpiCount: submission.extracted_kpis.length,
          sentiment: submission.sentiment
        });
      }
    });
    
    const kpiData = Array.from(kpiMap.entries()).map(([name, value]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      value: typeof value === 'number' ? value : 1,
      fullName: name
    }));
    
    return { kpiData, timelineData };
  };

  const { kpiData, timelineData } = processKPIData();
  
  // Sentiment distribution
  const sentimentData = submissions.reduce((acc, submission) => {
    if (submission.sentiment) {
      acc[submission.sentiment] = (acc[submission.sentiment] || 0) + 1;
    }
    return acc;
  }, {});
  
  const sentimentChartData = Object.entries(sentimentData).map(([sentiment, count]) => ({
    name: sentiment.charAt(0).toUpperCase() + sentiment.slice(1),
    value: count
  }));

  const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

  if (submissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            KPI Visualizations
          </CardTitle>
          <CardDescription>Upload videos to see KPI analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No KPI data available yet. Upload and process videos to see insights.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPI Values Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              KPI Metrics
            </CardTitle>
            <CardDescription>
              Quantified metrics extracted from your videos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpiData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name, props) => [
                      value, 
                      props.payload?.fullName || name
                    ]}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sentiment Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Analysis</CardTitle>
            <CardDescription>
              Overall sentiment distribution of your submissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sentimentChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {sentimentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            KPI Extraction Timeline
          </CardTitle>
          <CardDescription>
            Number of KPIs extracted over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="kpiCount" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{kpiData.length}</p>
                <p className="text-sm text-gray-600">Unique KPIs</p>
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
                  {submissions.reduce((acc, s) => acc + (s.extracted_kpis?.length || 0), 0)}
                </p>
                <p className="text-sm text-gray-600">Total KPIs Extracted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {submissions.filter(s => s.status === 'completed').length}
                </p>
                <p className="text-sm text-gray-600">Processed Videos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
