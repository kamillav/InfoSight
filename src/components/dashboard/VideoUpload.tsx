
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Video, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const PRESET_QUESTIONS = [
  "What was your biggest achievement this week?",
  "What challenges did you face and how did you overcome them?",
  "What metrics or KPIs show your impact this week?"
];

export const VideoUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [notes, setNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('video/')) {
        toast({
          title: "Invalid file type",
          description: "Please select a video file.",
          variant: "destructive"
        });
        return;
      }
      
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        toast({
          title: "File too large",
          description: "Please select a video under 100MB.",
          variant: "destructive"
        });
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    setProcessing(true);

    try {
      // Mock upload and processing - in real app, this would:
      // 1. Upload video to Supabase Storage
      // 2. Extract audio and send to OpenAI Whisper
      // 3. Send transcript to GPT-4 for analysis
      // 4. Save results to database
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Mock successful processing
      toast({
        title: "Video processed successfully!",
        description: "Your insights have been analyzed and saved.",
      });

      // Reset form
      setSelectedFile(null);
      setNotes('');
      setCurrentQuestion(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast({
        title: "Processing failed",
        description: "There was an error processing your video. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Weekly Impact Video
          </CardTitle>
          <CardDescription>
            Upload a 2-minute video responding to the weekly questions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>Select Video File</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Video File
              </Button>
              {selectedFile && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {selectedFile.name}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional context or notes about your week..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {processing ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing Video...
              </div>
            ) : (
              'Upload & Process Video'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Questions</CardTitle>
          <CardDescription>
            Use these questions as a guide for your video response
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PRESET_QUESTIONS.map((question, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                  currentQuestion === index
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setCurrentQuestion(index)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600 mt-0.5">
                    {index + 1}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{question}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Recording Tips:</p>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Keep your video under 2 minutes</li>
                  <li>• Speak clearly and mention specific metrics</li>
                  <li>• Include concrete examples of your impact</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
