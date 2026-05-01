// ==UserScript==
// @name         Universal IME Fix for Safari/Chrome/Firefox (Claude/Gemini/Copilot/Grok)
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Fix IME Enter/Esc key conflicts on AI chat sites. v2.2 adds Firefox support (event.key is "Process" during IME).
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
// @grant        none
// @run-at       document-start
// ==/UserScript==

// Created: 2026-04-28, updated: 2026-04-29 (v2.2 - Firefox compatibility)

(function() {
  'use strict';

  // ---------- State ----------
  let isComposing = false;
  let lastCompositionEndTime = 0;
  const ENTER_THRESHOLD_MS = 20;
  const ESC_THRESHOLD_MS = 20;

  let pendingImeEnterKeyup = false;
  let pendingImeEscKeyup = false;

  // ---------- Cross-browser key detection ----------
  // Firefox: event.key === "Process" during IME, but event.code === "Enter"
  // Chrome:  event.key === "Enter" during IME, event.code === "Enter"
  // Safari:  similar to Chrome
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

  // ---------- Universal handler ----------
  function handleKeyEvent(event) {
    // ----- KEYDOWN -----
    if (event.type === 'keydown') {
      if (isEnterKey(event) && !event.shiftKey) {
        // keyCode 229 = "IME is processing"; isComposing true = same;
        // also: Firefox uses event.key === "Process" — check that too
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

    // ----- KEYUP (the critical Gemini-rename fix) -----
    if (event.type === 'keyup') {
      if (isEnterKey(event) && pendingImeEnterKeyup) {
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

  // ---------- Composition tracking ----------
  function compositionStartHandler() {
    isComposing = true;
  }

  function compositionEndHandler() {
    isComposing = false;
    lastCompositionEndTime = Date.now();
    setTimeout(() => {
      pendingImeEnterKeyup = false;
      pendingImeEscKeyup = false;
    }, 100);
  }

  // ---------- Top-level listeners ----------
  function attachListeners(target) {
    ['keydown', 'keypress', 'keyup'].forEach(eventType => {
      target.addEventListener(eventType, handleKeyEvent, true);
    });
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
    return false;
  }

  function attachToElement(el) {
    if (!el || attachedElements.has(el)) return;
    if (typeof el.addEventListener !== 'function') return;
    attachedElements.add(el);

    ['keydown', 'keypress', 'keyup'].forEach(eventType => {
      el.addEventListener(eventType, handleKeyEvent, true);
    });
    el.addEventListener('compositionstart', compositionStartHandler, true);
    el.addEventListener('compositionend', compositionEndHandler, true);
  }

  function focusHandler(event) {
    if (isInputLike(event.target)) {
      attachToElement(event.target);
    }
  }
  document.addEventListener('focusin', focusHandler, true);

  function scanAndAttach(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    if (isInputLike(root)) attachToElement(root);
    const candidates = root.querySelectorAll(
      'input, textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]'
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

  // ---------- Send button override (Claude legacy) ----------
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