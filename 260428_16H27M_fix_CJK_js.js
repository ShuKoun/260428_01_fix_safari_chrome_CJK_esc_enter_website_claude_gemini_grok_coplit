// ==UserScript==
// @name         Universal IME Fix for Safari (Claude/Gemini/Copilot/Grok)
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  Fix IME Enter/Esc key conflict on AI chat sites in Safari
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

// Created: 2026-04-28

(function() {
  'use strict';

  let isComposing = false;
  let lastCompositionEndTime = 0;
  const ENTER_THRESHOLD_MS = 20;
  const ESC_THRESHOLD_MS = 20;

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

  function shouldBlock(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      return isIMEActiveForEnter();
    }
    if (event.key === 'Escape') {
      return isIMEActiveForEsc();
    }
    return false;
  }

  function blockEvent(event) {
    if (shouldBlock(event)) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return true;
    }
    return false;
  }

  function attachListeners(target) {
    ['keydown', 'keypress', 'keyup'].forEach(eventType => {
      target.addEventListener(eventType, blockEvent, true);
    });
  }

  attachListeners(window);
  attachListeners(document);

  function attachCompositionListeners(target) {
    target.addEventListener('compositionstart', function() {
      isComposing = true;
    }, true);
    target.addEventListener('compositionend', function() {
      isComposing = false;
      lastCompositionEndTime = Date.now();
    }, true);
  }

  attachCompositionListeners(window);
  attachCompositionListeners(document);

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', overrideSendButton);
  } else {
    overrideSendButton();
  }
})();