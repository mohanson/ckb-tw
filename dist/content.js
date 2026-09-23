const PROVIDER_SOURCE = "ckb-wallet-provider";

function injectProvider() {
  const target = document.head || document.documentElement;
  if (!target) return false;

  const providerScript = document.createElement("script");
  providerScript.src = chrome.runtime.getURL("provider-page.js");
  providerScript.dataset.source = PROVIDER_SOURCE;
  providerScript.onload = () => providerScript.remove();
  providerScript.onerror = () => providerScript.remove();
  target.appendChild(providerScript);
  return true;
}

if (!injectProvider()) {
  const observer = new MutationObserver(() => {
    if (injectProvider()) observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== PROVIDER_SOURCE || event.data.direction !== "page-to-extension") return;
  const { requestId, method, params } = event.data;
  if (!requestId || typeof method !== "string") return;
  const messageType = method === "ckb_requestAccounts" ? "provider-account-request" : "provider-request";
  chrome.runtime.sendMessage({ type: messageType, requestId, method, params }).then((response) => {
    window.postMessage({ source: PROVIDER_SOURCE, direction: "extension-to-page", requestId, ...response }, "*");
  }).catch((error) => {
    window.postMessage({ source: PROVIDER_SOURCE, direction: "extension-to-page", requestId, error: { code: -32603, message: error.message } }, "*");
  });
});
