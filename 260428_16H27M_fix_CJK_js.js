// ==UserScript==
// @name         Universal IME Fix for Safari/Chrome/Firefox (Claude/Gemini/Copilot/Grok/MetaAI)
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  Fix IME Enter/Esc key conflicts on AI chat sites. v2.3 fixes Claude search-chat selection bug & adds Meta AI.
// @author       Shu (Claude 01 account)
// @homepage     https://claude.ai/chat/dcf4c280-ca9a-4c8c-9daa-07e01b326470
// @match        https://*.claude.ai/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://m365.cloud.microsoft/*
// @match        https://*.cloud.microsoft/*
// @match        https://copilot.cloud.microsoft/*
// @match        https://www.office.com/*
// @match        https://grok.com/*
// @match        https://x.com/i/grok*
// @match        https://www.meta.ai/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

// Created: 2026-04-28
// Updated: 2026-04-29 (v2.2 - Firefox compatibility)
// Updated: 2026-04-29 (v2.3 - Claude search dialog fix + Meta AI)

(function() {
  'use strict';

  // ---------- State ----------
  let isComposing = false;
  let lastCompositionEndTime = 0;
  const ENTER_THRESHOLD_MS = 20;
  const ESC_THRESHOLD_MS = 20;
  // v2.3: Extended window specifically for "Enter that follows IME composition end"
  // Claude search dialog needs longer window because of focus transfer
  const POST_IME_ENTER_WINDOW_MS = 100;

  let pendingImeEnterKeyup = false;
  let pendingImeEscKeyup = false;

  // ---------- Cross-browser key detection ----------
  function isEnterKey(event) {
    return event.code === 'Enter' ||
           event.key === 'Enter' ||
           event.keyCode === 13;
  }

  function isEscapeKey(event) {
    return event.code === 'Escape' ||
           event.key === 'Escape' ||
           event.keyCode === 27;
  }

  // ---------- Detection ----------
  function isIMEActiveForEnter() {
    if (isComposing) return true;
    if (Date.now() - lastCompositionEndTime < ENTER_THRESHOLD_MS) return true;
    return false;
  }

  function isIMEActiveForEsc() {
    if (isComposing) return true;
    if (Date.now() - lastCompositionEndTime < ESC_THRESHOLD_MS) return true;
    return false;
  }

  // v2.3: Wider window for the post-IME Enter that may target dialog/listbox
  function isWithinPostImeEnterWindow() {
    if (isComposing) return true;
    if (Date.now() - lastCompositionEndTime < POST_IME_ENTER_WINDOW_MS) return true;
    return false;
  }

  // ---------- Universal handler ----------
  function handleKeyEvent(event) {
    // ----- KEYDOWN -----
    if (event.type === 'keydown') {
      if (isEnterKey(event) && !event.shiftKey) {
        const isImeEnter =
          isIMEActiveForEnter() ||
          event.keyCode === 229 ||
          event.key === 'Process';

        if (isImeEnter) {
          pendingImeEnterKeyup = true;
          event.stopImmediatePropagation();
          event.preventDefault();
          return;
        }
      }
      if (isEscapeKey(event)) {
        const isImeEsc =
          isIMEActiveForEsc() ||
          event.keyCode === 229 ||
          event.key === 'Process';

        if (isImeEsc) {
          pendingImeEscKeyup = true;
          event.stopImmediatePropagation();
          event.preventDefault();
          return;
        }
      }
    }

    // ----- KEYUP -----
    if (event.type === 'keyup') {
      // v2.3: Block Enter keyup if either:
      //   (a) we have a pending flag from previous keydown, OR
      //   (b) we're within the post-IME window (catches Claude search where
      //       focus transfers between keydown and keyup)
      if (isEnterKey(event) && (pendingImeEnterKeyup || isWithinPostImeEnterWindow())) {
        pendingImeEnterKeyup = false;
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      if (isEscapeKey(event) && pendingImeEscKeyup) {
        pendingImeEscKeyup = false;
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
    }

    // ----- KEYPRESS -----
    if (event.type === 'keypress') {
      if (isEnterKey(event) &&
          (isIMEActiveForEnter() || event.keyCode === 229 || event.key === 'Process')) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
    }
  }

  // ---------- v2.3: beforeinput handler for Claude search ----------
  // Claude search fires beforeinput with inputType "insertText" on the dialog
  // immediately after IME composition ends — this is one of the trigger paths
  // for "select first result". Block it during the post-IME window.
  function handleBeforeInput(event) {
    if (!isWithinPostImeEnterWindow()) return;

    // These inputTypes correspond to Enter-related text insertion that we
    // should suppress when IME just finished
    if (event.inputType === 'insertParagraph' ||
        event.inputType === 'insertLineBreak' ||
        event.inputType === 'insertText') {
      // Only block if target is a non-input element (i.e., focus has transferred
      // away from the original textarea/input) — this means it's a side-effect
      // of IME confirmation, not actual user typing
      const target = event.target;
      const isInputTarget = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      );
      if (!isInputTarget) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    }
  }

  // ---------- Composition tracking ----------
  function compositionStartHandler() {
    isComposing = true;
  }

  function compositionEndHandler() {
    isComposing = false;
    lastCompositionEndTime = Date.now();
    // Clear pending flags after the post-IME window expires (safety net)
    setTimeout(() => {
      pendingImeEnterKeyup = false;
      pendingImeEscKeyup = false;
    }, POST_IME_ENTER_WINDOW_MS + 50);
  }

  // ---------- Attach listeners ----------
  function attachListeners(target) {
    ['keydown', 'keypress', 'keyup'].forEach(eventType => {
      target.addEventListener(eventType, handleKeyEvent, true);
    });
    // v2.3: Also attach beforeinput at top level
    target.addEventListener('beforeinput', handleBeforeInput, true);
  }

  function attachCompositionListeners(target) {
    target.addEventListener('compositionstart', compositionStartHandler, true);
    target.addEventListener('compositionend', compositionEndHandler, true);
  }

  attachListeners(window);
  attachListeners(document);
  attachCompositionListeners(window);
  attachCompositionListeners(document);

  // ---------- Element-level attachment for dynamic inputs ----------
  const attachedElements = new WeakSet();

  function isInputLike(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    if (el.isContentEditable) return true;
    if (el.getAttribute && el.getAttribute('role') === 'textbox') return true;
    // v2.3: also catch combobox roles (Claude search uses these)
    if (el.getAttribute && el.getAttribute('role') === 'combobox') return true;
    return false;
  }

  // v2.3: Also detect dialog/listbox containers — these are common
  // post-IME-confirmation focus targets
  function isDialogLike(el) {
    if (!el || !el.getAttribute) return false;
    const role = el.getAttribute('role');
    return role === 'dialog' || role === 'listbox' || role === 'menu';
  }

  function attachToElement(el) {
    if (!el || attachedElements.has(el)) return;
    if (typeof el.addEventListener !== 'function') return;
    attachedElements.add(el);

    ['keydown', 'keypress', 'keyup'].forEach(eventType => {
      el.addEventListener(eventType, handleKeyEvent, true);
    });
    el.addEventListener('beforeinput', handleBeforeInput, true);
    el.addEventListener('compositionstart', compositionStartHandler, true);
    el.addEventListener('compositionend', compositionEndHandler, true);
  }

  function focusHandler(event) {
    if (isInputLike(event.target) || isDialogLike(event.target)) {
      attachToElement(event.target);
    }
  }
  document.addEventListener('focusin', focusHandler, true);

  function scanAndAttach(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    if (isInputLike(root) || isDialogLike(root)) attachToElement(root);
    const candidates = root.querySelectorAll(
      'input, textarea, [contenteditable="true"], [contenteditable=""], ' +
      '[role="textbox"], [role="combobox"], [role="dialog"], [role="listbox"], [role="menu"]'
    );
    candidates.forEach(attachToElement);
  }

  function observeDOM() {
    if (!document.body) {
      setTimeout(observeDOM, 50);
      return;
    }
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) scanAndAttach(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scanAndAttach(document.body);
  }

  // ---------- Send button override ----------
  function overrideSendButton() {
    setInterval(() => {
      const sendButtons = document.querySelectorAll(
        'button[type="submit"], button[aria-label*="send"], button[aria-label*="Send"], button.send-button, form button'
      );
      sendButtons.forEach(button => {
        if (button.getAttribute('ime-fix-applied')) return;
        const originalClick = button.onclick;
        button.onclick = function(event) {
          if (isIMEActiveForEnter()) {
            event.stopImmediatePropagation();
            event.preventDefault();
            return false;
          }
          if (originalClick) return originalClick.call(this, event);
          return true;
        };
        button.setAttribute('ime-fix-applied', 'true');
      });
    }, 1000);
  }

  // ---------- Boot ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observeDOM();
      overrideSendButton();
    });
  } else {
    observeDOM();
    overrideSendButton();
  }
})();