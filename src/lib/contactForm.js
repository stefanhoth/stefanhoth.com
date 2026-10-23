// Pure helpers + DOM wiring for the contact form's client-side status handling.
// Extracted from ContactForm.astro so the logic can be unit/jsdom tested directly.

export const STATUS_MESSAGES = {
  sent: {
    type: "success",
    text: "Thanks for your message! I'll get back to you as soon as possible.",
  },
  error: {
    type: "error",
    text: "Something went wrong while sending. Please try again, or email me directly instead.",
  },
};

export function getStatusKeyFromSearch(search) {
  const params = new URLSearchParams(search);
  if (params.has("sent")) return "sent";
  if (params.has("error")) return "error";
  return null;
}

export function buildUrlWithoutStatusParams(pathname, search, hash) {
  const params = new URLSearchParams(search);
  params.delete("sent");
  params.delete("error");
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function initContactForm({
  form,
  statusEl,
  win = window,
  turnstileLoadTimeoutMs = 8000,
}) {
  const submitButton = form?.querySelector('button[type="submit"]');
  const turnstileWidget = form?.querySelector(".cf-turnstile");
  let turnstileIssueActive = false;

  function showStatus(type, text) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.hidden = false;
    statusEl.className = `contact-status contact-status--${type}`;
  }

  function showStatusFromLocation() {
    const key = getStatusKeyFromSearch(win.location.search);
    if (!key) return;

    showStatus(STATUS_MESSAGES[key].type, STATUS_MESSAGES[key].text);
    statusEl?.scrollIntoView?.({ behavior: "smooth", block: "center" });

    const cleanedUrl = buildUrlWithoutStatusParams(
      win.location.pathname,
      win.location.search,
      win.location.hash,
    );
    win.history.replaceState({}, "", cleanedUrl);
  }

  function disableSubmit(reasonText) {
    turnstileIssueActive = true;
    showStatus("error", reasonText);
    submitButton?.setAttribute("disabled", "true");
  }

  function handleTurnstileSuccess() {
    submitButton?.removeAttribute("disabled");
    if (turnstileIssueActive) {
      turnstileIssueActive = false;
      if (statusEl) statusEl.hidden = true;
    }
  }

  function handleTurnstileError() {
    disableSubmit(
      "Bot protection failed to load. Please reload the page, or email me directly instead.",
    );
  }

  function handleTurnstileExpired() {
    disableSubmit("Bot verification expired. Please reload the page.");
  }

  if (form) {
    if (!turnstileWidget?.getAttribute("data-sitekey")) {
      disableSubmit(
        "This contact form isn't fully set up right now (bot protection is missing). Please email me directly instead.",
      );
    } else {
      win.onTurnstileSuccess = handleTurnstileSuccess;
      win.onTurnstileError = handleTurnstileError;
      win.onTurnstileExpired = handleTurnstileExpired;

      win.setTimeout(() => {
        if (!win.turnstile) {
          handleTurnstileError();
        }
      }, turnstileLoadTimeoutMs);
    }
  }

  showStatusFromLocation();

  return {
    showStatus,
    handleTurnstileSuccess,
    handleTurnstileError,
    handleTurnstileExpired,
  };
}
