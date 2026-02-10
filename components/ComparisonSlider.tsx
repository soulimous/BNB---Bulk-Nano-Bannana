
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

  const originalAspectRatio = originalWidth / originalHeight;
  const editedAspectRatio = editedWidth / editedHeight;

  // We ensure the edited image aligns with the original's coordinate system
  let editedStyle: React.CSSProperties = { width: '100%', height: '100%', top: 0, left: 0 };
  
  if (Math.abs(originalAspectRatio - editedAspectRatio) > 0.01) {
    const scale = Math.min(originalWidth / editedWidth, originalHeight / editedHeight);
    const displayWidth = editedWidth * scale;
    const displayHeight = editedHeight * scale;
    
    const left = ((originalWidth - displayWidth) / 2 / originalWidth) * 100;
    const top = ((originalHeight - displayHeight) / 2 / originalHeight) * 100;
    const width = (displayWidth / originalWidth) * 100;
    const height = (displayHeight / originalHeight) * 100;

    editedStyle = {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
    };
  }

  return (
    <div className="w-full h-full grid place-items-center p-4 md:p-8">
      <div 
        ref={containerRef}
        className="relative shadow-2xl bg-neutral-900 border border-white/10 cursor-col-resize select-none group rounded-2xl overflow-hidden"
        style={{ 
          aspectRatio: `${originalWidth} / ${originalHeight}`,
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto',
        }}
        onMouseMove={handleMove}
        onTouchMove={handleMove}
      >
        {/* Base Layer: Original Image (Always maintains aspect ratio) */}
        <img 
          src={originalUrl} 
          alt="Original" 
          className="absolute inset-0 w-full h-full pointer-events-none object-contain"
        />
        
        {/* Top Layer: Edited Image with Wipe Clip */}
        <div 
          className="absolute inset-0 overflow-hidden pointer-events-none z-10"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img 
            src={editedUrl} 
            alt="Edited" 
            className="absolute object-contain"
            style={editedStyle}
          />
        </div>

        {/* Swipe Divider Handle */}
        <div 
          className="absolute top-0 bottom-0 w-[2px] bg-white/60 shadow-[0_0_20px_rgba(255,255,255,0.8)] pointer-events-none z-20"
          style={{ left: `${position}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-indigo-600 transition-transform hover:scale-110">
             <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7h8m-4 10V7" />
             </svg>
          </div>
        </div>

        {/* Floating Labels */}
        <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold uppercase tracking-widest text-white z-30 opacity-0 group-hover:opacity-100 transition-opacity">
          Original
        </div>
        <div className="absolute top-4 right-4 px-3 py-1 bg-indigo-600/60 backdrop-blur-md rounded-lg text-[10px] font-bold uppercase tracking-widest text-white z-30 opacity-0 group-hover:opacity-100 transition-opacity">
          AI Edit
        </div>
      </div>
    </div>
  );
};

export default ComparisonSlider;
