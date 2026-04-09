import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUpload, UploadPreview } from '@/components/ui/file-upload';
import { MediaUploadSection } from '@/components/trainer/MediaUploadSection';
import { useFileUpload } from '@/hooks/use-file-upload';
import { ArrowLeft } from 'lucide-react';

const UploadDemo = () => {
  const [activeDemo, setActiveDemo] = useState<'basic' | 'media' | 'advanced'>('basic');
  const { uploadedFiles: basicFiles, upload: basicUpload, clear: basicClear } = useFileUpload();
  const { uploadedFiles: advancedFiles, upload: advancedUpload, clear: advancedClear } = useFileUpload({
    allowedExtensions: ['pdf', 'doc', 'docx'],
    maxFileSize: 10 * 1024 * 1024 // 10MB
  });

  const renderBasicDemo = () => (
    <Card>
      <CardHeader>
        <CardTitle>Basic File Upload</CardTitle>
        <CardDescription>
          Simple drag-and-drop file upload with multiple file support
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileUpload
          onFilesSelected={(files) => basicUpload(files)}
        />
        {basicFiles.length > 0 && (
          <UploadPreview
            files={basicFiles}
            onRemove={(index) => {
              // Remove file handler
            }}
          />
        )}
        {basicFiles.length > 0 && (
          <Button variant="outline" onClick={basicClear} className="w-full">
            Clear All
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const renderMediaDemo = () => (
    <MediaUploadSection
      title="All Media Types"
      description="Upload photos, videos, certifications, and more"
      uploadType="all"
      onFilesUploaded={(files) => {
        // Handle uploaded files
      }}
    />
  );

  const renderAdvancedDemo = () => (
    <Card>
      <CardHeader>
        <CardTitle>Document Upload (Custom Settings)</CardTitle>
        <CardDescription>
          Only PDF and Word documents, max 10MB each
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileUpload
          allowedExtensions={['pdf', 'doc', 'docx']}
          accept=".pdf,.doc,.docx"
          onFilesSelected={(files) => advancedUpload(files)}
        >
          <div>
            <p className="text-sm font-medium">Upload Certifications</p>
            <p className="text-xs text-gray-600">Only PDF and Word documents (max 10MB)</p>
          </div>
        </FileUpload>
        {advancedFiles.length > 0 && (
          <UploadPreview
            files={advancedFiles}
            onRemove={(index) => {
              // Remove document handler
            }}
          />
        )}
        {advancedFiles.length > 0 && (
          <Button variant="outline" onClick={advancedClear} className="w-full">
            Clear All
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Upload Feature Demo</h1>
            <p className="text-muted-foreground">Explore different upload configurations</p>
          </div>
        </div>

        {/* Demo Selector */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={activeDemo === 'basic' ? 'default' : 'outline'}
            onClick={() => setActiveDemo('basic')}
          >
            Basic Upload
          </Button>
          <Button
            variant={activeDemo === 'media' ? 'default' : 'outline'}
            onClick={() => setActiveDemo('media')}
          >
            Media Section
          </Button>
          <Button
            variant={activeDemo === 'advanced' ? 'default' : 'outline'}
            onClick={() => setActiveDemo('advanced')}
          >
            Documents Only
          </Button>
        </div>

        {/* Demo Content */}
        <div className="space-y-4">
          {activeDemo === 'basic' && renderBasicDemo()}
          {activeDemo === 'media' && renderMediaDemo()}
          {activeDemo === 'advanced' && renderAdvancedDemo()}
        </div>

        {/* Info Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Upload Endpoint Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-blue-800">
            <div>
              <p className="font-medium mb-1">Endpoint:</p>
              <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                https://trainercoachconnect.com/api.php
              </code>
            </div>
            <div>
              <p className="font-medium mb-1">Method:</p>
              <p>POST with multipart/form-data</p>
            </div>
            <div>
              <p className="font-medium mb-1">Maximum File Size:</p>
              <p>50MB per file</p>
            </div>
            <div>
              <p className="font-medium mb-1">Supported Formats:</p>
              <p>Images (JPG, PNG, GIF), Documents (PDF, DOC, DOCX), Videos (MP4, MOV, WebM), Archives (ZIP, RAR)</p>
            </div>
            <div>
              <p className="font-medium mb-1">Upload Directory:</p>
              <code className="bg-blue-100 px-2 py-1 rounded text-xs">
                /public/uploads/
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Integration Examples */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Integration Example</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`import { FileUpload } from '@/components/ui/file-upload';
import { useFileUpload } from '@/hooks/use-file-upload';

function MyComponent() {
  const { upload, uploadedFiles } = useFileUpload({
    onSuccess: (files) => {
      // Handle successful upload
    }
  });

  return (
    <FileUpload
      onFilesSelected={(files) => upload(files)}
    />
  );
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadDemo;
