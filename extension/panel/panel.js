function applySelection(sel) {
  lastSelection = sel || null;

  const content = document.getElementById("content");
  const meta = document.getElementById("meta");
  const lenTag = document.getElementById("lenTag");
  const wordTag = document.getElementById("wordTag"); 
  const timeTag = document.getElementById("timeTag");

  if (!sel || !sel.text) {
    content.textContent = "Right-click some text on any page and choose “Summarize”.";
    meta.textContent = "";
    lenTag.textContent = "";
    wordTag.textContent = "";
    timeTag.textContent = "";
    return;
  }

  const text = sel.text.trim();
  const words = text.split(/\s+/).filter(Boolean).length;

  content.textContent = text; // preserves newlines
  meta.textContent = [sel.page_title, sel.page_url].filter(Boolean).join(" — ");
  lenTag.textContent = `${text.length} chars`;
  wordTag.textContent = `${words} words`; 
  timeTag.textContent = new Date(sel.ts || Date.now()).toLocaleString();
}


// Initial load
(async function init() {
  const { lastSelection } = await chrome.storage.local.get("lastSelection");
  applySelection(lastSelection);
})();

// Live update when background sends a new selection
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "NEW_SELECTION") applySelection(msg.payload);
});

// Copy button
document.getElementById("copyBtn").addEventListener("click", async () => {
  const text = document.getElementById("content").textContent || "";
  try { await navigator.clipboard.writeText(text); }
  catch { /* ignore */ }
});