import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:iconsax/iconsax.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/member_service.dart';

class MainShell extends StatefulWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  String? _lastMemberId;

  int _selectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/fitness'))    return 1;
    if (location.startsWith('/attendance')) return 2;
    if (location.startsWith('/rewards'))    return 3;
    if (location.startsWith('/profile'))    return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final memberService = context.read<MemberService>();

    if (auth.currentMember != null && auth.currentMember!.id != _lastMemberId) {
      _lastMemberId = auth.currentMember!.id;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        memberService.subscribeToMemberData(auth.currentMember!.id);
      });
    } else if (auth.currentMember == null && _lastMemberId != null) {
      _lastMemberId = null;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        memberService.unsubscribe();
      });
    }

    final idx = _selectedIndex(context);
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0F),
      body: widget.child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF12121A),
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05))),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _NavItem(icon: Iconsax.home_15, label: 'Home',       active: idx == 0, onTap: () => context.go('/home')),
                _NavItem(icon: Iconsax.activity5, label: 'Fitness',  active: idx == 1, onTap: () => context.go('/fitness')),
                _NavItem(icon: Iconsax.scan5, label: 'Check-In',     active: idx == 2, onTap: () => context.go('/attendance'), isCenter: true),
                _NavItem(icon: Iconsax.award5, label: 'Rewards',     active: idx == 3, onTap: () => context.go('/rewards')),
                _NavItem(icon: Iconsax.profile_circle5, label: 'Me', active: idx == 4, onTap: () => context.go('/profile')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  final bool isCenter;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
    this.isCenter = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isCenter) {
      return GestureDetector(
        onTap: onTap,
        child: Container(
          width: 56, height: 56,
          decoration: BoxDecoration(
            color: active ? const Color(0xFFD4FF00) : const Color(0xFF1E1E2E),
            borderRadius: BorderRadius.circular(18),
            boxShadow: active ? [BoxShadow(color: const Color(0xFFD4FF00).withOpacity(0.3), blurRadius: 16, offset: const Offset(0, 4))] : [],
          ),
          child: Icon(icon, color: active ? Colors.black : Colors.white54, size: 24),
        ),
      );
    }

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFD4FF00).withOpacity(0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: active ? const Color(0xFFD4FF00) : Colors.white38, size: 20),
            const SizedBox(height: 3),
            Text(label,
              style: TextStyle(
                fontSize: 9, fontWeight: FontWeight.w700,
                color: active ? const Color(0xFFD4FF00) : Colors.white38,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
