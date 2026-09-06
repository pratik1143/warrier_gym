import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/auth_service.dart';
import '../widgets/az_button.dart';
import '../widgets/az_text_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;
  String? _errorMsg;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    setState(() => _errorMsg = null);
    final email = _emailCtrl.text.trim();
    final pass = _passCtrl.text;
    if (email.isEmpty || pass.isEmpty) {
      setState(() => _errorMsg = 'Please enter your email and password.');
      return;
    }
    final auth = context.read<AuthService>();
    final error = await auth.login(email, pass);
    if (error != null && mounted) {
      setState(() => _errorMsg = error);
      HapticFeedback.mediumImpact();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0F),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 60),

              // Logo / Brand
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 100, height: 100,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [BoxShadow(color: const Color(0xFFD4FF00).withOpacity(0.15), blurRadius: 32, offset: const Offset(0, 8))],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(24),
                        child: Image.asset(
                          'assets/images/gym_logo.png',
                          fit: BoxFit.contain,
                        ),
                      ),
                    ).animate().scale(duration: 600.ms, curve: Curves.easeOutBack),
                    const SizedBox(height: 16),
                    Text('THE WARRIOR GYM',
                      style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 2),
                    ).animate().fadeIn(delay: 200.ms),
                    const SizedBox(height: 6),
                    Text('Member Portal',
                      style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.white38, letterSpacing: 0.5),
                    ).animate().fadeIn(delay: 300.ms),
                  ],
                ),
              ),

              const SizedBox(height: 56),

              // Form
              Text('Sign In', style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white))
                .animate().fadeIn(delay: 400.ms).slideX(begin: -0.1),

              const SizedBox(height: 6),
              Text('Enter your gym account credentials',
                style: GoogleFonts.outfit(fontSize: 13, color: Colors.white38))
                .animate().fadeIn(delay: 450.ms),

              const SizedBox(height: 28),

              AzTextField(
                controller: _emailCtrl,
                label: 'Member ID / Email',
                hint: 'TWG-2026-0001 or rahul@gmail.com',
                keyboardType: TextInputType.text,
                prefixIcon: Icons.person_outline_rounded,
              ).animate().fadeIn(delay: 500.ms).slideY(begin: 0.1),

              const SizedBox(height: 16),

              AzTextField(
                controller: _passCtrl,
                label: 'Password',
                hint: '••••••••',
                obscure: _obscure,
                prefixIcon: Icons.lock_outline_rounded,
                suffixIcon: _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                onSuffixTap: () => setState(() => _obscure = !_obscure),
              ).animate().fadeIn(delay: 550.ms).slideY(begin: 0.1),

              const SizedBox(height: 8),

              // Error message
              if (_errorMsg != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  margin: const EdgeInsets.only(top: 8),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Colors.red, size: 16),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_errorMsg!, style: GoogleFonts.outfit(fontSize: 12, color: Colors.red, fontWeight: FontWeight.w600))),
                    ],
                  ),
                ).animate().shake(hz: 3, offset: const Offset(4, 0)),

              const SizedBox(height: 28),

              AzButton(
                label: auth.isLoading ? 'Signing In...' : 'Sign In & Open App',
                onTap: auth.isLoading ? null : _handleLogin,
                isLoading: auth.isLoading,
              ).animate().fadeIn(delay: 600.ms),

              const SizedBox(height: 40),

              Center(
                child: Text('The Warrior Gym · Mohali, Punjab',
                  style: GoogleFonts.outfit(fontSize: 11, color: Colors.white24, fontWeight: FontWeight.w500)),
              ).animate().fadeIn(delay: 700.ms),

              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }
}
