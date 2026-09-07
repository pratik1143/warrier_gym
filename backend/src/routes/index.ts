import { Router } from 'express';
import enquiryRoutes from './enquiry.routes';
import whatsappRoutes from './whatsapp.routes';
import { loginUser } from '../controllers/auth.controller';
import { 
  getMembers, getMembersPaginated, getMemberById, createMember, updateMember, 
  deleteMember, toggleFreezeMember, resetMemberPassword, sendMemberCredentials,
  importBulkHoldMembers
} from '../controllers/member.controller';
import { getAttendanceFeed, createCheckIn, checkoutLog, triggerGateUnlock, getAccessLogs, getDoorStatus, getDashboardAnalyticsFeed, getAttendanceSummaryFeed } from '../controllers/attendance.controller';
import { 
  getDevices, createDevice, updateDevice, deleteDevice, getDeviceLogs, triggerSimulationTap, 
  restartDevice, queueConnectionTest, queueReadUsers, queueReadAttendance, getTesterStatus, 
  queueSyncFirebase, queueImportUsers, startEnrollFingerprint, deleteEnrollment, syncMemberToDevice, 
  getEnrollmentStatus, getPythonStatus, getLatestPunch, autoMapAllBiometrics,
  getHikvisionStatus, triggerHikvisionDoorUnlock, getUnmappedDeviceUsers, mapDeviceUserToMember,
  testHikvisionConnection, syncHikvisionUsers, syncHikvisionEvents, getHikvisionEvents,
  getHikvisionDiagnostics, enrollHikvisionBiometrics, testHikvisionUserCreation,
  getHikvisionCapabilitiesController, getHikvisionTerminalUsers, bulkMapHikvisionUsers
} from '../controllers/device.controller';
import { getInvoices, createInvoice, updateInvoice, deleteInvoice, markPaymentPaid } from '../controllers/billing.controller';
import { 
  getWorkoutPlan, saveWorkoutPlan, getDietPlan, saveDietPlan,
  generateAIDiet, approveDietPlan, duplicateDietPlan, archiveDietPlan,
  getCheatMeals, createCheatMealRequest, handleCheatMealRequest,
  getDailyLog, saveDailyLog,
  getTrainersList, createTrainerProfile, updateTrainerProfile, deleteTrainerProfile, assignMembersToTrainer,
  seedRealTrainers
} from '../controllers/trainer.controller';
import { getChatHistory, sendChatMessage } from '../controllers/chat.controller';
import { getProgressTimeline, addProgressRecord, getReferralsByMember, createReferralInvitation } from '../controllers/progress.controller';
import { nextBiometricId, migrateMembers, dryRunMigration, resumeMigration, rebuildAnalyticsAndIndex, auditVerification, rollbackMigration, mapBiometricUser, getDeviceUsers, getMigrations, seedDeviceUsers, purgeCRMData, repairImportedPhotos, repairImportedBilling, patchLegacyAmounts, markAllBillsPaid, sanitizeHoldMembers } from '../controllers/migration.controller';
import { getSmtpConfig, saveSmtpConfig, getTemplates, saveTemplatesController, sendTestEmail, getInvoicePreview } from '../controllers/automation.controller';
import { getPlansController, createPlanController, updatePlanController, deletePlanController } from '../controllers/plan.controller';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee, getEmployeeAttendance } from '../controllers/employee.controller';
import { globalSearch } from '../controllers/search.controller';
import { authenticateToken } from '../middleware/auth';


const router = Router();

// Public Endpoints
router.post('/auth/login', loginUser);
router.get('/python/status', getPythonStatus);
router.get('/system/health', getPythonStatus);

// Protect all CRM / dashboard operations
router.use(authenticateToken);

// Universal Global Search API
router.get('/search', globalSearch);

router.use('/enquiries', enquiryRoutes);
router.use('/whatsapp', whatsappRoutes);

