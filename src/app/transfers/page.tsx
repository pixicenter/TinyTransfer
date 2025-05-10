'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useThemeStyles } from '../../lib/useThemeStyles';
import { useLocale } from '../../lib/LocaleContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Transfer {
  id: string;
  created_at: string;
  expires_at: string | null;
  archive_name: string;
  size_bytes: number;
  is_encrypted: boolean;
  encryption_key_source: string | null;
  stats: {
    link_views: number;
    downloads: number;
    unique_ip_count: number;
    email_sent: boolean;
    email_error: string | null;
    last_accessed: string | null;
  };
  files: {
    id: number;
    original_name: string;
    size_bytes: number;
  }[];
}

/**
 * The main component for the transfers page
 * Displays all transfers in card format, with options for copying link, 
 * sending email, viewing and deleting
 */
export default function TransfersPage() {
  const styles = useThemeStyles();
  const { t, locale } = useLocale();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const router = useRouter();
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [selectedTransferForExtension, setSelectedTransferForExtension] = useState<Transfer | null>(null);
  const [newExpiration, setNewExpiration] = useState<string>('');
  const [isUpdatingExpiration, setIsUpdatingExpiration] = useState(false);

  useEffect(() => {
    fetchTransfers();
  }, []);

  /**
   * Fetches the list of transfers from the API
   */
  const fetchTransfers = async () => {
    try {
      const response = await fetch('/api/transfers');
      if (!response.ok) {
        throw new Error(t('errors.failedToFetchTransfers'));
      }
      const data = await response.json();
      setTransfers(data.transfers);
    } catch (err) {
      setError(t('errors.transfersLoadError'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(transfers.length / itemsPerPage);

  /**
   * Gets the transfers for the current page
   * @returns The transfers displayed on the current page
   */
  const getCurrentPageTransfers = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return transfers.slice(startIndex, endIndex);
  };

  /**
   * Navigates to the next page
   */
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  /**
   * Navigates to the previous page
   */
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  /**
   * Navigates to a specific page
   * @param pageNumber The page number
   */
  const goToPage = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  /**
   * Formats the size in bytes into a readable format (KB, MB, GB etc.)
   * @param bytes The size in bytes
   * @returns The formatted size
   */
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * Formats the date in function of the selected language
   * @param dateString The date in string format
   * @returns The formatted date according to the localization
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Determines the status of a transfer (permanent, expired, expires in X days)
   * @param transfer The transfer for which the status is checked
   * @returns The status and the associated color
   */
  const getStatus = (transfer: Transfer) => {
    if (!transfer.expires_at) return { label: t('transfers.permanent'), color: 'green' };
    
    const now = new Date();
    const expiryDate = new Date(transfer.expires_at);
    
    if (expiryDate < now) {
      return { label: t('transfers.expired'), color: 'red' };
    }
    
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 1) {
      return { label: t('transfers.expiresInDay'), color: 'orange' };
    } else if (daysLeft <= 3) {
      return { label: t('transfers.expiresInDays').replace('{days}', daysLeft.toString()), color: 'yellow' };
    } else {
      return { label: t('transfers.expiresInDays').replace('{days}', daysLeft.toString()), color: 'green' };
    }
  };

  /**
   * Copies the download link to the clipboard
   * @param id The ID of the transfer
   */
  const copyLink = (id: string) => {
    const baseUrl = window.location.origin;
    const downloadLink = `${baseUrl}/download/${id}`;
    navigator.clipboard.writeText(downloadLink);
    
    setSelectedTransfer(id);
    setTimeout(() => setSelectedTransfer(null), 2000);
  };

  /**
   * Opens the email modal
   * @param id The ID of the transfer
   */
  const openEmailModal = (id: string) => {
    setEmailOpen(id);
    setEmail('');
    setEmailSent(null);
  };

  /**
   * Sends the download link by email
   * @param id The ID of the transfer
   */
  const sendEmail = async (id: string) => {
    if (!email.trim() || !email.includes('@')) {
      return;
    }
    
    try {
      setSendingEmail(true);
      
      const baseUrl = window.location.origin;
      const downloadLink = `${baseUrl}/download/${id}`;
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          downloadLink,
          transferId: id,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.error && data.error.includes(t('errors.emailConfigIncomplete'))) {
          throw new Error(t('errors.emailConfigCheckEnv'));
        }
        throw new Error(data.error || t('errors.emailSendError'));
      }
      
      setEmailSent(id);
      setTimeout(() => {
        setEmailOpen(null);
        setEmailSent(null);
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('errors.emailSendError'));
      
      if (err.message?.includes(t('errors.emailConfig'))) {
        alert(t('errors.emailConfigDevNote'));
      }
    } finally {
      setSendingEmail(false);
    }
  };

  /**
   * Deletes a transfer
   * @param id The ID of the transfer
   */
  const deleteTransfer = async (id: string) => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/transfers?id=${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('errors.deleteTransferFailed'));
      }
      
      setTransfers(transfers.filter(transfer => transfer.id !== id));
      setConfirmDelete(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || t('errors.deleteTransferFailed'));
    } finally {
      setDeleting(false);
    }
  };

  /**
   * The pagination component
   * Displays the buttons for navigating between pages
   */
  const Pagination = () => {
    if (totalPages <= 1) return null;
    
    let pageNumbers = [];
    const maxPageButtons = 5;
    
    if (totalPages <= maxPageButtons) {
      pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      if (currentPage <= 3) {
        pageNumbers = [1, 2, 3, 4, '...', totalPages];
      } else if (currentPage >= totalPages - 2) {
        pageNumbers = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      } else {
        pageNumbers = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
      }
    }
    
    return (
      <div className="flex justify-center mt-8 mb-4">
        <nav className="inline-flex rounded-md shadow-sm" aria-label="Pagination">
          {/* Previous button with individual glow */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-l-md opacity-0 group-hover:opacity-60 blur-sm transition-all duration-300"></div>
            <button
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center px-2 py-2 rounded-l-md border z-10 ${currentPage === 1 ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-100'}`}
            >
              <span className="sr-only">{t('pagination.previous')}</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          {/* Page number buttons with individual glow */}
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              // Ellipsis doesn't need hover effect
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-gray-700 -ml-px" // Added -ml-px for border collapse
                >
                  ...
                </span>
              );
            }
            
            return (
              <div key={`page-${page}`} className="relative group">
                <div className={`absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-md opacity-0 group-hover:opacity-60 blur-sm transition-all duration-300 ${currentPage === page ? '!opacity-0' : ''}`}></div>
                <button
                  onClick={() => goToPage(page as number)}
                  className={`relative inline-flex items-center px-4 py-2 border z-10 -ml-px ${currentPage === page ? 'bg-indigo-600 text-white border-indigo-600 z-20' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                >
                  {page}
                </button>
              </div>
            );
          })}
          
          {/* Next button with individual glow */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-r-md opacity-0 group-hover:opacity-60 blur-sm transition-all duration-300"></div>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border z-10 -ml-px ${currentPage === totalPages ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-100'}`}
            >
              <span className="sr-only">{t('pagination.next')}</span>
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </nav>
      </div>
    );
  };

  const openExtendExpirationModal = (transfer: Transfer) => {
    setSelectedTransferForExtension(transfer);
    setNewExpiration('');
    setIsExtendModalOpen(true);
  };

  const closeExtendExpirationModal = () => {
    setIsExtendModalOpen(false);
    setSelectedTransferForExtension(null);
  };

  const handleExtendExpiration = async () => {
    if (!selectedTransferForExtension || !newExpiration) return;

    setIsUpdatingExpiration(true);
    try {
      const response = await fetch(`/api/transfers`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedTransferForExtension.id, expiration: newExpiration }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('errors.failedToUpdateExpiration'));
      }

      const updatedData = await response.json();
      setTransfers(prevTransfers => 
        prevTransfers.map(t => 
          t.id === updatedData.transfer.id ? { ...t, expires_at: updatedData.transfer.expires_at } : t
        )
      );
      closeExtendExpirationModal();
    } catch (err: any) {
      setError(err.message || t('errors.failedToUpdateExpiration'));
      console.error(err);
    } finally {
      setIsUpdatingExpiration(false);
    }
  };

  return (
    <div className={`min-h-screen ${styles.pageBg} py-8 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
          <h1 className={`text-3xl font-bold ${styles.headingText}`}>
            {t('transfers.title')}
          </h1>
          <div className="relative group mt-4 sm:mt-0">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg opacity-0 group-hover:opacity-75 blur transition-all duration-300"></div>
            <button 
              onClick={() => router.push('/dashboard')}
              className="relative inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 z-10 transition-colors duration-150"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t('dashboard.newTransfer')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className={`${styles.cardBg} rounded-xl shadow-lg p-8 flex flex-col items-center justify-center`}>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <p className={styles.subText}>{t('common.loading')}</p>
          </div>
        ) : error ? (
          <div className={`${styles.cardBg} rounded-xl shadow-lg p-8 text-center`}>
            <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className={styles.dangerText + " font-medium"}>{error}</p>
          </div>
        ) : transfers.length === 0 ? (
          <div className={`${styles.cardBg} rounded-xl shadow-lg p-8 text-center`}>
            <svg className="w-12 h-12 mx-auto text-indigo-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className={`text-xl font-medium ${styles.cardTitle} mb-2`}>{t('transfers.noTransfers')}</h3>
            <p className={styles.subText}>{t('transfers.createYourFirstTransfer')}</p>
            <button 
              onClick={() => router.push('/dashboard')}
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t('transfers.createTransfer')}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getCurrentPageTransfers().map(transfer => {
                const status = getStatus(transfer);
                const statusColor = {
                  red: `${styles.dangerText}`,
                  orange: `${styles.warningText}`,
                  yellow: `${styles.warningText}`,
                  green: `${styles.successText}`
                }[status.color];
                
                return (
                  <div key={transfer.id} className="relative group">
                    <div 
                      className="absolute -inset-all bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg opacity-10 group-hover:opacity-80 blur-md group-hover:blur-lg transition-all duration-300"
                    />
                    <motion.div 
                      className={`relative p-6 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg shadow border border-gray-100 dark:border-gray-700 mb-4`}
                      whileHover={{ y: -3, boxShadow: "0 8px 20px -4px rgba(79, 70, 229, 0.3)" }}
                      initial={{ opacity: 0.8 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4 }}
                    >
                      {getStatus(transfer).label && (
                        <div className={`absolute top-0 right-0 ${getStatus(transfer).color === 'green' ? 'bg-green-100 text-green-800' : getStatus(transfer).color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : getStatus(transfer).color === 'orange' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'} px-3 py-1 text-xs font-medium rounded-bl-lg`}>
                          {getStatus(transfer).label}
                        </div>
                      )}
                      
                      <div className="mb-4">
                        <h2 className={`text-xl font-semibold ${styles.cardTitle} flex items-center flex-wrap mb-2 truncate`}>
                          {transfer.archive_name}
                        </h2>
                        <span className={`text-sm font-normal ${styles.subText} bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md`}>
                          ID: {transfer.id}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-4">
                        <div className={`${styles.primaryBg} p-1.5 rounded-md inline-flex items-center`}>
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className={`text-xs font-medium ${styles.primaryText}`}>
                            {transfer.stats.link_views}
                          </span>
                        </div>
                        <div className={`${styles.primaryBg} p-1.5 rounded-md inline-flex items-center`}>
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span className={`text-xs font-medium ${styles.primaryText}`}>
                            {transfer.stats.downloads}
                          </span>
                        </div>
                        <div className={`${transfer.is_encrypted ? styles.successBg : styles.warningBg} p-1.5 rounded-md inline-flex items-center`}>
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span className={`text-xs font-medium ${transfer.is_encrypted ? styles.successText : styles.warningText}`}>
                            {transfer.is_encrypted ? t('transfers.encrypted') : t('transfers.notEncrypted')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <p className={`${styles.subText} text-sm mb-1`}>
                          <span className="font-medium">{t('transfers.created')}:</span> {formatDate(transfer.created_at)}
                        </p>
                        {transfer.expires_at && (
                          <p className={`${styles.subText} text-sm mb-1`}>
                            <span className="font-medium">{t('transfers.expires')}:</span> {formatDate(transfer.expires_at)}
                          </p>
                        )}
                        <p className={`${styles.subText} text-sm mb-1`}>
                          <span className="font-medium">{t('transfers.totalSize')}:</span> {formatBytes(transfer.size_bytes)}
                        </p>
                        <p className={`${styles.subText} text-sm mb-3`}>
                          <span className="font-medium">{t('transfers.files')}:</span> {transfer.files.length}
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => copyLink(transfer.id)}
                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {selectedTransfer === transfer.id ? (
                            <>
                              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {t('common.copied')}
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              {t('transfers.copyLink')}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => router.push(`/download/${transfer.id}`)}
                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-1 focus:ring-green-500"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {t('common.view')}
                        </button>
                        <button
                          onClick={() => openEmailModal(transfer.id)}
                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {t('common.send')}
                        </button>
                        <button
                          onClick={() => openExtendExpirationModal(transfer)}
                          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          title={t('transfers.extendExpirationButton')}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                          {t('transfers.extendExpirationButton')}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(transfer.id)}
                          className="inline-flex items-center justify-center p-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-1 focus:ring-red-500"
                          title={t('common.delete')}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </div>
            
            <Pagination />
          </>
        )}
      </div>

      {/* Confirm Delete Modal with Animation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div 
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div 
              className={`${styles.cardBg} rounded-xl shadow-xl p-6 max-w-md w-full relative`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
              {/* Close button (optional, but good for consistency) */}
              <motion.button 
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={() => setConfirmDelete(null)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>

              <div className="text-center mb-6 pt-4"> {/* Added padding top */} 
                <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <h3 className={`text-xl font-semibold ${styles.cardTitle} mb-2`}>{t('transfers.confirmDelete')}</h3>
                <p className={styles.subText}>{t('transfers.confirmDeleteMessage')}</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-center space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => deleteTransfer(confirmDelete)}
                  disabled={deleting}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {deleting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('common.processing')}
                    </span>
                  ) : (
                    t('transfers.deleteTransfer')
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send Email Modal with Animation */}
      <AnimatePresence>
        {emailOpen && (
          <motion.div 
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setEmailOpen(null)}
          >
            <motion.div 
              className={`${styles.cardBg} rounded-xl shadow-xl p-6 max-w-md w-full relative`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
              {/* Close button (optional, but good for consistency) */}
              <motion.button 
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={() => setEmailOpen(null)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>

              <div className="text-center mb-6 pt-4"> {/* Added padding top */} 
                <svg className="w-12 h-12 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h3 className={`text-xl font-semibold ${styles.cardTitle} mb-2`}>{t('transfers.sendEmailTitle')}</h3>
                <p className={styles.subText}>{t('transfers.sendEmailMessage')}</p>
              </div>

              {emailSent === emailOpen ? (
                <div className="text-center">
                  <div className="flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className={`font-medium ${styles.successText}`}>{t('transfers.emailSuccess')}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label htmlFor="email-input" className={`block text-sm font-medium ${styles.subText} mb-1`}>
                      {t('transfers.emailAddress')}
                    </label>
                    <input
                      type="email"
                      id="email-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
                      placeholder={t('upload.emailPlaceholder')}
                      disabled={sendingEmail}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                    <button
                      onClick={() => setEmailOpen(null)}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={() => sendEmail(emailOpen)}
                      disabled={sendingEmail || !email.trim() || !email.includes('@')}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {sendingEmail ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t('transfers.sendingEmail')}
                        </span>
                      ) : (
                        t('common.send')
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extend Expiration Modal */}
      <AnimatePresence>
        {isExtendModalOpen && selectedTransferForExtension && (
          <motion.div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeExtendExpirationModal}
          >
            <motion.div 
              className={`max-w-md w-full p-6 md:p-8 ${styles.cardBg} rounded-lg shadow-2xl relative`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.button 
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={closeExtendExpirationModal}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
              
              <h3 className={`text-xl font-semibold mb-4 ${styles.headingText}`}>{t('transfers.extendExpirationTitle')}</h3>
              <p className={`${styles.subText} mb-1`}>{t('transfers.currentExpiration')}: {selectedTransferForExtension.expires_at ? formatDate(selectedTransferForExtension.expires_at) : t('transfers.permanent')}</p>
              <p className={`${styles.subText} mb-6`}>{t('transfers.archiveNameLabel')}: {selectedTransferForExtension.archive_name}</p>

              <div className="space-y-3 mb-6">
                {[ '1-month', '3-months', 'permanent'].map(period => (
                  <button
                    key={period}
                    onClick={() => setNewExpiration(period)}
                    className={`w-full text-left px-4 py-2.5 rounded-md transition-all duration-200 ${styles.input} border ${newExpiration === period ? 'bg-indigo-600 text-white border-indigo-500 ring-2 ring-indigo-400' : 'hover:bg-white/10 dark:hover:bg-gray-700/50 border-gray-300 dark:border-gray-600'}`}
                  >
                    {t(`transfers.expirationOptions.${period}`)}
                  </button>
                ))}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeExtendExpirationModal}
                  className={`px-4 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600`}
                  disabled={isUpdatingExpiration}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleExtendExpiration}
                  disabled={!newExpiration || isUpdatingExpiration}
                  className={`px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center`}
                >
                  {isUpdatingExpiration ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : null}
                  {t('common.saveChanges')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 