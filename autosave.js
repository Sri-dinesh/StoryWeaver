/*
  Autosave + Version History + Keyboard Shortcuts for StoryWeaver
  - Autosaves current story object (tries several common global names) every X seconds
  - Stores N snapshots in localStorage under "storyForge_snapshots"
  - Provides a lightweight restore UI and snapshot list
  - Implements keyboard shortcuts:
      N       -> New Scene (clicks #newSceneBtn)
      Space   -> Preview (clicks #previewBtn) (prevents when typing)
      Delete  -> Delete selected (clicks #deleteSceneBtn)
      Ctrl+Z  -> Undo (restore previous snapshot)
      Ctrl+Y  -> Redo (restore next snapshot)
  Notes:
  - If your app exposes getStory() / setStory() / renderStory() use those names;
    autosave will try them automatically.
*/

(function () {
  const SNAP_KEY = "storyForge_snapshots";
  const LAST_KEY = "storyForge_lastSaved";
  const MAX_SNAPSHOTS = 25;
  const AUTOSAVE_INTERVAL_MS = 5000; // 5s

  let autosaveTimer = null;
  let lastHash = null;
  let undoStack = []; // in-memory indexes into snapshots array
  let redoStack = [];

  function nowISO() {
    return new Date().toISOString();
  }

  function safeStringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return String(obj);
    }
  }

  function readStory() {
    // Prefer explicit getters if app provides them
    if (typeof window.getStory === "function") return window.getStory();
    if (window.story) return window.story;
    if (window.storyData) return window.storyData;
    if (window.currentStory) return window.currentStory;
    // fallback: data attribute on board
    const board = document.getElementById("board");
    if (board && board.dataset && board.dataset.story) {
      try {
        return JSON.parse(board.dataset.story);
      } catch (e) {
        return board.dataset.story;
      }
    }
    return null;
  }

  function writeStory(state) {
    if (typeof window.setStory === "function") {
      try {
        window.setStory(state);
        return true;
      } catch (e) {
        // fallback to assignment
      }
    }
    if (window.story !== undefined) {
      window.story = state;
      fireAppUpdate();
      return true;
    }
    if (window.storyData !== undefined) {
      window.storyData = state;
      fireAppUpdate();
      return true;
    }
    if (window.currentStory !== undefined) {
      window.currentStory = state;
      fireAppUpdate();
      return true;
    }
    const board = document.getElementById("board");
    if (board) {
      board.dataset.story = safeStringify(state);
      fireAppUpdate();
      return true;
    }
    return false;
  }

  function fireAppUpdate() {
    // Let app re-render if it listens to this event
    window.dispatchEvent(new CustomEvent("storyforge:restored"));
    // try common rendering hooks
    if (typeof window.renderStory === "function") window.renderStory();
    if (typeof window.refreshBoard === "function") window.refreshBoard();
  }

  function loadSnapshots() {
    try {
      const raw = localStorage.getItem(SNAP_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSnapshots(arr) {
    try {
      localStorage.setItem(SNAP_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn("Autosave: failed to save snapshots", e);
    }
  }

  function pushSnapshot(state) {
    const snapshots = loadSnapshots();
    const item = {
      ts: nowISO(),
      data: state,
      meta: {
        title: (state && state.title) || null,
      },
    };
    // avoid consecutive duplicates
    const last = snapshots.length ? snapshots[snapshots.length - 1] : null;
    if (last && safeStringify(last.data) === safeStringify(item.data)) {
      // update timestamp only
      last.ts = item.ts;
      saveSnapshots(snapshots);
      localStorage.setItem(LAST_KEY, item.ts);
      return snapshots.length - 1;
    }

    snapshots.push(item);
    while (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();
    saveSnapshots(snapshots);
    localStorage.setItem(LAST_KEY, item.ts);
    return snapshots.length - 1;
  }

  function autosaveTick() {
    const state = readStory();
    if (!state) return;
    const hash = safeStringify(state);
    if (hash === lastHash) return;
    lastHash = hash;
    const idx = pushSnapshot(state);
    // maintain undo stack as pointer indexes
    undoStack.push(idx);
    redoStack = [];
    updateAutosaveUI();
  }

  function startAutosave() {
    if (autosaveTimer) clearInterval(autosaveTimer);
    autosaveTimer = setInterval(autosaveTick, AUTOSAVE_INTERVAL_MS);
    // immediate save on start
    setTimeout(autosaveTick, 200);
  }

  function stopAutosave() {
    if (autosaveTimer) {
      clearInterval(autosaveTimer);
      autosaveTimer = null;
    }
  }

  // UI: small floating control and modal
  function createAutosaveUI() {
    if (document.getElementById("sf-autosave-ui")) return;
    const container = document.createElement("div");
    container.id = "sf-autosave-ui";
    container.style.position = "fixed";
    container.style.left = "12px";
    container.style.bottom = "12px";
    container.style.zIndex = 9999;
    container.style.fontFamily = "sans-serif";
    container.innerHTML = `
      <div style="background:rgba(0,0,0,0.6);color:#fff;padding:8px;border-radius:8px;min-width:180px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="font-size:12px">Autosave</div>
          <div id="sf-last-saved" style="font-size:11px;opacity:0.9">...</div>
        </div>
        <div style="margin-top:6px;display:flex;gap:6px">
          <button id="sf-open-history" style="flex:1;padding:6px;border-radius:4px;border:0;background:#fff;color:#111;font-weight:600;cursor:pointer">History</button>
          <button id="sf-save-now" style="padding:6px;border-radius:4px;border:0;background:#2b6cff;color:#fff;cursor:pointer">Save</button>
        </div>
      </div>
      <div id="sf-history-modal" style="display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10000">
        <div style="background:#fff;color:#111;padding:16px;border-radius:8px;min-width:360px;box-shadow:0 8px 30px rgba(0,0,0,0.3)">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <strong>Snapshots</strong>
            <div>
              <button id="sf-history-close" style="margin-right:8px">Close</button>
              <button id="sf-history-clear" style="background:#ff5c5c;color:#fff;border:0;padding:6px;border-radius:4px">Clear</button>
            </div>
          </div>
          <div id="sf-history-list" style="margin-top:12px;max-height:320px;overflow:auto"></div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    document.getElementById("sf-save-now").addEventListener("click", () => {
      autosaveTick();
      flashMessage("Saved");
    });
    document.getElementById("sf-open-history").addEventListener("click", () => {
      renderHistoryModal();
      document.getElementById("sf-history-modal").style.display = "block";
    });
    document
      .getElementById("sf-history-close")
      .addEventListener("click", () => {
        document.getElementById("sf-history-modal").style.display = "none";
      });
    document
      .getElementById("sf-history-clear")
      .addEventListener("click", () => {
        if (!confirm("Clear all autosave snapshots?")) return;
        localStorage.removeItem(SNAP_KEY);
        renderHistoryModal();
        updateAutosaveUI();
      });
  }

  function flashMessage(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.position = "fixed";
    el.style.right = "12px";
    el.style.bottom = "12px";
    el.style.background = "rgba(0,0,0,0.75)";
    el.style.color = "#fff";
    el.style.padding = "8px 12px";
    el.style.borderRadius = "6px";
    el.style.zIndex = 10001;
    document.body.appendChild(el);
    setTimeout(() => (el.style.opacity = "0.0"), 1200);
    setTimeout(() => document.body.removeChild(el), 1600);
  }

  function renderHistoryModal() {
    const list = document.getElementById("sf-history-list");
    if (!list) return;
    const snapshots = loadSnapshots().slice().reverse();
    if (!snapshots.length) {
      list.innerHTML = "<div style='opacity:.8'>No snapshots yet</div>";
      return;
    }
    list.innerHTML = snapshots
      .map((s, i) => {
        const idx = snapshots.length - 1 - i;
        return `
        <div style="border-bottom:1px solid #eee;padding:8px 0;display:flex;justify-content:space-between;align-items:center">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600">${
              s.meta && s.meta.title
                ? escapeHtml(s.meta.title)
                : "Scene snapshot"
            }</div>
            <div style="font-size:12px;color:#666">${new Date(
              s.ts
            ).toLocaleString()}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button data-idx="${idx}" class="sf-restore-btn">Restore</button>
            <button data-idx="${idx}" class="sf-delete-btn" style="background:#ffebeb">Delete</button>
          </div>
        </div>
      `;
      })
      .join("");
    // attach handlers
    Array.from(list.querySelectorAll(".sf-restore-btn")).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        restoreSnapshotIndex(idx);
        document.getElementById("sf-history-modal").style.display = "none";
      });
    });
    Array.from(list.querySelectorAll(".sf-delete-btn")).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.currentTarget.dataset.idx);
        deleteSnapshotIndex(idx);
        renderHistoryModal();
        updateAutosaveUI();
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c])
    );
  }

  function deleteSnapshotIndex(idx) {
    const snaps = loadSnapshots();
    if (idx < 0 || idx >= snaps.length) return;
    snaps.splice(idx, 1);
    saveSnapshots(snaps);
  }

  function restoreSnapshotIndex(idx) {
    const snaps = loadSnapshots();
    if (idx < 0 || idx >= snaps.length) return;
    const snap = snaps[idx];
    if (!snap) return;
    const current = readStory();
    if (current) {
      // push current to redo stack
      const curIdx = pushSnapshot(current);
      redoStack.push(curIdx);
    }
    writeStory(snap.data);
    // update hashes and stacks
    lastHash = safeStringify(snap.data);
    undoStack.push(idx);
    flashMessage("Snapshot restored");
  }

  function updateAutosaveUI() {
    const last = localStorage.getItem(LAST_KEY);
    const el = document.getElementById("sf-last-saved");
    if (el) el.textContent = last ? new Date(last).toLocaleTimeString() : "—";
  }

  // Simple undo/redo using snapshot indexes
  function handleUndo() {
    const snaps = loadSnapshots();
    if (!snaps.length) return flashMessage("Nothing to undo");
    // find last snapshot index that is different from current
    const current = readStory();
    const curHash = safeStringify(current);
    // find last snapshot with different data
    for (let i = snaps.length - 1; i >= 0; i--) {
      if (safeStringify(snaps[i].data) !== curHash) {
        // push current into redo
        const curIdx = pushSnapshot(current);
        redoStack.push(curIdx);
        writeStory(snaps[i].data);
        lastHash = safeStringify(snaps[i].data);
        flashMessage("Undo");
        return;
      }
    }
    flashMessage("No earlier snapshot");
  }

  function handleRedo() {
    if (!redoStack.length) return flashMessage("Nothing to redo");
    const snaps = loadSnapshots();
    const idx = redoStack.pop();
    const snap = snaps[idx];
    if (!snap) return flashMessage("Redo failed");
    // push current into undo
    const current = readStory();
    if (current) pushSnapshot(current);
    writeStory(snap.data);
    lastHash = safeStringify(snap.data);
    flashMessage("Redo");
  }

  // Keyboard shortcuts
  function onKeyDown(e) {
    const active = document.activeElement;
    const typing =
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable);
    // Ctrl/Cmd + Z / Y
    if (
      (e.ctrlKey || e.metaKey) &&
      !e.shiftKey &&
      e.key.toLowerCase() === "z"
    ) {
      e.preventDefault();
      handleUndo();
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key.toLowerCase() === "y" ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z"))
    ) {
      e.preventDefault();
      handleRedo();
      return;
    }
    if (typing) return; // don't override typing shortcuts for N / Space / Delete

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        const previewBtn = document.getElementById("previewBtn");
        if (previewBtn) previewBtn.click();
        return;
      }
      if (e.key.toLowerCase() === "n") {
        const newBtn = document.getElementById("newSceneBtn");
        if (newBtn) {
          e.preventDefault();
          newBtn.click();
        }
        return;
      }
      if (e.key === "Delete") {
        const del = document.getElementById("deleteSceneBtn");
        if (del && window.getComputedStyle(del).display !== "none") {
          e.preventDefault();
          del.click();
        }
        return;
      }
    }
  }

  // Hook into app init so module starts after app is ready
  function attachLifecycle() {
    createAutosaveUI();
    updateAutosaveUI();
    startAutosave();
    window.addEventListener("keydown", onKeyDown);
    // update UI when app restores state
    window.addEventListener("storyforge:restored", updateAutosaveUI);
  }

  // If initApp exists, wrap it so autosave starts after app init
  if (typeof window.initApp === "function") {
    const orig = window.initApp;
    window.initApp = function (...args) {
      const res = orig.apply(this, args);
      setTimeout(attachLifecycle, 200); // small delay to let app set up
      return res;
    };
  } else {
    // otherwise start on DOM ready
    window.addEventListener("DOMContentLoaded", () =>
      setTimeout(attachLifecycle, 400)
    );
  }

  // expose helpers for debugging
  window.storyForgeAutosave = {
    start: startAutosave,
    stop: stopAutosave,
    pushSnapshot,
    loadSnapshots,
    restoreSnapshotIndex,
    deleteSnapshotIndex,
    handleUndo,
    handleRedo,
  };
})();
