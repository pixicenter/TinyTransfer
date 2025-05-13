import { NextRequest, NextResponse } from 'next/server';
import { StorageFactory } from '../../../../services/StorageFactory';
import { getTransfer, updateDownloadStats } from '../../../../lib/db';
import bcrypt from 'bcrypt';
import { R2StorageService } from '../../../../services/R2StorageService';
import archiver from 'archiver';
import stream from 'stream';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';

// Configurăm route-ul pentru a dezactiva cache-ul
export const dynamic = 'force-dynamic';

// Interfață pentru obiectul transfer din baza de date
interface Transfer {
  id: string;
  created_at: string;
  expires_at: string | null;
  archive_name: string;
  size_bytes: number;
  filename: string;
  transfer_password_hash?: string;
  password_hash?: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  try {
    // Verificăm dacă transferul există în baza de date
    const transfer = getTransfer.get(id) as Transfer;
    if (!transfer) {
      return new NextResponse('Transfer not found', { status: 404 });
    }
    // Verifică dacă transferul a expirat
    if (transfer.expires_at && new Date(transfer.expires_at) < new Date()) {
      return new NextResponse('Transfer has expired', { status: 410 });
    }
    // Folosim direct serviciul R2StorageService
    const r2Service = new R2StorageService();
    // Listăm fișierele pentru transfer
    const files = await r2Service.listFiles(id);
    if (!files || files.length === 0) {
      return new NextResponse('No files found for transfer', { status: 404 });
    }

    // Streaming ZIP on-the-fly, fără buffering
    const pass = new stream.PassThrough();
    
    // Optimizat pentru streaming rapid
    const archive = archiver('zip', { 
      zlib: { level: 4 }, // Nivel de compresie scăzut pentru viteză
      store: files.some(file => file.size > 10 * 1024 * 1024) // Folosim stocare fără compresie dacă există fișiere peste 10MB
    });

    // Monitorizăm progresul
    let bytesArchived = 0;
    archive.on('data', (chunk) => {
      bytesArchived += chunk.length;
    });
    
    // Gestionăm erorile
    archive.on('error', (err) => {
      console.error('Eroare în timpul arhivării:', err);
    });
    
    // Conectăm arhiva la stream-ul de output
    archive.pipe(pass);

    // Pregătim răspunsul pentru client imediat
    const filename = encodeURIComponent(transfer.filename || `${id}.zip`);
    
    // Calculăm dimensiunea totală și o estimare a dimensiunii arhivei comprimate
    let totalSize = 0;
    let estimatedCompressedSize = 0;
    
    // Factori de compresie estimați pentru diferite tipuri de fișiere
    const compressionFactors = {
      // Fișiere text - compresie bună (30-40% din dimensiunea originală)
      text: 0.35,
      // Fișiere deja comprimate - compresie minimă (95-98% din dimensiunea originală)
      compressed: 0.97,
      // Fișiere care se comprimă mediu (60-70% din dimensiunea originală)
      medium: 0.65,
      // Valoare implicită - compresie moderată (80% din dimensiunea originală)
      default: 0.8
    };
    
    // Extensii pentru fișiere deja comprimate (imagini, video, audio, arhive)
    const compressedExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg',
      'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm',
      'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac',
      'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'
    ];
    
    // Extensii pentru fișiere text (se comprimă bine)
    const textExtensions = [
      'txt', 'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'xml',
      'md', 'csv', 'log', 'sql', 'php', 'py', 'java', 'c', 'cpp', 'h', 'cs',
      'rb', 'pl', 'sh', 'bat', 'ps1', 'tex', 'doc', 'docx', 'rtf'
    ];
    
    // Extensii pentru fișiere cu compresie medie
    const mediumExtensions = [
      'pdf', 'ppt', 'pptx', 'xls', 'xlsx', 'psd', 'ai', 'eps'
    ];
    
    for (const file of files) {
      const size = file.size || 0;
      totalSize += size;
      
      // Obținem extensia fișierului
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      
      let compressionFactor = compressionFactors.default;
      
      if (textExtensions.includes(extension)) {
        compressionFactor = compressionFactors.text;
      } else if (compressedExtensions.includes(extension)) {
        compressionFactor = compressionFactors.compressed;
      } else if (mediumExtensions.includes(extension)) {
        compressionFactor = compressionFactors.medium;
      }
      
      // Calculăm dimensiunea estimată după compresie pentru acest fișier
      estimatedCompressedSize += Math.round(size * compressionFactor);
    }
    
    // Adăugăm o marjă de siguranță de 5-10% pentru header-ele ZIP și metadata
    const zipOverhead = Math.max(1024, Math.round(totalSize * 0.02)); // Minim 1KB overhead
    const finalEstimatedSize = estimatedCompressedSize + zipOverhead;
    
    const response = new NextResponse(pass as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(finalEstimatedSize),
        'X-Total-Files': String(files.length),
        'X-Original-Size': String(totalSize),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    // Sortăm fișierele crescător după dimensiune pentru streaming rapid
    const sortedFiles = files
      .filter(file => !file.name.endsWith('.zip'))
      .sort((a, b) => (a.size || 0) - (b.size || 0));

    // Procesăm fișierele în background
    (async () => {
      try {
        // Adăugăm mai întâi fișierele mici pentru feedback imediat
        for (const file of sortedFiles) {
          const fileStream = await r2Service.downloadFileInChunks(id, file.name);
          archive.append(fileStream, { name: file.name });
          
          // Pentru fișiere mari, așteptăm să începem transfer
          // Acest lucru ajută să evităm eroarea de timeout
          if (file.size > 50 * 1024 * 1024) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        await archive.finalize();
        updateDownloadStats.run(id);
      } catch (error) {
        console.error(`Eroare la procesarea fișierelor: ${error}`);
        archive.abort();
      }
    })();
    
    return response;
  } catch (error) {
    console.error(`Eroare la streaming arhivă din R2: ${id}`, error);
    return new NextResponse('Server error', { status: 500 });
  }
}

// Endpoint pentru verificarea parolei înainte de descărcare
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  try {
    // Verificăm dacă transferul există în baza de date
    const transfer = getTransfer.get(id) as Transfer;
    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }
    
    // Verifică dacă transferul a expirat
    if (transfer.expires_at && new Date(transfer.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Transfer has expired' }, { status: 410 });
    }
    
    // Verifică dacă transferul este protejat cu parolă
    if (!transfer.password_hash) {
      return NextResponse.json({ success: true, needsPassword: false });
    }
    
    // Body-ul trebuie să conțină parola
    const body = await req.json();
    const { password } = body;
    
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required', needsPassword: true },
        { status: 400 }
      );
    }
    
    // Verifică parola
    const isPasswordValid = await bcrypt.compare(password, transfer.password_hash);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid password', needsPassword: true },
        { status: 401 }
      );
    }
    
    // Parola este validă
    return NextResponse.json({ success: true, needsPassword: false });
    
  } catch (error) {
    console.error('Eroare la verificarea parolei:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 