'use client';

import React, { useState, useEffect } from 'react';
import UploadForm from '../../components/UploadForm';
import { useSettings } from '../../lib/SettingsContext';
import { useLocale } from '../../lib/LocaleContext';

interface Transfer {
  id: string;
  created_at: string;
  expires_at: string | null;
  archive_name: string;
  size_bytes: number;
}

interface Stats {
  totalTransfers: number;
  totalFiles: number;
  totalStorageUsed: number;
  activeTransfers: number;
  expiredTransfers: number;
  availableStorage: number;
}

export default function DashboardPage() {
  const { settings } = useSettings();
  const { t, locale } = useLocale();
  const [uploadResult, setUploadResult] = useState<{ downloadLink: string, emailSent?: boolean } | null>(null);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
          const data = await response.json();
          setRecentTransfers(data.recentTransfers);
          setStats(data.stats);
        } else {
          console.error(t('errors.dashboardDataLoadFailed'));
        }
      } catch (error) {
        console.error(t('errors.error'), error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [t]);

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

  // Calculate storage usage percentage
  const calculateUsagePercentage = () => {
    if (!stats) return 0;
    const maxStorage = stats.availableStorage + stats.totalStorageUsed;
    return Math.min(100, Math.round((stats.totalStorageUsed / maxStorage) * 100));
  };

  // Defining the classes based on the selected theme
  const pageBg = settings.theme === 'dark' 
    ? 'bg-gradient-to-br from-gray-900 to-gray-800' 
    : 'bg-gradient-to-br from-blue-50 to-indigo-50';
  
  const cardBg = settings.theme === 'dark' 
    ? 'bg-gray-800 backdrop-blur-sm bg-opacity-90 shadow-lg' 
    : 'bg-white backdrop-blur-sm bg-opacity-90 shadow-lg';
  
  const headingText = settings.theme === 'dark' 
    ? 'text-white' 
    : 'text-indigo-900';
  
  const cardTitle = settings.theme === 'dark' 
    ? 'text-gray-100' 
    : 'text-gray-900';
  
  const subText = settings.theme === 'dark' 
    ? 'text-gray-300' 
    : 'text-gray-600';

  const skeletonBg = settings.theme === 'dark' 
    ? 'bg-gray-700' 
    : 'bg-gray-200';

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
          <h1 className={`text-3xl font-bold ${headingText}`}>
            {settings.app_name}
        </h1>
          {stats && (
            <div className="mt-4 sm:mt-0 flex items-center">
              <div className={`w-48 h-3 ${settings.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                  style={{ width: `${calculateUsagePercentage()}%` }}
                />
              </div>
              <span className={`ml-3 text-sm ${subText}`}>
                {formatBytes(stats.totalStorageUsed)} / {formatBytes(stats.availableStorage + stats.totalStorageUsed)} {t('dashboard.used')}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload zone / left */}
          <div className="lg:col-span-2">
            <div className={`${cardBg} rounded-xl p-6 transition-all duration-200 hover:shadow-xl`}>
              <h2 className={`text-xl font-medium ${cardTitle} mb-4 flex items-center`}>
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {t('dashboard.newTransfer')}
              </h2>
              {uploadResult ? (
                <div className={`text-center p-8  rounded-lg`}>
                  <div className="text-indigo-600 mb-3">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className={`text-lg font-medium ${cardTitle} mb-4`}>
                    {t('upload.uploadSuccess')}
                  </h3>
                  
                  {uploadResult.emailSent && (
                    <div className={`mb-4 py-2 px-4 ${settings.theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700'} rounded-md flex items-center justify-center`}>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {t('transfers.emailSuccess')}
                    </div>
                  )}
                  
                  <p className={`mb-4 ${subText}`}>{t('upload.shareLink')}:</p>
                  <div className={`flex items-center ${settings.theme === 'dark' ? 'bg-gray-700' : 'bg-white'} p-3 rounded-lg border ${settings.theme === 'dark' ? 'border-gray-600' : 'border-gray-200'} shadow-sm`}>
                    <input
                      type="text"
                      value={uploadResult.downloadLink}
                      readOnly
                      className={`flex-1 text-sm p-1 border-0 ${settings.theme === 'dark' ? 'bg-transparent text-white' : 'bg-transparent text-gray-800'} focus:outline-none focus:ring-0`}
                    />
                    <a
                      href={uploadResult.downloadLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-2 text-green-600 hover:text-green-800 ${settings.theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'} rounded-md`}
                      title={t('common.view')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(uploadResult.downloadLink)}
                      className={`ml-2 p-2 text-indigo-600 hover:text-indigo-800 ${settings.theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-50'} rounded-md`}
                      title={t('common.copy')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    </button>
                  </div>
                  <button
                    onClick={() => setUploadResult(null)}
                    className="mt-8 inline-flex items-center justify-center px-5 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {t('upload.uploadMoreFiles')}
                  </button>
                </div>
              ) : (
                <UploadForm onUploadComplete={setUploadResult} />
              )}
            </div>
          </div>

          {/* Statistics / right */}
          <div className="space-y-6">
            {/* Account Info card - removed permanent glow */}
            <div className={`${cardBg} rounded-xl p-6 transition-all duration-200 hover:shadow-xl`}>
              <h2 className={`text-xl font-medium ${cardTitle} mb-4 flex items-center`}>
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {t('dashboard.accountInfo')}
              </h2>
              
              {loading ? (
                <div className="animate-pulse space-y-4">
                  <div className={`h-12 ${skeletonBg} rounded`}></div>
                  <div className={`h-12 ${skeletonBg} rounded`}></div>
                  <div className={`h-12 ${skeletonBg} rounded`}></div>
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  <div className={`flex items-center justify-between p-3 rounded-lg ${settings.theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-50'}`}>
                    <span className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('dashboard.activeTransfers')}</span>
                    <span className={`text-xl font-bold ${settings.theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>{stats.activeTransfers}</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${settings.theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'}`}>
                    <span className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('dashboard.totalFiles')}</span>
                    <span className={`text-xl font-bold ${settings.theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>{stats.totalFiles}</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${settings.theme === 'dark' ? 'bg-yellow-900/30' : 'bg-yellow-50'}`}>
                    <span className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('dashboard.expiredTransfers')}</span>
                    <span className={`text-xl font-bold ${settings.theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>{stats.expiredTransfers}</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${settings.theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50'}`}>
                    <span className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('dashboard.availableStorage')}</span>
                    <span className={`text-xl font-bold ${settings.theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>{formatBytes(stats.availableStorage)}</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${settings.theme === 'dark' ? 'bg-gray-900/30' : 'bg-gray-50'}`}>
                    <span className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Status</span>
                    <div className={`w-3 h-3 rounded-full mr-2 ${settings.encryption_enabled 
                    ? 'bg-green-500 animate-pulse' 
                    : 'bg-red-500'}`}>
                  </div>
                    <span className={`text-m font-medium ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{settings.encryption_enabled
                      ? t('dashboard.encryptionEnabled')
                      : t('dashboard.encryptionDisabled')}</span>
                  </div>
                  {settings.encryption_enabled && (
                    <div className={`flex items-center justify-between p-3 rounded-lg ${settings.theme === 'dark' ? 'bg-gray-900/30' : 'bg-gray-50'}`}>
                      <span className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{t('settings.encryptionKeySource')}</span>
                      <span className={`text-m font-medium ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {settings.encryption_key_source === 'manual' && t('settings.encryptionKeySourceManual')}
                        {settings.encryption_key_source === 'transfer_name' && t('settings.encryptionKeySourceTransferName')}
                        {settings.encryption_key_source === 'email' && t('settings.encryptionKeySourceEmail')}
                        {settings.encryption_key_source === 'password' && t('settings.encryptionKeySourcePassword')}
                        {settings.encryption_key_source === 'timestamp' && t('settings.encryptionKeySourceTimestamp')}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className={`${subText} text-center py-4`}>{t('errors.statsLoadFailed')}</p>
              )}
            </div>

            {/* Transfers button with hover glow */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition-all duration-300"></div>
              <a 
                href="/transfers" 
                className={`relative block text-center py-4 ${cardBg} rounded-xl hover:shadow-xl transition-all duration-200 z-10`}
              >
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <span className={`font-medium text-lg ${settings.theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{t('header.transfers')}</span>
                </div>
                <p className={`text-sm ${subText} mt-1`}>{t('dashboard.viewAllTransfers')}</p>
              </a>
            </div>

            {/* Recent Transfers card - removed permanent glow */}
            <div className={`${cardBg} rounded-xl p-6 transition-all duration-200 hover:shadow-xl`}>
              <h2 className={`text-xl font-medium ${cardTitle} mb-4 flex items-center`}>
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('dashboard.recentTransfers')}
              </h2>
              
              {loading ? (
                <p className={`${subText} text-center py-4`}>{t('common.loading')}</p>
              ) : recentTransfers.length === 0 ? (
                <p className={`${subText} text-center py-4`}>{t('transfers.noTransfers')}</p>
              ) : (
                <div className="space-y-3">
                  {recentTransfers.slice(0, 4).map((transfer) => (
                    <a 
                      key={transfer.id} 
                      href={`/download/${transfer.id}`}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        settings.theme === 'dark' 
                        ? 'border-gray-700 hover:bg-gray-700/50' 
                        : 'border-gray-100 hover:bg-gray-50'
                      } transition-colors duration-150`}
                    >
                      <div className="flex items-center">
                        <div className={settings.theme === 'dark' ? 'bg-indigo-900/50 p-2 rounded-md' : 'bg-indigo-100 p-2 rounded-md'}>
                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className={`text-sm font-medium ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {transfer.archive_name.split('.')[0]}
                           
                          </p>
                          <p className={`text-xs ${settings.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{formatDate(transfer.created_at)}</p>
                        </div>
                      </div>
                      <div>
                        <span className={`text-xs py-1 px-2 rounded-full ${settings.theme === 'dark' ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-100 text-indigo-800'}`}>
                          {formatBytes(transfer.size_bytes)}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 