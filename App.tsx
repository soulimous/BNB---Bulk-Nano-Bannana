
import React, { useState, useRef, useEffect } from 'react';
import { 
  ImageItem, 
  GeminiModel, 
  Resolution, 
  AnalysisViewMode 
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
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(GeminiModel.FLASH);
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [prompt, setPrompt] = useState('');
  const [presets, setPresets] = useState<string[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [analysisMode, setAnalysisMode] = useState<AnalysisViewMode>('none');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(PRESET_PROMPTS_KEY);
    if (saved) {
      try { setPresets(JSON.parse(saved)); } catch (e) { setPresets(['Cinematic lighting', 'Monochrome sketch', 'Remove background']); }
    } else {
      setPresets(['Cinematic lighting', 'Monochrome sketch', 'Remove background']);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPreviewIndex === null) return;
      if (e.key === 'ArrowLeft') {
        setSelectedPreviewIndex(prev => (prev! > 0 ? prev! - 1 : images.length - 1));
        setIsRefining(false);
        setAnalysisMode('none');
      } else if (e.key === 'ArrowRight') {
        setSelectedPreviewIndex(prev => (prev! < images.length - 1 ? prev! + 1 : 0));
        setIsRefining(false);
        setAnalysisMode('none');
      } else if (e.key === 'Escape') {
        setSelectedPreviewIndex(null);
        setIsRefining(false);
        setAnalysisMode('none');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPreviewIndex, images.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const newImages: ImageItem[] = await Promise.all(
      newFiles.map(async (file) => {
        const metadata = await getImageMetadata(file);
        return { id: generateId(), originalFile: file, originalUrl: URL.createObjectURL(file), originalMetadata: metadata, status: 'idle' };
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
      if (!hasKey) await (window as any).aistudio?.openSelectKey?.();
    }
    setImages(prev => prev.map(i => i.id === imageId ? { ...i, status: 'processing' } : i));
    try {
      const result = await processImageEdit(img.originalFile, customPrompt, selectedModel, resolution);
      setImages(prev => prev.map(i => i.id === imageId ? { 
        ...i, status: 'done', editedUrl: result.imageUrl,
        editedMetadata: {
          name: `${img.originalMetadata.name} (edited)`,
          dimensions: `${result.width} x ${result.height}`,
          size: `${(result.size / 1024).toFixed(2)} KB`,
          width: result.width, height: result.height
        }
      } : i));
      setIsRefining(false);
    } catch (err: any) {
      setImages(prev => prev.map(i => i.id === imageId ? { ...i, status: 'error', errorMessage: err.message } : i));
    }
  };

  const runPrompt = async () => {
    if (!prompt) return;
    setIsProcessingAll(true);
    for (const img of images) { await processSingleImage(img.id, prompt); }
    setIsProcessingAll(false);
  };

  const currentPreview = selectedPreviewIndex !== null ? images[selectedPreviewIndex] : null;

  return (
    <div className="relative h-screen w-full bg-[#0a0a0a] overflow-hidden">
      {/* Background layer: This gets blurred when a preview is open */}
      <div className={`flex flex-col lg:flex-row h-full w-full transition-all duration-500 ease-in-out ${selectedPreviewIndex !== null ? 'blur-2xl grayscale-[0.5] scale-95 opacity-50' : ''}`}>
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-neutral-800 bg-neutral-900/50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
               <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-500 bg-clip-text text-transparent">Studio</h1>
          </div>

          <section className="space-y-3">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">AI Intelligence</label>
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
            >
              <option value={GeminiModel.FLASH}>Gemini 2.5 Flash</option>
              <option value={GeminiModel.PRO}>Gemini 3 Pro</option>
            </select>
          </section>

          <section className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Global Prompt</label>
              <button onClick={() => { if(prompt) setPresets([prompt, ...presets]) }} className="text-[10px] text-indigo-400 font-bold flex items-center gap-1">
                <IconSave /> Save
              </button>
            </div>
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-32 lg:h-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-sm outline-none resize-none"
              placeholder="Instructions for all images..."
            />
          </section>

          <div className="pt-4 space-y-3">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="image/*" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 rounded-xl transition-all border border-neutral-700">
              <IconPlus /> Upload
            </button>
            <button onClick={runPrompt} disabled={isProcessingAll || images.length === 0 || !prompt} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50">
              {isProcessingAll ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <IconPlay />}
              Process Batch
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-black/30">
          {images.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
              <IconPlus />
              <h2 className="text-xl font-medium mt-4">Upload images to begin</h2>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {images.map((img, idx) => (
                <ImageCard key={img.id} image={img} onClick={() => setSelectedPreviewIndex(idx)} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modal layer: This remains sharp and sits on top */}
      {selectedPreviewIndex !== null && currentPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col animate-in fade-in zoom-in-95 duration-500">
          <div className="flex-1 flex flex-col m-4 md:m-10 bg-neutral-950 rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.9)]">
            <header className="p-5 grid grid-cols-1 md:grid-cols-3 items-center border-b border-white/5 bg-black/40">
              <div className="flex items-center gap-4">
                <button onClick={() => { setSelectedPreviewIndex(null); setAnalysisMode('none'); }} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                  <IconX />
                </button>
                <div className="truncate">
                  <h3 className="text-sm font-bold truncate text-white">{currentPreview.originalMetadata.name}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">{analysisMode !== 'none' ? 'Analyst Mode' : 'Wipe Comparison'}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center">
                <div className="flex p-1 bg-neutral-900 rounded-lg border border-white/10 mb-2">
                  <button 
                    onClick={() => setAnalysisMode('none')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${analysisMode === 'none' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}
                  >Wipe</button>
                  <button 
                    onClick={() => setAnalysisMode('intensity')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${analysisMode === 'intensity' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}
                  >Intensity</button>
                  <button 
                    onClick={() => setAnalysisMode('differential')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${analysisMode === 'differential' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}
                  >Diff Map</button>
                </div>
                
                {/* Header Metadata Displays */}
                <div className="flex items-center gap-6 text-[9px] uppercase tracking-tighter">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <span className="font-bold">Original:</span>
                      <span className="font-mono">{currentPreview.originalMetadata.dimensions} • {currentPreview.originalMetadata.size}</span>
                    </div>
                    {currentPreview.editedMetadata && (
                      <div className="flex items-center gap-2 text-indigo-400 font-bold border-l border-white/10 pl-6">
                        <span>Edited:</span>
                        <span className="font-mono">{currentPreview.editedMetadata.dimensions} • {currentPreview.editedMetadata.size}</span>
                      </div>
                    )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setIsRefining(!isRefining)} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${isRefining ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/20 shadow-lg' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}>
                    <IconSparkles /> Refine
                </button>
              </div>
            </header>

            <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden bg-neutral-950/30">
              <div className="flex-1 relative flex items-center justify-center p-6">
                <button 
                  onClick={() => { setSelectedPreviewIndex(prev => (prev! > 0 ? prev! - 1 : images.length - 1)); setAnalysisMode('none'); }}
                  className="absolute left-6 z-50 p-4 bg-black/60 hover:bg-indigo-600 border border-white/10 rounded-full transition-all shadow-2xl text-white"
                >
                  <IconChevronLeft />
                </button>
                
                <div className="max-w-7xl w-full h-full flex items-center justify-center relative">
                  {currentPreview.editedUrl ? (
                    <>
                      <div className={`w-full h-full ${analysisMode === 'none' ? 'block' : 'hidden'}`}>
                        <ComparisonSlider 
                          originalUrl={currentPreview.originalUrl} 
                          editedUrl={currentPreview.editedUrl}
                          originalWidth={currentPreview.originalMetadata.width}
                          originalHeight={currentPreview.originalMetadata.height}
                          editedWidth={currentPreview.editedMetadata!.width}
                          editedHeight={currentPreview.editedMetadata!.height}
                        />
                      </div>
                      {analysisMode !== 'none' && (
                        <DiffOverlay 
                          originalUrl={currentPreview.originalUrl}
                          editedUrl={currentPreview.editedUrl}
                          originalMeta={currentPreview.originalMetadata}
                          editedMeta={currentPreview.editedMetadata!}
                          mode={analysisMode}
                        />
                      )}
                    </>
                  ) : (
                    <div className="relative h-full w-full rounded-2xl overflow-hidden bg-neutral-900/50 flex flex-col items-center justify-center border border-white/5">
                      <img src={currentPreview.originalUrl} className="max-h-full max-w-full object-contain shadow-2xl" />
                      {currentPreview.status === 'processing' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Generating Refinement...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => { setSelectedPreviewIndex(prev => (prev! < images.length - 1 ? prev! + 1 : 0)); setAnalysisMode('none'); }}
                  className="absolute right-6 z-50 p-4 bg-black/60 hover:bg-indigo-600 border border-white/10 rounded-full transition-all shadow-2xl text-white"
                >
                  <IconChevronRight />
                </button>
              </div>

              {isRefining && (
                <div className="w-full md:w-80 bg-neutral-900 border-l border-white/10 p-6 flex flex-col gap-6 animate-in slide-in-from-right duration-500 z-50 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">Refinement Control</h4>
                    <button onClick={() => setIsRefining(false)} className="text-neutral-500 hover:text-white transition-colors">
                      <IconX />
                    </button>
                  </div>
                  <textarea 
                    value={refinePrompt}
                    onChange={(e) => setRefinePrompt(e.target.value)}
                    className="w-full h-48 bg-black/50 border border-neutral-700 rounded-xl p-4 text-sm outline-none resize-none focus:border-indigo-500 transition-colors text-white"
                    placeholder="Describe specific changes for this data point..."
                  />
                  <button 
                    onClick={() => processSingleImage(currentPreview.id, refinePrompt)} 
                    className="w-full bg-indigo-600 py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-500 transition-all text-white flex items-center justify-center gap-2"
                  >
                    <IconPlay /> Update Metadata
                  </button>
                  <div className="text-[10px] text-neutral-500 italic mt-auto border-t border-white/5 pt-4">
                    Localized processing ensures the coordinate frame is preserved.
                  </div>
                </div>
              )}
            </div>

            <footer className="h-32 bg-black border-t border-white/5 p-4 flex items-center gap-6 overflow-x-auto no-scrollbar scroll-smooth">
              {images.map((img, idx) => (
                <button 
                  key={img.id} 
                  onClick={() => { setSelectedPreviewIndex(idx); setAnalysisMode('none'); }} 
                  className={`h-24 aspect-square rounded-xl overflow-hidden border-2 transition-all shrink-0 relative group ${selectedPreviewIndex === idx ? 'border-indigo-500 scale-110 shadow-indigo-500/20 shadow-2xl z-10' : 'border-transparent opacity-30 hover:opacity-100 hover:scale-105'}`}
                >
                  <img src={img.originalUrl} className="w-full h-full object-cover" />
                  {img.editedUrl && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  )}
                </button>
              ))}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
