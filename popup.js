import { BI } from "@ckb-lumos/bi";
import { blockchain, utils, values } from "@ckb-lumos/base";
import { Indexer } from "@ckb-lumos/ckb-indexer";
import { bytes } from "@ckb-lumos/codec";
import * as commons from "@ckb-lumos/common-scripts";
import * as config from "@ckb-lumos/config-manager";
import { privateKeyToBlake160, signRecoverable } from "@ckb-lumos/hd/lib/key";
import * as helpers from "@ckb-lumos/helpers";
import { RPC } from "@ckb-lumos/rpc";
import { Buffer } from "buffer";
import blake2b from "blake2b";
import initShrincs, {
  initThreadPool,
  keypairFromSeed,
  ParamsType,
  initialState,
  keygen,
  publicKeyFromKeypair,
  secretKeyFromKeypair,
  signStateful,
  signatureFromStatefulSignResult,
  signStatelessPrepare,
  signStatelessWithPrepare,
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
const SHRINCS_MAX_STATEFUL_SIGNATURES = 142;
const SHRINCS_WOTS_SIGNATURE_SIZE = 292;
const SHRINCS_STATELESS_SIGNATURE_SIZE = 2568;
const SHRINCS_SCRIPT = {
  codeHash: "0x387496fafe46562bb3bb2fa4446f1fc1054ba2f1b4df229a88056d5422a196ac",
  hashType: "type",
  cellDep: {
    outPoint: { txHash: "0x3216d00b72e8229d7dbb46a93ea47bd0c650f2bdae42be2f92837328413da48e", index: "0x0" },
    depType: "code",
  },
};
const translations = {
  "zh-CN": {
    appTitle: "CKB Wallet", network: "TESTNET", generationProgress: "生成账户进度", signingProgress: "签名进度", setupTitle: "创建或导入账户", setupHint: "私钥只会以加密形式保存在此浏览器。请单独备份私钥，丢失密码无法恢复。", accountTypeLabel: "账户类型", shrincsExperimental: "shrincs（实验性）", privateKeyLabel: "私钥（32 字节十六进制）", passwordLabel: "保护密码", passwordPlaceholder: "至少 8 位", generateButton: "随机生成账户", importButton: "导入已有账户", importSaveButton: "导入并保存", unlockTitle: "解锁钱包", unlockHint: "私钥已加密保存在此浏览器。", passwordOnlyLabel: "密码", unlockPlaceholder: "输入保护密码", unlockButton: "解锁", resetButton: "清除钱包", settingsTitle: "设置", languageLabel: "语言", chinese: "中文", english: "English", backButton: "返回", myAddress: "我的地址", copyButton: "复制", exportButton: "导出私钥备份", availableBalance: "可用余额", refreshButton: "刷新", sendTitle: "发送 CKB", recipientLabel: "收款测试网地址", recipientPlaceholder: "ckt1...", amountLabel: "金额（CKB）", amountPlaceholder: "至少 61 CKB", signModeLabel: "签名方式", statefulOption: "有状态", statelessOption: "无状态", sendButton: "签名并发送", lockButton: "锁定", passwordShort: "保护密码至少需要 8 位。", accountImported: "账户已导入，直接进入钱包。", accountGenerated: "账户已生成，直接进入钱包。", generatingKey: "正在生成 SHRINCS-B 密钥材料...", verifyingPassword: "正在验证密码...", restoringKey: "正在恢复 SHRINCS 密钥材料...", missingVault: "未找到钱包数据。", wrongPassword: "密码不正确或钱包数据已损坏。", balanceQuery: "正在查询测试网余额...", balanceUpdated: "余额已更新。", balanceError: "无法查询余额：{error}", copySuccess: "地址已复制。", copyError: "无法复制地址。", exportSuccess: "私钥备份已下载，请妥善保管并及时删除临时文件。", exportError: "导出失败：{error}", preparingFast: "首次使用 Fast stateless signing，正在预计算...", fastSigning: "正在生成 SHRINCS Fast 无状态签名。", buildingTransaction: "正在构造并签名交易...", broadcasting: "正在广播交易...", transferError: "转账失败：{error}", shrincsRejected: "SHRINCS 签名已完成，但测试网拒绝了零占位脚本交易：{error}", invalidAddress: "请输入 CKB 测试网地址（ckt1...）。", invalidAmount: "请输入最多 8 位小数的有效 CKB 金额。", amountTooSmall: "CKB 单个转账输出至少需要 61 CKB。", invalidPasswordData: "密码不正确或钱包数据已损坏。", unsupportedAccount: "不支持的账户类型。", invalidShrincsKey: "无效的 SHRINCS 签名密钥。", walletLocked: "钱包尚未解锁。", missingData: "SHRINCS 钱包数据不可用。", importedOnlyStateless: "导入的 SHRINCS 账户仅支持无状态签名。", noState: "此账户没有可用的状态化签名状态。", stateExhausted: "SHRINCS 状态化签名叶子已耗尽，请切换为无状态签名。", stateMismatch: "SHRINCS 状态计数器不一致。", verifyFailed: "SHRINCS 本地验签失败。", addressMismatch: "钱包地址校验失败。", notEnoughKey: "钱包加密密钥不可用，请重新解锁。", invalidPrepared: "无效的 Fast stateless signing 缓存。", txSuccess: "交易已广播。交易哈希：", explorerLink: "在区块浏览器中查看" },
  "en-US": {
    appTitle: "CKB Wallet", network: "TESTNET", generationProgress: "Account generation progress", signingProgress: "Signing progress", setupTitle: "Create or Import Account", setupHint: "Your private key is stored encrypted in this browser. Back it up separately; it cannot be recovered without the password.", accountTypeLabel: "Account type", shrincsExperimental: "shrincs (experimental)", privateKeyLabel: "Private key (32-byte hex)", passwordLabel: "Protection password", passwordPlaceholder: "At least 8 characters", generateButton: "Generate account", importButton: "Import account", importSaveButton: "Import and save", unlockTitle: "Unlock wallet", unlockHint: "Your private key is stored encrypted in this browser.", passwordOnlyLabel: "Password", unlockPlaceholder: "Enter protection password", unlockButton: "Unlock", resetButton: "Clear wallet", settingsTitle: "Settings", languageLabel: "Language", chinese: "中文", english: "English", backButton: "Back", myAddress: "My address", copyButton: "Copy", exportButton: "Export key backup", availableBalance: "Available balance", refreshButton: "Refresh", sendTitle: "Send CKB", recipientLabel: "Testnet recipient address", recipientPlaceholder: "ckt1...", amountLabel: "Amount (CKB)", amountPlaceholder: "At least 61 CKB", signModeLabel: "Signing mode", statefulOption: "stateful", statelessOption: "stateless", sendButton: "Sign and send", lockButton: "Lock", passwordShort: "The protection password must be at least 8 characters.", accountImported: "Account imported. Entering wallet.", accountGenerated: "Account generated. Entering wallet.", generatingKey: "Generating SHRINCS-B key material...", verifyingPassword: "Verifying password...", restoringKey: "Restoring SHRINCS key material...", missingVault: "Wallet data not found.", wrongPassword: "Incorrect password or corrupted wallet data.", balanceQuery: "Querying testnet balance...", balanceUpdated: "Balance updated.", balanceError: "Unable to query balance: {error}", copySuccess: "Address copied.", copyError: "Unable to copy address.", exportSuccess: "Key backup downloaded. Keep it secure and delete the temporary file.", exportError: "Export failed: {error}", preparingFast: "Preparing Fast stateless signing for the first transfer...", fastSigning: "Generating SHRINCS Fast stateless signature.", buildingTransaction: "Building and signing transaction...", broadcasting: "Broadcasting transaction...", transferError: "Transfer failed: {error}", shrincsRejected: "SHRINCS signing completed, but the testnet rejected the zero-placeholder script transaction: {error}", invalidAddress: "Enter a CKB testnet address (ckt1...).", invalidAmount: "Enter a valid CKB amount with at most 8 decimals.", amountTooSmall: "Each CKB transfer output must be at least 61 CKB.", invalidPasswordData: "Incorrect password or corrupted wallet data.", unsupportedAccount: "Unsupported account type.", invalidShrincsKey: "Invalid SHRINCS signing key.", walletLocked: "Wallet is not unlocked.", missingData: "SHRINCS wallet data is unavailable.", importedOnlyStateless: "Imported SHRINCS accounts only support stateless signing.", noState: "This account has no usable stateful signing state.", stateExhausted: "SHRINCS stateful signing leaves are exhausted. Switch to stateless signing.", stateMismatch: "SHRINCS state counter mismatch.", verifyFailed: "Local SHRINCS signature verification failed.", addressMismatch: "Wallet address verification failed.", notEnoughKey: "Wallet encryption key is unavailable. Unlock again.", invalidPrepared: "Invalid Fast stateless signing cache.", txSuccess: "Transaction broadcast. Transaction hash:", explorerLink: "View in block explorer" },
};
translations["zh-CN"].shrincsExperimental = "shrincs";
translations["en-US"].shrincsExperimental = "shrincs";
translations["zh-CN"].shrincsRejected = "SHRINCS 签名已完成，但测试网拒绝了交易：{error}";
translations["en-US"].shrincsRejected = "SHRINCS signing completed, but the testnet rejected the transaction: {error}";
const extraTranslations = {
  "zh-CN": { newAccountTitle: "生成随机账户", newAccountHint: "创建新的安全账户", importTitle: "导入已有账户", importHint: "使用私钥恢复账户", historyTitle: "交易历史", historyEmpty: "暂无交易记录", historyPending: "已提交", historySuccess: "已完成", historyAmount: "金额", historyTime: "时间", historyHash: "交易哈希", defaultOption: "默认" },
  "en-US": { newAccountTitle: "Generate account", newAccountHint: "Create a new secure account", importTitle: "Import account", importHint: "Restore with a private key", historyTitle: "Transaction history", historyEmpty: "No transactions yet", historyPending: "Submitted", historySuccess: "Completed", historyAmount: "Amount", historyTime: "Time", historyHash: "Transaction hash", defaultOption: "Default" },
};
let language = "en-US";
let viewBeforeSettings = "setup";
function t(key, variables = {}) {
  return Object.entries(variables).reduce((text, [name, value]) => text.replace(`{${name}}`, value), translations[language][key] || extraTranslations[language][key] || key);
}
function applyTranslations() {
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.i18nAria)); });
  elements.settingsButton?.setAttribute("aria-label", t("settingsTitle"));
  elements.settingsButton?.setAttribute("title", t("settingsTitle"));
  updateSetupAccountType();
}
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
      if (!/^0x[0-9a-f]{64}$/.test(publicKey || "")) throw new Error(language === "zh-CN" ? "SHRINCS 公钥必须是 32 字节十六进制字符。" : "SHRINCS public key must be 32-byte hexadecimal.");
      const lock = { codeHash: SHRINCS_SCRIPT.codeHash, hashType: SHRINCS_SCRIPT.hashType, args: publicKey };
      return { address: helpers.encodeToAddress(lock), publicKey, lock };
    },
    canBroadcast: true,
  },
};

