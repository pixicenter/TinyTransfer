#!/usr/bin/env node

/**
 * Script pentru rularea manuală a procesului de curățare a transferurilor expirate
 * Poate fi utilizat cu crontab pe un server Linux
 * 
 * Exemplu de configurare crontab:
 * Pentru a rula la fiecare 10 minute:
 * 
 * ```
 * 10 * * * * cd /calea/catre/itransfer && node scripts/run-cleanup.js >> /var/log/itransfer-cleanup.log 2>&1
 * ```
 */

// Import fetch API pentru Node.js < 18
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Procesul va ieși după ce se termină toate operațiunile asincrone
let processComplete = false;

// Timp maxim de execuție (în ms) - 5 minute
const MAX_EXECUTION_TIME = 5 * 60 * 1000;

async function main() {
  try {
    // Folosim metoda fetch pentru a apela API-ul de curățare
    console.log(`[${new Date().toISOString()}] Inițierea procesului de curățare...`);
    
    // Construim URL-ul de bază folosind variabila de mediu sau valoarea implicită
    const baseUrl = process.env.HOSTNAME || 'http://localhost:3000';
    const cleanupUrl = `${baseUrl}/api/cleanup`;
    
    console.log(`Apel API către: ${cleanupUrl}`);
    
    const response = await fetch(cleanupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Putem adăuga un token de autorizare dacă este necesar
        ...(process.env.API_SECRET_KEY ? { 'Authorization': `Bearer ${process.env.API_SECRET_KEY}` } : {})
      }
    });
    
    if (!response.ok) {
      throw new Error(`Apelul API a eșuat cu statusul: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`[${new Date().toISOString()}] Rezultatul procesului de curățare:`, JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log(`Curățare finalizată cu succes. ${data.count} transferuri expirate au fost șterse.`);
    } else {
      console.error(`Eroare la curățare: ${data.message || 'Eroare necunoscută'}`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Eroare în procesul de curățare:`, error);
  } finally {
    processComplete = true;
  }
}

// Inițiere script
main();

// Setăm un timeout pentru a ieși din proces în cazul în care operațiunile durează prea mult
setTimeout(() => {
  if (!processComplete) {
    console.error(`[${new Date().toISOString()}] Timeout - Procesul a depășit timpul maxim de execuție (${MAX_EXECUTION_TIME/1000}s)`);
    process.exit(1);
  }
}, MAX_EXECUTION_TIME);

// Ieșim din proces după finalizare
setInterval(() => {
  if (processComplete) {
    process.exit(0);
  }
}, 1000); 