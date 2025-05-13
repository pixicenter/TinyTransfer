'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '../lib/LocaleContext';
import LoadingScreen from '../components/LoadingScreen';
import LandingPage from '../components/LandingPage';

// Add a client-side script to check and block access to the setup page if an admin already exists
// const blockSetupPageIfNeeded = `
// (function() {
//   if (window.location.pathname === '/') {
//     // Check if an admin is already configured
//     fetch('/api/auth/setup')
//       .then(response => {
//         if (response.status === 403) {
//           // Admin is already configured, redirect to login page
//           window.location.href = '/';
//         }
//       })
//       .catch(error => {
//         console.error('Error checking admin setup:', error);
//       });
//   }
// })();
// `;

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [isCheckComplete, setIsCheckComplete] = useState(false);

  useEffect(() => {
    // Check if an admin account exists
    const checkAdminAccount = async () => {
      try {
        const response = await fetch('/api/auth/setup', {
          method: 'GET',
        });

        // Check and set the correct state
        if (response.status === 400) {
          setIsSetupRequired(false); // Admin already exists, show login
        } else {
          setIsSetupRequired(true); // Setup required
        }
      } catch (error) {
        // Treat as login in case of error
        setIsSetupRequired(false);
      } finally {
        setIsLoading(false);
        setIsCheckComplete(true);
      }
    };

    checkAdminAccount();
  }, [router]);

  // During verification, show loader
  if (isLoading) {
    return <LoadingScreen />;
  }

  // After verification, show the appropriate interface directly
  return (
    <LandingPage
    />
  );
}
