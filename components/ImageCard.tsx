
import React, { useState } from 'react';
import { ImageItem } from '../types';

interface ImageCardProps {
  image: ImageItem;
  onClick: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  const displayUrl = (isHovered && image.editedUrl) ? image.editedUrl : image.originalUrl;
  const metadata = (isHovered && image.editedMetadata) ? image.editedMetadata : image.originalMetadata;
  const isEdited = !!image.editedUrl;

  return (
    <div 
      className="group relative bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 hover:border-indigo-500/50 transition-all duration-300 shadow-lg cursor-pointer flex flex-col h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="aspect-square w-full relative bg-neutral-950 overflow-hidden">
        <img 
          src={displayUrl} 
          alt={metadata.name}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        
        {/* Status Overlays */}
        {image.status === 'processing' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-medium text-indigo-200">Processing...</span>
            </div>
          </div>
        )}

        {image.status === 'error' && (
          <div className="absolute inset-0 bg-red-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <span className="text-xs text-center text-white font-medium">{image.errorMessage || 'Failed to edit'}</span>
          </div>
        )}

        {/* Hover Label */}
        {isHovered && isEdited && (
           <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-indigo-600 rounded text-[10px] font-bold text-white uppercase tracking-tighter">
             Viewing Edited
           </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div className="mb-1">
          <h3 className="text-xs font-semibold text-neutral-200 truncate" title={metadata.name}>
            {metadata.name}
          </h3>
        </div>
        
        <div className="flex items-center justify-between mt-auto">
          <div className="flex flex-col gap-0.5">
             <span className="text-[10px] text-neutral-500 font-mono">{metadata.dimensions}</span>
             <span className="text-[10px] text-neutral-500 font-mono">{metadata.size}</span>
          </div>
          {isEdited && !isHovered && (
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
