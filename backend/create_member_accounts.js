/**
 * create_member_accounts.js  (v3 — ACTIVE ONLY + smart naming)
 *
 * 1. Deletes ALL existing Firebase Auth accounts (clean slate)
 * 2. Reads ONLY ACTIVE members from Firestore (status === 'active')
 * 3. Smart email naming:
 *      - Unique first name  →  firstname@alpha.com
 *      - Duplicate first name → firstname.lastname@alpha.com
 * 4. Creates Firebase Auth accounts  (password: 1234567)
 * 5. Sets appAccessEnabled = true on active, false on expired
 *
 * Run:  node create_member_accounts.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db       = admin.firestore();
const auth     = admin.auth();
const PASSWORD = '1234567';

// ── helpers ──────────────────────────────────────────────────────────────────

function clean(str) {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstName(name) { return clean(name).split(' ')[0]; }
function fullSlug(name)  { return clean(name).split(' ').filter(Boolean).join('.'); }

function buildEmailMap(members) {
  const firstNameCount = {};
  for (const { name } of members) {
    const fn = firstName(name);
    if (fn) firstNameCount[fn] = (firstNameCount[fn] || 0) + 1;
  }

  const emailMap  = {};
  const usedEmails = new Set();

  for (const { id, name } of members) {
    const fn   = firstName(name);
    const slug = fullSlug(name);
    if (!fn) { emailMap[id] = null; continue; }

    let email = firstNameCount[fn] === 1
      ? `${fn}@alpha.com`
      : `${slug}@alpha.com`;

    // Collision guard (truly identical full names)
    let candidate = email;
    let counter   = 2;
    while (usedEmails.has(candidate)) {
      candidate = email.replace('@alpha.com', `${counter}@alpha.com`);
      counter++;
    }
    usedEmails.add(candidate);
    emailMap[id] = candidate;
  }
  return emailMap;
}

// ── delete all auth accounts ─────────────────────────────────────────────────

async function deleteAllAuthAccounts() {
  console.log('\n🗑️  Deleting ALL existing Firebase Auth accounts...');
  let total = 0;
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    const uids   = result.users.map(u => u.uid);
    if (uids.length > 0) {
      await auth.deleteUsers(uids);
      total += uids.length;
      console.log(`   Deleted ${uids.length} accounts (total: ${total})`);
    }
    pageToken = result.pageToken;
  } while (pageToken);
  console.log(`✅ Cleared ${total} auth accounts.\n`);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  The Warrior Gym — Active Member Account Setup (v3)');
  console.log('═══════════════════════════════════════════════════\n');

  // Step 1 — wipe all existing auth accounts
  await deleteAllAuthAccounts();

  // Step 2 — load members from Firestore
  console.log('📂 Fetching members from Firestore...');
  const snap = await db.collection('members').get();

  const allMembers   = [];
  const expiredDocIds = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    // Skip mirror docs (those with originalDocId field)
    if (d.originalDocId) continue;
    const name   = (d.name || '').trim();
    const status = (d.status || '').toLowerCase();
    if (!name) continue;

    if (status === 'active') {
      allMembers.push({ id: doc.id, name, data: d });
    } else {
      expiredDocIds.push(doc.id);
    }
  }

  console.log(`  Active   : ${allMembers.length} members → will create accounts`);
  console.log(`  Expired  : ${expiredDocIds.length} members → appAccessEnabled = false\n`);

  // Step 3 — disable app access for expired members
  console.log('🔒 Disabling app access for expired members...');
  const disableBatch = db.batch();
  let batchCount = 0;
  for (const docId of expiredDocIds) {
    disableBatch.update(db.collection('members').doc(docId), {
      appAccessEnabled: false,
      authUid: null,
      appEmail: null,
    });
    batchCount++;
    if (batchCount >= 500) {
      await disableBatch.commit();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await disableBatch.commit();
  console.log(`✅ Disabled access for ${expiredDocIds.length} expired members.\n`);

  // Step 4 — build smart email map for active members
  const emailMap = buildEmailMap(allMembers);
  const dupeCount = Object.values(emailMap).filter(e => e && e.split('@')[0].includes('.')).length;
  if (dupeCount > 0) console.log(`ℹ️  ${dupeCount} members have duplicate first names → full name email used.\n`);

  // Step 5 — create accounts for active members
  console.log('🚀 Creating Firebase Auth accounts for active members...\n');
  const results = { created: 0, skipped: 0, errors: [] };

  for (const { id: docId, name, data } of allMembers) {
    const email = emailMap[docId];
    if (!email) { results.skipped++; continue; }

    process.stdout.write(`  👤 ${name.padEnd(28)} → ${email.padEnd(36)} `);

    try {
      const newUser = await auth.createUser({
        email,
        password: PASSWORD,
        displayName: name,
        emailVerified: true,
      });
      const uid = newUser.uid;
      process.stdout.write(`✅\n`);

      // Update original member doc
      await db.collection('members').doc(docId).update({
        authUid:          uid,
        appEmail:         email,
        appAccessEnabled: true,
      });

      // Mirror under auth UID for fast lookup in auth_service.dart
      if (docId !== uid) {
        await db.collection('members').doc(uid).set({
          ...data,
          id:               uid,
          authUid:          uid,
          appEmail:         email,
          appAccessEnabled: true,
          originalDocId:    docId,
        });
      }

      results.created++;
    } catch (err) {
      process.stdout.write(`❌ ${err.message}\n`);
      results.errors.push({ name, email, error: err.message });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Done!');
  console.log(`   Created : ${results.created} accounts (active members)`);
  console.log(`   Skipped : ${results.skipped}`);
  console.log(`   Errors  : ${results.errors.length}`);
  if (results.errors.length) {
    results.errors.forEach(e => console.log(`    • ${e.name} (${e.email}): ${e.error}`));
  }
  console.log('\n📱 Login credentials for active members:');
  console.log('   Email    : firstname@alpha.com');
  console.log('   Password : 1234567');
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
