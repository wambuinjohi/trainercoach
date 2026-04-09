import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useFileUpload } from '@/hooks/use-file-upload';
import { Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  maxFileSize?: number;
  allowedExtensions?: string[];
  multiple?: boolean;
  accept?: string;
  onFilesSelected?: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const FileUpload = React.forwardRef<HTMLDivElement, FileUploadProps>(
  ({
    maxFileSize,
    allowedExtensions,
    multiple = true,
    accept,
    onFilesSelected,
    disabled = false,
    className,
    children
  }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const { upload, isLoading } = useFileUpload({
      maxFileSize,
      allowedExtensions
    });

    const handleClick = () => {
      if (!disabled && !isLoading) {
        inputRef.current?.click();
      }
    };

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files;
      if (files && files.length > 0) {
        const fileArray = Array.from(files);
        onFilesSelected?.(fileArray);
        await upload(fileArray);
      }
      // Reset input
      e.currentTarget.value = '';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (!disabled && !isLoading) {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          const fileArray = Array.from(files);
          onFilesSelected?.(fileArray);
          upload(fileArray);
        }
      }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-center w-full',
          className
        )}
      >
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={cn(
            'w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
            disabled || isLoading
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-50'
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple={multiple}
            accept={accept}
            onChange={handleChange}
            disabled={disabled || isLoading}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <Upload className="w-8 h-8 text-gray-400" />
            <div className="text-center">
              {children ? (
                children
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-900">
                    {isLoading ? 'Uploading...' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-600">
                    {allowedExtensions
                      ? `Allowed: ${allowedExtensions.join(', ')}`
                      : 'Various file types supported'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

FileUpload.displayName = 'FileUpload';

interface UploadPreviewProps {
  files: Array<{ url: string; originalName: string; size: number }>;
  onRemove?: (index: number) => void;
  className?: string;
}

export const UploadPreview = React.forwardRef<HTMLDivElement, UploadPreviewProps>(
  ({ files, onRemove, className }, ref) => {
    if (files.length === 0) return null;

    return (
      <div ref={ref} className={cn('space-y-2', className)}>
        <h3 className="text-sm font-medium text-gray-900">Uploaded Files</h3>
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.originalName}
                </p>
                <p className="text-xs text-gray-600">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {onRemove && (
                <button
                  onClick={() => onRemove(index)}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

UploadPreview.displayName = 'UploadPreview';
