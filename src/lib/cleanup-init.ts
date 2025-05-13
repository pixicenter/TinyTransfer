import { CleanupService } from '../services/CleanupService';
import fs from 'fs';
import path from 'path';

// Flag pentru a preveni inițializările multiple
let isInitialized = false;

// Funcție pentru logarea activității în fișier
function logToFile(message: string) {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    
    // Creare director de logs dacă nu există
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logFile = path.join(logsDir, 'cleanup.log');
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // Append-uim mesajul la fișierul de log
    fs.appendFileSync(logFile, logMessage);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

export function initializeCleanupService() {
  if (isInitialized) {
    return;
  }
  
  try {
    // Inițializăm serviciul de curățare
    CleanupService.initialize();
    isInitialized = true;
    
    const message = 'CleanupService initialized from cleanup-init module';
    // console.log(message);
    logToFile(message);
    
    // Setup logger pentru evenimentele cron
    // Interceptăm // console.log pentru a loga și în fișier
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    console.log = function(...args) {
      originalConsoleLog.apply(console, args);
      
      // Logăm doar mesajele relevante pentru CleanupService
      const message = args.join(' ');
      if (message.includes('CleanupService') || 
          message.includes('expired transfers') || 
          message.includes('cleanup')) {
        logToFile(message);
      }
    };
    
    console.error = function(...args) {
      originalConsoleError.apply(console, args);
      
      // Logăm erorile relevante pentru CleanupService
      const message = args.join(' ');
      if (message.includes('CleanupService') || 
          message.includes('expired transfers') || 
          message.includes('cleanup')) {
        logToFile(`ERROR: ${message}`);
      }
    };
  } catch (error) {
    console.error('Failed to initialize CleanupService:', error);
    logToFile(`ERROR: Failed to initialize CleanupService: ${error}`);
  }
}

// Auto-inițializare când modulul este importat
// Este folosit doar pe server, nu va afecta build-ul client
if (typeof window === 'undefined') {
  initializeCleanupService();
} 