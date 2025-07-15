import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Video, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const PRESET_QUESTIONS = [
  "What was your biggest achievement this week?",
  "What challenges did you face and how did you overcome them?",
  "What metrics or KPIs show your impact this week?"
];

export const VideoUpload = () => {
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [selectedPDF, setSelectedPDF] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [notes, setNotes] = useState('');
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      
      if (file.size > 200 * 1024 * 1024) { // 200MB limit
        toast({
          title: "File too large",
          description: "Please select a video under 200MB.",
          variant: "destructive"
        });
        return;
      }

      setSelectedVideo(file);
    }
  };

  const handlePDFSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (file.type !== 'application/pdf') {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file.",
          variant: "destructive"
        });
        return;
      }
      
      if (file.size > 50 * 1024 * 1024) { // 50MB limit for PDFs
        toast({
          title: "File too large",
          description: "Please select a PDF under 50MB.",
          variant: "destructive"
        });
        return;
      }

      setSelectedPDF(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedVideo || !user || !profile) {
      toast({
        title: "Missing required files",
        description: "Please select a video file before uploading.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setProcessing(true);

    try {
      console.log('Processing submission for user:', profile.name);
      console.log('Video file:', selectedVideo.name, selectedVideo.size);
      if (selectedPDF) {
        console.log('PDF file:', selectedPDF.name, selectedPDF.size);
      }
      console.log('Additional notes:', notes);

      // TODO: This will be implemented with Supabase integration
      // 1. Upload video and PDF to Supabase Storage
      // 2. Extract audio from video and send to OpenAI Whisper
      // 3. Extract text from PDF using PDF parsing
      // 4. Send both transcript and PDF text to GPT-4 for analysis
      // 5. Extract KPIs, sentiment, and insights
      // 6. Save results to database linked to user
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 5000));

      // For now, create a mock submission and store in localStorage
      const mockSubmission = {
        id: Date.now().toString(),
        userId: user.id,
        userName: profile.name,
        date: new Date().toISOString(),
        videoFile: selectedVideo.name,
        pdfFile: selectedPDF?.name || null,
        notes: notes,
        transcript: `Mock transcript for ${profile.name}'s submission on ${new Date().toLocaleDateString()}. This would contain the actual video transcription.`,
        keyPoints: [
          `Key achievement mentioned by ${profile.name}`,
          `Challenge overcome this week`,
          `Specific metric or KPI improvement noted`
        ],
        kpis: ['Custom KPI 1', 'Custom KPI 2', 'Performance Metric'],
        sentiment: 'positive' as const,
        quotes: [
          `"This week was very productive" - ${profile.name}`,
          `"We achieved significant improvement in our key metrics" - ${profile.name}`
        ],
        processed: true
      };

      // Store in localStorage (will be replaced with Supabase)
      const existingSubmissions = JSON.parse(localStorage.getItem('infosight_submissions') || '[]');
      existingSubmissions.push(mockSubmission);
      localStorage.setItem('infosight_submissions', JSON.stringify(existingSubmissions));

      toast({
        title: "Submission processed successfully!",
        description: `Your insights have been analyzed and saved, ${profile.name}.`,
      });

      // Reset form
      setSelectedVideo(null);
      setSelectedPDF(null);
      setNotes('');
      setCurrentQuestion(0);
      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: "Processing failed",
        description: "There was an error processing your files. Please try again.",
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
            Weekly Impact Submission
          </CardTitle>
          <CardDescription>
            Upload a video (max 2 minutes, 200MB) and optional PDF document
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label>Video File *</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => videoInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Video File
              </Button>
              {selectedVideo && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {selectedVideo.name}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <Label>Supporting PDF Document (Optional)</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                onChange={handlePDFSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => pdfInputRef.current?.click()}
                className="w-full"
              >
                <FileText className="w-4 h-4 mr-2" />
                Choose PDF Document
              </Button>
              {selectedPDF && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {selectedPDF.name}
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
            disabled={!selectedVideo || uploading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {processing ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing Submission...
              </div>
            ) : (
              'Upload & Process Files'
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
                  <li>• Upload supporting PDF documents if available</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
