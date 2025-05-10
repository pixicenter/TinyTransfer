'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '../../../lib/LocaleContext';
import { useThemeStyles } from '../../../lib/useThemeStyles';
import { motion, AnimatePresence } from 'framer-motion';

export default function SetupPage() {
  const { t } = useLocale();
  const styles = useThemeStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check if there is already an admin configured
  useEffect(() => {
    const checkAdminSetup = async () => {
      try {
        const response = await fetch('/api/auth/setup');
        
        if (response.status === 400 || response.status === 403) {
          // The admin has already been configured, redirect to the login page
          router.push('/');
          return;
        }
        
        if (!response.ok) {
          throw new Error(t('errors.adminSetupCheckFailed'));
        }
        
        // If we get here, it means there is no admin configured
        setIsLoading(false);
      } catch (err) {
        setError(t('errors.serverError') + ': ' + (err instanceof Error ? err.message : t('errors.unknownError')));
        setIsLoading(false);
      }
    };

    checkAdminSetup();
  }, [router, t]);

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

  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasDigit: false,
    hasSymbol: false
  });
  
  const [passwordStrength, setPasswordStrength] = useState(0);

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
      
      router.push('/auth/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.setupFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen ${styles.pageBg} flex flex-col justify-center py-12 sm:px-6 lg:px-8`}>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className={`${styles.cardBg} py-8 px-4 shadow sm:rounded-lg sm:px-10`}>
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className={`mt-2 text-center text-sm ${styles.subText}`}>{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${styles.pageBg} flex flex-col justify-center py-12 sm:px-6 lg:px-8`}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className={`mt-6 text-center text-3xl font-extrabold ${styles.headingText}`}>
          {t('auth.initialSetup')}
        </h2>
        <p className={`mt-2 text-center text-sm ${styles.subText}`}>
          {t('auth.configureAdminAccount')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className={`${styles.cardBg} py-8 px-4 shadow sm:rounded-lg sm:px-10`}>
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className={`appearance-none block w-full px-3 py-2 border ${styles.border} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${styles.input}`}
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
              <label htmlFor="confirmPassword" className={`block text-sm font-medium ${styles.labelText}`}>
                {t('auth.confirmPassword')}
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
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
                  isLoading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
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
      </div>
    </div>
  );
} 