globalThis.Buffer ??= Buffer;
config.initializeConfig(config.predefined.AGGRON4);

const elements = {
  setupView: document.querySelector("#setup-view"), createView: document.querySelector("#create-view"), importView: document.querySelector("#import-view"), unlockView: document.querySelector("#unlock-view"), settingsView: document.querySelector("#settings-view"), walletView: document.querySelector("#wallet-view"),
  privateKey: document.querySelector("#private-key"), privateKeyLabel: document.querySelector("#private-key-label"), setupAccountType: document.querySelector("#setup-account-type"), importAccountType: document.querySelector("#setup-account-type-import"), newPassword: document.querySelector("#new-password"), importPassword: document.querySelector("#new-password-import"), setupStatus: document.querySelector("#setup-status"), createStatus: document.querySelector("#create-status"), importStatus: document.querySelector("#import-status"), generationProgress: document.querySelector("#generation-progress"),
  unlockPassword: document.querySelector("#unlock-password"), unlockStatus: document.querySelector("#unlock-status"), walletStatus: document.querySelector("#wallet-status"),
  address: document.querySelector("#address"), accountType: document.querySelector("#account-type"), balance: document.querySelector("#balance"), recipient: document.querySelector("#recipient"), amount: document.querySelector("#amount"), signingProgress: document.querySelector("#signing-progress"),
  generateButton: document.querySelector("#generate-button"), showImportButton: document.querySelector("#show-import-button"), saveWalletButton: document.querySelector("#save-wallet-button"), unlockButton: document.querySelector("#unlock-button"), resetButton: document.querySelector("#reset-button"),
  copyAddressButton: document.querySelector("#copy-address-button"), refreshButton: document.querySelector("#refresh-button"), transferForm: document.querySelector("#transfer-form"), sendButton: document.querySelector("#send-button"),
  settingsButton: document.querySelector("#settings-button"), languageSelect: document.querySelector("#language-select"), settingsSignMode: document.querySelector("#settings-sign-mode"), settingsBackButton: document.querySelector("#settings-back-button"), sendTab: document.querySelector("#send-tab"), historyTab: document.querySelector("#history-tab"), historyPanel: document.querySelector("#history-panel"), historyList: document.querySelector("#transaction-history"), historyEmpty: document.querySelector("#history-empty"),
};

