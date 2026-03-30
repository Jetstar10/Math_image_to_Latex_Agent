import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Camera, Copy, Check, RefreshCw, Image as ImageIcon, X, ChevronRight, Box } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { convertImageToLatex, type EquationDetection } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [latex, setLatex] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard" | null>(null);
  const [difficultyFeedback, setDifficultyFeedback] = useState<string | null>(null);
  const [verification, setVerification] = useState<string | null>(null);
  const [detections, setDetections] = useState<EquationDetection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [selectedMistake, setSelectedMistake] = useState<EquationDetection | null>(null);
  const [hoveredMistake, setHoveredMistake] = useState<EquationDetection | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImage(result);
      handleConvert(result, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleConvert = async (base64: string, mimeType: string) => {
    setIsProcessing(true);
    setLatex(null);
    setDifficulty(null);
    setDifficultyFeedback(null);
    setVerification(null);
    setDetections([]);
    setSelectedMistake(null);
    setHoveredMistake(null);
    try {
      const result = await convertImageToLatex(base64, mimeType);
      setLatex(result.latex);
      setDetections(result.detections);
      setDifficulty(result.difficulty);
      setDifficultyFeedback(result.difficultyFeedback);
      setVerification(result.verification);
    } catch (err) {
      console.error(err);
      setError('Failed to analyze document. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (latex) {
      navigator.clipboard.writeText(latex);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const reset = () => {
    setImage(null);
    setLatex(null);
    setDifficulty(null);
    setDifficultyFeedback(null);
    setVerification(null);
    setDetections([]);
    setSelectedMistake(null);
    setHoveredMistake(null);
    setError(null);
    setIsCameraOpen(false);
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error(err);
      setError('Could not access camera.');
      setIsCameraOpen(false);
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        setImage(dataUrl);
        setIsCameraOpen(false);
        
        // Stop camera stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        
        handleConvert(dataUrl, 'image/png');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-3 md:p-8">
      {/* Header */}
      <header className="w-full max-w-4xl mb-6 md:mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center justify-center p-1.5 md:p-2 bg-blue-50 text-blue-600 rounded-full mb-3 md:mb-4 px-3 md:px-4 text-[10px] md:text-sm font-medium"
        >
          <Box className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />
          MathSnap LaTeX & Analysis
        </motion.div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 mb-2 md:mb-4">
          MathSnap <span className="text-blue-600">LaTeX</span>
        </h1>
        <p className="text-slate-500 text-sm md:text-lg max-w-2xl mx-auto px-4">
          Convert mathematical notes to LaTeX instantly. Detected mistakes are highlighted with detailed explanations.
        </p>
      </header>

      <main className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <section className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-bottom border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 flex items-center">
                <Upload className="w-4 h-4 mr-2 text-blue-500" />
                Input Source
              </h2>
              <div className="flex items-center space-x-4">
                {detections.length > 0 && (
                  <button 
                    onClick={() => setShowBoxes(!showBoxes)}
                    className={cn(
                      "text-xs font-medium flex items-center transition-colors",
                      showBoxes ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Box className="w-3 h-3 mr-1" />
                    {showBoxes ? 'Hide Analysis' : 'Show Analysis'}
                  </button>
                )}
                {image && (
                  <button 
                    onClick={reset}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600 flex items-center transition-colors"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              {!image && !isCameraOpen ? (
                <div className="space-y-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) processFile(file);
                    }}
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group"
                  >
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <p className="text-slate-600 font-medium">Click to upload or drag & drop</p>
                    <p className="text-slate-400 text-sm mt-1">PNG, JPG up to 10MB</p>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-100" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-400">Or use camera</span>
                    </div>
                  </div>

                  <button 
                    onClick={startCamera}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-medium flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Open Camera
                  </button>
                </div>
              ) : isCameraOpen ? (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                    <button 
                      onClick={captureImage}
                      className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform"
                    >
                      <div className="w-12 h-12 border-4 border-slate-900 rounded-full" />
                    </button>
                    <button 
                      onClick={() => {
                        setIsCameraOpen(false);
                        const stream = videoRef.current?.srcObject as MediaStream;
                        stream?.getTracks().forEach(track => track.stop());
                      }}
                      className="absolute right-4 bottom-4 w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-100 shadow-inner group/image">
                  <img 
                    ref={imageRef}
                    src={image!} 
                    alt="Uploaded math" 
                    className="w-full h-auto block" 
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
                    }}
                  />
                  
                  {/* Bounding Boxes Overlay */}
                  {showBoxes && detections.map((det, idx) => {
                    const [ymin, xmin, ymax, xmax] = det.box_2d;
                    const isSelected = selectedMistake === det;
                    const isHovered = hoveredMistake === det;
                    const showExplanation = isSelected || isHovered;

                    // Determine if explanation should show above or below
                    const isBottomHalf = ymin > 500;

                    return (
                      <div key={idx} className="absolute" style={{
                        top: `${ymin / 10}%`,
                        left: `${xmin / 10}%`,
                        width: `${(xmax - xmin) / 10}%`,
                        height: `${(ymax - ymin) / 10}%`,
                        zIndex: isSelected ? 30 : isHovered ? 25 : 10
                      }}>
                        <button 
                          onClick={() => setSelectedMistake(isSelected ? null : det)}
                          onMouseEnter={() => setHoveredMistake(det)}
                          onMouseLeave={() => setHoveredMistake(null)}
                          className={cn(
                            "w-full h-full border-2 transition-all cursor-help relative group",
                            det.type === "mistake" 
                              ? (isSelected ? "border-red-600 bg-red-600/20 shadow-[0_0_15px_rgba(220,38,38,0.5)]" : "border-red-500 bg-red-500/10 hover:bg-red-500/20")
                              : (isSelected ? "border-green-600 bg-green-600/20 shadow-[0_0_15px_rgba(22,163,74,0.5)]" : "border-green-500 bg-green-500/10 hover:bg-green-500/20")
                          )}
                        >
                          <span className={cn(
                            "absolute left-0 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase whitespace-nowrap shadow-sm transition-all",
                            det.type === "mistake" ? "bg-red-600" : "bg-green-600",
                            isBottomHalf ? "bottom-full mb-1" : "top-full mt-1"
                          )}>
                            {det.label}
                          </span>
                        </button>

                        {/* Popped out explanation */}
                        <AnimatePresence>
                          {showExplanation && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: isBottomHalf ? -10 : 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: isBottomHalf ? -10 : 10 }}
                              className={cn(
                                "absolute w-64 md:w-72 p-3 md:p-4 bg-white border border-slate-200 rounded-xl md:rounded-2xl shadow-2xl z-40",
                                isBottomHalf ? "bottom-full mb-6 md:mb-8" : "top-full mt-6 md:mt-8",
                                // Center on mobile if it might go off-screen
                                xmin < 200 ? "left-0" : xmin > 800 ? "right-0" : "left-1/2 -translate-x-1/2"
                              )}
                            >
                              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                                <div className="flex items-center">
                                  <div className={cn(
                                    "w-5 h-5 md:w-6 md:h-6 rounded-lg flex items-center justify-center mr-1.5 md:mr-2",
                                    det.type === "mistake" ? "bg-red-50" : "bg-green-50"
                                  )}>
                                    <Box className={cn(
                                      "w-3 h-3 md:w-3.5 md:h-3.5",
                                      det.type === "mistake" ? "text-red-500" : "text-green-500"
                                    )} />
                                  </div>
                                  <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {det.type === "mistake" ? "Mistake Analysis" : "Correction Detail"}
                                  </span>
                                </div>
                                {isSelected && <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-green-500" />}
                              </div>
                              <h4 className="text-xs md:text-sm font-bold text-slate-900 mb-0.5 md:mb-1">{det.label}</h4>
                              <p className="text-[10px] md:text-xs text-slate-600 leading-relaxed">
                                {det.explanation}
                              </p>
                              <div className={cn(
                                "absolute w-2.5 h-2.5 md:w-3 md:h-3 bg-white border-l border-t border-slate-200 rotate-45",
                                isBottomHalf ? "-bottom-1.5 border-l-0 border-t-0 border-r border-b" : "-top-1.5",
                                xmin < 200 ? "left-4" : xmin > 800 ? "right-4" : "left-1/2 -translate-x-1/2"
                              )} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  <div className="absolute top-2 right-2 flex space-x-2">
                    <button 
                      onClick={reset}
                      className="p-2 bg-white/80 backdrop-blur-sm text-slate-600 rounded-full hover:bg-white transition-colors shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mistakes Summary List */}
            {detections.length > 0 && (
              <div className="px-6 pb-6 pt-2">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                    <Box className="w-3 h-3 mr-1.5 text-blue-500" />
                    Analysis Summary ({detections.length})
                  </h3>
                  <div className="space-y-2">
                    {detections.map((det, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedMistake(selectedMistake === det ? null : det)}
                        onMouseEnter={() => setHoveredMistake(det)}
                        onMouseLeave={() => setHoveredMistake(null)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border transition-all flex items-start group",
                          selectedMistake === det 
                            ? (det.type === "mistake" ? "bg-white border-red-200 shadow-sm" : "bg-white border-green-200 shadow-sm")
                            : "bg-transparent border-transparent hover:bg-white hover:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 mr-3 shrink-0",
                          det.type === "mistake" 
                            ? (selectedMistake === det ? "bg-red-600" : "bg-red-400")
                            : (selectedMistake === det ? "bg-green-600" : "bg-green-400")
                        )} />
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-bold text-slate-800">{det.label}</p>
                            <span className={cn(
                              "text-[8px] px-1 rounded font-bold uppercase",
                              det.type === "mistake" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                            )}>
                              {det.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1 group-hover:line-clamp-none transition-all">
                            {det.explanation}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100"
            >
              {error}
            </motion.div>
          )}
        </section>

        {/* Output Section */}
        <section className="space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col h-full min-h-[400px]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 flex items-center">
                <ChevronRight className="w-4 h-4 mr-2 text-blue-500" />
                LaTeX Document
              </h2>
              {latex && (
                <button 
                  onClick={copyToClipboard}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-all",
                    isCopied ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy LaTeX
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="flex-1 p-6 flex flex-col">
              <AnimatePresence mode="wait">
                {isProcessing ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center space-y-4"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-blue-100 rounded-full" />
                      <div className="absolute inset-0 w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <p className="text-slate-500 font-medium animate-pulse">Analyzing document...</p>
                  </motion.div>
                ) : latex ? (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-8"
                    >
                      {difficulty && (
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Difficulty Assessment</p>
                            <div className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              difficulty === "Easy" ? "bg-green-100 text-green-700" :
                              difficulty === "Medium" ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            )}>
                              {difficulty}
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed italic">
                            "{difficultyFeedback}"
                          </p>
                        </div>
                      )}

                      {verification && (
                        <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                          <div className="flex items-center mb-4">
                            <Check className="w-4 h-4 text-blue-500 mr-2" />
                            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Correctness Verification</p>
                          </div>
                          <p className="text-sm text-blue-700 leading-relaxed">
                            {verification}
                          </p>
                        </div>
                      )}

                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Rendered Preview</p>
                      <div className="flex flex-col space-y-4 overflow-x-auto">
                        {latex.includes('\\begin{document}') ? (
                          latex
                            .split('\\begin{document}')[1]
                            ?.split('\\end{document}')[0]
                            ?.replace('\\maketitle', '')
                            ?.split('\n\n')
                            .filter(block => block.trim())
                            .map((block, idx) => {
                              if (block.includes('\\[') || block.includes('\\begin{')) {
                                const mathMatch = block.match(/\\\[([\s\S]*?)\\\]/);
                                const mathContent = mathMatch ? mathMatch[1] : block;
                                return <BlockMath key={idx} math={mathContent} />;
                              }
                              return <p key={idx} className="text-slate-700 text-sm leading-relaxed">{block}</p>;
                            })
                        ) : (
                          <BlockMath math={latex} />
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full LaTeX Code</p>
                        <button 
                          onClick={copyToClipboard}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          {isCopied ? 'Copied' : 'Copy Code'}
                        </button>
                      </div>
                      <pre className="bg-slate-900 text-blue-400 p-4 rounded-2xl font-mono text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[500px]">
                        {latex}
                      </pre>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center text-center p-8"
                  >
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <ImageIcon className="w-8 h-8 text-slate-200" />
                    </div>
                    <h3 className="text-slate-800 font-semibold mb-2">No output yet</h3>
                    <p className="text-slate-400 text-sm max-w-[200px]">
                      Upload an image or take a photo to see the LaTeX conversion and analysis.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>
      </main>

      {/* API Info Section */}
      <section className="w-full max-w-4xl mt-8">
        <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
              <RefreshCw className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold">Developer API Endpoint</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Send an image to get a full LaTeX document and mistake detection.
          </p>
          <div className="bg-slate-800 rounded-xl p-4 font-mono text-xs overflow-x-auto">
            <p className="text-blue-400 mb-2">POST /api/convert</p>
            <pre className="text-slate-300">
{`{
  "image": "base64_image_data",
  "mimeType": "image/png"
}`}
            </pre>
            <p className="text-slate-500 mt-4 mb-2 uppercase tracking-widest font-bold">Response Format</p>
            <pre className="text-slate-300">
{`{
  "latex": "\\documentclass{article}...",
  "difficulty": "Medium",
  "difficultyFeedback": "This problem involves multi-step matrix operations...",
  "verification": "The student's answer is correct, and the correction accurately identifies the minor sign error in step 3.",
  "detections": [
    {
      "label": "Sign Error",
      "explanation": "You missed a negative sign in step 2...",
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 text-slate-400 text-sm pb-8">
        <p>© 2026 MathSnap LaTeX • Powered by Gemini 3 Flash</p>
      </footer>
    </div>
  );
}
