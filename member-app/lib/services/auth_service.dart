import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/member_model.dart';

class AuthService extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  MemberModel? _currentMember;
  bool _isLoading = false;
  String? _error;
  StreamSubscription<DocumentSnapshot>? _memberSubscription;

  MemberModel? get currentMember => _currentMember;
  bool get isLoading => _isLoading;
  String? get error => _error;

  AuthService() {
    _auth.authStateChanges().listen(_onAuthStateChanged);
  }

  Future<void> _onAuthStateChanged(User? user) async {
    if (user == null) {
      _memberSubscription?.cancel();
      _memberSubscription = null;
      _currentMember = null;
    } else {
      await _loadMemberProfile(user.uid, user.email ?? '', user.phoneNumber ?? '');
    }
    notifyListeners();
  }

  /// Subscribe to member document — whenever it changes, update _currentMember.
  void _subscribeToDoc(DocumentReference ref, {String? fallbackRole, Map<String, dynamic>? fallbackUserData}) {
    _memberSubscription?.cancel();
    _memberSubscription = ref.snapshots().listen((doc) async {
      if (!doc.exists) return;

      final fetched = MemberModel.fromFirestore(doc);

      // Force logout if flag is set
      if (fetched.forceLogout == true) {
        await ref.update({'forceLogout': false}).catchError((_) {});
        logout();
        return;
      }

      // Block if app access disabled
      if (fetched.appAccessEnabled == false) {
        logout();
        return;
      }

      _currentMember = fetched;
      notifyListeners();
    }, onError: (err) {
      _error = err.toString();
      notifyListeners();
    });
  }

  Future<void> _loadMemberProfile(String uid, String email, String phone) async {
    try {
      _memberSubscription?.cancel();

      // ── Step 1: Try by Firebase Auth UID (fastest, most reliable) ──
      final uidDoc = await _db.collection('members').doc(uid).get();
      if (uidDoc.exists) {
        _subscribeToDoc(uidDoc.reference);
        return;
      }

      // ── Step 2: Try by email match ──
      if (email.isNotEmpty) {
        final byEmail = await _db
            .collection('members')
            .where('email', isEqualTo: email)
            .limit(1)
            .get();
        if (byEmail.docs.isNotEmpty) {
          _subscribeToDoc(byEmail.docs.first.reference);
          return;
        }
      }

      // ── Step 3: Try by phone number ──
      final normalizedPhone = _normalizePhone(phone);
      if (normalizedPhone.isNotEmpty) {
        final byPhone = await _db
            .collection('members')
            .where('phone', isEqualTo: normalizedPhone)
            .limit(1)
            .get();
        if (byPhone.docs.isNotEmpty) {
          _subscribeToDoc(byPhone.docs.first.reference);
          return;
        }
      }

      // ── Step 4: Try by memberId field (for username-based logins) ──
      // memberId is stored in Firestore as e.g. "TWG-2026-0001"
      // username login resolves email first, so this is a final safety net

      // ── Fallback: create a minimal guest profile from auth user data ──
      final userDoc = await _db.collection('users').doc(uid).get();
      final data = userDoc.exists ? userDoc.data() : null;

      _currentMember = MemberModel(
        id: uid,
        name: data?['name'] ?? (email.isNotEmpty ? email.split('@')[0] : 'Member'),
        email: email,
        phone: data?['phone'] ?? phone,
        plan: 'Gold Member (Staff)',
        branch: data?['branch'] ?? 'Mohali, Punjab',
        status: 'active',
        joinDate: DateTime.now(),
        expiryDate: DateTime.now().add(const Duration(days: 365)),
        role: data?['role'] ?? 'member',
        appAccessEnabled: true,
      );
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
  }

  /// Normalize Indian phone numbers to +91XXXXXXXXXX format for Firestore matching.
  String _normalizePhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return '';
    if (digits.length == 10) return '+91$digits';
    if (digits.length == 12 && digits.startsWith('91')) return '+$digits';
    if (digits.startsWith('+')) return raw;
    return digits;
  }

  Future<String?> login(String usernameOrEmail, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      String email = usernameOrEmail.trim();

      // ── Resolve Member ID to email ──
      if (!email.contains('@')) {
        final input = email.toUpperCase();

        // Try by memberId field
        final byMemberId = await _db
            .collection('members')
            .where('memberId', isEqualTo: input)
            .limit(1)
            .get();

        if (byMemberId.docs.isNotEmpty) {
          final resolvedEmail = byMemberId.docs.first.data()['email'] as String?;
          if (resolvedEmail != null && resolvedEmail.isNotEmpty) {
            email = resolvedEmail;
          } else {
            _isLoading = false;
            _error = 'Member account does not have a registered email. Contact the gym desk.';
            notifyListeners();
            return _error;
          }
        } else {
          _isLoading = false;
          _error = 'No member found with this Member ID.';
          notifyListeners();
          return _error;
        }
      }

      final credential = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      final uid = credential.user?.uid;

      if (uid != null) {
        // Check if app access is enabled before letting them in
        final doc = await _db.collection('members').doc(uid).get();
        if (!doc.exists) {
          // Try email fallback too
          final emailDoc = await _db
              .collection('members')
              .where('email', isEqualTo: email)
              .limit(1)
              .get();
          if (emailDoc.docs.isNotEmpty) {
            final fetched = MemberModel.fromFirestore(emailDoc.docs.first);
            if (fetched.appAccessEnabled == false) {
              await _auth.signOut();
              _isLoading = false;
              _error = 'App access is disabled for this account.';
              notifyListeners();
              return _error;
            }
          }
        } else {
          final fetched = MemberModel.fromFirestore(doc);
          if (fetched.appAccessEnabled == false) {
            await _auth.signOut();
            _isLoading = false;
            _error = 'App access is disabled for this account.';
            notifyListeners();
            return _error;
          }
        }

        // Update lastLogin timestamp
        await _db.collection('members').doc(uid).update({
          'lastLogin': FieldValue.serverTimestamp(),
        }).catchError((_) {
          // Ignore if doc not found by UID — email-based member
        });
      }

      _isLoading = false;
      notifyListeners();
      return null; // success
    } on FirebaseAuthException catch (e) {
      _isLoading = false;
      _error = switch (e.code) {
        'user-not-found'      => 'No account found with this email.',
        'wrong-password'      => 'Invalid email or password.',
        'invalid-credential'  => 'Invalid email or password.',
        'invalid-email'       => 'Please enter a valid email address.',
        'user-disabled'       => 'This account has been disabled.',
        _                     => 'Login failed. Please check your credentials.',
      };
      notifyListeners();
      return _error;
    } catch (e) {
      _isLoading = false;
      _error = e.toString();
      notifyListeners();
      return _error;
    }
  }

  Future<void> logout() async {
    _memberSubscription?.cancel();
    _memberSubscription = null;
    await _auth.signOut();
    _currentMember = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _memberSubscription?.cancel();
    super.dispose();
  }
}
