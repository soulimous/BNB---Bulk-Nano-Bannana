
import React, { useState, useRef } from 'react';

interface ComparisonSliderProps {
  originalUrl: string;
  editedUrl: string;
  originalWidth: number;
  originalHeight: number;
  editedWidth: number;
  editedHeight: number;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ 
  originalUrl, 
  editedUrl,
  originalWidth,
  originalHeight,
  editedWidth,
  editedHeight
}) => {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const offset = ((x - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, offset)));
  };

  // Calculate centered position for edited image if dimensions differ
  const offsetX = (originalWidth - editedWidth) / 2;
  const offsetY = (originalHeight - editedHeight) / 2;
  
  // Calculate percentage-based style for centering
  const leftPercent = (offsetX / originalWidth) * 100;
  const topPercent = (offsetY / originalHeight) * 100;
  const widthPercent = (editedWidth / originalWidth) * 100;
  const heightPercent = (editedHeight / originalHeight) * 100;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[60vh] md:h-[70vh] cursor-col-resize select-none overflow-hidden bg-neutral-900 rounded-lg group"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {/* Container aspect ratio defined by original image */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="relative w-full h-full"
          style={{ aspectRatio: `${originalWidth}/${originalHeight}` }}
        >
          {/* Base: Original */}
          <img 
            src={originalUrl} 
            alt="Original" 
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          />
          
          {/* Overlay: Edited (Clipped) */}
          <div 
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
             <div className="relative w-full h-full">
                {/* 
                  The edited image is placed in the exact coordinate frame 
                  of the original to prevent the "jump". 
                */}
                <img 
                  src={editedUrl} 
                  alt="Edited" 
                  className="absolute object-contain"
                  style={{
                    left: `${leftPercent}%`,
                    top: `${topPercent}%`,
                    width: `${widthPercent}%`,
                    height: `${heightPercent}%`
                  }}
                />
             </div>
          </div>

          {/* Slider Line */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl pointer-events-none z-10"
            style={{ left: `${position}%` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-indigo-500">
              <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zM4 10a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-bold uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity z-20">
        Original
      </div>
      <div className="absolute top-4 right-4 px-3 py-1 bg-indigo-600/50 backdrop-blur-md rounded text-[10px] font-bold uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity z-20">
        Edited
      </div>
    </div>
  );
};

export default ComparisonSlider;
