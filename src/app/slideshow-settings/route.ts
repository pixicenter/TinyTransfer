import { NextResponse } from 'next/server';
import db, { getAppSettings } from '../../lib/db';

// This route needs to run on Node.js due to the SQLite operations
export const runtime = 'nodejs';

// The interface for the application settings
interface AppSettings {
  id: number;
  slideshow_interval: number;
  slideshow_effect: string;
}

// GET for getting the slideshow settings - accessible publicly
export async function GET() {
  try {
    // Get all settings from the database
    const settings = getAppSettings.get() as AppSettings;
    
    if (!settings) {
      // Return the default values for slideshow if no settings exist
      return NextResponse.json({
        slideshow_interval: 6000,
        slideshow_effect: 'fade',
      });
    }
    
    // Return only the settings needed for slideshow
    // Without exposing sensitive information about encryption or other settings
    const slideshowSettings = {
      slideshow_interval: settings.slideshow_interval,
      slideshow_effect: settings.slideshow_effect,
    };
    
    return NextResponse.json(slideshowSettings);
  } catch (error) {
    console.error('Error getting slideshow settings:', error);
    return NextResponse.json(
      { error: 'Could not get slideshow settings' },
      { status: 500 }
    );
  }
} 