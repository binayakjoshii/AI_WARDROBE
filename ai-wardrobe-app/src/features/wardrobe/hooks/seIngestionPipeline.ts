import { useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export interface ManualTags {
  category: string;
  colorName: string;
  subcategory: string;
}

export interface IngestionResult {
  success: boolean;
  originalImageUrl?: string;
  processedImageUrl?: string;
  tags?: ManualTags;
  error?: string;
}

export function useIngestionPipeline() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const processImage = async (
    localUri: string, 
    status: 'clean' | 'dirty', 
    manualTags: ManualTags
  ): Promise<IngestionResult> => {
    setIsProcessing(true);
    setStatusMessage('');

    // 🚨 THE SAFETY NET: If the UI glitches and drops tags, default to these safely.
    const safeTags = manualTags || { 
      category: 'tops', 
      colorName: 'Unknown', 
      subcategory: 'Item' 
    };

    try {
      setStatusMessage('Uploading garment to cloud storage...');

      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `raw_uploads/${fileName}`;

      const fetchResponse = await fetch(localUri);
      const imageBuffer = await fetchResponse.arrayBuffer(); 

      const { error: storageError } = await supabase.storage
        .from('wardrobe')
        .upload(filePath, imageBuffer, { 
          contentType: 'image/jpeg', 
          upsert: true,
        });

      if (storageError) throw new Error(`Storage upload failed: ${storageError.message}`);

      const { data: { publicUrl } } = supabase.storage.from('wardrobe').getPublicUrl(filePath);

      setStatusMessage('Processing image layout...');
      
      const backendUrl = `${process.env.EXPO_PUBLIC_API_URL}/api/ingest`;

      const backendResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: publicUrl,
          status: status 
        }),
      });

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        throw new Error(`Python Server Error: ${errorText}`);
      }

      const pipelineResult = await backendResponse.json();

      if (!pipelineResult.success) {
        throw new Error('Image processing pipeline failure.');
      }

      setStatusMessage('Saving authenticated garment details...');
      
      const { error: dbError } = await supabase
        .from('clothing_items')
        .insert([
          {
            original_image_url: publicUrl,
            processed_image_url: pipelineResult.processedImageUrl,
            wear_status: status,
            
            // 🚨 Use safeTags to mathematically prevent 'undefined' crashes
            category: safeTags.category.toLowerCase().trim(),
            subcategory: safeTags.subcategory.trim(),
            color_name: safeTags.colorName.trim(),
            
            color_hex: '#808080',
            pattern: 'Standard',
            material: 'Standard Fabric',
            style_vibes: ['Everyday Core'],
            seasonality: ['All-Season'],
            warmth_index: 2, 
          }
        ]);

      if (dbError) throw new Error(`Database registration failed: ${dbError.message}`);

      setIsProcessing(false);
      setStatusMessage('');
      
      return {
        success: true,
        originalImageUrl: publicUrl,
        processedImageUrl: pipelineResult.processedImageUrl,
        tags: safeTags 
      };

    } catch (error: any) {
      console.error('Pipeline process failure:', error);
      setIsProcessing(false);
      setStatusMessage('');
      return {
        success: false,
        error: error.message || 'An unexpected processing event occurred.'
      };
    }
  };

  return {
    processImage,
    isProcessing,
    statusMessage,
  };
}