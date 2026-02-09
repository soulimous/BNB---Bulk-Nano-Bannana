
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ImageItem, 
  GeminiModel, 
  Resolution, 
  ProcessingStatus 
} from './types';
import { generateId, getImageMetadata } from './utils/helpers';
import { processImageEdit } from './services/geminiService';
import ImageCard from './components/ImageCard';
import ComparisonSlider from './components/ComparisonSlider';
import DiffOverlay from './components/DiffOverlay';

// UI Icons
const IconPlus = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const IconPlay = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>;
const IconChevronLeft = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>;
const IconChevronRight = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const IconX = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const IconSave = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>;
const IconSparkles = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.143-7.714L1 12l6.857-2.143L11 3z" /></svg>;

const PRESET_PROMPTS_KEY = 'visonary_presets';

export default function App() {
  // State
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(GeminiModel.FLASH);
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [prompt, setPrompt] = useState('');
  const [presets, setPresets] = useState<string[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  
  // Single image refinement state
  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');

  // Difference view state
  const [showDiff, setShowDiff] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load presets
  useEffect(() => {
    const saved = localStorage.getItem(PRESET_PROMPTS_KEY);
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        setPresets(['Apply a vibrant cinematic look', 'Convert to monochrome sketch', 'Remove the background']);
      }
    } else {
      setPresets(['Apply a vibrant cinematic look', 'Convert to monochrome sketch', 'Remove the background']);
    }
  }, []);

  // Keyboard navigation for preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPreviewIndex === null) return;
      if (e.key === 'ArrowLeft') {
        setSelectedPreviewIndex(prev => (prev! > 0 ? prev! - 1 : images.length - 1));
        setIsRefining(false);
        setShowDiff(false);
      } else if (e.key === 'ArrowRight') {
        setSelectedPreviewIndex(prev => (prev! < images.length - 1 ? prev! + 1 : 0));
        setIsRefining(false);
        setShowDiff(false);
      } else if (e.key === 'Escape') {
        setSelectedPreviewIndex(null);
        setIsRefining(false);
        setShowDiff(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPreviewIndex, images.length]);

  const savePreset = () => {
    if (!prompt || presets.includes(prompt)) return;
    const newPresets = [prompt, ...presets];
    setPresets(newPresets);
    localStorage.setItem(PRESET_PROMPTS_KEY, JSON.stringify(newPresets));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    
    const newImages: ImageItem[] = await Promise.all(
      newFiles.map(async (file) => {
        const metadata = await getImageMetadata(file);
        return {
          id: generateId(),
          originalFile: file,
          originalUrl: URL.createObjectURL(file),
          originalMetadata: metadata,
          status: 'idle'
        };
      })
    );

    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processSingleImage = async (imageId: string, customPrompt: string) => {
    const img = images.find(i => i.id === imageId);
    if (!img) return;

    if (selectedModel === GeminiModel.PRO) {
      const hasKey = await (window as any).aistudio?.hasSelectedApiKey?.();
      if (!hasKey) {
        await (window as any).aistudio?.openSelectKey?.();
      }
    }

    setImages(prev => prev.map(i => i.id === imageId ? { ...i, status: 'processing' } : i));

    try {
      const result = await processImageEdit(
        img.originalFile, 
        customPrompt, 
        selectedModel, 
        resolution
      );

      setImages(prev => prev.map(i => i.id === imageId ? { 
        ...i, 
        status: 'done', 
        editedUrl: result.imageUrl,
        editedMetadata: {
          name: `${img.originalMetadata.name} (edited)`,
          dimensions: `${result.width} x ${result.height}`,
          size: `${(result.size / 1024).toFixed(2)} KB`,
          width: result.width,
          height: result.height
        }
      } : i));
      setIsRefining(false);
    } catch (err: any) {
      console.error(err);
      setImages(prev => prev.map(i => i.id === imageId ? { 
        ...i, 
        status: 'error', 
        errorMessage: err.message || 'Processing failed'
      } : i));
    }
  };

  const runPrompt = async () => {
    if (!prompt) return;
    setIsProcessingAll(true);
    for (const img of images) {
      await processSingleImage(img.id, prompt);
    }
    setIsProcessingAll(false);
  };

  const currentPreview = selectedPreviewIndex !== null ? images[selectedPreviewIndex] : null;

  useEffect(() => {
    if (currentPreview && !isRefining) {
      setRefinePrompt(prompt);
    }
  }, [selectedPreviewIndex, prompt]);

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-[#0a0a0a] overflow-hidden">
      
      {/* Sidebar Controls */}
      <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-neutral-800 bg-neutral-900/50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-500 bg-clip-text text-transparent">Studio</h1>
        </div>

        {/* Model Selection */}
        <section className="space-y-3">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">AI Intelligence</label>
          <div className="space-y-2">
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
            >
              <option value={GeminiModel.FLASH}>Gemini 2.5 Flash (Fast)</option>
              <option value={GeminiModel.PRO}>Gemini 3 Pro (HQ)</option>
            </select>
            
            {selectedModel === GeminiModel.PRO && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-4 block">Resolution</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(['1K', '2K', '4K'] as Resolution[]).map((res) => (
                    <button
                      key={res}
                      onClick={() => setResolution(res)}
                      className={`py-1.5 text-xs font-bold rounded-md border transition-all ${
                        resolution === res 
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_12px_rgba(79,70,229,0.3)]' 
                        : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Prompt Input */}
        <section className="space-y-3 flex-1 flex flex-col">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Global Prompt</label>
            <button 
              onClick={savePreset}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase transition-colors flex items-center gap-1"
            >
              <IconSave /> Save
            </button>
          </div>
          
          <div className="relative flex-1">
             <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the edits for ALL images..."
              className="w-full h-32 lg:h-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all placeholder:text-neutral-600"
            />
          </div>

          <div className="space-y-2 mt-4">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Presets</label>
            <select 
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer"
            >
              <option value="">Select a preset...</option>
              {presets.map((p, i) => (
                <option key={i} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="pt-4 space-y-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 px-4 rounded-xl transition-all border border-neutral-700"
          >
            <IconPlus /> Upload Images
          </button>
          
          <button 
            onClick={runPrompt}
            disabled={isProcessingAll || images.length === 0 || !prompt}
            className={`w-full flex items-center justify-center gap-2 font-bold py-4 px-4 rounded-xl transition-all shadow-lg ${
              isProcessingAll || images.length === 0 || !prompt
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/30'
            }`}
          >
            {isProcessingAll ? (
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : <IconPlay />}
            Process All Images
          </button>
        </div>
      </aside>

      {/* Main Content Area (Grid) */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-black/30">
        {images.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50 grayscale">
            <div className="w-24 h-24 border-2 border-dashed border-neutral-700 rounded-2xl flex items-center justify-center mb-4">
              <IconPlus />
            </div>
            <h2 className="text-xl font-medium text-neutral-400">No images uploaded</h2>
            <p className="text-sm text-neutral-600 mt-2">Upload images from the sidebar to start editing</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {images.map((img, idx) => (
              <ImageCard 
                key={img.id} 
                image={img} 
                onClick={() => setSelectedPreviewIndex(idx)} 
              />
            ))}
          </div>
        )}
      </main>

      {/* Full Page Preview Modal */}
      {selectedPreviewIndex !== null && currentPreview && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col">
          {/* Header */}
          <header className="p-4 grid grid-cols-1 md:grid-cols-3 items-center border-b border-white/5 bg-black/40">
            {/* Left Column: Image Name & Exit */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  setSelectedPreviewIndex(null);
                  setIsRefining(false);
                  setShowDiff(false);
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0"
              >
                <IconX />
              </button>
              <div className="truncate">
                <h3 className="text-sm font-bold truncate">{currentPreview.originalMetadata.name}</h3>
                <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">
                  {showDiff ? 'Change Analysis Mode' : 'Full View'}
                </p>
              </div>
            </div>
            
            {/* Center Column: Metadata Dashboard */}
            <div className="hidden md:flex items-center justify-center gap-8">
               <div className="text-center group">
                  <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-tighter mb-1">Original Info</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold">{currentPreview.originalMetadata.dimensions}</span>
                    <span className="text-[10px] text-neutral-400">{currentPreview.originalMetadata.size}</span>
                  </div>
               </div>
               
               {currentPreview.editedMetadata && (
                  <>
                    <div className="text-neutral-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    </div>
                    <div className="text-center group">
                      <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter mb-1">Edited Info</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-indigo-200">{currentPreview.editedMetadata.dimensions}</span>
                        <span className="text-[10px] text-indigo-400">{currentPreview.editedMetadata.size}</span>
                      </div>
                    </div>
                  </>
               )}
            </div>

            {/* Right Column: Refinement Toggle */}
            <div className="flex justify-end pr-2 gap-2">
               <button 
                  onClick={() => setIsRefining(!isRefining)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                    isRefining 
                      ? 'bg-indigo-600 border-indigo-500 text-white' 
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500'
                  }`}
               >
                  <IconSparkles />
                  Refine
               </button>
            </div>
          </header>

          {/* Main Stage */}
          <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
            
            {/* Image Viewport */}
            <div 
              className="flex-1 relative flex items-center justify-center p-4 cursor-crosshair select-none"
              onClick={(e) => {
                // Toggle diff view only if we have an edited version
                if (currentPreview.editedUrl) {
                  setShowDiff(!showDiff);
                }
              }}
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPreviewIndex(prev => (prev! > 0 ? prev! - 1 : images.length - 1));
                  setIsRefining(false);
                  setShowDiff(false);
                }}
                className="absolute left-4 z-40 p-3 bg-black/50 hover:bg-white/10 border border-white/10 rounded-full backdrop-blur-md transition-all"
              >
                <IconChevronLeft />
              </button>
              
              <div className="max-w-6xl w-full h-full flex items-center justify-center relative">
                {currentPreview.editedUrl ? (
                  <>
                    <ComparisonSlider 
                      originalUrl={currentPreview.originalUrl} 
                      editedUrl={currentPreview.editedUrl} 
                    />
                    {showDiff && currentPreview.editedMetadata && (
                      <DiffOverlay 
                        originalUrl={currentPreview.originalUrl}
                        editedUrl={currentPreview.editedUrl}
                        originalMeta={currentPreview.originalMetadata}
                        editedMeta={currentPreview.editedMetadata}
                      />
                    )}
                  </>
                ) : (
                  <div className="relative h-full w-full rounded-xl overflow-hidden bg-neutral-900/50 flex flex-col items-center justify-center p-4">
                    <img 
                      src={currentPreview.originalUrl} 
                      className="max-h-full max-w-full object-contain shadow-2xl rounded-lg border border-white/5"
                    />
                    {currentPreview.status === 'processing' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-indigo-300 font-bold tracking-widest text-[10px] uppercase">Processing Model Result...</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Visual Hint for Click-to-Diff */}
                {currentPreview.editedUrl && !showDiff && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[9px] font-bold text-neutral-400 uppercase tracking-widest pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    Left-click to visualize changes
                  </div>
                )}
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPreviewIndex(prev => (prev! < images.length - 1 ? prev! + 1 : 0));
                  setIsRefining(false);
                  setShowDiff(false);
                }}
                className="absolute right-4 z-40 p-3 bg-black/50 hover:bg-white/10 border border-white/10 rounded-full backdrop-blur-md transition-all"
              >
                <IconChevronRight />
              </button>
            </div>

            {/* Inline Refinement Panel (Right Side, slide in) */}
            {isRefining && (
              <div className="w-full md:w-80 bg-neutral-900 border-l border-white/10 p-6 flex flex-col gap-6 animate-in slide-in-from-right duration-300 z-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <IconSparkles /> 
                    Specific Refinement
                  </h4>
                  <button onClick={() => setIsRefining(false)} className="text-neutral-500 hover:text-white">
                    <IconX />
                  </button>
                </div>
                
                <div className="space-y-4 flex-1">
                  <p className="text-[11px] text-neutral-500 italic">Modify the prompt just for this image. Changes here won't affect the others.</p>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-neutral-600 uppercase">Local Prompt Override</label>
                    <textarea 
                      value={refinePrompt}
                      onChange={(e) => setRefinePrompt(e.target.value)}
                      className="w-full h-40 bg-black border border-neutral-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all placeholder:text-neutral-800"
                      placeholder="Enter specific instructions..."
                    />
                  </div>

                  <button 
                    onClick={() => processSingleImage(currentPreview.id, refinePrompt)}
                    disabled={currentPreview.status === 'processing' || !refinePrompt}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {currentPreview.status === 'processing' ? (
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : <IconPlay />}
                    Update This Image
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Filmstrip Footer */}
          <footer className="h-28 bg-black/80 border-t border-white/5 p-4 flex items-center gap-4 overflow-x-auto no-scrollbar scroll-smooth">
            {images.map((img, idx) => (
              <button 
                key={img.id}
                onClick={() => {
                  setSelectedPreviewIndex(idx);
                  setIsRefining(false);
                  setShowDiff(false);
                }}
                className={`h-20 aspect-square rounded-lg overflow-hidden border-2 transition-all shrink-0 relative group ${
                  selectedPreviewIndex === idx ? 'border-indigo-500 scale-105 shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'border-transparent opacity-40 hover:opacity-100'
                }`}
              >
                <img 
                  src={img.originalUrl} 
                  className="w-full h-full object-cover"
                />
                {img.editedUrl && (
                  <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                )}
                {img.status === 'processing' && (
                  <div className="absolute inset-0 bg-indigo-900/40 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </footer>
        </div>
      )}
    </div>
  );
}
