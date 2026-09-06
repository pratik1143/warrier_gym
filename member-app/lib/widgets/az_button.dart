import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AzButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool isLoading;
  final bool outlined;

  const AzButton({
    super.key,
    required this.label,
    this.onTap,
    this.isLoading = false,
    this.outlined = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: double.infinity,
        height: 56,
        decoration: BoxDecoration(
          color: outlined ? Colors.transparent : (onTap == null ? Colors.white12 : const Color(0xFFD4FF00)),
          borderRadius: BorderRadius.circular(18),
          border: outlined ? Border.all(color: const Color(0xFFD4FF00), width: 1.5) : null,
          boxShadow: (!outlined && onTap != null) ? [
            BoxShadow(color: const Color(0xFFD4FF00).withOpacity(0.25), blurRadius: 20, offset: const Offset(0, 6)),
          ] : [],
        ),
        child: Center(
          child: isLoading
            ? const SizedBox(width: 20, height: 20,
                child: CircularProgressIndicator(color: Colors.black, strokeWidth: 2.5))
            : Text(label,
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: outlined ? const Color(0xFFD4FF00) : Colors.black,
                  letterSpacing: 0.5,
                ),
              ),
        ),
      ),
    );
  }
}
