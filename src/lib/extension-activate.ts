// Silently activates the LC Monitor Chrome extension after login.
// Fails silently if the extension is not installed or messaging is unavailable.
const EXTENSION_ID = "knficjgnnobghcolkkhdljidamomnhec";

export function activateMonitorExtension(userId: string, monitorToken?: string | null) {
  if (!userId || !monitorToken) return;
  try {
    const c: any = (globalThis as any).chrome;
    if (!c?.runtime?.sendMessage) return;
    c.runtime.sendMessage(
      EXTENSION_ID,
      { type: "ACTIVATE_MONITORING", token: monitorToken, employeeId: userId },
      (response: unknown) => {
        // Swallow chrome.runtime.lastError to avoid console noise when extension isn't installed
        const err = c.runtime?.lastError;
        if (err) return;
        // eslint-disable-next-line no-console
        console.log("LC Monitor extension activated", response);
      }
    );
  } catch {
    // ignore
  }
}
