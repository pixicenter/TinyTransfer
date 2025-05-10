import { NextRequest, NextResponse } from 'next/server';
import db, { getAppSettings, updateAppSettings } from '../../../lib/db';
import { cookies } from 'next/headers';

// This route needs to run on Node.js due to the SQLite operations
export const runtime = 'nodejs';

// Interface for the app settings
interface AppSettings {
  id: number;
  app_name: string;
  logo_url: string | null;
  logo_url_dark: string | null;
  logo_url_light: string | null;
  logo_type: string;
  theme: string;
  language: string;
  slideshow_interval: number;
  slideshow_effect: string;
  encryption_enabled: number | boolean;
  encryption_key_source: string;
  encryption_manual_key: string | null;
}

// Simple authentication check
function isAuthenticated() {
  // Get the cookies
  const cookieStore = cookies();
  const authToken = cookieStore.get('auth_token');
  
  // Check if the authentication token exists
  return !!authToken;
}

// GET for getting the current settings - accessible publicly
export async function GET() {
  try {
    const settings = getAppSettings.get() as AppSettings;
    
    if (!settings) {
      // Insert default settings if they don't exist
      db.prepare(`
        INSERT INTO app_settings (id, app_name, theme, language, slideshow_interval, slideshow_effect,
                                 logo_url, logo_url_dark, logo_url_light, logo_type) 
        VALUES (1, 'TinyTransfer', 'dark', 'en', 6000, 'fade', null, null, null, 'url')
      `).run();
      
      return NextResponse.json({
        id: 1,
        app_name: 'TinyTransfer',
        logo_url: null,
        logo_url_dark: null,
        logo_url_light: null,
        logo_type: 'url',
        theme: 'dark',
        language: 'en',
        slideshow_interval: 6000,
        slideshow_effect: 'fade'
      });
    }
    
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json(
      { error: 'Could not get settings' },
      { status: 500 }
    );
  }
}

// PUT for updating the settings - requires authentication
export async function PUT(request: NextRequest) {
  try {
    // Check if the user is authenticated
    if (!isAuthenticated()) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const data = await request.json();
    const { 
      app_name, 
      logo_url, 
      logo_url_dark, 
      logo_url_light, 
      logo_type,
      theme, 
      language, 
      slideshow_interval, 
      slideshow_effect,
      encryption_enabled,
      encryption_key_source,
      encryption_manual_key
    } = data;
    
    // Simple validations
    if (theme && !['light', 'dark'].includes(theme)) {
      return NextResponse.json(
        { error: 'Theme must be light or dark' },
        { status: 400 }
      );
    }
    
    if (language && !['ro', 'en'].includes(language)) {
      return NextResponse.json(
        { error: 'Language must be ro or en' },
        { status: 400 }
      );
    }
    
    if (slideshow_effect && !['fade', 'slide', 'zoom'].includes(slideshow_effect)) {
      return NextResponse.json(
        { error: 'The slideshow effect must be fade, slide or zoom' },
        { status: 400 }
      );
    }
    
    if (slideshow_interval && (typeof slideshow_interval !== 'number' || slideshow_interval < 1000 || slideshow_interval > 20000)) {
      return NextResponse.json(
        { error: 'The slideshow interval must be between 1000 and 20000 ms' },
        { status: 400 }
      );
    }
    
    if (logo_type && !['url', 'file'].includes(logo_type)) {
      return NextResponse.json(
        { error: 'The logo type must be url or file' },
        { status: 400 }
      );
    }

    if (encryption_key_source && !['manual', 'transfer_name', 'email', 'password', 'timestamp'].includes(encryption_key_source)) {
      return NextResponse.json(
        { error: 'The encryption key source is not valid' },
        { status: 400 }
      );
    }
    
    // Update only the provided fields
    const currentSettings = getAppSettings.get() as AppSettings;
    
    const updatedSettings = {
      app_name: app_name !== undefined ? app_name : currentSettings.app_name,
      logo_url: logo_url !== undefined ? logo_url : currentSettings.logo_url,
      logo_url_dark: logo_url_dark !== undefined ? logo_url_dark : currentSettings.logo_url_dark,
      logo_url_light: logo_url_light !== undefined ? logo_url_light : currentSettings.logo_url_light,
      logo_type: logo_type !== undefined ? logo_type : currentSettings.logo_type,
      theme: theme !== undefined ? theme : currentSettings.theme,
      language: language !== undefined ? language : currentSettings.language,
      slideshow_interval: slideshow_interval !== undefined ? slideshow_interval : currentSettings.slideshow_interval,
      slideshow_effect: slideshow_effect !== undefined ? slideshow_effect : currentSettings.slideshow_effect,
      encryption_enabled: encryption_enabled !== undefined ? (encryption_enabled ? 1 : 0) : currentSettings.encryption_enabled,
      encryption_key_source: encryption_key_source !== undefined ? encryption_key_source : currentSettings.encryption_key_source,
      encryption_manual_key: encryption_manual_key !== undefined ? encryption_manual_key : currentSettings.encryption_manual_key
    };
    
    updateAppSettings.run(
      updatedSettings.app_name,
      updatedSettings.logo_url,
      updatedSettings.logo_url_dark,
      updatedSettings.logo_url_light,
      updatedSettings.logo_type,
      updatedSettings.theme,
      updatedSettings.language,
      updatedSettings.slideshow_interval,
      updatedSettings.slideshow_effect,
      updatedSettings.encryption_enabled,
      updatedSettings.encryption_key_source,
      updatedSettings.encryption_manual_key
    );
    
    // Convert the values for the response
    return NextResponse.json({
      id: 1,
      ...updatedSettings,
      encryption_enabled: !!updatedSettings.encryption_enabled
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Could not update settings' },
      { status: 500 }
    );
  }
} 