import { NextRequest, NextResponse } from 'next/server';
import { getTransfer, updateDownloadStats, recordTransferDownload, insertAccessLog } from '../../../../lib/db';
import bcrypt from 'bcrypt';
import { R2StorageService } from '../../../../services/R2StorageService';
import archiver from 'archiver';
import stream, { Readable, PassThrough } from 'stream';

// This route needs to run on Node.js and not on Edge Runtime
export const runtime = 'nodejs';

// Configurăm route-ul pentru a dezactiva cache-ul
export const dynamic = 'force-dynamic';

// Funcție helper pentru a obține IP-ul clientului
function getClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for') || 
         headers.get('x-real-ip') || 
         'unknown';
}

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

    
    // Optimizat pentru streaming rapid și afișarea corectă a progresului în browser
    // Dezactivăm complet compresia pentru toate fișierele (store = fără compresie)
    const archive = archiver('zip', { 
      store: true // Dezactivăm complet compresia pentru toate fișierele
    });

    // Calculăm dimensiunea totală a fișierelor
    let totalSize = 0;
    
    // Procesăm fiecare fișier doar pentru a calcula size total
    for (const file of files) {
      totalSize += file.size;
    }
    
    // Adăugăm overhead pentru structura ZIP - o estimare mai precisă
    // Pentru arhive fără compresie, dimensiunea e aproape identică cu suma fișierelor
    // plus un overhead pentru structura ZIP (aproximativ 30 bytes per fișier pentru header)
    // plus 22 bytes pentru end of central directory record
    const zipHeaderPerFile = 30;
    const zipCentralDirPerFile = 46;
    const zipEndOfCentralDir = 22;
    const zipOverhead = (files.length * (zipHeaderPerFile + zipCentralDirPerFile)) + zipEndOfCentralDir;
    
    const estimatedArchiveSize = totalSize + zipOverhead;
    
    // Adăugăm o marjă minimă de siguranță (doar 5%)
    // const safetyMargin = Math.max(estimatedArchiveSize * 0.05, 50 * 1024); // 5% sau minim 50KB
    const finalEstimatedSize = estimatedArchiveSize;
    
    console.log(`Transfer ${id}: Dimensiune originală totală: ${totalSize} bytes`);
    console.log(`Transfer ${id}: Overhead ZIP estimat: ${zipOverhead} bytes (${files.length} fișiere)`);
    // console.log(`Transfer ${id}: Dimensiune estimată a arhivei: ${estimatedArchiveSize} bytes + marjă ${safetyMargin} bytes`);
    console.log(`Transfer ${id}: Dimensiune finală raportată: ${finalEstimatedSize} bytes`);
    
    // Salvăm estimarea pentru monitorizare
    const totalBytesEstimated = finalEstimatedSize;
    
    // Pregătim răspunsul HTTP
    const safeFilename = transfer.filename || `${transfer.archive_name}.zip`;
    const encodedFilename = encodeURIComponent(safeFilename.replace(/[^\w\s.-]/g, '_')); // Înlocuim caractere nepermise
    
    // Pregătim răspunsul HTTP
    const responseInit: ResponseInit = {
      headers: {
        'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Type': 'application/zip',
        'Content-Transfer-Encoding': 'binary',
        'Content-Length': finalEstimatedSize.toString(), // Folosim finalEstimatedSize care include marja
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Accept-Ranges': 'bytes',
        'X-Original-Size': totalSize.toString(),
        'X-Estimated-Size': finalEstimatedSize.toString(),
        'X-Files-Count': files.length.toString(),
        'X-Content-Type-Options': 'nosniff'
      }
    };

    // Aici adaptăm pentru problema cu tipul PassThrough
    // Convertim PassThrough la ReadableStream care este acceptat de Response
    const readableStream = stream.Readable.toWeb(archive) as ReadableStream<Uint8Array>;
    const response = new Response(readableStream, responseInit);
    
    // Adăugăm fișierele în arhivă (asincron)
    const filesProcessed: Promise<void>[] = [];
    
    console.log(`Pregătire arhivă pentru transfer ${id} cu ${files.length} fișiere...`);

    // Procesare asincronă a tuturor fișierelor - procesăm în loturi mici pentru mai multă stabilitate
    // Împărțim fișierele în grupe de maxim 10 pentru procesare secvențială
    const chunkSize = 10;
    const fileChunks = [];
    
    for (let i = 0; i < files.length; i += chunkSize) {
      fileChunks.push(files.slice(i, i + chunkSize));
    }
    
    console.log(`Procesare ${files.length} fișiere în ${fileChunks.length} loturi de maxim ${chunkSize} fișiere`);

    // Procesăm loturile secvențial pentru a evita problemele cu stream-urile multiple paralele
    let processedFiles = 0;
    
    // Set pentru urmărirea stream-urilor active
    const activeStreams = new Set<Readable | PassThrough>();
    
    // Funcție pentru procesarea asincronă a unui lot de fișiere
    const processChunk = async (chunk: typeof files) => {
      // Procesăm fișierele unul câte unul secvențial pentru a evita problemele cu stream-urile
      for (const file of chunk) {
        try {
          // Obținem stream-ul pentru fișier (acum cu decriptare automată)
          const fileStream = await r2Service.getFile(id, file.name);
          
          // Înregistrăm stream-ul în lista de stream-uri active
          activeStreams.add(fileStream);
          
          // Creăm un stream intermediar pentru a preveni închiderea prematură
          const bufferStream = new stream.PassThrough({ 
            highWaterMark: 1024 * 1024, // Buffer mare pentru performanță
            allowHalfOpen: true // Permite închiderea unei părți a stream-ului fără a închide cealaltă
          });
          
          // Înregistrăm și buffer stream-ul
          activeStreams.add(bufferStream);
          
          // Adăugăm monitorizare pentru evenimente
          fileStream.on('error', (err) => {
            console.error(`Eroare în stream-ul pentru fișierul ${file.name}:`, err);
            bufferStream.destroy(err);
            activeStreams.delete(fileStream);
            activeStreams.delete(bufferStream);
          });
          
          // Când stream-ul original se termină
          fileStream.on('end', () => {
            console.log(`Stream-ul pentru fișierul ${file.name} a fost citit complet`);
            activeStreams.delete(fileStream);
          });
          
          // Când buffer stream-ul se termină
          bufferStream.on('end', () => {
            activeStreams.delete(bufferStream);
          });
          
          // Transferăm datele din fileStream în bufferStream
          fileStream.pipe(bufferStream);
          
          // Adăugăm stream-ul intermediar la arhivă - NU fileStream direct
          archive.append(bufferStream, { name: file.name });
          
          // Așteptăm ca fișierul să fie procesat complet
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              console.warn(`Timeout pentru procesarea fișierului ${file.name}, continuăm cu următorul`);
              resolve(); // Continuăm cu următorul fișier chiar dacă acesta a avut timeout
            }, 180000); // 3 minute timeout per fișier
            
            bufferStream.on('end', () => {
              clearTimeout(timeout);
              processedFiles++;
              console.log(`Fișier adăugat la arhivă (${processedFiles}/${files.length}): ${file.name}`);
              resolve();
            });
            
            bufferStream.on('error', (err) => {
              clearTimeout(timeout);
              console.error(`Eroare la adăugarea fișierului ${file.name} la arhivă:`, err);
              resolve(); // Continuăm cu următorul fișier chiar și în caz de eroare
            });
          });
          
        } catch (error) {
          console.error(`Eroare la procesarea fișierului ${file.name}:`, error);
        }
      }
      
      return true;
    };
    
    // Procesăm loturile secvențial
    (async () => {
      for (const chunk of fileChunks) {
        await processChunk(chunk);
      }
      
      // Finalizăm arhiva după ce toate loturile au fost procesate
      console.log(`Finalizare arhivă pentru ${id} cu ${processedFiles}/${files.length} fișiere procesate`);
      
      // Timeout de siguranță pentru finalizarea arhivei - mai lung
      const finalizeTimeout = setTimeout(() => {
        console.warn('Timeout la finalizarea arhivei, forțăm închiderea');
        try {
          console.log(`Arhivare oprită forțat după timeout. Progres: ${totalBytesEstimated} bytes din estimarea de ${totalBytesEstimated} bytes (${Math.round(totalBytesEstimated * 100 / totalBytesEstimated)}%)`);
          
          // Închidem toate stream-urile active în caz de timeout
          console.log(`Închiderea forțată a ${activeStreams.size} stream-uri active`);
          activeStreams.forEach(stream => {
            try {
              if ('destroy' in stream && typeof stream.destroy === 'function') {
                stream.destroy();
              }
            } catch (e) {
              // Ignorăm erorile
            }
          });
          
          archive.abort();
        } catch (e) {
          console.error('Eroare la abort arhivă:', e);
        }
      }, 300000); // 5 minute timeout pentru finalizare
      
      // Încercăm finalizarea normală
      try {
        // Adăugăm un eveniment pentru a închide stream-urile la finalizare
        archive.on('end', () => {
          clearTimeout(finalizeTimeout);
          console.log(`Arhiva pentru ${id} a fost finalizată cu succes. Închiderea tuturor stream-urilor active (${activeStreams.size})...`);
          
          // Am terminat arhiva, putem curăța toate stream-urile rămase
          setTimeout(() => {
            try {
              console.log(`Curățare resurse pentru transferul ${id} după finalizarea cu succes a arhivei. Stream-uri active rămase: ${activeStreams.size}`);
              
              // Închiderea tuturor stream-urilor active rămase
              activeStreams.forEach(stream => {
                try {
                  if ('destroy' in stream && typeof stream.destroy === 'function') {
                    stream.destroy();
                  }
                } catch (destroyError) {
                  // Ignorăm erorile
                }
              });
              
              // Curățăm setul
              activeStreams.clear();
              console.log(`Toate stream-urile pentru transferul ${id} au fost închise.`);
            } catch (cleanupError) {
              console.error(`Eroare la curățarea resurselor pentru ${id}:`, cleanupError);
            }
          }, 1000); // Așteptăm 1 secundă pentru a permite browser-ului să termine descărcarea
        });
        
        archive.finalize();
      } catch (finalizeError) {
        console.error('Eroare la finalizarea arhivei:', finalizeError);
        clearTimeout(finalizeTimeout);
      }
      
      // Înregistrăm descărcarea în statistici
      try {
        updateDownloadStats.run(id);
        recordTransferDownload.run(id);
        
        // Înregistrăm IP-ul și user agent-ul separat
        insertAccessLog.run(id, getClientIp(req.headers), req.headers.get('user-agent') || 'unknown', 1); // 1 = este descărcare
      } catch (statsError) {
        console.error('Eroare la înregistrarea statisticilor:', statsError);
      }
    })().catch(error => {
      console.error('Eroare la procesarea loturilor de fișiere:', error);
      try {
        archive.finalize();
      } catch (finalizeError) {
        console.error('Eroare la finalizarea arhivei după eroare:', finalizeError);
        try {
          archive.abort();
        } catch (e) {
          // Ignorăm erorile la abort
        }
      }
    });
    
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