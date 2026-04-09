import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload, UploadPreview } from '@/components/ui/file-upload';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface UploadedMediaFile {
  originalName: string;
  fileName: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface MediaUploadSectionProps {
  title?: string;
  description?: string;
  uploadType?: 'photos' | 'videos' | 'certifications' | 'all';
  onFilesUploaded?: (files: UploadedMediaFile[]) => void;
}

const getAcceptedTypes = (type: string): string => {
  switch (type) {
    case 'photos':
      return 'image/jpeg,image/png,image/gif';
    case 'videos':
      return 'video/mp4,video/quicktime,video/webm';
    case 'certifications':
      return '.pdf,.doc,.docx';
    default:
      return '*/*';
  }
};

const getAllowedExtensions = (type: string): string[] => {
  switch (type) {
    case 'photos':
      return ['jpg', 'jpeg', 'png', 'gif'];
    case 'videos':
      return ['mp4', 'avi', 'mov', 'webm'];
    case 'certifications':
      return ['pdf', 'doc', 'docx'];
    default:
      return ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'mp4', 'avi', 'mov', 'webm', 'zip', 'rar'];
  }
};

export function MediaUploadSection({
  title = 'Upload Media',
  description = 'Upload photos, videos, and certifications to your profile',
  uploadType = 'all',
  onFilesUploaded
}: MediaUploadSectionProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedMediaFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    setUploadError(null);
    setUploadSuccess(false);
  };

  const handleUploadSuccess = (uploadedFiles: UploadedMediaFile[]) => {
    setUploadedFiles(prev => [...prev, ...uploadedFiles]);
    setUploadSuccess(true);
    onFilesUploaded?.(uploadedFiles);
    
    // Clear success message after 3 seconds
    setTimeout(() => setUploadSuccess(false), 3000);
  };

  const handleUploadError = (error: string) => {
    setUploadError(error);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Area */}
        <FileUpload
          allowedExtensions={getAllowedExtensions(uploadType)}
          accept={getAcceptedTypes(uploadType)}
          multiple={true}
          onFilesSelected={handleFilesSelected}
          maxFileSize={50 * 1024 * 1024}
        />

        {/* Error Message */}
        {uploadError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{uploadError}</p>
          </div>
        )}

        {/* Success Message */}
        {uploadSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">Files uploaded successfully!</p>
          </div>
        )}

        {/* Uploaded Files Preview */}
        {uploadedFiles.length > 0 && (
          <UploadPreview
            files={uploadedFiles}
            onRemove={handleRemoveFile}
          />
        )}

        {/* Usage Instructions */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Upload Guidelines</h4>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li>Maximum file size: 50MB per file</li>
            <li>Drag and drop files or click to browse</li>
            <li>Multiple files can be uploaded at once</li>
            <li>Files are stored securely and accessible via your profile</li>
            {uploadType === 'photos' && <li>Recommended: Clear, well-lit profile photos (JPG or PNG)</li>}
            {uploadType === 'videos' && <li>Recommended: MP4 format, up to 5 minutes duration</li>}
            {uploadType === 'certifications' && <li>PDF or document format required</li>}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
