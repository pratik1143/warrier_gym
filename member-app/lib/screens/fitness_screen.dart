import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:iconsax/iconsax.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/auth_service.dart';
import '../services/member_service.dart';
import '../widgets/glass_card.dart';

class FitnessScreen extends StatefulWidget {
  const FitnessScreen({super.key});

  @override
  State<FitnessScreen> createState() => _FitnessScreenState();
}

class _FitnessScreenState extends State<FitnessScreen> {
  final Map<int, bool> _completedExercises = {};
  String _aiResponse = "Ask me anything about your current workout or diet plans! ⚡";
  bool _aiLoading = false;
  final TextEditingController _aiQueryController = TextEditingController();

  void _askAICoach(String query) async {
    if (query.trim().isEmpty) return;
    setState(() {
      _aiLoading = true;
      _aiResponse = "";
    });

    // Simulated high-fidelity AI Trainer responses
    await Future.delayed(const Duration(milliseconds: 1500));
    
    final lower = query.toLowerCase();
    String response = "That's a great question! For your body weight and plan, I recommend focusing on progressive overload and keeping protein at 1.8g/kg. Let me know if you need specific exercise adjustments.";
    
    if (lower.contains('workout') || lower.contains('exercise') || lower.contains('push')) {
      response = "Today is your Push Day. Focus on chest, shoulders, and triceps. Ensure you warm up your rotator cuffs first, and keep rest times between 90-120 seconds for maximum strength gain!";
    } else if (lower.contains('diet') || lower.contains('calories') || lower.contains('protein')) {
      response = "Your current diet targets high protein. Make sure you hit your breakfast macros. Avoid processed carbs post-workout; opt for complex carbs like oats or sweet potato instead!";
    } else if (lower.contains('water') || lower.contains('hydrate')) {
      response = "Hydration is crucial for strength. Aim to drink 500ml water 30 mins before your workout, and continue sipping throughout to maintain muscle pump and prevent cramps.";
    }

    setState(() {
      _aiLoading = false;
      _aiResponse = response;
    });
  }

  @override
  Widget build(BuildContext context) {
    final memberService = context.watch<MemberService>();
    final workout = memberService.workoutPlan;
    final diet = memberService.dietPlan;

    final workoutName = workout?['name'] ?? 'No Workout Active';
    final exercises = (workout?['exercises'] as List?) ?? [];
    
    final calories = diet?['calories'] ?? 1800;
    final protein = diet?['protein'] ?? 140;
    final carbs = diet?['carbs'] ?? 200;
    final fats = diet?['fats'] ?? 60;
    final meals = (diet?['meals'] as Map?) ?? {};

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
                'FITNESS & DIET',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: Colors.white38,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Daily Agenda',
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 24),

