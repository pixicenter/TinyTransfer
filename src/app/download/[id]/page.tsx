'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSettings } from '../../../lib/SettingsContext';
import { useLocale } from '../../../lib/LocaleContext';
import Link from 'next/link';
import Image from 'next/image';

interface TransferInfo {
  id: string;
  created_at: string;
  expires_at: string | null;
  size_bytes: number;
  has_password: boolean;
  files: Array<{
    original_name: string;
    size_bytes: number;
  }>;
}

interface SlideImage {
  src: string;
  loaded: boolean;
}

export default function DownloadPage() {
  const { settings } = useSettings();
  const { t, locale, setLocale } = useLocale();
  const { id } = useParams();
  const [transferInfo, setTransferInfo] = useState<TransferInfo | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  
  // State for slideshow
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [slideImages, setSlideImages] = useState<SlideImage[]>([]);
  const [totalImages, setTotalImages] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const slideshowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fetchedRef = useRef(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Initialize the slideshow by getting the total number of images
  useEffect(() => {
    const initializeGallery = async () => {
      try {
        const infoResponse = await fetch('/gallery?mode=info'); // Removed no-cache headers for info
        
        if (infoResponse.ok) {
          const galleryInfo = await infoResponse.json();
          setTotalImages(galleryInfo.total);
          
          if (galleryInfo.total > 0) {
            const galleryResponse = await fetch('/gallery'); // Removed no-cache headers for image list
            
            if (galleryResponse.ok) {
              const galleryData = await galleryResponse.json();
              
              if (galleryData.images && galleryData.images.length > 0) {
                const initialImages = galleryData.images.map((imgSrc: string) => ({
                  src: imgSrc,
                  loaded: false
                }));
                setSlideImages(initialImages);
                
                // Preload all images sequentially to avoid too many parallel requests
                // and mark them as loaded in the slideImages state
                for (const image of initialImages) {
                  await preloadImage(image.src);
                }
                
                // After all images are attempted to preload, set initialized
                // and set the first loaded image as current
                const firstLoadedImageIndex = initialImages.findIndex((img: SlideImage) => img.loaded);
                if (firstLoadedImageIndex !== -1) {
                  setCurrentImageIndex(firstLoadedImageIndex);
                } else if (initialImages.length > 0) {
                   // Fallback if no image could be loaded, try to show the first one
                   // It might appear broken if still not loaded by browser, but better than nothing
                  setCurrentImageIndex(0);
                }
                setIsInitialized(true);

              } else {
                setIsInitialized(true); // No images, but initialization is complete
              }
            } else {
              setIsInitialized(true); // Error fetching gallery data
            }
          } else {
            setIsInitialized(true); // Gallery has no images
          }
        } else {
          console.error('Error loading gallery info:', await infoResponse.text());
          setIsInitialized(true); // Error fetching gallery info
        }
      } catch (error) {
        console.error('Error initializing gallery:', error);
        setIsInitialized(true); // Catch all errors
      }
    };
    
    initializeGallery();
    
    return () => {
      if (slideshowTimerRef.current) {
        clearTimeout(slideshowTimerRef.current);
      }
    };
  }, []); // Removed dependencies that might cause re-initialization

  // Function for preloading a specific image
  const preloadImage = async (imageSrc: string) => {
    // Check if already loaded or src is invalid
    if (!imageSrc || slideImages.find(img => img.src === imageSrc && img.loaded)) {
      return;
    }

    return new Promise<void>((resolve) => {
      const imgElement = new window.Image();
      imgElement.onload = () => {
        setSlideImages(prevImages => 
          prevImages.map(item => 
            item.src === imageSrc ? { ...item, loaded: true } : item
          )
        );
        resolve();
      };
      imgElement.onerror = () => {
        console.error(`Error preloading image: ${imageSrc}`);
        // Optionally mark as failed to load if needed
        resolve(); 
      };
      imgElement.src = `/gallery/${imageSrc}`; // Assuming /gallery serves images directly by name
    });
  };
  

  // Manage the image change according to the settings
  useEffect(() => {
    if (!isInitialized || totalImages === 0 || slideImages.length === 0) return;
    
    const startSlideshow = () => {
      const loadedAndAvailableImages = slideImages.filter(img => img.loaded);
      
      if (loadedAndAvailableImages.length === 0) {
        // No images loaded yet, or all failed.
        // We could try to re-initialize or show a placeholder.
        // For now, just wait and retry if needed or rely on initial load.
        return;
      }
      
      let randomIndex;
      if (loadedAndAvailableImages.length === 1) {
        randomIndex = slideImages.findIndex(img => img.src === loadedAndAvailableImages[0].src);
      } else {
        const availableIndices = loadedAndAvailableImages
            .map(loadedImg => slideImages.findIndex(item => item.src === loadedImg.src))
            .filter(idx => idx !== currentImageIndex);

        if (availableIndices.length > 0) {
          const randomPosition = Math.floor(Math.random() * availableIndices.length);
          randomIndex = availableIndices[randomPosition];
        } else {
          // Fallback to the current index if no other *different* loaded images are available
          // Or pick the first loaded one if current is somehow invalid
           const firstLoadedIdx = slideImages.findIndex(img => img.loaded);
           randomIndex = firstLoadedIdx !== -1 ? firstLoadedIdx : 0;
        }
      }
      
      // No need to call loadImage here anymore as all images are preloaded during initializeGallery
      // const nextRandomIndex = Math.floor(Math.random() * totalImages);
      // loadImage(nextRandomIndex).catch(error => {
      //   console.error('Error loading next image:', error);
      // });
      
      slideshowTimerRef.current = setTimeout(() => {
        if (randomIndex !== undefined && randomIndex < slideImages.length && slideImages[randomIndex]?.loaded) {
          setCurrentImageIndex(randomIndex);
        } else if (loadedAndAvailableImages.length > 0) {
           // Fallback if calculated randomIndex is not loaded, pick the first available loaded image
           const firstTrulyLoadedIndex = slideImages.findIndex(img => img.loaded);
           if(firstTrulyLoadedIndex !== -1) setCurrentImageIndex(firstTrulyLoadedIndex);
        }
      }, settings.slideshow_interval);
    };
    
    startSlideshow();
    
    return () => {
      if (slideshowTimerRef.current) {
        clearTimeout(slideshowTimerRef.current);
      }
    };
  // Ensure dependencies correctly reflect what should trigger re-run of this effect
  }, [currentImageIndex, isInitialized, totalImages, settings.slideshow_interval, slideImages]);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchTransferInfo();
    checkAuth();
  }, [id]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/check');
      if (response.ok) {
        const data = await response.json();
        setIsLoggedIn(data.isAuthenticated);
      }
    } catch (error) {
      console.error(t('errors.authCheckFailed'), error);
      setIsLoggedIn(false);
    }
  };

  const fetchTransferInfo = async () => {
    try {
      const response = await fetch(`/api/download/${id}/info`);
      if (!response.ok) throw new Error(t('errors.transferNotFound'));
      const data = await response.json();
      setTransferInfo(data);
    } catch (err) {
      setError(t('errors.transferExpired'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch(`/api/download/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || t('download.wrongPassword'));
        setIsPasswordValid(false);
        return;
      }
      setIsPasswordValid(true);
      handleDownload();
    } catch (err) {
      setError(t('download.wrongPassword'));
      setIsPasswordValid(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    
    try {
      // Creăm un element <a> temporar pentru a declanșa descărcarea direct în pagina curentă
      const downloadLink = document.createElement('a');
      downloadLink.href = `/api/download/${id}`;
      // Nu setăm atributul download pentru a lăsa browserul să gestioneze răspunsul Content-Disposition
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // Simulăm progresul pentru feedback vizual
      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        if (progress > 95) {
          clearInterval(interval);
          setTimeout(() => {
            setDownloadProgress(100);
            setTimeout(() => {
              setIsDownloading(false);
              setDownloadProgress(0);
            }, 500);
          }, 500);
        } else {
          setDownloadProgress(progress);
        }
      }, 200);
    } catch (err) {
      console.error('Eroare la descărcare:', err);
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleLanguageChange = (newLocale: 'en' | 'ro') => {
    setLocale(newLocale);
    localStorage.setItem('preferredLocale', newLocale);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Determine the current image to display
  // Ensure that currentImageIndex is valid and the image is loaded or it's the only option
  // const currentImageToDisplay = 
  //   isInitialized && slideImages.length > 0 && currentImageIndex < slideImages.length
  //     ? slideImages[currentImageIndex]
  //     : null; // Or a placeholder like { src: 'placeholder.jpg', loaded: true }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        <span className="mt-6 text-lg text-white">{t('common.loading')}</span>
      </div>
    );
  }

  if (error || !transferInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900">
        <div className="max-w-md w-full p-8 text-center backdrop-blur-xl bg-white/20 rounded-xl shadow-lg transform transition-all">
          <svg className="w-20 h-20 mx-auto text-red-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold text-white mb-4">{t('common.error')}</h2>
          <p className="text-pink-100 text-lg mb-6">{error}</p>
          <button
            onClick={() => {
              setError('');
              setIsPasswordValid(false);
              setPassword('');
              setIsLoading(true);
              fetchTransferInfo();
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Display a slideshow for the background and the glass form in the left
  return (
    <>
      {/* Slideshow Background with dynamic loading */}
      <div className={`fixed inset-0 w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900 transition-opacity duration-00 ease-in-out ${isInitialized ? "opacity-100" : "opacity-50"}`} style={{ zIndex: -10 }}>
        {isInitialized && slideImages.length > 0 ? (
          slideImages.map((image, index) => {
            const isActive = index === currentImageIndex && image.loaded;
            // Use currentImageToDisplay for the active image if preferred
            let transitionClass = '';
            const imageStyle: React.CSSProperties = { 
              backgroundImage: image.loaded ? `url('/gallery/${image.src}')` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center center',
              backgroundRepeat: 'no-repeat',
              backgroundColor: image.loaded ? '' : 'rgba(0,0,0,0.1)'
            };
            
            switch(settings.slideshow_effect) {
              case 'fade':
                transitionClass = `transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`;
                break;
              case 'slide':
                transitionClass = `transition-transform duration-1000 ${isActive ? 'translate-x-0' : 'translate-x-full'}`;
                break;
              case 'zoom':
                transitionClass = `transition-all duration-1000 ${isActive ? 'scale-100 opacity-100' : 'scale-110 opacity-0'}`;
                break;
              default:
                transitionClass = `transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`;
            }
            
            return (
              <div
                key={image.src}
                className={`absolute inset-0 w-full h-full ${transitionClass}`}
                style={imageStyle}
              />
            );
          })
        ) : (
          // Nu mai este nevoie de un fallback separat
          null
        )}
        
        {/* Add transparent overlay */}
        <div className="absolute inset-0 w-full h-full bg-black/30"></div>
        
        {/* Debug info - will be displayed only in development */}
        {/* {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-0 right-0 bg-black bg-opacity-70 text-white p-2 text-xs z-50">
            <div>Total images: {totalImages}</div>
            <div>Current image: {currentImageIndex}</div>
            <div>Loaded images: {slideImages.filter(img => img.loaded).length}/{slideImages.length}</div>
            <div>Interval: {settings.slideshow_interval}ms</div>
            <div>Effect: {settings.slideshow_effect}</div>
          </div>
        )} */}
      </div>

      {/* Content */}
      <div className="min-h-screen w-full flex flex-col md:flex-row items-center justify-center md:justify-start p-4 md:p-8">
        <div className="backdrop-blur-xl backdrop-filter bg-white/5 rounded-2xl p-6 md:p-8 w-full md:w-[450px] mt-8 md:mt-12 md:ml-12 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.7)] hover:bg-white/10 transition-all duration-300 relative">

          {/* Logo and title */}
          <div className="mb-6 text-center">
            <Link href="/" className="flex items-center justify-center transition-transform hover:scale-105 duration-300">
              {settings.logo_url ? (
                <Image src={settings.logo_url} alt={'$transferInfo.name'} width={48} height={48} className="mr-3" />
              ) : (
                <svg className="w-12 h-12 mr-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
              <span className="text-2xl font-bold text-white">{settings.app_name}</span>
            </Link>
            <h2 className="text-xl mt-2 text-white/90">{t('download.welcome')}</h2>
            <p className="text-sm mt-1 text-white/70">{t('download.description')}</p>
          </div>
          
          {/* Language selector */}
          <div className="mb-6 flex justify-center">
            <div className="flex space-x-1 bg-white/10 p-1 rounded-lg">
              <button 
                onClick={() => handleLanguageChange('ro')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${locale === 'ro' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-white hover:bg-white/20'}`}
              >
                RO
              </button>
              <button 
                onClick={() => handleLanguageChange('en')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${locale === 'en' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-white hover:bg-white/20'}`}
              >
                EN
              </button>
            </div>
          </div>
          
          <h3 className="text-xl font-semibold mb-4">{t('download.downloadTransfer')}</h3>
          
          {/* Transfer info */}
          <div className="mb-6 p-4 rounded-xl bg-white/10">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-white/90">
                  <span className="font-medium">{t('download.totalSize')}</span> {formatBytes(transferInfo.size_bytes)}
                </p>
              
                <p className="text-white/90">
                  <span className="font-medium">{t('transfers.files')}:</span> {transferInfo.files.length}
                </p>
                {transferInfo.expires_at ? (
                  <p className="text-white/80 text-sm text-right">
                    <span className="font-medium">{t('transfers.expires')}:</span> {formatDate(transferInfo.expires_at)}
                  </p>
                ) : (
                  <p className="text-white/80 text-sm text-right">
                    <span className="font-medium">{t('transfers.expires')}:</span> {t('transfers.permanent')}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Files */}
          <div className="mb-6">
            <h4 className="text-lg font-medium mb-3">{t('download.filesInTransfer')}</h4>
            <div className="bg-white/10 rounded-xl p-4">
              <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {transferInfo.files.map((file, index) => (
                  <li key={index} className="flex justify-between p-2 rounded-lg hover:bg-white/10 transition-colors">
                    <span className="truncate max-w-[70%] text-white/90">{file.original_name}</span>
                    <span className="text-xs bg-white/20 py-1 px-2 rounded-full text-white/80">{formatBytes(file.size_bytes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* Password field (if applicable) */}
          {transferInfo.has_password && !isPasswordValid && (
            <form className="mb-6" onSubmit={handlePasswordSubmit}>
              <label htmlFor="password" className="block text-lg font-medium mb-2 text-white/90">
                {t('download.enterPassword')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  placeholder={t('download.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 pr-10 border border-white/30 bg-white/10 rounded-lg text-white placeholder-white/50 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>
              {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
              <button
                type="submit"
                className="mt-4 w-full py-3 px-6 rounded-lg font-medium text-center transition-all duration-300 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-xl transform hover:-translate-y-1"
              >
                {t('download.downloadButton')}
              </button>
            </form>
          )}
          
          {/* Download button */}
          {(!transferInfo.has_password || isPasswordValid) && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`w-full py-3 px-6 rounded-lg font-medium text-center transition-all duration-300
                ${isDownloading 
                  ? 'bg-green-600 cursor-wait text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-xl transform hover:-translate-y-1'}`}
            >
              {isDownloading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('common.processing')} {downloadProgress}%
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('download.downloadButton')}
                </span>
              )}
            </button>
          )}

        </div>
      </div>
    </>
  );
} 