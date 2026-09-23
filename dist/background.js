const pendingRequests = new Map();
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function senderOrigin(sender) {
  try {
    return new URL(sender.origin || sender.tab?.url || "").origin;
  } catch {
    return "unknown origin";
  }
}

async function getActiveAddress() {
  const stored = await chrome.storage.local.get(["vault", "accounts"]);
  return stored.vault?.address || (Array.isArray(stored.accounts) ? stored.accounts[0]?.address : null);
}

async function openSigningRequest(request, sendResponse) {
  const requestId = crypto.randomUUID();
  const timeout = setTimeout(() => {
    const pending = pendingRequests.get(requestId);
    if (!pending) return;
    pendingRequests.delete(requestId);
    pending.sendResponse({ error: { code: 4001, message: "Signing request timed out." } });
  }, REQUEST_TIMEOUT_MS);
  pendingRequests.set(requestId, { request, sendResponse, timeout });
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL(`popup.html?providerRequest=${encodeURIComponent(requestId)}`),
      type: "popup",
      width: 420,
      height: 700,
      focused: true,
    });
  } catch (error) {
    clearTimeout(timeout);
    pendingRequests.delete(requestId);
    sendResponse({ error: { code: -32603, message: errorMessage(error) } });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "provider-request") {
    (async () => {
      try {
        if (message.method !== "ckb_signTransaction") {
          sendResponse({ error: { code: -32601, message: "Unsupported provider method." } });
          return;
        }
        await openSigningRequest({
          method: message.method,
          params: message.params,
          origin: senderOrigin(sender),
        }, sendResponse);
      } catch (error) {
        sendResponse({ error: { code: -32603, message: errorMessage(error) } });
      }
    })();
    return true;
  }

  if (message?.type === "provider-account-request") {
    getActiveAddress().then((address) => {
      sendResponse(address ? { result: [address] } : { error: { code: 4100, message: "Wallet is not initialized." } });
    }).catch((error) => sendResponse({ error: { code: -32603, message: errorMessage(error) } }));
    return true;
  }

  if (message?.type === "provider-get-request") {
    const pending = pendingRequests.get(message.requestId);
    sendResponse(pending ? { result: pending.request } : { error: { code: 4001, message: "Signing request is no longer available." } });
    return false;
  }

  if (message?.type === "provider-confirmation") {
    const pending = pendingRequests.get(message.requestId);
    if (!pending) {
      sendResponse({ error: { code: 4001, message: "Signing request is no longer available." } });
      return false;
    }
    clearTimeout(pending.timeout);
    pendingRequests.delete(message.requestId);
    pending.sendResponse(message.approved ? { result: message.result } : { error: { code: 4001, message: "User rejected the signing request." } });
    sendResponse({ result: true });
    return false;
  }

  return false;
});
