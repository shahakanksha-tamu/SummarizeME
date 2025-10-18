const PANEL_PATH = "panel/panel.html";
const MENU_ID = "summarize-selection";

// Create or refresh context menu on install/update
chrome.runtime.onInstalled.addListener(() => {
  try { chrome.contextMenus.remove(MENU_ID); } catch {}
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Summarize",
    contexts: ["selection"]
  });

  // Optional: allow toolbar button to open the panel
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
});

function openPanelForTab(tabId) {
  if (!tabId) return;
  // Fire-and-forget config, then open immediately (keep gesture)
  chrome.sidePanel.setOptions({ tabId, path: PANEL_PATH, enabled: true });
  chrome.sidePanel.open({ tabId }, () => {
    const err = chrome.runtime.lastError;
    if (err) console.warn("[bg] sidePanel.open:", err.message);
  });
}

// Context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const tabId = tab?.id;
  if (!tabId) {
    console.error("[bg] No tabId; try on a normal https:// page.");
    return;
  }

  const payload = {
    text: info.selectionText || "",
    page_title: tab?.title || "",
    page_url: info.pageUrl || "",
    ts: Date.now()
  };

  // Save for the panel
  chrome.storage.local.set({ lastSelection: payload });

  // Open panel
  openPanelForTab(tabId);

  chrome.runtime.sendMessage({ type: "NEW_SELECTION", payload }, () => {
    void chrome.runtime.lastError; // ignore "Receiving end does not exist"
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "PANEL_READY") {
    chrome.storage.local.get("lastSelection", (data) => {
      const payload = data?.lastSelection;
      if (!payload) return;
      chrome.runtime.sendMessage({ type: "NEW_SELECTION", payload }, () => {
        void chrome.runtime.lastError;
      });
    });
  }
});
