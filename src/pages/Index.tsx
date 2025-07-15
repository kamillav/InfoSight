
import { useAuth } from '@/hooks/useAuth';
import { AuthPage } from '@/components/auth/AuthPage';
import { Dashboard } from '@/components/dashboard/Dashboard';

const Index = () => {
  const { user, profile, loading } = useAuth();

  console.log('Index component - user:', user?.email, 'profile:', profile, 'loading:', loading);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return user && profile ? <Dashboard /> : <AuthPage />;
};

export default Index;
