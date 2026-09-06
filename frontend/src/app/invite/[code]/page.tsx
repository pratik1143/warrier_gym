'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dumbbell, Gift, CheckCircle2, Phone, Mail, Lock, User,
  Star, Shield, Zap, Trophy, ArrowRight, Flame, Timer, Sparkles
} from 'lucide-react';
import { db, isFirebaseReady } from '@/lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, addDoc } from 'firebase/firestore';
import { toast } from '@/lib/toast';

const PLAN_OPTIONS = [
  { label: 'Monthly', days: 30, price: 'Rs.1,499', original: 'Rs.2,000', badge: 'Starter' },
  { label: 'Quarterly', days: 90, price: 'Rs.3,999', original: 'Rs.6,000', badge: 'Popular' },
  { label: 'Semi-Annual', days: 180, price: 'Rs.6,999', original: 'Rs.12,000', badge: 'Best Value' },
  { label: 'Annual Premium', days: 365, price: 'Rs.11,999', original: 'Rs.24,000', badge: 'VIP' },
];

const PERKS = [
  { icon: Dumbbell, label: 'Smart Workouts', desc: 'AI plans for your goals' },
  { icon: Flame, label: 'Diet Tracker', desc: 'Daily meal & macro log' },
  { icon: Trophy, label: 'Warrior Score', desc: 'Gamified fitness ranking' },
  { icon: Shield, label: 'Biometric Entry', desc: 'Fingerprint gym access' },
  { icon: Zap, label: 'Trainer Chat', desc: 'Direct trainer messaging' },
  { icon: Star, label: 'Referral Rewards', desc: 'Earn for every friend' },
];

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const referralCode = ((params?.code as string) || '').toUpperCase();

  const [step, setStep] = useState<'landing' | 'register' | 'success'>('landing');
  const [referrerName, setReferrerName] = useState('');
  const [isLoadingReferrer, setIsLoadingReferrer] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('Monthly');
  const [gender, setGender] = useState('Male');
  const [isRegistering, setIsRegistering] = useState(false);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const resolve = async () => {
      setIsLoadingReferrer(true);
      if (!isFirebaseReady || !db || !referralCode) {
        setReferrerName(referralCode.replace('2026', ''));
        setIsLoadingReferrer(false);
        return;
      }
      try {
        const q = query(collection(db, 'referrals'), where('referralCode', '==', referralCode));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setReferrerName(snap.docs[0].data().referrerName || referralCode.replace('2026', ''));
        } else {
          setReferrerName(referralCode.endsWith('2026') ? referralCode.slice(0, -4) : referralCode);
        }
      } catch {
        setReferrerName(referralCode.replace('2026', ''));
      } finally {
        setIsLoadingReferrer(false);
      }
    };
    resolve();
  }, [referralCode]);

  useEffect(() => {
    if (step === 'success') {
      const t = setInterval(() => setCountdown(p => {
        if (p <= 1) { clearInterval(t); router.push('/'); return 0; }
        return p - 1;
      }), 1000);
      return () => clearInterval(t);
    }
  }, [step, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { toast.error('Name and phone are required'); return; }
    if (phone.length < 10) { toast.error('Enter a valid 10-digit mobile number'); return; }
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setIsRegistering(true);
    try {
      const daysMap: Record<string, number> = { Monthly: 30, Quarterly: 90, 'Semi-Annual': 180, 'Annual Premium': 365 };
      const expiryDate = new Date(Date.now() + (daysMap[selectedPlan] || 30) * 864e5).toISOString().split('T')[0];

      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), phone: phone.trim(),
          email: email.trim() || (phone.trim() + '@thewarriorgym.in'),
          password, plan: selectedPlan, gender,
          joinDate: new Date().toISOString().split('T')[0],
          expiryDate, branch: 'Mohali, Punjab', status: 'active', referralCode,
        }),
      });
      const memberData = res.ok ? await res.json() : {};
      const memberId = memberData?.id || memberData?.member?.id || ('m_ref_' + Date.now());

      if (isFirebaseReady && db) {
        const existQ = query(collection(db, 'referrals'), where('friendPhone', '==', phone.trim()), where('referralCode', '==', referralCode));
        const existSnap = await getDocs(existQ);
        if (!existSnap.empty) {
          await setDoc(doc(db, 'referrals', existSnap.docs[0].id), {
            friendId: memberId, friendName: name.trim(),
            status: 'Membership Purchased', currentStep: 4,
            joinPlan: selectedPlan, registeredAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }, { merge: true });
        } else {
          const refQ = query(collection(db, 'referrals'), where('referralCode', '==', referralCode));
          const refSnap = await getDocs(refQ);
          const refId = refSnap.empty ? 'm1' : refSnap.docs[0].data().referrerId;
          const refName = refSnap.empty ? referralCode.replace('2026', '') : refSnap.docs[0].data().referrerName;
          await addDoc(collection(db, 'referrals'), {
            referrerId: refId, referrerName: refName, referralCode,
            friendId: memberId, friendName: name.trim(), friendPhone: phone.trim(),
            status: 'Membership Purchased', currentStep: 4, joinPlan: selectedPlan,
            createdAt: new Date().toISOString(), registeredAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          });
        }
      }
      toast.success('Welcome to The Warrior Gym! Your account is ready!');
      setStep('success');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 36,
    paddingRight: 14,
    background: '#12121A',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    color: '#fff',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 384, height: 384, background: 'rgba(212,255,0,0.07)', borderRadius: '50%', filter: 'blur(80px)' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, padding: '32px 16px' }}>
        <AnimatePresence mode="wait">

          {step === 'landing' && (
            <motion.div key="landing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 16, background: '#D4FF00', marginBottom: 12 }}>
                  <Dumbbell size={32} color="#000" />
                </div>
                <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: '0 0 4px' }}>The Warrior Gym</h1>
                <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Punjab&apos;s #1 Smart Fitness Studio</p>
              </div>

              <div style={{ padding: 16, borderRadius: 20, background: 'rgba(212,255,0,0.08)', border: '1px solid rgba(212,255,0,0.25)', marginBottom: 20 }}>
                {isLoadingReferrer ? (
                  <p style={{ color: '#64748b', fontSize: 12 }}>Loading invite...</p>
                ) : (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Gift size={14} color="#D4FF00" />
                      <span style={{ color: '#D4FF00', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Personal Invite</span>
                    </div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 900, margin: '0 0 4px' }}>{referrerName} invited you to join!</p>
                    <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>
                      Code: <span style={{ fontFamily: 'monospace', color: '#D4FF00', background: 'rgba(212,255,0,0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 900 }}>{referralCode}</span>
                    </p>
                  </div>
                )}
              </div>

              <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>What you get</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
                {PERKS.map((perk, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }}
                    style={{ padding: 12, borderRadius: 16, background: '#12121A', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <perk.icon size={14} color="#D4FF00" />
                    <div style={{ color: '#fff', fontSize: 10, fontWeight: 900, marginTop: 4, marginBottom: 2 }}>{perk.label}</div>
                    <div style={{ color: '#475569', fontSize: 8.5, lineHeight: 1.4 }}>{perk.desc}</div>
                  </motion.div>
                ))}
              </div>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setStep('register')}
                style={{ width: '100%', padding: '14px 0', borderRadius: 16, background: '#D4FF00', color: '#000', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Sparkles size={16} />
                Join Now - Code Auto-Applied
                <ArrowRight size={16} />
              </motion.button>
              <p style={{ textAlign: 'center', color: '#334155', fontSize: 9.5, marginTop: 10 }}>No credit card required. Cancel anytime.</p>
            </motion.div>
          )}

          {step === 'register' && (
            <motion.div key="register" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <button onClick={() => setStep('landing')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 10, cursor: 'pointer', marginBottom: 16, padding: 0 }}>Back</button>
              <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 4px' }}>Create Account</h2>
              <p style={{ color: '#64748b', fontSize: 11, marginBottom: 16 }}>
                Code <span style={{ fontFamily: 'monospace', color: '#D4FF00', fontWeight: 900 }}>{referralCode}</span> will be auto-applied
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 14, background: 'rgba(212,255,0,0.07)', border: '1px solid rgba(212,255,0,0.25)', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Gift size={13} color="#D4FF00" />
                  <span style={{ color: '#cbd5e1', fontSize: 10, fontWeight: 600 }}>Referral Code</span>
                </div>
                <span style={{ fontFamily: 'monospace', color: '#D4FF00', fontWeight: 900, fontSize: 14 }}>{referralCode}</span>
              </div>

              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <User size={13} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="text" placeholder="Full Name *" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
                </div>
                <div style={{ position: 'relative' }}>
                  <Phone size={13} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="tel" placeholder="Mobile Number (10 digits) *" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required style={inputStyle} />
                </div>
                <div style={{ position: 'relative' }}>
                  <Mail size={13} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="email" placeholder="Email (optional)" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {['Male', 'Female'].map(g => (
                    <button key={g} type="button" onClick={() => setGender(g)}
                      style={{ padding: '10px 0', borderRadius: 12, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: gender === g ? '1px solid #D4FF00' : '1px solid rgba(255,255,255,0.08)', background: gender === g ? '#D4FF00' : '#12121A', color: gender === g ? '#000' : '#64748b' }}>
                      {g}
                    </button>
                  ))}
                </div>

                <div>
                  <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, marginTop: 4 }}>Select Plan</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {PLAN_OPTIONS.map(plan => (
                      <button key={plan.label} type="button" onClick={() => setSelectedPlan(plan.label)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', border: selectedPlan === plan.label ? '1px solid rgba(212,255,0,0.5)' : '1px solid rgba(255,255,255,0.05)', background: selectedPlan === plan.label ? 'rgba(212,255,0,0.08)' : '#12121A', textAlign: 'left' }}>
                        <div>
                          <div style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>{plan.label}</div>
                          <div style={{ color: '#475569', fontSize: 9, marginTop: 2 }}>{plan.days} days access</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#D4FF00', fontSize: 13, fontWeight: 900 }}>{plan.price}</div>
                          <div style={{ color: '#334155', fontSize: 8, textDecoration: 'line-through' }}>{plan.original}</div>
                          <div style={{ color: '#34d399', fontSize: 8, fontWeight: 700 }}>{plan.badge}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <Lock size={13} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="password" placeholder="Password (min 6 chars) *" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={inputStyle} />
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={13} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="password" placeholder="Confirm Password *" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={inputStyle} />
                </div>

                <motion.button type="submit" disabled={isRegistering} whileHover={{ scale: isRegistering ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{ width: '100%', padding: '14px 0', borderRadius: 16, background: isRegistering ? '#1e293b' : '#D4FF00', color: isRegistering ? '#475569' : '#000', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
                  {isRegistering ? 'Creating Account...' : 'Activate My Membership'}
                </motion.button>
              </form>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center', gap: 24, paddingTop: 40 }}>
              <motion.div animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.1, 1] }} transition={{ duration: 1, delay: 0.3 }}
                style={{ width: 96, height: 96, borderRadius: 24, background: '#D4FF00', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 60px rgba(212,255,0,0.4)' }}>
                <CheckCircle2 size={48} color="#000" />
              </motion.div>

              <div>
                <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 8px' }}>Welcome to the Tribe!</h2>
                <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Your The Warrior Gym membership is active.</p>
                <p style={{ color: '#475569', fontSize: 11, marginTop: 6 }}>
                  Reward for <span style={{ color: '#D4FF00', fontWeight: 700 }}>{referrerName}</span> has been registered!
                </p>
              </div>

              <div style={{ padding: 16, borderRadius: 20, background: '#12121A', border: '1px solid rgba(255,255,255,0.05)', width: '100%' }}>
                {[['Referral Code', referralCode], ['Plan', selectedPlan], ['Status', 'Active']].map(([label, val], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <span style={{ color: '#475569', fontSize: 11 }}>{label}</span>
                    <span style={{ color: label === 'Status' ? '#34d399' : label === 'Referral Code' ? '#D4FF00' : '#fff', fontWeight: 700, fontSize: 11, fontFamily: label === 'Referral Code' ? 'monospace' : 'inherit' }}>{val}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: 11 }}>
                <Timer size={13} />
                Redirecting in {countdown}s...
              </div>

              <button onClick={() => router.push('/')}
                style={{ padding: '10px 32px', borderRadius: 16, background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}>
                Go to Dashboard Now
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}