import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/main_shell.dart';
import 'screens/home_screen.dart';
import 'screens/fitness_screen.dart';
import 'screens/attendance_screen.dart';
import 'screens/rewards_screen.dart';
import 'screens/profile_screen.dart';

GoRouter createRouter(AuthService auth) {
  return GoRouter(
    initialLocation: '/login',
    refreshListenable: auth,
    redirect: (context, state) {
      final isLoggedIn = auth.currentMember != null;
      final isLoginPage = state.matchedLocation == '/login';
      if (!isLoggedIn && !isLoginPage) return '/login';
      if (isLoggedIn && isLoginPage) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/home',       builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/fitness',    builder: (_, __) => const FitnessScreen()),
          GoRoute(path: '/attendance', builder: (_, __) => const AttendanceScreen()),
          GoRoute(path: '/rewards',    builder: (_, __) => const RewardsScreen()),
          GoRoute(path: '/profile',    builder: (_, __) => const ProfileScreen()),
        ],
      ),
    ],
  );
}
