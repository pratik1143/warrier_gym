'use client';
import React from 'react';
import Image from 'next/image';
import PageLayout from '../../components/PageLayout';
import { motion } from 'framer-motion';
import { getGymImage } from '../../lib/gymImages';
import { Award, ShieldCheck, Star, Sparkles, MessageSquare, Phone } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.1 } }),
};

const trainers = [
  {
    name: 'Arshpreet Singh',
    role: 'Head Coach & Strength Specialist',
    specialties: ['Powerlifting', 'Strength Training', 'Muscle Building'],
    certs: ['Certified Personal Trainer', 'Strength & Conditioning Coach'],
    bio: 'Helping you build strength, improve fitness, and achieve lasting results with expert coaching.',
    photo: '/dark_avatar.svg',
    rating: '5.0'
  },
  {
    name: 'Lovely Chaudhary',
    role: 'Fitness & Transformation Coach',
    specialties: ['Body Transformation', 'Weight Management', 'Functional Training'],
    certs: ['Certified Fitness Trainer', 'Nutrition Specialist'],
    bio: 'Helping you transform your body, improve fitness, and achieve lasting results with expert coaching.',
    photo: '/dark_avatar.svg',
    rating: '4.9'
  },
  {
    name: 'Sourav Kumar',
    role: 'Performance & Conditioning Coach',
    specialties: ['Athletic Performance', 'HIIT Training', 'Endurance Building'],
    certs: ['Certified Coach', 'Sports Performance Specialist'],
    bio: 'Helping you stay fit, build strength, and achieve lasting results with expert coaching.',
    photo: '/dark_avatar.svg',
    rating: '5.0'
  },
];

export default function TeamClient() {
  const heroImg = getGymImage('trainers');
  const ctaImg = getGymImage('cta');

  return (
    <PageLayout>
      <div className="bg-[#FAFAFA] text-slate-900 font-poppins">

        {/* Hero Section */}
        <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden bg-white border-b border-slate-100">
          <div className="absolute inset-0">
            <Image src={heroImg.src} alt={heroImg.alt} fill className="object-cover opacity-10" priority sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center space-y-8 py-20">
            <motion.span initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="inline-block text-xs font-black text-[#FF5E14] tracking-widest uppercase border border-orange-200 px-5 py-2.5 rounded-full bg-orange-50 shadow-sm">
              ELITE TRAINERS // RESULTS DRIVEN
            </motion.span>
            
            <motion.h1 initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none text-slate-900">
              Certified Fitness<br />
              <span className="text-[#FF5E14]">Trainers in Mohali.</span>
            </motion.h1>
            
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }} className="text-slate-600 text-base md:text-xl leading-relaxed max-w-3xl mx-auto font-light">
              Meet the experienced fitness trainers at The Warrior Gym. Get expert guidance for weight loss, muscle building, strength training, and overall fitness.
            </motion.p>
          </div>
        </section>

        {/* Trainers Grid Section */}
        <section className="py-24 bg-[#F8FAFC] border-b border-slate-200/80 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">THE COACHING STAFF</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">Meet Our Experts</h2>
              <div className="w-20 h-1 bg-[#FF5E14] mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
              {trainers.map((trainer, i) => (
                <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm hover:border-orange-300 hover:shadow-[0_12px_35px_rgba(255,94,20,0.12)] transition-all group text-left flex flex-col justify-between"
                >
                  {/* Trainer Image */}
                  <div className="relative h-72 w-full bg-slate-900 overflow-hidden">
                    <Image src={trainer.photo} alt={trainer.name} fill className="object-cover object-top group-hover:scale-105 transition-transform duration-700 opacity-90 group-hover:opacity-100" sizes="(max-width: 768px) 100vw, 33vw" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md border border-slate-200 px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                      <Star size={12} className="text-amber-500 fill-amber-500" />
                      <span className="text-[10px] font-black text-slate-900">{trainer.rating}</span>
                    </div>
                  </div>

                  {/* Trainer Bio */}
                  <div className="p-7 flex flex-col justify-between space-y-6 flex-1">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{trainer.name}</h3>
                        <p className="text-[10px] font-bold text-[#FF5E14] uppercase tracking-wider mt-0.5">{trainer.role}</p>
                      </div>

                      <p className="text-slate-600 font-poppins text-xs leading-relaxed">
                        {trainer.bio}
                      </p>

                      <div className="space-y-2">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Specialties</div>
                        <div className="flex flex-wrap gap-1.5">
                          {trainer.specialties.map((spec, idx) => (
                            <span key={idx} className="bg-orange-50/80 border border-orange-200/80 text-[9px] font-semibold text-[#FF5E14] px-2.5 py-1 rounded-full font-poppins">
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Certifications</div>
                        <div className="space-y-1">
                          {trainer.certs.map((cert, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-600 font-poppins">
                              <ShieldCheck size={12} className="text-[#FF5E14] shrink-0" />
                              <span>{cert}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <a href={`https://wa.me/919817023336?text=Hi! I am interested in personal training sessions with ${trainer.name}.`} target="_blank" rel="noopener noreferrer"
                        className="w-full bg-orange-50 border border-orange-200 hover:bg-gradient-to-r hover:from-[#FF5E14] hover:to-[#FF7A00] text-[#FF5E14] hover:text-white font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        <MessageSquare size={14} /> Book PT Session
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Trainer Consultation */}
        <section className="py-24 bg-gradient-to-br from-orange-500 via-[#FF5E14] to-[#EA580C] text-white relative overflow-hidden shadow-xl">
          <div className="absolute inset-0">
            <Image src={ctaImg.src} alt={ctaImg.alt} fill className="object-cover opacity-10 mix-blend-overlay" sizes="100vw" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
            <span className="text-xs font-black text-white/80 tracking-widest uppercase">TRAIN SMART</span>
            <h2 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tighter">
              Get A Custom<br />
              <span className="text-white drop-shadow-md">Workout Plan.</span>
            </h2>
            <div className="w-20 h-1 bg-white mx-auto rounded-full" />
            <p className="text-white/90 max-w-xl mx-auto font-poppins text-sm md:text-base leading-relaxed">
              Book a session with one of our certified trainers and build a customized workout and nutrition plan built exactly for your schedule and genetics.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <a href="/contact" className="bg-white text-orange-600 font-extrabold text-sm px-10 py-4 rounded-full hover:bg-orange-50 transition-all shadow-xl hover:scale-105">
                Book Now
              </a>
              <a href="tel:+919817023336" className="border-2 border-white/60 hover:border-white text-white font-bold text-sm px-10 py-4 rounded-full transition-all hover:bg-white/10 flex items-center gap-2 justify-center">
                <Phone size={14} /> Call Our Team
              </a>
            </div>
          </div>
        </section>

      </div>
    </PageLayout>
  );
}
