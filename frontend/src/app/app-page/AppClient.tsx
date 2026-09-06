'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import PageLayout from '../../components/PageLayout';
import { motion } from 'framer-motion';
import { getGymImage } from '../../lib/gymImages';
import {
  QrCode, BarChart2, Dumbbell, Heart, Bell, Shield, MessageSquare,
  Smartphone, Star, Zap, Check, ChevronDown, CreditCard, Activity, Brain
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.1 } }),
};

const appFeatures = [
  { icon: CreditCard, title: 'Digital Membership Card', desc: 'No physical card required. Your membership lives in your pocket, always accessible.', color: 'text-[#FF5E14]' },
  { icon: QrCode, title: 'QR Entry', desc: 'Fast and secure gym access. Scan at the gate — no waiting, no queues.', color: 'text-blue-500' },
  { icon: Activity, title: 'Attendance Tracking', desc: 'Track every check-in and complete workout history with timestamps.', color: 'text-emerald-500' },
  { icon: Dumbbell, title: 'Workout Plans', desc: 'Daily exercise routines assigned by your trainer. Follow guided programs.', color: 'text-orange-500' },
  { icon: Heart, title: 'Diet Plans', desc: 'Meal plans based on your goals — calorie targets, macros, and food suggestions.', color: 'text-rose-500' },
  { icon: BarChart2, title: 'Progress Tracking', desc: 'Weight, BMI, measurements, and transformation timeline with visual charts.', color: 'text-purple-500' },
  { icon: CreditCard, title: 'Membership Management', desc: 'Track expiry, renewal dates, invoices, and full payment history.', color: 'text-cyan-500' },
  { icon: MessageSquare, title: 'Trainer Support', desc: 'Direct chat with your trainer. Get workout updates and progress reviews.', color: 'text-amber-500' },
  { icon: Brain, title: 'AI Fitness Assistant', desc: 'Ask fitness questions anytime. Calories, workout plans, protein intake, recovery.', color: 'text-[#FF5E14]' },
  { icon: Bell, title: 'Smart Notifications', desc: 'Workout reminders, renewal alerts, exclusive offers, and gym announcements.', color: 'text-pink-500' },
  { icon: Shield, title: 'Secure Access', desc: 'OTP login, QR code, and encrypted member profile for complete data security.', color: 'text-emerald-500' },
];

const aiExamples = [
  { q: 'How many calories should I eat?', a: 'Based on your weight, height, and goal, I recommend 2,200 kcal/day with a 300 kcal deficit for fat loss.' },
  { q: 'Create today\'s workout.', a: 'Upper body day: Bench Press 4x10, Pull-ups 3x8, Shoulder Press 3x10, Dumbbell Rows 4x12. Rest 90 sec.' },
  { q: 'What is my daily protein intake?', a: 'For your body weight of 75kg and muscle-building goal, target 150g of protein per day (2g/kg).' },
  { q: 'Give me recovery tips.', a: 'Sleep 7-8 hours, prioritize protein within 30 min post-workout, use foam rolling for 10 min daily.' },
];

const faqs = [
  { q: 'Is the app free for members?', a: 'Yes! The The Warrior Gym Member App is included with your membership. Download it and log in with your member credentials.' },
  { q: 'Does the app work offline?', a: 'Basic features like membership card and QR code work offline. Internet is needed for real-time tracking and AI assistant.' },
  { q: 'How do I get my QR code?', a: 'Your QR code is generated automatically after joining. Find it on the home screen of the app for instant gym access.' },
  { q: 'Can I chat with my trainer through the app?', a: 'Absolutely! The Trainer Support section allows direct messaging with your assigned trainer for guidance and updates.' },
  { q: 'Is my data secure?', a: 'Yes. We use OTP login, QR-based access, and full encryption on all member profiles. Your data is completely private.' },
];

