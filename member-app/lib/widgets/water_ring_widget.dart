import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import 'glass_card.dart';

class WaterRingWidget extends StatelessWidget {
  final double glasses;
  final double goal;
  final VoidCallback onAdd;

  const WaterRingWidget({
    super.key,
    required this.glasses,
    required this.goal,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    final percent = (glasses / goal).clamp(0.0, 1.0);
    final isTargetReached = glasses >= goal;

    return GlassCard(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            // Circular progress indicator
            CircularPercentIndicator(
              radius: 42.0,
              lineWidth: 6.0,
              percent: percent,
              center: Icon(
                Icons.water_drop_rounded,
                color: isTargetReached ? const Color(0xFF00D4FF) : const Color(0xFF0052FF),
                size: 26,
              ),
              circularStrokeCap: CircularStrokeCap.round,
              backgroundColor: Colors.white.withOpacity(0.05),
              progressColor: const Color(0xFF0052FF),
            ),
            const SizedBox(width: 18),
            
            // Text Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'WATER INTAKE',
                    style: GoogleFonts.outfit(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Colors.white38,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  RichText(
                    text: TextSpan(
                      text: '${glasses.toInt()}',
                      style: GoogleFonts.outfit(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                      children: [
                        TextSpan(
                          text: ' / ${goal.toInt()} glasses',
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            color: Colors.white38,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isTargetReached ? 'Target achieved! Nice job 💧' : 'Stay hydrated to fuel recovery',
                    style: GoogleFonts.outfit(
                      fontSize: 10,
                      color: Colors.white38,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),

            // Plus Add Button
            GestureDetector(
              onTap: onAdd,
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFF0052FF).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: const Color(0xFF0052FF).withOpacity(0.3),
                    width: 1,
                  ),
                ),
                child: const Icon(
                  Icons.add,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
