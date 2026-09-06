import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import '../models/member_model.dart';
import 'glass_card.dart';

class MembershipCardWidget extends StatelessWidget {
  final MemberModel member;

  const MembershipCardWidget({super.key, required this.member});

  @override
  Widget build(BuildContext context) {
    final daysLeft = member.daysRemaining;
    final totalDays = 30.0; // default standard reference
    final percent = (daysLeft / totalDays).clamp(0.0, 1.0);

    return GlassCard(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          const Color(0xFF1E1E2E).withOpacity(0.9),
          const Color(0xFF12121A).withOpacity(0.9),
        ],
      ),
      borderColor: const Color(0xFFD4FF00).withOpacity(0.15),
      borderWidth: 1.5,
      child: Container(
        height: 170,
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 8, height: 8,
                            decoration: const BoxDecoration(
                              color: Color(0xFFD4FF00),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Color(0xFFD4FF00),
                                  blurRadius: 8,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            member.status.toUpperCase(),
                            style: GoogleFonts.outfit(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFFD4FF00),
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        member.plan,
                        style: GoogleFonts.outfit(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Member ID: #${member.id.substring(0, Math.min(member.id.length, 6))}',
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Colors.white38,
                        ),
                      ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        member.name,
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white70,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        member.branch,
                        style: GoogleFonts.outfit(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Colors.white38,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            // Circular Progress for Days Left
            CircularPercentIndicator(
              radius: 54.0,
              lineWidth: 7.0,
              percent: percent,
              center: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '$daysLeft',
                    style: GoogleFonts.outfit(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    'DAYS LEFT',
                    style: GoogleFonts.outfit(
                      fontSize: 7,
                      fontWeight: FontWeight.w800,
                      color: Colors.white38,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
              circularStrokeCap: CircularStrokeCap.round,
              backgroundColor: Colors.white.withOpacity(0.05),
              progressColor: const Color(0xFFD4FF00),
            ),
          ],
        ),
      ),
    );
  }
}

class Math {
  static int min(int a, int b) => a < b ? a : b;
}