export default function AppPageRoute() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeAi, setActiveAi] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const heroImg = getGymImage('mobile_app');

  return (
    <PageLayout>
      <div className="bg-[#FAFAFA] text-slate-900 font-poppins">

        {/* Hero */}
        <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-white border-b border-slate-100">
          <div className="absolute inset-0">
            <Image src={heroImg.src} alt={heroImg.alt} fill className="object-cover opacity-10" priority sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/80 to-white" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[700px] h-[700px] bg-orange-500/5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center py-20">
            {/* Left Text */}
            <div className="space-y-8 text-left">
              <motion.span initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="inline-block text-xs font-black text-[#FF5E14] tracking-widest uppercase border border-orange-200 px-4 py-2 rounded-full bg-orange-50 shadow-sm">
                The Warrior Gym Member App
              </motion.span>
              <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none text-slate-900">
                Your Gym<br /><span className="text-[#FF5E14]">In Your Pocket</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="text-slate-600 text-base md:text-lg leading-relaxed font-poppins max-w-lg">
                Manage your fitness journey anytime, anywhere. Digital membership, AI coach, workout plans, diet tracking — all in one app.
              </motion.p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex flex-col sm:flex-row gap-4">
                <a href="/WarriorGym.apk" download className="bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white font-extrabold text-sm px-8 py-4 rounded-full hover:shadow-[0_8px_25px_rgba(255,94,20,0.4)] transition-all shadow-[0_4px_15px_rgba(255,94,20,0.25)] flex items-center gap-2 justify-center hover:scale-105">
                  <Smartphone size={16} /> Download Android App
                </a>
                <a href="/contact" className="border-2 border-slate-200 hover:border-[#FF5E14] text-slate-800 font-bold text-sm px-8 py-4 rounded-full transition-all hover:text-[#FF5E14] hover:bg-orange-50 flex items-center gap-2 justify-center bg-white shadow-sm">
                  <Star size={16} /> Join &amp; Get Access
                </a>
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center gap-6 pt-2">
                {[{ val: '500+', label: 'Active Users' }, { val: '4.9★', label: 'App Rating' }, { val: '11', label: 'Features' }].map((s, i) => (
                  <div key={i} className="text-center">
                    <div className="text-xl font-black text-[#FF5E14]">{s.val}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-poppins">{s.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: Phone Mockup */}
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2 }} className="flex justify-center">
              <div className="relative">
                <div className="absolute -inset-4 bg-orange-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
                <div className="w-[300px] h-[620px] bg-[#0c0c0e] rounded-[48px] border-[10px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
                  {/* Speaker */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-800 rounded-b-2xl z-30 flex items-center justify-center">
                    <div className="w-8 h-1 bg-white/20 rounded-full" />
                  </div>
                  {/* Status bar area */}
                  <div className="h-8 shrink-0" />
                  {/* App UI */}
                  <div className="flex-1 bg-[#060608] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="px-4 pt-3 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-[#FF5E14] to-[#FF7A00] rounded-lg flex items-center justify-center text-white font-black text-[9px]">WG</div>
                        <div>
                          <div className="text-[9px] font-bold text-white">The Warrior Gym</div>
                          <div className="text-[6px] text-[#FF5E14] font-black uppercase tracking-wider">GOLD MEMBER</div>
                        </div>
                      </div>
                      <div className="w-6 h-6 bg-slate-900 border border-white/10 rounded-lg flex items-center justify-center text-white"><QrCode size={10} /></div>
                    </div>
                    {/* Membership card */}
                    <div className="mx-3 bg-gradient-to-br from-[#FF5E14]/30 to-slate-900 border border-[#FF5E14]/30 rounded-2xl p-3 mb-3 text-left">
                      <div className="text-[7px] font-black text-[#FF5E14] uppercase tracking-widest">Gold Membership</div>
                      <div className="text-[11px] font-black text-white mt-0.5">Vikram Singh</div>
                      <div className="mt-2 h-1 bg-slate-800 rounded-full"><div className="h-full bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] rounded-full w-3/4" /></div>
                      <div className="flex justify-between mt-1"><span className="text-[6px] text-slate-500">97 days remaining</span><span className="text-[6px] text-[#FF5E14] font-bold">ACTIVE</span></div>
                    </div>
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 px-3 mb-3">
                      {[{ icon: Activity, v: '12', l: 'Workouts', c: 'text-emerald-400' }, { icon: Zap, v: '8', l: 'Streak', c: 'text-[#FF5E14]' }, { icon: Heart, v: '92%', l: 'Health', c: 'text-rose-400' }].map((s, i) => (
                        <div key={i} className="bg-slate-900/80 border border-white/5 rounded-xl p-2 text-center">
                          <s.icon size={9} className={`${s.c} mx-auto`} />
                          <div className="text-[9px] font-bold text-white mt-1">{s.v}</div>
                          <div className="text-[6px] text-slate-500">{s.l}</div>
                        </div>
                      ))}
                    </div>
                    {/* Today's workout */}
                    <div className="mx-3 bg-slate-900/60 border border-white/5 rounded-xl p-3 mb-3 text-left">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[7px] font-black text-white uppercase tracking-wider">Today&apos;s Workout</span>
                        <Dumbbell size={8} className="text-[#FF5E14]" />
                      </div>
                      {['Bench Press 4×10', 'Pull-Ups 3×8', 'Squats 4×12'].map((ex, i) => (
                        <div key={i} className="flex items-center gap-1.5 mb-1">
                          <Check size={7} className="text-[#FF5E14]" />
                          <span className="text-[7px] text-slate-300">{ex}</span>
                        </div>
                      ))}
                    </div>
                    {/* AI chat preview */}
                    <div className="mx-3 bg-slate-900/60 border border-white/5 rounded-xl p-3 text-left">
                      <div className="text-[7px] font-black text-[#FF5E14] uppercase tracking-wider mb-2">AI Assistant</div>
                      <div className="text-[7px] text-slate-400 bg-slate-800 rounded-lg p-2 mb-1.5">How many calories today?</div>
                      <div className="text-[7px] text-white bg-[#FF5E14]/20 border border-[#FF5E14]/30 rounded-lg p-2">Target: 2,200 kcal. Consumed: 1,850. 350 kcal remaining ✓</div>
                    </div>
                  </div>
                  {/* Bottom Nav */}
                  <div className="h-12 bg-slate-900 border-t border-white/5 flex items-center justify-around px-2 shrink-0">
                    {[{ icon: Smartphone, l: 'Home' }, { icon: Dumbbell, l: 'Workouts' }, { icon: BarChart2, l: 'Progress' }, { icon: MessageSquare, l: 'Support' }].map((t, i) => (
                      <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 0 ? 'text-[#FF5E14]' : 'text-slate-600'}`}>
                        <t.icon size={11} />
                        <span className="text-[5px] font-bold uppercase">{t.l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-[#F8FAFC] border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">Mobile App Features</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">Everything You Need</h2>
              <div className="w-20 h-1 bg-[#FF5E14] mx-auto rounded-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {appFeatures.map((feature, i) => (
                <motion.div key={i} custom={i * 0.06} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  onClick={() => setActiveFeature(i)}
                  className={`bg-white border p-6 rounded-2xl text-left space-y-4 cursor-pointer transition-all shadow-sm ${activeFeature === i ? 'border-[#FF5E14] shadow-[0_8px_30px_rgba(255,94,20,0.15)] ring-2 ring-orange-500/20' : 'border-slate-200/80 hover:border-orange-300'} group`}
                >
                  <div className="w-12 h-12 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-center text-[#FF5E14] group-hover:bg-[#FF5E14] group-hover:text-white transition-all">
                    <feature.icon size={22} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{feature.title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed font-poppins">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Assistant Section */}
        <section className="py-20 bg-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-6 text-left">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">AI Powered</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">AI Fitness<br /><span className="text-[#FF5E14]">Assistant</span></h2>
              <div className="w-14 h-1 bg-[#FF5E14] rounded-full" />
              <p className="text-slate-600 leading-relaxed font-poppins">Ask your AI fitness assistant anything — anytime. Get instant, personalized answers about calories, workouts, nutrition, and recovery.</p>
              <div className="space-y-2">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Try these examples:</div>
                {aiExamples.map((ex, i) => (
                  <button key={i} onClick={() => setActiveAi(i)}
                    className={`w-full text-left p-3 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${activeAi === i ? 'bg-orange-50 border-orange-300 text-[#FF5E14] shadow-sm' : 'bg-[#FAFAFA] border-slate-200 text-slate-700 hover:border-orange-300 hover:text-[#FF5E14]'}`}>
                    &ldquo;{ex.q}&rdquo;
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.div custom={0.2} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="bg-[#FAFAFA] border border-slate-200/80 rounded-3xl p-6 space-y-4 shadow-sm text-left">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
                  <div className="w-9 h-9 bg-orange-50 border border-orange-200 rounded-xl flex items-center justify-center text-[#FF5E14]"><Brain size={18} /></div>
                  <div>
                    <div className="font-black text-slate-900 text-sm">Warrior AI Fitness Assistant</div>
                    <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Online &amp; Ready</div>
                  </div>
                </div>

                <motion.div key={activeAi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-orange-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] shadow-sm">
                      <p className="text-sm font-poppins">{aiExamples[activeAi].q}</p>
                    </div>
                  </div>
                  {/* AI response */}
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Brain size={12} className="text-[#FF5E14]" />
                        <span className="text-[9px] font-black text-[#FF5E14] uppercase tracking-wider">Warrior AI</span>
                      </div>
                      <p className="text-sm text-slate-800 font-poppins leading-relaxed">{aiExamples[activeAi].a}</p>
                    </div>
                  </div>
                </motion.div>

                <div className="flex gap-2 pt-2">
                  <input readOnly placeholder="Ask Warrior AI anything..." className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600 outline-none font-poppins cursor-pointer" onClick={() => setActiveAi((activeAi + 1) % aiExamples.length)} />
                  <button onClick={() => setActiveAi((activeAi + 1) % aiExamples.length)} className="w-9 h-9 bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white rounded-xl flex items-center justify-center cursor-pointer border-none hover:shadow-md transition-all shrink-0">
                    <Zap size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 text-center font-poppins">Click the input or send button to try different examples</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Download Section */}
        <section className="py-20 bg-gradient-to-br from-orange-500 via-[#FF5E14] to-[#EA580C] text-white shadow-xl">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
              className="bg-white text-slate-900 border border-orange-100 rounded-3xl p-10 md:p-16 text-center space-y-8 shadow-2xl"
            >
              <div className="w-20 h-20 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-center text-[#FF5E14] mx-auto">
                <Smartphone size={36} />
              </div>
              <div className="space-y-4">
                <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">Download Now</span>
                <h2 className="text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter">The Warrior Gym Member Super App</h2>
                <p className="text-slate-600 max-w-xl mx-auto font-poppins">Direct APK installer. No Play Store required. Download directly on your Android device.</p>
              </div>
              <div className="bg-orange-50/60 border border-orange-200/80 rounded-2xl p-5 text-left max-w-lg mx-auto">
                <div className="text-xs font-black text-[#FF5E14] uppercase tracking-wider mb-3">Installation Guide</div>
                <ol className="list-decimal list-inside text-xs text-slate-700 space-y-2 font-poppins">
                  <li>Click <strong className="text-slate-900">Download Android App</strong> below.</li>
                  <li>Open the downloaded <code className="text-[#FF5E14] font-mono font-bold">WarriorGym.apk</code> file.</li>
                  <li>Enable <strong className="text-slate-900">&ldquo;Install from Unknown Sources&rdquo;</strong> if prompted.</li>
                  <li>Tap <strong className="text-slate-900">Install</strong>, open the app, and login with your member credentials!</li>
                </ol>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <a href="/WarriorGym.apk" download className="bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white font-extrabold text-sm px-10 py-4 rounded-full hover:shadow-[0_8px_25px_rgba(255,94,20,0.4)] transition-all shadow-[0_4px_15px_rgba(255,94,20,0.25)] flex items-center gap-2 hover:scale-105">
                  <Smartphone size={18} /> Download Android App
                </a>
              </div>
              <p className="text-[11px] text-slate-500 font-poppins flex items-center justify-center gap-1">
                <Shield size={12} className="text-emerald-500" /> v1.0.0 · Direct APK · Verified Safe
              </p>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 bg-[#F8FAFC] border-b border-slate-200/80">
          <div className="max-w-3xl mx-auto px-6 space-y-12">
            <div className="text-center space-y-4">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">FAQ</span>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900">App FAQs</h2>
              <div className="w-20 h-1 bg-[#FF5E14] mx-auto rounded-full" />
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <motion.div key={i} custom={i * 0.08} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer bg-transparent border-none">
                    <span className="font-bold text-slate-900 text-sm">{faq.q}</span>
                    <ChevronDown size={16} className={`text-[#FF5E14] shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && <div className="px-5 pb-5 text-slate-600 text-sm leading-relaxed font-poppins border-t border-slate-100 pt-4">{faq.a}</div>}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </PageLayout>
  );
}
