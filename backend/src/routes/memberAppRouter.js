/**
 * auto_account_trigger.js
 * 
 * Express API endpoint that auto-creates/manages Firebase Auth accounts
 * when a member's status changes. Call this from the CRM frontend.
 * 
 * POST /api/member-app/provision   { memberId }  → creates account if active
 * POST /api/member-app/revoke      { memberId }  → disables account if expired
 * GET  /api/member-app/status      { memberId }  → returns account status
 * 
 * Also exports provisionMemberAccount() for use in other routes (e.g. renewal flow)
 */

const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();

const db   = admin.firestore();
const auth = admin.auth();
const PASSWORD = '1234567';

// ── helpers (same smart-naming logic as the setup script) ────────────────────

function clean(str) {
  return (str || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function firstName(name) { return clean(name).split(' ')[0]; }
function fullSlug(name)  { return clean(name).split(' ').filter(Boolean).join('.'); }

/**
 * Given all active member names, determine the right email prefix for this member.
 * Unique first name → firstname, duplicate → firstname.lastname
 */
async function resolveEmail(memberName) {
  // Fetch all active member names to detect duplicates
  const snap = await db.collection('members')
    .where('status', '==', 'active')
    .get();

  const fn = firstName(memberName);
  let count = 0;
  snap.docs.forEach(d => {
    if (d.data().originalDocId) return; // skip mirrors
    if (firstName(d.data().name || '') === fn) count++;
  });

  const slug = count > 1 ? fullSlug(memberName) : fn;
  let email  = `${slug}@alpha.com`;

  // Collision guard — check if email already taken by another member
  try {
    const existing = await auth.getUserByEmail(email);
    // Email taken — append number
    email = `${slug}2@alpha.com`;
  } catch (_) {
    // Not taken — good
  }

  return email;
}

/**
 * Core function: create/enable a member's Firebase Auth account.
 * Call this whenever a member becomes active (renewal, new join).
 */
async function provisionMemberAccount(memberId) {
  const docRef = db.collection('members').doc(memberId);
  const doc    = await docRef.get();

  if (!doc.exists) throw new Error(`Member ${memberId} not found in Firestore`);

  const data   = doc.data();
  const name   = (data.name || '').trim();
  const status = (data.status || '').toLowerCase();

  if (status !== 'active') {
    throw new Error(`Member is not active (status: ${status}). Revoke instead.`);
  }

  // Check if account already exists
  const existingEmail = data.appEmail;
  if (existingEmail) {
    try {
      const existingUser = await auth.getUserByEmail(existingEmail);
      // Account exists — enable it and update password
      await auth.updateUser(existingUser.uid, {
        password: PASSWORD,
        disabled: false,
      });
      await docRef.update({ appAccessEnabled: true, authUid: existingUser.uid });

      // Update mirror doc too
      const mirrorRef = db.collection('members').doc(existingUser.uid);
      const mirrorDoc = await mirrorRef.get();
      if (mirrorDoc.exists) {
        await mirrorRef.update({ appAccessEnabled: true });
      }

      return { action: 'enabled', email: existingEmail, uid: existingUser.uid };
    } catch (_) {
      // Account was deleted externally — recreate below
    }
  }

  // Create new account
  const email   = await resolveEmail(name);
  const newUser = await auth.createUser({
    email,
    password: PASSWORD,
    displayName: name,
    emailVerified: true,
  });
  const uid = newUser.uid;

  // Update original doc
  await docRef.update({
    authUid:          uid,
    appEmail:         email,
    appAccessEnabled: true,
  });

  // Create mirror doc under auth UID
  if (memberId !== uid) {
    await db.collection('members').doc(uid).set({
      ...data,
      id:               uid,
      authUid:          uid,
      appEmail:         email,
      appAccessEnabled: true,
      originalDocId:    memberId,
    });
  }

  return { action: 'created', email, uid };
}

/**
 * Disable a member's Firebase Auth account (expired / manually revoked).
 */
async function revokeMemberAccount(memberId) {
  const docRef = db.collection('members').doc(memberId);
  const doc    = await docRef.get();
  if (!doc.exists) throw new Error(`Member ${memberId} not found`);

  const data  = doc.data();
  const uid   = data.authUid;

  if (uid) {
    try {
      await auth.updateUser(uid, { disabled: true });
    } catch (_) {}
  }

  await docRef.update({ appAccessEnabled: false });

  // Update mirror doc
  if (uid && uid !== memberId) {
    const mirrorDoc = await db.collection('members').doc(uid).get();
    if (mirrorDoc.exists) {
      await db.collection('members').doc(uid).update({ appAccessEnabled: false });
    }
  }

  return { action: 'revoked', uid };
}

// ── Express routes ────────────────────────────────────────────────────────────

// POST /api/member-app/provision
router.post('/provision', async (req, res) => {
  try {
    const { memberId } = req.body;
    if (!memberId) return res.status(400).json({ error: 'memberId required' });
    const result = await provisionMemberAccount(memberId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/member-app/revoke
router.post('/revoke', async (req, res) => {
  try {
    const { memberId } = req.body;
    if (!memberId) return res.status(400).json({ error: 'memberId required' });
    const result = await revokeMemberAccount(memberId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/member-app/status?memberId=xxx
router.get('/status', async (req, res) => {
  try {
    const { memberId } = req.query;
    if (!memberId) return res.status(400).json({ error: 'memberId required' });

    const doc = await db.collection('members').doc(memberId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Member not found' });

    const data = doc.data();
    res.json({
      memberId,
      name:             data.name,
      status:           data.status,
      appAccessEnabled: data.appAccessEnabled ?? false,
      appEmail:         data.appEmail ?? null,
      authUid:          data.authUid ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.provisionMemberAccount = provisionMemberAccount;
module.exports.revokeMemberAccount    = revokeMemberAccount;
