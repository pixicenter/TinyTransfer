import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// The route needs to run on Node.js due to file operations
export const runtime = 'nodejs';

// The path to the gallery directory
const GALLERY_PATH = path.join(process.cwd(), 'public', 'gallery');

// Ensure the gallery directory exists
if (!fs.existsSync(GALLERY_PATH)) {
  fs.mkdirSync(GALLERY_PATH, { recursive: true });
  console.log(`Gallery directory created at ${GALLERY_PATH}`);
}

// This route will be accessible at /gallery
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
    
    console.log(`Public gallery request - mode: ${mode}, index: ${index}`);
    
    // Read the files from the directory
    const files = fs.readdirSync(GALLERY_PATH);
    console.log(`Number of files in gallery: ${files.length}`);
    
    // Filter only image files (.jpg, .jpeg, .png, .webp, etc.)
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext);
    });
    
    console.log(`Number of filtered image files: ${imageFiles.length}`);
    
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
      console.log(`Returning gallery info: total=${imageFiles.length}`);
      return NextResponse.json({ total: imageFiles.length });
    }
    
    // Default number of images to return
    const MAX_IMAGES = 5;
    // Shuffle the images randomly
    const shuffledImages = [...imageFiles].sort(() => Math.random() - 0.5);
    // Take only the first MAX_IMAGES images
    const limitedImages = shuffledImages.slice(0, MAX_IMAGES);
    
    // console.log(`Returning ${limitedImages.length} random images from ${imageFiles.length} total`);
    
    return NextResponse.json({ 
      images: limitedImages, 
      total: imageFiles.length 
    });
  } catch (error) {
    console.error('Error retrieving gallery images:', error);
    return NextResponse.json({ error: 'Failed to retrieve gallery images' }, { status: 500 });
  }
} 