import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:iconsax/iconsax.dart';
import 'package:intl/intl.dart';
import '../services/auth_service.dart';
import '../models/member_model.dart';
import '../widgets/glass_card.dart';
import '../widgets/membership_card_widget.dart';
import '../widgets/water_ring_widget.dart';
import '../widgets/streak_widget.dart';
import '../widgets/gym_crowd_widget.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  double _waterGlasses = 0;
  final int _waterGoal = 8;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final member = auth.currentMember;
    if (member == null) return const SizedBox();

    final greeting = _greeting();
    final firstName = member.name.split(' ').first;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0F),
      body: SafeArea(
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            // ── Top Header ──
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(greeting,
                            style: GoogleFonts.outfit(fontSize: 13, color: Colors.white38, fontWeight: FontWeight.w500)),
                          const SizedBox(height: 2),
                          Text('Hey, $firstName 👋',
                            style: GoogleFonts.outfit(fontSize: 24, color: Colors.white, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                    

                    // Avatar
                    Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFD4FF00),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Center(
                        child: Text(
                          member.name.isNotEmpty ? member.name[0].toUpperCase() : 'A',
                          style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.black),
                        ),
                      ),
                    ),
                  ],
                ).animate().fadeIn(duration: 400.ms),
              ),
            ),

            SliverToBoxAdapter(child: const SizedBox(height: 24)),
            // ── Membership Card ──
            SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: MembershipCardWidget(member: member)
                    .animate().fadeIn(delay: 100.ms).slideY(begin: 0.05),
                ),
              ),

              SliverToBoxAdapter(child: const SizedBox(height: 20)),

              // ── Stats Row ──
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      Expanded(child: _StatMini(label: 'Streak', value: '${member.attendanceStreak ?? 0}', unit: 'days', icon: Iconsax.flash_1, color: const Color(0xFFF59E0B))),
                      const SizedBox(width: 12),
                      Expanded(child: _StatMini(label: 'Fitness Score', value: '${member.fitnessScore ?? 0}', unit: '/100', icon: Iconsax.activity5, color: const Color(0xFF10B981))),
                      const SizedBox(width: 12),
                      Expanded(child: _StatMini(label: 'Points', value: '${member.rewardPoints ?? 0}', unit: 'pts', icon: Iconsax.award5, color: const Color(0xFFD4FF00))),
                    ],
                  ).animate().fadeIn(delay: 200.ms),
                ),
              ),

              SliverToBoxAdapter(child: const SizedBox(height: 20)),

              // ── Water Tracker ──
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: WaterRingWidget(
                    glasses: _waterGlasses,
                    goal: _waterGoal.toDouble(),
                    onAdd: () => setState(() {
                      if (_waterGlasses < _waterGoal) _waterGlasses += 1;
                    }),
                  ).animate().fadeIn(delay: 300.ms),
                ),
              ),

              SliverToBoxAdapter(child: const SizedBox(height: 16)),

              // ── Live Gym Crowd ──
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: const GymCrowdWidget().animate().fadeIn(delay: 350.ms),
                ),
              ),

              SliverToBoxAdapter(child: const SizedBox(height: 16)),

              // ── Today's Workout Preview ──
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: _TodayWorkoutCard().animate().fadeIn(delay: 400.ms),
                ),
              ),

              SliverToBoxAdapter(child: const SizedBox(height: 16)),

              // ── Trainer message ──
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: _TrainerMessageCard(trainer: member.trainer ?? 'Your Trainer').animate().fadeIn(delay: 450.ms),
                ),
              ),

              SliverToBoxAdapter(child: const SizedBox(height: 100)),
            ],
          ),
        ),
      );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning ☀️';
    if (h < 17) return 'Good Afternoon 🌤';
    if (h < 21) return 'Good Evening 🌆';
    return 'Good Night 🌙';
  }
}

// ── Stat Mini Widget ──
class _StatMini extends StatelessWidget {
  final String label, value, unit;
  final IconData icon;
  final Color color;

  const _StatMini({required this.label, required this.value, required this.unit, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(height: 10),
            RichText(
              text: TextSpan(
                text: value,
                style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white),
                children: [
                  TextSpan(text: ' $unit', style: GoogleFonts.outfit(fontSize: 10, color: Colors.white38, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
            const SizedBox(height: 2),
            Text(label, style: GoogleFonts.outfit(fontSize: 10, color: Colors.white38, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

// ── Today Workout Card ──
class _TodayWorkoutCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final exercises = ['Bench Press · 4×10', 'Pull-ups · 3×8', 'Squats · 4×12', 'Shoulder Press · 3×10'];
    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Iconsax.activity5, color: Color(0xFFD4FF00), size: 16),
                const SizedBox(width: 8),
                Text(
                  "TODAY'S WORKOUT",
                  style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white38, letterSpacing: 1.2),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: const Color(0xFFD4FF00).withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
                  child: Text('Push Day', style: GoogleFonts.outfit(fontSize: 10, color: const Color(0xFFD4FF00), fontWeight: FontWeight.w700)),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ...exercises.map((ex) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(width: 6, height: 6, decoration: BoxDecoration(color: const Color(0xFFD4FF00), shape: BoxShape.circle)),
                  const SizedBox(width: 10),
                  Text(ex, style: GoogleFonts.outfit(fontSize: 13, color: Colors.white70, fontWeight: FontWeight.w500)),
                ],
              ),
            )),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFD4FF00),
                borderRadius: BorderRadius.circular(14),
              ),
              width: double.infinity,
              child: Center(
                child: Text('Start Workout →', style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.black)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Trainer Message Card ──
class _TrainerMessageCard extends StatelessWidget {
  final String trainer;
  const _TrainerMessageCard({required this.trainer});

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      gradient: LinearGradient(colors: [const Color(0xFF0052FF).withOpacity(0.15), Colors.transparent]),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: const Color(0xFF0052FF), borderRadius: BorderRadius.circular(14)),
              child: const Icon(Iconsax.message5, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(trainer,
                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
                  const SizedBox(height: 3),
                  Text('Great work this week! Keep the momentum going 💪',
                    style: GoogleFonts.outfit(fontSize: 11, color: Colors.white54)),
                ],
              ),
            ),
            Container(
              width: 8, height: 8,
              decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
            ),
          ],
        ),
      ),
    );
  }
}
