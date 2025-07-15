import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { TrendingUp, Target, Users, MessageSquare, Calendar, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ReprocessTranscriptsButton } from './ReprocessTranscriptsButton';

interface UserSubmission {
  id: string;
  user_id: string;
  created_at: string;
  status: string;
  sentiment?: string | null;
  key_points?: string[] | null;
  extracted_kpis?: string[] | null;
  ai_quotes?: string[] | null;
  profiles?: {
    name: string;
    email: string;
  } | null;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

// Predefined colors for consistent user identification
const USER_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#10b981', // emerald
  '#f97316', // orange
  '#6366f1', // indigo
];

export const AdminDashboard = () => {
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('all');
  const [userColors, setUserColors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDashboardData();
    
    // Set up real-time subscription for new submissions
    const channel = supabase
      .channel('admin-dashboard-submissions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions'
        },
        (payload) => {
          console.log('New submission received in dashboard:', payload);
          fetchDashboardData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'submissions'
        },
        (payload) => {
          console.log('Submission updated in dashboard:', payload);
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // First fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (usersError) {
        console.error('Error fetching users for dashboard:', usersError);
        return;
      }

      // Create user lookup map and assign colors
      const userMap = new Map<string, UserProfile>();
      const colors: Record<string, string> = {};
      (usersData || []).forEach((user, index) => {
        userMap.set(user.id, user);
        colors[user.id] = USER_COLORS[index % USER_COLORS.length];
      });
      setUserColors(colors);

      // Fetch ALL completed submissions (not filtered by user) - this should work for admins
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (submissionsError) {
        console.error('Error fetching all submissions for dashboard:', submissionsError);
        return;
      }

      console.log('Fetched submissions for dashboard:', submissionsData?.length || 0);

      // Manually join submissions with profiles using the lookup map
      const typedSubmissions: UserSubmission[] = (submissionsData || []).map(submission => {
        const userProfile = userMap.get(submission.user_id);
        return {
          id: submission.id,
          user_id: submission.user_id,
          created_at: submission.created_at,
          status: submission.status,
          sentiment: submission.sentiment,
          key_points: submission.key_points,
          extracted_kpis: submission.extracted_kpis,
          ai_quotes: submission.ai_quotes,
          profiles: userProfile ? {
            name: userProfile.name,
            email: userProfile.email
          } : null
        };
      });

      console.log('Processed submissions with user profiles:', typedSubmissions.length);
      setSubmissions(typedSubmissions);
      setUsers(usersData || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter submissions based on timeframe
  const filteredSubmissions = submissions.filter(submission => {
    if (selectedTimeframe === 'all') return true;
    
    const submissionDate = new Date(submission.created_at);
    const now = new Date();
    
    switch (selectedTimeframe) {
      case '7d':
        return submissionDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return submissionDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return submissionDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return true;
    }
  });

  // Process KPI data with user identification
  const processKPIData = () => {
    const kpiMap = new Map<string, { total: number; users: Record<string, number> }>();
    
    filteredSubmissions.forEach(submission => {
      if (submission.extracted_kpis) {
        submission.extracted_kpis.forEach(kpi => {
          const kpiName = kpi.split(':')[0].trim();
          const userId = submission.user_id;
          
          if (!kpiMap.has(kpiName)) {
            kpiMap.set(kpiName, { total: 0, users: {} });
          }
          
          const kpiData = kpiMap.get(kpiName)!;
          kpiData.total += 1;
          kpiData.users[userId] = (kpiData.users[userId] || 0) + 1;
        });
      }
    });

    return Array.from(kpiMap.entries())
      .map(([kpi, data]) => ({
        name: kpi.length > 20 ? kpi.substring(0, 20) + '...' : kpi,
        fullName: kpi,
        total: data.total,
        ...Object.fromEntries(
          Object.entries(data.users).map(([userId, count]) => [
            users.find(u => u.id === userId)?.email || userId,
            count
          ])
        )
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  };

  // Timeline data with user breakdown
  const processTimelineData = () => {
    const timelineMap = new Map<string, Record<string, number>>();
    
    filteredSubmissions.forEach(submission => {
      const date = new Date(submission.created_at).toLocaleDateString();
      const userId = submission.user_id;
      const userEmail = submission.profiles?.email || 'Unknown';
      
      if (!timelineMap.has(date)) {
        timelineMap.set(date, {});
      }
      
      const dayData = timelineMap.get(date)!;
      dayData[userEmail] = (dayData[userEmail] || 0) + (submission.extracted_kpis?.length || 0);
    });

    return Array.from(timelineMap.entries())
      .map(([date, userData]) => ({
        date,
        total: Object.values(userData).reduce((sum, count) => sum + count, 0),
        ...userData
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Last 30 days
  };

  // User performance summary
  const processUserPerformance = () => {
    const userStats = users.map(user => {
      const userSubmissions = filteredSubmissions.filter(s => s.user_id === user.id);
      const totalKPIs = userSubmissions.reduce((sum, s) => sum + (s.extracted_kpis?.length || 0), 0);
      const totalKeyPoints = userSubmissions.reduce((sum, s) => sum + (s.key_points?.length || 0), 0);
      const positiveSubmissions = userSubmissions.filter(s => s.sentiment === 'positive').length;
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        submissions: userSubmissions.length,
        kpis: totalKPIs,
        keyPoints: totalKeyPoints,
        positiveRate: userSubmissions.length > 0 ? Math.round((positiveSubmissions / userSubmissions.length) * 100) : 0,
        color: userColors[user.id] || '#6b7280'
      };
    }).filter(user => user.submissions > 0);

    return userStats;
  };

  const kpiData = processKPIData();
  const timelineData = processTimelineData();
  const userPerformance = processUserPerformance();
  const userEmails = Array.from(new Set(filteredSubmissions.map(s => s.profiles?.email).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Admin Dashboard - All User Submissions</h2>
        <div className="flex items-center gap-4">
          <ReprocessTranscriptsButton />
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{userPerformance.length}</p>
                <p className="text-sm text-gray-600">Active Contributors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{filteredSubmissions.length}</p>
                <p className="text-sm text-gray-600">Total Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {filteredSubmissions.reduce((sum, s) => sum + (s.extracted_kpis?.length || 0), 0)}
                </p>
                <p className="text-sm text-gray-600">Total KPIs Extracted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {filteredSubmissions.length > 0 
                    ? Math.round((filteredSubmissions.filter(s => s.sentiment === 'positive').length / filteredSubmissions.length) * 100) 
                    : 0}%
                </p>
                <p className="text-sm text-gray-600">Positive Sentiment</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Legend */}
      <Card>
        <CardHeader>
          <CardTitle>User Color Legend</CardTitle>
          <CardDescription>Color identification for all charts and analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {userPerformance.map(user => (
              <div key={user.id} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border"
                  style={{ backgroundColor: user.color }}
                />
                <div className="text-sm">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-gray-600">{user.email}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPI Distribution by User */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Top KPIs by User
            </CardTitle>
            <CardDescription>Most mentioned KPIs with user breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
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
                    formatter={(value, name) => [value, name]}
                    labelFormatter={(label) => kpiData.find(d => d.name === label)?.fullName || label}
                  />
                  <Legend />
                  {userEmails.map((email, index) => (
                    <Bar 
                      key={email} 
                      dataKey={email} 
                      stackId="users"
                      fill={USER_COLORS[index % USER_COLORS.length]}
                      name={email}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* KPI Timeline by User */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              KPI Extraction Timeline
            </CardTitle>
            <CardDescription>Daily KPI extraction trends by user</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {userEmails.map((email, index) => (
                    <Line 
                      key={email}
                      type="monotone" 
                      dataKey={email} 
                      stroke={USER_COLORS[index % USER_COLORS.length]}
                      strokeWidth={2}
                      dot={{ fill: USER_COLORS[index % USER_COLORS.length], strokeWidth: 2, r: 3 }}
                      name={email}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Performance Summary</CardTitle>
          <CardDescription>Detailed performance metrics for each contributor</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Submissions</th>
                  <th className="text-left p-2">KPIs Extracted</th>
                  <th className="text-left p-2">Key Points</th>
                  <th className="text-left p-2">Positive Rate</th>
                </tr>
              </thead>
              <tbody>
                {userPerformance.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: user.color }}
                        />
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge variant="secondary">{user.submissions}</Badge>
                    </td>
                    <td className="p-2">
                      <Badge variant="default">{user.kpis}</Badge>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline">{user.keyPoints}</Badge>
                    </td>
                    <td className="p-2">
                      <Badge 
                        variant={user.positiveRate >= 70 ? "default" : user.positiveRate >= 40 ? "secondary" : "destructive"}
                      >
                        {user.positiveRate}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
