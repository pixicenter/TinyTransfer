'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings, AppSettings } from '../../../lib/SettingsContext';
import { useThemeStyles } from '../../../lib/useThemeStyles';
import { useLocale } from '../../../lib/LocaleContext';
import Image from 'next/image';

interface GalleryImage {
  name: string;
  path: string;
  size: number;
  created: string;
}

type TabName = 'general' | 'slideshow';

export default function AdminSettingsPage() {
  const styles = useThemeStyles();
  const { settings: globalSettings, updateSettings } = useSettings();
  const { t } = useLocale();
  const [localSettings, setLocalSettings] = useState<AppSettings>({
    id: 1,
    app_name: '',
    logo_url: null,
    logo_url_dark: null,
    logo_url_light: null,
    logo_type: 'url',
    theme: 'dark',
    language: 'en',
    slideshow_interval: 6000,
    slideshow_effect: 'fade',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabName>('general');

  const loadGalleryImages = useCallback(async () => {
    try {
      setIsLoadingGallery(true);
      const response = await fetch('/api/gallery?mode=admin', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setGalleryImages(data.images || []);
      } else {
        setError(t('settings.galleryLoadFailed'));
      }
    } catch (error) {
      console.error(t('settings.galleryLoadFailed'), error);
      setError(t('settings.galleryLoadFailed'));
    } finally {
      setIsLoadingGallery(false);
    }
  }, [t]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (!data.isAuthenticated) {
          setIsAuthenticated(false);
          setError(t('auth.unauthorized'));
          return;
        }
        
        setIsAuthenticated(true);
        setLoading(false);
        loadGalleryImages();
      } catch (error) {
        console.error(t('errors.authCheckFailed'), error);
        setError(t('errors.serverError'));
        setLoading(false);
      }
    };
    checkAuth();
  }, [t, loadGalleryImages]);

  useEffect(() => {
    if (isAuthenticated) {
      setLocalSettings(prevSettings => ({...prevSettings, ...globalSettings, theme: 'dark' }));
    }
  }, [globalSettings, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // if logo_type is url and logo_url_dark is not null and starts with http, then upload the logo to the server
      if (localSettings.logo_type === 'url' && localSettings.logo_url_dark && localSettings.logo_url_dark.startsWith('http')) {
        try {
          setIsUploading(true);
          const logoUrl = localSettings.logo_url_dark;
          
          // Create FormData with logo URL
          const formData = new FormData();
          formData.append('logoUrl', logoUrl);
          formData.append('type', 'logo');
          
          // Add oldLogo for deletion if there is a previous logo
          const url = new URL('/api/logo', window.location.origin);
          const oldLogoPath = globalSettings.logo_url_dark;
          if (oldLogoPath && !oldLogoPath.startsWith('http') && oldLogoPath !== logoUrl) {
            url.searchParams.append('oldLogo', oldLogoPath);
          }
          
          const response = await fetch(url, {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
          
          if (response.ok) {
            const data = await response.json();
            // Update settings with the local logo path
            localSettings.logo_url_dark = data.path;
            localSettings.logo_type = 'file'; // Convert to 'file' since it's now stored locally
            setSuccess(t('settings.logoDownloadSuccess'));
          } else {
            const errorData = await response.json();
            setError(errorData.error || t('settings.logoDownloadFailed'));
            setIsUploading(false);
            setSaving(false);
            return; // Stop the process if the download fails
          }
          setIsUploading(false);
        } catch (error) {
          console.error(t('settings.logoDownloadFailed'), error);
          setError(t('settings.logoDownloadFailed'));
          setIsUploading(false);
          setSaving(false);
          return; // Stop the process if the download fails
        }
      }
      
      await updateSettings({ ...localSettings, theme: 'dark' }); 
      setSuccess(t('settings.saveSuccess'));
    } catch (error) {
      console.error(t('settings.saveFailed'), error);
      setError(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalSettings({ ...localSettings, [name]: value });
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setLocalSettings({ ...localSettings, [name]: value });
  };

  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalSettings({ ...localSettings, [name]: parseInt(value, 10) });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'logo'); 
    
    const url = new URL('/api/logo', window.location.origin);
    
    const oldLogoPath = localSettings.logo_url_dark;
    if (oldLogoPath && !oldLogoPath.startsWith('http')) {
      url.searchParams.append('oldLogo', oldLogoPath);
    }
    
    try {
      setIsUploading(true);
      setError(null);
      setSuccess(null);
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const updatedSettings = {
          ...localSettings,
          logo_type: 'file' as const,
          logo_url_dark: data.path,
          logo_url_light: null
        };
        
          await updateSettings(updatedSettings);
          setLocalSettings(updatedSettings);
          setSuccess(t('settings.logoUploadSuccess'));
          
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || t('settings.logoUploadFailed'));
      }
    } catch (error) {
      console.error(t('settings.logoUploadFailed'), error);
      setError(t('settings.logoUploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleApplyLogoUrl = async () => {
    if (!localSettings.logo_url_dark || !localSettings.logo_url_dark.startsWith('http')) {
      setError(t('settings.invalidLogoUrl'));
      return;
    }
    
    try {
      setIsUploading(true);
      setError(null);
      setSuccess(null);
      
      const logoUrl = localSettings.logo_url_dark;
      const formData = new FormData();
      formData.append('logoUrl', logoUrl);
      formData.append('type', 'logo');
      
      // Add oldLogo for deletion if there is a previous logo
      const url = new URL('/api/logo', window.location.origin);
      const oldLogoPath = localSettings.logo_url_dark;
      if (oldLogoPath && !oldLogoPath.startsWith('http')) {
        url.searchParams.append('oldLogo', oldLogoPath);
      }
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const updatedSettings = {
          ...localSettings,
          logo_type: 'file' as const,
          logo_url_dark: data.path,
          logo_url_light: null
        };
        
        await updateSettings(updatedSettings);
        setLocalSettings(updatedSettings);
        setSuccess(t('settings.logoDownloadSuccess'));
      } else {
        const errorData = await response.json();
        setError(errorData.error || t('settings.logoDownloadFailed'));
      }
    } catch (error) {
      console.error('Error downloading logo from URL:', error);
      setError(t('settings.logoDownloadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const deleteLogo = async () => {
    const logoPath = localSettings.logo_url_dark;
    if (!logoPath) return;
    
    try {
      setIsUploading(true);
      setError(null);
      setSuccess(null);
      
      let canUpdateDb = false;
      
      if (logoPath.startsWith('http')) {
        // console.log(`Logo is an external URL: ${logoPath}. It will be deleted from settings.`);
        canUpdateDb = true;
      } else {
        // console.log(`Attempting to delete local logo: ${logoPath}`);
      const response = await fetch(`/api/logo?path=${encodeURIComponent(logoPath)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
          // console.log(`Local logo ${logoPath} has been deleted successfully from server.`);
          canUpdateDb = true;
        } else {
          const errorData = await response.json();
          console.error(`Error deleting local logo ${logoPath}:`, errorData);
          setError(errorData.error || t('settings.logoDeleteFailed'));
        }
      }

      if (canUpdateDb) {
        const updatedSettings = { 
          ...localSettings,
          logo_url_dark: null,
          logo_url_light: null,
        };
        
        await updateSettings(updatedSettings);
          setLocalSettings(updatedSettings);
          setSuccess(t('settings.logoDeleteSuccess'));
      }
    } catch (error) {
      console.error(t('settings.logoDeleteFailed'), error);
      setError(t('settings.logoDeleteFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(null);
      setUploadProgress({});
      
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const response = await fetch('/api/gallery', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || t('settings.uploadFailed'));
          }
          
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
          return true;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          setUploadProgress(prev => ({ ...prev, [file.name]: -1 }));
          throw error;
        }
      });
      
      await Promise.all(uploadPromises);
      setUploadSuccess(t('settings.uploadSuccess'));
      await loadGalleryImages();
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error(t('settings.uploadFailed'), error);
      setUploadError(t('settings.uploadFailed'));
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  const handleDeleteImage = async (fileName: string) => {
    try {
      const response = await fetch(`/api/gallery?fileName=${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        setSuccess(t('settings.deleteSuccess'));
        await loadGalleryImages();
      } else {
        const errorData = await response.json();
        setError(errorData.error || t('settings.deleteFailed'));
      }
    } catch (error) {
      console.error(t('settings.deleteFailed'), error);
      setError(t('settings.deleteFailed'));
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${styles.pageBg} py-8 px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-2xl mx-auto">
          <div className={`${styles.cardBg} rounded-xl shadow-lg p-8 flex flex-col items-center justify-center`}>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <p className={styles.subText}>{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen ${styles.pageBg} py-8 px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-2xl mx-auto">
          <div className={`${styles.cardBg} rounded-xl shadow-lg p-8 text-center`}>
            <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m0 0v2m0-2h2m-2 0H9m4-6v.01M5 12h.01M12 5h.01M19 12h.01M12 5H9m0 0H6a3 3 0 00-3 3v12a3 3 0 003 3h12a3 3 0 003-3V8a3 3 0 00-3-3h-3m-1 0h-2m0 0v1m0-1H9m0 0H6a3 3 0 00-3 3v12a3 3 0 003 3h12a3 3 0 003-3V8a3 3 0 00-3-3h-3m-1 0h-2m0 0v1m0-1h-2" />
            </svg>
            <h2 className={`text-xl font-medium ${styles.cardTitle} mb-4`}>{t('errors.forbidden')}</h2>
            <p className={`${styles.subText} mb-6`}>{t('auth.unauthorized')}</p>
            <button 
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {t('header.dashboard')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${styles.pageBg} py-8 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${styles.headingText}`}>
            {t('settings.title')}
          </h1>
          <p className={`mt-2 ${styles.subText}`}>
            {t('settings.general')}
          </p>
        </div>

        {error && (
          <div className={`mb-4 p-4 ${styles.dangerBg} rounded-md border ${globalSettings.theme === 'dark' ? 'border-red-800' : 'border-red-200'}`}>
            <p className={styles.dangerText}>{error}</p>
          </div>
        )}

        {success && (
          <div className={`mb-4 p-4 ${styles.successBg} rounded-md border ${globalSettings.theme === 'dark' ? 'border-green-800' : 'border-green-200'}`}>
            <p className={styles.successText}>{success}</p>
          </div>
        )}

        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <ul className="flex flex-wrap -mb-px text-sm font-medium text-center">
            {(['general', 'slideshow'] as TabName[]).map(tabName => (
              <li className="mr-2" key={tabName}>
                <button
                  onClick={() => setActiveTab(tabName)}
                  className={`inline-block p-4 rounded-t-lg transition-colors duration-150 ease-in-out ${
                    activeTab === tabName
                      ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                      : `hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 ${styles.secondaryText}`
                  }`}
                >
                  {tabName === 'general' && t('settings.generalSettings')}
                  {tabName === 'slideshow' && t('settings.slideshowSettings')}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {activeTab === 'general' && (
            <div className={`${styles.cardBg} rounded-xl shadow-lg p-6 transition-all duration-200 hover:shadow-xl mb-6`}>
              <h2 className={`text-xl font-semibold ${styles.cardTitle} mb-4`}>{t('settings.generalSettings')}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="app_name" className={`block text-sm font-medium ${styles.labelText}`}>
                    {t('settings.appName')}
                  </label>
                  <input
                    type="text"
                    id="app_name"
                    name="app_name"
                    value={localSettings.app_name}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full p-2 border ${styles.border} rounded-md shadow-sm ${styles.input} focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                    required
                  />
                  <p className={`mt-1 text-xs ${styles.secondaryText}`}>{t('settings.appNameHelp')}</p>
                </div>

                <div>
                  <label htmlFor="logo_type" className={`block text-sm font-medium ${styles.labelText} mb-2`}>
                    {t('settings.logoType')}
                  </label>
                  <div className="flex space-x-4 mb-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="logo_type_url"
                        name="logo_type"
                        value="url"
                        checked={localSettings.logo_type === 'url'}
                        onChange={() => setLocalSettings({...localSettings, logo_type: 'url'})}
                        className={`h-4 w-4 text-indigo-600 ${styles.radioInput}`}
                      />
                      <label htmlFor="logo_type_url" className={`ml-2 text-sm ${styles.labelText}`}>
                        URL
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="logo_type_file"
                        name="logo_type"
                        value="file"
                        checked={localSettings.logo_type === 'file'}
                        onChange={() => setLocalSettings({...localSettings, logo_type: 'file'})}
                        className={`h-4 w-4 text-indigo-600 ${styles.radioInput}`}
                      />
                      <label htmlFor="logo_type_file" className={`ml-2 text-sm ${styles.labelText}`}>
                        {t('settings.logoTypeFile')}
                      </label>
                    </div>
                  </div>

                  {localSettings.logo_type === 'url' ? (
                    <>
                      <div className="mb-4">
                        <label htmlFor="logo_url_dark" className={`block text-sm font-medium ${styles.labelText}`}>
                          {t('settings.appLogo')}
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                          <input
                            type="text"
                            id="logo_url_dark"
                            name="logo_url_dark"
                            value={localSettings.logo_url_dark || ''}
                            onChange={(e) => setLocalSettings({...localSettings, logo_url_dark: e.target.value})}
                            className={`flex-1 block w-full p-2 border ${styles.border} rounded-l-md shadow-sm ${styles.input} focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                            placeholder="https://website.com/logo.png"
                          />
                          <button
                            type="button"
                            onClick={handleApplyLogoUrl}
                            disabled={isUploading || !localSettings.logo_url_dark}
                            className={`inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white ${isUploading || !localSettings.logo_url_dark ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                          >
                            {isUploading ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {t('common.downloading')}
                              </>
                            ) : (
                              <>{t('settings.applyLogo')}</>
                            )}
                          </button>
                        </div>
                        <p className={`mt-1 text-xs text-blue-500 dark:text-blue-400`}>{t('settings.logoUrlDownloadInfo')}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mb-6">
                        <label className={`block text-sm font-medium ${styles.labelText} mb-2`}>
                          {t('settings.appLogo')}
                        </label>
                        <input
                          type="file"
                          id="logo_file"
                          name="logo_file"
                          accept="image/png,image/svg+xml,image/jpeg,image/webp"
                          ref={logoInputRef}
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <div className="flex flex-col space-y-3">
                          {localSettings.logo_url_dark && (
                            <div className={`p-3 border ${styles.border} rounded-md mb-2`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center min-w-0">
                                  <div className="h-12 w-12 relative border border-gray-200 rounded-md overflow-hidden bg-gray-900 flex items-center justify-center flex-shrink-0">
                                    {localSettings.logo_url_dark?.startsWith('http') ? (
                                      <Image 
                                        src={localSettings.logo_url_dark} 
                                        alt="Logo" 
                                        width={48}
                                        height={48}
                                        className="object-contain p-1 max-w-full max-h-full"
                                        unoptimized
                                      />
                                    ) : (
                                      <Image 
                                        src={localSettings.logo_url_dark || ''} 
                                        alt="Logo" 
                                        fill 
                                        className="object-contain p-1"
                                      />
                                    )}
                                  </div>
                                  <span className={`ml-3 truncate text-sm ${styles.secondaryText}`}>{localSettings.logo_url_dark.split('/').pop()}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={deleteLogo}
                                  className="p-1 text-red-500 hover:text-red-700"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={isUploading}
                            className={`inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isUploading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                          >
                            {isUploading ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {t('common.uploading')}
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
                                </svg>
                                {t('settings.selectLogo')}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label htmlFor="language" className={`block text-sm font-medium ${styles.labelText}`}>
                    {t('settings.language')}
                  </label>
                  <select
                    id="language"
                    name="language"
                    value={localSettings.language}
                    onChange={handleSelectChange}
                    className={`mt-1 block w-full p-2 border ${styles.border} rounded-md shadow-sm ${styles.input} focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                  >
                    <option value="ro">{t('settings.languageRo')}</option>
                    <option value="en">{t('settings.languageEn')}</option>
                  </select>
                  <p className={`mt-1 text-xs ${styles.secondaryText}`}>{t('settings.languageHelp')}</p>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${saving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('common.processing')}
                      </>
                    ) : t('settings.save')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'slideshow' && (
            <div className="space-y-6">
            <div className={`${styles.cardBg} rounded-xl shadow-lg p-6 transition-all duration-200 hover:shadow-xl mb-6`}>
              <h2 className={`text-xl font-semibold ${styles.cardTitle} mb-4`}>{t('settings.slideshowSettings')}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="slideshow_interval" className={`block text-sm font-medium ${styles.labelText}`}>
                    {t('settings.slideshowInterval')}
                  </label>
                  <div className="flex items-center">
                    <input
                      type="range"
                      id="slideshow_interval"
                      name="slideshow_interval"
                      min="1000"
                      max="15000"
                      step="1000"
                      value={localSettings.slideshow_interval}
                      onChange={handleNumberInputChange}
                      className={`mt-1 block w-full ${styles.input}`}
                    />
                    <span className="ml-2 min-w-[60px] text-sm">{localSettings.slideshow_interval / 1000}s</span>
                  </div>
                  <p className={`mt-1 text-xs ${styles.secondaryText}`}>{t('settings.slideshowIntervalHelp')}</p>
                </div>

                <div>
                  <label htmlFor="slideshow_effect" className={`block text-sm font-medium ${styles.labelText}`}>
                    {t('settings.slideshowEffect')}
                  </label>
                  <select
                    id="slideshow_effect"
                    name="slideshow_effect"
                    value={localSettings.slideshow_effect}
                    onChange={handleSelectChange}
                    className={`mt-1 block w-full p-2 border ${styles.border} rounded-md shadow-sm ${styles.input} focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                  >
                    <option value="fade">{t('settings.effectFade')}</option>
                    <option value="slide">{t('settings.effectSlide')}</option>
                    <option value="zoom">{t('settings.effectZoom')}</option>
                  </select>
                  <p className={`mt-1 text-xs ${styles.secondaryText}`}>{t('settings.slideshowEffectHelp')}</p>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${saving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('common.processing')}
                      </>
                    ) : t('settings.save')}
                  </button>
                </div>
              </form>
            </div>

            <div className={`${styles.cardBg} rounded-xl shadow-lg p-6 transition-all duration-200 hover:shadow-xl`}>
                <h2 className={`text-xl font-semibold ${styles.cardTitle} mb-4`}>{t('settings.galleryManagement')}</h2>
                <div className="space-y-6">
                  <div>
                    <label className={`block text-sm font-medium ${styles.labelText} mb-2`}>{t('settings.uploadNewImage')}</label>
                    <input
                      type="file"
                      id="gallery_file"
                      name="gallery_file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple={true}
                      className="hidden"
                    />
                    <div className="flex flex-col space-y-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className={`inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${isUploading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                      >
                        {isUploading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('common.uploading')}
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
                            </svg>
                            {t('settings.selectImage')}
                          </>
                        )}
                      </button>
                      <p className={`text-xs ${styles.secondaryText}`}>{t('settings.supportedFormats')}</p>
                      
                      {Object.keys(uploadProgress).length > 0 && (
                        <div className="mt-2 space-y-2">
                          {Object.entries(uploadProgress).map(([fileName, progress]) => (
                            <div key={fileName} className="flex items-center space-x-2">
                              <div className="flex-1">
                                <div className="text-xs text-gray-500 truncate">{fileName}</div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div 
                                    className={`h-1.5 rounded-full ${
                                      progress === -1 
                                        ? 'bg-red-500' 
                                        : progress === 100 
                                          ? 'bg-green-500' 
                                          : 'bg-blue-500'
                                    }`}
                                    style={{ width: progress === -1 ? '100%' : `${progress}%` }}
                                  ></div>
                                </div>
                              </div>
                              {progress === -1 && (
                                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                              {progress === 100 && (
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {uploadError && (
                      <p className={`mt-2 text-sm ${styles.dangerText}`}>{uploadError}</p>
                    )}
                    {uploadSuccess && (
                      <p className={`mt-2 text-sm ${styles.successText}`}>{uploadSuccess}</p>
                    )}
                  </div>

                  <div>
                    <h3 className={`text-lg font-medium ${styles.labelText} mb-3`}>{t('settings.galleryImages')}</h3>
                    {isLoadingGallery ? (
                      <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                      </div>
                    ) : galleryImages.length === 0 ? (
                      <p className={`py-4 text-center ${styles.secondaryText}`}>{t('settings.noImages')}</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {galleryImages.map((image) => (
                          <div key={image.path} className={`border ${styles.border} rounded-md overflow-hidden`}>
                            <div className="relative pb-[56.25%]"> {/* 16:9 aspect ratio */}
                              <Image 
                                src={image.path} 
                                alt={image.name}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                className="object-cover"
                              />
                            </div>
                            <div className="p-3">
                              <div className="flex justify-between items-center">
                                <div className="truncate">
                                  <p className={`text-sm font-medium ${styles.cardTitle}`}>{image.name}</p>
                                  <p className={`text-xs ${styles.secondaryText}`}>{formatBytes(image.size)}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteImage(image.name)}
                                  className="p-1 text-red-500 hover:text-red-700"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
                </div>
      </div>
    </div>
  );
} 