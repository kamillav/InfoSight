
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Video, AlertCircle, CheckCircle, FileText, Calendar, User, PlayCircle, FileImage, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const PRESET_QUESTIONS = [
  "What was your biggest achievement this week?",
  "What challenges did you face and how did you overcome them?",
  "What metrics or KPIs show your impact this week? Provide as much detail as possible"
];

interface Submission {
  id: string;
  user_id: string;
  video_files: any;
  pdf_file: string | null;
  notes: string | null;
  transcript: any;
  key_points: string[] | null;
  extracted_kpis: string[] | null;
  sentiment: string | null;
  ai_quotes: string[] | null;
  status: string;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
}

export const VideoUpload = () => {
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [selectedPDF, setSelectedPDF] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [notes, setNotes] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  // Load user submissions
  useEffect(() => {
    if (user) {
      loadSubmissions();
    }
  }, [user]);

  const loadSubmissions = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error loading submissions:', error);
      toast({
        title: "Error loading submissions",
        description: "Failed to load your previous submissions.",
        variant: "destructive"
      });
    } finally {
      setLoadingSubmissions(false);
    }
  };

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
      console.log('Starting submission process...');

      // Upload video to Supabase Storage
      const videoFileName = `${user.id}/${Date.now()}_${selectedVideo.name}`;
      const { data: videoUpload, error: videoError } = await supabase.storage
        .from('submissions')
        .upload(videoFileName, selectedVideo);

      if (videoError) throw videoError;
      console.log('Video uploaded successfully:', videoUpload.path);

      // Upload PDF if selected
      let pdfFileName = null;
      if (selectedPDF) {
        pdfFileName = `${user.id}/${Date.now()}_${selectedPDF.name}`;
        const { data: pdfUpload, error: pdfError } = await supabase.storage
          .from('submissions')
          .upload(pdfFileName, selectedPDF);

        if (pdfError) throw pdfError;
        console.log('PDF uploaded successfully:', pdfUpload.path);
      }

      // Create submission record in database
      const { data: submission, error: dbError } = await supabase
        .from('submissions')
        .insert({
          user_id: user.id,
          video_files: { path: videoUpload.path, name: selectedVideo.name },
          pdf_file: pdfFileName,
          notes: notes || null,
          status: 'processing'
        })
        .select()
        .single();

      if (dbError) throw dbError;
      console.log('Submission created:', submission);

      // Call the edge function to process the submission
      const { error: processingError } = await supabase.functions.invoke('process-submission', {
        body: { submissionId: submission.id }
      });

      if (processingError) {
        console.error('Processing error:', processingError);
        // Update submission status to error
        await supabase
          .from('submissions')
          .update({ 
            status: 'error', 
            processing_error: processingError.message 
          })
          .eq('id', submission.id);
      }

      toast({
        title: "Submission uploaded successfully!",
        description: "Your video is being processed. You'll see the results shortly.",
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

      // Reload submissions
      loadSubmissions();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Submission History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Your Previous Submissions
          </CardTitle>
          <CardDescription>
            View your weekly impact submissions and their processing status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSubmissions ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No submissions yet. Upload your first video above!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {submissions.map((submission) => (
                <div key={submission.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <PlayCircle className="w-5 h-5 text-blue-600" />
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {submission.video_files?.name || 'Video Submission'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {formatDate(submission.created_at)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        {submission.pdf_file && (
                          <div className="flex items-center gap-1">
                            <FileImage className="w-4 h-4" />
                            <span>PDF included</span>
                          </div>
                        )}
                        {submission.notes && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            <span>Notes included</span>
                          </div>
                        )}
                      </div>

                      {submission.status === 'completed' && (
                        <div className="space-y-2">
                          {submission.key_points && submission.key_points.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700">Key Points:</p>
                              <ul className="text-sm text-gray-600 list-disc list-inside ml-2">
                                {submission.key_points.slice(0, 2).map((point, index) => (
                                  <li key={index}>{point}</li>
                                ))}
                                {submission.key_points.length > 2 && (
                                  <li>... and {submission.key_points.length - 2} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                          
                          {submission.sentiment && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-700">Sentiment:</span>
                              <span className={`text-sm px-2 py-1 rounded-full capitalize ${
                                submission.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                                submission.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {submission.sentiment}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {submission.processing_error && (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border">
                          Error: {submission.processing_error}
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(submission.status)}`}>
                        {submission.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
