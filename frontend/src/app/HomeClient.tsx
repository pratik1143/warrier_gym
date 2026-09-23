'use client';

import { useState, useRef, useEffect, type PointerEvent } from 'react';
import { ArrowUpRight, ArrowRight, Dumbbell, Flame, Activity, Utensils, MapPin, Menu, X, Check, MoveDown } from 'lucide-react';
import WarriorMembership from '@/components/public/WarriorMembership';
import WarriorFooter from '@/components/public/WarriorFooter';
import WarriorBookingModal from '@/components/public/WarriorBookingModal';
import WarriorLoginModal from '@/components/public/WarriorLoginModal';
import styles from './warrior-home.module.css';

const programs = [
  { title: 'BUILD STRENGTH.', tag: 'STRENGTH & MUSCLE', text: 'Build a stronger foundation. Train with purpose, progress with every rep.', icon: Dumbbell, image: '/warrior/strength.webp' },
  { title: 'BURN LIMITS.', tag: 'FAT LOSS & CONDITIONING', text: 'Move better. Push further. Make consistency your strongest habit.', icon: Flame, image: '/warrior/conditioning.webp' },
  { title: 'TRAIN WITH AMAN.', tag: 'PERSONAL TRAINING', text: 'One-to-one attention. A workout plan built around you and your goals.', icon: Activity, image: '/warrior/aman-training.png' },
  { title: 'FUEL YOUR FIGHT.', tag: 'DIET & NUTRITION', text: 'Personalized nutrition guidance to support the work you put in.', icon: Utensils, image: '/warrior/nutrition.webp' },
];
const zones = [
  { name: 'Strength zone', image: '/warrior/strength.webp', objectPosition: 'center center', title: 'REAL IRON. REAL WORK.', text: 'Free weights, resistance machines and room to focus. Everything you need to make your next rep count.', features: ['Free weights & power racks', 'Dedicated strength equipment', 'Space to train your way'] },
  { name: 'Olympic lifting', image: '/warrior/warrior-deadlift-platform.webp', objectPosition: 'center center', title: 'COMPETITION GRADE PLATFORMS.', text: 'Dedicated deadlift platforms with Olympic bumper plates, competition barbells, and shock-absorbing rubber flooring.', features: ['Dedicated deadlift platform', 'Olympic bumper plates & bars', 'Plate-loaded strength stations'] },
  { name: 'Cardio zone', image: '/warrior/arena.webp', objectPosition: 'center center', title: 'FIND YOUR NEXT GEAR.', text: 'Build your engine with dedicated cardio training. From your first warm-up to your final push.', features: ['Dedicated cardio area', 'Endurance & interval training', 'Support at every fitness level'] },
  { name: 'Personal training', image: '/warrior/aman-training.png', objectPosition: 'center 15%', title: 'YOUR GOAL. OUR FOCUS.', text: 'Work directly with a coach on your technique, training routine and the habits that move you forward.', features: ['One-to-one coaching', 'Personalized workout plans', 'Technique & progress guidance'] },
];
const links = [['Experience', '#experience'], ['Programs', '#programs'], ['The arena', '#facility'], ['Our coach', '#trainers'], ['Membership', '#membership']];

