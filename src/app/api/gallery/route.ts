import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';

// This route needs to run on Node.js because of file operations
export const runtime = 'nodejs';

// The path to the gallery directory
const GALLERY_PATH = path.join(process.cwd(), 'public', 'gallery');

// Ensure the gallery directory exists
if (!fs.existsSync(GALLERY_PATH)) {
  fs.mkdirSync(GALLERY_PATH, { recursive: true });
  // console.log(`Gallery directory created at ${GALLERY_PATH}`);
}

// Allowed image file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Simple authentication check
async function isAuthenticated(request: NextRequest) {
  try {
    // Get the cookies (în Next.js 15, cookies() este asincron)
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth_token');
    
    // Check if the authentication token exists
    return !!authToken;
  } catch (error) {
    console.error('Eroare la verificarea autentificării:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if the directory exists
    if (!fs.existsSync(GALLERY_PATH)) {
      console.error(`Gallery directory does not exist: ${GALLERY_PATH}`);
      return NextResponse.json({ error: 'Gallery directory not found' }, { status: 404 });
    }
    
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode');
    const index = url.searchParams.get('index');
    
    // console.log(`API gallery request - mode: ${mode}, index: ${index}`);
    
    // Read the files from the directory
    const files = fs.readdirSync(GALLERY_PATH);
    // console.log(`Number of files in gallery: ${files.length}`);
    
    // Filter only image files (.jpg, .jpeg, .png, .webp, etc.)
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext);
    });
    
    // console.log(`Number of filtered image files: ${imageFiles.length}`);
    
    // If we request a specific index
    if (mode === 'single' && index !== null) {
      const imageIndex = parseInt(index, 10);
      if (!isNaN(imageIndex) && imageIndex >= 0 && imageIndex < imageFiles.length) {
        const image = imageFiles[imageIndex];
        // console.log(`Returning specific image: ${image}`);
        
        // Check if the file actually exists
        const imagePath = path.join(GALLERY_PATH, image);
        if (!fs.existsSync(imagePath)) {
          console.error(`Image file ${image} does not exist at ${imagePath}`);
          return NextResponse.json({ error: 'Image file not found' }, { status: 404 });
        }
        
        return NextResponse.json({ image, total: imageFiles.length });
      } else {
        console.error(`Invalid image index: ${index}`);
        return NextResponse.json({ error: 'Invalid image index' }, { status: 400 });
      }
    }
    
    // Return only the gallery metadata (not the images)
    if (mode === 'info') {
      // console.log(`Returning gallery info: total=${imageFiles.length}`);
      return NextResponse.json({ total: imageFiles.length });
    }
    
    // Return all images for administration
    if (mode === 'admin') {
      // For admin, check the authentication
      if (!await isAuthenticated(request)) {
        console.error('Unauthorized request for admin gallery');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      // Return all images with more information
      const imagesInfo = imageFiles.map(file => {
        const imagePath = path.join(GALLERY_PATH, file);
        const stats = fs.statSync(imagePath);
        
        return {
          name: file,
          path: `/gallery/${file}`,
          size: stats.size,
          created: stats.birthtime
        };
      });
      
      return NextResponse.json({ images: imagesInfo, total: imageFiles.length });
    }
    
    // Implicit, return a limited number of random images (max 5)
    const MAX_IMAGES = 5;
    // Shuffle the images randomly
    const shuffledImages = [...imageFiles].sort(() => Math.random() - 0.5);
    // Take only the first MAX_IMAGES images
    const limitedImages = shuffledImages.slice(0, MAX_IMAGES);
    
    // // console.log(`Returning ${limitedImages.length} random images from ${imageFiles.length} total`);
    
    return NextResponse.json({ 
      images: limitedImages, 
      total: imageFiles.length 
    });
  } catch (error) {
    console.error('Error retrieving gallery images:', error);
    return NextResponse.json({ error: 'Failed to retrieve gallery images' }, { status: 500 });
  }
}

// Upload new images
export async function POST(request: NextRequest) {
  try {
    // Check if the request is authenticated
    if (!await isAuthenticated(request)) {
      console.error('Unauthorized request for image upload');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    // Check the file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}` }, 
        { status: 400 }
      );
    }
    
    // Generate a unique name for the file
    const fileExtension = path.extname(file.name);
    const fileName = `${randomUUID()}${fileExtension}`;
    const filePath = path.join(GALLERY_PATH, fileName);
    
    // Convert the File to ArrayBuffer and then to Buffer to save it
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Save the file
    await writeFile(filePath, buffer);
    
    return NextResponse.json({ 
      success: true, 
      fileName, 
      path: `/gallery/${fileName}` 
    });
    
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}

// Delete image
export async function DELETE(request: NextRequest) {
  try {
    // console.log('Processing DELETE request for image');
    
    // Check if the request is authenticated
    if (!await isAuthenticated(request)) {
      console.error('Unauthorized request for image deletion');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const fileName = url.searchParams.get('fileName');
    
    // console.log('DELETE request for file:', fileName);
    
    if (!fileName) {
      return NextResponse.json({ error: 'No file name provided' }, { status: 400 });
    }
    
    // Prevent directory traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      console.error('Invalid file name (may contain directory traversal):', fileName);
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }
    
    const filePath = path.join(GALLERY_PATH, fileName);
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found at path: ${filePath}`);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    // console.log(`File deleted successfully: ${fileName}`);
    
    return NextResponse.json({ success: true, message: 'File deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
} 