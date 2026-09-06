'use client';
import React from 'react';
import Image from 'next/image';
import PageLayout from '../../components/PageLayout';
import { motion } from 'framer-motion';
import { getGymImage } from '../../lib/gymImages';
import { 
  Dumbbell, Target, Heart, Flame, Zap, Shield, Smartphone, 
  ArrowRight, CheckCircle2, Award, Activity, Search, ShieldCheck 
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.08 } }),
};

const disciplines = [
  { 
    title: 'Strength Training', 
    desc: 'Free weights, power racks, plate-loaded machines and everything you need to build serious strength.',
    icon: Dumbbell,
    imgCat: 'strength' as const,
    imgIdx: 0
  },
  { 
    title: 'Cardio & Conditioning', 
    desc: 'Premium treadmills, rowers, bikes and ski ergs for endurance, fat loss and heart health.',
    icon: Activity,
    imgCat: 'cardio' as const,
    imgIdx: 0
  },
  { 
    title: 'Personal Training', 
    desc: '1-on-1 coaching built around your body, goals and schedule — with accountability built in.',
    icon: Target,
    imgCat: 'trainers' as const,
    imgIdx: 0
  },
  { 
    title: 'CrossFit & Functional', 
    desc: 'High-intensity functional training in a dedicated box — barbells, ropes, boxes and grit.',
    icon: Flame,
    imgCat: 'functional' as const,
    imgIdx: 0
  },
  { 
    title: 'Group Classes', 
    desc: 'HIIT, strength, mobility and athletic conditioning classes led by expert coaches.',
    icon: Award,
    imgCat: 'gallery' as const,
    imgIdx: 0
  },
  { 
    title: 'Sports Performance', 
    desc: 'Speed, agility, power and mobility programmes for competitive athletes.',
    icon: Zap,
    imgCat: 'hero' as const,
    imgIdx: 1
  },
  { 
    title: 'Nutrition Coaching', 
    desc: 'Personalised nutrition plans and ongoing check-ins to fuel training and recovery.',
    icon: Heart,
    imgCat: 'reception' as const,
    imgIdx: 1
  },
  { 
    title: 'Injury Rehabilitation', 
    desc: 'Physio-led recovery and prehab protocols to keep you training strong and pain-free.',
    icon: Shield,
    imgCat: 'about' as const,
    imgIdx: 1
  },
  { 
    title: 'Body Transformation', 
    desc: '12-week transformation programmes that combine training, nutrition and tracking for real results.',
    icon: ShieldCheck,
    imgCat: 'cta' as const,
    imgIdx: 0
  }
];

const journeySteps = [
  { step: '01', title: 'Assessment', desc: 'Book a free fitness assessment to understand your goals, baseline and movement.' },
  { step: '02', title: 'Programme', desc: 'We design a personalised plan that matches your goals, schedule and experience.' },
  { step: '03', title: 'Train', desc: 'Show up and train under expert coaches in a facility built for performance.' },
  { step: '04', title: 'Optimise', desc: 'Track progress, adjust training and keep breaking through with regular check-ins.' }
];

const amenities = [
  { title: 'Open 7 Days', desc: 'Early morning to late evening sessions.', icon: Award },
  { title: 'Premium Equipment', desc: 'Imported strength and cardio machines.', icon: Dumbbell },
  { title: 'Locker Rooms', desc: 'Clean, secure lockers with showers.', icon: ShieldCheck },
  { title: 'Recovery Zone', desc: 'Foam rollers, stretching and recovery tools.', icon: Activity }
];

