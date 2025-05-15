#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

/**
 * Script pentru ștergerea tuturor fișierelor dintr-un subfolder din uploads sau pentru afișarea/ștergerea fișierelor ghost (multipart incomplete) din R2
 * Utilizare: node delete-r2-folder.js <folder>
 * Dacă nu se dă argument, va lista subfolderele din uploads și vei putea alege unul.
 * Opțional: poți alege să vezi și să ștergi ghost files (multipart uploads incomplete)
 */

const { S3Client, ListObjectsV2Command, DeleteObjectCommand, ListMultipartUploadsCommand, AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');
const readline = require('readline');

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error('Lipsesc variabilele de mediu pentru R2!');
  process.exit(1);
}

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function listUploadsSubfolders() {
  // Listăm doar subfolderele din uploads/
  const folders = new Set();
  let continuationToken = undefined;
  do {
    const listParams = {
      Bucket: bucketName,
      Prefix: 'uploads/',
      Delimiter: '/',
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    };
    const listRes = await s3.send(new ListObjectsV2Command(listParams));
    if (listRes.CommonPrefixes) {
      for (const cp of listRes.CommonPrefixes) {
        // Eliminăm prefixul 'uploads/' la afișare
        if (cp.Prefix !== 'uploads/') {
          folders.add(cp.Prefix);
        }
      }
    }
    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
  } while (continuationToken);
  return Array.from(folders);
}

async function deleteFolder(prefix) {
  let deleted = 0;
  let continuationToken = undefined;
  const BATCH_SIZE = 10;
  do {
    const listParams = {
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    };
    const listRes = await s3.send(new ListObjectsV2Command(listParams));
    const objects = listRes.Contents || [];
    if (objects.length === 0) {
      break;
    }
    console.log('Fișiere găsite pentru ștergere:');
    objects.forEach((o, idx) => console.log(`${idx + 1}. ${o.Key}`));
    // Ștergem în batch-uri paralele
    for (let i = 0; i < objects.length; i += BATCH_SIZE) {
      const batch = objects.slice(i, i + BATCH_SIZE);
      const deletePromises = batch.map(async (obj) => {
        const key = obj.Key;
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
          console.log(`Șters: ${key}`);
          deleted++;
        } catch (err) {
          console.error(`Eroare la ștergerea ${key}:`, err);
        }
      });
      await Promise.all(deletePromises);
    }
    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
  } while (continuationToken);
  return deleted;
}

async function listGhostFiles() {
  // Listăm multipart uploads incomplete (ghost files) din orice folder
  let uploads = [];
  let keyMarker = undefined;
  let uploadIdMarker = undefined;
  do {
    const params = {
      Bucket: bucketName,
      KeyMarker: keyMarker,
      UploadIdMarker: uploadIdMarker,
      MaxUploads: 1000,
    };
    const res = await s3.send(new ListMultipartUploadsCommand(params));
    if (res.Uploads) {
      uploads = uploads.concat(res.Uploads);
    }
    keyMarker = res.IsTruncated ? res.NextKeyMarker : undefined;
    uploadIdMarker = res.IsTruncated ? res.NextUploadIdMarker : undefined;
  } while (keyMarker && uploadIdMarker);
  return uploads;
}

async function deleteGhostFiles(ghosts) {
  let deleted = 0;
  const BATCH_SIZE = 10;
  for (let i = 0; i < ghosts.length; i += BATCH_SIZE) {
    const batch = ghosts.slice(i, i + BATCH_SIZE);
    const deletePromises = batch.map(async (ghost) => {
      try {
        await s3.send(new AbortMultipartUploadCommand({
          Bucket: bucketName,
          Key: ghost.Key,
          UploadId: ghost.UploadId,
        }));
        console.log(`Ghost șters: ${ghost.Key} (uploadId: ${ghost.UploadId})`);
        deleted++;
      } catch (err) {
        console.error(`Eroare la ștergerea ghost ${ghost.Key}:`, err);
      }
    });
    await Promise.all(deletePromises);
  }
  return deleted;
}

