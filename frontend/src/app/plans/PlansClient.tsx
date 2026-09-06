'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import PageLayout from '../../components/PageLayout';
import { motion } from 'framer-motion';
import { getGymImage } from '../../lib/gymImages';
import { 
  Check, ArrowRight, Crown, Star, Phone, MessageSquare, ChevronDown, 
  Sparkles, Smartphone, CheckCircle2, Dumbbell, ShieldCheck, Heart 
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.1 } }),
};

const mainPlans = [
  {
    id: 'monthly',
    tenure: '1 MONTH',
    label: 'Monthly',
    badge: null,
    originalPrice: '₹3,500',
    price: '₹3,000',
    period: '/ month',
    tagline: 'Try the Zone. No long commitment.',
    features: [
      'Full gym access',
      'All cardio & weight equipment',
      'Locker room access',
      'Free fitness assessment',
      'Open 7 days a week'
    ],
    highlight: false,
    icon: Star
  },
  {
    id: 'quarterly',
    tenure: '3 MONTHS',
    label: 'Quarterly',
    badge: 'RECOMMENDED',
    originalPrice: '₹8,000',
    price: '₹6,000',
    period: '/ 3 months',
    tagline: 'Best value for real transformation.',
    features: [
      'Full gym access',
      'All cardio & weight equipment',
      'Locker room access',
      'Free fitness assessment',
      'Open 7 days a week'
    ],
    highlight: true,
    icon: Crown
  },
  {
    id: 'semi-annual',
    tenure: '6 MONTHS',
    label: 'Semi-Annual',
    badge: null,
    originalPrice: '₹12,000',
    price: '₹9,000',
    period: '/ 6 months',
    tagline: 'Serious training for serious results.',
    features: [
      'Full gym access',
      'All cardio & weight equipment',
      'Locker room access',
      'Free fitness assessment',
      'Open 7 days a week'
    ],
    highlight: false,
    icon: Star
  },
  {
    id: 'annual',
    tenure: '12 MONTHS',
    label: 'Annual',
    badge: 'BEST VALUE',
    originalPrice: '₹18,000',
    price: '₹14,000',
    period: '/ year',
    tagline: 'Commit to a stronger, elite version of you.',
    features: [
      'Full gym access',
      'All cardio & weight equipment',
      'Locker room access',
      'Free fitness assessment',
      'Open 7 days a week'
    ],
    highlight: false,
    icon: Crown
  }
];

const addons = [
  { title: 'Personal Coaching Sessions', desc: 'Per 1-on-1 session with a certified expert coach.' },
  { title: 'Nutrition Programming', desc: 'Custom nutrition programme built for your goals.' },
  { title: 'Group Class Pass', desc: '10 group classes — HIIT, strength, mobility & more.' },
  { title: 'InBody Analysis Pack', desc: 'Detailed InBody analysis with expert consultation.' }
];

const commonQuestions = [
  { 
    q: 'Do you offer a free trial session?', 
    a: 'Yes! We offer a free trial session so you can explore our gym, meet our trainers, and experience our facilities before joining.' 
  },
  { 
    q: 'What membership plans do you offer?', 
    a: 'We offer flexible monthly, quarterly, half-yearly, and annual membership plans to suit your fitness goals and budget.' 
  },
  { 
    q: 'Do you provide personal training?', 
    a: 'Yes, our certified trainers provide one-on-one personal training with customised workout and nutrition guidance.' 
  },
  { 
    q: 'What facilities are available at The Warrior Gym?', 
    a: 'Our gym features modern equipment, strength & cardio zones, functional training, CrossFit, HIIT, and a supportive fitness environment.' 
  },
  { 
    q: 'How can I join The Warrior Gym?', 
    a: 'Simply visit our gym, call us, or contact us on WhatsApp (+91 97793 33155) to choose your membership plan and start your fitness journey today.' 
  }
];

