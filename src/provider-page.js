(function installCkbProvider() {
  const source = "ckb-wallet-provider";
  const requests = new Map();

  function createRequestId() {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
    if (typeof globalThis.crypto?.getRandomValues === "function") {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function request({ method, params = [] }) {
    const requestId = createRequestId();
    return new Promise((resolve, reject) => {
      requests.set(requestId, { resolve, reject });
      window.postMessage({ source, direction: "page-to-extension", requestId, method, params }, "*");
    });
  }

  const provider = { isCkbWallet: true, request, on() {}, removeListener() {} };
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== source || event.data.direction !== "extension-to-page") return;
    const pending = requests.get(event.data.requestId);
    if (!pending) return;
    requests.delete(event.data.requestId);
    if (event.data.error) pending.reject(Object.assign(new Error(event.data.error.message), { code: event.data.error.code }));
    else pending.resolve(event.data.result);
  });
  Object.defineProperty(window, "ckb", { value: provider, configurable: false, enumerable: false, writable: false });
})();