// Member CRUD & Actions
router.get('/members', getMembers);
router.get('/members/paginated', getMembersPaginated);
router.post('/members/import-bulk', importBulkHoldMembers);
router.post('/members/sanitize-hold-members', sanitizeHoldMembers);
router.get('/members/next-biometric-id', nextBiometricId);
router.post('/members/migrate', migrateMembers);
router.post('/members/dry-run-migration', dryRunMigration);
router.post('/members/repair-photos', repairImportedPhotos);
router.post('/members/repair-billing', repairImportedBilling);
router.post('/members/patch-legacy-amounts', patchLegacyAmounts);
router.post('/members/mark-all-paid', markAllBillsPaid);
router.post('/members/resume-migration', resumeMigration);
router.post('/members/rebuild-analytics', rebuildAnalyticsAndIndex);
router.get('/members/audit-verification', auditVerification);
router.post('/members/rollback-migration', rollbackMigration);
router.post('/members/purge-all', purgeCRMData);
router.post('/members/map-biometric', mapBiometricUser);
router.get('/members/:id', getMemberById);
router.post('/members', createMember);
router.put('/members/:id', updateMember);
router.delete('/members/:id', deleteMember);
router.post('/members/:id/freeze', toggleFreezeMember);
router.post('/members/:id/reset-password', resetMemberPassword);
router.post('/members/:id/send-credentials', sendMemberCredentials);

// Attendance & Hardware Controller Sync
router.get('/analytics/dashboard', getDashboardAnalyticsFeed);
router.get('/attendance', getAttendanceFeed);
router.get('/attendance/latest-punch', getLatestPunch);
router.get('/attendance/summary/:memberId', getAttendanceSummaryFeed);
router.post('/attendance/checkin', createCheckIn);
router.put('/attendance/checkout/:id', checkoutLog);
router.post('/attendance/unlock', triggerGateUnlock);
router.get('/access-control/logs', getAccessLogs);
router.get('/access-control/doors', getDoorStatus);

// Device Management & Logs
router.get('/devices', getDevices);
router.post('/devices', createDevice);
router.put('/devices/:id', updateDevice);
router.delete('/devices/:id', deleteDevice);
router.get('/devices/logs', getDeviceLogs);
router.post('/devices/simulate-tap', triggerSimulationTap);
router.post('/devices/:id/restart', restartDevice);
router.post('/devices/testing/connect', queueConnectionTest);
router.post('/devices/testing/read-users', queueReadUsers);
router.post('/devices/testing/read-attendance', queueReadAttendance);
router.post('/devices/testing/sync-firebase', queueSyncFirebase);
router.post('/devices/testing/import-users', queueImportUsers);
router.get('/devices/testing/status', getTesterStatus);
router.get('/devices/testing/device-users', getDeviceUsers);
router.post('/devices/testing/seed-users', seedDeviceUsers);
router.get('/migrations', getMigrations);

// Dedicated Hikvision Endpoints
router.get('/devices/hikvision/status', getHikvisionStatus);
router.post('/devices/hikvision/test-connection', testHikvisionConnection);
router.post('/devices/hikvision/test-user-creation', testHikvisionUserCreation);
router.get('/devices/hikvision/capabilities', getHikvisionCapabilitiesController);
router.get('/devices/hikvision/diagnostics', getHikvisionDiagnostics);
router.post('/devices/hikvision/enroll', enrollHikvisionBiometrics);
router.post('/devices/hikvision/sync-users', syncHikvisionUsers);
router.post('/devices/hikvision/sync-events', syncHikvisionEvents);
router.get('/devices/hikvision/events', getHikvisionEvents);
router.post('/devices/hikvision/door/open', triggerHikvisionDoorUnlock);
router.get('/devices/hikvision/unmapped-users', getUnmappedDeviceUsers);
router.post('/devices/hikvision/map-user', mapDeviceUserToMember);
router.get('/devices/hikvision/terminal-users', getHikvisionTerminalUsers);
router.post('/devices/hikvision/bulk-map-members', bulkMapHikvisionUsers);