export default function PlansPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const heroImg = getGymImage('plans');
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
              MEMBERSHIP TIERS // PASSES
            </motion.span>
            
            <motion.h1 initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none text-slate-900">
              Choose Your<br />
              <span className="text-[#FF5E14]">Commitment.</span>
            </motion.h1>
            
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }} className="text-slate-600 text-base md:text-xl leading-relaxed max-w-3xl mx-auto font-light">
              Flexible memberships built around how often you want to win. Every plan unlocks world-class equipment, expert coaches and the culture that makes The Warrior Gym different.
            </motion.p>
          </div>
        </section>

        {/* Section 1: Plans Grid */}
        <section className="py-24 bg-[#F8FAFC] border-b border-slate-200/80 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
              {mainPlans.map((plan, i) => (
                <motion.div key={plan.id} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className={`relative flex flex-col justify-between rounded-3xl p-7 transition-all ${
                    plan.highlight 
                      ? 'bg-white border-2 border-[#FF5E14] shadow-[0_12px_40px_rgba(255,94,20,0.18)] ring-4 ring-orange-500/10 z-10' 
                      : 'bg-white border border-slate-200/80 shadow-sm hover:border-orange-300 hover:shadow-[0_10px_30px_rgba(255,94,20,0.1)]'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white">
                      {plan.badge}
                    </div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <span className="text-[10px] font-black text-[#FF5E14] tracking-widest uppercase">{plan.tenure}</span>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mt-3 mb-3 ${
                        plan.highlight ? 'bg-orange-500 text-white' : 'bg-orange-50 border border-orange-200/80 text-[#FF5E14]'
                      }`}>
                        <plan.icon size={18} />
                      </div>
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        {plan.label} {plan.highlight && <span className="w-1.5 h-1.5 rounded-full bg-[#FF5E14] animate-ping shrink-0" />}
                      </h3>
                      <p className="text-slate-600 text-xs mt-1 font-poppins">{plan.tagline}</p>
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-slate-400 text-sm font-semibold line-through">{plan.originalPrice}</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-900">{plan.price}</span>
                        <span className="text-slate-500 text-xs font-poppins">{plan.period}</span>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    <ul className="space-y-2.5">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-center gap-2.5 text-xs text-slate-700">
                          <Check className="text-[#FF5E14] shrink-0" size={14} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-7 pt-4">
                    <a href={`https://wa.me/919779333155?text=Hi! I am interested in the ${plan.label} membership plan at The Warrior Gym.`} target="_blank" rel="noopener noreferrer"
                      className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-center transition-all block ${
                        plan.highlight 
                          ? 'bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white hover:shadow-[0_8px_25px_rgba(255,94,20,0.4)] shadow-[0_4px_15px_rgba(255,94,20,0.25)]' 
                          : 'border-2 border-slate-200 hover:border-[#FF5E14] text-slate-800 hover:text-[#FF5E14] hover:bg-orange-50 bg-white'
                      }`}
                    >
                      Get Started
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center pt-4 text-xs text-slate-500 font-poppins">
              All prices inclusive of taxes • Cancel anytime • Free walk-in trial available
            </div>
          </div>
        </section>

        {/* Section 2: Add-Ons & Extras */}
        <section className="py-24 bg-white border-b border-slate-100 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 space-y-16">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">UPGRADES</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">Add-Ons &amp; Extras.</h2>
              <div className="w-20 h-1 bg-[#FF5E14] mx-auto rounded-full" />
              <p className="text-slate-600 text-sm font-poppins max-w-xl mx-auto">
                Stack coaching, nutrition and recovery services on top of any membership.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {addons.map((addon, i) => (
                <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="bg-[#FAFAFA] border border-slate-200/80 p-8 rounded-3xl text-left space-y-3 group shadow-sm hover:border-orange-300 hover:shadow-[0_8px_25px_rgba(255,94,20,0.1)] transition-all"
                >
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wide group-hover:text-[#FF5E14] transition-colors">{addon.title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed font-poppins">{addon.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Common Questions (FAQ) */}
        <section className="py-24 bg-[#F8FAFC] border-b border-slate-200/80">
          <div className="max-w-3xl mx-auto px-6 space-y-12">
            <div className="text-center space-y-4">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">HELP HUB</span>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900">Common Questions.</h2>
              <div className="w-20 h-1 bg-[#FF5E14] mx-auto rounded-full" />
            </div>
            <div className="space-y-3">
              {commonQuestions.map((faq, i) => (
                <motion.div key={i} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} 
                  className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm"
                >
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

        {/* Section 4: Ready To Train Like A Warrior? (CTA) */}
        <section className="py-24 bg-gradient-to-br from-orange-500 via-[#FF5E14] to-[#EA580C] text-white relative overflow-hidden shadow-xl">
          <div className="absolute inset-0">
            <Image src={ctaImg.src} alt={ctaImg.alt} fill className="object-cover opacity-10 mix-blend-overlay" sizes="100vw" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
            <span className="text-xs font-black text-white/80 tracking-widest uppercase">CHALLENGE YOURSELF</span>
            <h2 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tighter">
              Ready To Train<br />
              <span className="text-white drop-shadow-md">Like A Warrior?</span>
            </h2>
            <div className="w-20 h-1 bg-white mx-auto rounded-full" />
            <p className="text-white/90 max-w-xl mx-auto font-poppins text-sm md:text-base leading-relaxed">
              Book your free walk-in assessment. Meet the coaches, tour the floor and pick the plan that fits.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <a href="/contact" className="bg-white text-orange-600 font-extrabold text-sm px-10 py-4 rounded-full hover:bg-orange-50 transition-all shadow-xl hover:scale-105">
                Book Now
              </a>
              <a href="tel:+919779333155" className="border-2 border-white/60 hover:border-white text-white font-bold text-sm px-10 py-4 rounded-full transition-all hover:bg-white/10 flex items-center gap-2 justify-center">
                <Phone size={14} /> Call Now
              </a>
            </div>
          </div>
        </section>

      </div>
    </PageLayout>
  );
}
