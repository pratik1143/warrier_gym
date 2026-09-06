'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import PageLayout from '../../components/PageLayout';
import { motion } from 'framer-motion';
import { getGymImage } from '../../lib/gymImages';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import toast from '@/lib/toast';
import { 
  Phone, Mail, MapPin, Send, CheckCircle, MessageSquare, 
  Smartphone, CheckCircle2, ChevronRight, Share2 
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.1 } }),
};

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', goal: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newMsg = {
      id: 'msg_' + Date.now(),
      name: formData.name || 'Anonymous User',
      phone: formData.phone || '',
      email: formData.email || '',
      goal: formData.goal || '',
      message: formData.message || '',
      createdAt: new Date().toISOString(),
      status: 'Unread'
    };

    try {
      const cached = JSON.parse(localStorage.getItem('warriorgym_messages') || '[]');
      localStorage.setItem('warriorgym_messages', JSON.stringify([newMsg, ...cached]));
    } catch (e) {}

    try {
      await addDoc(collection(db, 'messages'), {
        name: newMsg.name,
        phone: newMsg.phone,
        email: newMsg.email,
        goal: newMsg.goal,
        message: newMsg.message,
        createdAt: newMsg.createdAt,
        status: newMsg.status
      });
    } catch (err) {
      console.warn("Firestore permission/save note:", err);
    }
    setLoading(false);
    setSubmitted(true);
    toast.success('Message sent successfully!');
  };

  const heroImg = getGymImage('contact');

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
              GET IN TOUCH // TOUR THE FLOOR
            </motion.span>
            
            <motion.h1 initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }} className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none text-slate-900">
              Step Into<br />
              <span className="text-[#FF5E14]">The Zone.</span>
            </motion.h1>
            
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25 }} className="text-slate-600 text-base md:text-xl leading-relaxed max-w-3xl mx-auto font-light">
              Visit us, message the team or call now to book your free fitness assessment. Our coaches are ready to help you find the perfect programme.
            </motion.p>
          </div>
        </section>

        {/* Section 1: Contact Methods Grid */}
        <section className="py-24 bg-[#F8FAFC] border-b border-slate-200/80 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-16 items-start">
            
            {/* Left Column: Cards & Socials */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Prefer to Talk Card */}
              <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="bg-white border border-slate-200/80 p-8 rounded-3xl text-left space-y-6 shadow-sm hover:border-orange-300 hover:shadow-[0_8px_25px_rgba(255,94,20,0.1)] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-center text-[#FF5E14] group-hover:bg-[#FF5E14] group-hover:text-white transition-all">
                    <Phone size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-[#FF5E14] uppercase tracking-widest">DIRECT LINE</span>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">Prefer To Talk?</h3>
                  </div>
                </div>
                <p className="text-slate-600 font-poppins text-xs leading-relaxed">
                  Skip the form. Call or WhatsApp our team directly for instant answers.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <a href="tel:+919779333155" className="bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white font-extrabold text-xs tracking-wider uppercase px-6 py-3.5 rounded-xl hover:shadow-[0_8px_20px_rgba(255,94,20,0.3)] hover:scale-105 transition-all shadow-md flex items-center gap-1.5">
                    Call Now
                  </a>
                  <a href="https://wa.me/919779333155" target="_blank" rel="noopener noreferrer" className="border-2 border-slate-200 hover:border-[#FF5E14] text-slate-800 hover:text-[#FF5E14] hover:bg-orange-50 font-bold text-xs tracking-wider uppercase px-6 py-3.5 rounded-xl transition-all bg-white flex items-center gap-1.5">
                    WhatsApp Us
                  </a>
                </div>
              </motion.div>

              {/* Book Free Trial Card */}
              <motion.div custom={0.1} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="bg-white border border-slate-200/80 p-8 rounded-3xl text-left space-y-6 shadow-sm hover:border-orange-300 hover:shadow-[0_8px_25px_rgba(255,94,20,0.1)] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-center text-[#FF5E14] group-hover:bg-[#FF5E14] group-hover:text-white transition-all">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-[#FF5E14] uppercase tracking-widest">EXPERIENCE THE WARRIOR GYM</span>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">Book Now</h3>
                  </div>
                </div>
                <p className="text-slate-600 font-poppins text-xs leading-relaxed">
                  Walk in, tour the floor, meet the coaches. No pressure, no fees.
                </p>
                <div className="pt-2">
                  <a href="/packages" className="border-2 border-slate-200 hover:border-[#FF5E14] text-slate-800 hover:text-[#FF5E14] hover:bg-orange-50 font-bold text-xs tracking-wider uppercase px-6 py-3.5 rounded-xl transition-all bg-white inline-flex items-center gap-1">
                    View Packages <ChevronRight size={12} />
                  </a>
                </div>
              </motion.div>

              {/* Follow the Zone Card */}
              <motion.div custom={0.2} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="bg-white border border-slate-200/80 p-8 rounded-3xl text-left space-y-6 shadow-sm hover:border-orange-300 hover:shadow-[0_8px_25px_rgba(255,94,20,0.1)] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-center text-[#FF5E14] group-hover:bg-[#FF5E14] group-hover:text-white transition-all">
                    <Share2 size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-[#FF5E14] uppercase tracking-widest">SOCIAL MEDIA</span>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">Follow The Warrior Gym</h3>
                  </div>
                </div>
                <p className="text-slate-600 font-poppins text-xs leading-relaxed">
                  Daily training, transformations and behind-the-scenes on our socials.
                </p>
                <div className="flex gap-3 pt-2">
                  <a href="https://www.instagram.com/thewarriorgym" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF5E14] hover:bg-[#FF5E14] hover:text-white transition-all">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                  </a>
                  <a href="https://www.youtube.com/@TheWarriorGym" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FF5E14] hover:bg-[#FF5E14] hover:text-white transition-all">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M23.498 6.163a3.003 3.003 0 00-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 00-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 002.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 002.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                </div>
              </motion.div>

            </div>

            {/* Right Column: Contact Form */}
            <div className="lg:col-span-5">
              <motion.div custom={0.3} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="bg-white border border-slate-200/80 rounded-3xl p-8 md:p-10 text-left shadow-sm"
              >
                {submitted ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-6 py-12">
                    <div className="w-20 h-20 bg-orange-50 border border-orange-200 rounded-full flex items-center justify-center text-[#FF5E14]">
                      <CheckCircle size={36} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Message Sent!</h3>
                    <p className="text-slate-600 font-poppins max-w-xs text-xs leading-relaxed">Thank you for reaching out. Our team will contact you within 24 hours.</p>
                    <button onClick={() => { setSubmitted(false); setFormData({ name: '', phone: '', email: '', goal: '', message: '' }); }}
                      className="border-2 border-slate-200 hover:border-[#FF5E14] text-slate-800 hover:text-[#FF5E14] font-bold text-xs px-6 py-3 rounded-full transition-all cursor-pointer bg-white">
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 mb-8">
                      <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">ENQUIRY FORM</span>
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Send A Message</h2>
                      <div className="w-12 h-1 bg-[#FF5E14] rounded-full" />
                      <p className="text-slate-500 text-xs font-poppins pt-1">Fill out the form — we&apos;ll get back within 24 hours.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 font-poppins">
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1.5 tracking-wider">Full Name *</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Your name"
                          className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-4 py-3.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#FF5E14] transition-colors" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1.5 tracking-wider">Phone *</label>
                          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required placeholder="Your phone number"
                            className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-4 py-3.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#FF5E14] transition-colors" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1.5 tracking-wider">Email Address</label>
                          <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com"
                            className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-4 py-3.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#FF5E14] transition-colors" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1.5 tracking-wider">Transformation Goal *</label>
                        <select name="goal" value={formData.goal} onChange={handleChange} required
                          className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-4 py-3.5 text-xs text-slate-900 outline-none focus:border-[#FF5E14] transition-colors appearance-none">
                          <option value="">Select your goal...</option>
                          <option value="weight-loss">Weight Loss</option>
                          <option value="muscle-gain">Muscle Gain</option>
                          <option value="general-fitness">General Fitness</option>
                          <option value="personal-training">Personal Training</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1.5 tracking-wider">Message</label>
                        <textarea name="message" value={formData.message} onChange={handleChange} rows={4} placeholder="Your message here..."
                          className="w-full bg-[#FAFAFA] border border-slate-200 rounded-xl px-4 py-3.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#FF5E14] transition-colors resize-none" />
                      </div>

                      <button type="submit" disabled={loading}
                        className="w-full bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white font-extrabold text-xs py-4 rounded-xl uppercase tracking-widest hover:shadow-[0_8px_20px_rgba(255,94,20,0.3)] hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-[0_4px_15px_rgba(255,94,20,0.25)]">
                        {loading ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Sending...</span></>
                        ) : (
                          <><Send size={14} /><span>Send Message</span></>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </motion.div>
            </div>

          </div>
        </section>

        {/* Section 2: Come Train With Us (Google Maps) */}
        <section className="py-24 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-6 space-y-12">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <span className="text-xs font-black text-[#FF5E14] tracking-widest uppercase">VISIT THE GYM</span>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">Come Train With Us.</h2>
              <div className="w-20 h-1 bg-[#FF5E14] mx-auto rounded-full" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              {/* Info Left (4 cols) */}
              <div className="lg:col-span-4 space-y-6 text-left">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-[#FF5E14] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">The Warrior Gym Location</h4>
                      <p className="text-xs text-slate-600 font-poppins leading-relaxed mt-1">
                        2nd Floor, MNB Group, SCO 16-17, Landran Road, Sohana, Sahibzada Ajit Singh Nagar, Punjab 140308
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="flex items-start gap-3">
                    <Mail size={18} className="text-[#FF5E14] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Email Address</h4>
                      <p className="text-xs text-slate-600 font-poppins mt-1">thewarriorgym@gmail.com</p>
                    </div>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="flex items-start gap-3">
                    <Phone size={18} className="text-[#FF5E14] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Working Hours</h4>
                      <p className="text-xs text-slate-600 font-poppins mt-1 leading-relaxed">
                        Mon – Sat: Morning &amp; Evening batches<br />
                        Sunday: Contact for timings
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <a href="https://maps.google.com/?q=2nd+Floor+MNB+Group+SCO+16-17+Landran+Road+Sohana+Punjab+140308" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border-2 border-slate-200 hover:border-[#FF5E14] text-slate-800 hover:text-[#FF5E14] hover:bg-orange-50 font-bold text-xs tracking-wider uppercase px-6 py-3.5 rounded-xl transition-all bg-white shadow-sm">
                    Open in Google Maps
                  </a>
                </div>
              </div>

              {/* Map Frame Right (8 cols) */}
              <div className="lg:col-span-8">
                <div className="rounded-3xl overflow-hidden border border-slate-200/80 shadow-md h-[400px]">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3430.730386629088!2d76.68334467554907!3d30.697880974600127!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390fee8c3a24f3c3%3A0x5c7f1f15b5f3b8a0!2sSohana%2C%20Punjab!5e0!3m2!1sen!2sin!4v1715420000000!5m2!1sen!2sin"
                    width="100%" height="100%" style={{ border: 0 }} allowFullScreen={true} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </PageLayout>
  );
}
