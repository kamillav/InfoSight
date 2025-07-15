
import { Card } from '@/components/ui/card';

interface WordCloudData {
  word: string;
  frequency: number;
}

interface WordCloudChartProps {
  data: WordCloudData[];
}

export const WordCloudChart = ({ data }: WordCloudChartProps) => {
  const maxFrequency = Math.max(...data.map(d => d.frequency));
  
  const getFontSize = (frequency: number) => {
    const ratio = frequency / maxFrequency;
    return Math.max(12, Math.min(48, 12 + (ratio * 36)));
  };

  const getColor = (frequency: number) => {
    const ratio = frequency / maxFrequency;
    if (ratio > 0.7) return 'text-blue-600';
    if (ratio > 0.5) return 'text-purple-600';
    if (ratio > 0.3) return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <div className="min-h-[300px] p-6 bg-gray-50 rounded-lg">
      <div className="flex flex-wrap items-center justify-center gap-4 h-full">
        {data.map((item, index) => (
          <span
            key={index}
            className={`font-semibold transition-colors hover:opacity-80 cursor-default ${getColor(item.frequency)}`}
            style={{ fontSize: `${getFontSize(item.frequency)}px` }}
            title={`${item.word}: ${item.frequency} mentions`}
          >
            {item.word}
          </span>
        ))}
      </div>
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-500">
          Word size represents frequency of use across all submissions
        </p>
      </div>
    </div>
  );
};
