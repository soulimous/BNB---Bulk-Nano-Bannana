
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
const IconSparkles = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.143-7.714L11 3z" /></svg>;

const PRESET_PROMPTS_KEY = 'visonary_presets_v5';
const DEFAULT_PROMPT = "do not change image except add goblin feature witn long beard, also add dynaite box everywhere";

export default function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(GeminiModel.FLASH);
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [presets, setPresets] = useState<string[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [analysisMode, setAnalysisMode] = useState<AnalysisViewMode>('none');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(PRESET_PROMPTS_KEY);
    const initialPresets = [
      DEFAULT_PROMPT,
      'Cinematic lighting', 
      'Monochrome sketch', 
      'Remove background'
    ];
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        setPresets(parsed.length > 0 ? parsed : initialPresets); 
      } catch (e) { 
        setPresets(initialPresets); 
      }
    } else {
      setPresets(initialPresets);
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

  const savePromptToPresets = () => {
    if (!prompt.trim()) return;
    if (presets.includes(prompt.trim())) return;
    const newPresets = [prompt.trim(), ...presets];
    setPresets(newPresets);
    localStorage.setItem(PRESET_PROMPTS_KEY, JSON.stringify(newPresets));
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
    <div className="relative h-screen w-full bg-black overflow-hidden font-sans text-neutral-100">
      <div className={`flex flex-col lg:flex-row h-full w-full transition-all duration-700 ease-in-out ${selectedPreviewIndex !== null ? 'blur-[60px] brightness-[0.05] scale-[0.95] pointer-events-none' : ''}`}>
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-neutral-800 bg-neutral-900/80 p-6 flex flex-col gap-6 overflow-y-auto shrink-0 z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
               <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-500 bg-clip-text text-transparent">Edit Studio</h1>
          </div>

          <section className="space-y-3">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Model</label>
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer focus:border-indigo-500 transition-colors"
            >
              <option value={GeminiModel.FLASH}>Gemini 2.5 Flash</option>
              <option value={GeminiModel.PRO}>Gemini 3 Pro</option>
            </select>
          </section>

          <section className="space-y-4 flex-1 flex flex-col">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Global Presets</label>
              <select 
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer focus:border-indigo-500 transition-colors"
                onChange={(e) => setPrompt(e.target.value)}
                value={presets.includes(prompt) ? prompt : ""}
              >
                <option value="" disabled>Select a preset...</option>
                {presets.map((p, idx) => (
                  <option key={idx} value={p}>{p.length > 35 ? p.substring(0, 35) + "..." : p}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col flex-1 gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Global Instructions</label>
                <button 
                  onClick={savePromptToPresets} 
                  className="text-[10px] text-indigo-400 font-bold flex items-center gap-1 hover:text-indigo-300 transition-colors"
                >
                  <IconSave /> Save
                </button>
              </div>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full flex-1 bg-neutral-800 border border-neutral-700 rounded-2xl p-4 text-sm outline-none resize-none focus:border-indigo-500 transition-colors"
                placeholder="Job instructions..."
              />
            </div>
          </section>

          <div className="pt-4 space-y-3">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="image/*" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-4 rounded-2xl transition-all border border-neutral-700">
              <IconPlus /> Add Photos
            </button>
            <button onClick={runPrompt} disabled={isProcessingAll || images.length === 0 || !prompt} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-5 rounded-2xl shadow-xl disabled:opacity-50 transition-all flex items-center justify-center gap-3">
              {isProcessingAll ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <IconPlay />}
              Start All
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-neutral-950/40">
          {images.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
              <IconPlus />
              <h2 className="text-xl font-medium mt-4">Empty Workspace</h2>
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

      {selectedPreviewIndex !== null && currentPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 animate-in fade-in duration-300 backdrop-blur-md">
          <div className="w-[98vw] h-[98vh] flex flex-col bg-neutral-900 rounded-[3rem] overflow-hidden border border-white/10 shadow-[0_0_150px_rgba(0,0,0,1)]">
            {/* Modal Header */}
            <header className="px-8 py-6 grid grid-cols-1 md:grid-cols-3 items-center border-b border-white/5 bg-black/80 shrink-0 z-20">
              <div className="flex items-center gap-4">
                <button onClick={() => { setSelectedPreviewIndex(null); setAnalysisMode('none'); }} className="p-3 bg-neutral-800 hover:bg-red-500/20 hover:text-red-500 rounded-full transition-all text-white">
                  <IconX />
                </button>
                <div className="truncate">
                  <h3 className="text-sm font-bold truncate text-white tracking-tight">{currentPreview.originalMetadata.name}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-[0.2em] mt-0.5">{analysisMode !== 'none' ? 'Analysis' : 'Comparison'}</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center justify-center">
                <div className="flex p-1 bg-neutral-950 rounded-xl border border-white/5 mb-3">
                  <button onClick={() => setAnalysisMode('none')} className={`px-5 py-2 text-[10px] font-bold rounded-lg transition-all ${analysisMode === 'none' ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:text-white'}`}>Wipe</button>
                  <button onClick={() => setAnalysisMode('intensity')} className={`px-5 py-2 text-[10px] font-bold rounded-lg transition-all ${analysisMode === 'intensity' ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:text-white'}`}>Intensity</button>
                  <button onClick={() => setAnalysisMode('differential')} className={`px-5 py-2 text-[10px] font-bold rounded-lg transition-all ${analysisMode === 'differential' ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:text-white'}`}>Diff Map</button>
                </div>
                
                <div className="flex items-center gap-8 text-[10px] font-mono tracking-tighter">
                    <div className="flex flex-col items-center text-neutral-400">
                      <span>{currentPreview.originalMetadata.dimensions} • {currentPreview.originalMetadata.size}</span>
                    </div>
                    {currentPreview.editedMetadata && (
                      <div className="flex flex-col items-center text-indigo-400 border-l border-white/10 pl-8">
                        <span>{currentPreview.editedMetadata.dimensions} • {currentPreview.editedMetadata.size}</span>
                      </div>
                    )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsRefining(!isRefining)} 
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${isRefining ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}
                >
                    <IconSparkles /> Refine Item
                </button>
              </div>
            </header>

            {/* REBUILT Modal Body */}
            <div className="flex-1 flex relative min-h-0 bg-black/40">
              {/* Main content area */}
              <div className="flex-1 relative min-w-0">
                  {/* Stable Centering Container */}
                  <div className="absolute inset-0 flex items-center justify-center p-4 md:p-8">
                      {currentPreview.editedUrl ? (
                          <div className="w-full h-full relative">
                              {analysisMode === 'none' && (
                                  <ComparisonSlider 
                                      originalUrl={currentPreview.originalUrl} 
                                      editedUrl={currentPreview.editedUrl}
                                  />
                              )}
                              {analysisMode !== 'none' && (
                                  <DiffOverlay 
                                      originalUrl={currentPreview.originalUrl}
                                      editedUrl={currentPreview.editedUrl}
                                      originalMeta={currentPreview.originalMetadata}
                                      editedMeta={currentPreview.editedMetadata!}
                                      mode={analysisMode}
                                  />
                              )}
                          </div>
                      ) : (
                          <div className="relative flex items-center justify-center max-w-full max-h-full">
                              <img 
                                src={currentPreview.originalUrl} 
                                className="block max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                                alt="Original preview"
                              />
                              {currentPreview.status === 'processing' && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl z-50 rounded-2xl">
                                      <div className="flex flex-col items-center gap-6">
                                          <div className="w-16 h-16 border-[6px] border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                          <span className="text-sm font-bold text-indigo-400 uppercase tracking-widest animate-pulse">Processing...</span>
                                      </div>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>

                  {/* Navigation buttons */}
                  <button 
                    onClick={() => { setSelectedPreviewIndex(prev => (prev! > 0 ? prev! - 1 : images.length - 1)); setAnalysisMode('none'); }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 z-50 p-4 bg-black/60 hover:bg-indigo-600 border border-white/10 rounded-full transition-all text-white hover:scale-110 active:scale-95 group"
                    aria-label="Previous image"
                  >
                    <IconChevronLeft />
                  </button>
                  <button 
                    onClick={() => { setSelectedPreviewIndex(prev => (prev! < images.length - 1 ? prev! + 1 : 0)); setAnalysisMode('none'); }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 z-50 p-4 bg-black/60 hover:bg-indigo-600 border border-white/10 rounded-full transition-all text-white hover:scale-110 active:scale-95 group"
                    aria-label="Next image"
                  >
                    <IconChevronRight />
                  </button>
              </div>

              {/* Sidebar Panel */}
              {isRefining && (
                <div className="w-full md:w-96 bg-neutral-900 border-l border-white/10 p-8 flex flex-col gap-6 animate-in slide-in-from-right duration-500 z-10 shadow-3xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-white uppercase tracking-[0.2em] flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      Local Job
                    </h4>
                    <button onClick={() => setIsRefining(false)} className="text-neutral-500 hover:text-white transition-colors">
                      <IconX />
                    </button>
                  </div>
                  <div className="space-y-6">
                    <p className="text-[11px] text-neutral-500 italic leading-relaxed">Specific instructions for this item only.</p>
                    <textarea 
                      value={refinePrompt}
                      onChange={(e) => setRefinePrompt(e.target.value)}
                      className="w-full h-80 bg-black border border-neutral-800 rounded-2xl p-6 text-sm outline-none resize-none focus:border-indigo-500 transition-colors text-white"
                      placeholder="Prompt override..."
                    />
                    <button 
                      onClick={() => processSingleImage(currentPreview.id, refinePrompt)} 
                      disabled={currentPreview.status === 'processing'}
                      className="w-full bg-indigo-600 py-5 rounded-2xl text-xs font-bold shadow-xl hover:bg-indigo-500 transition-all text-white flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {currentPreview.status === 'processing' ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <IconPlay />}
                      Execute Refinement
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Filmstrip View */}
            <footer className="h-40 bg-black/80 border-t border-white/5 px-10 py-6 flex items-center gap-6 overflow-x-auto no-scrollbar scroll-smooth shrink-0 z-20">
              {images.map((img, idx) => (
                <button 
                  key={img.id} 
                  onClick={() => { setSelectedPreviewIndex(idx); setAnalysisMode('none'); }} 
                  className={`h-full aspect-square rounded-2xl overflow-hidden border-[3px] transition-all shrink-0 relative group ${selectedPreviewIndex === idx ? 'border-indigo-500 scale-110 shadow-lg z-10' : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'}`}
                >
                  <img src={img.originalUrl} className="w-full h-full object-cover" alt={`Thumbnail for ${img.originalMetadata.name}`} />
                  {img.editedUrl && (
                    <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)] border-2 border-black" />
                  )}
                  {img.status === 'processing' && (
                    <div className="absolute inset-0 bg-indigo-600/30 backdrop-blur-[2px] flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                    </div>
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
