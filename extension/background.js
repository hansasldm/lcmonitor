import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

let session = null;
let historyBuffer = [];
const BATCH_INTERVAL_MS = 60000; // Send history every 1 minute
let batchTimer = null;

// Initialize
chrome.storage.local.get('session', (data) => {
  if (data.session) {
    session = data.session;
    startMonitoring();
  }
});

// Listen for login/logout from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'LOGIN_SUCCESS') {
    chrome.storage.local.get('session', (data) => {
      session = data.session;
      startMonitoring();
    });
  } else if (msg.type === 'LOGOUT_SUCCESS') {
    stopMonitoring();
  }
});

function startMonitoring() {
  if (!session) return;
  console.log("Starting monitoring for", session.user.email);
  
  // 1. Setup 15-minute screenshot alarm
  chrome.alarms.create("screenshot_alarm", {
    periodInMinutes: 15
  });

  // 2. Start history batching timer
  if (batchTimer) clearInterval(batchTimer);
  batchTimer = setInterval(flushHistoryBuffer, BATCH_INTERVAL_MS);
}

function stopMonitoring() {
  session = null;
  console.log("Stopped monitoring");
  chrome.alarms.clear("screenshot_alarm");
  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }
  historyBuffer = [];
}

// Handle Screenshot Alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "screenshot_alarm" && session) {
    takeScreenshot();
  }
});

async function takeScreenshot() {
  try {
    // Capture visible tab
    const dataUrl = await new Promise((resolve) => {
      chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 50 }, (data) => {
        resolve(data);
      });
    });

    if (!dataUrl) return;

    // Convert dataUrl to blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    
    const userId = session.user.id;
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}.jpg`;

    // 1. Upload to Supabase Storage
    const storageRes = await fetch(`${SUPABASE_URL}/storage/v1/object/screenshots/${filePath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'image/jpeg'
      },
      body: blob
    });

    if (!storageRes.ok) {
      console.error("Storage upload failed", await storageRes.text());
      return;
    }

    // 2. Insert into screenshots table
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/screenshots`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: userId,
        storage_path: filePath,
        taken_at: new Date().toISOString(),
        is_blurred: false
      })
    });

    if (!dbRes.ok) {
      console.error("DB insert failed", await dbRes.text());
    } else {
      console.log("Screenshot saved!");
    }

  } catch (err) {
    console.error("Screenshot error:", err);
  }
}

// Handle History Tracking
chrome.history.onVisited.addListener((historyItem) => {
  if (!session) return;
  
  // Ignore chrome:// or internal extensions
  if (historyItem.url.startsWith('chrome://') || historyItem.url.startsWith('chrome-extension://')) return;

  historyBuffer.push({
    user_id: session.user.id,
    url: historyItem.url,
    title: historyItem.title || "",
    timestamp: new Date(historyItem.lastVisitTime || Date.now()).toISOString(),
    duration_seconds: 0 // Cannot easily calculate duration in background just from onVisited
  });
  
  if (historyBuffer.length > 50) {
    flushHistoryBuffer();
  }
});

async function flushHistoryBuffer() {
  if (historyBuffer.length === 0 || !session) return;
  
  const payload = [...historyBuffer];
  historyBuffer = [];

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/browser_history`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error("History flush failed", await res.text());
      // Optionally put items back in buffer if failed
      // historyBuffer.push(...payload);
    } else {
      console.log(`Flushed ${payload.length} history items`);
    }
  } catch (err) {
    console.error("History flush error", err);
  }
}
