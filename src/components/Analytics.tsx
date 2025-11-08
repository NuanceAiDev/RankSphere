import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, RotateCcw, Image as ImageIcon, AlertCircle, Target, Trash2, AlertTriangle } from 'lucide-react';
import { Client } from '../types';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface AnalyticsProps {
  selectedClient: Client | null;
}

interface UploadedFile {
  id: string;
  name: string;
  url: string;
  file: File;
  uploading: boolean;
  progress: number;
}

export function Analytics({ selectedClient }: AnalyticsProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILES = 5;
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [uploadedFiles.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  if (!selectedClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Client Selected</h3>
          <p className="text-gray-500 dark:text-gray-400">Select a client to manage their analytics screenshots</p>
        </div>
      </div>
    );
  }

  const generateClientSlug = (clientName: string): string => {
    return clientName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const getCurrentMonthPath = (): string => {
    return format(new Date(), 'yyyy-MM');
  };

  const createStoragePath = (filename: string): string => {
    const clientSlug = generateClientSlug(selectedClient.name);
    const monthPath = getCurrentMonthPath();
    const timestamp = Date.now();
    return `${clientSlug}/${monthPath}/${timestamp}_${filename}`;
  };

  const generateCacheBustingUrl = (baseUrl: string): string => {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}t=${Date.now()}`;
  };

  const ensureFolderExists = async (clientSlug: string, monthPath: string): Promise<void> => {
    try {
      // Create a dummy file to ensure the folder structure exists
      const dummyPath = `${clientSlug}/${monthPath}/.keep`;
      
      // Check if folder exists by trying to list files
      const { data: existingFiles } = await supabase.storage
        .from('analytics_screenshots')
        .list(`${clientSlug}/${monthPath}`);

      // If no files exist, create the folder structure
      if (!existingFiles || existingFiles.length === 0) {
        const dummyBlob = new Blob([''], { type: 'text/plain' });
        await supabase.storage
          .from('analytics_screenshots')
          .upload(dummyPath, dummyBlob, {
            cacheControl: '3600',
            upsert: false
          });
      }
    } catch (error) {
      console.warn('Folder creation warning:', error);
      // Continue with upload even if folder creation fails
    }
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, and WebP images are allowed';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileId = Math.random().toString(36).substr(2, 9);
    
    // Add file to state with uploading status
    const newFile: UploadedFile = {
      id: fileId,
      name: file.name,
      url: '',
      file,
      uploading: true,
      progress: 0
    };

    setUploadedFiles(prev => [...prev, newFile]);

    try {
      const clientSlug = generateClientSlug(selectedClient.name);
      const monthPath = getCurrentMonthPath();
      
      // Ensure folder exists
      await ensureFolderExists(clientSlug, monthPath);
      
      const storagePath = createStoragePath(file.name);

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from('analytics_screenshots')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        // Check if it's a bucket not found error
        if (error.message?.includes('Bucket not found') || error.message?.includes('404')) {
          throw new Error('Storage bucket not found. Please create the "analytics_screenshots" bucket in your Supabase project Storage section and make it public.');
        }
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('analytics_screenshots')
        .getPublicUrl(storagePath);

      const cacheBustedUrl = generateCacheBustingUrl(urlData.publicUrl);

      // Update file state with success
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, uploading: false, progress: 100, url: cacheBustedUrl }
          : f
      ));

      return cacheBustedUrl;
    } catch (error) {
      console.error('Upload error:', error);
      
      // Remove failed upload from state
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('Storage bucket not found')) {
        toast.error('Storage not configured. Please create the "analytics_screenshots" bucket in Supabase Storage.', {
          duration: 8000
        });
      } else {
        toast.error(`Failed to upload ${file.name}: ${errorMessage}`);
      }
      
      throw error;
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const remainingSlots = MAX_FILES - uploadedFiles.length;

    if (fileArray.length > remainingSlots) {
      toast.error(`You can only upload ${remainingSlots} more file(s). Maximum is ${MAX_FILES} files.`);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        toast.error(`${file.name}: ${validationError}`);
        errorCount++;
        continue;
      }

      try {
        await uploadFile(file);
        successCount++;
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} file(s)!`);
    }
  };

  const extractStoragePathFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      // Remove the first empty part and 'object/public/analytics_screenshots'
      const relevantParts = pathParts.slice(-3); // Get last 3 parts: client/month/filename
      return relevantParts.join('/');
    } catch (error) {
      console.error('Error extracting storage path:', error);
      return '';
    }
  };

  const deleteFile = async (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) return;

    try {
      const storagePath = extractStoragePathFromUrl(file.url);
      if (!storagePath) {
        throw new Error('Could not extract storage path from URL');
      }

      // Delete from Supabase Storage
      const { error } = await supabase.storage
        .from('analytics_screenshots')
        .remove([storagePath]);

      if (error) throw error;

      // Remove from state
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success('File deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete file');
    }
  };

  const replaceFile = (fileId: string) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) return;

    // Create a temporary file input for replacement
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ALLOWED_TYPES.join(',');
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const newFile = files[0];
        const validationError = validateFile(newFile);
        if (validationError) {
          toast.error(validationError);
          return;
        }

        try {
          const storagePath = extractStoragePathFromUrl(file.url);
          if (!storagePath) {
            throw new Error('Could not extract storage path from URL');
          }

          // Delete old file from storage
          const { error: deleteError } = await supabase.storage
            .from('analytics_screenshots')
            .remove([storagePath]);

          if (deleteError) throw deleteError;

          // Upload new file to the same path (without timestamp prefix)
          const pathParts = storagePath.split('/');
          const originalFilename = pathParts[pathParts.length - 1].split('_').slice(1).join('_'); // Remove timestamp prefix
          const newStoragePath = `${pathParts.slice(0, -1).join('/')}/${Date.now()}_${newFile.name}`;

          const { data, error: uploadError } = await supabase.storage
            .from('analytics_screenshots')
            .upload(newStoragePath, newFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          // Get new public URL with cache busting
          const { data: urlData } = supabase.storage
            .from('analytics_screenshots')
            .getPublicUrl(newStoragePath);

          const cacheBustedUrl = generateCacheBustingUrl(urlData.publicUrl);

          // Update file in state
          setUploadedFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, name: newFile.name, url: cacheBustedUrl, file: newFile }
              : f
          ));

          toast.success('File replaced successfully!');
        } catch (error) {
          console.error('Replace error:', error);
          toast.error('Failed to replace file');
        }
      }
    };
    input.click();
  };

  const clearAllUploads = async () => {
    if (uploadedFiles.length === 0) return;

    setIsClearing(true);
    try {
      const clientSlug = generateClientSlug(selectedClient.name);
      const monthPath = getCurrentMonthPath();
      const folderPath = `${clientSlug}/${monthPath}`;

      // Get all files in the folder
      const { data: files, error: listError } = await supabase.storage
        .from('analytics_screenshots')
        .list(folderPath);

      if (listError) throw listError;

      if (files && files.length > 0) {
        // Filter out .keep files and create full paths
        const filesToDelete = files
          .filter(file => file.name !== '.keep')
          .map(file => `${folderPath}/${file.name}`);

        if (filesToDelete.length > 0) {
          // Delete all files
          const { error: deleteError } = await supabase.storage
            .from('analytics_screenshots')
            .remove(filesToDelete);

          if (deleteError) throw deleteError;
        }
      }

      // Clear local state
      setUploadedFiles([]);
      toast.success('All screenshots cleared successfully!');
      setShowClearAllModal(false);
    } catch (error) {
      console.error('Clear all error:', error);
      toast.error('Failed to clear all screenshots');
    } finally {
      setIsClearing(false);
    }
  };

  const currentMonth = format(new Date(), 'MMMM yyyy');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics for {selectedClient.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {currentMonth} • Upload analytics screenshots for this month's report
          </p>
        </div>
        
        {uploadedFiles.length > 0 && (
          <button
            onClick={() => setShowClearAllModal(true)}
            disabled={isClearing}
            className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
          >
            <Trash2 className="w-4 h-4" />
            {isClearing ? 'Clearing...' : 'Clear All'}
          </button>
        )}
      </div>

      {/* Setup Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
              ⚠️ Supabase Storage Setup Required
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              Before uploading screenshots, you must create the storage bucket in your Supabase project:
            </p>
            <ol className="text-sm text-amber-700 dark:text-amber-300 space-y-1 ml-4 list-decimal">
              <li>Go to your <strong>Supabase Dashboard → Storage</strong></li>
              <li>Click <strong>"New bucket"</strong></li>
              <li>Name it: <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">analytics_screenshots</code></li>
              <li>Set it to <strong>"Public"</strong> for PDF access</li>
              <li>Optionally add 7-day lifecycle rules for auto-cleanup</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Upload Analytics Screenshots
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Upload GA4, Google Business Profile, or other analytics screenshots (max {MAX_FILES} files, 10MB each)
          </p>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          } ${uploadedFiles.length >= MAX_FILES ? 'opacity-50 pointer-events-none' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {uploadedFiles.length >= MAX_FILES 
              ? `Maximum ${MAX_FILES} files reached`
              : 'Drop files here or click to select'
            }
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            JPEG, PNG, WebP up to 10MB each
          </p>
          
          {uploadedFiles.length < MAX_FILES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              Select Files
            </button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_TYPES.join(',')}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
        </div>

        {/* File Counter */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {uploadedFiles.length} of {MAX_FILES} files uploaded
          </span>
          
          {/* Warning Note */}
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-4 h-4" />
            <span>Screenshots auto-delete after 7 days</span>
          </div>
        </div>
      </div>

      {/* Uploaded Files Grid */}
      {uploadedFiles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Uploaded Screenshots ({uploadedFiles.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="relative group">
                <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  {file.uploading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
                      </div>
                    </div>
                  ) : file.url ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  {!file.uploading && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => replaceFile(file.id)}
                        className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                        title="Replace file"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteFile(file.id)}
                        className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                        title="Delete file"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {file.uploading ? 'Uploading...' : 'Ready for report'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        onConfirm={clearAllUploads}
        title="Clear All Screenshots"
        message={`Are you sure you want to delete all ${uploadedFiles.length} screenshot(s) for ${selectedClient.name} in ${currentMonth}? This action cannot be undone.`}
      />

      {/* Empty State */}
      {uploadedFiles.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Screenshots Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Upload analytics screenshots to include them in this month's report
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            Upload Screenshots
          </button>
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Setup Required: Supabase Storage
            </h4>
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">How It Works</h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <p>• Screenshots are organized by client and month</p>
              <p>• Files auto-delete after 7 days (with lifecycle rules)</p>
              <p>• Uploaded images appear in generated PDF reports</p>
              <p>• Supports JPEG, PNG, WebP formats (max 10MB each)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}