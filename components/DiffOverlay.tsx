
import React, { useEffect, useRef, useState } from 'react';
import { ImageMetadata } from '../types';

interface DiffOverlayProps {
  originalUrl: string;
  editedUrl: string;
  originalMeta: ImageMetadata;
  editedMeta: ImageMetadata;
}

const DiffOverlay: React.FC<DiffOverlayProps> = ({ originalUrl, editedUrl, originalMeta, editedMeta }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img1 = new Image();
    const img2 = new Image();
    let loadedCount = 0;

    const onImageLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        processDiff();
      }
    };

    img1.onload = onImageLoad;
    img2.onload = onImageLoad;
    img1.src = originalUrl;
    img2.src = editedUrl;

    const processDiff = () => {
      const scale = 0.1; // Process at 10% resolution for performance
      const w = Math.floor(originalMeta.width * scale);
      const h = Math.floor(originalMeta.height * scale);
      
      canvas.width = originalMeta.width;
      canvas.height = originalMeta.height;

      // Draw original first with low opacity
      ctx.globalAlpha = 0.4;
      ctx.drawImage(img1, 0, 0, originalMeta.width, originalMeta.height);
      ctx.globalAlpha = 1.0;

      // Detect Crop
      const isCropped = originalMeta.width > editedMeta.width || originalMeta.height > editedMeta.height;
      if (isCropped) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'; // Red-500 with opacity
        // Assuming centered crop for visualization
        const startX = (originalMeta.width - editedMeta.width) / 2;
        const startY = (originalMeta.height - editedMeta.height) / 2;
        
        // Top rect
        ctx.fillRect(0, 0, originalMeta.width, startY);
        // Bottom rect
        ctx.fillRect(0, originalMeta.height - startY, originalMeta.width, startY);
        // Left rect
        ctx.fillRect(0, startY, startX, editedMeta.height);
        // Right rect
        ctx.fillRect(originalMeta.width - startX, startY, startX, editedMeta.height);
        
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.strokeRect(startX, startY, editedMeta.width, editedMeta.height);
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 24px Inter';
        ctx.fillText('CROP AREA DETECTED', startX + 10, startY + 30);
      }

      // Pixel Diffing for changed areas
      const offCanvas1 = document.createElement('canvas');
      const offCanvas2 = document.createElement('canvas');
      offCanvas1.width = w; offCanvas1.height = h;
      offCanvas2.width = w; offCanvas2.height = h;
      const offCtx1 = offCanvas1.getContext('2d');
      const offCtx2 = offCanvas2.getContext('2d');

      if (offCtx1 && offCtx2) {
        offCtx1.drawImage(img1, 0, 0, w, h);
        offCtx2.drawImage(img2, 0, 0, w, h);
        const data1 = offCtx1.getImageData(0, 0, w, h).data;
        const data2 = offCtx2.getImageData(0, 0, w, h).data;

        const threshold = 30;
        const blockSize = 8;
        
        ctx.strokeStyle = '#6366f1'; // Indigo-500
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        for (let y = 0; y < h; y += blockSize) {
          for (let x = 0; x < w; x += blockSize) {
            let hasDiff = false;
            // Check block for any significant pixel change
            for (let by = 0; by < blockSize && y + by < h; by++) {
              for (let bx = 0; bx < blockSize && x + bx < w; bx++) {
                const idx = ((y + by) * w + (x + bx)) * 4;
                const rDiff = Math.abs(data1[idx] - data2[idx]);
                const gDiff = Math.abs(data1[idx+1] - data2[idx+1]);
                const bDiff = Math.abs(data1[idx+2] - data2[idx+2]);
                if (rDiff + gDiff + bDiff > threshold) {
                  hasDiff = true;
                  break;
                }
              }
              if (hasDiff) break;
            }

            if (hasDiff) {
              const rectX = (x / scale);
              const rectY = (y / scale);
              const rectW = (blockSize / scale);
              const rectH = (blockSize / scale);
              
              ctx.strokeRect(rectX, rectY, rectW, rectH);
              ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
              ctx.fillRect(rectX, rectY, rectW, rectH);
            }
          }
        }
      }
      setIsLoaded(true);
    };
  }, [originalUrl, editedUrl, originalMeta, editedMeta]);

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <canvas 
          ref={canvasRef} 
          className="max-w-full max-h-full object-contain shadow-[0_0_50px_rgba(99,102,241,0.2)] rounded-lg border-2 border-indigo-500/50"
        />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Analyzing Pixels...</span>
            </div>
          </div>
        )}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-indigo-600 rounded-full text-[10px] font-bold text-white uppercase tracking-widest shadow-xl flex items-center gap-2">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 011.512-.306c.736.06 1.39.321 1.964.776.391.31.69.699.935 1.141.248.446.423.976.57 1.56.299 1.203.317 2.717-.175 4.093-.233.651-.596 1.274-1.14 1.773-.541.497-1.227.819-1.996.911a6.94 6.94 0 01-1.303.042 15.49 15.49 0 01-1.612-.255 22.33 22.33 0 01-3.618-1.07 1 1 0 11.645-1.89c1.018.347 2.188.67 3.3.874a13.185 13.185 0 001.254.153c.356.02.653-.022.81-.04.4-.046.705-.209.922-.408.226-.206.444-.51.6-.95.347-.97.352-2.143.121-3.074-.085-.342-.19-.63-.33-.883a2.4 2.4 0 00-.63-.705c-.366-.29-.806-.45-1.289-.49a1.054 1.054 0 00-.609.123c-.347.193-.72.514-1.05.956-.329.44-.658 1.019-.947 1.734-.579 1.43-.933 3.073-1.17 4.63-.012.078-.024.155-.034.232a1 1 0 01-1.98-.256 32.34 32.34 0 01.67-3.935c.242-.962.54-1.932.893-2.813.361-.9.789-1.782 1.352-2.52.56-.733 1.245-1.333 2.162-1.606a1 1 0 00.701-1.241c-.165-.727-.35-1.356-.539-1.812-.19-.455-.38-.696-.499-.777a1 1 0 01-.213-1.392z" clipRule="evenodd" /></svg>
          Change Analysis View
        </div>
      </div>
    </div>
  );
};

export default DiffOverlay;
