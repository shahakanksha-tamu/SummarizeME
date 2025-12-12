// DOM element references for metadata, content display, and controls
const els = {
  meta: document.getElementById("meta"),
  lenTag: document.getElementById("lenTag"),
  wordTag: document.getElementById("wordTag"),
  timeTag: document.getElementById("timeTag"),
  content: document.getElementById("content"),
  copyBtn: document.getElementById("copyBtn"),
  lengthSelect: document.getElementById("lengthSelect"),
};

// Backend API endpoint for summary generation
const API_URL = "http://localhost:8000/summarize";

// State variables for the currently selected text and UI state
let currentSelection = null;
let isLoading = false;
let currentLengthMode = "medium";

// Format timestamp for display
function fmtTime(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return ""; }
}

// Compute the number of words in a given string
function countWords(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

// Clear metadata fields whenever a new summary is generated
function resetMeta() {
  els.lenTag.textContent = "";
  els.wordTag.textContent = "";
  els.timeTag.textContent = "";
}

// Display loading state in the UI
function showLoading(isResummarize = false) {
  resetMeta();
  els.content.className = "loading";
  els.content.textContent = isResummarize
    ? "Updating summary for selected length..."
    : "Generating summary...";
}

// Display error messages from backend or local failures
function showError(msg) {
  els.content.className = "error";
  els.content.textContent = `${msg}`;
}

// Render a completed summary along with metadata
function showSummary(sel, summary) {
  if (!sel) {
    console.warn("showSummary invoked without selection context.");
    return;
  }

  els.content.className = "";
  els.content.textContent = summary || "";
  els.meta.textContent = [sel.page_title, sel.page_url].filter(Boolean).join(" — ");

  // Display summary statistics
  els.lenTag.textContent = `${summary.length} chars`;
  els.wordTag.textContent = `${countWords(summary)} words`;
  els.timeTag.textContent = fmtTime(sel.ts);
}

// Retrieve desired summary length ("short", "medium", "long")
function getCurrentLengthMode() {
  if (!els.lengthSelect) return "medium";
  return els.lengthSelect.value || "medium";
}

// Main function to request summary generation from backend
async function summarizeCurrentSelection(isResummarize = false) {
  if (!currentSelection || !currentSelection.text) {
    console.warn("summarizeCurrentSelection invoked without valid text.");
    return;
  }

  isLoading = true;
  currentLengthMode = getCurrentLengthMode();

  // Persist intermediate loading state.
  chrome.storage.local.set({
    lastSelection: {
      ...currentSelection,
      loading: true,
      error: null,
      length_mode: currentLengthMode,
    },
  });

  showLoading(isResummarize);

  try {
    // Construct backend request payload.
    const payload = {
      text: currentSelection.text,
      level: currentLengthMode,
    };

    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Validate HTTP response
    if (!resp.ok) {
      throw new Error(`Backend error: ${resp.status}`);
    }

    // Parse backend response
    const data = await resp.json();

    if (data.ok === false) {
      throw new Error(data.error || "Backend returned failure status.");
    }

    const summary = data.summary || "";

    // Update local state.
    currentSelection = {
      ...currentSelection,
      summary,
      loading: false,
      error: null,
      length_mode: currentLengthMode,
    };

    chrome.storage.local.set({ lastSelection: currentSelection });

    // Update UI with newly generated summary.
    showSummary(currentSelection, summary);

    // Notify background scripts of new summary.
    chrome.runtime.sendMessage(
      { type: "NEW_SUMMARY", payload: summary },
      () => void chrome.runtime.lastError
    );

  } catch (err) {
    // Handle backend or parsing failures.
    const msg = err?.message || "Summary generation failed.";
    currentSelection = {
      ...currentSelection,
      loading: false,
      error: msg,
      length_mode: currentLengthMode,
    };

    chrome.storage.local.set({ lastSelection: currentSelection });
    showError(msg);

  } finally {
    isLoading = false;
  }
}

// Handle messages sent from the background script.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "LOADING") {
    showLoading();
  } else if (msg?.type === "ERROR") {
    showError(msg.payload);
  } else if (msg?.type === "NEW_SUMMARY") {
    chrome.storage.local.get("lastSelection", ({ lastSelection }) => {
      showSummary(lastSelection || currentSelection, msg.payload);
    });
  } else if (msg?.type === "NEW_SELECTION") {
    
    // Update selection context when new text is provided.
    currentSelection = msg.payload || null;

    // Sync length selector state.
    if (currentSelection?.length_mode && els.lengthSelect) {
      els.lengthSelect.value = currentSelection.length_mode;
    } else if (els.lengthSelect) {
      els.lengthSelect.value = "medium";
    }

    summarizeCurrentSelection(false);
  }
});

// Initialize panel state when the UI opens.
(async function init() {
  const { lastSelection } = await chrome.storage.local.get("lastSelection");

  if (!lastSelection) {
    chrome.runtime.sendMessage({ type: "PANEL_READY" }, () => void chrome.runtime.lastError);
    return;
  }

  currentSelection = lastSelection;

  if (els.lengthSelect && lastSelection.length_mode) {
    els.lengthSelect.value = lastSelection.length_mode;
  }

  // Restore UI to match the last known panel state.
  if (lastSelection.loading) {
    showLoading();
  } else if (lastSelection.error) {
    showError(lastSelection.error);
  } else if (lastSelection.summary) {
    showSummary(lastSelection, lastSelection.summary);
  } else {
    summarizeCurrentSelection(false);
  }

  chrome.runtime.sendMessage({ type: "PANEL_READY" }, () => void chrome.runtime.lastError);
})();

// Copy summary text to clipboard.
els.copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(els.content.textContent || "");
    toast("Copied to clipboard");
  } catch {
    toast("Copy operation failed");
  }
});

// Re-summarize when the user selects a different length mode.
if (els.lengthSelect) {
  els.lengthSelect.addEventListener("change", () => {
    if (!currentSelection || isLoading) return;
    summarizeCurrentSelection(true);
  });
}

// Lightweight toast notification mechanism.
let toastTimer;
function toast(message) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.className = "toast show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 1400);
}
