import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:iconsax/iconsax.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../services/auth_service.dart';
import '../services/member_service.dart';
import '../widgets/glass_card.dart';
import '../widgets/gym_crowd_widget.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _checkingIn = false;

  void _simulateCheckIn(BuildContext context, String memberId, String name, String branch) async {
    setState(() {
      _checkingIn = true;
    });

    try {
      final memberService = context.read<MemberService>();
      await memberService.scanQRCheckIn(memberId, name, branch);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF10B981),
            content: Text(
              'Successfully checked in at $branch! ⚡',
              style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: Colors.white),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFFEF4444),
            content: Text('Failed to check in: $e', style: GoogleFonts.outfit(color: Colors.white)),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _checkingIn = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final member = auth.currentMember;
    if (member == null) return const SizedBox();

    final memberService = context.watch<MemberService>();
    final logs = memberService.attendanceLogs;

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
                'CHECK-IN CENTER',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: Colors.white38,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Access Pass',
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 24),

              // ── QR CARD ──
              Center(
                child: Column(
                  children: [
                    GlassCard(
                      borderColor: const Color(0xFFD4FF00).withOpacity(0.15),
                      borderWidth: 1.5,
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                // Photo
                                Container(
                                  width: 50, height: 50,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFD4FF00),
                                    borderRadius: BorderRadius.circular(16),
                                    image: member.avatarUrl != null && member.avatarUrl!.isNotEmpty
                                        ? DecorationImage(
                                            image: NetworkImage(member.avatarUrl!),
                                            fit: BoxFit.cover,
                                          )
                                        : null,
                                  ),
                                  child: member.avatarUrl == null || member.avatarUrl!.isEmpty
                                      ? Center(
                                          child: Text(
                                            member.name.isNotEmpty ? member.name[0].toUpperCase() : 'A',
                                            style: GoogleFonts.outfit(
                                              fontSize: 20,
                                              fontWeight: FontWeight.w900,
                                              color: Colors.black,
                                            ),
                                          ),
                                        )
                                      : null,
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        member.name.toUpperCase(),
                                        style: GoogleFonts.outfit(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
                                          letterSpacing: 0.8,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        member.memberId ?? 'TWG-2026-0001',
                                        style: GoogleFonts.outfit(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800,
                                          color: const Color(0xFFD4FF00),
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: member.status == 'active' ? const Color(0xFF10B981).withOpacity(0.15) : const Color(0xFFEF4444).withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    member.status.toUpperCase(),
                                    style: GoogleFonts.outfit(
                                      fontSize: 8,
                                      fontWeight: FontWeight.bold,
                                      color: member.status == 'active' ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const Divider(color: Colors.white12, height: 32),
                            
                            // QR code image
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: QrImageView(
                                data: member.memberId ?? member.id,
                                version: QrVersions.auto,
                                size: 140.0,
                                gapless: false,
                                foregroundColor: Colors.black,
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'HOLD NEAR BIOMETRIC Cloud TURNSTILE',
                              style: GoogleFonts.outfit(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: Colors.white38,
                                letterSpacing: 0.8,
                              ),
                            ),
                            const Divider(color: Colors.white12, height: 32),
                            
                            // Emergency & Trainer Row
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'EMERGENCY CONTACT',
                                      style: GoogleFonts.outfit(fontSize: 8, color: Colors.white38, fontWeight: FontWeight.bold),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      member.emergencyContact != null && member.emergencyContact!.isNotEmpty
                                          ? member.emergencyContact!
                                          : 'N/A',
                                      style: GoogleFonts.outfit(fontSize: 10, color: Colors.white70, fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      'PT INSTRUCTOR',
                                      style: GoogleFonts.outfit(fontSize: 8, color: Colors.white38, fontWeight: FontWeight.bold),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      member.trainer != null && member.trainer!.isNotEmpty ? member.trainer! : 'None Assigned',
                                      style: GoogleFonts.outfit(fontSize: 10, color: Colors.white70, fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ).animate().fadeIn(duration: 450.ms).scale(begin: const Offset(0.95, 0.95)),
                    
                    const SizedBox(height: 20),
                    
                    // Simulate scan button
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFD4FF00),
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
                      onPressed: _checkingIn
                          ? null
                          : () => _simulateCheckIn(context, member.id, member.name, member.branch),
                      icon: _checkingIn
                          ? const SizedBox(
                              width: 16, height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.black),
                            )
                          : const Icon(Iconsax.scan5, size: 18),
                      label: Text(
                        _checkingIn ? 'Checking In...' : 'Simulate Turnstile Gate Scan',
                        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // ── Crowd meter ──
              Text(
                'LIVE GYM CAPACITY',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white38,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              const GymCrowdWidget(),

              const SizedBox(height: 32),

              // ── Attendance logs history ──
              Text(
                'CHECK-IN LOGS HISTORY',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white38,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              if (logs.isEmpty)
                GlassCard(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Center(
                      child: Text(
                        'No attendance logs recorded yet. Visit the gym today!',
                        style: GoogleFonts.outfit(fontSize: 12, color: Colors.white38, fontStyle: FontStyle.italic),
                      ),
                    ),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: logs.length > 5 ? 5 : logs.length,
                  itemBuilder: (context, idx) {
                    final log = logs[idx];
                    final checkIn = DateTime.tryParse(log['checkIn'] ?? '') ?? DateTime.now();
                    final checkOutStr = log['checkOut'];
                    final checkOut = checkOutStr != null ? DateTime.tryParse(checkOutStr) : null;
                    
                    final dateFormatted = '${checkIn.day}/${checkIn.month}/${checkIn.year}';
                    final checkinFormatted = '${checkIn.hour.toString().padLeft(2, '0')}:${checkIn.minute.toString().padLeft(2, '0')}';
                    final checkoutFormatted = checkOut != null
                        ? '${checkOut.hour.toString().padLeft(2, '0')}:${checkOut.minute.toString().padLeft(2, '0')}'
                        : 'Active';

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: GlassCard(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.04),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(Iconsax.calendar5, color: Color(0xFFD4FF00), size: 16),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      dateFormatted,
                                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                                    ),
                                    Text(
                                      'Mohali Branch',
                                      style: GoogleFonts.outfit(fontSize: 10, color: Colors.white38, fontWeight: FontWeight.w500),
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    'In: $checkinFormatted',
                                    style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white70),
                                  ),
                                  Text(
                                    checkOut != null ? 'Out: $checkoutFormatted' : 'Inside',
                                    style: GoogleFonts.outfit(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: checkOut != null ? Colors.white38 : const Color(0xFF10B981),
                                    ),
                                  ),
                                ],
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
}
