
import React, { useEffect, useRef, useState } from 'react';
import { ImageMetadata, AnalysisViewMode } from '../types';

interface DiffOverlayProps {
  originalUrl: string;
  editedUrl: string;
  originalMeta: ImageMetadata;
  editedMeta: ImageMetadata;
  mode: AnalysisViewMode;
}

const INTENSITY_COLORS = [
  'rgba(219, 234, 254, 0.4)', // Step 1: Pale
  'rgba(147, 197, 253, 0.5)', // Step 2
  'rgba(59, 130, 246, 0.6)',  // Step 3
  'rgba(29, 78, 216, 0.7)',   // Step 4
  'rgba(30, 58, 138, 0.8)',   // Step 5: Dark
];

const DiffOverlay: React.FC<DiffOverlayProps> = ({ originalUrl, editedUrl, originalMeta, editedMeta, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (mode === 'none') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img1 = new Image();
    const img2 = new Image();
    let loadedCount = 0;

    const onImageLoad = () => {
      loadedCount++;
      if (loadedCount === 2) renderAnalysis();
    };

    img1.onload = onImageLoad;
    img2.onload = onImageLoad;
    img1.src = originalUrl;
    img2.src = editedUrl;

    const renderAnalysis = () => {
      const w = originalMeta.width;
      const h = originalMeta.height;
      canvas.width = w;
      canvas.height = h;

      // Draw original as background reference
      ctx.globalAlpha = 0.2;
      ctx.drawImage(img1, 0, 0, w, h);
      ctx.globalAlpha = 1.0;

      // Calculate centering for edited image
      const offsetX = (w - editedMeta.width) / 2;
      const offsetY = (h - editedMeta.height) / 2;

      // Pixel data extraction
      const offC1 = document.createElement('canvas');
      const offC2 = document.createElement('canvas');
      offC1.width = w; offC1.height = h;
      offC2.width = w; offC2.height = h;
      const oCtx1 = offC1.getContext('2d')!;
      const oCtx2 = offC2.getContext('2d')!;
      
      oCtx1.drawImage(img1, 0, 0, w, h);
      oCtx2.drawImage(img2, offsetX, offsetY, editedMeta.width, editedMeta.height);
      
      const data1 = oCtx1.getImageData(0, 0, w, h).data;
      const data2 = oCtx2.getImageData(0, 0, w, h).data;

      // First pass: Handle purple areas (missing in edit)
      ctx.fillStyle = 'rgba(168, 85, 247, 0.4)'; // Purple-500
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.rect(offsetX, offsetY, editedMeta.width, editedMeta.height);
      ctx.fill('evenodd');

      if (mode === 'intensity') {
        const blockSize = 16;
        for (let y = 0; y < h; y += blockSize) {
          for (let x = 0; x < w; x += blockSize) {
            // Only process blocks inside the edited area
            if (x < offsetX || x >= offsetX + editedMeta.width || y < offsetY || y >= offsetY + editedMeta.height) continue;

            let maxDiff = 0;
            for (let by = 0; by < blockSize && y + by < h; by++) {
              for (let bx = 0; bx < blockSize && x + bx < w; bx++) {
                const idx = ((y + by) * w + (x + bx)) * 4;
                const diff = (Math.abs(data1[idx] - data2[idx]) + 
                             Math.abs(data1[idx+1] - data2[idx+1]) + 
                             Math.abs(data1[idx+2] - data2[idx+2])) / 3;
                if (diff > maxDiff) maxDiff = diff;
              }
            }

            if (maxDiff > 10) {
              // Map maxDiff (0-255) to 5 levels
              const level = Math.min(4, Math.floor((maxDiff / 100) * 5));
              ctx.fillStyle = INTENSITY_COLORS[level];
              ctx.fillRect(x, y, blockSize, blockSize);
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.strokeRect(x, y, blockSize, blockSize);
            }
          }
        }
      } else if (mode === 'differential') {
        const output = ctx.createImageData(w, h);
        for (let i = 0; i < data1.length; i += 4) {
          // Check if pixel is in edited zone
          const px = (i / 4) % w;
          const py = Math.floor((i / 4) / w);
          const inBounds = px >= offsetX && px < offsetX + editedMeta.width && py >= offsetY && py < offsetY + editedMeta.height;

          if (inBounds) {
            output.data[i] = Math.abs(data1[i] - data2[i]);
            output.data[i+1] = Math.abs(data1[i+1] - data2[i+1]);
            output.data[i+2] = Math.abs(data1[i+2] - data2[i+2]);
            output.data[i+3] = 255;
          } else {
            // Keep purple overlay visible by making diff transparent here
            output.data[i+3] = 0;
          }
        }
        ctx.putImageData(output, 0, 0);
      }

      setIsLoaded(true);
    };
  }, [originalUrl, editedUrl, mode, originalMeta, editedMeta]);

  if (mode === 'none') return null;

  return (
    <div className="absolute inset-0 z-40 pointer-events-none bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-300">
      <div className="relative w-full h-full flex items-center justify-center p-8">
        <canvas 
          ref={canvasRef} 
          className="max-w-full max-h-full object-contain shadow-2xl rounded-lg border border-white/10"
        />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
             <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Legend */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-black/80 rounded-full border border-white/10 text-[9px] font-bold uppercase tracking-widest text-neutral-300 shadow-xl pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
            <span>Missing (Crop)</span>
          </div>
          {mode === 'intensity' && (
            <div className="flex items-center gap-1 ml-4">
              <span>Low</span>
              <div className="flex gap-1">
                {INTENSITY_COLORS.map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }}></div>
                ))}
              </div>
              <span>High Intensity</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiffOverlay;