let account = null;
let privateKeyInMemory = null;
let shrincsPreparedKeyInMemory = null;
let shrincsPreparedKeyPromise = null;
let vaultEncryptionKey = null;
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
  elements.createView.hidden = view !== "create";
  elements.importView.hidden = view !== "import";
  elements.unlockView.hidden = view !== "unlock";
  elements.settingsView.hidden = view !== "settings";
  elements.walletView.hidden = view !== "wallet";
}

function updateSignModeOptions(accountType = account?.accountType, imported = account?.imported) {
  const isShrincs = accountType === "shrincs";
  elements.settingsSignMode.querySelector('option[value="default"]').hidden = isShrincs;
  elements.settingsSignMode.querySelector('option[value="stateful"]').hidden = !isShrincs || Boolean(imported);
  elements.settingsSignMode.querySelector('option[value="stateless"]').hidden = !isShrincs;
  if (!isShrincs) elements.settingsSignMode.value = "default";
}

function lockWallet() {
  privateKeyInMemory = null;
  shrincsPreparedKeyInMemory = null;
  shrincsPreparedKeyPromise = null;
  vaultEncryptionKey = null;
  account = null;
  elements.balance.textContent = "-- CKB";
  updateSignModeOptions();
  showView("unlock");
}

function openSettings() {
  viewBeforeSettings = ["setup", "create", "import", "unlock", "wallet"].find((view) => !elements[`${view}View`].hidden) || "setup";
  showView("settings");
}