export default function ServicesPage() {
  const heroImg = getGymImage('services');
  const detailsImg = getGymImage('equipment');
  const appImg = getGymImage('mobile_app');
  const ctaImg = getGymImage('cta');

  return (
    <PageLayout>
      <div className="bg-[#FAFAFA] text-slate-900 font-poppins">

        {/* Hero Section */}
        <section className="relative min-h-[75vh] flex items-center justify-center overflow-hidden bg-white border-b border-slate-100">
          <div className="absolute inset-0">
            <Image src={heroImg.src} alt={heroImg.alt} fill className="object-cover opacity-10" priority sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-8 py-20">
            <motion.span initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="inline-block text-xs font-black text-[#FF5E14] tracking-widest uppercase border border-orange-200 px-5 py-2.5 rounded-full bg-orange-50 shadow-sm">
              TRAINING SERVICES // CORE DISCIPLINES
            </motion.span>
            
            <motion.h1 initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none text-slate-900">
              Train Every Discipline.<br />
              <span className="text-[#FF5E14]">Under One Roof.</span>
            </motion.h1>
            
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }} className="text-slate-600 text-base md:text-xl leading-relaxed max-w-3xl mx-auto font-light">
              From strength and conditioning to CrossFit, personal training and recovery — every service at The Warrior Gym is designed to deliver measurable results.
            </motion.p>
          </div>
        </section>

        {/* Section 1: Complete Training Ecosystem */}
        <section className="py-24 bg-[#F8FAFC] border-b border-slate-200/80 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">DISCIPLINE MENU</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">A Complete Training Ecosystem</h2>
              <div className="w-20 h-1 bg-[#FF5E14] mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {disciplines.map((item, i) => {
                const img = getGymImage(item.imgCat, item.imgIdx);
                return (
                  <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                    className="relative bg-white border border-slate-200/80 rounded-3xl overflow-hidden group shadow-sm hover:border-orange-300 hover:shadow-[0_12px_30px_rgba(255,94,20,0.12)] transition-all text-left flex flex-col justify-between"
                  >
                    <div className="relative h-48 overflow-hidden bg-slate-900">
                      <Image src={img.src} alt={img.alt} fill className="object-cover group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-90" sizes="(max-width: 768px) 100vw, 33vw" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    </div>
                    <div className="p-8 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-50 border border-orange-200/80 rounded-xl flex items-center justify-center text-[#FF5E14] group-hover:bg-[#FF5E14] group-hover:text-white transition-all">
                            <item.icon size={18} />
                          </div>
                          <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">{item.title}</h3>
                        </div>
                        <p className="text-slate-600 text-xs leading-relaxed font-poppins">{item.desc}</p>
                      </div>
                      <div className="pt-4 flex items-center gap-1.5 text-[10px] font-black uppercase text-[#FF5E14] opacity-0 group-hover:opacity-100 transition-opacity">
                        Learn More <ArrowRight size={10} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Section 2: Your Journey. Simplified. */}
        <section className="py-24 bg-white border-b border-slate-100 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">THE ROADMAP</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">Your Journey. Simplified.</h2>
              <div className="w-20 h-1 bg-[#FF5E14] mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {journeySteps.map((item, i) => (
                <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="bg-[#FAFAFA] border border-slate-200/80 p-8 rounded-3xl text-left space-y-4 relative group shadow-sm hover:border-orange-300 hover:shadow-[0_10px_25px_rgba(255,94,20,0.1)] transition-all"
                >
                  <div className="text-5xl font-black text-orange-200/80 group-hover:text-orange-400 transition-colors font-mono">{item.step}</div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{item.title}</h3>
                  <p className="text-slate-600 font-poppins text-xs leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Science-Backed. Coach-Led. */}
        <section className="py-24 bg-[#F8FAFC] border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-8 text-left">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">METHODOLOGY</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight text-slate-900">
                Science-Backed.<br />
                <span className="text-[#FF5E14]">Coach-Led.</span>
              </h2>
              <div className="w-16 h-1 bg-[#FF5E14] rounded-full" />
              <p className="text-slate-600 font-poppins text-sm md:text-base leading-relaxed">
                Every programme at The Warrior Gym is built on proven training principles — progressive overload, individualised coaching, and consistent feedback loops. You don&apos;t just train harder. You train smarter.
              </p>

              <div className="space-y-4 font-poppins text-xs font-semibold">
                {[
                  'Periodised programming for steady progress',
                  'Certified coaches with real athletic experience',
                  'Regular body composition and performance tracking',
                  'Nutrition and recovery support built into every plan'
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-3 text-slate-800">
                    <CheckCircle2 size={16} className="text-[#FF5E14] shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right Image Frame */}
            <motion.div custom={0.2} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="relative justify-self-center lg:justify-self-end w-full max-w-[500px]">
              <div className="relative rounded-[32px] overflow-hidden border border-orange-200/60 shadow-xl bg-slate-900 h-[480px]">
                <Image src={detailsImg.src} alt={detailsImg.alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-10" />
              </div>
              <div className="absolute -inset-2 border border-dashed border-orange-300/40 rounded-[34px] -z-10 pointer-events-none" />
            </motion.div>
          </div>
        </section>

        {/* Section 4: Everything You Need. */}
        <section className="py-24 bg-white border-b border-slate-100 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">FACILITIES</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">Everything You Need.</h2>
              <div className="w-20 h-1 bg-[#FF5E14] mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {amenities.map((item, i) => (
                <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="bg-[#FAFAFA] border border-slate-200/80 p-8 rounded-3xl text-left space-y-4 group shadow-sm hover:border-orange-300 hover:shadow-[0_10px_25px_rgba(255,94,20,0.1)] transition-all"
                >
                  <div className="w-12 h-12 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-center text-[#FF5E14] group-hover:bg-[#FF5E14] group-hover:text-white transition-all">
                    <item.icon size={20} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">{item.title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed font-poppins">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Find Your Perfect Service. (CTA) */}
        <section className="py-24 bg-gradient-to-br from-orange-500 via-[#FF5E14] to-[#EA580C] text-white relative overflow-hidden shadow-xl">
          <div className="absolute inset-0">
            <Image src={ctaImg.src} alt={ctaImg.alt} fill className="object-cover opacity-10 mix-blend-overlay" sizes="100vw" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
            <span className="text-xs font-black text-white/80 tracking-widest uppercase">GET STARTED</span>
            <h2 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tighter">
              Find Your Perfect<br />
              <span className="text-white drop-shadow-md">Programme.</span>
            </h2>
            <div className="w-20 h-1 bg-white mx-auto rounded-full" />
            <p className="text-white/90 max-w-xl mx-auto font-poppins text-sm md:text-base leading-relaxed">
              Book your free assessment and let our coaches match you with the right programme.
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
