import { BI } from "@ckb-lumos/bi";
import { blockchain, utils, values } from "@ckb-lumos/base";
import { Indexer } from "@ckb-lumos/ckb-indexer";
import { bytes } from "@ckb-lumos/codec";
import { Uint64 } from "@ckb-lumos/codec/lib/number";
import * as commons from "@ckb-lumos/common-scripts";
import * as config from "@ckb-lumos/config-manager";
import { privateKeyToBlake160, signRecoverable } from "@ckb-lumos/hd/lib/key";
import * as helpers from "@ckb-lumos/helpers";
import { RPC } from "@ckb-lumos/rpc";
import { Buffer } from "buffer";
import initShrincs, {
  initThreadPool,
  keypairFromSeed,
  ParamsType,
  initialState,
  keygen,
  publicKeyFromKeypair,
  secretKeyFromKeypair,
  signStateful,
  signStateless,
  signatureFromStatefulSignResult,
  stateCounter,
  stateFromStatefulSignResult,
  statelessSignatureLen,
  verify,
} from "./shrincs-wasm/pkg/shrincs.js";

const RPC_URL = "https://testnet.ckb.dev/rpc";
const INDEXER_URL = "https://testnet.ckb.dev/indexer";
const SHANNONS_PER_CKB = 100000000n;
const MIN_TRANSFER_CKB = 61n;
const FEE_RATE = 1000n;
const DEFAULT_ACCOUNT_TYPE = "secp256k1";
const ZERO_HASH = `0x${"00".repeat(32)}`;
const SHRINCS_MAX_STATEFUL_SIGNATURES = 142;
const SHRINCS_WOTS_SIGNATURE_SIZE = 292;
const SHRINCS_STATELESS_SIGNATURE_SIZE = 2568;
const SHRINCS_SCRIPT = {
  codeHash: ZERO_HASH,
  hashType: "type",
  cellDep: {
    outPoint: { txHash: ZERO_HASH, index: "0x0" },
    depType: "code",
  },
};
const ACCOUNT_TYPES = {
  secp256k1: {
    createAccount(privateKey) {
      return { address: helpers.encodeToConfigAddress(privateKeyToBlake160(privateKey), "SECP256K1_BLAKE160") };
    },
    sign(message, privateKey) {
      return signRecoverable(message, privateKey);
    },
    canBroadcast: true,
  },
  shrincs: {
    createAccount(seed, publicKey) {
      if (!/^0x[0-9a-f]{64}$/.test(publicKey || "")) throw new Error("SHRINCS 公钥必须是 32 字节十六进制字符。");
      const lock = { codeHash: SHRINCS_SCRIPT.codeHash, hashType: SHRINCS_SCRIPT.hashType, args: publicKey };
      return { address: helpers.encodeToAddress(lock), publicKey, lock };
    },
    canBroadcast: true,
  },
};

globalThis.Buffer ??= Buffer;
config.initializeConfig(config.predefined.AGGRON4);

const elements = {
  setupView: document.querySelector("#setup-view"), unlockView: document.querySelector("#unlock-view"), walletView: document.querySelector("#wallet-view"),
  importFields: document.querySelector("#import-fields"), privateKey: document.querySelector("#private-key"), privateKeyLabel: document.querySelector("#private-key-label"), setupAccountType: document.querySelector("#setup-account-type"), newPassword: document.querySelector("#new-password"), importActions: document.querySelector("#import-actions"), setupStatus: document.querySelector("#setup-status"), generationProgress: document.querySelector("#generation-progress"),
  unlockPassword: document.querySelector("#unlock-password"), unlockStatus: document.querySelector("#unlock-status"), walletStatus: document.querySelector("#wallet-status"),
  address: document.querySelector("#address"), accountType: document.querySelector("#account-type"), accountTypeWarning: document.querySelector("#account-type-warning"), balance: document.querySelector("#balance"), recipient: document.querySelector("#recipient"), amount: document.querySelector("#amount"), signModeField: document.querySelector("#sign-mode-field"), signMode: document.querySelector("#sign-mode"), signingProgress: document.querySelector("#signing-progress"),
  generateButton: document.querySelector("#generate-button"), showImportButton: document.querySelector("#show-import-button"), saveWalletButton: document.querySelector("#save-wallet-button"), unlockButton: document.querySelector("#unlock-button"), resetButton: document.querySelector("#reset-button"),
  copyAddressButton: document.querySelector("#copy-address-button"), exportWalletButton: document.querySelector("#export-wallet-button"), refreshButton: document.querySelector("#refresh-button"), transferForm: document.querySelector("#transfer-form"), sendButton: document.querySelector("#send-button"), lockButton: document.querySelector("#lock-button"),
};

