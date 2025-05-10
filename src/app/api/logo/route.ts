import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';

// The route needs to run on Node.js because of file operations
export const runtime = 'nodejs';

// The path to the logo directory
const LOGO_PATH = path.join(process.cwd(), 'public', 'logos');

// Ensure the logo directory exists
if (!fs.existsSync(LOGO_PATH)) {
  fs.mkdirSync(LOGO_PATH, { recursive: true });
  console.log(`Logo directory created at ${LOGO_PATH}`);
}

// Allowed file types
const ALLOWED_TYPES = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.png', '.svg', '.jpg', '.jpeg', '.webp'];

// Simple authentication check
function isAuthenticated() {
  // Get the cookies
  const cookieStore = cookies();
  const authToken = cookieStore.get('auth_token');
  
  // Check if the authentication token exists
  return !!authToken;
}

// Helper for downloading files from URLs
async function downloadFileFromUrl(url: string): Promise<{ buffer: Buffer, contentType: string | null }> {
  try {
    console.log(`Downloading file from URL: ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'TinyTransfer/1.0' // Adăugăm un user-agent pentru a evita blocarea
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: HTTP status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type');

    console.log(`Downloaded file: ${buffer.length} bytes, content-type: ${contentType}`);
    return { buffer, contentType };
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}

// Function to get file extension from content-type or URL
function getFileExtensionFromUrl(url: string, contentType: string | null): string {
  // First try to get from content-type
  if (contentType) {
    if (contentType.includes('image/png')) return '.png';
    if (contentType.includes('image/svg+xml')) return '.svg';
    if (contentType.includes('image/jpeg')) return '.jpg';
    if (contentType.includes('image/webp')) return '.webp';
  }
  
  // Then try to get from URL
  const urlExtension = path.extname(new URL(url).pathname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(urlExtension)) {
    return urlExtension;
  }
  
  // Default to .png if we can't determine
  return '.png';
}

// Upload logo
export async function POST(request: NextRequest) {
  try {
    // Check if the request is authenticated  
    if (!isAuthenticated()) {
      console.error('Unauthorized request for logo upload');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Processing logo upload request');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; 
    // Check for URL mode
    const logoUrl = formData.get('logoUrl') as string;
    
    // If we have a logoUrl, we'll download and save it
    if (logoUrl) {
      try {
        console.log(`Received logo URL: ${logoUrl}`);
        
        if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
          return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }
        
        // Download the file
        const { buffer, contentType } = await downloadFileFromUrl(logoUrl);
        
        // Get file extension
        const fileExtension = getFileExtensionFromUrl(logoUrl, contentType);
        
        // Generate a unique name
        const fileName = `logo_${randomUUID()}${fileExtension}`;
        const filePath = path.join(LOGO_PATH, fileName);
        
        console.log(`Generated file name for URL: ${fileName}`);
        console.log(`File path: ${filePath}`);
        
        // Delete old logo if needed
        const url = new URL(request.url);
        const oldLogoQuery = url.searchParams.get('oldLogo');
        
        if (oldLogoQuery && oldLogoQuery.startsWith('/logos/')) {
          console.log(`Attempting to delete old logo: ${oldLogoQuery}`);
          const oldLogoPath = path.join(process.cwd(), 'public', oldLogoQuery);
          if (fs.existsSync(oldLogoPath)) {
            try {
              fs.unlinkSync(oldLogoPath);
              console.log(`Old logo deleted: ${oldLogoPath}`);
            } catch (err) {
              console.error(`Error deleting old logo: ${err}`);
            }
          }
        }
        
        // Save the downloaded file
        await writeFile(filePath, buffer);
        console.log(`Logo file saved successfully from URL at path: ${filePath}`);
        
        return NextResponse.json({ 
          success: true, 
          fileName, 
          path: `/logos/${fileName}`,
          fromUrl: true
        });
      } catch (error) {
        console.error('Error processing logo URL:', error);
        return NextResponse.json({ 
          error: `Failed to process logo URL: ${(error as Error).message}` 
        }, { status: 500 });
      }
    }
    
    // Continue with normal file upload if no URL provided
    if (!file) {
      console.error('No file uploaded and no URL provided');
      return NextResponse.json({ error: 'No file uploaded and no URL provided' }, { status: 400 });
    }

    console.log(`Received file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
    console.log(`Logo type: ${type}`);
    
    // Check the file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.error(`Invalid file type: ${file.type}`);
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}` }, 
        { status: 400 }
      );
    }
    
    // Generate a unique name for the file
    const fileExtension = path.extname(file.name) || 
                         (file.type === 'image/svg+xml' ? '.svg' : 
                          file.type === 'image/png' ? '.png' : 
                          file.type === 'image/jpeg' ? '.jpg' : '.webp');
                          
    const fileName = `logo_${randomUUID()}${fileExtension}`;
    const filePath = path.join(LOGO_PATH, fileName);
    
    console.log(`Generated file name: ${fileName}`);
    console.log(`File path: ${filePath}`);
    
    // Convert the File to ArrayBuffer and then to Buffer to save it
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Delete the old logo if it exists
    const url = new URL(request.url);
    const oldLogoQuery = url.searchParams.get('oldLogo');
    
    if (oldLogoQuery && oldLogoQuery.startsWith('/logos/')) {
      console.log(`Attempting to delete old logo: ${oldLogoQuery}`);
      const oldLogoPath = path.join(process.cwd(), 'public', oldLogoQuery);
      if (fs.existsSync(oldLogoPath)) {
        try {
          fs.unlinkSync(oldLogoPath);
          console.log(`Old logo deleted: ${oldLogoPath}`);
        } catch (err) {
          console.error(`Error deleting old logo: ${err}`);
        }
      } else {
        console.log(`Old logo not found at path: ${oldLogoPath}`);
      }
    } else {
      console.log('No old logo to delete or invalid path');
    }
    
    // Save the file
    try {
      await writeFile(filePath, buffer);
      console.log(`Logo file saved successfully at path: ${filePath}`);
    } catch (err) {
      console.error(`Error saving logo file: ${err}`);
      return NextResponse.json({ error: `Failed to save logo file: ${(err as Error).message}` }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      fileName, 
      path: `/logos/${fileName}` 
    });
    
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json({ error: `Failed to upload logo: ${(error as Error).message}` }, { status: 500 });
  }
}

// Delete logo
export async function DELETE(request: NextRequest) {
  try {
    console.log('Processing logo delete request');
    
    // Check if the request is authenticated
    if (!isAuthenticated()) {
      console.error('Unauthorized request for logo deletion');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const logoPath = url.searchParams.get('path');
    
    console.log('Logo delete request:', logoPath);
    
    if (!logoPath) {
      return NextResponse.json({ error: 'No logo path provided' }, { status: 400 });
    }
    
    // Check if it's an external URL (starts with http:// or https://)
    if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
      console.log('External logo detected, no file deletion needed:', logoPath);
      return NextResponse.json({ 
        success: true, 
        message: 'External logo reference removed successfully',
        externalUrl: true 
      });
    }
    
    // Ensure it's a local logo path
    if (!logoPath.startsWith('/logos/')) {
      console.error('Invalid logo path:', logoPath);
      return NextResponse.json({ error: 'Invalid logo path' }, { status: 400 });
    }
    
    const absolutePath = path.join(process.cwd(), 'public', logoPath);
    
    // Check if the file exists
    if (!fs.existsSync(absolutePath)) {
      console.error(`Logo file not found at path: ${absolutePath}`);
      return NextResponse.json({ error: 'Logo file not found' }, { status: 404 });
    }
    
    // Delete the file
    fs.unlinkSync(absolutePath);
    console.log(`Logo deleted successfully: ${logoPath}`);
    
    return NextResponse.json({ success: true, message: 'Logo deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting logo:', error);
    return NextResponse.json({ error: 'Failed to delete logo' }, { status: 500 });
  }
} 