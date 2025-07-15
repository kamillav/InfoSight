import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WordCloudChart } from './charts/WordCloudChart';
import { KPIChart } from './charts/KPIChart';
import { SentimentChart } from './charts/SentimentChart';
import { AdminDashboard } from './AdminDashboard';
import { Users, TrendingUp, MessageSquare, BarChart3, Plus, Edit, Trash2, Target, Lightbulb, PieChart, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { Json } from '@/integrations/supabase/types';

interface KPIDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
  target_value?: number;
  unit?: string;
  is_active: boolean;
  created_at: string;
}

interface UserSubmission {
  id: string;
  user_id: string;
  created_at: string;
  status: string;
  sentiment?: string | null;
  key_points?: string[] | null;
  extracted_kpis?: string[] | null;
  ai_quotes?: string[] | null;
  video_files: Json;
  docx_file?: string | null;
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
  '#84cc16', // lime
  '#f43f5e', // rose
  '#14b8a6', // teal
  '#a855f7', // purple
  '#eab308', // yellow
];

export const AdminView = () => {
  const [kpis, setKpis] = useState<KPIDefinition[]>([]);
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [extractedKPIs, setExtractedKPIs] = useState<{kpi: string, count: number, submissions: string[], userBreakdown: Record<string, number>}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isKPIDialogOpen, setIsKPIDialogOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState<KPIDefinition | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [userColors, setUserColors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { user } = useAuth();

  // KPI form state
  const [kpiForm, setKpiForm] = useState({
    name: '',
    description: '',
    category: '',
    target_value: '',
    unit: ''
  });

  useEffect(() => {
    fetchAllData();
    
    // Set up real-time subscription for new submissions
    const channel = supabase
      .channel('admin-submissions-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions'
        },
        (payload) => {
          console.log('New submission received:', payload);
          // Refresh data when new submission is inserted
          fetchSubmissions();
          toast({
            title: "New submission received",
            description: "Dashboard data has been updated with new insights.",
          });
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
          console.log('Submission updated:', payload);
          // Refresh data when submission is updated (e.g., processing completed)
          fetchSubmissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAllData = async () => {
    try {
      await Promise.all([
        fetchKPIs(),
        fetchSubmissions(),
        fetchUsers()
      ]);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKPIs = async () => {
    const { data, error } = await supabase
      .from('kpi_definitions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching KPIs:', error);
      return;
    }

    setKpis(data || []);
  };

  const fetchSubmissions = async () => {
    // First fetch users to create a lookup map
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('*');

    if (usersError) {
      console.error('Error fetching users for submissions:', usersError);
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

    // Now fetch submissions
    const { data: submissionsData, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      return;
    }

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
        video_files: submission.video_files,
        docx_file: submission.docx_file,
        profiles: userProfile ? {
          name: userProfile.name,
          email: userProfile.email
        } : null
      };
    });

    setSubmissions(typedSubmissions);
    
    // Process extracted KPIs with enhanced integration and user breakdown
    const kpiMap = new Map<string, {count: number, submissions: string[], userBreakdown: Record<string, number>}>();
    
    typedSubmissions.forEach((submission: UserSubmission) => {
      if (submission.extracted_kpis && submission.status === 'completed') {
        const userEmail = submission.profiles?.email || 'Unknown User';
        submission.extracted_kpis.forEach((kpi: string) => {
          // Clean and normalize KPI names for better matching
          const cleanKpi = kpi.trim();
          if (kpiMap.has(cleanKpi)) {
            const existing = kpiMap.get(cleanKpi)!;
            existing.count += 1;
            existing.submissions.push(submission.id);
            existing.userBreakdown[userEmail] = (existing.userBreakdown[userEmail] || 0) + 1;
          } else {
            kpiMap.set(cleanKpi, { 
              count: 1, 
              submissions: [submission.id],
              userBreakdown: { [userEmail]: 1 }
            });
          }
        });
      }
    });

    const extractedKPIArray = Array.from(kpiMap.entries())
      .map(([kpi, data]) => ({ 
        kpi, 
        count: data.count, 
        submissions: data.submissions,
        userBreakdown: data.userBreakdown
      }))
      .sort((a, b) => b.count - a.count);

    setExtractedKPIs(extractedKPIArray);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    setUsers(data || []);
  };

  const handleCreateKPI = async () => {
    if (!kpiForm.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a KPI name.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('kpi_definitions')
        .insert({
          name: kpiForm.name,
          description: kpiForm.description || null,
          category: kpiForm.category || null,
          target_value: kpiForm.target_value ? parseFloat(kpiForm.target_value) : null,
          unit: kpiForm.unit || null,
          created_by: user!.id
        });

      if (error) throw error;

      toast({
        title: "KPI created",
        description: "The KPI has been successfully created.",
      });

      setKpiForm({ name: '', description: '', category: '', target_value: '', unit: '' });
      setIsKPIDialogOpen(false);
      fetchKPIs();
    } catch (error) {
      console.error('Error creating KPI:', error);
      toast({
        title: "Error creating KPI",
        description: "Failed to create the KPI. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCreateKPIFromExtracted = async (extractedKPI: string) => {
    // Parse the extracted KPI to separate name, value, and unit
    const parts = extractedKPI.split(':');
    let name = extractedKPI;
    let value = '';
    let unit = '';

    if (parts.length === 2) {
      name = parts[0].trim();
      const valueWithUnit = parts[1].trim();
      
      // Try to extract numeric value and unit
      const match = valueWithUnit.match(/^([\d.,]+)\s*(.*)$/);
      if (match) {
        value = match[1];
        unit = match[2] || '';
      }
    }

    setKpiForm({
      name,
      description: `Extracted from user submissions: ${extractedKPI}`,
      category: 'User Generated',
      target_value: value,
      unit
    });
    setEditingKPI(null);
    setIsKPIDialogOpen(true);
  };

  const handleUpdateKPI = async () => {
    if (!editingKPI || !kpiForm.name.trim()) return;

    try {
      const { error } = await supabase
        .from('kpi_definitions')
        .update({
          name: kpiForm.name,
          description: kpiForm.description || null,
          category: kpiForm.category || null,
          target_value: kpiForm.target_value ? parseFloat(kpiForm.target_value) : null,
          unit: kpiForm.unit || null
        })
        .eq('id', editingKPI.id);

      if (error) throw error;

      toast({
        title: "KPI updated",
        description: "The KPI has been successfully updated.",
      });

      setEditingKPI(null);
      setKpiForm({ name: '', description: '', category: '', target_value: '', unit: '' });
      setIsKPIDialogOpen(false);
      fetchKPIs();
    } catch (error) {
      console.error('Error updating KPI:', error);
      toast({
        title: "Error updating KPI",
        description: "Failed to update the KPI. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteKPI = async (kpiId: string) => {
    try {
      const { error } = await supabase
        .from('kpi_definitions')
        .update({ is_active: false })
        .eq('id', kpiId);

      if (error) throw error;

      toast({
        title: "KPI deactivated",
        description: "The KPI has been deactivated.",
      });

      fetchKPIs();
    } catch (error) {
      console.error('Error deactivating KPI:', error);
      toast({
        title: "Error deactivating KPI",
        description: "Failed to deactivate the KPI. Please try again.",
        variant: "destructive"
      });
    }
  };

  const openKPIDialog = (kpi?: KPIDefinition) => {
    if (kpi) {
      setEditingKPI(kpi);
      setKpiForm({
        name: kpi.name,
        description: kpi.description || '',
        category: kpi.category || '',
        target_value: kpi.target_value?.toString() || '',
        unit: kpi.unit || ''
      });
    } else {
      setEditingKPI(null);
      setKpiForm({ name: '', description: '', category: '', target_value: '', unit: '' });
    }
    setIsKPIDialogOpen(true);
  };

  const getSentimentColor = (sentiment: string | null | undefined) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserColor = (userId: string) => {
    return userColors[userId] || '#6b7280';
  };

  const filteredSubmissions = selectedUser === 'all' 
    ? submissions 
    : submissions.filter(s => s.user_id === selectedUser);

  const completedSubmissions = filteredSubmissions.filter(s => s.status === 'completed');
  const positiveSubmissions = completedSubmissions.filter(s => s.sentiment === 'positive');

  // Generate analytics data with integrated KPIs from dashboard with user colors
  const kpiMentions = completedSubmissions.reduce((acc: Record<string, {count: number, userBreakdown: Record<string, number>}>, submission) => {
    const userEmail = submission.profiles?.email || 'Unknown User';
    (submission.extracted_kpis || []).forEach(kpi => {
      if (!acc[kpi]) {
        acc[kpi] = { count: 0, userBreakdown: {} };
      }
      acc[kpi].count += 1;
      acc[kpi].userBreakdown[userEmail] = (acc[kpi].userBreakdown[userEmail] || 0) + 1;
    });
    return acc;
  }, {});

  const topKPIs = Object.entries(kpiMentions)
    .map(([name, data]) => ({ 
      name, 
      count: data.count,
      userBreakdown: data.userBreakdown
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15); // Show more KPIs

  // Enhanced sentiment analysis data - fix the interface mismatch
  const sentimentData = [
    { 
      date: new Date().toISOString(), 
      positive: completedSubmissions.length > 0 ? Math.round((positiveSubmissions.length / completedSubmissions.length) * 100) : 0,
      neutral: completedSubmissions.length > 0 ? Math.round((completedSubmissions.filter(s => s.sentiment === 'neutral').length / completedSubmissions.length) * 100) : 0,
      negative: completedSubmissions.length > 0 ? Math.round((completedSubmissions.filter(s => s.sentiment === 'negative').length / completedSubmissions.length) * 100) : 0
    }
  ];

  // Word cloud data from key points - fix the interface mismatch
  const wordCloudData = completedSubmissions
    .flatMap(s => s.key_points || [])
    .join(' ')
    .split(' ')
    .filter(word => word.length > 3)
    .reduce((acc: Record<string, number>, word) => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      acc[cleanWord] = (acc[cleanWord] || 0) + 1;
      return acc;
    }, {});

  const topWords = Object.entries(wordCloudData)
    .map(([word, frequency]) => ({ word, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 50);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced summary stats with real-time indicator */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
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
                <p className="text-2xl font-bold">{submissions.length}</p>
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
                <p className="text-2xl font-bold">{extractedKPIs.length}</p>
                <p className="text-sm text-gray-600">Unique KPIs Found</p>
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
                  {completedSubmissions.length > 0 
                    ? Math.round((positiveSubmissions.length / completedSubmissions.length) * 100) 
                    : 0}%
                </p>
                <p className="text-sm text-gray-600">Avg Positive Sentiment</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-2xl font-bold">{kpis.filter(k => k.is_active).length}</p>
                <p className="text-sm text-gray-600">Active KPIs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">
            <PieChart className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="overview">Enhanced Overview</TabsTrigger>
          <TabsTrigger value="extracted-kpis">AI Extracted KPIs</TabsTrigger>
          <TabsTrigger value="kpi-management">KPI Management</TabsTrigger>
          <TabsTrigger value="user-performance">User Performance</TabsTrigger>
          <TabsTrigger value="submissions">All Submissions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="space-y-6">
          <AdminDashboard />
        </TabsContent>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Top KPIs Across All Submissions (Color-Coded by User)
                </CardTitle>
                <CardDescription>Most frequently mentioned business metrics with user breakdown and real-time updates</CardDescription>
              </CardHeader>
              <CardContent>
                {topKPIs.length > 0 ? (
                  <KPIChart data={topKPIs} userColors={userColors} />
                ) : (
                  <p className="text-gray-500 text-center py-8">No KPI data available yet</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Sentiment Analysis Overview</CardTitle>
                <CardDescription>Distribution of sentiment across all submissions</CardDescription>
              </CardHeader>
              <CardContent>
                {sentimentData[0] && (sentimentData[0].positive > 0 || sentimentData[0].neutral > 0 || sentimentData[0].negative > 0) ? (
                  <SentimentChart data={sentimentData} />
                ) : (
                  <p className="text-gray-500 text-center py-8">No sentiment data available yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Key Insights Word Cloud</CardTitle>
                <CardDescription>Most mentioned words in key points</CardDescription>
              </CardHeader>
              <CardContent>
                {topWords.length > 0 ? (
                  <WordCloudChart data={topWords} />
                ) : (
                  <p className="text-gray-500 text-center py-8">No word data available yet</p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest submissions from team members</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {completedSubmissions.slice(0, 5).map((submission, index) => (
                    <div key={index} className="border-l-4 border-blue-500 pl-4">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getUserColor(submission.user_id) }}
                        />
                        <p className="text-sm font-medium">{submission.profiles?.name || 'Unknown User'}</p>
                      </div>
                      <p className="text-xs text-gray-500">{new Date(submission.created_at).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-700 mt-1">
                        {submission.key_points?.length || 0} insights • {submission.extracted_kpis?.length || 0} KPIs
                      </p>
                      {submission.sentiment && (
                        <Badge className={`text-xs mt-1 ${getSentimentColor(submission.sentiment)}`}>
                          {submission.sentiment}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {completedSubmissions.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No completed submissions yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="extracted-kpis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                AI Extracted KPIs from User Submissions (Color-Coded by User)
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchSubmissions}
                  className="ml-auto"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </CardTitle>
              <CardDescription>
                Review KPIs extracted by AI from user videos with user breakdown (Auto-updates with new submissions)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {extractedKPIs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No KPIs have been extracted from submissions yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {extractedKPIs.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{item.kpi}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Mentioned {item.count} time{item.count > 1 ? 's' : ''} across {item.submissions.length} submission{item.submissions.length > 1 ? 's' : ''}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(item.userBreakdown).map(([userEmail, count]) => {
                              const user = users.find(u => u.email === userEmail);
                              const userId = user?.id;
                              return (
                                <div key={userEmail} className="flex items-center gap-1">
                                  <div 
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: userId ? getUserColor(userId) : '#6b7280' }}
                                  />
                                  <span className="text-xs text-gray-600">
                                    {user?.name || userEmail}: {count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{item.count}x</Badge>
                          <Button
                            size="sm"
                            onClick={() => handleCreateKPIFromExtracted(item.kpi)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Target className="w-3 h-3 mr-1" />
                            Add as KPI
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="kpi-management" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">KPI Definitions</h3>
            <Dialog open={isKPIDialogOpen} onOpenChange={setIsKPIDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openKPIDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add KPI
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingKPI ? 'Edit KPI' : 'Create New KPI'}</DialogTitle>
                  <DialogDescription>
                    Define a key performance indicator for tracking team performance.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="kpi-name">Name *</Label>
                    <Input
                      id="kpi-name"
                      value={kpiForm.name}
                      onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                      placeholder="e.g., Customer Satisfaction Score"
                    />
                  </div>
                  <div>
                    <Label htmlFor="kpi-description">Description</Label>
                    <Textarea
                      id="kpi-description"
                      value={kpiForm.description}
                      onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                      placeholder="Describe what this KPI measures..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="kpi-category">Category</Label>
                      <Input
                        id="kpi-category"
                        value={kpiForm.category}
                        onChange={(e) => setKpiForm({ ...kpiForm, category: e.target.value })}
                        placeholder="e.g., Sales, Customer Success"
                      />
                    </div>
                    <div>
                      <Label htmlFor="kpi-unit">Unit</Label>
                      <Input
                        id="kpi-unit"
                        value={kpiForm.unit}
                        onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                        placeholder="e.g., %, $, points"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="kpi-target">Target Value</Label>
                    <Input
                      id="kpi-target"
                      type="number"
                      value={kpiForm.target_value}
                      onChange={(e) => setKpiForm({ ...kpiForm, target_value: e.target.value })}
                      placeholder="e.g., 95"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsKPIDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={editingKPI ? handleUpdateKPI : handleCreateKPI}>
                    {editingKPI ? 'Update' : 'Create'} KPI
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpis.map((kpi) => (
                    <TableRow key={kpi.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{kpi.name}</p>
                          {kpi.description && (
                            <p className="text-sm text-gray-600">{kpi.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{kpi.category || '-'}</TableCell>
                      <TableCell>
                        {kpi.target_value ? `${kpi.target_value}${kpi.unit || ''}` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={kpi.is_active ? 'default' : 'secondary'}>
                          {kpi.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openKPIDialog(kpi)}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          {kpi.is_active && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteKPI(kpi.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {kpis.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No KPIs defined yet. Create your first KPI to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="user-performance" className="space-y-6">
          <div className="flex items-center gap-4">
            <Label>Filter by user:</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{filteredSubmissions.length}</p>
                  <p className="text-sm text-gray-600">Total Submissions</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{completedSubmissions.length}</p>
                  <p className="text-sm text-gray-600">Completed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {filteredSubmissions.reduce((sum, s) => sum + (s.extracted_kpis?.length || 0), 0)}
                  </p>
                  <p className="text-sm text-gray-600">Total KPIs</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {completedSubmissions.length > 0 
                      ? Math.round((positiveSubmissions.length / completedSubmissions.length) * 100) 
                      : 0}%
                  </p>
                  <p className="text-sm text-gray-600">Positive Sentiment</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="submissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>All User Submissions</CardTitle>
              <CardDescription>Complete overview of team submissions and insights (Real-time updated)</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Key Points</TableHead>
                    <TableHead>KPIs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getUserColor(submission.user_id) }}
                          />
                          <div>
                            <p className="font-medium">{submission.profiles?.name || 'Unknown User'}</p>
                            <p className="text-sm text-gray-600">{submission.profiles?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(submission.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={submission.status === 'completed' ? 'default' : 'secondary'}>
                          {submission.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {submission.sentiment ? (
                          <Badge className={getSentimentColor(submission.sentiment)}>
                            {submission.sentiment}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{submission.key_points?.length || 0}</TableCell>
                      <TableCell>{submission.extracted_kpis?.length || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {submissions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No submissions yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
