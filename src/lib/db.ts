import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'db.sqlite'));

// Create tables if they don't exist
db.exec(`
  -- Admin settings table
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    admin_password_hash TEXT NOT NULL,
    admin_email TEXT NOT NULL
  );

  -- App settings table
  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    app_name TEXT NOT NULL DEFAULT 'TinyTransfer',
    logo_url TEXT,
    logo_url_dark TEXT,
    logo_url_light TEXT,
    logo_type TEXT DEFAULT 'url' CHECK (logo_type IN ('url', 'file')),
    theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
    language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('ro', 'en')),
    slideshow_interval INTEGER NOT NULL DEFAULT 6000,
    slideshow_effect TEXT NOT NULL DEFAULT 'fade' CHECK (slideshow_effect IN ('fade', 'slide', 'zoom')),
    encryption_enabled INTEGER DEFAULT 0,
    encryption_key_source TEXT DEFAULT 'manual' CHECK (encryption_key_source IN ('manual', 'transfer_name', 'email', 'password', 'timestamp')),
    encryption_manual_key TEXT DEFAULT NULL
  );

  -- Transfers table
  CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NULL,
    archive_name TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    transfer_password_hash TEXT NULL
  );

  -- Individual files table
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id TEXT NOT NULL REFERENCES transfers(id),
    original_name TEXT NOT NULL,
    size_bytes INTEGER NOT NULL
  );

  -- Transfer statistics table
  CREATE TABLE IF NOT EXISTS transfer_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id TEXT NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    link_views INTEGER NOT NULL DEFAULT 0,
    downloads INTEGER NOT NULL DEFAULT 0,
    unique_ips TEXT DEFAULT '[]',
    email_sent BOOLEAN DEFAULT 0,
    email_error TEXT DEFAULT NULL,
    last_accessed DATETIME
  );

  -- Access logs table for transfer views
  CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id TEXT NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_download BOOLEAN NOT NULL DEFAULT 0
  );

  -- Insert default app settings if not exists
  INSERT OR IGNORE INTO app_settings (id, app_name, theme, language) VALUES (1, 'TinyTransfer', 'dark', 'en');
`);

// Check if the columns for encryption exist and add them if they don't
const columns = db.prepare('PRAGMA table_info(transfers)').all();
const columnNames = columns.map((col: any) => col.name);

if (!columnNames.includes('is_encrypted')) {
  db.exec('ALTER TABLE transfers ADD COLUMN is_encrypted INTEGER DEFAULT 0');
}

if (!columnNames.includes('encryption_key_source')) {
  db.exec('ALTER TABLE transfers ADD COLUMN encryption_key_source TEXT DEFAULT NULL');
}

// Check if admin_email column exists in the settings table and add it if it doesn't
const settingsColumns = db.prepare('PRAGMA table_info(settings)').all();
const settingsColumnNames = settingsColumns.map((col: any) => col.name);

if (!settingsColumnNames.includes('admin_email')) {
  try {
    console.log('Migrating settings table to add admin_email column...');
    db.exec('ALTER TABLE settings ADD COLUMN admin_email TEXT DEFAULT "admin@example.com"');
    console.log('Migration successful.');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Database helper functions
export const getTransferById = db.prepare('SELECT * FROM transfers WHERE id = ?');
export const createTransfer = db.prepare(`
  INSERT INTO transfers (id, created_at, expires_at, archive_name, size_bytes, transfer_password_hash, is_encrypted, encryption_key_source)
  VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?)
`);
export const deleteExpiredTransfers = db.prepare(`
  DELETE FROM transfers 
  WHERE expires_at IS NOT NULL 
  AND datetime('now') > datetime(expires_at)
`);
export const getTransferFiles = db.prepare('SELECT * FROM files WHERE transfer_id = ?');
export const insertFile = db.prepare(`
  INSERT INTO files (transfer_id, original_name, size_bytes)
  VALUES (?, ?, ?)
`);

// Functions for transfer statistics
export const initTransferStats = db.prepare(`
  INSERT OR IGNORE INTO transfer_stats (transfer_id, link_views, downloads, unique_ips, last_accessed)
  VALUES (?, 0, 0, '[]', datetime('now'))
`);

export const recordTransferView = db.prepare(`
  UPDATE transfer_stats
  SET link_views = link_views + 1, last_accessed = datetime('now')
  WHERE transfer_id = ?
`);

export const recordTransferDownload = db.prepare(`
  UPDATE transfer_stats
  SET downloads = downloads + 1, last_accessed = datetime('now')
  WHERE transfer_id = ?
`);

export const getTransferStats = db.prepare(`
  SELECT ts.*, COUNT(DISTINCT al.ip_address) as unique_ip_count
  FROM transfer_stats ts
  LEFT JOIN access_logs al ON ts.transfer_id = al.transfer_id
  WHERE ts.transfer_id = ?
  GROUP BY ts.id
`);

export const logAccess = db.prepare(`
  INSERT INTO access_logs (transfer_id, ip_address, user_agent, is_download)
  VALUES (?, ?, ?, ?)
`);

export const updateEmailStatus = db.prepare(`
  UPDATE transfer_stats
  SET email_sent = 1
  WHERE transfer_id = ?
`);

export const updateEmailError = db.prepare(`
  UPDATE transfer_stats
  SET email_error = ?
  WHERE transfer_id = ?
`);

// Transaction function for creating transfer with stats
export const createTransferWithStats = db.transaction((
  id, 
  expiresAt, 
  archiveName, 
  sizeBytes, 
  passwordHash,
  isEncrypted = 0,
  encryptionKeySource = null
) => {
  createTransfer.run(id, expiresAt, archiveName, sizeBytes, passwordHash, isEncrypted, encryptionKeySource);
  initTransferStats.run(id);
});

// New function for getting recent transfers with statistics
export const getRecentTransfersWithStats = db.prepare(`  SELECT t.id, t.created_at, t.expires_at, t.archive_name, t.size_bytes,
         ts.link_views, ts.downloads, ts.last_accessed, ts.email_sent, ts.email_error,
         (SELECT COUNT(DISTINCT ip_address) FROM access_logs WHERE transfer_id = t.id) as unique_ip_count
  FROM transfers t
  LEFT JOIN transfer_stats ts ON t.id = ts.transfer_id
  ORDER BY t.created_at DESC 
  LIMIT ?
`);

// Function for getting transfers without considering statistics
export const getRecentTransfers = db.prepare(`
  SELECT id, created_at, expires_at, archive_name, size_bytes 
  FROM transfers 
  ORDER BY created_at DESC 
  LIMIT ?
`);

// Functions for managing application settings
export const getAppSettings = db.prepare('SELECT * FROM app_settings WHERE id = 1');
export const updateAppSettings = db.prepare(`
  UPDATE app_settings
  SET app_name = ?, logo_url = ?, logo_url_dark = ?, logo_url_light = ?, logo_type = ?, 
      theme = ?, language = ?, slideshow_interval = ?, slideshow_effect = ?,
      encryption_enabled = ?, encryption_key_source = ?, encryption_manual_key = ?
  WHERE id = 1
`);

export default db; 
