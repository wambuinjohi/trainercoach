import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { getApiBaseUrl } from '@/lib/api-config';

interface UploadedFile {
  originalName: string;
  fileName: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

interface UploadResponse {
  status: string;
  message: string;
  data?: {
    uploaded: UploadedFile[];
    errors: string[];
    count: number;
  };
}

interface UseFileUploadOptions {
  maxFileSize?: number; // in bytes, default 50MB
  allowedExtensions?: string[];
  onSuccess?: (files: UploadedFile[]) => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void; // 0-100
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const {
    maxFileSize = 50 * 1024 * 1024, // 50MB
    allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'mp4', 'avi', 'mov', 'webm', 'zip', 'rar'],
    onSuccess,
    onError,
    onProgress
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const validateFiles = useCallback((files: File[]): { valid: File[], errors: string[] } => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      // Check file size
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: File size exceeds ${maxFileSize / 1024 / 1024}MB limit`);
        return;
      }

      // Check file extension
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !allowedExtensions.includes(fileExt)) {
        errors.push(`${file.name}: File type not allowed`);
        return;
      }

      validFiles.push(file);
    });

    return { valid: validFiles, errors };
  }, [maxFileSize, allowedExtensions]);

  const upload = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate files
      const { valid: validFiles, errors: validationErrors } = validateFiles(files);

      if (validationErrors.length > 0) {
        const errorMsg = validationErrors.join('; ');
        setError(errorMsg);
        onError?.(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      if (validFiles.length === 0) {
        const msg = 'No valid files to upload';
        setError(msg);
        onError?.(msg);
        toast.error(msg);
        setIsLoading(false);
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append('action', 'file_upload');
      validFiles.forEach((file) => {
        formData.append('files[]', file);
      });

      // Upload files using XMLHttpRequest for progress tracking
      const apiBaseUrl = getApiBaseUrl();
      const apiUrl = apiBaseUrl.endsWith('/api.php') ? apiBaseUrl : (apiBaseUrl.endsWith('/') ? apiBaseUrl + 'api.php' : apiBaseUrl + '/api.php');

      // Wrap XMLHttpRequest in Promise
      const data = await new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress?.(Math.round(percentComplete));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const responseData = JSON.parse(xhr.responseText) as UploadResponse;
              resolve(responseData);
            } catch (error) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload aborted'));
        });

        xhr.open('POST', apiUrl);
        xhr.send(formData);
      });

      if (data.status === 'error') {
        const errorMsg = data.message;
        setError(errorMsg);
        onError?.(errorMsg);
        toast.error(errorMsg);
      } else {
        // Use the URLs returned by the API (they should be full URLs now)
        const uploaded = (data.data?.uploaded || []);

        // The API already returns full URLs with the correct base URL, so use them as-is
        setUploadedFiles(prev => [...prev, ...uploaded]);
        onSuccess?.(uploaded);
        
        const successMsg = data.data?.count === 1 
          ? '1 file uploaded successfully'
          : `${data.data?.count} files uploaded successfully`;
        toast.success(successMsg);

        // Show any warnings for partial failures
        if (data.data?.errors && data.data.errors.length > 0) {
          toast.warning(`${data.data.errors.length} file(s) failed to upload`);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      onError?.(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
      onProgress?.(0); // Reset progress
    }
  }, [validateFiles, onSuccess, onError]);

  const uploadFromInput = useCallback(async (input: HTMLInputElement | FileList) => {
    const files = input instanceof HTMLInputElement ? input.files : input;
    if (!files || files.length === 0) {
      toast.error('No files selected');
      return;
    }

    const fileArray = Array.from(files);
    await upload(fileArray);
  }, [upload]);

  const clear = useCallback(() => {
    setUploadedFiles([]);
    setError(null);
  }, []);

  return {
    upload,
    uploadFromInput,
    isLoading,
    error,
    uploadedFiles,
    clear
  };
}
