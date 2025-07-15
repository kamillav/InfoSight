
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, Zap, User, Crown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export const DashboardHeader = () => {
  const { profile, signOut } = useAuth();

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-3 h-3 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800';
      case 'team_lead':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Infosight</h1>
              <p className="text-sm text-gray-600">Infosys Analytics Platform</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">Welcome, {profile?.name}</p>
                {profile?.role === 'admin' && getRoleIcon(profile.role)}
              </div>
              <Badge className={`text-xs ${getRoleColor(profile?.role || 'user')}`}>
                {profile?.role?.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-full">
                  <User className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};