let account = null;
let privateKeyInMemory = null;
const shrincsInitialization = initShrincs().then(() => initThreadPool(Math.min(navigator.hardwareConcurrency || 1, 8)));
const indexer = new Indexer(INDEXER_URL, RPC_URL);
const rpc = new RPC(RPC_URL, {
  fetch: (...argumentsList) => globalThis.fetch(...argumentsList),
});

function setStatus(target, message = "", kind = "") {
  target.textContent = message;
  target.className = `status ${kind}`;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function showView(view) {
  elements.setupView.hidden = view !== "setup";
  elements.unlockView.hidden = view !== "unlock";
  elements.walletView.hidden = view !== "wallet";
}

function normalizePrivateKey(value, accountType = DEFAULT_ACCOUNT_TYPE) {
  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  const expectedLength = accountType === "shrincs" ? 96 : 64;
  if (!new RegExp(`^[0-9a-f]{${expectedLength}}$`).test(normalized)) throw new Error(`${accountType === "shrincs" ? "SHRINCS 主种子" : "私钥"}必须是 ${expectedLength} 位十六进制字符。`);
  return `0x${normalized}`;
}

// SHRINCS 的 48 字节主种子 = sk_seed ‖ sk_prf ‖ pk_seed，可从 96 字节 secret key 还原。
function shrincsSeedFromSecretKey(secretKeyHex) {
  const secretKey = bytes.bytify(secretKeyHex);
  return bytes.hexify(Uint8Array.from([
    ...secretKey.slice(0, 32),
    ...secretKey.slice(64, 80),
  ]));
}

function getAccountType(accountType) {
  const implementation = ACCOUNT_TYPES[accountType];
  if (!implementation) throw new Error("不支持的账户类型。");
  return implementation;
}

function createAccount(privateKey, accountType = DEFAULT_ACCOUNT_TYPE, publicKey) {
  return getAccountType(accountType).createAccount(privateKey, publicKey);
}

function shrincsStatefulSignatureSize(q) {
  return 16 + SHRINCS_WOTS_SIGNATURE_SIZE + Math.min(q, SHRINCS_MAX_STATEFUL_SIGNATURES - 1) * 16;
}

// 当前转账采用的 SHRINCS 签名方式；导入账户无开关、强制为 stateless。
function currentShrincsSignMode() {
  if (account?.imported) return "stateless";
  if (elements.signMode) return elements.signMode.value;
  return account?.shrincsState?.mode === "stateful" ? "stateful" : "stateless";
}

function shrincsSignaturePlaceholderSize() {
  const mode = currentShrincsSignMode();
  return mode === "stateful" ? shrincsStatefulSignatureSize((account?.shrincsState?.q ?? 0) + 1) : SHRINCS_STATELESS_SIGNATURE_SIZE;
}

function incrementShrincsState(state) {
  const next = new Uint8Array(state);
  const view = new DataView(next.buffer);
  view.setUint32(0, view.getUint32(0, true) + 1, true);
  return next;
}

function isShrincsLock(lock) {
  return lock.codeHash === SHRINCS_SCRIPT.codeHash && lock.hashType === SHRINCS_SCRIPT.hashType;
}

function addShrincsCellDep(txSkeleton) {
  const exists = txSkeleton.get("cellDeps").some((cellDep) => cellDep.depType === SHRINCS_SCRIPT.cellDep.depType
    && new values.OutPointValue(cellDep.outPoint, { validate: false }).equals(new values.OutPointValue(SHRINCS_SCRIPT.cellDep.outPoint, { validate: false })));
  return exists ? txSkeleton : txSkeleton.update("cellDeps", (cellDeps) => cellDeps.push(SHRINCS_SCRIPT.cellDep));
}

function hashShrincsWitness(hasher, witness) {
  hasher.update(bytes.hexify(Uint64.pack(bytes.bytify(witness).length)));
  hasher.update(witness);
}

class ShrincsCellCollector {
  constructor(fromInfo, cellProvider) {
    if (!cellProvider) throw new Error("Cell provider is missing!");
    this.fromScript = helpers.parseAddress(fromInfo);
    this.cellCollector = cellProvider.collector({ lock: this.fromScript, type: "empty" });
  }

  async *collect() {
    if (!isShrincsLock(this.fromScript)) return;
    yield* this.cellCollector.collect();
  }
}

async function setupShrincsInputCell(txSkeleton, inputCell, _fromInfo, { defaultWitness = "0x", since } = {}) {
  const fromScript = inputCell.cellOutput.lock;
  if (!isShrincsLock(fromScript)) throw new Error("Not a SHRINCS input!");
  txSkeleton = txSkeleton.update("inputs", (inputs) => inputs.push(inputCell));
  txSkeleton = txSkeleton.update("outputs", (outputs) => outputs.push({ cellOutput: inputCell.cellOutput, data: inputCell.data }));
  if (since) txSkeleton = txSkeleton.update("inputSinces", (inputSinces) => inputSinces.set(txSkeleton.get("inputs").size - 1, since));
  txSkeleton = txSkeleton.update("witnesses", (witnesses) => witnesses.push(defaultWitness));
  txSkeleton = addShrincsCellDep(txSkeleton);
  const firstIndex = txSkeleton.get("inputs").findIndex((input) => new values.ScriptValue(input.cellOutput.lock, { validate: false }).equals(new values.ScriptValue(fromScript, { validate: false })));
  const lock = `0x${"00".repeat(shrincsSignaturePlaceholderSize())}`;
  const witness = txSkeleton.get("witnesses").get(firstIndex);
  const witnessArgs = witness === "0x" ? {} : blockchain.WitnessArgs.unpack(bytes.bytify(witness));
  txSkeleton = txSkeleton.update("witnesses", (witnesses) => witnesses.set(firstIndex, bytes.hexify(blockchain.WitnessArgs.pack({ lock, inputType: witnessArgs.inputType, outputType: witnessArgs.outputType }))));
  return txSkeleton;
}

function prepareShrincsSigningEntries(txSkeleton) {
  const tx = helpers.createTransactionFromSkeleton(txSkeleton);
  const txHash = utils.ckbHash(blockchain.RawTransaction.pack(tx));
  const inputs = txSkeleton.get("inputs");
  const witnesses = txSkeleton.get("witnesses");
  let signingEntries = txSkeleton.get("signingEntries");
  let processedArgs = new Set();
  for (let index = 0; index < inputs.size; index += 1) {
    const input = inputs.get(index);
    const lock = input.cellOutput.lock;
    if (!isShrincsLock(lock) || processedArgs.has(lock.args)) continue;
    processedArgs.add(lock.args);
    const lockValue = new values.ScriptValue(lock, { validate: false });
    const hasher = new utils.CKBHasher();
    hasher.update(txHash);
    hashShrincsWitness(hasher, witnesses.get(index));
    for (let witnessIndex = index + 1; witnessIndex < inputs.size && witnessIndex < witnesses.size; witnessIndex += 1) {
      const otherLock = inputs.get(witnessIndex).cellOutput.lock;
      if (lockValue.equals(new values.ScriptValue(otherLock, { validate: false }))) hashShrincsWitness(hasher, witnesses.get(witnessIndex));
    }
    for (let witnessIndex = inputs.size; witnessIndex < witnesses.size; witnessIndex += 1) hashShrincsWitness(hasher, witnesses.get(witnessIndex));
    signingEntries = signingEntries.push({ type: "witness_args_lock", index, message: hasher.digestHex() });
  }
  return txSkeleton.set("signingEntries", signingEntries);
}

commons.common.registerCustomLockScriptInfos([{
  codeHash: SHRINCS_SCRIPT.codeHash,
  hashType: SHRINCS_SCRIPT.hashType,
  lockScriptInfo: {
    CellCollector: ShrincsCellCollector,
    setupInputCell: setupShrincsInputCell,
    prepareSigningEntries: prepareShrincsSigningEntries,
  },
}]);

function generatePrivateKey() {
  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const key = `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    try { createAccount(key); return key; } catch { /* Reject the invalid secp256k1 scalar edge case. */ }
  }
}

function encodeBase64(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value)));
}

function decodeBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveEncryptionKey(password, salt, usages) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, usages);
}

async function encryptPrivateKey(privateKey, password, accountType, publicKey, shrincsState, imported = false, shrincsSecretKey) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(password, salt, ["encrypt"]);
  const payload = JSON.stringify({ privateKey, shrincsSecretKey });
  const cipherText = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(payload));
  const account = createAccount(privateKey, accountType, publicKey);
  return { version: 5, salt: encodeBase64(salt), iv: encodeBase64(iv), cipherText: encodeBase64(cipherText), accountType, publicKey: account.publicKey, address: account.address, shrincsState, imported };
}

async function decryptPrivateKey(vault, password) {
  try {
    const key = await deriveEncryptionKey(password, decodeBase64(vault.salt), ["decrypt"]);
    const plainText = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(vault.iv) }, key, decodeBase64(vault.cipherText));
    const payload = JSON.parse(new TextDecoder().decode(plainText));
    const accountType = vault.accountType || DEFAULT_ACCOUNT_TYPE;
    const privateKey = normalizePrivateKey(payload.privateKey, accountType);
    if (accountType === "shrincs" && !/^0x[0-9a-f]{192}$/.test(payload.shrincsSecretKey || "")) throw new Error("无效的 SHRINCS 签名密钥。");
    return { privateKey, shrincsSecretKey: payload.shrincsSecretKey };
  } catch { throw new Error("密码不正确或钱包数据已损坏。"); }
}

async function signShrincsMessage(message) {
  await shrincsInitialization;
  const messageBytes = bytes.bytify(message);
  const secretKey = bytes.bytify(privateKeyInMemory);
  const { vault } = await chrome.storage.local.get("vault");
  if (!vault || vault.accountType !== "shrincs") throw new Error("SHRINCS 钱包数据不可用。");
  const mode = currentShrincsSignMode();
  if (account.imported && mode !== "stateless") throw new Error("导入的 SHRINCS 账户仅支持 stateless 签名。");
  let signature;
  if (mode === "stateful") {
    const state = vault.shrincsState;
    if (!state || state.mode !== "stateful" || !state.data) throw new Error("此账户没有可用的状态化签名状态。");
    const stateBytes = bytes.bytify(state.data);
    const q = stateCounter(stateBytes);
    if (q >= SHRINCS_MAX_STATEFUL_SIGNATURES) throw new Error("SHRINCS 状态化签名叶子已耗尽，请切换为无状态签名。");
    const reservedState = { mode: "stateful", q: q + 1, data: bytes.hexify(incrementShrincsState(stateBytes)) };
    await chrome.storage.local.set({ vault: { ...vault, version: 4, shrincsState: reservedState } });
    account.shrincsState = reservedState;
    const result = signStateful(ParamsType.B, messageBytes, secretKey, stateBytes);
    const nextState = stateFromStatefulSignResult(result);
    if (stateCounter(nextState) !== reservedState.q) throw new Error("SHRINCS 状态计数器不一致。");
    signature = signatureFromStatefulSignResult(result);
  } else {
    setStatus(elements.walletStatus, "正在生成 SHRINCS 无状态签名，可能需要较长时间。", "");
    elements.signingProgress.hidden = false;
    await nextPaint();
    signature = signStateless(ParamsType.B, messageBytes, secretKey);
  }
  const publicKey = bytes.bytify(account.publicKey);
  if (!verify(ParamsType.B, messageBytes, signature, publicKey)) throw new Error("SHRINCS 本地验签失败。");
  return bytes.hexify(signature);
}

function parseCkbAmount(value) {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,8}))?$/);
  if (!match) throw new Error("请输入最多 8 位小数的有效 CKB 金额。");
  const fraction = (match[2] || "").padEnd(8, "0");
  const amount = BigInt(match[1]) * SHANNONS_PER_CKB + BigInt(fraction);
  if (amount < MIN_TRANSFER_CKB * SHANNONS_PER_CKB) throw new Error("CKB 单个转账输出至少需要 61 CKB。");
  return amount;
}

function formatCkb(capacity) {
  const whole = capacity / SHANNONS_PER_CKB;
  const decimals = (capacity % SHANNONS_PER_CKB).toString().padStart(8, "0").replace(/0+$/, "");
  return decimals ? `${whole}.${decimals}` : whole.toString();
}

function showTransactionLink(transactionHash) {
  const hash = document.createElement("code");
  hash.className = "transaction-hash";
  hash.textContent = transactionHash;
  const lineBreak = document.createElement("br");
  const link = document.createElement("a");
  link.className = "tx-link";
  link.href = `https://pudge.explorer.nervos.org/transaction/${transactionHash}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "在区块浏览器中查看";
  elements.walletStatus.replaceChildren("交易已广播。交易哈希：", hash, lineBreak, link);
  elements.walletStatus.className = "status success";
}

async function refreshBalance() {
  elements.refreshButton.disabled = true;
  setStatus(elements.walletStatus, "正在查询测试网余额...");
  try {
    let capacity = 0n;
    const lock = helpers.parseAddress(account.address);
    for await (const cell of indexer.collector({ lock }).collect()) capacity += BigInt(cell.cellOutput.capacity);
    elements.balance.innerHTML = `${formatCkb(capacity)} <small>CKB</small>`;
    setStatus(elements.walletStatus, "余额已更新。", "success");
  } catch (error) {
    setStatus(elements.walletStatus, `无法查询余额：${error.message}`, "error");
  } finally { elements.refreshButton.disabled = false; }
}

// 进入钱包视图（生成/导入后直接进入，或解锁后进入）。privateKey 为内存中用于签名的密钥。
async function enterWallet({ accountType, privateKey, publicKey, shrincsState, imported, expectedAddress }) {
  const restoredAccount = createAccount(privateKey, accountType, publicKey);
  if (expectedAddress && restoredAccount.address !== expectedAddress) throw new Error("钱包地址校验失败。");
  privateKeyInMemory = privateKey;
  account = { ...restoredAccount, accountType, shrincsState: accountType === "shrincs" ? shrincsState : undefined, imported };
  elements.address.textContent = account.address;
  elements.accountType.textContent = accountType;
  if (accountType === "shrincs") {
    // 下拉框始终显示；导入账户只保留 stateless 选项，随机生成账户两者都显示。
    elements.signModeField.hidden = false;
    const statefulOption = elements.signMode.querySelector('option[value="stateful"]');
    if (imported) {
      elements.signMode.value = "stateless";
      statefulOption.hidden = true;
    } else {
      elements.signMode.value = shrincsState?.mode === "stateful" ? "stateful" : "stateless";
      statefulOption.hidden = false;
    }
  } else {
    elements.signModeField.hidden = true;
  }
  elements.accountTypeWarning.hidden = accountType !== "shrincs";
  elements.accountTypeWarning.textContent = accountType === "shrincs"
    ? `实验账户：使用全零 code hash 和 cell dep 占位。${imported ? "导入账户，仅支持 stateless 签名" : `随机生成账户，stateful q=${shrincsState.q}（可切换 stateless）`}；测试网会拒绝未部署脚本的交易。`
    : "";
  showView("wallet");
  await refreshBalance();
}

async function saveWallet() {
  setStatus(elements.setupStatus);
  try {
    const accountType = elements.setupAccountType.value;
    const password = elements.newPassword.value;
    if (password.length < 8) throw new Error("保护密码至少需要 8 位。");
    let privateKey = elements.privateKey.value;
    let publicKey;
    let secretKey;
    let shrincsState;
    if (accountType === "shrincs") {
      const seed = normalizePrivateKey(privateKey, accountType);
      await shrincsInitialization;
      const keypair = keypairFromSeed(ParamsType.B, bytes.bytify(seed));
      publicKey = bytes.hexify(publicKeyFromKeypair(keypair));
      secretKey = bytes.hexify(secretKeyFromKeypair(keypair));
      shrincsState = { mode: "stateless" }; // 导入账户只支持 stateless 签名
      privateKey = seed;
    } else {
      privateKey = normalizePrivateKey(privateKey, accountType);
    }
    const vault = await encryptPrivateKey(privateKey, password, accountType, publicKey, shrincsState, true, secretKey);
    await chrome.storage.local.set({ vault });
    elements.privateKey.value = "";
    elements.newPassword.value = "";
    setStatus(elements.setupStatus, "账户已导入，直接进入钱包。", "success");
    await enterWallet({ accountType, privateKey: accountType === "shrincs" ? secretKey : privateKey, publicKey, shrincsState, imported: true });
  } catch (error) { setStatus(elements.setupStatus, error.message, "error"); }
}

async function generateWallet() {
  setStatus(elements.setupStatus);
  elements.generateButton.disabled = true;
  try {
    const accountType = elements.setupAccountType.value;
    const password = elements.newPassword.value;
    if (password.length < 8) throw new Error("保护密码至少需要 8 位。");
    let privateKey;
    let publicKey;
    let secretKey;
    let shrincsState;
    if (accountType === "shrincs") {
      setStatus(elements.setupStatus, "正在生成 SHRINCS-B 密钥材料...");
      elements.generationProgress.hidden = false;
      await nextPaint();
      await shrincsInitialization;
      const keypair = keygen(ParamsType.B);
      secretKey = bytes.hexify(secretKeyFromKeypair(keypair));
      publicKey = bytes.hexify(publicKeyFromKeypair(keypair));
      const state = initialState();
      shrincsState = { mode: "stateful", q: stateCounter(state), data: bytes.hexify(state) };
      privateKey = shrincsSeedFromSecretKey(secretKey); // vault 加密保存主种子和派生的签名密钥
    } else {
      privateKey = generatePrivateKey();
    }
    const vault = await encryptPrivateKey(privateKey, password, accountType, publicKey, shrincsState, false, secretKey);
    await chrome.storage.local.set({ vault });
    elements.newPassword.value = "";
    setStatus(elements.setupStatus, "账户已生成，直接进入钱包。", "success");
    await enterWallet({ accountType, privateKey: accountType === "shrincs" ? secretKey : privateKey, publicKey, shrincsState, imported: false });
  } catch (error) {
    setStatus(elements.setupStatus, error.message, "error");
  } finally {
    elements.generationProgress.hidden = true;
    elements.generateButton.disabled = false;
  }
}

async function unlockWallet() {
  setStatus(elements.unlockStatus);
  elements.unlockButton.disabled = true;
  try {
    const { vault } = await chrome.storage.local.get("vault");
    if (!vault) throw new Error("未找到钱包数据。");
    const accountType = vault.accountType || DEFAULT_ACCOUNT_TYPE;
    setStatus(elements.unlockStatus, "正在验证密码...");
    const { privateKey: seed, shrincsSecretKey } = await decryptPrivateKey(vault, elements.unlockPassword.value);
    let privateKey = seed;
    if (accountType === "shrincs") {
      privateKey = shrincsSecretKey;
    }
    elements.unlockPassword.value = "";
    await enterWallet({ accountType, privateKey, publicKey: vault.publicKey, shrincsState: vault.shrincsState, imported: Boolean(vault.imported), expectedAddress: vault.address });
  } catch (error) { setStatus(elements.unlockStatus, error.message, "error"); }
  finally { elements.unlockButton.disabled = false; }
}

async function sendTransfer(event) {
  event.preventDefault();
  elements.sendButton.disabled = true;
  setStatus(elements.walletStatus, "正在构造并签名交易...");
  let transactionSigned = false;
  try {
    const recipient = elements.recipient.value.trim();
    if (!recipient.startsWith("ckt1")) throw new Error("请输入 CKB 测试网地址（ckt1...）。");
    helpers.parseAddress(recipient);
    const amount = parseCkbAmount(elements.amount.value);
    let transaction = helpers.TransactionSkeleton({ cellProvider: indexer });
    transaction = await commons.common.transfer(transaction, [account.address], recipient, BI.from(amount));
    transaction = await commons.common.payFeeByFeeRate(transaction, [account.address], BI.from(FEE_RATE));
    transaction = commons.common.prepareSigningEntries(transaction);
    const signatures = await Promise.all(transaction.get("signingEntries").map((entry) => account.accountType === "shrincs"
      ? signShrincsMessage(entry.message)
      : getAccountType(account.accountType).sign(entry.message, privateKeyInMemory)).toArray());
    const sealed = helpers.sealTransaction(transaction, signatures);
    transactionSigned = true;
    setStatus(elements.walletStatus, "正在广播交易...");
    const transactionHash = await rpc.sendTransaction(sealed, "passthrough");
    elements.amount.value = "";
    await refreshBalance();
    showTransactionLink(transactionHash);
  } catch (error) {
    const prefix = account?.accountType === "shrincs" && transactionSigned
      ? "SHRINCS 签名已完成，但测试网拒绝了零占位脚本交易："
      : "转账失败：";
    setStatus(elements.walletStatus, `${prefix}${error.message}`, "error");
  } finally {
    elements.signingProgress.hidden = true;
    elements.sendButton.disabled = false;
  }
}

async function copyAddress() {
  await navigator.clipboard.writeText(account.address);
  setStatus(elements.walletStatus, "地址已复制。", "success");
}

async function exportWallet() {
  if (!privateKeyInMemory || !account) throw new Error("钱包尚未解锁。");
  const password = window.prompt("请输入钱包密码以确认导出：");
  if (password === null) return;

  const { vault } = await chrome.storage.local.get("vault");
  if (!vault) throw new Error("未找到钱包数据。");
  await decryptPrivateKey(vault, password);

  const backup = account.accountType === "shrincs"
    ? {
      version: 2,
      accountType: account.accountType,
      masterSeed: bytes.hexify(Uint8Array.from([
        ...bytes.bytify(privateKeyInMemory).slice(0, 32),
        ...bytes.bytify(privateKeyInMemory).slice(64, 80),
      ])),
      publicKey: account.publicKey,
      address: account.address,
      shrincsState: account.shrincsState,
    }
    : {
      version: 1,
      accountType: account.accountType,
      privateKey: privateKeyInMemory,
      address: account.address,
    };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${account.accountType}-wallet-backup.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus(elements.walletStatus, "私钥备份已下载，请妥善保管并及时删除临时文件。", "success");
}

function updateSetupAccountType() {
  const isShrincs = elements.setupAccountType.value === "shrincs";
  elements.privateKeyLabel.textContent = isShrincs ? "SHRINCS 主种子（48 字节十六进制）" : "私钥（32 字节十六进制）";
}

elements.generateButton.addEventListener("click", generateWallet);
elements.showImportButton.addEventListener("click", () => {
  elements.importFields.hidden = false;
  elements.importActions.hidden = false;
  elements.showImportButton.hidden = true;
  updateSetupAccountType();
});
elements.setupAccountType.addEventListener("change", updateSetupAccountType);
elements.saveWalletButton.addEventListener("click", saveWallet);
elements.unlockButton.addEventListener("click", unlockWallet);
elements.refreshButton.addEventListener("click", refreshBalance);
elements.transferForm.addEventListener("submit", sendTransfer);
elements.copyAddressButton.addEventListener("click", () => copyAddress().catch(() => setStatus(elements.walletStatus, "无法复制地址。", "error")));
elements.exportWalletButton.addEventListener("click", () => exportWallet().catch((error) => setStatus(elements.walletStatus, `导出失败：${error.message}`, "error")));
elements.lockButton.addEventListener("click", () => { privateKeyInMemory = null; account = null; elements.balance.textContent = "-- CKB"; showView("unlock"); });
elements.resetButton.addEventListener("click", async () => {
  await chrome.storage.local.remove("vault");
  elements.unlockPassword.value = "";
  elements.privateKey.value = "";
  elements.importFields.hidden = true;
  elements.importActions.hidden = true;
  elements.showImportButton.hidden = false;
  showView("setup");
});

(async () => {
  const { vault } = await chrome.storage.local.get("vault");
  updateSetupAccountType();
  showView(vault ? "unlock" : "setup");
})();
