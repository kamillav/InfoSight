
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const ReprocessTranscriptsButton = () => {
  const [isReprocessing, setIsReprocessing] = useState(false);
  const { toast } = useToast();

  const handleReprocess = async () => {
    setIsReprocessing(true);
    
    try {
      console.log('Starting transcript reprocessing...');
      
      const { data, error } = await supabase.functions.invoke('reprocess-transcripts', {
        body: {}
      });

      if (error) {
        console.error('Reprocessing error:', error);
        throw error;
      }

      console.log('Reprocessing response:', data);

      toast({
        title: "Reprocessing Complete",
        description: data.message || "Transcripts have been reprocessed successfully",
      });

      // Refresh the page to show updated data
      window.location.reload();
      
    } catch (error) {
      console.error('Error reprocessing transcripts:', error);
      toast({
        title: "Reprocessing Failed",
        description: "Failed to reprocess transcripts. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  return (
    <Button
      onClick={handleReprocess}
      disabled={isReprocessing}
      className="bg-purple-600 hover:bg-purple-700 text-white"
    >
      {isReprocessing ? (
        <>
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Reprocessing...
        </>
      ) : (
        <>
          <Zap className="w-4 h-4 mr-2" />
          Reprocess All Transcripts
        </>
      )}
    </Button>
  );
};