              // ──── WORKOUT CARD ────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'TODAY\'S WORKOUT',
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFFD4FF00),
                      letterSpacing: 1.2,
                    ),
                  ),
                  if (workout != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFD4FF00).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${workout['type'] ?? 'Routine'}',
                        style: GoogleFonts.outfit(
                          fontSize: 9,
                          color: const Color(0xFFD4FF00),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        workoutName,
                        style: GoogleFonts.outfit(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        workout?['duration'] != null ? '${workout?['duration']} duration' : 'No workout assigned for today',
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Colors.white38,
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (exercises.isEmpty)
                        Text(
                          'Enjoy your recovery day! Rest and hydrate.',
                          style: GoogleFonts.outfit(fontSize: 13, color: Colors.white60, fontStyle: FontStyle.italic),
                        )
                      else
                        ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: exercises.length,
                          itemBuilder: (context, idx) {
                            final ex = exercises[idx] as Map;
                            final isDone = _completedExercises[idx] ?? false;
                            return GestureDetector(
                              onTap: () {
                                setState(() {
                                  _completedExercises[idx] = !isDone;
                                });
                              },
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 20, height: 20,
                                      decoration: BoxDecoration(
                                        color: isDone ? const Color(0xFFD4FF00) : Colors.transparent,
                                        border: Border.all(
                                          color: isDone ? const Color(0xFFD4FF00) : Colors.white38,
                                          width: 1.5,
                                        ),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: isDone
                                          ? const Icon(Icons.check, size: 14, color: Colors.black)
                                          : null,
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            ex['name'] ?? '',
                                            style: GoogleFonts.outfit(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w700,
                                              color: isDone ? Colors.white38 : Colors.white,
                                              decoration: isDone ? TextDecoration.lineThrough : null,
                                            ),
                                          ),
                                          Text(
                                            '${ex['sets']} sets × ${ex['reps']} reps · ${ex['weight'] ?? 'Bodyweight'}',
                                            style: GoogleFonts.outfit(
                                              fontSize: 11,
                                              color: Colors.white38,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ).animate().fadeIn(duration: 400.ms),

              const SizedBox(height: 24),

              // ──── DIET SECTION ────
              Text(
                'DIET & NUTRITION',
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
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$calories kcal',
                                style: GoogleFonts.outfit(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                'Daily Caloric Target',
                                style: GoogleFonts.outfit(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.white38,
                                ),
                              ),
                            ],
                          ),
                          const Icon(Iconsax.cup5, color: Color(0xFF0052FF), size: 28),
                        ],
                      ),
                      const SizedBox(height: 20),
                      
                      // Macros Row
                      Row(
                        children: [
                          Expanded(child: _MacroMini(label: 'Protein', value: '${protein}g', color: const Color(0xFFEF4444))),
                          const SizedBox(width: 8),
                          Expanded(child: _MacroMini(label: 'Carbs', value: '${carbs}g', color: const Color(0xFFF59E0B))),
                          const SizedBox(width: 8),
                          Expanded(child: _MacroMini(label: 'Fats', value: '${fats}g', color: const Color(0xFF10B981))),
                        ],
                      ),
                      const SizedBox(height: 20),
                      
                      const Divider(color: Colors.white12, height: 1),
                      const SizedBox(height: 16),
                      
                      // Water Intake Tracker
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${(memberService.todayWaterIntake / 1000).toStringAsFixed(2)} L',
                                style: GoogleFonts.outfit(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: const Color(0xFF00D4FF),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Water Intake (Target: 3.50 L)',
                                style: GoogleFonts.outfit(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white38,
                                ),
                              ),
                            ],
                          ),
                          Row(
                            children: [
                              GestureDetector(
                                onTap: () {
                                  final auth = context.read<AuthService>();
                                  if (auth.currentMember != null) {
                                    memberService.logWaterIntake(auth.currentMember!.id, 250);
                                  }
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.04),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.white.withOpacity(0.05)),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.add, color: Color(0xFF00D4FF), size: 12),
                                      const SizedBox(width: 4),
                                      Text(
                                        '250ml',
                                        style: GoogleFonts.outfit(fontSize: 10, color: Colors.white70, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              GestureDetector(
                                onTap: () {
                                  final auth = context.read<AuthService>();
                                  if (auth.currentMember != null) {
                                    memberService.logWaterIntake(auth.currentMember!.id, 500);
                                  }
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.04),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: Colors.white.withOpacity(0.05)),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.local_drink_rounded, color: Color(0xFF00D4FF), size: 12),
                                      const SizedBox(width: 4),
                                      Text(
                                        '500ml',
                                        style: GoogleFonts.outfit(fontSize: 10, color: Colors.white70, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Divider(color: Colors.white12, height: 1),
                      const SizedBox(height: 20),
                      
                      // Meals details
                      Text(
                        'MEALS SCHEDULE',
                        style: GoogleFonts.outfit(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: Colors.white38,
                          letterSpacing: 1.0,
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (meals.isEmpty)
                        Text(
                          'No meal plans generated yet by your trainer.',
                          style: GoogleFonts.outfit(fontSize: 13, color: Colors.white54, fontStyle: FontStyle.italic),
                        )
                      else
                        ...meals.entries.map((entry) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 70,
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.04),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  entry.key.toString().toUpperCase(),
                                  textAlign: Alignment.center.x == 0 ? TextAlign.center : null,
                                  style: GoogleFonts.outfit(
                                    fontSize: 8,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white38,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Text(
                                  entry.value.toString(),
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white70,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )),
                    ],
                  ),
                ),
              ).animate().fadeIn(delay: 100.ms),

              const SizedBox(height: 24),

              // ──── AI FIT COACH ────
              Text(
                'AI FITNESS COACH',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFFFF00A0),
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
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFF00A0).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Iconsax.flash_1, color: Color(0xFFFF00A0), size: 18),
                          ),
                          const SizedBox(width: 12),
                          Text(
                            'AlphaCoach AI',
                            style: GoogleFonts.outfit(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      
                      // AI response display
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.white.withOpacity(0.03)),
                        ),
                        child: _aiLoading
                            ? const Center(
                                child: SizedBox(
                                  width: 20, height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFFF00A0)),
                                ),
                              )
                            : Text(
                                _aiResponse,
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.white70,
                                  height: 1.5,
                                ),
                              ),
                      ),
                      const SizedBox(height: 16),
                      
                      // Query input
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _aiQueryController,
                              style: GoogleFonts.outfit(fontSize: 12, color: Colors.white),
                              decoration: InputDecoration(
                                hintText: 'Ask about workouts, macros...',
                                hintStyle: GoogleFonts.outfit(fontSize: 12, color: Colors.white24),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                filled: true,
                                fillColor: Colors.white.withOpacity(0.04),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: BorderSide.none,
                                ),
                              ),
                              onSubmitted: (val) {
                                _askAICoach(val);
                                _aiQueryController.clear();
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () {
                              _askAICoach(_aiQueryController.text);
                              _aiQueryController.clear();
                            },
                            child: Container(
                              width: 44, height: 44,
                              decoration: BoxDecoration(
                                color: const Color(0xFFFF00A0),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.send, size: 16, color: Colors.black),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn(delay: 200.ms),
              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }
}

class _MacroMini extends StatelessWidget {
  final String label, value;
  final Color color;

  const _MacroMini({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.02)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(width: 4, height: 4, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 6),
              Text(
                label,
                style: GoogleFonts.outfit(fontSize: 9, color: Colors.white38, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
