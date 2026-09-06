import { generateAutomatedFollowups } from '../services/followupAutomation.service';

let intervalTimer: NodeJS.Timeout | null = null;
let lastRunDateStr = '';

export function startFollowupAutomationJob() {
  console.log('[Followup Automation Job] Initializing daily follow-up automation scheduler...');

  // 1. Run immediately on server boot (with short 5s delay to let Firebase initialize)
  setTimeout(async () => {
    try {
      console.log('[Followup Automation Job] Executing initial boot check...');
      const res = await generateAutomatedFollowups();
      console.log(`[Followup Automation Job] Initial check complete: ${res.generatedCount} created, ${res.skippedCount} existing/skipped.`);
    } catch (err) {
      console.error('[Followup Automation Job] Initial check error:', err);
    }
  }, 5000);

  // 2. Periodic check every 1 hour to see if day has changed (in Asia/Kolkata timezone)
  if (intervalTimer) {
    clearInterval(intervalTimer);
  }

  intervalTimer = setInterval(async () => {
    try {
      const res = await generateAutomatedFollowups();
      if (res.generatedCount > 0) {
        console.log(`[Followup Automation Job] Periodic run created ${res.generatedCount} new follow-up(s).`);
      }
    } catch (err) {
      console.error('[Followup Automation Job] Periodic run error:', err);
    }
  }, 60 * 60 * 1000); // Check hourly
}

export function stopFollowupAutomationJob() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
