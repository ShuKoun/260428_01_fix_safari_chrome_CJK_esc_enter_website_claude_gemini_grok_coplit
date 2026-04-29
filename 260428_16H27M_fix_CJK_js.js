// ==UserScript==
// @name         Universal IME Fix for Safari & Chrome (Claude/Gemini/Copilot/Grok)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Fix IME Enter/Esc key conflicts on AI chat sites. v2.1 fixes Gemini rename dialog by tracking Enter-during-composition and blocking the corresponding keyup.
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

// Created: 2026-04-28, updated: 2026-04-29 (v2.1)

(function() {
  'use strict';

  // ---------- State ----------
  let isComposing = false;
  let lastCompositionEndTime = 0;
  const ENTER_THRESHOLD_MS = 20;
  const ESC_THRESHOLD_MS = 20;

  // CRITICAL FIX (v2.1): track whether the most recent Enter keydown
  // happened during IME composition. If yes, block the matching keyup
  // even if isComposing is already false by then.
  let pendingImeEnterKeyup = false;
  let pendingImeEscKeyup = false;

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

  // ---------- Universal blocker ----------
  function handleKeyEvent(event) {
    // ----- KEYDOWN -----
    if (event.type === 'keydown') {
      if (event.key === 'Enter' && !event.shiftKey) {
        // keyCode 229 means "IME is processing this key" — definitive signal
        const isImeEnter = isIMEActiveForEnter() || event.keyCode === 229;
        if (isImeEnter) {
          pendingImeEnterKeyup = true;
          event.stopImmediatePropagation();
          event.preventDefault();
          return;
        }
      }
      if (event.key === 'Escape') {
        const isImeEsc = isIMEActiveForEsc() || event.keyCode === 229;
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
      if (event.key === 'Enter' && pendingImeEnterKeyup) {
        pendingImeEnterKeyup = false;
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      if (event.key === 'Escape' && pendingImeEscKeyup) {
        pendingImeEscKeyup = false;
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
    }

    // ----- KEYPRESS -----
    if (event.type === 'keypress') {
      if (event.key === 'Enter' && (isIMEActiveForEnter() || event.keyCode === 229)) {
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
    // Clear stale pending flags after a short delay (safety net)
    setTimeout(() => {
      pendingImeEnterKeyup = false;
      pendingImeEscKeyup = false;
    }, 100);
  }

  // ---------- Attach listeners on multiple targets and phases ----------
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

  // ---------- Element-level attachment for dynamic inputs (Gemini rename) ----------
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