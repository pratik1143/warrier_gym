'use client';

import React from 'react';
import PageLayout from '@/components/PageLayout';
import { FileText, Award, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function TermsClient() {
  return (
    <PageLayout>
      <div className="relative min-h-screen bg-[#FAFAFA] text-slate-700 pt-32 pb-24 overflow-hidden font-poppins">
        {/* Background Gradients */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 relative z-10 space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <span className="inline-flex items-center gap-2 bg-orange-50 text-[#FF5E14] text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-wider border border-orange-200 shadow-sm">
              <FileText size={12} />
              Legal Agreements
            </span>
            <h1 className="font-rowdies text-4xl md:text-6xl font-bold tracking-tight text-slate-900 uppercase leading-none">
              Terms &amp; <span className="text-[#FF5E14]">Conditions</span>
            </h1>
            <p className="text-slate-500 text-xs md:text-sm font-mono tracking-wider uppercase">
              Last Updated: July 17, 2026 · The Warrior Gym
            </p>
            <div className="w-16 h-[2px] bg-[#FF5E14] mx-auto mt-6 rounded-full" />
          </div>

          {/* Intro Card */}
          <div className="bg-white border border-slate-200/80 p-6 md:p-8 rounded-3xl shadow-sm">
            <p className="text-sm md:text-base leading-relaxed text-slate-700 font-poppins">
              Welcome to The Warrior Gym. By becoming a registered member, purchasing membership packages, visiting our branch, or using the The Warrior Gym membership mobile application, you agree to comply with and be bound by the following terms, codes of conduct, and policies.
            </p>
          </div>

          {/* Terms Sections */}
          <div className="space-y-8 font-poppins text-sm md:text-base leading-relaxed bg-white border border-slate-200/80 p-8 md:p-10 rounded-3xl shadow-sm text-left">
            
            {/* Section 1 */}
            <div className="space-y-3">
              <h2 className="text-lg md:text-xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span className="text-[#FF5E14]">1.</span> Membership Registration &amp; Verification
              </h2>
              <p className="text-slate-600">
                All memberships are personal, non-transferable, and non-refundable. During onboarding, members must declare any pre-existing health conditions or injury records. Access to the gym workout floors requires a successful biometric punch-in or QR code verification at the Sector 89 branch lobby reception.
              </p>
            </div>

            {/* Section 2 */}
            <div className="space-y-3">
              <h2 className="text-lg md:text-xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span className="text-[#FF5E14]">2.</span> Use of Facilities &amp; Equipment Safety
              </h2>
              <p className="text-slate-600">
                To keep a safe and sanitary environment, we expect all gym members to follow these guidelines:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600 text-sm md:text-base">
                <li>Rerack all plates, dumbbells, and barbells to their dedicated storage stands after completing sets.</li>
                <li>Wear clean indoor athletic footwear and appropriate workout apparel at all times on the gym floor.</li>
                <li>Wipe down machine benches and sweat grips after functional, cardio, or strength training exercises.</li>
                <li>Do not drop weights or slam commercial stack machines excessively unless in functional lifting zones.</li>
              </ul>
            </div>

            {/* Section 3 */}
            <div className="space-y-3">
              <h2 className="text-lg md:text-xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span className="text-[#FF5E14]">3.</span> Subscriptions, Payments &amp; Free Trials
              </h2>
              <p className="text-slate-600">
                Membership packages (monthly, quarterly, half-yearly, and yearly options) must be paid in full upfront. Late payment balances may result in temporary profile deactivation at the biometric access turnstile. Booked free trials are valid for one (1) session only and must be verified by the front desk coordinator.
              </p>
            </div>

            {/* Section 4 */}
            <div className="space-y-3">
              <h2 className="text-lg md:text-xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span className="text-[#FF5E14]">4.</span> Disclaimer &amp; Release of Liability
              </h2>
              <p className="text-slate-600">
                Physical exercise involves inherent risks of injury or strain. By working out at The Warrior Gym, you voluntarily assume all risk of injury, accident, or damage to person or property. You release the gym, its owners, directors, certified trainers, and employees from any claims or liabilities arising out of your workout routines or use of the facilities.
              </p>
            </div>

            {/* Section 5 */}
            <div className="space-y-3">
              <h2 className="text-lg md:text-xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span className="text-[#FF5E14]">5.</span> Mobile Application Code of Conduct
              </h2>
              <p className="text-slate-600">
                Members are responsible for maintaining the privacy of their mobile credentials. Sharing gym logins, biometric records, or QR codes to allow unauthorized guests entry is strictly prohibited and can result in membership termination without a refund.
              </p>
            </div>

            {/* Contact */}
            <div className="pt-6 border-t border-slate-100 space-y-4">
              <h3 className="text-base font-bold text-slate-900 uppercase">Questions about our Terms?</h3>
              <p className="text-slate-600 text-xs md:text-sm">
                If you need clarification on fee structures, package freeze policies, or personal trainer regulations, contact the branch desk or mail our operations lead:
              </p>
              <div className="bg-orange-50/60 border border-orange-200/80 p-5 rounded-2xl space-y-2 text-sm text-slate-700">
                <div><span className="text-slate-500">Call Support:</span> <span className="text-[#FF5E14] font-bold">+91 98170 23336</span></div>
                <div><span className="text-slate-500">Support Mail:</span> <span className="text-slate-900 font-bold">Ramansingh6158@gmail.com</span></div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </PageLayout>
  );
}