function normalizePrivateKey(value, accountType = DEFAULT_ACCOUNT_TYPE) {
  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  const expectedLength = accountType === "shrincs" ? 96 : 64;
  if (!new RegExp(`^[0-9a-f]{${expectedLength}}$`).test(normalized)) throw new Error(language === "zh-CN" ? `${accountType === "shrincs" ? "SHRINCS 主种子" : "私钥"}必须是 ${expectedLength} 位十六进制字符。` : `${accountType === "shrincs" ? "SHRINCS master seed" : "Private key"} must be ${expectedLength} hexadecimal characters.`);
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
  if (!implementation) throw new Error(t("unsupportedAccount"));
  return implementation;
}

function createAccount(privateKey, accountType = DEFAULT_ACCOUNT_TYPE, publicKey) {
  return getAccountType(accountType).createAccount(privateKey, publicKey);
}

function shrincsStatefulSignatureSize(q) {
  return 16 + SHRINCS_WOTS_SIGNATURE_SIZE + Math.min(q, SHRINCS_MAX_STATEFUL_SIGNATURES - 1) * 16;
}

// 当前转账采用的 SHRINCS 签名方式。
function currentShrincsSignMode() {
  if (account?.imported) return "stateless";
  if (elements.settingsSignMode?.value && elements.settingsSignMode.value !== "default") return elements.settingsSignMode.value;
  return account?.shrincsState?.mode === "stateful" ? "stateful" : "stateless";
}

