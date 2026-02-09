
import { ImageMetadata } from "../types";

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getImageMetadata = (file: File): Promise<ImageMetadata> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        name: file.name,
        size: formatFileSize(file.size),
        dimensions: `${img.width} x ${img.height}`,
        width: img.width,
        height: img.height
      });
    };
    img.src = URL.createObjectURL(file);
  });
};

export const generateId = () => Math.random().toString(36).substr(2, 9);
