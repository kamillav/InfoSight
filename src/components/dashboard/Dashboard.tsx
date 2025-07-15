
import { useState } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { VideoUpload } from './VideoUpload';
import { InsightsView } from './InsightsView';
import { AdminView } from './AdminView';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const Dashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('upload');

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.name}
          </h1>
          <p className="text-gray-600">
            Share your weekly insights and track your impact
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="upload">Upload Video</TabsTrigger>
            <TabsTrigger value="insights">My Insights</TabsTrigger>
            {user.role === 'admin' && (
              <TabsTrigger value="admin">Admin View</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <VideoUpload />
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <InsightsView userId={user.id} />
          </TabsContent>

          {user.role === 'admin' && (
            <TabsContent value="admin" className="space-y-6">
              <AdminView />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};
