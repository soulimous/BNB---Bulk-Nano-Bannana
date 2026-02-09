
import React, { useState, useRef, useEffect } from 'react';

interface ComparisonSliderProps {
  originalUrl: string;
  editedUrl: string;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ originalUrl, editedUrl }) => {
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
      className="relative w-full h-[60vh] md:h-[70vh] cursor-col-resize select-none overflow-hidden bg-neutral-800 rounded-lg group"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {/* Background: Original */}
      <img 
        src={originalUrl} 
        alt="Original" 
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />
      
      {/* Foreground: Edited with clip */}
      <div 
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img 
          src={editedUrl} 
          alt="Edited" 
          className="w-full h-full object-contain"
        />
      </div>

      {/* Slider Line */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white shadow-xl pointer-events-none transition-opacity duration-300"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-indigo-500">
          <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zM4 10a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded text-xs font-bold uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity">
        Original
      </div>
      <div className="absolute top-4 right-4 px-3 py-1 bg-indigo-600/50 backdrop-blur-md rounded text-xs font-bold uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity">
        Edited
      </div>
    </div>
  );
};

export default ComparisonSlider;