function shrincsSignaturePlaceholderSize() {
  const mode = account?.imported ? "stateless" : currentShrincsSignMode();
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

function appendUint32LE(hasher, length) {
  const packed = new Uint8Array(4);
  new DataView(packed.buffer).setUint32(0, length, true);
  hasher.update(packed);
}

function appendShrincsWitness(hasher, witness) {
  const witnessBytes = bytes.bytify(witness || "0x");
  appendUint32LE(hasher, witnessBytes.length);
  hasher.update(witnessBytes);
}

function appendShrincsCell(hasher, input) {
  const cellData = bytes.bytify(input.data || "0x");
  hasher.update(blockchain.CellOutput.pack(input.cellOutput));
  appendUint32LE(hasher, cellData.length);
  hasher.update(cellData);
}

function appendShrincsWitnessField(hasher, field) {
  const fieldBytes = blockchain.BytesOpt.pack(field);
  appendUint32LE(hasher, fieldBytes.length);
  hasher.update(fieldBytes);
}

class ShrincsMessageHasher {
  constructor() {
    this.hasher = blake2b(32, undefined, undefined, bytes.bytify("0x636b622d736872696e63732d6d73672d"));
  }

  update(data) {
    this.hasher.update(bytes.bytify(data));
    return this;
  }

  digestHex() {
    const digest = new Uint8Array(32);
    this.hasher.digest(digest);
    return bytes.hexify(digest);
  }
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
  const processedArgs = new Set();
  for (let index = 0; index < inputs.size; index += 1) {
    const input = inputs.get(index);
    const lock = input.cellOutput.lock;
    if (!isShrincsLock(lock) || processedArgs.has(lock.args)) continue;
    processedArgs.add(lock.args);
    const lockValue = new values.ScriptValue(lock, { validate: false });
    const firstWitness = witnesses.get(index) || "0x";
    let witnessArgs;
    try {
      witnessArgs = blockchain.WitnessArgs.unpack(bytes.bytify(firstWitness));
    } catch {
      throw new Error("The first SHRINCS witness must be valid WitnessArgs.");
    }
    const hasher = new ShrincsMessageHasher();
    hasher.update(txHash);
    for (let inputIndex = 0; inputIndex < inputs.size; inputIndex += 1) appendShrincsCell(hasher, inputs.get(inputIndex));
    appendShrincsWitnessField(hasher, witnessArgs.inputType);
    appendShrincsWitnessField(hasher, witnessArgs.outputType);
    for (let witnessIndex = index + 1; witnessIndex < inputs.size; witnessIndex += 1) {
      const otherLock = inputs.get(witnessIndex).cellOutput.lock;
      if (lockValue.equals(new values.ScriptValue(otherLock, { validate: false }))) appendShrincsWitness(hasher, witnesses.get(witnessIndex));
    }
    for (let witnessIndex = inputs.size; witnessIndex < witnesses.size; witnessIndex += 1) appendShrincsWitness(hasher, witnesses.get(witnessIndex));
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
  const payload = JSON.stringify({ privateKey, shrincsSecretKey, shrincsPreparedKey: undefined });
  const cipherText = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(payload));
  const account = createAccount(privateKey, accountType, publicKey);
  vaultEncryptionKey = key;
  return { version: 6, salt: encodeBase64(salt), iv: encodeBase64(iv), cipherText: encodeBase64(cipherText), accountType, publicKey: account.publicKey, address: account.address, shrincsState, imported };
}

async function persistShrincsPreparedKey(preparedKey) {
  if (!vaultEncryptionKey) throw new Error(t("notEnoughKey"));
  const { vault } = await chrome.storage.local.get("vault");
  if (!vault) throw new Error(t("missingVault"));
  const plainText = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(vault.iv) }, vaultEncryptionKey, decodeBase64(vault.cipherText));
  const { privateKey, shrincsSecretKey } = JSON.parse(new TextDecoder().decode(plainText));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = JSON.stringify({ privateKey, shrincsSecretKey, shrincsPreparedKey: encodeBase64(preparedKey) });
  const cipherText = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, vaultEncryptionKey, new TextEncoder().encode(payload));
  await chrome.storage.local.set({ vault: { ...vault, version: 6, iv: encodeBase64(iv), cipherText: encodeBase64(cipherText) } });
}

async function decryptPrivateKey(vault, password) {
  try {
    const key = await deriveEncryptionKey(password, decodeBase64(vault.salt), ["encrypt", "decrypt"]);
    const plainText = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(vault.iv) }, key, decodeBase64(vault.cipherText));
    const payload = JSON.parse(new TextDecoder().decode(plainText));
    const accountType = vault.accountType || DEFAULT_ACCOUNT_TYPE;
    const privateKey = normalizePrivateKey(payload.privateKey, accountType);
    if (accountType === "shrincs" && !/^0x[0-9a-f]{192}$/.test(payload.shrincsSecretKey || "")) throw new Error(t("invalidShrincsKey"));
    return { privateKey, shrincsSecretKey: payload.shrincsSecretKey, shrincsPreparedKey: payload.shrincsPreparedKey ? decodeBase64(payload.shrincsPreparedKey) : null, encryptionKey: key };
  } catch { throw new Error(t("wrongPassword")); }
}

async function ensureShrincsPreparedKey() {
  if (shrincsPreparedKeyInMemory) return shrincsPreparedKeyInMemory;
  if (!shrincsPreparedKeyPromise) {
    shrincsPreparedKeyPromise = (async () => {
      setStatus(elements.walletStatus, t("preparingFast"));
      elements.signingProgress.hidden = false;
      await nextPaint();
      await shrincsInitialization;
      const preparedKey = signStatelessPrepare(ParamsType.B, bytes.bytify(privateKeyInMemory));
      await persistShrincsPreparedKey(preparedKey);
      shrincsPreparedKeyInMemory = preparedKey;
      return preparedKey;
    })().finally(() => { shrincsPreparedKeyPromise = null; });
  }
  return shrincsPreparedKeyPromise;
}

