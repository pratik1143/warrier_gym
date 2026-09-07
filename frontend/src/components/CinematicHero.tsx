'use client';

import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Clock, Flame, Dumbbell, Sparkles } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export default function CinematicHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smokeCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // HUD Elements Refs for high-performance direct DOM updates
  const overlayRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const phase1Ref = useRef<HTMLDivElement>(null);
  const hud23Ref = useRef<HTMLDivElement>(null);
  const hud23ProgressRef = useRef<HTMLDivElement>(null);
  const hud23TextRef = useRef<HTMLDivElement>(null);
  const hud4Ref = useRef<HTMLDivElement>(null);
  const hud4TextRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);
  const card4Ref = useRef<HTMLDivElement>(null);
  const mobileStatsRef = useRef<HTMLDivElement>(null);
  const finalBrandingRef = useRef<HTMLDivElement>(null);
  
  // Preloading & frames store
  const [images, setImages] = useState<string[]>([]);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [framesAvailable, setFramesAvailable] = useState<boolean | null>(null);
  
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameIdx = useRef(0);
  const scrollProgress = useRef(0);
  const particles = useRef<Particle[]>([]);

  // Fetch images list on mount
  useEffect(() => {
    async function fetchImages() {
      try {
        const res = await fetch('/api/images');
        const data = await res.json();
        if (data.images && data.images.length > 0) {
          // Probe first frame to verify availability (e.g. static assets deployed)
          const probe = await fetch(data.images[0], { method: 'HEAD' });
          if (probe.ok) {
            setImages(data.images);
            setFramesAvailable(true);
          } else {
            setFramesAvailable(false);
          }
        } else {
          setFramesAvailable(false);
        }
      } catch (err) {
        console.error('Failed to load images from API:', err);
        setFramesAvailable(false);
      }
    }
    fetchImages();
  }, []);

  // Render a specific frame on canvas (object-fit: cover implementation)
  const drawFrame = React.useCallback((index: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || imagesRef.current.length === 0) return;

    // Optimization: Find the closest loaded image if the target index is not loaded yet
    let img = imagesRef.current[index];
    if (!img || !img.complete || img.naturalWidth === 0) {
      let found = false;
      // Search backwards first
      for (let i = index - 1; i >= 0; i--) {
        const testImg = imagesRef.current[i];
        if (testImg && testImg.complete && testImg.naturalWidth > 0) {
          img = testImg;
          found = true;
          break;
        }
      }
      // If not found, search forwards
      if (!found) {
        for (let i = index + 1; i < imagesRef.current.length; i++) {
          const testImg = imagesRef.current[i];
          if (testImg && testImg.complete && testImg.naturalWidth > 0) {
            img = testImg;
            found = true;
            break;
          }
        }
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Compute dimensions to fill viewport
    const imgWidth = img.naturalWidth || 1920;
    const imgHeight = img.naturalHeight || 1080;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const imgRatio = imgWidth / imgHeight;
    const canvasRatio = canvasWidth / canvasHeight;

    let drawWidth = canvasWidth;
    let drawHeight = canvasHeight;
    let drawX = 0;
    let drawY = 0;

    if (imgRatio > canvasRatio) {
      drawWidth = canvasHeight * imgRatio;
      drawX = (canvasWidth - drawWidth) / 2;
    } else {
      drawHeight = canvasWidth / imgRatio;
      drawY = (canvasHeight - drawHeight) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }, []);

  // Optimized spaced-keyframe preloader + background stream loading
  useEffect(() => {
    if (images.length === 0) return;

    const preloadedImagesList: HTMLImageElement[] = [];
    
    // Instantiate all Image objects
    for (let i = 0; i < images.length; i++) {
      preloadedImagesList.push(new Image());
    }

    // Step size for critical keyframes (evenly spaced across the timeline)
    const STEP = 6;
    const keyframeIndices: number[] = [];
    const remainingIndices: number[] = [];

    for (let i = 0; i < images.length; i++) {
      if (i % STEP === 0 || i === images.length - 1) {
        keyframeIndices.push(i);
      } else {
        remainingIndices.push(i);
      }
    }
    
    // Track how many keyframes have completed loading
    let loadedKeyframesCount = 0;

    // 1. Load the critical keyframes first (covers start to end of the video)
    keyframeIndices.forEach((i) => {
      preloadedImagesList[i].onload = () => {
        loadedKeyframesCount++;
        // If this is the current frame or close to it, redraw
        if (
          currentFrameIdx.current === i || 
          Math.abs(currentFrameIdx.current - i) <= STEP / 2
        ) {
          drawFrame(currentFrameIdx.current);
        }

        // Once a critical threshold of keyframes is loaded (e.g. 5 keyframes), we can safely trigger the rest in background
        if (loadedKeyframesCount === 5) {
          startBackgroundLoading();
        }
      };
      preloadedImagesList[i].onerror = () => {
        loadedKeyframesCount++;
        if (loadedKeyframesCount === 5) {
          startBackgroundLoading();
        }
      };
      preloadedImagesList[i].src = images[i];
    });

    // 2. Load the remaining frames sequentially in background
    let bgStarted = false;
    function startBackgroundLoading() {
      if (bgStarted) return;
      bgStarted = true;

      let currentIndex = 0;
      function loadNextBg() {
        if (currentIndex >= remainingIndices.length) return;
        const i = remainingIndices[currentIndex];
        const img = preloadedImagesList[i];
        const src = images[i];

        img.onload = () => {
          if (currentFrameIdx.current === i) {
            drawFrame(i);
          }
          currentIndex++;
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            window.requestIdleCallback(() => loadNextBg());
          } else {
            setTimeout(loadNextBg, 15);
          }
        };

        img.onerror = () => {
          currentIndex++;
          loadNextBg();
        };

        img.src = src;
      }

      // Start the background loader
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => loadNextBg());
      } else {
        setTimeout(loadNextBg, 100);
      }
    }

    // Safety fallback: if background loading hasn't started after 1.5 seconds, start it anyway
    const safetyTimeout = setTimeout(() => {
      startBackgroundLoading();
    }, 1500);

    imagesRef.current = preloadedImagesList;
    setIsPreloaded(true);

    return () => {
      clearTimeout(safetyTimeout);
    };
  }, [images, drawFrame]);

  // Window Resize handler
  useEffect(() => {
    if (!isPreloaded) return;

    const handleResize = () => {
      const c1 = canvasRef.current;
      const c2 = smokeCanvasRef.current;
      if (c1 && c2) {
        c1.width = window.innerWidth;
        c1.height = window.innerHeight;
        c2.width = window.innerWidth;
        c2.height = window.innerHeight;
        drawFrame(currentFrameIdx.current);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [isPreloaded, drawFrame]);

  // High-performance GSAP ScrollTrigger timeline (No React state changes on scroll)
  useEffect(() => {
    if (!isPreloaded || imagesRef.current.length === 0) return;

    gsap.registerPlugin(ScrollTrigger);

    const totalFrames = imagesRef.current.length;

    // Draw first frame
    drawFrame(0);

    // Initial setup for GSAP properties
    gsap.set(canvasRef.current, { scale: 1.0 });
    gsap.set(overlayRef.current, { opacity: 0.95 });
    gsap.set(vignetteRef.current, { opacity: 0.90 });
    
    gsap.set(phase1Ref.current, { opacity: 1, y: 0, display: 'flex' });
    gsap.set(hud23Ref.current, { opacity: 0, display: 'none' });
    gsap.set(hud23ProgressRef.current, { scaleX: 0, transformOrigin: 'left' });
    gsap.set(hud4Ref.current, { opacity: 0, display: 'none' });
    
    gsap.set(card1Ref.current, { opacity: 0, x: -80, y: -80 });
    gsap.set(card2Ref.current, { opacity: 0, x: 80, y: -80 });
    gsap.set(card3Ref.current, { opacity: 0, x: -90, y: 90 });
    gsap.set(card4Ref.current, { opacity: 0, x: 90, y: 90 });
    gsap.set(mobileStatsRef.current, { opacity: 0, display: 'none' });
    gsap.set(finalBrandingRef.current, { opacity: 0, scale: 0.95, display: 'none' });

    // Create normalized scroll-scrubbed timeline (duration 1.0 mapping to progress 0.0 -> 1.0)
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        pin: stickyRef.current,
        scrub: 0.15, // Smooth scrubbing to absorb scroll jitters
        onUpdate: (self) => {
          const progress = self.progress;
          scrollProgress.current = progress;

          // Map progress directly to image frames
          const frameIdx = Math.min(
            totalFrames - 1,
            Math.floor(progress * totalFrames)
          );
          
          if (currentFrameIdx.current !== frameIdx) {
            currentFrameIdx.current = frameIdx;
            drawFrame(frameIdx);
          }

          // Direct text node manipulation (no React re-renders)
          if (hud4TextRef.current) {
            hud4TextRef.current.textContent = `FRAME ${frameIdx + 1} / ${totalFrames}`;
          }
        }
      }
    });

    // ─── Timeline Animations mapped normalized 0.0 to 1.0 ───

    // 1. Zoom Canvas (progress 0.15 to 0.80)
    tl.to(canvasRef.current, {
      scale: 1.18,
      force3D: true,
      ease: 'none',
      duration: 0.65
    }, 0.15);

    // 2. Black Overlay (Brightness fade-in from dark, progress 0.15 -> 0.35 -> 0.55)
    tl.to(overlayRef.current, {
      opacity: 0.20,
      ease: 'power1.out',
      duration: 0.20
    }, 0.15);

    tl.to(overlayRef.current, {
      opacity: 0.05,
      ease: 'power1.inOut',
      duration: 0.20
    }, 0.35);

    // 3. Vignette (adjust opacity over start phase)
    tl.to(vignetteRef.current, {
      opacity: 0.70,
      ease: 'none',
      duration: 0.15
    }, 0.0);

    // 4. Phase 1 Text (0.0 to 0.15)
    tl.to(phase1Ref.current, {
      opacity: 0,
      y: -50,
      ease: 'power1.out',
      duration: 0.15
    }, 0.0);
    tl.set(phase1Ref.current, { display: 'none' }, 0.15);

    // 5. Phase 2 & 3 HUD (0.15 to 0.55)
    tl.set(hud23Ref.current, { display: 'block' }, 0.15);
    tl.to(hud23Ref.current, {
      opacity: 1,
      ease: 'power1.in',
      duration: 0.05
    }, 0.15);
    
    tl.to(hud23ProgressRef.current, {
      scaleX: 1,
      ease: 'none',
      duration: 0.40
    }, 0.15);

    // Text labels swaps inside scroll timeline (GSAP triggers on forward/backward scrub)
    tl.call(() => {
      if (hud23TextRef.current) {
        hud23TextRef.current.textContent = 'STRUCTURE FORMING · CHEST & SHOULDERS';
      }
    }, [], 0.15);

    tl.call(() => {
      if (hud23TextRef.current) {
        hud23TextRef.current.textContent = 'MUTATION STAGE · DEFINITION MAXIMIZING';
      }
    }, [], 0.35);

    tl.to(hud23Ref.current, {
      opacity: 0,
      ease: 'power1.out',
      duration: 0.05
    }, 0.50);
    tl.set(hud23Ref.current, { display: 'none' }, 0.55);

    // 6. Phase 4 HUD (0.55 to 0.80)
    tl.set(hud4Ref.current, { display: 'block' }, 0.55);
    tl.to(hud4Ref.current, {
      opacity: 1,
      ease: 'power1.in',
      duration: 0.05
    }, 0.55);

    tl.to(hud4Ref.current, {
      opacity: 0,
      ease: 'power1.out',
      duration: 0.05
    }, 0.75);
    tl.set(hud4Ref.current, { display: 'none' }, 0.80);

    // 7. Phase 5 & 6 Glass Cards (0.80 to 0.95)
    tl.to([card1Ref.current, card2Ref.current, card3Ref.current, card4Ref.current], {
      opacity: 1,
      x: 0,
      y: 0,
      stagger: 0.02,
      ease: 'back.out(1.2)',
      duration: 0.15
    }, 0.80);

    // 8. Phase 6 Final Branding & Mobile Stats (0.90 to 1.00)
    tl.set([finalBrandingRef.current, mobileStatsRef.current], { display: 'block' }, 0.90);
    tl.to([finalBrandingRef.current, mobileStatsRef.current], {
      opacity: 1,
      scale: 1,
      ease: 'power2.out',
      duration: 0.10
    }, 0.90);

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [isPreloaded, drawFrame]);

  // Smoke particles animation loop
  useEffect(() => {
    if (!isPreloaded) return;

    let animId: number;

    const animateParticles = () => {
      const canvas = smokeCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) {
        animId = requestAnimationFrame(animateParticles);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const p = scrollProgress.current;
      if (p > 0.88) {
        const intensity = Math.min(1, (p - 0.88) * 8.33);
        
        // Emit particles
        if (Math.random() < 0.25 * intensity) {
          particles.current.push({
            x: Math.random() * canvas.width,
            y: canvas.height + 30,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -Math.random() * 2.0 - 0.8,
            size: Math.random() * 30 + 15,
            alpha: Math.random() * 0.12 * intensity,
            life: 0,
            maxLife: Math.random() * 120 + 80
          });
        }
      }

      // Update & Draw particles
      particles.current = particles.current.filter(item => {
        item.life++;
        item.x += item.vx;
        item.y += item.vy;
        item.size += 0.2;

        const ageRatio = item.life / item.maxLife;
        const currentAlpha = item.alpha * (1 - ageRatio);

        if (currentAlpha > 0 && item.life < item.maxLife) {
          ctx.beginPath();
          const grad = ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, item.size);
          grad.addColorStop(0, `rgba(255, 94, 20, ${currentAlpha * 0.45})`);
          grad.addColorStop(0.3, `rgba(245, 158, 11, ${currentAlpha * 0.2})`);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = grad;
          ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2);
          ctx.fill();
          return true;
        }
        return false;
      });

      animId = requestAnimationFrame(animateParticles);
    };

    animateParticles();

    return () => cancelAnimationFrame(animId);
  }, [isPreloaded]);

  return (
    <>
      {/* ─── STATIC FALLBACK HERO (shown when frames are not loaded / Vercel offline) ─── */}
      {framesAvailable === false && (
        <div
          className="relative h-screen w-full flex items-center justify-center overflow-hidden bg-slate-950"
          style={{
            backgroundImage: "url('/gym_images/Best Gym in Mohali.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90 z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,94,20,0.15)_0%,transparent_60%)] z-10 pointer-events-none" />

          <div className="relative z-20 text-center px-6 space-y-6 max-w-4xl mx-auto">
            <span className="inline-flex items-center gap-2 bg-[#FF5E14]/15 text-[#FF5E14] text-[9px] font-extrabold px-5 py-2 rounded-full uppercase tracking-[0.25em] border border-[#FF5E14]/40 backdrop-blur-md shadow-[0_0_20px_rgba(255,94,20,0.25)]">
              <span className="w-2 h-2 rounded-full bg-[#FF5E14] animate-pulse" />
              THE WARRIOR GYM — SECTOR 89, MOHALI
            </span>

            <h1 className="font-rowdies text-5xl md:text-8xl font-bold tracking-tight text-white uppercase leading-none">
              Sculpt Your <span className="text-[#FF5E14] drop-shadow-[0_0_25px_rgba(255,94,20,0.5)]">Body</span>
            </h1>
            <h2 className="font-rowdies text-3xl md:text-5xl font-bold tracking-wide text-slate-200 uppercase leading-none">
              Elevate Your <span className="text-white border-b-4 border-[#FF5E14] pb-1">Spirit</span>
            </h2>

            <p className="text-slate-300 text-xs md:text-sm font-mono tracking-widest uppercase">
              Premium Strength · Expert Coaches · Smart Programming
            </p>

            <div className="flex justify-center gap-4 pt-4">
              <a
                href="#signup"
                className="bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white font-rowdies font-bold text-xs tracking-wider px-8 py-4 rounded-full hover:shadow-[0_0_30px_rgba(255,94,20,0.6)] hover:scale-105 transition-all shadow-[0_4px_20px_rgba(255,94,20,0.35)]"
              >
                JOIN NOW →
              </a>
              <a
                href="#gallery"
                className="border-2 border-white/30 text-white font-bold text-xs tracking-wider px-8 py-4 rounded-full hover:border-[#FF5E14] hover:text-[#FF5E14] transition-all bg-white/5"
              >
                TAKE THE TOUR
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─── PINNED HIGH-PERFORMANCE CANVAS SCROLL SECTION ─── */}
      {framesAvailable !== false && (
        <div ref={containerRef} className="relative h-[650vh] bg-slate-950">
          <div ref={stickyRef} className="relative h-screen w-full overflow-hidden flex items-center justify-center z-10">
            
            {/* Canvas for images (only uses scale transform which is GPU hardware-accelerated) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover z-0 origin-center will-change-transform"
              style={{ transform: 'scale(1) translate3d(0,0,0)' }}
            />

            {/* Black Overlay replacing expensive CSS brightness/contrast filters */}
            <div
              ref={overlayRef}
              className="absolute inset-0 bg-black z-1 pointer-events-none will-change-opacity"
              style={{ opacity: 0.95 }}
            />

            {/* Particle Canvas */}
            <canvas
              ref={smokeCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
            />

            {/* Spotlight Glow Overlay */}
            <div className="absolute inset-0 z-15 bg-[radial-gradient(circle_at_center,rgba(255,94,20,0.22)_0%,transparent_60%)] mix-blend-screen pointer-events-none opacity-40" />

            {/* Vignette Overlay */}
            <div
              ref={vignetteRef}
              className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90 z-5 pointer-events-none will-change-opacity"
              style={{ opacity: 0.90 }}
            />

            {/* ─── TYPOGRAPHY & HUD OVERLAYS ─── */}

            {/* Section 1 Overlay */}
            <div
              ref={phase1Ref}
              className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-20 pointer-events-none"
              style={{ display: 'flex' }}
            >
              <span className="inline-flex items-center gap-2 bg-[#FF5E14]/15 text-[#FF5E14] text-[9px] font-extrabold px-5 py-2 rounded-full uppercase tracking-[0.25em] border border-[#FF5E14]/40 backdrop-blur-md shadow-[0_0_20px_rgba(255,94,20,0.25)] mb-6">
                <span className="w-2 h-2 rounded-full bg-[#FF5E14] animate-pulse" />
                SCROLL DOWN TO INITIATE EXPERIENCE
              </span>
              
              <h1 className="font-rowdies text-5xl md:text-8xl font-bold tracking-tight text-white uppercase leading-none">
                Sculpt Your <span className="text-[#FF5E14] drop-shadow-[0_0_25px_rgba(255,94,20,0.5)]">Body</span>
              </h1>
              
              <h2 className="font-rowdies text-3xl md:text-5xl font-bold tracking-wide text-slate-200 uppercase leading-none mt-4">
                Elevate Your <span className="text-white border-b-4 border-[#FF5E14] pb-1">Spirit</span>
              </h2>
              
              <p className="text-slate-400 text-xs md:text-sm font-mono tracking-widest mt-8 uppercase animate-pulse">
                [ The body emerges step by step ]
              </p>
            </div>

            {/* Section 2 & 3 HUD */}
            <div
              ref={hud23Ref}
              className="absolute top-28 left-6 md:left-12 z-20 text-left pointer-events-none font-mono"
              style={{ display: 'none', opacity: 0 }}
            >
              <div className="text-[10px] text-[#FF5E14] uppercase tracking-[0.2em] font-bold">EMERGENCE IN PROGRESS</div>
              <div className="h-[2px] bg-[#FF5E14]/30 w-32 mt-1.5 overflow-hidden">
                <div ref={hud23ProgressRef} className="h-full bg-[#FF5E14]" style={{ width: '100%', transform: 'scaleX(0)', transformOrigin: 'left' }} />
              </div>
              <div ref={hud23TextRef} className="text-[9px] text-slate-400 mt-2 uppercase">
                STRUCTURE FORMING · CHEST & SHOULDERS
              </div>
            </div>

            {/* Section 4 HUD */}
            <div
              ref={hud4Ref}
              className="absolute bottom-16 right-6 md:right-12 z-20 text-right pointer-events-none font-mono"
              style={{ display: 'none', opacity: 0 }}
            >
              <div className="text-[10px] text-[#FF5E14] uppercase tracking-[0.2em] font-bold">CINEMATIC SCROLL STREAMING</div>
              <div ref={hud4TextRef} className="text-xs text-white mt-1">FRAME 1 / 240</div>
              <div className="text-[8px] text-slate-500 mt-1 uppercase">SCROLL PROGRESS MAPPED TO PERFORMANCE TIME</div>
            </div>

            {/* Section 5 & 6 HUD (Glass Cards) */}
            <div className="absolute inset-0 z-20 pointer-events-none hidden md:block">
              {/* Hours (Top-Left) */}
              <div ref={card1Ref} className="absolute top-[35%] left-[22%]">
                <GlassCard
                  icon={<Clock className="text-[#FF5E14] w-5 h-5" />}
                  title="ACTIVE HOURS"
                  value="250+ Hours"
                />
              </div>

              {/* Calories (Top-Right) */}
              <div ref={card2Ref} className="absolute top-[35%] right-[22%]">
                <GlassCard
                  icon={<Flame className="text-amber-500 w-5 h-5" />}
                  title="DAILY BURN"
                  value="850 Kcal"
                />
              </div>

              {/* Sets (Bottom-Left) */}
              <div ref={card3Ref} className="absolute bottom-[35%] left-[22%]">
                <GlassCard
                  icon={<Dumbbell className="text-orange-400 w-5 h-5" />}
                  title="COMPLETED SETS"
                  value="12 Sets"
                />
              </div>

              {/* Poses (Bottom-Right) */}
              <div ref={card4Ref} className="absolute bottom-[35%] right-[22%]">
                <GlassCard
                  icon={<Sparkles className="text-amber-300 w-5 h-5" />}
                  title="YOGA POSES"
                  value="36 Poses"
                />
              </div>
            </div>

            {/* Mobile Stats Hud */}
            <div 
              ref={mobileStatsRef}
              className="absolute bottom-28 left-0 right-0 z-20 px-6 block md:hidden max-w-sm mx-auto pointer-events-auto"
              style={{ display: 'none', opacity: 0 }}
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900/70 border border-white/10 backdrop-blur-md p-2 rounded-xl flex items-center gap-2">
                  <Clock className="text-[#FF5E14] w-4 h-4" />
                  <div className="text-left">
                    <div className="text-[7px] text-slate-400 uppercase">HOURS</div>
                    <div className="text-[10px] font-black text-white">250+ Hrs</div>
                  </div>
                </div>
                <div className="bg-slate-900/70 border border-white/10 backdrop-blur-md p-2 rounded-xl flex items-center gap-2">
                  <Flame className="text-amber-500 w-4 h-4" />
                  <div className="text-left">
                    <div className="text-[7px] text-slate-400 uppercase">BURN</div>
                    <div className="text-[10px] font-black text-white">850 Kcal</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Final reveal typography */}
            <div
              ref={finalBrandingRef}
              className="absolute inset-0 flex flex-col items-center justify-center z-25 pointer-events-none text-center px-6"
              style={{ display: 'none', opacity: 0 }}
            >
              <div className="space-y-4 z-20 pt-8">
                <span className="inline-flex items-center gap-2 bg-[#FF5E14]/20 text-[#FF5E14] text-[9px] font-extrabold px-6 py-2 rounded-full uppercase tracking-[0.3em] border border-[#FF5E14]/40 shadow-[0_0_20px_rgba(255,94,20,0.35)]">
                  WARRIOR GYM OS
                </span>
                
                <h1 className="font-rowdies text-5xl md:text-8xl font-bold tracking-tight text-white uppercase leading-none drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                  LIMITLESS <span className="text-[#FF5E14] drop-shadow-[0_0_25px_rgba(255,94,20,0.5)]">POWER</span>
                </h1>
                
                <p className="text-slate-300 text-xs md:text-sm font-mono tracking-widest max-w-md mx-auto uppercase">
                  The athlete has fully emerged. Sculpting physical limits.
                </p>

                <div className="pt-4 pointer-events-auto flex justify-center gap-4">
                  <a
                    href="#signup"
                    className="bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white font-rowdies font-bold text-xs tracking-wider px-8 py-4 rounded-full hover:shadow-[0_0_30px_rgba(255,94,20,0.6)] hover:scale-105 transition-all shadow-[0_4px_20px_rgba(255,94,20,0.35)]"
                  >
                    FITNESS NOW
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

// Sub-component: Glassmorphic stats card
interface GlassCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
}

function GlassCard({ icon, title, value }: GlassCardProps) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex gap-4 min-w-[180px] items-center shadow-[0_30px_60px_rgba(0,0,0,0.6)] border-[#FF5E14]/20 hover:border-[#FF5E14]/50 transition-all">
      <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 shadow-inner shrink-0">
        {icon}
      </div>
      <div className="text-left min-w-0">
        <div className="text-[7.5px] font-black text-slate-400 tracking-[0.15em] uppercase truncate">{title}</div>
        <div className="text-sm font-extrabold text-white tracking-tight leading-none mt-1">{value}</div>
      </div>
    </div>
  );
}
