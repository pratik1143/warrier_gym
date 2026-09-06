import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'firebase_options.dart';
import 'services/auth_service.dart';
import 'services/member_service.dart';
import 'services/maintenance_service.dart';
import 'screens/maintenance_screen.dart';
import 'package:go_router/go_router.dart';
import 'router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Lock to portrait mode
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Status bar style
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  
  runApp(const WarriorGymApp());
}

class WarriorGymApp extends StatelessWidget {
  const WarriorGymApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        ChangeNotifierProvider(create: (_) => MemberService()),
        ChangeNotifierProvider(create: (_) => MaintenanceService()),
      ],
      child: const MainAppContent(),
    );
  }
}

class MainAppContent extends StatefulWidget {
  const MainAppContent({super.key});

  @override
  State<MainAppContent> createState() => _MainAppContentState();
}

class _MainAppContentState extends State<MainAppContent> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = createRouter(context.read<AuthService>());
  }

  @override
  Widget build(BuildContext context) {
    final maintenance = context.watch<MaintenanceService>();

    if (maintenance.isUnderMaintenance) {
      return MaterialApp(
        title: 'The Warrior Gym',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          brightness: Brightness.dark,
          scaffoldBackgroundColor: const Color(0xFF0A0A0F),
          textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme),
        ),
        home: MaintenanceScreen(
          message: maintenance.message,
          estimatedEnd: maintenance.estimatedEnd,
        ),
      );
    }

    return MaterialApp.router(
      title: 'The Warrior Gym',
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0A0A0F),
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFFD4FF00),
          secondary: const Color(0xFF0052FF),
          surface: const Color(0xFF12121A),
          background: const Color(0xFF0A0A0F),
          onPrimary: Colors.black,
          onSurface: Colors.white,
        ),
        textTheme: GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme),
        cardTheme: CardThemeData(
          color: const Color(0xFF12121A),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
        ),
      ),
    );
  }
}