async function promptFolder(folders) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('Alege subfolderul din uploads pe care vrei să-l ștergi:');
    folders.forEach((f, i) => console.log(`${i + 1}. ${f}`));
    rl.question('Număr folder sau "g" pentru ghost files: ', (answer) => {
      rl.close();
      if (answer.trim().toLowerCase() === 'g') {
        resolve('GHOST');
        return;
      }
      const idx = parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < folders.length) {
        resolve(folders[idx]);
      } else {
        console.error('Număr invalid.');
        process.exit(1);
      }
    });
  });
}

async function showBucketUsage() {
  let totalSize = 0;
  let continuationToken = undefined;
  let fileCount = 0;
  do {
    const listParams = {
      Bucket: bucketName,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    };
    const listRes = await s3.send(new ListObjectsV2Command(listParams));
    const objects = listRes.Contents || [];
    for (const obj of objects) {
      totalSize += obj.Size || 0;
      fileCount++;
    }
    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
  } while (continuationToken);
  // Formatăm dimensiunea în MB/GB
  const mb = totalSize / (1024 * 1024);
  const gb = totalSize / (1024 * 1024 * 1024);
  console.log(`\nSpațiu total folosit în bucket: ${fileCount} fișiere, ${mb.toFixed(2)} MB (${gb.toFixed(2)} GB)`);
}

async function main() {
  let folder = process.argv[2];
  if (!folder) {
    const folders = await listUploadsSubfolders();
    console.log('Poți introduce "g" pentru a vedea/șterge ghost files (multipart uploads incomplete).');
    console.log('Poți introduce "s" pentru a afișa spațiul total folosit în bucket.');
    if (folders.length === 0) {
      // Nu există subfoldere, dar oferim opțiunea pentru ghost files sau spațiu
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('Nu există subfoldere în uploads/. Tastează "g" pentru ghost files, "s" pentru spațiu sau orice altceva pentru a ieși: ', async (answer) => {
        rl.close();
        if (answer.trim().toLowerCase() === 'g') {
          folder = 'GHOST';
          // continuă cu ghost
          if (folder === 'GHOST') {
            const ghosts = await listGhostFiles();
            if (ghosts.length === 0) {
              console.log('Nu există ghost files (multipart uploads incomplete) în bucket.');
              process.exit(0);
            }
            console.log('Ghost files găsite:');
            ghosts.forEach((g, i) => {
              console.log(`${i + 1}. ${g.Key} (uploadId: ${g.UploadId}, inițiat: ${g.Initiated})`);
            });
            const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl2.question('Vrei să ștergi TOATE ghost files? (da/nu): ', async (answer2) => {
              rl2.close();
              if (answer2.trim().toLowerCase() === 'da') {
                const deleted = await deleteGhostFiles(ghosts);
                console.log(`Total ghost files șterse: ${deleted}`);
              } else {
                console.log('Nu s-au șters ghost files.');
              }
              process.exit(0);
            });
            return;
          }
        } else if (answer.trim().toLowerCase() === 's') {
          await showBucketUsage();
          process.exit(0);
        } else {
          console.log('Ieșire.');
          process.exit(0);
        }
      });
      return;
    }
    folder = await promptFolder(folders);
    if (folder === 's' || folder === 'S') {
      await showBucketUsage();
      process.exit(0);
    }
  }
  if (folder === 'GHOST') {
    const ghosts = await listGhostFiles();
    if (ghosts.length === 0) {
      console.log('Nu există ghost files (multipart uploads incomplete) în bucket.');
      process.exit(0);
    }
    console.log('Ghost files găsite:');
    ghosts.forEach((g, i) => {
      console.log(`${i + 1}. ${g.Key} (uploadId: ${g.UploadId}, inițiat: ${g.Initiated})`);
    });
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Vrei să ștergi TOATE ghost files? (da/nu): ', async (answer) => {
      rl.close();
      if (answer.trim().toLowerCase() === 'da') {
        const deleted = await deleteGhostFiles(ghosts);
        console.log(`Total ghost files șterse: ${deleted}`);
      } else {
        console.log('Nu s-au șters ghost files.');
      }
      process.exit(0);
    });
    return;
  }
  const prefix = folder.endsWith('/') ? folder : folder + '/';
  console.log(`Șterg toate fișierele din subfolderul: ${prefix}`);
  const deleted = await deleteFolder(prefix);
  console.log(`Total fișiere șterse: ${deleted}`);
}

main().catch((err) => {
  console.error('Eroare la rularea scriptului:', err);
  process.exit(1);
}); 