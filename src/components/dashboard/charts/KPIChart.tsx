
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

interface KPIData {
  name: string;
  count: number;
  userBreakdown?: Record<string, number>;
}

interface KPIChartProps {
  data: KPIData[];
  userColors?: Record<string, string>;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', 
  '#06b6d4', '#ec4899', '#10b981', '#f97316', '#6366f1',
  '#84cc16', '#f43f5e', '#14b8a6', '#a855f7', '#eab308'
];

export const KPIChart = ({ data, userColors }: KPIChartProps) => {
  // If userColors and userBreakdown are provided, create stacked data
  const processedData = data.map((item, index) => {
    if (item.userBreakdown && userColors) {
      // Create a base object with the KPI name and total count
      const stackedItem: any = {
        name: item.name,
        total: item.count,
      };
      
      // Add each user's contribution as separate properties
      Object.entries(item.userBreakdown).forEach(([userEmail, count]) => {
        stackedItem[userEmail] = count;
      });
      
      return stackedItem;
    }
    
    // Fallback to simple data structure
    return {
      name: item.name,
      count: item.count,
    };
  });

  // Get all unique user emails for the legend
  const allUsers = data.reduce((users: string[], item) => {
    if (item.userBreakdown) {
      Object.keys(item.userBreakdown).forEach(userEmail => {
        if (!users.includes(userEmail)) {
          users.push(userEmail);
        }
      });
    }
    return users;
  }, []);

  const hasUserBreakdown = data.some(item => item.userBreakdown) && userColors;

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis />
          <Tooltip 
            formatter={(value, name) => [value, name === 'total' ? 'Total Mentions' : name]}
            labelFormatter={(label) => `KPI: ${label}`}
          />
          {hasUserBreakdown && <Legend />}
          
          {hasUserBreakdown ? (
            // Render stacked bars for each user
            allUsers.map((userEmail, index) => (
              <Bar 
                key={userEmail}
                dataKey={userEmail}
                stackId="users"
                fill={COLORS[index % COLORS.length]}
                name={userEmail}
              />
            ))
          ) : (
            // Render simple bars with different colors
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
