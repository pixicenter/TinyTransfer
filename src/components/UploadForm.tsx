import React, { useState, useRef, useEffect } from 'react';
import { useLocale } from '../lib/LocaleContext';
import { useSettings } from '../lib/SettingsContext';

interface UploadFormProps {
  onUploadComplete: (data: { downloadLink: string, emailSent?: boolean }) => void;
}

// Define the types for the upload stages
type UploadStage = 'uploading' | 'archiving' | 'encrypting' | 'completing';

export default function UploadForm({ onUploadComplete }: UploadFormProps) {
  const { t, locale } = useLocale();
  const { settings } = useSettings();
  const [password, setPassword] = useState('');
  const [expiration, setExpiration] = useState('14');
  const [transferName, setTransferName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<UploadStage>('uploading');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [localEncryption, setLocalEncryption] = useState(false);
  const [localEncryptionKeySource, setLocalEncryptionKeySource] = useState<'transfer_name' | 'timestamp'>('transfer_name');
  const [processedFiles, setProcessedFiles] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if the password is required (when encryption is enabled and the key source is "password")
  const isPasswordRequired = settings.encryption_enabled && settings.encryption_key_source === 'password';
  const isEncryptionEnabled = settings.encryption_enabled;
  const canUseLocalEncryption = !isEncryptionEnabled;
  
  // Function to get the current stage text
  const getStageText = (): string => {
    switch (uploadStage) {
      case 'uploading':
        return t('upload.uploadingFiles');
      case 'archiving':
        return t('upload.archivingFiles');
      case 'encrypting':
        return t('upload.encryptingFiles');
      case 'completing':
        return t('upload.completingTransfer');
      default:
        return t('upload.uploading');
    }
  };

  // Update the transfer name suggestion when the selected files change
  useEffect(() => {
    if (selectedFiles.length > 0 && !transferName) {
      // Extract the name of the first file without extension
      const firstFileName = selectedFiles[0].name;
      const nameWithoutExtension = firstFileName.split('.').slice(0, -1).join('.');
      setTransferName(nameWithoutExtension || t('upload.title'));
    }
  }, [selectedFiles, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(filesArray);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      setSelectedFiles(filesArray);
      setError('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getTotalSize = () => {
    return selectedFiles.reduce((total, file) => total + file.size, 0);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
      setError(t('errors.fileRequired'));
      return;
    }
    
    // Check if the password is required and if it has been completed
    if (isPasswordRequired && !password.trim()) {
      setError(t('errors.passwordRequired'));
      return;
    }
    
    // Check if the email is valid, if it has been entered
    if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError(t('errors.invalidEmail'));
      return;
    }
    
    setUploading(true);
    setError('');
    setUploadStage('uploading');
    setUploadProgress(0);
    setIsUploading(true);
    setProcessedFiles(0);
    setTotalFiles(selectedFiles.length);
    
    try {
      // Create a new FormData object
      const formData = new FormData();
      
      // Add metadata fields
      formData.append('password', password);
      formData.append('expiration', expiration);
      formData.append('transferName', transferName.trim() || t('upload.title'));
      // Add the email to formData if it exists
      if (email) {
        formData.append('email', email);
      }
      
      // Add local encryption settings if enabled
      if (canUseLocalEncryption && localEncryption) {
        formData.append('localEncryption', 'true');
        formData.append('localEncryptionKeySource', localEncryptionKeySource);
      }
      
      // Add files in chunks of 10 to prevent memory issues with huge uploads
      const MAX_BATCH_SIZE = 10;
      const totalBatches = Math.ceil(selectedFiles.length / MAX_BATCH_SIZE);
      
      // For large file counts (>100), use a different approach
      const isLargeUpload = selectedFiles.length > 100;
      let transferId: string | null = null;
      let uploadedFiles = 0;
      
      if (isLargeUpload) {
        setUploadStage('uploading');
        // Process files in batches - first we send metadata to create a session
        const initResponse = await fetch(`/api/upload/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transferName: transferName.trim() || t('upload.title'),
            fileCount: selectedFiles.length,
            totalSize: getTotalSize(),
            password,
            expiration,
            email: email || '',
            localEncryption: canUseLocalEncryption && localEncryption,
            localEncryptionKeySource
          }),
        });
        
        if (!initResponse.ok) {
          throw new Error(`Failed to initialize upload: ${initResponse.statusText}`);
        }
        
        const initData = await initResponse.json();
        transferId = initData.transferId;
        
        // Upload files in batches
        for (let i = 0; i < selectedFiles.length; i += MAX_BATCH_SIZE) {
          const batch = selectedFiles.slice(i, Math.min(i + MAX_BATCH_SIZE, selectedFiles.length));
          const batchData = new FormData();
          
          // Add the transfer ID to each batch
          if (transferId) {
            batchData.append('transferId', transferId);
          } else {
            throw new Error('ID-ul transferului nu a fost generat corect');
          }
          
          // Add batch files
          for (const file of batch) {
            batchData.append('files', file);
          }
          
          // Upload the batch
          const batchResponse = await fetch(`/api/upload/batch`, {
            method: 'POST',
            body: batchData,
          });
          
          if (!batchResponse.ok) {
            throw new Error(`Failed to upload batch: ${batchResponse.statusText}`);
          }
          
          // Update progress
          uploadedFiles += batch.length;
          setProcessedFiles(uploadedFiles);
          setUploadProgress(Math.min(60, Math.round((uploadedFiles / selectedFiles.length) * 60)));
        }
        
        // Finalize the upload
        setUploadStage('archiving');
        setUploadProgress(60);
        
        const finalizeResponse = await fetch(`/api/upload/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transferId
          }),
        });
        
        if (!finalizeResponse.ok) {
          throw new Error(`Failed to finalize upload: ${finalizeResponse.statusText}`);
        }
        
        // Process finalization result
        const result = await finalizeResponse.json();
        
        if (isEncryptionEnabled) {
          setUploadStage('encrypting');
          setUploadProgress(80);
          setTimeout(() => {
            setUploadProgress(95);
          }, 1000);
        } else {
          setUploadStage('completing');
          setUploadProgress(90);
        }
        
        // Complete the process
        setTimeout(() => {
          setUploadProgress(100);
          setUploading(false);
          onUploadComplete({
            downloadLink: result.downloadLink,
            emailSent: result.emailSent
          });
          
          // Clear the selected files
          clearFiles();
        }, 1500);
        
        return;
      }
      
      // Regular upload process for smaller file counts
      selectedFiles.forEach(file => formData.append('files', file));
      
      // Simulate different stages of the process
      
      // Stage 1: Uploading files (0-60%)
      const uploadingInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 60) {
            clearInterval(uploadingInterval);
            // Go to the next stage - archiving
            setUploadStage('archiving');
            return 60;
          }
          return prev + 5;
        });
      }, 300);
      
      // Send the files to the server
      const response = await fetch(`/api/upload?transferId=${encodeURIComponent(transferName.trim() || t('upload.title'))}`, {
        method: 'POST',
        body: formData,
      });
      
      // After receiving the response, simulate the rest of the stages
      
      // Stage 2: Archiving files (60-80%)
      clearInterval(uploadingInterval);
      setUploadStage('archiving');
      setUploadProgress(60);
      
      // Simulate archiving
      const archivingInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 80) {
            clearInterval(archivingInterval);
            
            // If encryption is enabled, go to the encryption stage
            if (isEncryptionEnabled) {
              setUploadStage('encrypting');
            } else {
              // Otherwise, go directly to completion
              setUploadStage('completing');
            }
            
            return prev;
          }
          return prev + 2;
        });
      }, 200);
      
      // Wait a little for the simulation of archiving
      await new Promise(resolve => setTimeout(resolve, 1500));
      clearInterval(archivingInterval);
      
      // Stage 3: Encryption (if enabled) (80-95%)
      if (isEncryptionEnabled) {
        setUploadStage('encrypting');
        setUploadProgress(80);
        
        const encryptingInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 95) {
              clearInterval(encryptingInterval);
              setUploadStage('completing');
              return 95;
            }
            return prev + 1;
          });
        }, 100);
        
        // Wait a bit for the simulation of encryption
        await new Promise(resolve => setTimeout(resolve, 1500));
        clearInterval(encryptingInterval);
      }
      
      // Stage 4: Completing the transfer (95-100%)
      setUploadStage('completing');
      setUploadProgress(prev => Math.max(prev, 95));
      
      const finalInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(finalInterval);
            return 100;
          }
          return prev + 1;
        });
      }, 50);
      
      // Process the response
      const result = await response.json();
      clearInterval(finalInterval);
      setUploadProgress(100);
      
      if (result.error) {
        setError(result.error);
        setUploading(false);
        return;
      }
      
      // Complete the upload process
      setUploading(false);
      onUploadComplete({
        downloadLink: result.downloadLink,
        emailSent: result.emailSent || false
      });
      
      // Clear the selected files
      clearFiles();
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(t('errors.uploadError'));
      setUploading(false);
      setIsUploading(false);
    }
  };
  
  const clearFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {isPasswordRequired && (
        <div className="bg-gray-500/50 border-l-4 border-green-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-white-700">
                {t('upload.encryptionPasswordInfo')}
              </p>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div 
          className={`relative p-8 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-200
            ${uploading ? 'bg-black-800 border-gray-300' : 'hover:border-indigo-500 hover:bg-black-800 border-gray-300'}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-10 rounded-xl">
              <div className="w-full max-w-md mx-auto px-6">
                <div className="mb-2 flex justify-between text-sm text-white-600">
                  <span>{getStageText()}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-400 rounded-full h-2.5">
                  <div 
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          
          <input 
            ref={fileInputRef}
            type="file" 
            multiple 
            onChange={handleFileChange} 
            className="hidden"
            disabled={uploading}
          />
          
          {selectedFiles.length > 0 ? (
            <div>
              <div className="mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-white-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="font-medium text-white-900">{selectedFiles.length} {t('transfers.files')}</p>
                <p className="text-sm text-white-500">{t('transfers.totalSize')}: {formatBytes(getTotalSize())}</p>
              </div>
              <div className="mt-4 max-h-40 overflow-y-auto px-4 py-2 rounded-lg">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-200 truncate max-w-xs">{file.name}</span>
                    <span className="text-xs text-gray-200">{formatBytes(file.size)}</span>
                  </div>
                ))}
              </div>
              {!uploading && (
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); clearFiles(); }}
                  className="mt-4 text-sm text-indigo-500 hover:text-indigo-700 border border-indigo-200 px-3 py-1 rounded-md hover:bg-indigo-50 hover:border-indigo-500"
                >
                  {t('upload.cancel')}
                </button>
              )}
            </div>
          ) : (
            <div className="py-6">
              <div className="mb-4 flex items-center justify-center">
                <svg className="w-12 h-12 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium mb-1">
                {t('dashboard.dragDrop')}
              </p>
              <p className="text-gray-500 text-sm">
                {t('common.or')} <span className="text-indigo-500">{t('dashboard.browse')}</span> {t('upload.dropzone')}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="transferName" className="block text-sm font-medium text-indigo-500">
              {t('upload.transferName')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <input
                id="transferName"
                type="text"
                placeholder={t('upload.transferNamePlaceholder')}
                value={transferName}
                onChange={(e) => setTransferName(e.target.value)}
                className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-500"
                disabled={uploading}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('upload.transferNamePlaceholder')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-indigo-500">
                {t('upload.emailRecipient')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder={t('upload.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-500"
                  disabled={uploading}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('upload.emailInfo')}
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-indigo-500">
                {t('upload.password')} {isPasswordRequired && <span className="text-red-500/50">*</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder={isPasswordRequired ? t('errors.passwordRequired') : t('upload.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-10 w-full p-2 border ${isPasswordRequired && !password.trim() ? 'border-red-500 bg-red-50' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 hover:border-indigo-500`}
                  disabled={uploading}
                  required={isPasswordRequired}
                />
              </div>
              {isPasswordRequired && (
                <p className="text-xs text-red-500/50 mt-1">
                  {t('upload.passwordRequiredNote')}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="expiration" className="block text-sm font-medium text-indigo-500">
                {t('upload.expiration')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <select
                  id="expiration"
                  value={expiration}
                  onChange={(e) => setExpiration(e.target.value)}
                  className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-none hover:border-indigo-500"
                  disabled={uploading}
                >
                  <option value="1">1 {t('upload.days')}</option>
                  <option value="3">3 {t('upload.days')}</option>
                  <option value="7">7 {t('upload.days')}</option>
                  <option value="14">14 {t('upload.days')} ({t('common.default')})</option>
                  <option value="30">30 {t('upload.days')}</option>
                  <option value="0">{t('upload.never')}</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 text-red-500 p-3 rounded-md text-sm flex items-start">
            <svg className="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || selectedFiles.length === 0 || (isPasswordRequired && !password.trim())}
          className={`mt-6 w-full py-3 px-4 rounded-md font-medium text-white flex items-center justify-center
            ${uploading || selectedFiles.length === 0 || (isPasswordRequired && !password.trim())
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 hover:border-indigo-500'}`}
        >
          {uploading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('upload.uploading')}
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {t('upload.uploadButton')}
            </>
          )}
        </button>
      </form>
      <div className="upload-progress-container">
        {isUploading && uploadStage === 'uploading' && totalFiles > 100 && (
          <div className="batch-progress">
            <span>
              {processedFiles} / {totalFiles} {t('upload.processingFiles')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
} 