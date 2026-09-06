import 'package:cloud_firestore/cloud_firestore.dart';

class MemberModel {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String plan;
  final String branch;
  final String status;
  final DateTime joinDate;
  final DateTime expiryDate;
  final String? trainer;
  final String? gender;
  final int? age;
  final double? weight;
  final double? height;
  final String? address;
  final String? avatarUrl;
  final int? fitnessScore;
  final int? attendanceStreak;
  final int? rewardPoints;
  // New Fields
  final String? memberId;
  final String? role;
  final String? bloodGroup;
  final DateTime? dob;
  final String? maritalStatus;
  final DateTime? anniversaryDate;
  final String? medicalConditions;
  final String? fitnessGoal;
  final String? occupation;
  final String? emergencyContact;
  final double? targetWeight;
  final bool? appAccessEnabled;
  final DateTime? lastLogin;
  final bool? forceLogout;

  const MemberModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.plan,
    required this.branch,
    required this.status,
    required this.joinDate,
    required this.expiryDate,
    this.trainer,
    this.gender,
    this.age,
    this.weight,
    this.height,
    this.address,
    this.avatarUrl,
    this.fitnessScore,
    this.attendanceStreak,
    this.rewardPoints,
    this.memberId,
    this.role,
    this.bloodGroup,
    this.dob,
    this.maritalStatus,
    this.anniversaryDate,
    this.medicalConditions,
    this.fitnessGoal,
    this.occupation,
    this.emergencyContact,
    this.targetWeight,
    this.appAccessEnabled,
    this.lastLogin,
    this.forceLogout,
  });

  int get daysRemaining {
    final diff = expiryDate.difference(DateTime.now()).inDays;
    return diff < 0 ? 0 : diff;
  }

  bool get isExpired => DateTime.now().isAfter(expiryDate);
  bool get isExpiringSoon => daysRemaining <= 7 && !isExpired;

  double? get bmi {
    if (weight == null || height == null || height == 0) return null;
    final hm = height! / 100;
    return weight! / (hm * hm);
  }

  factory MemberModel.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return MemberModel(
      id: doc.id,
      name: d['name'] ?? '',
      email: d['email'] ?? '',
      phone: d['phone'] ?? '',
      plan: d['plan'] ?? 'Monthly',
      branch: d['branch'] ?? 'Mohali, Punjab',
      status: d['status'] ?? 'active',
      joinDate: parseDate(d['joinDate']),
      expiryDate: parseDate(d['expiryDate']),
      trainer: d['trainer'],
      gender: d['gender'],
      age: d['age'] is int ? d['age'] : int.tryParse('${d['age'] ?? ''}'),
      weight: (d['weight'] as num?)?.toDouble(),
      height: (d['height'] as num?)?.toDouble(),
      address: d['address'],
      avatarUrl: d['avatarUrl'],
      fitnessScore: d['fitnessScore'] as int?,
      attendanceStreak: d['attendanceStreak'] as int?,
      rewardPoints: d['rewardPoints'] as int?,
      memberId: d['memberId'],
      role: d['role'],
      bloodGroup: d['bloodGroup'],
      dob: d['dob'] != null ? parseDate(d['dob']) : null,
      maritalStatus: d['maritalStatus'],
      anniversaryDate: d['anniversaryDate'] != null ? parseDate(d['anniversaryDate']) : null,
      medicalConditions: d['medicalConditions'],
      fitnessGoal: d['fitnessGoal'],
      occupation: d['occupation'],
      emergencyContact: d['emergencyContact'],
      targetWeight: (d['targetWeight'] as num?)?.toDouble() ?? (d['weight'] != null ? (d['weight'] as num).toDouble() - 5 : null),
      appAccessEnabled: d['appAccessEnabled'] is bool ? d['appAccessEnabled'] : null,
      lastLogin: d['lastLogin'] != null ? parseDate(d['lastLogin']) : null,
      forceLogout: d['forceLogout'] is bool ? d['forceLogout'] : null,
    );
  }

  static DateTime parseDate(dynamic val) {
    if (val is Timestamp) return val.toDate();
    if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
    return DateTime.now();
  }

  Map<String, dynamic> toMap() => {
    'id': id, 'name': name, 'email': email, 'phone': phone,
    'plan': plan, 'branch': branch, 'status': status,
    'joinDate': joinDate.toIso8601String(),
    'expiryDate': expiryDate.toIso8601String(),
    if (trainer != null) 'trainer': trainer,
    if (gender != null) 'gender': gender,
    if (age != null) 'age': age,
    if (weight != null) 'weight': weight,
    if (height != null) 'height': height,
    if (address != null) 'address': address,
    if (avatarUrl != null) 'avatarUrl': avatarUrl,
    if (fitnessScore != null) 'fitnessScore': fitnessScore,
    if (rewardPoints != null) 'rewardPoints': rewardPoints,
    if (memberId != null) 'memberId': memberId,
    if (role != null) 'role': role,
    if (bloodGroup != null) 'bloodGroup': bloodGroup,
    if (dob != null) 'dob': dob?.toIso8601String(),
    if (maritalStatus != null) 'maritalStatus': maritalStatus,
    if (anniversaryDate != null) 'anniversaryDate': anniversaryDate?.toIso8601String(),
    if (medicalConditions != null) 'medicalConditions': medicalConditions,
    if (fitnessGoal != null) 'fitnessGoal': fitnessGoal,
    if (occupation != null) 'occupation': occupation,
    if (emergencyContact != null) 'emergencyContact': emergencyContact,
    if (targetWeight != null) 'targetWeight': targetWeight,
    if (appAccessEnabled != null) 'appAccessEnabled': appAccessEnabled,
    if (lastLogin != null) 'lastLogin': lastLogin?.toIso8601String(),
    if (forceLogout != null) 'forceLogout': forceLogout,
  };
}
