import React, { useState, useRef, useEffect } from 'react';
import { useLocale } from '../lib/LocaleContext';
import { useSettings } from '../lib/SettingsContext';

interface UploadFormProps {
  onUploadComplete: (data: { downloadLink: string, emailSent?: boolean }) => void;
}

// Define the types for the upload stages
type UploadStage = 'uploading' | 'archiving' | 'encrypting' | 'completing';

// Interfața pentru progresul fiecărei etape
interface StageProgress {
  uploading: number;
  archiving: number;
  encrypting: number;
  completing: number;
}

// Setările pentru configurarea încărcărilor
const UPLOAD_SETTINGS = {
  // Numărul maxim de fișiere per lot
  MAX_BATCH_SIZE: 5,
  // Numărul maxim de cereri paralele (conexiuni simultane)
  MAX_CONCURRENT_REQUESTS: 4,
  // Activează raportarea detaliată a progresului
  DETAILED_PROGRESS: true
};

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
  const [uploadSpeed, setUploadSpeed] = useState<string | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string | null>(null);
  const [canForceFinalize, setCanForceFinalize] = useState(false);
  const [uploadError, setUploadError] = useState<{ message: string, uploadedFiles?: number, expectedFiles?: number } | null>(null);
  
  // Progresul pentru fiecare etapă
  const [stageProgress, setStageProgress] = useState<StageProgress>({
    uploading: 0,
    archiving: 0,
    encrypting: 0,
    completing: 0
  });
  
  // Ponderi pentru fiecare etapă în progresul global (total 100)
  const stageWeights = {
    uploading: 70,
    archiving: 20,
    encrypting: 5,
    completing: 5
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadStartTimeRef = useRef<number | null>(null);
  const totalUploadSizeRef = useRef<number>(0);

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
  
  // Calculează progresul global pe baza progresului fiecărei etape și a ponderilor
  useEffect(() => {
    const globalProgress = 
      (stageProgress.uploading * stageWeights.uploading / 100) +
      (stageProgress.archiving * stageWeights.archiving / 100) +
      (stageProgress.encrypting * stageWeights.encrypting / 100) +
      (stageProgress.completing * stageWeights.completing / 100);
    
    setUploadProgress(Math.round(globalProgress));
  }, [stageProgress]);

  // Update the transfer name suggestion when the selected files change
  useEffect(() => {
    if (selectedFiles.length > 0 && !transferName) {
      // Extract the name of the first file without extension
      const firstFileName = selectedFiles[0].name;
      const nameWithoutExtension = firstFileName.split('.').slice(0, -1).join('.');
      setTransferName(nameWithoutExtension || t('upload.title'));
    }
  }, [selectedFiles, t]);

  // Actualizează timpul estimat rămas când progresul se schimbă
  useEffect(() => {
    if (isUploading && uploadStage === 'uploading' && uploadStartTimeRef.current && processedFiles > 0) {
      const elapsedTime = (Date.now() - uploadStartTimeRef.current) / 1000; // în secunde
      const processedSize = totalUploadSizeRef.current * (processedFiles / totalFiles);
      
      // Calculează viteza în bytes per secundă
      const speedBps = processedSize / elapsedTime;
      const remainingSize = totalUploadSizeRef.current - processedSize;
      
      // Calculează timpul estimat rămas în secunde
      const estimatedSecondsRemaining = remainingSize / speedBps;
      
      // Formatează viteza pentru afișare
      let speedDisplay = '';
      if (speedBps < 1024) {
        speedDisplay = `${speedBps.toFixed(1)} B/s`;
      } else if (speedBps < 1024 * 1024) {
        speedDisplay = `${(speedBps / 1024).toFixed(1)} KB/s`;
      } else {
        speedDisplay = `${(speedBps / (1024 * 1024)).toFixed(1)} MB/s`;
      }
      
      // Formatează timpul pentru afișare
      let timeDisplay = '';
      if (estimatedSecondsRemaining < 60) {
        timeDisplay = `${Math.round(estimatedSecondsRemaining)}s`;
      } else if (estimatedSecondsRemaining < 3600) {
        timeDisplay = `${Math.floor(estimatedSecondsRemaining / 60)}m ${Math.round(estimatedSecondsRemaining % 60)}s`;
      } else {
        timeDisplay = `${Math.floor(estimatedSecondsRemaining / 3600)}h ${Math.floor((estimatedSecondsRemaining % 3600) / 60)}m`;
      }
      
      setUploadSpeed(speedDisplay);
      setEstimatedTimeRemaining(timeDisplay);
    }
  }, [processedFiles, isUploading, uploadStage, totalFiles]);
  
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
  
  // Funcție pentru a încărca un lot de fișiere
  const uploadBatch = async (transferId: string, batchFiles: File[]): Promise<number> => {
    const batchData = new FormData();
    
    // Adaugă ID-ul transferului
    batchData.append('transferId', transferId);
    
    // Adaugă fișierele din acest lot
    for (const file of batchFiles) {
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
    
    const batchResult = await batchResponse.json();
    
    // Folosim numărul real de fișiere procesate din răspunsul API-ului
    if (batchResult.processedFiles !== undefined) {
      return batchResult.processedFiles;
    }
    
    // Cădem înapoi la lungimea lotului dacă răspunsul nu conține processedFiles
    return batchFiles.length;
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
    
    // Resetarea progresului pentru toate etapele
    setStageProgress({
      uploading: 0,
      archiving: 0,
      encrypting: 0,
      completing: 0
    });
    
    setUploading(true);
    setError('');
    setUploadStage('uploading');
    setUploadProgress(0);
    setIsUploading(true);
    setProcessedFiles(0);
    setTotalFiles(selectedFiles.length);
    
    // Inițializează timpul de start și dimensiunea totală
    uploadStartTimeRef.current = Date.now();
    totalUploadSizeRef.current = getTotalSize();
    
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
      
      // Configurare pentru încărcarea în loturi
      const MAX_BATCH_SIZE = UPLOAD_SETTINGS.MAX_BATCH_SIZE;
      const MAX_CONCURRENT_REQUESTS = UPLOAD_SETTINGS.MAX_CONCURRENT_REQUESTS;
      
      let transferId: string | null = null;
      let uploadedFiles = 0;
      
      // Etapa de inițializare
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
      
      if (!transferId) {
        throw new Error('ID-ul transferului nu a fost generat corect');
      }
      
      // Salvează ID-ul transferului în localStorage pentru a-l putea folosi la forțarea finalizării
      localStorage.setItem('lastTransferId', transferId);
      
      // Pregătește loturi de fișiere
      const batches: File[][] = [];
      for (let i = 0; i < selectedFiles.length; i += MAX_BATCH_SIZE) {
        batches.push(selectedFiles.slice(i, Math.min(i + MAX_BATCH_SIZE, selectedFiles.length)));
      }
      
      // Funcție pentru procesarea loturilor în paralel, limitând numărul de cereri simultane
      const processAllBatches = async () => {
        const results = [];
        
        // Pregătește loturi de indecși pentru procesare
        const batchIndices = batches.map((_, index) => index);
        
        // Procesează loturile în grupuri paralele până când toate sunt complete
        while (batchIndices.length > 0) {
          // Ia următorul set de indecși pentru procesare paralelă
          const currentBatchIndices = batchIndices.splice(0, MAX_CONCURRENT_REQUESTS);
          
          // Procesează acest set de loturi în paralel
          const currentPromises = currentBatchIndices.map(index => 
            uploadBatch(transferId!, batches[index])
              .then(filesProcessed => {
                // Actualizează progresul după fiecare lot
                uploadedFiles += filesProcessed;
                setProcessedFiles(uploadedFiles);
                
                // Actualizare progres pentru etapa de upload
                const uploadingProgress = Math.round((uploadedFiles / selectedFiles.length) * 100);
                updateStageProgress('uploading', uploadingProgress);
                
                return filesProcessed;
              })
          );
          
          // Așteaptă ca toate loturile din acest grup să fie procesate
          const currentResults = await Promise.all(currentPromises);
          results.push(...currentResults);
        }
        
        return results;
      };
      
      // Procesează toate loturile
      await processAllBatches();
      
      // Verificăm starea finală a transferului pentru a asigura actualizarea corectă a contorului
      try {
        const statusResponse = await fetch(`/api/upload/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transferId
          }),
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.uploadedFileCount && statusData.uploadedFileCount !== uploadedFiles) {
            console.log(`Actualizare contor fișiere procesate: ${uploadedFiles} -> ${statusData.uploadedFileCount}`);
            uploadedFiles = statusData.uploadedFileCount;
            setProcessedFiles(uploadedFiles);
            
            const uploadingProgress = Math.min(100, Math.round((uploadedFiles / selectedFiles.length) * 100));
            updateStageProgress('uploading', uploadingProgress);
          }
        }
      } catch (error) {
        console.warn('Nu s-a putut verifica starea transferului:', error);
      }
      
      // Etapa de arhivare
      setUploadStage('archiving');
      updateStageProgress('archiving', 10); // Inițial 10% progres pentru arhivare
      
      const finalizeRequest = async (force = false) => {
        const finalizeResponse = await fetch(`/api/upload/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transferId,
            force
          }),
        });
        
        if (!finalizeResponse.ok) {
          if (finalizeResponse.status === 400) {
            const errorData = await finalizeResponse.json();
            if (errorData.canForce) {
              setCanForceFinalize(true);
              setUploadError({
                message: errorData.error,
                uploadedFiles: errorData.uploadedFiles,
                expectedFiles: errorData.expectedFiles
              });
              throw new Error('FORCE_REQUIRED');
            }
          }
          throw new Error(`Failed to finalize upload: ${finalizeResponse.statusText}`);
        }
        
        return await finalizeResponse.json();
      };
      
      let result;
      try {
        result = await finalizeRequest();
      } catch (finalizeError) {
        if ((finalizeError as Error).message === 'FORCE_REQUIRED') {
          // Nu facem nimic aici, doar întrerupem procesul pentru că utilizatorul trebuie să decidă
          setUploading(true); // Menținem starea de încărcare pentru a afișa interfața
          setUploadProgress(70); // Setăm progresul la 70%
          return;
        }
        throw finalizeError; // Reluăm eroarea pentru a fi gestionată de catch-ul extern
      }
      
      // Arhivarea s-a terminat
      updateStageProgress('archiving', 100);
      
      // Etapa de criptare, dacă este activată
      if (isEncryptionEnabled) {
        setUploadStage('encrypting');
        
        // Simulare progres pentru criptare
        let encryptProgress = 0;
        const encryptInterval = setInterval(() => {
          encryptProgress += 10;
          if (encryptProgress > 100) {
            clearInterval(encryptInterval);
            encryptProgress = 100;
          }
          updateStageProgress('encrypting', encryptProgress);
        }, 200);
        
        // Simulăm finalizarea criptării după un timp
        await new Promise(resolve => setTimeout(resolve, 2000));
        clearInterval(encryptInterval);
        updateStageProgress('encrypting', 100);
      }
      
      // Etapa de finalizare
      setUploadStage('completing');
      
      // Simulare progres pentru finalizare
      let completingProgress = 0;
      const completingInterval = setInterval(() => {
        completingProgress += 20;
        if (completingProgress > 100) {
          clearInterval(completingInterval);
          completingProgress = 100;
        }
        updateStageProgress('completing', completingProgress);
      }, 100);
      
      // Simulăm finalizarea după un timp
      await new Promise(resolve => setTimeout(resolve, 500));
      clearInterval(completingInterval);
      updateStageProgress('completing', 100);
      
      // Complete the process
      setTimeout(() => {
        setUploading(false);
        setIsUploading(false);
        setUploadSpeed(null);
        setEstimatedTimeRemaining(null);
        onUploadComplete({
          downloadLink: result.downloadLink,
          emailSent: result.emailSent
        });
        
        // Clear the selected files
        clearFiles();
        // Curăță lastTransferId din localStorage
        localStorage.removeItem('lastTransferId');
      }, 500);
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(t('errors.uploadError'));
      setUploading(false);
      setIsUploading(false);
      setUploadSpeed(null);
      setEstimatedTimeRemaining(null);
    }
  };
  
  const handleForceFinalize = async () => {
    if (!canForceFinalize) return;
    
    try {
      setCanForceFinalize(false);
      setUploadError(null);
      
      // Etapa de arhivare
      setUploadStage('archiving');
      updateStageProgress('archiving', 10);
      
      const transferId = localStorage.getItem('lastTransferId');
      if (!transferId) {
        throw new Error('Missing transfer ID');
      }
      
      const finalizeResponse = await fetch(`/api/upload/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transferId,
          force: true
        }),
      });
      
      if (!finalizeResponse.ok) {
        throw new Error(`Failed to finalize upload: ${finalizeResponse.statusText}`);
      }
      
      const result = await finalizeResponse.json();
      
      // Arhivarea s-a terminat
      updateStageProgress('archiving', 100);
      
      // Etapa de criptare, dacă este activată
      if (isEncryptionEnabled) {
        setUploadStage('encrypting');
        
        // Simulare progres pentru criptare
        let encryptProgress = 0;
        const encryptInterval = setInterval(() => {
          encryptProgress += 10;
          if (encryptProgress > 100) {
            clearInterval(encryptInterval);
            encryptProgress = 100;
          }
          updateStageProgress('encrypting', encryptProgress);
        }, 200);
        
        // Simulăm finalizarea criptării după un timp
        await new Promise(resolve => setTimeout(resolve, 2000));
        clearInterval(encryptInterval);
        updateStageProgress('encrypting', 100);
      }
      
      // Etapa de finalizare
      setUploadStage('completing');
      
      // Simulare progres pentru finalizare
      let completingProgress = 0;
      const completingInterval = setInterval(() => {
        completingProgress += 20;
        if (completingProgress > 100) {
          clearInterval(completingInterval);
          completingProgress = 100;
        }
        updateStageProgress('completing', completingProgress);
      }, 100);
      
      // Simulăm finalizarea după un timp
      await new Promise(resolve => setTimeout(resolve, 500));
      clearInterval(completingInterval);
      updateStageProgress('completing', 100);
      
      // Complete the process
      setTimeout(() => {
        setUploading(false);
        setIsUploading(false);
        setUploadSpeed(null);
        setEstimatedTimeRemaining(null);
        onUploadComplete({
          downloadLink: result.downloadLink,
          emailSent: result.emailSent
        });
        
        // Clear the selected files
        clearFiles();
        // Curăță lastTransferId din localStorage
        localStorage.removeItem('lastTransferId');
      }, 500);
      
    } catch (error) {
      console.error('Force finalize error:', error);
      setError(t('errors.uploadError'));
      setUploading(false);
      setIsUploading(false);
      setUploadSpeed(null);
      setEstimatedTimeRemaining(null);
    }
  };
  
  const clearFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Actualizează progresul pentru etapa curentă
  const updateStageProgress = (stage: UploadStage, progress: number) => {
    setStageProgress(prev => ({
      ...prev,
      [stage]: progress
    }));
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
              <div className="w-full max-w-md mx-auto px-6 space-y-4">
                {/* Progres global */}
                <div className="mb-1">
                  <div className="flex justify-between text-sm text-white-600 mb-1">
                    <span>{t('upload.overallProgress')}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div 
                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Etapa curentă și detalii */}
                <div className="bg-gray-800/50 p-3 rounded-md">
                  <div className="text-sm font-medium text-white-600 mb-2">
                    {getStageText()}
                  </div>
                  
                  {/* Bară de progres pentru etapa de încărcare */}
                  <div className={`mb-2 ${uploadStage === 'uploading' ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="flex justify-between text-xs text-white-400 mb-1">
                      <span>{t('upload.uploadingFiles')}</span>
                      <span>{stageProgress.uploading}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div 
                        className="bg-green-500 h-1.5 rounded-full" 
                        style={{ width: `${stageProgress.uploading}%` }}
                      ></div>
                    </div>
                    {uploadStage === 'uploading' && (
                      <div className="text-xs text-white-400 mt-1 flex justify-between items-center">
                        <span>
                          {processedFiles} / {totalFiles} {t('upload.processingFiles')}
                        </span>
                        {uploadSpeed && estimatedTimeRemaining && (
                          <span className="text-xs text-indigo-400">
                            {uploadSpeed} • {estimatedTimeRemaining}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Bară de progres pentru etapa de arhivare */}
                  <div className={`mb-2 ${uploadStage === 'archiving' ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="flex justify-between text-xs text-white-400 mb-1">
                      <span>{t('upload.archivingFiles')}</span>
                      <span>{stageProgress.archiving}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full" 
                        style={{ width: `${stageProgress.archiving}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Bară de progres pentru etapa de criptare (afișată doar dacă este necesară) */}
                  {isEncryptionEnabled && (
                    <div className={`mb-2 ${uploadStage === 'encrypting' ? 'opacity-100' : 'opacity-60'}`}>
                      <div className="flex justify-between text-xs text-white-400 mb-1">
                        <span>{t('upload.encryptingFiles')}</span>
                        <span>{stageProgress.encrypting}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div 
                          className="bg-purple-500 h-1.5 rounded-full" 
                          style={{ width: `${stageProgress.encrypting}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Bară de progres pentru etapa de finalizare */}
                  <div className={`${uploadStage === 'completing' ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="flex justify-between text-xs text-white-400 mb-1">
                      <span>{t('upload.completingTransfer')}</span>
                      <span>{stageProgress.completing}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div 
                        className="bg-yellow-500 h-1.5 rounded-full" 
                        style={{ width: `${stageProgress.completing}%` }}
                      ></div>
                    </div>
                  </div>
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

        {error && <div className="mb-4 text-red-500">{error}</div>}

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
    </div>
  );
} 