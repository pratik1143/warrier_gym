'use client';
import React from 'react';
import Image from 'next/image';
import PageLayout from '../../components/PageLayout';
import { motion } from 'framer-motion';
import { getGymImage } from '../../lib/gymImages';
import { 
  Dumbbell, Target, Brain, Shield, Users, Heart, Star, Award, 
  ArrowRight, ShieldCheck, Zap, Smartphone, CheckCircle2 
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.1 } }),
};

export default function AboutPage() {
  const heroImg = getGymImage('hero');
  const storyImg = getGymImage('about');
  const standardImg = getGymImage('strength');
  const appImg = getGymImage('mobile_app');
  const ctaImg = getGymImage('cta');

  return (
    <PageLayout>
      <div className="bg-[#FAFAFA] text-slate-900 font-poppins">

        {/* Hero Section */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-white border-b border-slate-100">
          <div className="absolute inset-0">
            <Image src={heroImg.src} alt={heroImg.alt} fill className="object-cover opacity-10" priority sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-8 py-20">
            <motion.span initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="inline-block text-xs font-black text-[#FF5E14] tracking-widest uppercase border border-orange-200 px-5 py-2.5 rounded-full bg-orange-50 shadow-sm">
              EST. 2014 // WARRIOR PERFORMANCE LAB
            </motion.span>
            
            <motion.h1 initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none text-slate-900">
              Built For Athletes.<br />
              <span className="text-[#FF5E14]">Driven By Results.</span>
            </motion.h1>
            
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }} className="text-slate-600 text-base md:text-xl leading-relaxed max-w-3xl mx-auto font-light">
              The Warrior Gym was founded on one simple idea — every body has another level. We built a facility, a culture and a coaching system to help you find it.
            </motion.p>
            
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <a href="/packages" className="bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white font-extrabold text-xs tracking-wider uppercase px-10 py-4 rounded-full hover:shadow-[0_8px_25px_rgba(255,94,20,0.4)] hover:scale-105 transition-all shadow-[0_4px_15px_rgba(255,94,20,0.25)]">
                View Packages
              </a>
              <a href="/contact" className="border-2 border-slate-300 hover:border-[#FF5E14] text-slate-700 hover:text-[#FF5E14] font-bold text-xs tracking-wider uppercase px-10 py-4 rounded-full transition-all bg-white shadow-sm">
                Contact Us
              </a>
            </motion.div>
          </div>
        </section>

        {/* Section 1: Our Story */}
        <section className="py-24 bg-[#F8FAFC] border-b border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            {/* Left Image Frame */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative">
              <div className="relative rounded-[32px] overflow-hidden border border-orange-200/60 shadow-xl bg-slate-900 h-[480px]">
                <Image src={storyImg.src} alt={storyImg.alt} fill className="object-cover hover:scale-105 transition-transform duration-700" sizes="(max-width: 768px) 100vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-10" />
                <div className="absolute bottom-6 left-6 bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl flex items-center gap-2 z-10 shadow-lg">
                  <Zap size={12} /> Elite Training Culture
                </div>
              </div>
              <div className="absolute -inset-2 border-2 border-dashed border-orange-300/40 rounded-[36px] -z-10 pointer-events-none" />
            </motion.div>

            {/* Right Content */}
            <motion.div custom={0.25} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-8 text-left">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">OUR ORIGINS</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight text-slate-900">
                From Garage Setup<br />
                <span className="text-[#FF5E14]">To Performance Destination.</span>
              </h2>
              <div className="w-16 h-1 bg-[#FF5E14] rounded-full" />
              <div className="space-y-6 text-slate-600 font-poppins text-sm md:text-base leading-relaxed">
                <p>
                  What started as a small training space for serious lifters has grown into one of the most respected strength and performance gyms in the region. Every plate, every rack and every coach was chosen with one purpose — to make athletes better.
                </p>
                <p>
                  Today, The Warrior Gym serves thousands of members across all levels — from first-time gym-goers to competitive lifters and CrossFit athletes — all training under one roof, one culture, one standard.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Section 2: Our Mission & Values */}
        <section className="py-24 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">PHILOSOPHY</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">Our Mission &amp; Values</h2>
              <div className="w-20 h-1 bg-[#FF5E14] mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {[
                { 
                  label: 'Mission', 
                  title: 'World-Class Training Accessibility', 
                  desc: 'To make world-class training accessible — pairing premium equipment with expert coaching for measurable results.', 
                  icon: Target,
                },
                { 
                  label: 'Vision', 
                  title: 'The Most Respected Community', 
                  desc: 'To build the most respected fitness community in the country, defined by discipline, results and culture.', 
                  icon: Star,
                },
                { 
                  label: 'Values', 
                  title: 'Standards of Performance', 
                  desc: 'Discipline. Integrity. Performance. Community. The four standards that shape every session on our floor.', 
                  icon: Heart,
                }
              ].map((item, i) => (
                <motion.div key={i} custom={i * 0.1} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="bg-[#FAFAFA] border border-slate-200/80 p-8 rounded-3xl text-left space-y-6 relative overflow-hidden group shadow-sm hover:border-orange-300 hover:shadow-[0_12px_30px_rgba(255,94,20,0.12)] transition-all"
                >
                  <div className="absolute top-6 right-6 text-orange-100 select-none tracking-wider text-5xl font-black">{item.label.toUpperCase()}</div>
                  <div className="w-12 h-12 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-center text-[#FF5E14] group-hover:bg-[#FF5E14] group-hover:text-white transition-all">
                    <item.icon size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-[#FF5E14] uppercase tracking-widest">{item.label}</span>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-1 mb-3">{item.title}</h3>
                    <p className="text-slate-600 font-poppins text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Not Just A Gym. A Standard. */}
        <section className="py-24 bg-[#F8FAFC] border-b border-slate-200/80 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-10 text-left">
              <div className="space-y-4">
                <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">THE STANDARD</span>
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">
                  Not Just A Gym.<br />
                  <span className="text-[#FF5E14]">A Standard.</span>
                </h2>
                <div className="w-16 h-1 bg-[#FF5E14] rounded-full" />
              </div>

              <div className="space-y-6 font-poppins">
                {[
                  { title: 'Premium Imported Equipment', desc: 'Every machine, plate and rack chosen for serious training.', color: 'border-l-4 border-[#FF5E14]' },
                  { title: 'Certified Expert Coaches', desc: "Programming and coaching from athletes who've done the work.", color: 'border-l-4 border-amber-500' },
                  { title: 'Proven Member Results', desc: 'Real transformations tracked, programmed and earned.', color: 'border-l-4 border-orange-400' },
                  { title: 'Culture Of Discipline', desc: 'A floor that pushes you forward — every single session.', color: 'border-l-4 border-slate-800' }
                ].map((item, idx) => (
                  <div key={idx} className={`pl-6 ${item.color} space-y-1 text-left`}>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">{item.title}</h4>
                    <p className="text-xs text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right Image Frame with overlay */}
            <motion.div custom={0.25} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative justify-self-center lg:justify-self-end w-full max-w-[500px]">
              <div className="relative rounded-[32px] overflow-hidden border border-orange-200/60 shadow-xl bg-slate-900 h-[500px]">
                <Image src={standardImg.src} alt={standardImg.alt} fill className="object-cover hover:scale-105 transition-transform duration-700" sizes="(max-width: 768px) 100vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-10" />
                <div className="absolute bottom-6 left-6 right-6 z-25 bg-white/95 border border-slate-200 p-5 rounded-2xl backdrop-blur-md flex items-center gap-4 text-left shadow-lg">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#FF5E14] shrink-0 border border-orange-200">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">VERIFIED QUALITY</div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">Rogue barbell racks, calibrated plates, and premium lifter platforms.</div>
                  </div>
                </div>
              </div>
              <div className="absolute -inset-2 border border-dashed border-orange-300/40 rounded-[34px] -z-10 pointer-events-none" />
            </motion.div>
          </div>
        </section>

        {/* Section 4: Your Gym. In Your Pocket. */}
        <section className="py-24 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Image Mockup representing the App */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="flex justify-center">
              <div className="relative">
                <div className="absolute -inset-4 bg-orange-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
                <div className="w-[300px] h-[610px] bg-[#0c0c0e] rounded-[48px] border-[10px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
                  {/* Speaker */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-800 rounded-b-2xl z-30 flex items-center justify-center">
                    <div className="w-8 h-1 bg-white/20 rounded-full" />
                  </div>
                  {/* Status Area */}
                  <div className="h-8 shrink-0" />
                  {/* App UI mockup */}
                  <div className="flex-1 bg-[#060608] overflow-hidden flex flex-col px-4 pt-4 pb-2 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 bg-gradient-to-br from-[#FF5E14] to-[#FF7A00] rounded-lg flex items-center justify-center text-white font-black text-[9px]">WG</div>
                        <div className="text-left">
                          <div className="text-[8px] font-bold text-white">The Warrior Gym</div>
                          <div className="text-[5px] text-[#FF5E14] font-black uppercase tracking-wider">MEMBER APP</div>
                        </div>
                      </div>
                      <div className="w-6 h-6 bg-slate-900 border border-white/10 rounded-lg flex items-center justify-center text-white text-[8px] font-bold">QR</div>
                    </div>
                    {/* Progress Card */}
                    <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3 text-left">
                      <div className="text-[6px] font-bold text-[#FF5E14] uppercase tracking-wider">Gold Membership</div>
                      <div className="text-[9px] font-bold text-white mt-0.5">Active Member Profile</div>
                      <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-[#FF5E14] rounded-full w-[74%]" /></div>
                      <div className="flex justify-between mt-1 text-[5px] text-slate-500"><span>97 days left</span><span className="text-[#FF5E14] font-bold">74% SPEED</span></div>
                    </div>
                    {/* App Feature Highlights preview */}
                    <div className="space-y-1.5 text-left">
                      {['Workout Tracking', 'Class Alerts', 'QR Check-in', 'Trainer Chat'].map((feat, i) => (
                        <div key={i} className="bg-slate-900/40 border border-white/5 rounded-lg p-2.5 flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-orange-500/15 flex items-center justify-center text-[#FF5E14] shrink-0">
                            <CheckCircle2 size={8} />
                          </div>
                          <span className="text-[8px] font-bold text-slate-300">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Bottom nav */}
                  <div className="h-10 bg-slate-900 border-t border-white/5 flex items-center justify-around px-2 shrink-0">
                    {['Home', 'Workouts', 'Logs', 'Support'].map((nav, i) => (
                      <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 0 ? 'text-[#FF5E14]' : 'text-slate-600'}`}>
                        <div className="w-3.5 h-3.5 rounded-full bg-current/10" />
                        <span className="text-[5px] font-bold uppercase">{nav}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Content */}
            <motion.div custom={0.25} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-8 text-left">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">MOBILE INTERACTION</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight text-slate-900">
                Your Gym.<br />
                <span className="text-[#FF5E14]">In Your Pocket.</span>
              </h2>
              <div className="w-16 h-1 bg-[#FF5E14] rounded-full" />
              <p className="text-slate-600 font-poppins text-sm md:text-base leading-relaxed">
                Track workouts, book classes, message your trainer and manage your membership — all from the The Warrior Gym app. Available on iOS and Android.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-poppins text-xs font-semibold">
                {['Workout Tracking', 'Class Alerts', 'QR Check-in', 'Trainer Chat'].map((feat, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-800">
                    <CheckCircle2 size={16} className="text-[#FF5E14] shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <a href="/app" className="bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white font-extrabold text-xs tracking-wider uppercase px-8 py-3.5 rounded-full hover:shadow-[0_8px_25px_rgba(255,94,20,0.4)] hover:scale-105 transition-all shadow-[0_4px_15px_rgba(255,94,20,0.25)] flex items-center justify-center gap-2">
                  <Smartphone size={14} /> Learn More
                </a>
                <div className="flex gap-2.5">
                  <a href="/app" className="border-2 border-slate-200 hover:border-slate-800 text-slate-700 font-bold text-xs tracking-wider uppercase px-6 py-3.5 rounded-full transition-all bg-white flex items-center gap-1.5 shadow-sm">
                    App Store
                  </a>
                  <a href="/app" className="border-2 border-slate-200 hover:border-[#FF5E14] text-slate-700 hover:text-[#FF5E14] font-bold text-xs tracking-wider uppercase px-6 py-3.5 rounded-full transition-all bg-white flex items-center gap-1.5 shadow-sm">
                    Google Play
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Section 5: Ready To Step Into The Zone? (CTA) */}
        <section className="py-24 bg-gradient-to-br from-orange-500 via-[#FF5E14] to-[#EA580C] text-white relative overflow-hidden shadow-xl">
          <div className="absolute inset-0">
            <Image src={ctaImg.src} alt={ctaImg.alt} fill className="object-cover opacity-10 mix-blend-overlay" sizes="100vw" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
            <span className="text-xs font-black text-white/80 tracking-widest uppercase">TAKE ACTION</span>
            <h2 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tighter">
              Ready To Step<br />
              <span className="text-white drop-shadow-md">Into The Zone?</span>
            </h2>
            <div className="w-20 h-1 bg-white mx-auto rounded-full" />
            <p className="text-white/90 max-w-xl mx-auto font-poppins text-sm md:text-base leading-relaxed">
              Book your free fitness assessment and see why thousands choose The Warrior Gym.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <a href="/packages" className="bg-white text-orange-600 font-extrabold text-sm px-10 py-4 rounded-full hover:bg-orange-50 transition-all shadow-xl hover:scale-105">
                View Packages →
              </a>
              <a href="/contact" className="border-2 border-white/60 hover:border-white text-white font-bold text-sm px-10 py-4 rounded-full transition-all hover:bg-white/10">
                Contact Us
              </a>
            </div>
          </div>
        </section>

      </div>
    </PageLayout>
  );
}