async function signShrincsMessage(message) {
  await shrincsInitialization;
  const messageBytes = bytes.bytify(message);
  const secretKey = bytes.bytify(privateKeyInMemory);
  const { vault } = await chrome.storage.local.get("vault");
  if (!vault || vault.accountType !== "shrincs") throw new Error(t("missingData"));
  const mode = currentShrincsSignMode();
  let signature;
  if (mode === "stateful") {
    const state = vault.shrincsState;
    if (!state || state.mode !== "stateful" || !state.data) throw new Error(t("noState"));
    const stateBytes = bytes.bytify(state.data);
    const q = stateCounter(stateBytes);
    if (q >= SHRINCS_MAX_STATEFUL_SIGNATURES) throw new Error(t("stateExhausted"));
    const reservedState = { mode: "stateful", q: q + 1, data: bytes.hexify(incrementShrincsState(stateBytes)) };
    await chrome.storage.local.set({ vault: { ...vault, version: 4, shrincsState: reservedState } });
    account.shrincsState = reservedState;
    const result = signStateful(ParamsType.B, messageBytes, secretKey, stateBytes);
    const nextState = stateFromStatefulSignResult(result);
    if (stateCounter(nextState) !== reservedState.q) throw new Error(t("stateMismatch"));
    signature = signatureFromStatefulSignResult(result);
  } else {
    const preparedKey = await ensureShrincsPreparedKey();
    setStatus(elements.walletStatus, t("fastSigning"), "");
    elements.signingProgress.hidden = false;
    await nextPaint();
    signature = signStatelessWithPrepare(ParamsType.B, messageBytes, secretKey, preparedKey);
  }
  const publicKey = bytes.bytify(account.publicKey);
  if (!verify(ParamsType.B, messageBytes, signature, publicKey)) throw new Error(t("verifyFailed"));
  return bytes.hexify(signature);
}

function parseCkbAmount(value) {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,8}))?$/);
  if (!match) throw new Error(t("invalidAmount"));
  const fraction = (match[2] || "").padEnd(8, "0");
  const amount = BigInt(match[1]) * SHANNONS_PER_CKB + BigInt(fraction);
  if (amount < MIN_TRANSFER_CKB * SHANNONS_PER_CKB) throw new Error(t("amountTooSmall"));
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
  link.textContent = t("explorerLink");
  elements.walletStatus.replaceChildren(t("txSuccess"), hash, lineBreak, link);
  elements.walletStatus.className = "status success";
}

async function refreshBalance() {
  elements.refreshButton.disabled = true;
  setStatus(elements.walletStatus, t("balanceQuery"));
  try {
    let capacity = 0n;
    const lock = helpers.parseAddress(account.address);
    for await (const cell of indexer.collector({ lock }).collect()) capacity += BigInt(cell.cellOutput.capacity);
    elements.balance.innerHTML = `${formatCkb(capacity)} <small>CKB</small>`;
    setStatus(elements.walletStatus, t("balanceUpdated"), "success");
  } catch (error) {
    setStatus(elements.walletStatus, t("balanceError", { error: error.message }), "error");
  } finally { elements.refreshButton.disabled = false; }
}

// 进入钱包视图（生成/导入后直接进入，或解锁后进入）。privateKey 为内存中用于签名的密钥。
async function enterWallet({ accountType, privateKey, publicKey, shrincsState, imported, expectedAddress }) {
  const restoredAccount = createAccount(privateKey, accountType, publicKey);
  if (expectedAddress && restoredAccount.address !== expectedAddress) throw new Error(t("addressMismatch"));
  privateKeyInMemory = privateKey;
  account = { ...restoredAccount, accountType, shrincsState: accountType === "shrincs" ? shrincsState : undefined, imported };
  elements.address.textContent = account.address;
  elements.accountType.textContent = accountType;
  updateSignModeOptions(accountType, imported);
  elements.settingsSignMode.value = accountType === "shrincs" ? currentShrincsSignMode() : "default";
  elements.settingsSignMode.disabled = false;
  showView("wallet");
  await refreshBalance();
}