// Smart Biometric Enrollment
router.post('/devices/biometric/enroll-fingerprint', startEnrollFingerprint);
router.post('/devices/biometric/delete', deleteEnrollment);
router.post('/devices/biometric/sync', syncMemberToDevice);
router.post('/devices/biometric/auto-map-all', autoMapAllBiometrics);
router.get('/devices/biometric/status/:memberId', getEnrollmentStatus);

// Invoices & Billing
router.get('/billing', getInvoices);
router.post('/billing', createInvoice);
router.put('/billing/:id', updateInvoice);
router.delete('/billing/:id', deleteInvoice);
router.post('/billing/pay/:memberId', markPaymentPaid);

// Trainer Workout & Diet Builders
router.get('/trainers/workouts/:memberId', getWorkoutPlan);
router.post('/trainers/workouts', saveWorkoutPlan);
router.get('/trainers/diets/:memberId', getDietPlan);
router.post('/trainers/diets', saveDietPlan);

// Trainer CRUD & Assignment routes
router.get('/trainers', getTrainersList);
router.post('/trainers/seed-real-trainers', seedRealTrainers); // idempotent real-trainer import
router.post('/trainers', createTrainerProfile);
router.put('/trainers/:id', updateTrainerProfile);
router.delete('/trainers/:id', deleteTrainerProfile);
router.post('/trainers/:id/assign-members', assignMembersToTrainer);

// New Diet Management API routes
router.post('/trainers/diets/generate-ai', generateAIDiet);
router.post('/trainers/diets/:id/approve', approveDietPlan);
router.post('/trainers/diets/:id/duplicate', duplicateDietPlan);
router.delete('/trainers/diets/:id', archiveDietPlan);

// Cheat meal routes
router.get('/trainers/cheat-meals', getCheatMeals);
router.post('/trainers/cheat-meals', createCheatMealRequest);
router.put('/trainers/cheat-meals/:id', handleCheatMealRequest);

// Daily Diet Log routes
router.get('/members/diets/:memberId/logs/:date', getDailyLog);
router.post('/members/diets/logs', saveDailyLog);

// Member-Trainer Messaging Chat
router.get('/chat/:userA/:userB', getChatHistory);
router.post('/chat', sendChatMessage);

// Progress Timeline & Referrals
router.get('/progress/:memberId', getProgressTimeline);
router.post('/progress', addProgressRecord);
router.get('/referrals/:memberId', getReferralsByMember);
router.post('/referrals', createReferralInvitation);

// Automation Settings & Email Templates
router.get('/automation/smtp', getSmtpConfig);
router.post('/automation/smtp', saveSmtpConfig);
router.get('/automation/templates', getTemplates);
router.post('/automation/templates', saveTemplatesController);
router.post('/automation/smtp/test', sendTestEmail);
router.get('/automation/invoice/preview', getInvoicePreview);

// Gym Memberships config
router.get('/memberships', getPlansController);
router.post('/memberships', createPlanController);
router.put('/memberships/:id', updatePlanController);
router.delete('/memberships/:id', deletePlanController);

import { getFollowups, createFollowup, updateFollowup, deleteFollowup, triggerAutomatedFollowups } from '../controllers/followup.controller';

// Employee Management
router.get('/employees', getEmployees);
router.post('/employees', createEmployee);
router.put('/employees/:id', updateEmployee);
router.delete('/employees/:id', deleteEmployee);
router.get('/employee-attendance', getEmployeeAttendance);

// Followups Management
router.get('/followups', getFollowups);
router.post('/followups', createFollowup);
router.post('/followups/generate-automated', triggerAutomatedFollowups);
router.put('/followups/:id', updateFollowup);
router.delete('/followups/:id', deleteFollowup);

export default router;
