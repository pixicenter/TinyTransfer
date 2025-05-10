'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '../lib/LocaleContext';
import { useThemeStyles } from '../lib/useThemeStyles';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

// Hero slideshow component
const HeroSlideshow = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalImages, setTotalImages] = useState(3); // Default to our known static images
  
  // Cache de imagini pentru a păstra referințele și a evita cereri repetate
  const imageCache = useRef<{[key: string]: HTMLImageElement}>({});
  
  // Load initial images info
  useEffect(() => {
    // Definim imaginile statice în afara funcției async pentru a evita re-crearea array-ului
    const staticImages = [
      '/hero/TinyTransfer-Dashboard.jpg',
      '/hero/TinyTransfer-TransfersPage.jpg',
      '/hero/TinyTransfer-Settings.jpg',
    ];
    
    const initImages = async () => {
      setImages(staticImages);
      setTotalImages(staticImages.length);
      
      // Preload all images in parallel pentru o încărcare mai rapidă
      const preloadPromises = staticImages.map(img => preloadImage(img));
      
      try {
        // Afișăm slideshow-ul când prima imagine este încărcată
        await preloadPromises[0];
        setIsLoading(false);
        
        // Continuăm să încărcăm celelalte imagini în background
        Promise.all(preloadPromises).then(() => {
          console.log('Toate imaginile au fost preîncărcate');
        });
      } catch (error) {
        console.error('Eroare la preîncărcarea imaginilor:', error);
        // Afișăm slideshow-ul chiar dacă preîncărcarea eșuează
        setIsLoading(false);
      }
    };
    
    initImages();
    
    // Curățăm cache-ul la unmount pentru a evita memory leaks
    return () => {
      Object.keys(imageCache.current).forEach(key => {
        // Eliminăm referințele la imagini
        imageCache.current[key].onload = null;
        imageCache.current[key].onerror = null;
        imageCache.current[key].src = '';
        delete imageCache.current[key];
      });
    };
  }, []);
  
  // Function for preloading an image
  const preloadImage = async (src: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // Verificăm dacă imaginea este deja în cache-ul din state
      if (loadedImages.includes(src)) {
        resolve(true);
        return;
      }
      
      // Verificăm dacă imaginea este deja în cache-ul de referință
      if (imageCache.current[src]) {
        // Dacă imaginea este deja încărcată, o adăugăm în state și rezolvăm promisiunea
        if (imageCache.current[src].complete) {
          setLoadedImages(prev => prev.includes(src) ? prev : [...prev, src]);
          resolve(true);
          return;
        }
      }
      
      // Dacă nu există în cache, creăm un nou obiect Image
      const img = new window.Image();
      
      // Adăugăm evenimentele de load și error
      img.onload = () => {
        // Stocăm imaginea în cache pentru referință viitoare
        imageCache.current[src] = img;
        // Actualizăm state-ul cu imaginea încărcată
        setLoadedImages(prev => prev.includes(src) ? prev : [...prev, src]);
        resolve(true);
      };
      
      img.onerror = () => {
        console.error(`Eroare la încărcarea imaginii: ${src}`);
        resolve(false);
      };
      
      // Setăm atributul de crossorigin și cache-control
      img.crossOrigin = 'anonymous';
      // Adăugăm un query parameter cu timestamp pentru a evita cache-ul browserului dacă este nevoie
      // img.src = `${src}?t=${Date.now()}`;
      
      // Setăm sursa imaginii pentru a declanșa încărcarea
      img.src = src;
    });
  };
  
  // Load next image anticipat - folosim useCallback pentru a evita re-crearea funcției
  const preloadNext = React.useCallback(async () => {
    if (images.length === 0) return;
    
    // Calculate next image index
    const nextIndex = (currentImageIndex + 1) % totalImages;
    if (nextIndex < images.length && !loadedImages.includes(images[nextIndex])) {
      await preloadImage(images[nextIndex]);
    }
  }, [currentImageIndex, images, loadedImages, totalImages]);
  
  // Folosim useEffect pentru a preîncărca următoarea imagine când se schimbă imaginea curentă
  useEffect(() => {
    if (isLoading) return;
    
    preloadNext();
  }, [currentImageIndex, isLoading, preloadNext]);
  
  // Change image every 6 seconds
  useEffect(() => {
    if (images.length === 0 || isLoading) return;
    
    const timer = setTimeout(() => {
      const nextIndex = (currentImageIndex + 1) % totalImages;
      // Check if next image is loaded before changing
      if (loadedImages.includes(images[nextIndex])) {
        setCurrentImageIndex(nextIndex);
      }
    }, 6000); // Increased interval for a better experience
    
    return () => clearTimeout(timer);
  }, [currentImageIndex, images, loadedImages, isLoading, totalImages]);
  
  const goToPrevious = () => {
    if (images.length === 0) return;
    
    const prevIndex = currentImageIndex === 0 ? totalImages - 1 : currentImageIndex - 1;
    if (loadedImages.includes(images[prevIndex])) {
      setCurrentImageIndex(prevIndex);
    }
  };
  
  const goToNext = () => {
    if (images.length === 0) return;
    
    const nextIndex = (currentImageIndex + 1) % totalImages;
    if (loadedImages.includes(images[nextIndex])) {
      setCurrentImageIndex(nextIndex);
    }
  };
  
  if (isLoading || images.length === 0) {
    return (
      <div className="relative w-full h-full aspect-[4/3] bg-gray-800 rounded-lg overflow-hidden shadow-lg">
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 180, 360],
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut" 
            }}
            className="w-12 h-12 relative mb-3"
          >
            <svg className="w-full h-full text-indigo-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 14L12.5 19.5L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 9L12.5 14.5L21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 4L12.5 9.5L21 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
          <p className="text-indigo-300 text-sm">Se încarcă prezentarea...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg blur"></div>
      <div className="relative rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl aspect-[4/3]">
        {/* Use AnimatePresence with crossfade to ensure always one visible image */}
        <AnimatePresence initial={false}>
          <motion.div
            key={images[currentImageIndex]}
            className="absolute inset-0"
            initial={{ 
              opacity: 0, 
              scale: 1.05, 
              filter: 'blur(5px)' 
            }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              filter: 'blur(0px)',
              transition: {
                opacity: { duration: 1.2 },
                scale: { duration: 1.5 },
                filter: { duration: 0.8 }
              }
            }}
            exit={{ 
              opacity: 0,
              scale: 0.95,
              filter: 'blur(5px)',
              transition: {
                opacity: { duration: 1.2 },
                scale: { duration: 1.5 },
                filter: { duration: 0.8 }
              }
            }}
          >
            <Image 
              src={images[currentImageIndex]} 
              alt={`TinyTransfer screenshot ${currentImageIndex + 1}`} 
              width={800} 
              height={600} 
              className="w-full h-full object-cover"
              priority={true}
              style={{transform: 'translate3d(0,0,0)'}} // Force hardware acceleration for smoother animations
              loading="eager" // Adăugăm eager loading pentru imaginile vizibile
              unoptimized={false} // Permitem optimizarea Next.js
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
          </motion.div>
        </AnimatePresence>
        
        {/* Remove left-right navigation arrows */}
        
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-10">
          {images.map((_, index) => (
            <motion.button
              key={`dot-${index}`}
              className={`w-3 h-3 rounded-full transition-colors overflow-hidden ${index === currentImageIndex ? 'ring-2 ring-offset-1 ring-white/70' : ''}`}
              initial={{ opacity: 0.5 }}
              animate={{ 
                opacity: index === currentImageIndex ? 1 : 0.5,
                scale: index === currentImageIndex ? 1.2 : 1,
                backgroundColor: index === currentImageIndex ? 'rgb(255, 255, 255)' : 'rgba(255, 255, 255, 0.5)'
              }}
              transition={{ duration: 0.3 }}
              whileHover={{ opacity: 0.9, scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (loadedImages.includes(images[index])) {
                  setCurrentImageIndex(index);
                }
              }}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Hero background animation component
const AnimatedBackground = () => (
  <div className="absolute inset-0 overflow-hidden -z-10">
    <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-b-[100px] blur-3xl -z-10" />
    <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-gradient-to-bl from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl -z-10" />
    <div className="absolute bottom-0 left-20 w-[250px] h-[250px] bg-gradient-to-tr from-pink-500/20 to-red-500/20 rounded-full blur-3xl -z-10" />
  </div>
);

// Feature card component
const FeatureCard = ({ icon, title, description }: { 
  icon: React.ReactNode, 
  title: string, 
  description: string,
}) => {

  return (
    <div className="relative group">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl opacity-0 group-hover:opacity-70 blur-md transition-all duration-500"></div>
      <motion.div 
        className="relative p-6 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300"
        whileHover={{ y: -5 }}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-4 text-indigo-600 dark:text-indigo-400">{icon}</div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm mb-4">{description}</p>
      </motion.div>
    </div>
  );
};

// Step card for how it works section
const StepCard = ({ number, title, description }: { number: number, title: string, description: string }) => {
  return (
    <motion.div 
      className="flex flex-col items-center text-center p-6"
      initial={{ opacity: 0, x: number % 2 === 0 ? 20 : -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: number * 0.1 }}
    >
      <div className="w-12 h-12 bg-indigo-600 rounded-full text-white flex items-center justify-center text-xl font-bold mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm">{description}</p>
    </motion.div>
  );
};

// Security Section Component - NEW
const SecuritySection = ({ styles, t }: { styles: any, t: any }) => {
  return (
    <section className={`py-16 px-6`}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid md:grid-cols-2 gap-12 items-center"
        >
          <div className="order-2 md:order-1">
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mr-5 p-2 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className={`text-3xl font-bold ${styles.headingText}`}>{t('learnMore.security.title')}</h2>
            </div>
            <p className={`${styles.subText} text-lg mb-5`}>{t('learnMore.security.description1')}</p>
            <p className={`${styles.subText} mb-8`}>{t('learnMore.security.description2')}</p>
            
            <div className="space-y-6">
              <div>
                <h4 className={`text-xl font-semibold mb-3 text-indigo-600 dark:text-indigo-400`}>{t('learnMore.security.featuresTitle')}</h4>
                <ul className={`list-disc list-inside space-y-2 ${styles.subText} text-sm`}>
                  <li>{t('learnMore.security.point1')}</li>
                  <li>{t('learnMore.security.point2')}</li>
                  <li>{t('learnMore.security.point3')}</li>
                </ul>
              </div>
              <div>
                <h4 className={`text-xl font-semibold mb-3 text-indigo-600 dark:text-indigo-400`}>{t('learnMore.security.encryptionTitle')}</h4>
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div className={`p-4 border rounded-lg ${styles.border} bg-white/5 dark:bg-gray-700/20`}>
                    <h5 className="font-semibold mb-1">{t('learnMore.security.encryption1')}</h5>
                    <p className="text-xs opacity-80">{t('learnMore.security.encryption1Desc')}</p>
                  </div>
                  <div className={`p-4 border rounded-lg ${styles.border} bg-white/5 dark:bg-gray-700/20`}>
                    <h5 className="font-semibold mb-1">{t('learnMore.security.encryption2')}</h5>
                    <p className="text-xs opacity-80">{t('learnMore.security.encryption2Desc')}</p>
                  </div>
                  <div className={`p-4 border rounded-lg ${styles.border} bg-white/5 dark:bg-gray-700/20`}>
                    <h5 className="font-semibold mb-1">{t('learnMore.security.encryption3')}</h5>
                    <p className="text-xs opacity-80">{t('learnMore.security.encryption3Desc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <motion.div 
            className="order-1 md:order-2 flex justify-center items-center"
            initial={{ opacity: 0, scale: 0.8, x: 50 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            {/* Placeholder for an image or illustration */}
            <div className={`w-full aspect-square max-w-md bg-gradient-to-br from-indigo-500/30 to-purple-500/30 rounded-xl flex items-center justify-center shadow-xl p-6`}>
               <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 text-indigo-300 opacity-70" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
               </svg>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

// Simplicity Section Component - NEW
const SimplicitySection = ({ styles, t }: { styles: any, t: any }) => {
  return (
    <section className={`py-16 px-6`}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid md:grid-cols-2 gap-12 items-center"
        >
          <motion.div 
            className="order-1 md:order-1 flex justify-center items-center"
            initial={{ opacity: 0, scale: 0.8, x: -50 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            {/* Placeholder for an image or illustration */}
            <div className={`w-full aspect-square max-w-md bg-gradient-to-br from-green-500/30 to-teal-500/30 rounded-xl flex items-center justify-center shadow-xl p-6`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 text-green-300 opacity-70" viewBox="0 0 20 20" fill="currentColor">
                 <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            </div>
          </motion.div>
          <div className="order-2 md:order-2">
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 mr-5 p-2 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
              </div>
              <h2 className={`text-3xl font-bold ${styles.headingText}`}>{t('learnMore.simplicity.title')}</h2>
            </div>
            <p className={`${styles.subText} text-lg mb-5`}>{t('learnMore.simplicity.description1')}</p>
            <p className={`${styles.subText} mb-8`}>{t('learnMore.simplicity.description2')}</p>
            
            <div className="space-y-6">
              <div>
                <h4 className={`text-xl font-semibold mb-3 text-green-600 dark:text-green-400`}>{t('learnMore.simplicity.featuresTitle')}</h4>
                <ul className={`list-disc list-inside space-y-2 ${styles.subText} text-sm`}>
                  <li>{t('learnMore.simplicity.point1')}</li>
                  <li>{t('learnMore.simplicity.point2')}</li>
                  <li>{t('learnMore.simplicity.point3')}</li>
                </ul>
              </div>
              <div>
                <h4 className={`text-xl font-semibold mb-3 text-green-600 dark:text-green-400`}>{t('learnMore.simplicity.workflowTitle')}</h4>
                <div className="flex flex-col gap-4 text-sm">
                  <div className={`p-4 border rounded-lg ${styles.border} bg-white/5 dark:bg-gray-700/20 flex items-start`}>
                    <div className="rounded-full bg-green-100 dark:bg-green-900/30 w-8 h-8 flex-shrink-0 flex items-center justify-center text-green-700 dark:text-green-300 mr-3 font-semibold">1</div>
                    <div>
                      <h5 className="font-semibold mb-1">{t('landing.howItWorks.step1.title')}</h5>
                      <p className="text-xs opacity-80">{t('landing.howItWorks.step1.description')}</p>
                    </div>
                  </div>
                  <div className={`p-4 border rounded-lg ${styles.border} bg-white/5 dark:bg-gray-700/20 flex items-start`}>
                    <div className="rounded-full bg-green-100 dark:bg-green-900/30 w-8 h-8 flex-shrink-0 flex items-center justify-center text-green-700 dark:text-green-300 mr-3 font-semibold">2</div>
                    <div>
                      <h5 className="font-semibold mb-1">{t('landing.howItWorks.step2.title')}</h5>
                      <p className="text-xs opacity-80">{t('landing.howItWorks.step2.description')}</p>
                    </div>
                  </div>
                  <div className={`p-4 border rounded-lg ${styles.border} bg-white/5 dark:bg-gray-700/20 flex items-start`}>
                    <div className="rounded-full bg-green-100 dark:bg-green-900/30 w-8 h-8 flex-shrink-0 flex items-center justify-center text-green-700 dark:text-green-300 mr-3 font-semibold">3</div>
                    <div>
                      <h5 className="font-semibold mb-1">{t('landing.howItWorks.step3.title')}</h5>
                      <p className="text-xs opacity-80">{t('landing.howItWorks.step3.description')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// Control Section Component - NEW
const ControlSection = ({ styles, t }: { styles: any, t: any }) => {
  return (
    <section className={`py-16 px-6`}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid md:grid-cols-2 gap-12 items-center"
        >
          <div className="order-2 md:order-1">
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-5 p-2 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className={`text-3xl font-bold ${styles.headingText}`}>{t('learnMore.control.title')}</h2>
            </div>
            <p className={`${styles.subText} text-lg mb-5`}>{t('learnMore.control.description1')}</p>
            <p className={`${styles.subText} mb-8`}>{t('learnMore.control.description2')}</p>
            
            <div className="space-y-6">
              <div>
                <h4 className={`text-xl font-semibold mb-3 text-blue-600 dark:text-blue-400`}>{t('learnMore.control.featuresTitle')}</h4>
                <ul className={`list-disc list-inside space-y-2 ${styles.subText} text-sm`}>
                  <li>{t('learnMore.control.point1')}</li>
                  <li>{t('learnMore.control.point2')}</li>
                  <li>{t('learnMore.control.point3')}</li>
                </ul>
              </div>
              <div>
                <h4 className={`text-xl font-semibold mb-3 text-blue-600 dark:text-blue-400`}>{t('learnMore.control.dashboardTitle')}</h4>
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div className={`p-4 border rounded-lg ${styles.border} bg-white/5 dark:bg-gray-700/20`}>
                    <h5 className="font-semibold mb-1">{t('learnMore.control.analytics')}</h5>
                    <p className="text-xs opacity-80">{t('learnMore.control.analyticsDesc')}</p>
                  </div>
                  <div className={`p-4 border rounded-lg ${styles.border} bg-white/5 dark:bg-gray-700/20`}>
                    <h5 className="font-semibold mb-1">{t('learnMore.control.management')}</h5>
                    <p className="text-xs opacity-80">{t('learnMore.control.managementDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <motion.div 
            className="order-1 md:order-2 flex justify-center items-center"
            initial={{ opacity: 0, scale: 0.8, x: 50 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            {/* Placeholder for an image or illustration */}
            <div className={`w-full aspect-square max-w-md bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-xl flex items-center justify-center shadow-xl p-6`}>
               <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 text-blue-300 opacity-70" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
               </svg>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

// Privacy Section Component - NEW
const PrivacySection = ({ styles, t }: { styles: any, t: any }) => {
  return (
    <section className={`py-16 px-6`}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid md:grid-cols-2 gap-12 items-center"
        >
          <motion.div 
            className="order-1 md:order-1 flex justify-center items-center"
            initial={{ opacity: 0, scale: 0.8, x: -50 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            {/* Placeholder for an image or illustration */}
            <div className={`w-full aspect-square max-w-md bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-xl flex items-center justify-center shadow-xl p-6`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 text-purple-300 opacity-70" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            </div>
          </motion.div>
          <div className="order-2 md:order-2">
            <div className="flex items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 mr-5 p-2 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              </div>
              <h2 className={`text-3xl font-bold ${styles.headingText}`}>{t('learnMore.privacy.title')}</h2>
            </div>
            <p className={`${styles.subText} text-lg mb-5`}>{t('learnMore.privacy.description1')}</p>
            <p className={`${styles.subText} mb-8`}>{t('learnMore.privacy.description2')}</p>
            
            <div className="space-y-6">
              <div>
                <h4 className={`text-xl font-semibold mb-3 text-purple-600 dark:text-purple-400`}>{t('learnMore.privacy.featuresTitle')}</h4>
                <ul className={`list-disc list-inside space-y-2 ${styles.subText} text-sm`}>
                  <li>{t('learnMore.privacy.point1')}</li>
                  <li>{t('learnMore.privacy.point2')}</li>
                  <li>{t('learnMore.privacy.point3')}</li>
                </ul>
              </div>
              <div>
                <h4 className={`text-xl font-semibold mb-3 text-purple-600 dark:text-purple-400`}>{t('learnMore.privacy.dataTitle')}</h4>
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div className={`p-4 border rounded-lg ${styles.border} bg-white/5 dark:bg-gray-700/20`}>
                    <h5 className="font-semibold mb-1">{t('learnMore.privacy.dataDeletion')}</h5>
                    <p className="text-xs opacity-80">{t('learnMore.privacy.dataDeletionDesc')}</p>
                  </div>
                  <div className={`p-4 border rounded-lg ${styles.border} bg-white/5 dark:bg-gray-700/20`}>
                    <h5 className="font-semibold mb-1">{t('learnMore.privacy.dataControl')}</h5>
                    <p className="text-xs opacity-80">{t('learnMore.privacy.dataControlDesc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// Setup modal component
const SetupModal = ({ isOpen, styles }: { isOpen: boolean, styles: any }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLocale();
  const router = useRouter();

  // Password validation state
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasDigit: false,
    hasSymbol: false
  });
  
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Email validation function
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Password validation function
  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password);
    
    const isValid = minLength && hasUpperCase && hasLowerCase && hasDigit && hasSymbol;
    
    // Calculate password strength score (0-100)
    let strengthScore = 0;
    if (minLength) strengthScore += 20;
    if (hasUpperCase) strengthScore += 20;
    if (hasLowerCase) strengthScore += 20;
    if (hasDigit) strengthScore += 20;
    if (hasSymbol) strengthScore += 20;
    
    return {
      isValid,
      strengthScore,
      requirements: {
        minLength,
        hasUpperCase,
        hasLowerCase,
        hasDigit,
        hasSymbol
      }
    };
  };

  // Update password requirements when password changes
  useEffect(() => {
    if (password) {
      const validation = validatePassword(password);
      setPasswordRequirements(validation.requirements);
      setPasswordStrength(validation.strengthScore);
    } else {
      setPasswordStrength(0);
    }
  }, [password]);

  // Function to get strength color
  const getStrengthColor = (strength: number) => {
    if (strength < 40) return 'bg-red-500';
    if (strength < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Function to get strength text
  const getStrengthText = (strength: number) => {
    if (strength < 40) return t('auth.passwordWeak');
    if (strength < 80) return t('auth.passwordMedium');
    return t('auth.passwordStrong');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate email
    if (!email || !validateEmail(email)) {
      setError(t('errors.invalidEmail'));
      return;
    }
    
    // Validate password complexity
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(t('auth.passwordRequirements'));
      return;
    }
    
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('errors.setupFailed'));
      }
      
      // Reload the page to show the login form
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.setupFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className={`w-full max-w-md ${styles.cardBg} rounded-lg shadow-2xl overflow-hidden`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-8">
              <h2 className={`text-center text-2xl font-bold ${styles.headingText} mb-6`}>
                {t('auth.initialSetup')}
              </h2>
              <p className={`text-center text-sm ${styles.subText} mb-4`}>
                {t('auth.configureAdminAccount')}
              </p>
              <p className={`text-center text-xs ${styles.subText} mb-8 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md`}>
                {t('auth.setupRequiredMessage')}
              </p>
              
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="setup-email" className={`block text-sm font-medium ${styles.labelText}`}>
                    {t('auth.email')}
                  </label>
                  <div className="mt-1">
                    <input
                      id="setup-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className={`appearance-none block w-full px-3 py-2 border ${styles.border} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${styles.input}`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="setup-password" className={`block text-sm font-medium ${styles.labelText}`}>
                    {t('auth.password')}
                  </label>
                  <div className="mt-1">
                    <input
                      id="setup-password"
                      name="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      className={`appearance-none block w-full px-3 py-2 border ${styles.border} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${styles.input}`}
                    />
                  </div>
                  
                  {/* Password strength indicator */}
                  <AnimatePresence>
                    {password.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-2"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium">{getStrengthText(passwordStrength)}</span>
                          <span className="text-xs">{passwordStrength}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                          <motion.div 
                            className={`h-2.5 rounded-full ${getStrengthColor(passwordStrength)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${passwordStrength}%` }}
                            transition={{ duration: 0.5 }}
                          ></motion.div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Password requirements */}
                  <AnimatePresence>
                    {password.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="mt-3 text-xs space-y-1 p-3 rounded-md bg-gray-50 dark:bg-gray-800"
                      >
                        <p className={`font-medium ${styles.labelText} mb-2`}>{t('auth.passwordRequirementsList')}:</p>
                        <ul className="grid grid-cols-1 gap-1 pl-2">
                          <motion.li 
                            className={`flex items-center`}
                            animate={{ color: passwordRequirements.minLength ? '#10B981' : '#EF4444' }}
                            transition={{ duration: 0.3 }}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {passwordRequirements.minLength ? (
                                <motion.svg 
                                  key="check"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, color: '#10B981' }}
                                  exit={{ scale: 0 }}
                                  className="w-4 h-4 mr-1 inline text-green-500" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </motion.svg>
                              ) : (
                                <motion.svg 
                                  key="x"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, color: '#EF4444' }}
                                  exit={{ scale: 0 }}
                                  className="w-4 h-4 mr-1 inline text-red-500" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </motion.svg>
                              )}
                            </AnimatePresence>
                            {t('auth.minLength')}
                          </motion.li>
                          
                          <motion.li 
                            className={`flex items-center`}
                            animate={{ color: passwordRequirements.hasUpperCase ? '#10B981' : '#EF4444' }}
                            transition={{ duration: 0.3 }}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {passwordRequirements.hasUpperCase ? (
                                <motion.svg 
                                  key="check"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, color: '#10B981' }}
                                  exit={{ scale: 0 }}
                                  className="w-4 h-4 mr-1 inline text-green-500" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </motion.svg>
                              ) : (
                                <motion.svg 
                                  key="x"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, color: '#EF4444' }}
                                  exit={{ scale: 0 }}
                                  className="w-4 h-4 mr-1 inline text-red-500" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </motion.svg>
                              )}
                            </AnimatePresence>
                            {t('auth.upperCase')}
                          </motion.li>
                          
                          <motion.li 
                            className={`flex items-center`}
                            animate={{ color: passwordRequirements.hasLowerCase ? '#10B981' : '#EF4444' }}
                            transition={{ duration: 0.3 }}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {passwordRequirements.hasLowerCase ? (
                                <motion.svg 
                                  key="check"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, color: '#10B981' }}
                                  exit={{ scale: 0 }}
                                  className="w-4 h-4 mr-1 inline text-green-500" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </motion.svg>
                              ) : (
                                <motion.svg 
                                  key="x"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, color: '#EF4444' }}
                                  exit={{ scale: 0 }}
                                  className="w-4 h-4 mr-1 inline text-red-500" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </motion.svg>
                              )}
                            </AnimatePresence>
                            {t('auth.lowerCase')}
                          </motion.li>
                          
                          <motion.li 
                            className={`flex items-center`}
                            animate={{ color: passwordRequirements.hasDigit ? '#10B981' : '#EF4444' }}
                            transition={{ duration: 0.3 }}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {passwordRequirements.hasDigit ? (
                                <motion.svg 
                                  key="check"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, color: '#10B981' }}
                                  exit={{ scale: 0 }}
                                  className="w-4 h-4 mr-1 inline text-green-500" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </motion.svg>
                              ) : (
                                <motion.svg 
                                  key="x"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, color: '#EF4444' }}
                                  exit={{ scale: 0 }}
                                  className="w-4 h-4 mr-1 inline text-red-500" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </motion.svg>
                              )}
                            </AnimatePresence>
                            {t('auth.digit')}
                          </motion.li>
                          
                          <motion.li 
                            className={`flex items-center`}
                            animate={{ color: passwordRequirements.hasSymbol ? '#10B981' : '#EF4444' }}
                            transition={{ duration: 0.3 }}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {passwordRequirements.hasSymbol ? (
                                <motion.svg 
                                  key="check"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, color: '#10B981' }}
                                  exit={{ scale: 0 }}
                                  className="w-4 h-4 mr-1 inline text-green-500" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </motion.svg>
                              ) : (
                                <motion.svg 
                                  key="x"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1, color: '#EF4444' }}
                                  exit={{ scale: 0 }}
                                  className="w-4 h-4 mr-1 inline text-red-500" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </motion.svg>
                              )}
                            </AnimatePresence>
                            {t('auth.symbol')}
                          </motion.li>
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label htmlFor="setup-confirm-password" className={`block text-sm font-medium ${styles.labelText}`}>
                    {t('auth.confirmPassword')}
                  </label>
                  <div className="mt-1">
                    <input
                      id="setup-confirm-password"
                      name="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      className={`appearance-none block w-full px-3 py-2 border ${styles.border} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${styles.input}`}
                    />
                  </div>
                </div>

                {error && (
                  <div className={`${styles.dangerBg} border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm`}>
                    {error}
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                      isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('common.processing')}
                      </>
                    ) : (
                      t('auth.configure')
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Login modal component
const LoginModal = ({ isOpen, onClose, styles }: { isOpen: boolean, onClose: () => void, styles: any }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { t } = useLocale();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('auth.loginFailed'));
      }

      // Get the redirect URL from query params
      const urlParams = new URLSearchParams(window.location.search);
      const redirectUrl = urlParams.get('redirect') || '/dashboard';

      // Redirect to the requested page or dashboard
      window.location.href = redirectUrl;
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className={`max-w-md w-full p-8 ${styles.cardBg} rounded-lg shadow-2xl relative`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.button 
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={onClose}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>
            
        <div>
              <h2 className={`text-center text-2xl font-bold ${styles.headingText} mb-6`}>
            {t('auth.adminLogin')}
          </h2>
              <p className={`text-center text-sm ${styles.subText} mb-8`}>
            {t('auth.loginPrompt')}
          </p>
        </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className={`block text-sm font-medium ${styles.labelText}`}>
              {t('auth.email')}
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm ${styles.border} ${styles.input} focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                placeholder="admin@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className={`block text-sm font-medium ${styles.labelText}`}>
              {t('auth.password')}
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`appearance-none block w-full px-3 py-2 border rounded-md shadow-sm ${styles.border} ${styles.input} focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                placeholder={t('auth.enterPassword')}
              />
            </div>
          </div>

          {error && (
            <div className={`p-3 rounded-md ${styles.dangerBg}`}>
              <p className={`text-sm ${styles.dangerText}`}>{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('common.processing')}
                </>
              ) : t('auth.login')}
            </button>
          </div>
        </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function LandingPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [setupCheckLoading, setSetupCheckLoading] = useState(true);
  const [copyCloneStatus, setCopyCloneStatus] = useState(false);
  const [copyInstallStatus, setCopyInstallStatus] = useState(false);
  const [copyRunStatus, setCopyRunStatus] = useState(false);
  const { t, locale, setLocale } = useLocale();
  const styles = useThemeStyles();
  const router = useRouter();

  // Reset copy statuses after timeout
  useEffect(() => {
    if (copyCloneStatus) {
      const timer = setTimeout(() => setCopyCloneStatus(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyCloneStatus]);

  useEffect(() => {
    if (copyInstallStatus) {
      const timer = setTimeout(() => setCopyInstallStatus(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyInstallStatus]);

  useEffect(() => {
    if (copyRunStatus) {
      const timer = setTimeout(() => setCopyRunStatus(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyRunStatus]);

  // Check if admin account is set up
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
          const data = await response.json();
          
          // Check if setup is required
          if (data.isSetupRequired) {
            setIsSetupRequired(true);
            setSetupCheckLoading(false);
            return;
          }
          
          // Check if user is authenticated
          if (data.isAuthenticated) {
            router.push('/dashboard');
            return;
          }
          
          // User is not authenticated but setup is done
          setIsSetupRequired(false);
          setSetupCheckLoading(false);
        } else {
          throw new Error('Authentication check failed');
        }
      } catch (error) {
        console.error(t('errors.authCheckFailed'), error);
        // In case of error checking auth, we'll assume setup might be required
        setIsSetupRequired(true);
        setSetupCheckLoading(false);
      }
    };

    checkAuth();
  }, [router, t]);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  

  return (
    <div className={`min-h-screen ${styles.pageBg}`}>
      <AnimatedBackground />
      
      {/* Display setup modal if required */}
      <SetupModal isOpen={isSetupRequired} styles={styles} />
      
      {/* Navigation */}
      <nav className="container mx-auto py-4 px-6 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm3.75-2.75a.75.75 0 001.5 0V9.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0l-3.25 3.5a.75.75 0 101.1 1.02l1.95-2.1v4.59z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-xl font-bold">TinyTransfer</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={openModal}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {t('auth.openLoginModal')}
          </button>
          
          <div className="flex items-center space-x-1">
            <button 
              onClick={() => setLocale('en')} 
              className={`px-2 py-1 text-xs rounded flex items-center gap-1.5 ${locale === 'en' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="18" height="12" className="inline-block rounded-sm overflow-hidden">
                <path fill="#012169" d="M0 0h640v480H0z"/>
                <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0h75z"/>
                <path fill="#C8102E" d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"/>
                <path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z"/>
                <path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z"/>
              </svg>
              EN
            </button>
            <button 
              onClick={() => setLocale('ro')} 
              className={`px-2 py-1 text-xs rounded flex items-center gap-1.5 ${locale === 'ro' ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2" width="18" height="12" className="inline-block rounded-sm overflow-hidden">
                <rect width="1" height="2" fill="#002B7F"/>
                <rect width="1" height="2" x="1" fill="#FCD116"/>
                <rect width="1" height="2" x="2" fill="#CE1126"/>
              </svg>
              RO
            </button>
          </div>
        </div>
      </nav>
      
      {/* Hero Section */}
      <section className="container mx-auto py-16 px-6">
        <div className="flex flex-col lg:flex-row items-center">
          <motion.div 
            className="lg:w-1/2 mb-10 lg:mb-0 lg:pr-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className={`text-4xl md:text-5xl font-bold mb-6 ${styles.headingText}`}>
              {t('landing.hero.title')}
            </h1>
            <p className={`text-lg mb-8 ${styles.subText}`}>
              {t('landing.hero.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <motion.a 
                href="https://github.com/pixicenter/TinyTransfer"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-center flex items-center justify-center"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                {t('landing.hero.secondaryButton')}
              </motion.a>
              {/* <motion.button 
                className={`px-6 py-3 border border-indigo-600 ${styles.primaryText} rounded-lg font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.open('https://tinytransfer.io/docs', '_blank')} // Direct link to docs or a relevant page
              >
                {t('landing.hero.ctaButton')}
              </motion.button> */}
            </div>
          </motion.div>
          <motion.div 
            className="lg:w-1/2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <HeroSlideshow />
          </motion.div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="container mx-auto py-16 px-6">
        <div className="text-center mb-16">
          <motion.h2 
            className={`text-3xl font-bold mb-4 ${styles.headingText}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {t('landing.features.title')}
          </motion.h2>
          <motion.p 
            className={`text-lg max-w-2xl mx-auto ${styles.subText}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {t('landing.features.subtitle')}
          </motion.p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            }
            title={t('landing.features.security.title')}
            description={t('landing.features.security.description')}
          />
          <FeatureCard 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
              </svg>
            }
            title={t('landing.features.simplicity.title')}
            description={t('landing.features.simplicity.description')}
          />
          <FeatureCard 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            }
            title={t('landing.features.control.title')}
            description={t('landing.features.control.description')}
          />
          <FeatureCard 
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            }
            title={t('landing.features.privacy.title')}
            description={t('landing.features.privacy.description')}
          />
        </div>
      </section>
      
      {/* How It Works Section */}
      <section className={`${styles.primaryBg} py-16 px-6`}>
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <motion.h2 
              className="text-3xl font-bold mb-4 text-white"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              {t('landing.howItWorks.title')}
            </motion.h2>
            <motion.p 
              className="text-lg max-w-2xl mx-auto text-indigo-100"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {t('landing.howItWorks.subtitle')}
            </motion.p>
          </div>
          
          <div className="flex flex-col md:flex-row justify-around items-center max-w-4xl mx-auto text-white">
            <StepCard 
              number={1} 
              title={t('landing.howItWorks.step1.title')} 
              description={t('landing.howItWorks.step1.description')} 
            />
            <div className="hidden md:block">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-12 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
            <StepCard 
              number={2} 
              title={t('landing.howItWorks.step2.title')} 
              description={t('landing.howItWorks.step2.description')} 
            />
            <div className="hidden md:block">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-12 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
            <StepCard 
              number={3} 
              title={t('landing.howItWorks.step3.title')} 
              description={t('landing.howItWorks.step3.description')} 
            />
          </div>
        </div>
      </section>
      
      {/* Learn More Section - NEW */}
      <section className="container mx-auto py-16 px-6">
        <div className="text-center mb-16">
          <motion.h2 
            className={`text-4xl font-bold mb-4 ${styles.headingText}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {t('learnMore.overview.title')}
          </motion.h2>
          <motion.p 
            className={`text-xl max-w-3xl mx-auto ${styles.subText}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {t('learnMore.overview.description')}
          </motion.p>
        </div>
      </section>

      {/* Individual Feature Sections */}
      <SecuritySection styles={styles} t={t} />
      <SimplicitySection styles={styles} t={t} />
      <ControlSection styles={styles} t={t} />
      <PrivacySection styles={styles} t={t} />

      {/* Ready to Get Started Section */}
      <section className="container mx-auto text-center">
        <motion.div 
          className={`max-w-7xl mx-auto rounded-xl p-10 `}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className={`text-3xl font-bold mb-6 ${styles.headingText}`}>
            {t('landing.cta.title')}
          </h2>
          <p className={`text-lg mb-8 ${styles.subText}`}>
            {t('landing.cta.description')}
          </p>
          
          {/* Pașii de instalare */}
          <div className="grid md:grid-cols-3 gap-6 text-left mb-10">
            <motion.div 
              className={`p-6 border ${styles.border} rounded-lg bg-white/10 dark:bg-gray-800/30`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">1. {t('landing.getStarted.clone.title')}</h3>
              <p className="text-sm mb-3">{t('landing.getStarted.clone.description')}</p>
              <div className={`p-3 bg-gray-200 dark:bg-gray-900 rounded font-mono text-xs overflow-x-auto relative group`}>
                git clone https://github.com/pixicenter/TinyTransfer.git
                <AnimatePresence>
                  {copyCloneStatus ? (
                    <motion.span 
                      key="copied"
                      className="absolute right-2 top-2 bg-green-600 text-white px-2 py-1 rounded text-xs"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      {t('common.copied')}
                    </motion.span>
                  ) : (
                    <motion.button
                      key="copy-button"
                      onClick={() => {
                        navigator.clipboard.writeText('git clone https://github.com/pixicenter/TinyTransfer.git');
                        setCopyCloneStatus(true);
                      }}
                      className="absolute right-2 top-2 bg-indigo-600 hover:bg-indigo-700 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      title={t('common.copy') || 'Copy'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
            
            <motion.div 
              className={`p-6 border ${styles.border} rounded-lg bg-white/10 dark:bg-gray-800/30`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">2. {t('landing.getStarted.install.title')}</h3>
              <p className="text-sm mb-3">{t('landing.getStarted.install.description')}</p>
              <div className={`p-3 bg-gray-200 dark:bg-gray-900 rounded font-mono text-xs overflow-x-auto relative group`}>
                cd tinytransfer<br />
                npm install<br />
                cp .env.example .env.local
                <AnimatePresence>
                  {copyInstallStatus ? (
                    <motion.span 
                      key="copied"
                      className="absolute right-2 top-2 bg-green-600 text-white px-2 py-1 rounded text-xs"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      {t('common.copied')}
                    </motion.span>
                  ) : (
                    <motion.button
                      key="copy-button"
                      onClick={() => {
                        navigator.clipboard.writeText('cd tinytransfer\nnpm install\ncp .env.example .env.local');
                        setCopyInstallStatus(true);
                      }}
                      className="absolute right-2 top-2 bg-indigo-600 hover:bg-indigo-700 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      title={t('common.copy') || 'Copy'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
            
            <motion.div 
              className={`p-6 border ${styles.border} rounded-lg bg-white/10 dark:bg-gray-800/30`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">3. {t('landing.getStarted.run.title')}</h3>
              <p className="text-sm mb-3">{t('landing.getStarted.run.description')}</p>
              <div className={`p-3 bg-gray-200 dark:bg-gray-900 rounded font-mono text-xs overflow-x-auto relative group`}>
                npm run dev
                <AnimatePresence>
                  {copyRunStatus ? (
                    <motion.span 
                      key="copied"
                      className="absolute right-2 top-2 bg-green-600 text-white px-2 py-1 rounded text-xs"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      {t('common.copied')}
                    </motion.span>
                  ) : (
                    <motion.button
                      key="copy-button"
                      onClick={() => {
                        navigator.clipboard.writeText('npm run dev');
                        setCopyRunStatus(true);
                      }}
                      className="absolute right-2 top-2 bg-indigo-600 hover:bg-indigo-700 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      title={t('common.copy') || 'Copy'}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
          
          {/* Premium Services */}
          <motion.div 
            className={`p-6 border ${styles.border} rounded-lg mb-8 max-w-2xl mx-auto bg-gradient-to-r from-indigo-100/30 to-purple-100/30 dark:from-indigo-900/30 dark:to-purple-900/30`}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h3 className={`text-xl font-semibold mb-3 ${styles.primaryText}`}>
              {t('landing.getStarted.premiumServices.title')}
            </h3>
            <p className={`text-sm mb-4 ${styles.subText}`}>
              {t('landing.getStarted.premiumServices.description')}
            </p>
            <motion.a
              href="mailto:cristian@tinytransfer.com" 
              className={`inline-flex items-center px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {t('landing.getStarted.premiumServices.contactButton')}
            </motion.a>
          </motion.div>
          
          {/* Open Source Info */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-3">
              <svg className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="text-sm font-medium">{t('landing.getStarted.openSource.title')}</span>
            </div>
            <p className={`text-xs ${styles.subText} max-w-md mx-auto`}>
              {t('landing.getStarted.openSource.description')}
            </p>
          </div>
        </motion.div>
      </section>
      
      {/* Footer */}
      <footer className={`border-t ${styles.border} py-10 px-6`}>
        <div className="container mx-auto">
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center space-x-2 mb-4">
              <motion.div 
                className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center"
                whileHover={{ scale: 1.1, rotate: 5 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm3.75-2.75a.75.75 0 001.5 0V9.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0l-3.25 3.5a.75.75 0 101.1 1.02l1.95-2.1v4.59z" clipRule="evenodd" />
                </svg>
              </motion.div>
              <motion.span 
                className="text-sm font-bold"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                TinyTransfer
              </motion.span>
            </div>
            {/* <div className="flex space-x-6">
              <a href="#" className={`text-sm ${styles.subText} hover:${styles.primaryText}`}>{t('landing.footer.about')}</a>
              <a href="#" className={`text-sm ${styles.subText} hover:${styles.primaryText}`}>{t('landing.footer.privacy')}</a>
              <a href="#" className={`text-sm ${styles.subText} hover:${styles.primaryText}`}>{t('landing.footer.terms')}</a>
              <a href="#" className={`text-sm ${styles.subText} hover:${styles.primaryText}`}>{t('landing.footer.contact')}</a>
            </div> */}
          </div>
          <motion.div 
            className={`text-center mt-4 text-xs ${styles.subText}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.4 }}
          >
            © {new Date().getFullYear()} TinyTransfer. {t('footer.copyright')} <br />

            {/* Open Source Info */}
          
            <div className="flex items-center justify-center mb-3 pt-2">
              <svg className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="text-sm font-medium">{t('landing.getStarted.openSource.title')}</span>
            </div>
            <p className={`text-xs ${styles.subText} max-w-md mx-auto`}>
              {t('landing.getStarted.openSource.description')} <br />
              <span className={`text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-500`}>contact@cristianturcu.ro</span>

            </p>
          
          </motion.div>
          
      </div>
      </footer>
      
      {/* Login Modal */}
      <LoginModal isOpen={isModalOpen} onClose={closeModal} styles={styles} />
    </div>
  );
} 