async function saveWallet() {
  setStatus(elements.importStatus);
  try {
    const accountType = elements.importAccountType.value;
    const password = elements.importPassword.value;
    if (password.length < 8) throw new Error(t("passwordShort"));
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
      const state = initialState();
      shrincsState = { mode: "stateful", q: stateCounter(state), data: bytes.hexify(state) };
      privateKey = seed;
    } else {
      privateKey = normalizePrivateKey(privateKey, accountType);
    }
    const vault = await encryptPrivateKey(privateKey, password, accountType, publicKey, shrincsState, true, secretKey);
    await chrome.storage.local.set({ vault });
    elements.privateKey.value = "";
    elements.newPassword.value = "";
    setStatus(elements.importStatus, t("accountImported"), "success");
    await enterWallet({ accountType, privateKey: accountType === "shrincs" ? secretKey : privateKey, publicKey, shrincsState, imported: true });
  } catch (error) { setStatus(elements.importStatus, error.message, "error"); }
}

async function generateWallet() {
  setStatus(elements.createStatus);
  elements.generateButton.disabled = true;
  try {
    const accountType = elements.setupAccountType.value;
    const password = elements.newPassword.value;
    if (password.length < 8) throw new Error(t("passwordShort"));
    let privateKey;
    let publicKey;
    let secretKey;
    let shrincsState;
    if (accountType === "shrincs") {
      setStatus(elements.createStatus, t("generatingKey"));
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
    setStatus(elements.createStatus, t("accountGenerated"), "success");
    await enterWallet({ accountType, privateKey: accountType === "shrincs" ? secretKey : privateKey, publicKey, shrincsState, imported: false });
  } catch (error) {
    setStatus(elements.createStatus, error.message, "error");
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
    if (!vault) throw new Error(t("missingVault"));
    const accountType = vault.accountType || DEFAULT_ACCOUNT_TYPE;
    setStatus(elements.unlockStatus, t("verifyingPassword"));
    const { privateKey: seed, shrincsSecretKey, shrincsPreparedKey: preparedKey, encryptionKey } = await decryptPrivateKey(vault, elements.unlockPassword.value);
    vaultEncryptionKey = encryptionKey;
    shrincsPreparedKeyInMemory = preparedKey;
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
  setStatus(elements.walletStatus, t("buildingTransaction"));
  let transactionSigned = false;
  try {
    const recipient = elements.recipient.value.trim();
    if (!recipient.startsWith("ckt1")) throw new Error(t("invalidAddress"));
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
    setStatus(elements.walletStatus, t("broadcasting"));
    const transactionHash = await rpc.sendTransaction(sealed, "passthrough");
    await recordTransaction(transactionHash, amount);
    elements.amount.value = "";
    await refreshBalance();
    showTransactionLink(transactionHash);
  } catch (error) {
    const prefix = account?.accountType === "shrincs" && transactionSigned
      ? t("shrincsRejected", { error: error.message })
      : t("transferError", { error: error.message });
    setStatus(elements.walletStatus, prefix, "error");
  } finally {
    elements.signingProgress.hidden = true;
    elements.sendButton.disabled = false;
  }
}

async function copyAddress() {
  await navigator.clipboard.writeText(account.address);
  setStatus(elements.walletStatus, t("copySuccess"), "success");
}

async function exportWallet() {
  if (!privateKeyInMemory || !account) throw new Error(t("walletLocked"));
  const password = window.prompt(language === "zh-CN" ? "请输入钱包密码以确认导出：" : "Enter your wallet password to confirm export:");
  if (password === null) return;

  const { vault } = await chrome.storage.local.get("vault");
  if (!vault) throw new Error(t("missingVault"));
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
  setStatus(elements.walletStatus, t("exportSuccess"), "success");
}

function updateSetupAccountType() {
  const isShrincs = elements.setupAccountType.value === "shrincs";
  elements.privateKeyLabel.textContent = isShrincs ? (language === "zh-CN" ? "SHRINCS 主种子（48 字节十六进制）" : "SHRINCS master seed (48-byte hex)") : t("privateKeyLabel");
  elements.importAccountType.value = elements.setupAccountType.value;
}

function renderTransactionHistory(records) {
  elements.historyList.replaceChildren(...records.map((record) => {
    const item = document.createElement("li");
    item.className = "history-item";
    const statusLabel = record.status === "completed" ? t("historySuccess") : t("historyPending");
    item.innerHTML = `<div class="row"><strong>${statusLabel}</strong><span class="history-meta">${new Date(record.time).toLocaleString(language)}</span></div><div class="history-meta">${t("historyAmount")}: ${record.amount} CKB</div>`;
    const hash = document.createElement("code");
    hash.className = "transaction-hash";
    hash.textContent = record.hash;
    item.append(hash);
    return item;
  }));
  elements.historyEmpty.hidden = records.length > 0;
}

async function loadTransactionHistory() {
  const { transactionHistory = {} } = await chrome.storage.local.get("transactionHistory");
  const records = (transactionHistory[account.address] || []).map((record) => ({
    ...record,
    status: record.status || "completed",
  }));
  const pendingRecords = records.filter((record) => record.status !== "completed");
  if (pendingRecords.length > 0) {
    const updatedRecords = await Promise.all(records.map(async (record) => {
      if (record.status === "completed") return record;
      try {
        const transaction = await rpc.getTransaction(record.hash);
        const transactionStatus = transaction?.txStatus?.status || transaction?.tx_status?.status || transaction?.status;
        return transactionStatus === "committed" ? { ...record, status: "completed" } : record;
      } catch {
        return record;
      }
    }));
    transactionHistory[account.address] = updatedRecords;
    await chrome.storage.local.set({ transactionHistory });
    renderTransactionHistory(updatedRecords);
    return;
  }
  transactionHistory[account.address] = records;
  await chrome.storage.local.set({ transactionHistory });
  renderTransactionHistory(records);
}

async function recordTransaction(transactionHash, amount) {
  const { transactionHistory = {} } = await chrome.storage.local.get("transactionHistory");
  const records = transactionHistory[account.address] || [];
  transactionHistory[account.address] = [{ hash: transactionHash, amount: formatCkb(amount), time: Date.now(), status: "pending" }, ...records].slice(0, 30);
  await chrome.storage.local.set({ transactionHistory });
  renderTransactionHistory(transactionHistory[account.address]);
}

function showWalletPanel(panel) {
  const history = panel === "history";
  elements.transferForm.hidden = history;
  elements.historyPanel.hidden = !history;
  elements.sendTab.classList.toggle("active", !history);
  elements.historyTab.classList.toggle("active", history);
  if (history) loadTransactionHistory();
}

elements.generateButton.addEventListener("click", generateWallet);
document.querySelector("#new-account-button").addEventListener("click", () => showView("create"));
elements.showImportButton.addEventListener("click", () => showView("import"));
document.querySelector("#create-back-button").addEventListener("click", () => showView("setup"));
document.querySelector("#import-back-button").addEventListener("click", () => showView("setup"));
elements.setupAccountType.addEventListener("change", updateSetupAccountType);
elements.importAccountType.addEventListener("change", () => {
  elements.setupAccountType.value = elements.importAccountType.value;
  updateSetupAccountType();
});
elements.saveWalletButton.addEventListener("click", saveWallet);
elements.unlockButton.addEventListener("click", unlockWallet);
elements.refreshButton.addEventListener("click", refreshBalance);
elements.transferForm.addEventListener("submit", sendTransfer);
elements.copyAddressButton.addEventListener("click", () => copyAddress().catch(() => setStatus(elements.walletStatus, t("copyError"), "error")));
document.querySelector("#export-settings-button").addEventListener("click", () => exportWallet().catch((error) => setStatus(elements.walletStatus, t("exportError", { error: error.message }), "error")));
elements.settingsButton.addEventListener("click", openSettings);
elements.settingsBackButton.addEventListener("click", () => showView(viewBeforeSettings));
document.querySelector("#settings-lock-button").addEventListener("click", lockWallet);
elements.settingsSignMode.addEventListener("change", () => {
  if (account?.accountType !== "shrincs") return;
  if (account.imported) {
    elements.settingsSignMode.value = "stateless";
    account.shrincsState.mode = "stateless";
    return;
  }
  account.shrincsState.mode = elements.settingsSignMode.value;
});
elements.sendTab.addEventListener("click", () => showWalletPanel("send"));
elements.historyTab.addEventListener("click", () => showWalletPanel("history"));
elements.languageSelect.addEventListener("change", async () => {
  language = elements.languageSelect.value;
  await chrome.storage.local.set({ language });
  applyTranslations();
});
elements.resetButton.addEventListener("click", async () => {
  await chrome.storage.local.remove("vault");
  account = null;
  updateSignModeOptions();
  elements.unlockPassword.value = "";
  elements.privateKey.value = "";
  elements.importPassword.value = "";
  showView("setup");
});

(async () => {
  const { vault, language: storedLanguage } = await chrome.storage.local.get(["vault", "language"]);
  language = storedLanguage === "zh-CN" ? "zh-CN" : "en-US";
  elements.languageSelect.value = language;
  applyTranslations();
  updateSignModeOptions();
  showView(vault ? "unlock" : "setup");
})();