export default function HomeClient() {
  const [join, setJoin] = useState(false);
  const [login, setLogin] = useState(false);
  const [menu, setMenu] = useState(false);
  const [zone, setZone] = useState(0);
  const hero = useRef<HTMLElement>(null);
  const openJoin = () => { setMenu(false); setJoin(true); };
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenu(false); setJoin(false); setLogin(false); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);
  const tilt = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', ((event.clientX - box.left) / box.width - .5) * 12 + 'px');
    event.currentTarget.style.setProperty('--my', ((event.clientY - box.top) / box.height - .5) * 8 + 'px');
  };
  const resetTilt = () => { hero.current?.style.setProperty('--mx', '0px'); hero.current?.style.setProperty('--my', '0px'); };
  return <div className={styles.page}>
    <a href="#main-content" className={styles.skip}>Skip to content</a>
    <div className={styles.topline}><span>DISCIPLINE TODAY. STRENGTH TOMORROW.</span><span><MapPin size={12}/> SECTOR 89, MOHALI</span></div>
    <header className={styles.header}>
      <a href="#" aria-label="The Warrior Gym home" className={styles.brand}><img src="/gymlogo.png" width="88" height="60" alt="The Warrior Gym logo"/><span>THE WARRIOR<small>GYM · MOHALI</small></span></a>
      <nav className={styles.desktopNav} aria-label="Main navigation">{links.map(([text, href]) => <a key={href} href={href}>{text}</a>)}</nav>
      <button className={styles.navCta} onClick={openJoin}>JOIN THE TRIBE <ArrowUpRight size={17}/></button>
      <button className={styles.menuButton} aria-expanded={menu} aria-controls="mobile-navigation" aria-label={menu ? 'Close menu' : 'Open menu'} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button>
      {menu && <nav id="mobile-navigation" className={styles.mobileNav} aria-label="Mobile navigation">{links.map(([text, href]) => <a key={href} href={href} onClick={() => setMenu(false)}>{text}<ArrowUpRight size={18}/></a>)}<button onClick={openJoin}>Start your journey <ArrowRight size={18}/></button></nav>}
    </header>
    <main id="main-content">
      <section ref={hero} className={styles.hero} onPointerMove={tilt} onPointerLeave={resetTilt}>
        <div className={styles.heroVisual}><img src="/warrior/aman-hero.webp" alt="Aman, personal trainer at The Warrior Gym" fetchPriority="high" width="1000" height="1500"/><div className={styles.photoShade}/></div>
        <div className={styles.heroGhost} aria-hidden="true">WARRIOR</div>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}><span/> THE WARRIOR GYM / MOHALI</p>
          <h1>UNLEASH<br/>YOUR INNER<br/><em>WARRIOR.</em></h1>
          <p className={styles.heroDescription}>More than a gym. A mindset.<br/>Build your strength. Own your transformation.</p>
          <div className={styles.actions}><button className={styles.primary} onClick={openJoin}>START YOUR JOURNEY <ArrowUpRight size={20}/></button><a className={styles.textLink} href="#facility">EXPLORE THE ARENA <ArrowUpRight size={18}/></a></div>
          <div className={styles.heroDetails}><div><Dumbbell size={19}/><span>Serious training.<br/><strong>Every fitness level.</strong></span></div><div><span className={styles.detailNumber}>01</span><span>One decision.<br/><strong>A stronger you.</strong></span></div></div>
        </div>
        <div className={styles.coachTag}><span className={styles.cross}>+</span><div>BUILT THROUGH DISCIPLINE<strong>AMAN</strong><span>PERSONAL TRAINER</span></div><ArrowUpRight size={24}/></div>
        <div className={styles.verticalLabel}>STRENGTH IS EARNED. NEVER GIVEN.</div>
        <a className={styles.scroll} href="#experience"><MoveDown size={16}/> SCROLL TO DISCOVER</a>
        <div className={styles.heroIndex}>01 <span>/ THE BEGINNING</span></div>
      </section>
      <div className={styles.ticker} aria-label="Strength, discipline, consistency, transformation"><span>STRENGTH</span><b>✳</b><span>DISCIPLINE</span><b>✳</b><span>CONSISTENCY</span><b>✳</b><span>TRANSFORMATION</span><b>✳</b></div>
      <section id="experience" className={styles.experience}>
        <div><p className={styles.eyebrow}>01 / THE WARRIOR MINDSET</p><h2>YOU DON'T JUST<br/>JOIN A GYM.<br/><em>YOU BECOME MORE.</em></h2></div>
        <div className={styles.experienceCopy}><p>No shortcuts. No overnight promises. Just the right environment, focused coaching and the work you choose to put in.</p><p>From your very first session to your next personal best, there is a place for you at The Warrior Gym.</p><a className={styles.textLink} href="#programs">FIND YOUR WAY TO TRAIN <ArrowUpRight size={19}/></a></div>
      </section>
      <section id="programs" className={styles.section}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / BUILT AROUND YOUR GOALS</p><h2>DIFFERENT GOALS.<br/><em>SAME WARRIOR SPIRIT.</em></h2></div><p>Find your focus.<br/>We bring the plan. You bring the drive.</p></div>
        <div className={styles.programGrid}>{programs.map((program, index) => <button key={program.title} className={styles.program} onClick={openJoin}>
          <img src={program.image} alt="" loading="lazy"/><span className={styles.cardShade}/><span className={styles.cardTop}><program.icon size={26}/><span>0{index+1}</span></span><span className={styles.cardContent}><small>{program.tag}</small><strong>{program.title}</strong><span>{program.text}</span><span className={styles.cardArrow}><ArrowUpRight size={22}/></span></span>
        </button>)}</div>
      </section>
      <section id="facility" className={styles.arena}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / YOUR TRAINING GROUND</p><h2>WELCOME TO<br/><em>THE ARENA.</em></h2></div><p>Real equipment. Real energy.<br/>A space that makes you want to show up.</p></div>
        <div className={styles.zoneTabs} role="tablist" aria-label="Gym training zones">{zones.map((item,index) => <button key={item.name} id={'zone-tab-'+index} role="tab" type="button" aria-selected={zone===index} aria-controls="zone-panel" tabIndex={zone===index?0:-1} onClick={()=>setZone(index)} onKeyDown={event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?zones.length-1:(zone+(event.key==='ArrowRight'?1:zones.length-1))%zones.length;setZone(next);document.getElementById('zone-tab-'+next)?.focus();}}}>0{index+1} <span>{item.name}</span><ArrowUpRight size={17}/></button>)}</div>
        <div id="zone-panel" role="tabpanel" aria-labelledby={'zone-tab-'+zone} className={styles.zonePanel}><img key={zones[zone].image} src={zones[zone].image} alt={zones[zone].name+' at The Warrior Gym'} loading="lazy" style={{objectPosition: zones[zone].objectPosition || 'center center'}}/><div className={styles.zoneInfo}><span className={styles.eyebrow}>THE WARRIOR GYM · MOHALI</span><h3>{zones[zone].title}</h3><p>{zones[zone].text}</p><ul>{zones[zone].features.map(feature=><li key={feature}><Check size={16}/>{feature}</li>)}</ul><button className={styles.textLink} onClick={openJoin}>COME EXPERIENCE IT <ArrowUpRight size={18}/></button></div></div>
      </section>
      <section id="trainers" className={styles.coach}>
        <div className={styles.coachPhoto}><img src="/warrior/aman-training.png" alt="Aman demonstrating his physique at the gym" loading="lazy" width="532" height="709"/><span className={styles.photoShade}/><span className={styles.signature}>Aman.</span><span className={styles.photoCaption}>YOUR COACH. IN YOUR CORNER.</span></div>
        <div className={styles.coachCopy}><p className={styles.eyebrow}>04 / TRAIN WITH AMAN</p><h2>DISCIPLINE TODAY.<br/><em>STRENGTH<br/>TOMORROW.</em></h2><p>Make every session count. Train with Aman for focused guidance, a personalized workout plan and support that keeps you moving towards your goals.</p><div className={styles.coachServices}><span><Check size={17}/> Muscle building</span><span><Check size={17}/> Fat loss</span><span><Check size={17}/> Fitness training</span><span><Check size={17}/> Diet & nutrition</span></div><button className={styles.primary} onClick={openJoin}>TRAIN WITH AMAN <ArrowUpRight size={20}/></button><a href="/team" className={styles.textLink}>MEET THE FULL TEAM <ArrowUpRight size={17}/></a></div>
      </section>
      <div className={styles.membershipWrap}><WarriorMembership onOpenJoinModal={openJoin}/></div>
      <section className={styles.finalCta}><p className={styles.eyebrow}>YOUR DAY ONE STARTS HERE.</p><h2>LESS EXCUSES.<br/><span>MORE WARRIOR.</span></h2><button onClick={openJoin}>LET'S GET TO WORK <ArrowUpRight size={22}/></button><p>Sector 89, Mohali <span>·</span> Open 7 days a week</p></section>
    </main>
    <WarriorFooter onOpenLoginModal={()=>setLogin(true)}/>
    <WarriorBookingModal isOpen={join} onClose={()=>setJoin(false)}/>
    <WarriorLoginModal isOpen={login} onClose={()=>setLogin(false)}/>
  </div>;
}
