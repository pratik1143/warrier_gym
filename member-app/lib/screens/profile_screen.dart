import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:iconsax/iconsax.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import '../services/auth_service.dart';
import '../services/member_service.dart';
import '../widgets/glass_card.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _sendingSOS = false;

  void _triggerSOS(BuildContext context) async {
    setState(() {
      _sendingSOS = true;
    });

    // Simulate sending SOS to Mohali branch dashboard
    await Future.delayed(const Duration(milliseconds: 1200));

    if (mounted) {
      setState(() {
        _sendingSOS = false;
      });
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: const Color(0xFF12121A),
          title: Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444)),
              const SizedBox(width: 8),
              Text(
                'SOS Alert Active',
                style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: Text(
            'Emergency assistance signal has been broadcasted to the Mohali Gym front desk. Staff has been notified of your location. Stay calm.',
            style: GoogleFonts.outfit(color: Colors.white70, fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'Dismiss',
                style: GoogleFonts.outfit(color: const Color(0xFFD4FF00), fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      );
    }
  }

  void _showRenewUpgradeDialog(BuildContext context, String memberId, String memberName, String currentPlan) {
    String selectedPlan = 'Monthly';
    final plansMap = {
      'Monthly': {'price': 2500.0, 'desc': '30 Days Unlimited Access'},
      'Quarterly': {'price': 6500.0, 'desc': '90 Days Unlimited Access'},
      'Semi-Annual': {'price': 11500.0, 'desc': '180 Days Unlimited Access + 2 Guest Passes'},
      'Annual Premium': {'price': 18000.0, 'desc': '365 Days Unlimited Access + 5 Guest Passes + PT Session'},
    };

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF12121A),
              surfaceTintColor: Colors.transparent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: BorderSide(color: Colors.white.withOpacity(0.05))),
              title: Text(
                'Renew or Upgrade Plan',
                style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: plansMap.entries.map((entry) {
                      final planName = entry.key;
                      final details = entry.value;
                      final isSelected = selectedPlan == planName;
                      final isCurrent = currentPlan == planName;

                      return GestureDetector(
                        onTap: () {
                          setDialogState(() {
                            selectedPlan = planName;
                          });
                        },
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFD4FF00).withOpacity(0.08) : Colors.white.withOpacity(0.02),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isSelected ? const Color(0xFFD4FF00) : Colors.white.withOpacity(0.05),
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          planName,
                                          style: GoogleFonts.outfit(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                        ),
                                        if (isCurrent) ...[
                                          const SizedBox(width: 8),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF0052FF).withOpacity(0.2),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              'Current',
                                              style: GoogleFonts.outfit(color: const Color(0xFF00D4FF), fontSize: 8, fontWeight: FontWeight.bold),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      details['desc'] as String,
                                      style: GoogleFonts.outfit(color: Colors.white38, fontSize: 10),
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                '₹${(details['price'] as double).toStringAsFixed(0)}',
                                style: GoogleFonts.outfit(
                                  color: const Color(0xFFD4FF00),
                                  fontWeight: FontWeight.w900,
                                  fontSize: 16,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    'Cancel',
                    style: GoogleFonts.outfit(color: Colors.white38, fontWeight: FontWeight.bold),
                  ),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFD4FF00),
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () async {
                    Navigator.pop(context);
                    final amt = (plansMap[selectedPlan]?['price'] as double?) ?? 2500.0;
                    
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        backgroundColor: const Color(0xFF0052FF),
                        content: Text('Connecting with UPI Gateways... 💳', style: GoogleFonts.outfit(color: Colors.white)),
                      ),
                    );

                    await Future.delayed(const Duration(milliseconds: 1500));

                    try {
                      await context.read<MemberService>().renewUpgradeMembership(memberId, memberName, selectedPlan, amt);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor: const Color(0xFF10B981),
                            content: Text('Membership upgraded to $selectedPlan! Expiry extended. 🚀', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor: const Color(0xFFEF4444),
                            content: Text('Renewal failed: $e', style: GoogleFonts.outfit(color: Colors.white)),
                          ),
                        );
                      }
                    }
                  },
                  child: Text(
                    'Confirm Pay UPI',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showFreezeRequestDialog(BuildContext context, String memberId) {
    DateTime? startDate;
    DateTime? endDate;
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final startStr = startDate == null ? 'Select Start Date' : DateFormat('dd MMM yyyy').format(startDate!);
            final endStr = endDate == null ? 'Select End Date' : DateFormat('dd MMM yyyy').format(endDate!);

            return AlertDialog(
              backgroundColor: const Color(0xFF12121A),
              surfaceTintColor: Colors.transparent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: BorderSide(color: Colors.white.withOpacity(0.05))),
              title: Row(
                children: [
                  const Icon(Icons.ac_unit, color: Color(0xFF00D4FF), size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Request Membership Freeze',
                    style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Temporary suspend your membership contract for travel or medical reasons.',
                      style: GoogleFonts.outfit(color: Colors.white38, fontSize: 10),
                    ),
                    const SizedBox(height: 16),
                    
                    GestureDetector(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now().add(const Duration(days: 1)),
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 90)),
                        );
                        if (picked != null) {
                          setDialogState(() {
                            startDate = picked;
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(color: Colors.white.withOpacity(0.04), borderRadius: BorderRadius.circular(12)),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(startStr, style: GoogleFonts.outfit(color: startDate == null ? Colors.white24 : Colors.white, fontSize: 12)),
                            const Icon(Iconsax.calendar5, color: Colors.white38, size: 16),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),

                    GestureDetector(
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: (startDate ?? DateTime.now()).add(const Duration(days: 7)),
                          firstDate: startDate ?? DateTime.now(),
                          lastDate: (startDate ?? DateTime.now()).add(const Duration(days: 180)),
                        );
                        if (picked != null) {
                          setDialogState(() {
                            endDate = picked;
                          });
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(color: Colors.white.withOpacity(0.04), borderRadius: BorderRadius.circular(12)),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(endStr, style: GoogleFonts.outfit(color: endDate == null ? Colors.white24 : Colors.white, fontSize: 12)),
                            const Icon(Iconsax.calendar5, color: Colors.white38, size: 16),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),

                    TextField(
                      controller: reasonController,
                      style: GoogleFonts.outfit(fontSize: 12, color: Colors.white),
                      decoration: InputDecoration(
                        hintText: 'Reason for freeze request...',
                        hintStyle: GoogleFonts.outfit(fontSize: 12, color: Colors.white24),
                        filled: true,
                        fillColor: Colors.white.withOpacity(0.04),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    'Cancel',
                    style: GoogleFonts.outfit(color: Colors.white38, fontWeight: FontWeight.bold),
                  ),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF00D4FF),
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () async {
                    if (startDate == null || endDate == null || reasonController.text.trim().isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          backgroundColor: const Color(0xFFEF4444),
                          content: Text('Please select dates and fill reason', style: GoogleFonts.outfit(color: Colors.white)),
                        ),
                      );
                      return;
                    }
                    Navigator.pop(context);
                    
                    try {
                      final startStr = DateFormat('yyyy-MM-dd').format(startDate!);
                      final endStr = DateFormat('yyyy-MM-dd').format(endDate!);
                      await context.read<MemberService>().submitFreezeRequest(memberId, startStr, endStr, reasonController.text.trim());
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor: const Color(0xFF10B981),
                            content: Text('Freeze request submitted successfully! Pending approval. ❄️', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor: const Color(0xFFEF4444),
                            content: Text('Request failed: $e', style: GoogleFonts.outfit(color: Colors.white)),
                          ),
                        );
                      }
                    }
                  },
                  child: Text(
                    'Submit Request',
                    style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final member = auth.currentMember;
    if (member == null) return const SizedBox();

    final memberService = context.watch<MemberService>();
    final paymentLogs = memberService.paymentLogs;
    final freezeRequests = memberService.freezeRequests;

    final bmi = member.bmi;
    String bmiCategory = 'N/A';
    Color bmiColor = Colors.white54;
    
    if (bmi != null) {
      if (bmi < 18.5) {
        bmiCategory = 'Underweight';
        bmiColor = const Color(0xFF00D4FF);
      } else if (bmi < 25) {
        bmiCategory = 'Normal';
        bmiColor = const Color(0xFF10B981);
      } else if (bmi < 30) {
        bmiCategory = 'Overweight';
        bmiColor = const Color(0xFFF59E0B);
      } else {
        bmiCategory = 'Obese';
        bmiColor = const Color(0xFFEF4444);
      }
    }

    final joinStr = DateFormat('dd MMM yyyy').format(member.joinDate);
    final expiryStr = DateFormat('dd MMM yyyy').format(member.expiryDate);

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
                'MY PROFILE',
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  color: Colors.white38,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Personal File',
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 24),

              // ── PROFILE AVATAR BLOCK ──
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 80, height: 80,
                      decoration: BoxDecoration(
                        color: const Color(0xFFD4FF00),
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFD4FF00).withOpacity(0.2),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          member.name.isNotEmpty ? member.name[0].toUpperCase() : 'A',
                          style: GoogleFonts.outfit(
                            fontSize: 32,
                            fontWeight: FontWeight.w900,
                            color: Colors.black,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      member.name,
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      member.email,
                      style: GoogleFonts.outfit(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Colors.white38,
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn(duration: 400.ms),

              const SizedBox(height: 28),

              // ── EMERGENCY SOS ALERT ──
              GestureDetector(
                onTap: _sendingSOS ? null : () => _triggerSOS(context),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: const Color(0xFFEF4444).withOpacity(0.25),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _sendingSOS
                          ? const SizedBox(
                              width: 16, height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFEF4444)),
                            )
                          : const Icon(Iconsax.danger5, color: Color(0xFFEF4444), size: 18),
                      const SizedBox(width: 10),
                      Text(
                        _sendingSOS ? 'BROADCASTING SOS...' : 'TRIGGER EMERGENCY SOS',
                        style: GoogleFonts.outfit(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFFEF4444),
                          letterSpacing: 1.0,
                        ),
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn(delay: 100.ms),

              const SizedBox(height: 24),

              // ── PLAN DETAIL CARD (MEMBERSHIP CENTER) ──
              Text(
                'MEMBERSHIP CENTER',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white38,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              
              GlassCard(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      _RowProfile(label: 'Plan Type', value: member.plan),
                      const Divider(color: Colors.white12, height: 20),
                      _RowProfile(label: 'Assigned Branch', value: member.branch),
                      const Divider(color: Colors.white12, height: 20),
                      _RowProfile(label: 'Start Date', value: joinStr),
                      const Divider(color: Colors.white12, height: 20),
                      _RowProfile(label: 'Expiry Date', value: expiryStr),
                      const Divider(color: Colors.white12, height: 20),
                      _RowProfile(label: 'Renewal Date', value: expiryStr),
                      const Divider(color: Colors.white12, height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Payment Status',
                            style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white38),
                          ),
                          Text(
                            member.isExpired ? 'EXPIRED ⚠️' : 'PAID ⚡',
                            style: GoogleFonts.outfit(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              color: member.isExpired ? const Color(0xFFEF4444) : const Color(0xFF10B981),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFD4FF00),
                                foregroundColor: Colors.black,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 0,
                              ),
                              onPressed: () => _showRenewUpgradeDialog(context, member.id, member.name, member.plan),
                              icon: const Icon(Iconsax.refresh_21, size: 16),
                              label: Text('Renew / Upgrade', style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold)),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF00D4FF),
                                side: const BorderSide(color: Color(0xFF00D4FF)),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              onPressed: () => _showFreezeRequestDialog(context, member.id),
                              icon: const Icon(Icons.ac_unit, size: 16),
                              label: Text('Freeze Plan', style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn(delay: 150.ms),

              const SizedBox(height: 24),

              // ── MEMBERSHIP HISTORY (INVOICES) ──
              Text(
                'MEMBERSHIP PAYMENT HISTORY',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white38,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              if (paymentLogs.isEmpty)
                GlassCard(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Center(
                      child: Text(
                        'No billing records found.',
                        style: GoogleFonts.outfit(fontSize: 12, color: Colors.white38, fontStyle: FontStyle.italic),
                      ),
                    ),
                  ),
                )
              else
                ...paymentLogs.map((p) {
                  final amt = (p['amount'] as num?)?.toDouble() ?? 0.0;
                  final dateStr = p['date'] ?? '';
                  final inv = p['invoice'] ?? 'INV-XXXX';
                  final pPlan = p['plan'] ?? 'Monthly';
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
                              child: const Icon(Iconsax.receipt_21, color: Color(0xFF10B981), size: 18),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '$pPlan Renewal',
                                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                                  ),
                                  Text(
                                    '$inv · $dateStr',
                                    style: GoogleFonts.outfit(fontSize: 9, color: Colors.white38),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '₹${amt.toStringAsFixed(0)}',
                                  style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w900, color: const Color(0xFF10B981)),
                                ),
                                Text(
                                  'PAID',
                                  style: GoogleFonts.outfit(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.white38),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),

              const SizedBox(height: 24),

              // ── MEMBERSHIP FREEZE REQUESTS ──
              Text(
                'MEMBERSHIP FREEZE REQUESTS',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white38,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 10),
              if (freezeRequests.isEmpty)
                GlassCard(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Center(
                      child: Text(
                        'No freeze requests recorded.',
                        style: GoogleFonts.outfit(fontSize: 12, color: Colors.white38, fontStyle: FontStyle.italic),
                      ),
                    ),
                  ),
                )
              else
                ...freezeRequests.map((f) {
                  final start = f['startDate'] ?? '';
                  final end = f['endDate'] ?? '';
                  final reason = f['reason'] ?? '';
                  final status = f['status'] ?? 'pending';
                  final isApproved = status == 'approved';
                  final isPending = status == 'pending';

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
                              child: const Icon(Icons.ac_unit, color: Color(0xFF00D4FF), size: 18),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '$start to $end',
                                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
                                  ),
                                  Text(
                                    'Reason: $reason',
                                    style: GoogleFonts.outfit(fontSize: 10, color: Colors.white38),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: isApproved
                                    ? const Color(0xFF10B981).withOpacity(0.12)
                                    : isPending
                                        ? const Color(0xFFF59E0B).withOpacity(0.12)
                                        : const Color(0xFFEF4444).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                status.toUpperCase(),
                                style: GoogleFonts.outfit(
                                  fontSize: 8,
                                  fontWeight: FontWeight.bold,
                                  color: isApproved
                                      ? const Color(0xFF10B981)
                                      : isPending
                                          ? const Color(0xFFF59E0B)
                                          : const Color(0xFFEF4444),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),

              const SizedBox(height: 24),

              // ── BODY STATS & BMI ──
              Text(
                'BODY STATISTICS',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white38,
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
                          _StatBox(label: 'Weight', value: member.weight != null ? '${member.weight} kg' : 'N/A'),
                          Container(width: 1, height: 40, color: Colors.white12),
                          _StatBox(label: 'Height', value: member.height != null ? '${member.height} cm' : 'N/A'),
                          Container(width: 1, height: 40, color: Colors.white12),
                          _StatBox(
                            label: 'BMI Score',
                            value: bmi != null ? bmi.toStringAsFixed(1) : 'N/A',
                            subValue: bmiCategory,
                            subValueColor: bmiColor,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn(delay: 200.ms),

              const SizedBox(height: 32),

              // ── LOGOUT BUTTON ──
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    backgroundColor: Colors.white.withOpacity(0.02),
                  ),
                  onPressed: () async {
                    await auth.logout();
                  },
                  child: Text(
                    'SIGN OUT FROM ALPHA APP',
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFFEF4444),
                      letterSpacing: 1.0,
                    ),
                  ),
                ),
              ).animate().fadeIn(delay: 250.ms),
              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }
}

class _RowProfile extends StatelessWidget {
  final String label, value;

  const _RowProfile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white38),
        ),
        Text(
          value,
          style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white),
        ),
      ],
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label, value;
  final String? subValue;
  final Color? subValueColor;

  const _StatBox({required this.label, required this.value, this.subValue, this.subValueColor});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white38),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.white),
        ),
        if (subValue != null) ...[
          const SizedBox(height: 2),
          Text(
            subValue!,
            style: GoogleFonts.outfit(
              fontSize: 8,
              fontWeight: FontWeight.w800,
              color: subValueColor ?? Colors.white54,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ],
    );
  }
}
