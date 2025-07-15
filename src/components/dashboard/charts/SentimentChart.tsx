
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SentimentData {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

interface SentimentChartProps {
  data: SentimentData[];
}

export const SentimentChart = ({ data }: SentimentChartProps) => {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString()}
          />
          <YAxis />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleDateString()}
            formatter={(value, name) => [`${value}%`, name]}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="positive" 
            stroke="#10b981" 
            strokeWidth={2}
            name="Positive"
          />
          <Line 
            type="monotone" 
            dataKey="neutral" 
            stroke="#6b7280" 
            strokeWidth={2}
            name="Neutral"
          />
          <Line 
            type="monotone" 
            dataKey="negative" 
            stroke="#ef4444" 
            strokeWidth={2}
            name="Negative"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
