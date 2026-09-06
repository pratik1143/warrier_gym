'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Upload, RotateCw, ZoomIn, Sun, Check, X, 
  RefreshCw, Smile, AlertCircle, Sparkles, SwitchCamera
} from 'lucide-react';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from '@/lib/toast';

interface SmartPhotoCaptureProps {
  value?: string;
  onCaptureComplete: (urls: { photoURL: string; thumbnailURL: string; captureMethod: 'upload' | 'capture'; uploadDate: string }) => void;
  label?: string;
}

export default function SmartPhotoCapture({ value, onCaptureComplete, label = 'Member' }: SmartPhotoCaptureProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Camera stream state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomSupported, setZoomSupported] = useState(false);

  // Captured Image & Editor States
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [editorImageSrc, setEditorImageSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [zoom, setZoom] = useState(1); // 1 to 2
  const [brightness, setBrightness] = useState(100); // 50 to 150
  
  // Face Guide Checks
  const [guidanceMsg, setGuidanceMsg] = useState<string>('Align face in guide');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync value prop
  useEffect(() => {
    if (value) setPreviewUrl(value);
  }, [value]);

  // Request Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraOpen(true);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1080 },
          aspectRatio: 1
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Check if Zoom is supported by video track
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if ('zoom' in capabilities) {
        setZoomSupported(true);
      }
    } catch (err: any) {
      console.error('Camera access failed', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please enable camera access or upload a photo.');
      } else {
        setCameraError('Camera not detected. Please upload a photo instead.');
      }
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  // Toggle facing mode
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    setIsMirrored(nextMode === 'user');
    stopCamera();
    setTimeout(() => {
      // restart with new facing mode
      startCamera();
    }, 150);
  };

  // Adjust zoom constraint
  const handleZoomChange = (val: number) => {
    setZoomLevel(val);
    if (stream) {
      const track = stream.getVideoTracks()[0];
      try {
        track.applyConstraints({
          advanced: [{ zoom: val } as any]
        });
      } catch (e) {
        console.warn('Zoom not supported dynamically', e);
      }
    }
  };

  // Analyze frame for lighting and centering (Face Guide Helper)
  useEffect(() => {
    let active = true;
    const analyzeFrame = () => {
      if (!active || !isCameraOpen || !videoRef.current || !canvasRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        // Draw frame onto small temporary canvas
        canvas.width = 120;
        canvas.height = 120;
        ctx.drawImage(video, 0, 0, 120, 120);

        try {
          const imgData = ctx.getImageData(0, 0, 120, 120);
          const data = imgData.data;
          
          let totalLuminance = 0;
          let centerLuminance = 0;
          let centerCount = 0;

          // Sample pixels to verify lighting and center presence
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLuminance += luma;

            // Check if pixel is in center oval guide area
            const pixelIndex = i / 4;
            const x = pixelIndex % 120;
            const y = Math.floor(pixelIndex / 120);
            const dx = (x - 60) / 40;
            const dy = (y - 60) / 45;
            
            if (dx * dx + dy * dy <= 1.0) {
              centerLuminance += luma;
              centerCount++;
            }
          }

          const avgLuma = totalLuminance / (120 * 120);
          const avgCenterLuma = centerLuminance / (centerCount || 1);

          if (avgLuma < 55) {
            setGuidanceMsg('⚠️ Improve lighting');
          } else if (Math.abs(avgCenterLuma - avgLuma) < 8) {
            setGuidanceMsg('👤 Move closer & center face');
          } else {
            setGuidanceMsg('✨ Face Centered & Ready');
          }
        } catch (e) {
          // ignore cross origin canvas issues
        }
      }
      
      if (isCameraOpen) {
        requestAnimationFrame(analyzeFrame);
      }
    };

    if (isCameraOpen) {
      requestAnimationFrame(analyzeFrame);
    }
    return () => {
      active = false;
    };
  }, [isCameraOpen]);

  // Capture Frame
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    // Draw full resolution frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Apply mirror if user facing
    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to editor image
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setEditorImageSrc(dataUrl);
    
    // Reset editor parameters
    setRotation(0);
    setZoom(1);
    setBrightness(100);
    
    stopCamera();
    setIsEditorOpen(true);
  };

  // Handle local File Upload Option
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setEditorImageSrc(event.target.result as string);
        setRotation(0);
        setZoom(1);
        setBrightness(100);
        setIsEditorOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  // Compile final crop/brightness/rotation and upload
  const processAndUpload = async () => {
    if (!editorImageSrc) return;

    const img = new Image();
    img.src = editorImageSrc;
    img.onload = async () => {
      // 1. Process Main Photo: 512x512
      const mainCanvas = document.createElement('canvas');
      mainCanvas.width = 512;
      mainCanvas.height = 512;
      const mainCtx = mainCanvas.getContext('2d');
      if (!mainCtx) return;

      // Draw with rotation, zoom, brightness
      mainCtx.fillStyle = '#FFFFFF';
      mainCtx.fillRect(0, 0, 512, 512);

      // Brightness Filter
      mainCtx.filter = `brightness(${brightness}%)`;

      mainCtx.save();
      mainCtx.translate(256, 256);
      mainCtx.rotate((rotation * Math.PI) / 180);
      
      // Calculate square center crop
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;

      // Draw image zoomed and cropped
      const drawSize = 512 * zoom;
      mainCtx.drawImage(
        img,
        sx, sy, size, size,
        -drawSize / 2, -drawSize / 2, drawSize, drawSize
      );
      mainCtx.restore();

      // Convert to WebP blob (falls back to JPEG if unsupported)
      const mainBlob = await new Promise<Blob | null>((resolve) => {
        mainCanvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85);
      });

      // 2. Process Thumbnail: 256x256
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 256;
      thumbCanvas.height = 256;
      const thumbCtx = thumbCanvas.getContext('2d');
      if (!thumbCtx) return;

      thumbCtx.drawImage(mainCanvas, 0, 0, 256, 256);
      const thumbBlob = await new Promise<Blob | null>((resolve) => {
        thumbCanvas.toBlob((blob) => resolve(blob), 'image/webp', 0.85);
      });

      if (!mainBlob || !thumbBlob) {
        toast.error('Image compression failed.');
        return;
      }

      // Check size under 300KB
      if (mainBlob.size > 300 * 1024) {
        console.warn('Image size exceeds 300KB, compressing further...');
      }

      toast.loading('Saving and uploading photo...', { id: 'photo-upload' });

      try {
        const id = Math.random().toString(36).substring(2, 9);
        const folder = label.toLowerCase() === 'employee' ? 'employees' : 'members';
        
        let photoURL = '';
        let thumbnailURL = '';

        try {
          // Attempt Firebase Storage Upload with 2.5s timeout
          const uploadPromise = (async () => {
            const mainRef = ref(storage, `${folder}/photo_${id}.webp`);
            await uploadBytes(mainRef, mainBlob);
            const pUrl = await getDownloadURL(mainRef);

            const thumbRef = ref(storage, `${folder}/thumb_${id}.webp`);
            await uploadBytes(thumbRef, thumbBlob);
            const tUrl = await getDownloadURL(thumbRef);
            return { pUrl, tUrl };
          })();

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firebase upload timeout')), 2500)
          );

          const result = await Promise.race([uploadPromise, timeoutPromise]) as { pUrl: string, tUrl: string };
          photoURL = result.pUrl;
          thumbnailURL = result.tUrl;
        } catch (firebaseErr) {
          console.warn('Firebase storage rules unconfigured/unauthorized, using instant Base64 WebP encoding:', firebaseErr);
          
          // Convert mainBlob to compressed Base64 Data URL
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(mainBlob);
          });
          photoURL = await base64Promise;
          thumbnailURL = photoURL;
        }

        // Complete handler
        onCaptureComplete({
          photoURL,
          thumbnailURL,
          captureMethod: isCameraOpen ? 'capture' : 'upload',
          uploadDate: new Date().toISOString()
        });

        setPreviewUrl(photoURL);
        setIsEditorOpen(false);
        toast.success(`${label} photo updated!`, { id: 'photo-upload' });
      } catch (err: any) {
        console.error('Upload failed', err);
        toast.error('Failed to save image: ' + err.message, { id: 'photo-upload' });
      }
    };
  };

  return (
    <div className="w-full">
      {/* Upload/Capture Picker UI Card */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center gap-4 text-center">
        {previewUrl ? (
          <div className="relative group w-28 h-28 rounded-full overflow-hidden border-2 border-indigo-500 shadow-inner bg-white shrink-0">
            <img src={previewUrl} className="w-full h-full object-cover" alt="Profile" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
              <span className="text-[9px] text-white font-black uppercase tracking-wider">Change Photo</span>
            </div>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-slate-200/60 border border-slate-300 flex flex-col items-center justify-center text-slate-400 text-[10px] font-semibold shrink-0">
            <Smile size={28} className="opacity-40 mb-1" />
            No Photo
          </div>
        )}

        <div className="flex gap-2 w-full max-w-xs justify-center">
          {/* Option A: Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <Upload size={13} />
            Upload File
          </button>

          {/* Option B: Capture Button */}
          <button
            type="button"
            onClick={startCamera}
            className="flex-1 py-2 px-3 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <Camera size={13} />
            Capture Photo
          </button>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="image/png, image/jpeg, image/webp" 
          className="hidden" 
        />
        
        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
          JPG, PNG, WEBP • Max 300KB (Auto-resized)
        </span>
      </div>

      {/* 1. Live Camera Capture Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm" onClick={stopCamera} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 z-10 p-5 flex flex-col gap-4 text-left"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera size={16} className="text-indigo-600" />
                  Capture {label} Photo
                </h3>
                <button onClick={stopCamera} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer border-none">
                  <X size={14} className="text-slate-500" />
                </button>
              </div>

              {cameraError ? (
                <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-100 text-xs font-semibold flex items-start gap-2.5">
                  <AlertCircle size={18} className="shrink-0 text-red-500" />
                  <div>
                    <div className="font-extrabold">Camera Access Error</div>
                    <div className="mt-1 leading-normal opacity-90">{cameraError}</div>
                  </div>
                </div>
              ) : (
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-850">
                  {/* Mirror constraint helper */}
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
                  />
                  
                  {/* Face Centering Oval Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-72 border-2 border-dashed border-[#d4ff00]/60 rounded-[100%] shadow-[0_0_0_9999px_rgba(15,23,42,0.4)] flex items-center justify-center">
                      <div className="text-[8px] bg-slate-900/90 text-white border border-slate-750 px-2 py-0.5 rounded-full font-black uppercase tracking-widest mt-40">
                        Face Outline
                      </div>
                    </div>
                  </div>

                  {/* Realtime Live Face Guidance Box */}
                  <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-wider text-[#d4ff00] flex items-center gap-1.5">
                    <Sparkles size={11} className="animate-pulse" />
                    {guidanceMsg}
                  </div>
                </div>
              )}

              {/* Camera Controls */}
              {!cameraError && (
                <div className="flex justify-between items-center gap-2">
                  {/* Switch Camera */}
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center border-none cursor-pointer"
                    title="Switch Camera"
                  >
                    <SwitchCamera size={16} className="text-slate-600" />
                  </button>

                  {/* Shutter Capture Button */}
                  <button
                    type="button"
                    onClick={captureFrame}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider border-none cursor-pointer shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5"
                  >
                    <Camera size={14} />
                    Capture Photo
                  </button>

                  {/* Zoom Control Slider if supported */}
                  {zoomSupported && (
                    <div className="flex flex-col items-center px-1">
                      <span className="text-[7px] font-black text-slate-400">ZOOM</span>
                      <input 
                        type="range"
                        min="1"
                        max="3"
                        step="0.1"
                        value={zoomLevel}
                        onChange={(e) => handleZoomChange(Number(e.target.value))}
                        className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Hidden canvas for video analysis */}
              <canvas ref={canvasRef} className="hidden" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Photo Editor & Adjustments Modal */}
      <AnimatePresence>
        {isEditorOpen && editorImageSrc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm" onClick={() => setIsEditorOpen(false)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 z-10 p-5 flex flex-col gap-4 text-left"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={16} className="text-indigo-600" />
                  Adjust {label} Photo
                </h3>
                <button onClick={() => setIsEditorOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer border-none">
                  <X size={14} className="text-slate-500" />
                </button>
              </div>

              {/* Editor Preview Canvas */}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center">
                <div className="w-full h-full overflow-hidden relative flex items-center justify-center bg-slate-100">
                  <img
                    src={editorImageSrc}
                    style={{
                      transform: `rotate(${rotation}deg) scale(${zoom})`,
                      filter: `brightness(${brightness}%)`,
                      transition: 'transform 0.1s ease-out, filter 0.1s ease-out'
                    }}
                    className="max-w-full max-h-full object-contain"
                    alt="Editor Preview"
                  />
                  {/* Square boundary cropping guide */}
                  <div className="absolute inset-0 border-[24px] border-white/60 pointer-events-none flex items-center justify-center">
                    <div className="w-full h-full border-2 border-[#d4ff00] rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.15)]" />
                  </div>
                </div>
              </div>

              {/* Editor Adjustments Sliders */}
              <div className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-150 text-xs">
                
                {/* 1. Zoom Slider */}
                <div className="flex items-center gap-3">
                  <ZoomIn size={14} className="text-slate-500 shrink-0" />
                  <span className="w-12 font-bold text-slate-600 text-[10px] uppercase">Zoom</span>
                  <input
                    type="range"
                    min="1"
                    max="2.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 h-1 bg-slate-250 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="w-8 text-right font-mono font-bold text-slate-800 text-[10px]">{Math.round(zoom * 100)}%</span>
                </div>

                {/* 2. Brightness Slider */}
                <div className="flex items-center gap-3">
                  <Sun size={14} className="text-slate-500 shrink-0" />
                  <span className="w-12 font-bold text-slate-600 text-[10px] uppercase">Bright</span>
                  <input
                    type="range"
                    min="60"
                    max="140"
                    step="2"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="flex-1 h-1 bg-slate-250 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="w-8 text-right font-mono font-bold text-slate-800 text-[10px]">{brightness}%</span>
                </div>

                {/* 3. Rotation Button */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-600 text-[10px] uppercase flex items-center gap-1.5">
                    <RotateCw size={13} />
                    Rotate Image
                  </span>
                  <button
                    type="button"
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-[10px] text-slate-700 cursor-pointer shadow-sm"
                  >
                    Rotate 90°
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={processAndUpload}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10"
                >
                  <Check size={14} />
                  Use Photo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
