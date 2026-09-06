import 'package:flutter/material.dart';

class GlassCard extends StatelessWidget {
  final Widget child;
  final Gradient? gradient;
  final BorderRadius? borderRadius;
  final double borderWidth;
  final Color? borderColor;

  const GlassCard({
    super.key,
    required this.child,
    this.gradient,
    this.borderRadius,
    this.borderWidth = 1.0,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    final defaultBorderRadius = borderRadius ?? BorderRadius.circular(24);
    
    return Container(
      decoration: BoxDecoration(
        borderRadius: defaultBorderRadius,
        gradient: gradient ?? LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withOpacity(0.07),
            Colors.white.withOpacity(0.02),
          ],
        ),
        border: Border.all(
          color: borderColor ?? Colors.white.withOpacity(0.08),
          width: borderWidth,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: defaultBorderRadius,
        child: child,
      ),
    );
  }
}
