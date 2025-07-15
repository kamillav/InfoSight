import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Video, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const PRESET_QUESTIONS = [
  "What was your biggest achievement this week?",
  "What challenges did you face and how did you overcome them?",
  "What metrics or KPIs show your impact this week?"
];

export const VideoUpload = () => {
  const [selectedVideos, setSelectedVideos] = useState<(File | null)[]>([null, null, null]);
  const [selectedPDF, setSelectedPDF] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notes, setNotes] = useState('');
  const videoInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const handleVideoSelect = (questionIndex: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const newVideos = [...selectedVideos];
      newVideos[questionIndex] = file;
      setSelectedVideos(newVideos);
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

  const uploadFileToStorage = async (file: File, path: string) => {
    const { data, error } = await supabase.storage
      .from('submissions')
      .upload(path, file);
    
    if (error) throw error;
    return data.path;
  };

  const processSubmission = async (submissionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('process-submission', {
        body: { submissionId }
      });

      if (error) {
        console.error('Error invoking processing function:', error);
        throw error;
      }

      console.log('Processing function invoked successfully:', data);
    } catch (error) {
      console.error('Error processing submission:', error);
      // The edge function will handle updating the status to failed
      throw error;
    }
  };

  const handleUpload = async () => {
    if (!user || !profile) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upload files.",
        variant: "destructive"
      });
      return;
    }

    // Check if all videos are uploaded
    const allVideosUploaded = selectedVideos.every(video => video !== null);
    if (!allVideosUploaded) {
      toast({
        title: "Missing videos",
        description: "Please upload a video for each question before submitting.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setProcessing(true);

    try {
      console.log('Starting submission process for user:', profile.name);
      
      // Upload videos to storage
      const videoPromises = selectedVideos.map(async (video, index) => {
        if (!video) return null;
        const fileName = `${user.id}/video_${index + 1}_${Date.now()}.${video.name.split('.').pop()}`;
        return await uploadFileToStorage(video, fileName);
      });

      const videoPaths = await Promise.all(videoPromises);
      console.log('Videos uploaded:', videoPaths);

      // Upload PDF if present
      let pdfPath = null;
      if (selectedPDF) {
        const pdfFileName = `${user.id}/document_${Date.now()}.pdf`;
        pdfPath = await uploadFileToStorage(selectedPDF, pdfFileName);
        console.log('PDF uploaded:', pdfPath);
      }

      // Create submission record
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          user_id: user.id,
          video_files: videoPaths,
          pdf_file: pdfPath,
          notes: notes,
          status: 'processing'
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      console.log('Submission created:', submission);

      // Start processing in background
      processSubmission(submission.id).catch(error => {
        console.error('Background processing failed:', error);
        toast({
          title: "Processing error",
          description: "Your files were uploaded but processing failed. Please contact support.",
          variant: "destructive"
        });
      });

      toast({
        title: "Submission uploaded successfully!",
        description: "Your files are being processed. You'll see the results in your insights shortly.",
      });

      // Reset form
      setSelectedVideos([null, null, null]);
      setSelectedPDF(null);
      setNotes('');
      videoInputRefs.current.forEach(ref => {
        if (ref) ref.value = '';
      });
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }

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

  const canSubmit = selectedVideos.every(video => video !== null) && !uploading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Weekly Impact Submission
          </CardTitle>
          <CardDescription>
            Upload one video per question (max 2 minutes each, 200MB) and optional PDF document
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video uploads for each question */}
          {PRESET_QUESTIONS.map((question, index) => (
            <div key={index} className="space-y-4">
              <Label className="text-sm font-medium">
                Question {index + 1}: {question}
              </Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                <input
                  ref={el => videoInputRefs.current[index] = el}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect(index)}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => videoInputRefs.current[index]?.click()}
                  className="w-full"
                  size="sm"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Video for Question {index + 1}
                </Button>
                {selectedVideos[index] && (
                  <div className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {selectedVideos[index]!.name}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* PDF upload */}
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
            disabled={!canSubmit}
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
            Record a video response for each question below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PRESET_QUESTIONS.map((question, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  selectedVideos[index]
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium mt-0.5 ${
                    selectedVideos[index]
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {selectedVideos[index] ? '✓' : index + 1}
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
                <p className="font-medium">Recording Requirements:</p>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Upload one video per question (all 3 required)</li>
                  <li>• Keep each video under 2 minutes</li>
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
