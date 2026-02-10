
import React, { useState, useRef } from 'react';

interface ComparisonSliderProps {
  originalUrl: string;
  editedUrl: string;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ 
  originalUrl, 
  editedUrl,
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

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full cursor-col-resize select-none group"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {/* Base Layer: Original Image */}
      <img 
        src={originalUrl} 
        alt="Original" 
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />
      
      {/* Top Layer: Edited Image with Wipe Clip */}
      <div 
        className="absolute inset-0 overflow-hidden pointer-events-none z-10"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img 
          src={editedUrl} 
          alt="Edited" 
          className="absolute inset-0 w-full h-full object-contain"
        />
      </div>

      {/* Swipe Divider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-[2px] bg-white/60 shadow-[0_0_20px_rgba(255,255,255,0.8)] pointer-events-none z-20"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-indigo-600">
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
  );
};

export default ComparisonSlider;
