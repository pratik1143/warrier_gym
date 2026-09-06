import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:iconsax/iconsax.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/auth_service.dart';
import '../widgets/glass_card.dart';

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key});

  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  bool _inviting = false;

  void _sendInvite(BuildContext context, String memberId) async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    if (name.isEmpty || email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFFEF4444),
          content: Text('Please fill all fields', style: GoogleFonts.outfit(color: Colors.white)),
        ),
      );
      return;
    }

    setState(() {
      _inviting = true;
    });

    try {
      final db = FirebaseFirestore.instance;
      await db.collection('referrals').add({
        'memberId': memberId,
        'friendName': name,
        'friendEmail': email,
        'date': DateTime.now().toIso8601String().split('T')[0],
        'status': 'invited',
        'reward': 'Pending signup',
      });

      _nameController.clear();
      _emailController.clear();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text('Invitation sent to $name! 🚀', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFFEF4444),
            content: Text('Failed to invite: $e', style: GoogleFonts.outfit(color: Colors.white)),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _inviting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final member = auth.currentMember;
    if (member == null) return const SizedBox();

    final points = member.rewardPoints ?? 350;

    final rewardsList = [
      {'name': 'Alpha Gym Shaker', 'cost': 200, 'desc': 'Premium matte finish leakproof shaker'},
      {'name': '1-Month Free Access', 'cost': 1500, 'desc': 'Extend membership plan by 30 days'},
      {'name': 'Personal Trainer Session', 'cost': 800, 'desc': '1-on-1 private workout session'},
      {'name': 'The Warrior Gym Athlete Tee', 'cost': 500, 'desc': 'Sleek black neon activewear t-shirt'},
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0F),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Text(
                'YOUR REWARDS',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: Colors.white38,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Gamification & Invites',
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 24),

              // ── POINTS CARD ──
              GlassCard(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    const Color(0xFFD4FF00).withOpacity(0.1),
                    Colors.white.withOpacity(0.02),
                  ],
                ),
                borderColor: const Color(0xFFD4FF00).withOpacity(0.12),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Row(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '$points',
                            style: GoogleFonts.outfit(
                              fontSize: 44,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFFD4FF00),
                              height: 1.0,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'REWARD POINTS BALANCE',
                            style: GoogleFonts.outfit(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              color: Colors.white38,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFD4FF00).withOpacity(0.12),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Iconsax.award5, color: Color(0xFFD4FF00), size: 32),
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn(duration: 400.ms),

              const SizedBox(height: 24),

              // ── ACHIEVEMENTS CENTER ──
              Text(
                'YOUR ACHIEVEMENTS & MILESTONES',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFFD4FF00),
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              
              SizedBox(
                height: 110,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  children: [
                    _buildMilestoneCard(
                      name: 'First Visit',
                      description: 'Start the journey',
                      icon: Iconsax.login,
                      unlocked: (member.attendanceStreak ?? 0) >= 1,
                      color: const Color(0xFF10B981),
                    ),
                    _buildMilestoneCard(
                      name: '7 Day Streak',
                      description: 'Consistent habit',
                      icon: Iconsax.flash_1,
                      unlocked: (member.attendanceStreak ?? 0) >= 7,
                      color: const Color(0xFFF59E0B),
                    ),
                    _buildMilestoneCard(
                      name: '30 Day Streak',
                      description: 'Dedication champion',
                      icon: Iconsax.award,
                      unlocked: (member.attendanceStreak ?? 0) >= 30,
                      color: const Color(0xFFFF00A0),
                    ),
                    _buildMilestoneCard(
                      name: '100 Visits Club',
                      description: 'Elite athlete roster',
                      icon: Iconsax.crown5,
                      unlocked: (member.rewardPoints ?? 0) >= 1000 || (member.attendanceStreak ?? 0) >= 100,
                      color: const Color(0xFF0052FF),
                    ),
                    _buildMilestoneCard(
                      name: 'Weight Loss Hero',
                      description: 'Hit target weight',
                      icon: Iconsax.activity,
                      unlocked: member.weight != null && member.targetWeight != null && member.weight! <= member.targetWeight!,
                      color: const Color(0xFF00D4FF),
                    ),
                    _buildMilestoneCard(
                      name: 'Transformation Champion',
                      description: 'Score 90+ Fitness Rating',
                      icon: Iconsax.ranking,
                      unlocked: (member.fitnessScore ?? 0) >= 90,
                      color: const Color(0xFFD4FF00),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // ── REFERRAL CARD ──
              Text(
                'INVITE A FRIEND',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0052FF),
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Refer & Get 1 Month Free!',
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Invite friends to join Alpha Gym. Once they purchase a plan and complete their first turnstile gate check-in, you get a 30-day extension automatically.',
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          color: Colors.white38,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 18),
                      
                      TextField(
                        controller: _nameController,
                        style: GoogleFonts.outfit(fontSize: 12, color: Colors.white),
                        decoration: InputDecoration(
                          hintText: "Friend's Full Name",
                          hintStyle: GoogleFonts.outfit(fontSize: 12, color: Colors.white24),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          filled: true,
                          fillColor: Colors.white.withOpacity(0.04),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _emailController,
                        style: GoogleFonts.outfit(fontSize: 12, color: Colors.white),
                        decoration: InputDecoration(
                          hintText: "Friend's Email Address",
                          hintStyle: GoogleFonts.outfit(fontSize: 12, color: Colors.white24),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          filled: true,
                          fillColor: Colors.white.withOpacity(0.04),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0052FF),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                          onPressed: _inviting ? null : () => _sendInvite(context, member.id),
                          child: _inviting
                              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : Text('Send Invite Link', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 13)),
                        ),
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn(delay: 100.ms),

              const SizedBox(height: 24),

              // ── STORE REDEMPTIONS ──
              Text(
                'REDEEM REWARDS CATALOG',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white38,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: rewardsList.length,
                itemBuilder: (context, idx) {
                  final reward = rewardsList[idx];
                  final name = reward['name'] as String;
                  final cost = reward['cost'] as int;
                  final desc = reward['desc'] as String;
                  final canAfford = points >= cost;

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: GlassCard(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name,
                                    style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    desc,
                                    style: GoogleFonts.outfit(fontSize: 10, color: Colors.white38, fontWeight: FontWeight.w500),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: canAfford ? const Color(0xFFD4FF00) : Colors.white.withOpacity(0.04),
                                foregroundColor: canAfford ? Colors.black : Colors.white24,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              ),
                              onPressed: canAfford
                                  ? () {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(
                                          backgroundColor: const Color(0xFF10B981),
                                          content: Text('Request logged! Present code at reception to claim. ⚡', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
                                        ),
                                      );
                                    }
                                  : null,
                              child: Text(
                                '$cost pts',
                                style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMilestoneCard({
    required String name,
    required String description,
    required IconData icon,
    required bool unlocked,
    required Color color,
  }) {
    return Container(
      width: 140,
      margin: const EdgeInsets.only(right: 12),
      child: GlassCard(
        borderColor: unlocked ? color.withOpacity(0.2) : Colors.white.withOpacity(0.03),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            unlocked ? color.withOpacity(0.08) : Colors.white.withOpacity(0.01),
            Colors.white.withOpacity(0.01),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Icon(
                    icon,
                    color: unlocked ? color : Colors.white24,
                    size: 20,
                  ),
                  Icon(
                    unlocked ? Iconsax.verify5 : Iconsax.lock,
                    color: unlocked ? color : Colors.white24,
                    size: 14,
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: unlocked ? Colors.white : Colors.white38,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    description,
                    style: GoogleFonts.outfit(
                      fontSize: 8,
                      fontWeight: FontWeight.w500,
                      color: Colors.white24,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
