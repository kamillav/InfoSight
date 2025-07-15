import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Video, AlertCircle, CheckCircle, FileText, Calendar, User, PlayCircle, FileImage, MessageSquare, Plus, ChevronDown, ChevronUp } from 'lucide-react';
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
  question_index?: number;
}

export const VideoUpload = () => {
  const [selectedVideos, setSelectedVideos] = useState<(File | null)[]>([null, null, null]);
  const [selectedPDF, setSelectedPDF] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean[]>([false, false, false]);
  const [processing, setProcessing] = useState<boolean[]>([false, false, false]);
  const [notes, setNotes] = useState(['', '', '']);
  const [showNotes, setShowNotes] = useState<boolean[]>([false, false, false]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const videoInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
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

  const handleVideoSelect = (questionIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
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

      const newSelectedVideos = [...selectedVideos];
      newSelectedVideos[questionIndex] = file;
      setSelectedVideos(newSelectedVideos);
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

  const handleUpload = async (questionIndex: number) => {
    const selectedVideo = selectedVideos[questionIndex];
    if (!selectedVideo || !user || !profile) {
      toast({
        title: "Missing required files",
        description: "Please select a video file before uploading.",
        variant: "destructive"
      });
      return;
    }

    const newUploading = [...uploading];
    const newProcessing = [...processing];
    newUploading[questionIndex] = true;
    newProcessing[questionIndex] = true;
    setUploading(newUploading);
    setProcessing(newProcessing);

    try {
      console.log('Starting submission process for question:', questionIndex);

      // Upload video to Supabase Storage
      const videoFileName = `${user.id}/${Date.now()}_q${questionIndex}_${selectedVideo.name}`;
      const { data: videoUpload, error: videoError } = await supabase.storage
        .from('submissions')
        .upload(videoFileName, selectedVideo);

      if (videoError) throw videoError;
      console.log('Video uploaded successfully:', videoUpload.path);

      // Upload PDF if selected (shared across all questions)
      let pdfFileName = null;
      if (selectedPDF) {
        pdfFileName = `${user.id}/${Date.now()}_shared_${selectedPDF.name}`;
        const { data: pdfUpload, error: pdfError } = await supabase.storage
          .from('submissions')
          .upload(pdfFileName, selectedPDF);

        if (pdfError) throw pdfError;
        console.log('PDF uploaded successfully:', pdfUpload.path);
      }

      // Create submission record in database with question context
      const submissionNotes = `${PRESET_QUESTIONS[questionIndex]}\n\nResponse: ${notes[questionIndex] || 'No additional notes provided.'}`;
      
      const { data: submission, error: dbError } = await supabase
        .from('submissions')
        .insert({
          user_id: user.id,
          video_files: { path: videoUpload.path, name: selectedVideo.name, question_index: questionIndex },
          pdf_file: pdfFileName,
          notes: submissionNotes,
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
        description: `Your video for question ${questionIndex + 1} is being processed.`,
      });

      // Reset form for this question
      const newSelectedVideos = [...selectedVideos];
      const newNotes = [...notes];
      newSelectedVideos[questionIndex] = null;
      newNotes[questionIndex] = '';
      setSelectedVideos(newSelectedVideos);
      setNotes(newNotes);
      
      if (videoInputRefs.current[questionIndex]) {
        videoInputRefs.current[questionIndex]!.value = '';
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
      const newUploading = [...uploading];
      const newProcessing = [...processing];
      newUploading[questionIndex] = false;
      newProcessing[questionIndex] = false;
      setUploading(newUploading);
      setProcessing(newProcessing);
    }
  };

  const toggleNotes = (questionIndex: number) => {
    const newShowNotes = [...showNotes];
    newShowNotes[questionIndex] = !newShowNotes[questionIndex];
    setShowNotes(newShowNotes);
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

  const getQuestionFromSubmission = (submission: Submission) => {
    const questionIndex = submission.video_files?.question_index;
    if (questionIndex !== undefined && questionIndex >= 0 && questionIndex < PRESET_QUESTIONS.length) {
      return PRESET_QUESTIONS[questionIndex];
    }
    return 'General Submission';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Shared PDF Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Supporting Document (Optional)
              </CardTitle>
              <CardDescription>
                Upload a PDF document that supports all your video responses
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Video Upload Slots */}
          {PRESET_QUESTIONS.map((question, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  {question}
                </CardTitle>
                <CardDescription className="text-sm font-medium text-gray-600">
                  Question {index + 1}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    ref={(el) => (videoInputRefs.current[index] = el)}
                    type="file"
                    accept="video/*"
                    onChange={(e) => handleVideoSelect(index, e)}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => videoInputRefs.current[index]?.click()}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Video File
                  </Button>
                  {selectedVideos[index] && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      {selectedVideos[index]?.name}
                    </div>
                  )}
                </div>

                {/* Additional Notes Toggle Button */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => toggleNotes(index)}
                  className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  <Plus className="w-4 h-4" />
                  Additional Notes
                  {showNotes[index] ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>

                {/* Collapsible Notes Section */}
                {showNotes[index] && (
                  <div className="space-y-2">
                    <Label htmlFor={`notes-${index}`}>Additional Notes (Optional)</Label>
                    <Textarea
                      id={`notes-${index}`}
                      placeholder="Add any additional context for this question..."
                      value={notes[index]}
                      onChange={(e) => {
                        const newNotes = [...notes];
                        newNotes[index] = e.target.value;
                        setNotes(newNotes);
                      }}
                      rows={3}
                    />
                  </div>
                )}

                <Button
                  onClick={() => handleUpload(index)}
                  disabled={!selectedVideos[index] || uploading[index]}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {processing[index] ? (
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
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recording Tips</CardTitle>
            <CardDescription>
              Best practices for your video submissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Recording Guidelines:</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• Keep each video under 2 minutes</li>
                      <li>• Speak clearly and mention specific metrics</li>
                      <li>• Include concrete examples of your impact</li>
                      <li>• Answer each question in a separate video</li>
                      <li>• Use the PDF upload for supporting documents</li>
                    </ul>
                  </div>
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
                            {getQuestionFromSubmission(submission)}
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
