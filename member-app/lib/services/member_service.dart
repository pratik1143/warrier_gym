import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class MemberService extends ChangeNotifier {
  final FirebaseFirestore _db = FirebaseFirestore.instance;

  Map<String, dynamic>? _workoutPlan;
  Map<String, dynamic>? _dietPlan;
  List<Map<String, dynamic>> _bodyLogs = [];
  List<Map<String, dynamic>> _attendanceLogs = [];
  List<Map<String, dynamic>> _chatMessages = [];
  List<Map<String, dynamic>> _paymentLogs = [];
  List<Map<String, dynamic>> _freezeRequests = [];
  double _todayWaterIntake = 0.0;
  bool _isLoading = false;

  Map<String, dynamic>? _dailyLog;
  List<Map<String, dynamic>> _cheatMealsList = [];

  Map<String, dynamic>? get workoutPlan => _workoutPlan;
  Map<String, dynamic>? get dietPlan => _dietPlan;
  List<Map<String, dynamic>> get bodyLogs => _bodyLogs;
  List<Map<String, dynamic>> get attendanceLogs => _attendanceLogs;
  List<Map<String, dynamic>> get chatMessages => _chatMessages;
  List<Map<String, dynamic>> get paymentLogs => _paymentLogs;
  List<Map<String, dynamic>> get freezeRequests => _freezeRequests;
  double get todayWaterIntake => _todayWaterIntake;
  Map<String, dynamic>? get dailyLog => _dailyLog;
  List<Map<String, dynamic>> get cheatMealsList => _cheatMealsList;
  bool get isLoading => _isLoading;

  StreamSubscription? _workoutSub;
  StreamSubscription? _dietSub;
  StreamSubscription? _progressSub;
  StreamSubscription? _attendanceSub;
  StreamSubscription? _chatSub;
  StreamSubscription? _paymentsSub;
  StreamSubscription? _freezeSub;
  StreamSubscription? _waterSub;
  StreamSubscription? _dailyLogSub;
  StreamSubscription? _cheatMealSub;

  void subscribeToMemberData(String memberId) {
    _isLoading = true;
    notifyListeners();

    // 1. Subscribe to Workout Plans
    _workoutSub?.cancel();
    _workoutSub = _db
        .collection('workouts')
        .where('memberId', isEqualTo: memberId)
        .snapshots()
        .listen((snap) {
      if (snap.docs.isNotEmpty) {
        _workoutPlan = snap.docs.first.data();
        _workoutPlan!['id'] = snap.docs.first.id;
      } else {
        _workoutPlan = null;
      }
      _isLoading = false;
      notifyListeners();
    });

    // 2. Subscribe to Diet Plans
    _dietSub?.cancel();
    _dietSub = _db
        .collection('diets')
        .where('memberId', isEqualTo: memberId)
        .snapshots()
        .listen((snap) {
      if (snap.docs.isNotEmpty) {
        _dietPlan = snap.docs.first.data();
        _dietPlan!['id'] = snap.docs.first.id;
      } else {
        _dietPlan = null;
      }
      _isLoading = false;
      notifyListeners();
    });

    // 3. Subscribe to Progress Timeline / Body Logs
    _progressSub?.cancel();
    _progressSub = _db
        .collection('progressLogs')
        .where('memberId', isEqualTo: memberId)
        .snapshots()
        .listen((snap) {
      _bodyLogs = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
      _bodyLogs.sort((a, b) => (b['date'] ?? '').compareTo(a['date'] ?? ''));
      _isLoading = false;
      notifyListeners();
    });

    // 4. Subscribe to Attendance logs
    _attendanceSub?.cancel();
    _attendanceSub = _db
        .collection('attendance')
        .where('memberId', isEqualTo: memberId)
        .snapshots()
        .listen((snap) {
      _attendanceLogs = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
      _attendanceLogs.sort((a, b) => (b['checkIn'] ?? '').compareTo(a['checkIn'] ?? ''));
      _isLoading = false;
      notifyListeners();
    });

    // 5. Subscribe to Trainer Chat messages
    _chatSub?.cancel();
    _chatSub = _db
        .collection('chatMessages')
        .snapshots()
        .listen((snap) {
      // Filter manually to allow real-time two-way messaging between member and trainer
      _chatMessages = snap.docs
          .map((d) => {'id': d.id, ...d.data()})
          .where((m) =>
              (m['from'] == memberId || m['to'] == memberId))
          .toList();
      _chatMessages.sort((a, b) => (a['timestamp'] ?? '').compareTo(b['timestamp'] ?? ''));
      notifyListeners();
    });

    // 6. Subscribe to Payments (Membership history/invoices)
    _paymentsSub?.cancel();
    _paymentsSub = _db
        .collection('payments')
        .where('memberId', isEqualTo: memberId)
        .snapshots()
        .listen((snap) {
      _paymentLogs = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
      _paymentLogs.sort((a, b) => (b['date'] ?? '').compareTo(a['date'] ?? ''));
      notifyListeners();
    });

    // 7. Subscribe to Freeze Requests
    _freezeSub?.cancel();
    _freezeSub = _db
        .collection('freezeRequests')
        .where('memberId', isEqualTo: memberId)
        .snapshots()
        .listen((snap) {
      _freezeRequests = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
      _freezeRequests.sort((a, b) => (b['createdAt'] ?? '').compareTo(a['createdAt'] ?? ''));
      notifyListeners();
    });

    // 8. Subscribe to Water Logs
    final dateStr = DateTime.now().toIso8601String().split('T')[0];
    _waterSub?.cancel();
    _waterSub = _db
        .collection('waterLogs')
        .doc('${memberId}_$dateStr')
        .snapshots()
        .listen((docSnap) {
      if (docSnap.exists) {
        _todayWaterIntake = (docSnap.data()?['amount'] as num?)?.toDouble() ?? 0.0;
      } else {
        _todayWaterIntake = 0.0;
      }
      notifyListeners();
    });

    // 9. Subscribe to daily diet log
    _dailyLogSub?.cancel();
    _dailyLogSub = _db
        .collection('dailyDietLogs')
        .doc('${memberId}_$dateStr')
        .snapshots()
        .listen((docSnap) {
      if (docSnap.exists) {
        _dailyLog = docSnap.data();
      } else {
        _dailyLog = null;
      }
      notifyListeners();
    });

    // 10. Subscribe to cheat meal requests
    _cheatMealSub?.cancel();
    _cheatMealSub = _db
        .collection('cheatMealRequests')
        .where('memberId', isEqualTo: memberId)
        .snapshots()
        .listen((snap) {
      _cheatMealsList = snap.docs.map((d) => {'id': d.id, ...d.data()}).toList();
      _cheatMealsList.sort((a, b) => (b['createdAt'] ?? '').compareTo(a['createdAt'] ?? ''));
      notifyListeners();
    });
  }

  Future<void> sendChatMessage(String fromId, String toId, String text) async {
    if (text.trim().isEmpty) return;
    await _db.collection('chatMessages').add({
      'from': fromId,
      'to': toId,
      'text': text,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  Future<void> addProgressLog(String memberId, double weight, double bodyFat) async {
    final dateStr = DateTime.now().toIso8601String().split('T')[0];
    await _db.collection('progressLogs').add({
      'memberId': memberId,
      'weight': weight,
      'bodyFat': bodyFat,
      'date': dateStr,
    });
  }

  Future<void> logWaterIntake(String memberId, double amount) async {
    final dateStr = DateTime.now().toIso8601String().split('T')[0];
    final docRef = _db.collection('waterLogs').doc('${memberId}_$dateStr');
    await docRef.set({
      'memberId': memberId,
      'amount': FieldValue.increment(amount),
      'date': dateStr,
    }, SetOptions(merge: true));
  }

  Future<void> scanQRCheckIn(String memberId, String name, String branch) async {
    // Write new attendance checkin
    await _db.collection('attendance').add({
      'memberId': memberId,
      'memberName': name,
      'checkIn': DateTime.now().toIso8601String(),
      'checkOut': null,
      'method': 'qr',
      'branch': branch,
    });

    // Increment attendance streak/count on member document
    final memberRef = _db.collection('members').doc(memberId);
    await _db.runTransaction((transaction) async {
      final snapshot = await transaction.get(memberRef);
      if (snapshot.exists) {
        final currentStreak = snapshot.data()?['attendanceStreak'] ?? 0;
        final currentCount = snapshot.data()?['attendanceCount'] ?? 0;
        transaction.update(memberRef, {
          'attendanceStreak': currentStreak + 1,
          'attendanceCount': currentCount + 1,
        });
      }
    });
  }

  Future<void> submitFreezeRequest(String memberId, String startDate, String endDate, String reason) async {
    await _db.collection('freezeRequests').add({
      'memberId': memberId,
      'startDate': startDate,
      'endDate': endDate,
      'reason': reason,
      'status': 'pending',
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  Future<void> renewUpgradeMembership(String memberId, String memberName, String newPlan, double amount) async {
    // 1. Add payment record
    final dateStr = DateTime.now().toIso8601String().split('T')[0];
    await _db.collection('payments').add({
      'memberId': memberId,
      'memberName': memberName,
      'amount': amount,
      'plan': newPlan,
      'method': 'UPI',
      'status': 'paid',
      'date': dateStr,
      'invoice': 'INV-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
      'gst': (amount * 0.18).round(),
    });

    // 2. Calculate new expiry date
    final daysMap = {
      'Monthly': 30,
      'Quarterly': 90,
      'Semi-Annual': 180,
      'Annual Premium': 365,
    };
    final durationDays = daysMap[newPlan] ?? 30;
    
    final memberDoc = await _db.collection('members').doc(memberId).get();
    DateTime baseDate = DateTime.now();
    if (memberDoc.exists) {
      final currentExpiry = memberDoc.data()?['expiryDate'];
      if (currentExpiry != null) {
        final currentExpiryDate = DateTime.tryParse(currentExpiry) ?? DateTime.now();
        if (currentExpiryDate.isAfter(DateTime.now())) {
          baseDate = currentExpiryDate;
        }
      }
    }
    
    final newExpiryDate = baseDate.add(Duration(days: durationDays));
    final newExpiryStr = newExpiryDate.toIso8601String().split('T')[0];

    // 3. Update member plan and expiry in Firestore
    await _db.collection('members').doc(memberId).update({
      'plan': newPlan,
      'expiryDate': newExpiryStr,
      'status': 'active',
    });
  }

  Future<void> toggleMealCompletion(String memberId, String mealName, bool completed) async {
    final dateStr = DateTime.now().toIso8601String().split('T')[0];
    final docRef = _db.collection('dailyDietLogs').doc('${memberId}_$dateStr');
    
    await _db.runTransaction((transaction) async {
      final snapshot = await transaction.get(docRef);
      Map<String, dynamic> data = {};
      if (snapshot.exists) {
        data = Map<String, dynamic>.from(snapshot.data() ?? {});
      }
      
      final mealsCompleted = Map<String, dynamic>.from(data['mealsCompleted'] ?? {});
      mealsCompleted[mealName] = completed;
      data['mealsCompleted'] = mealsCompleted;
      data['memberId'] = memberId;
      data['date'] = dateStr;
      
      final totalMeals = (_dietPlan?['meals'] as List?)?.length ?? 4;
      final completedCount = mealsCompleted.values.where((v) => v == true).length;
      final waterConsumed = (data['waterConsumed'] ?? 0.0) as num;
      final waterGoalL = (_dietPlan?['waterGoal'] ?? 3.0) as num;
      final waterGoalMl = waterGoalL * 1000;
      
      final compScore = totalMeals > 0 ? ((completedCount / totalMeals) * 60).round() : 0;
      final waterScore = waterGoalMl > 0 ? (min(40, (waterConsumed / waterGoalMl) * 40)).round() : 0;
      
      data['dietScore'] = compScore + waterScore;
      data['compliancePercent'] = totalMeals > 0 ? ((completedCount / totalMeals) * 100).round() : 0;
      data['updatedAt'] = DateTime.now().toIso8601String();
      
      transaction.set(docRef, data, SetOptions(merge: true));
    });
  }

  Future<void> logDailyWater(String memberId, double amountMl) async {
    final dateStr = DateTime.now().toIso8601String().split('T')[0];
    final docRef = _db.collection('dailyDietLogs').doc('${memberId}_$dateStr');
    
    await _db.runTransaction((transaction) async {
      final snapshot = await transaction.get(docRef);
      Map<String, dynamic> data = {};
      if (snapshot.exists) {
        data = Map<String, dynamic>.from(snapshot.data() ?? {});
      }
      
      final double currentWater = (data['waterConsumed'] ?? 0.0) as double;
      final nextWater = currentWater + amountMl;
      data['waterConsumed'] = nextWater;
      data['memberId'] = memberId;
      data['date'] = dateStr;
      
      final mealsCompleted = Map<String, dynamic>.from(data['mealsCompleted'] ?? {});
      final totalMeals = (_dietPlan?['meals'] as List?)?.length ?? 4;
      final completedCount = mealsCompleted.values.where((v) => v == true).length;
      final waterGoalL = (_dietPlan?['waterGoal'] ?? 3.0) as num;
      final waterGoalMl = waterGoalL * 1000;
      
      final compScore = totalMeals > 0 ? ((completedCount / totalMeals) * 60).round() : 0;
      final waterScore = waterGoalMl > 0 ? (min(40, (nextWater / waterGoalMl) * 40)).round() : 0;
      
      data['dietScore'] = compScore + waterScore;
      data['compliancePercent'] = totalMeals > 0 ? ((completedCount / totalMeals) * 100).round() : 0;
      data['updatedAt'] = DateTime.now().toIso8601String();
      
      transaction.set(docRef, data, SetOptions(merge: true));
    });
  }

  Future<void> submitMealNote(String memberId, String mealName, String note) async {
    final dateStr = DateTime.now().toIso8601String().split('T')[0];
    final docRef = _db.collection('dailyDietLogs').doc('${memberId}_$dateStr');
    
    await _db.runTransaction((transaction) async {
      final snapshot = await transaction.get(docRef);
      Map<String, dynamic> data = {};
      if (snapshot.exists) {
        data = Map<String, dynamic>.from(snapshot.data() ?? {});
      }
      
      final mealNotes = Map<String, dynamic>.from(data['mealNotes'] ?? {});
      mealNotes[mealName] = note;
      data['mealNotes'] = mealNotes;
      data['memberId'] = memberId;
      data['date'] = dateStr;
      
      transaction.set(docRef, data, SetOptions(merge: true));
    });
  }

  Future<void> submitCheatMealRequest(String memberId, String memberName, String mealName, String reason) async {
    await _db.collection('cheatMealRequests').add({
      'memberId': memberId,
      'memberName': memberName,
      'mealName': mealName,
      'reason': reason,
      'status': 'pending',
      'trainerNotes': '',
      'createdAt': DateTime.now().toIso8601String(),
    });
  }

  void unsubscribe() {
    _workoutSub?.cancel();
    _dietSub?.cancel();
    _progressSub?.cancel();
    _attendanceSub?.cancel();
    _chatSub?.cancel();
    _paymentsSub?.cancel();
    _freezeSub?.cancel();
    _waterSub?.cancel();
    _dailyLogSub?.cancel();
    _cheatMealSub?.cancel();
  }

  @override
  void dispose() {
    unsubscribe();
    super.dispose();
  }
}
