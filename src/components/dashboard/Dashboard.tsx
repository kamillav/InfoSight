
import { useState } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { VideoUpload } from './VideoUpload';
import { InsightsView } from './InsightsView';
import { AdminView } from './AdminView';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const Dashboard = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('upload');

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {profile.name}
          </h1>
          <p className="text-gray-600">
            Create a meaningful impact for Infosys with Infosight analytics platform
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md bg-white shadow-sm border border-gray-200">
            <TabsTrigger 
              value="upload" 
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Upload Content
            </TabsTrigger>
            <TabsTrigger 
              value="insights"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              My Insights
            </TabsTrigger>
            {profile.role === 'admin' && (
              <TabsTrigger 
                value="admin"
                className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
              >
                Admin Panel
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <VideoUpload />
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <InsightsView userId={profile.id} />
          </TabsContent>

          {profile.role === 'admin' && (
            <TabsContent value="admin" className="space-y-6">
              <AdminView />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};
