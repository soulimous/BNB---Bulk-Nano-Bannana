
export type ProcessingStatus = 'idle' | 'processing' | 'done' | 'error';

export interface ImageMetadata {
  name: string;
  size: string;
  dimensions: string;
  width: number;
  height: number;
}

export interface ImageItem {
  id: string;
  originalFile: File;
  originalUrl: string;
  originalMetadata: ImageMetadata;
  editedUrl?: string;
  editedMetadata?: ImageMetadata;
  status: ProcessingStatus;
  errorMessage?: string;
}

export enum GeminiModel {
  FLASH = 'gemini-2.5-flash-image',
  PRO = 'gemini-3-pro-image-preview'
}

export type Resolution = '1K' | '2K' | '4K';

export type AnalysisViewMode = 'none' | 'intensity' | 'differential';
