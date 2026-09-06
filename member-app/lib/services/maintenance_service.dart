import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class MaintenanceService extends ChangeNotifier {
  final FirebaseFirestore _db = FirebaseFirestore.instance;
  StreamSubscription? _subscription;

  bool _isUnderMaintenance = false;
  String _message = 'The app is currently undergoing scheduled maintenance.';
  String _estimatedEnd = '2 hours';

  bool get isUnderMaintenance => _isUnderMaintenance;
  String get message => _message;
  String get estimatedEnd => _estimatedEnd;

  MaintenanceService() {
    _initListener();
  }

  void _initListener() {
    try {
      _subscription = _db
          .collection('system')
          .doc('maintenance')
          .snapshots()
          .listen((docSnap) {
        if (docSnap.exists) {
          final data = docSnap.data();
          if (data != null) {
            _isUnderMaintenance = data['isUnderMaintenance'] ?? false;
            _message = data['message'] ?? 'The app is currently undergoing scheduled maintenance.';
            _estimatedEnd = data['estimatedEnd'] ?? '2 hours';
            notifyListeners();
          }
        }
      }, onError: (err) {
        debugPrint('Error listening to maintenance status: $err');
      });
    } catch (e) {
      debugPrint('Error setting up maintenance listener: $e');
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}
