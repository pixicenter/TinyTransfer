import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Endpoint pentru verificarea stării serviciului de curățare
export async function GET(request: NextRequest) {
  try {
    // Verificăm dacă există fișierul de log
    const logsDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logsDir, 'cleanup.log');
    
    let logExists = false;
    const lastRuns: string[] = [];
    let isRunning = false;
    
    if (fs.existsSync(logFile)) {
      logExists = true;
      
      // Citim ultimele 20 de linii din log
      const logContent = fs.readFileSync(logFile, 'utf8');
      const logLines = logContent.split('\n').filter(line => line.trim() !== '');
      
      // Extragem ultimele 20 de linii
      const recentLines = logLines.slice(-20);
      
      // Verificăm dacă există rulări recente (în ultima oră)
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      // Filtrăm liniile care conțin "scheduled check running"
      const scheduledRuns = recentLines.filter(line => line.includes('scheduled check running'));
      
      // Extragem timestamp-urile
      for (const run of scheduledRuns) {
        const match = run.match(/\[(.*?)\]/);
        if (match && match[1]) {
          const timestamp = match[1];
          const runDate = new Date(timestamp);
          
          // Verificăm dacă rularea este recentă (în ultima oră)
          if (runDate > oneHourAgo) {
            isRunning = true;
          }
          
          lastRuns.push(timestamp);
        }
      }
    }
    
    // Calculăm următoarea rulare programată
    const now = new Date();
    const minutes = now.getMinutes();
    const nextRunMinutes = Math.ceil(minutes / 10) * 10;
    const nextRun = new Date(now);
    
    if (nextRunMinutes === 60) {
      // Dacă suntem la minutul 60, trecem la ora următoare și minutul 0
      nextRun.setHours(nextRun.getHours() + 1);
      nextRun.setMinutes(0);
    } else {
      nextRun.setMinutes(nextRunMinutes);
    }
    
    // Resetăm secundele și milisecundele
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);
    
    return NextResponse.json({
      status: isRunning ? 'active' : 'inactive',
      logExists,
      lastRuns: lastRuns.slice(-5), // Ultimele 5 rulări
      nextScheduledRun: nextRun.toISOString(),
      currentTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking cleanup service status:', error);
    return NextResponse.json(
      { error: 'Failed to check cleanup service status' },
      { status: 500 }
    );
  }
} 