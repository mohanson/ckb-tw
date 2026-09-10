import { ccc } from "@ckb-ccc/ccc";
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
  verify,
} from "./shrincs-wasm/pkg/shrincs.js";

const RPC_URL = "https://testnet.ckb.dev/rpc";
const SHANNONS_PER_CKB = 100000000n;
const MIN_TRANSFER_CKB = 61n;
const FEE_RATE = 1000n;
const DEFAULT_ACCOUNT_TYPE = "secp256k1";
const VAULT_VERSION = 6;
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
const translations = { "zh-CN": {}, "en-US": {} };
translations["zh-CN"].appTitle = "CKB Testnet Wallet";
translations["en-US"].appTitle = "CKB Testnet Wallet";
translations["zh-CN"].network = "TESTNET";
translations["en-US"].network = "TESTNET";
translations["zh-CN"].generationProgress = "生成账户进度";
translations["en-US"].generationProgress = "Account generation progress";
translations["zh-CN"].signingProgress = "签名进度";
translations["en-US"].signingProgress = "Signing progress";
translations["zh-CN"].setupTitle = "创建或导入账户";
translations["en-US"].setupTitle = "Create or Import Account";
translations["zh-CN"].setupHint = "私钥只会以加密形式保存在此浏览器. 请单独备份私钥, 丢失密码无法恢复.";
translations["en-US"].setupHint = "Your private key is stored encrypted in this browser. Back it up separately; it cannot be recovered without the password.";
translations["zh-CN"].accountTypeLabel = "账户类型";
translations["en-US"].accountTypeLabel = "Account type";
translations["zh-CN"].privateKeyLabel = "私钥(32 字节十六进制)";
translations["en-US"].privateKeyLabel = "Private key (32-byte hex)";
translations["zh-CN"].passwordLabel = "保护密码";
translations["en-US"].passwordLabel = "Protection password";
translations["zh-CN"].passwordPlaceholder = "至少 8 位";
translations["en-US"].passwordPlaceholder = "At least 8 characters";
translations["zh-CN"].generateButton = "随机生成账户";
translations["en-US"].generateButton = "Generate account";
translations["zh-CN"].importSaveButton = "导入并保存";
translations["en-US"].importSaveButton = "Import and save";
translations["zh-CN"].unlockTitle = "解锁钱包";
translations["en-US"].unlockTitle = "Unlock wallet";
translations["zh-CN"].unlockHint = "私钥已加密保存在此浏览器.";
translations["en-US"].unlockHint = "Your private key is stored encrypted in this browser.";
translations["zh-CN"].passwordOnlyLabel = "密码";
translations["en-US"].passwordOnlyLabel = "Password";
translations["zh-CN"].unlockPlaceholder = "输入保护密码";
translations["en-US"].unlockPlaceholder = "Enter protection password";
translations["zh-CN"].unlockButton = "解锁";
translations["en-US"].unlockButton = "Unlock";
translations["zh-CN"].settingsTitle = "设置";
translations["en-US"].settingsTitle = "Settings";
translations["zh-CN"].languageLabel = "语言";
translations["en-US"].languageLabel = "Language";
translations["zh-CN"].chinese = "中文";
translations["en-US"].chinese = "中文";
translations["zh-CN"].english = "English";
translations["en-US"].english = "English";
translations["zh-CN"].backButton = "返回";
translations["en-US"].backButton = "Back";
translations["zh-CN"].myAddress = "我的地址";
translations["en-US"].myAddress = "My address";
translations["zh-CN"].copyButton = "复制";
translations["en-US"].copyButton = "Copy";
translations["zh-CN"].exportButton = "导出私钥备份";
translations["en-US"].exportButton = "Export key backup";
translations["zh-CN"].availableBalance = "可用余额";
translations["en-US"].availableBalance = "Available balance";
translations["zh-CN"].refreshButton = "刷新";
translations["en-US"].refreshButton = "Refresh";
translations["zh-CN"].sendTitle = "发送 CKB";
translations["en-US"].sendTitle = "Send CKB";
translations["zh-CN"].recipientLabel = "收款测试网地址";
translations["en-US"].recipientLabel = "Testnet recipient address";
translations["zh-CN"].recipientPlaceholder = "ckt1...";
translations["en-US"].recipientPlaceholder = "ckt1...";
translations["zh-CN"].amountLabel = "金额(CKB)";
translations["en-US"].amountLabel = "Amount (CKB)";
translations["zh-CN"].amountPlaceholder = "至少 61 CKB";
translations["en-US"].amountPlaceholder = "At least 61 CKB";
translations["zh-CN"].signModeLabel = "签名方式";
translations["en-US"].signModeLabel = "Signing mode";
translations["zh-CN"].statefulOption = "有状态";
translations["en-US"].statefulOption = "stateful";
translations["zh-CN"].statelessOption = "无状态";
translations["en-US"].statelessOption = "stateless";
translations["zh-CN"].sendButton = "签名并发送";
translations["en-US"].sendButton = "Sign and send";
translations["zh-CN"].lockButton = "锁定";
translations["en-US"].lockButton = "Lock";
translations["zh-CN"].passwordShort = "保护密码至少需要 8 位.";
translations["en-US"].passwordShort = "The protection password must be at least 8 characters.";
translations["zh-CN"].accountImported = "账户已导入, 直接进入钱包.";
translations["en-US"].accountImported = "Account imported. Entering wallet.";
translations["zh-CN"].accountGenerated = "账户已生成, 直接进入钱包.";
translations["en-US"].accountGenerated = "Account generated. Entering wallet.";
translations["zh-CN"].generatingKey = "正在生成 SHRINCS-B 密钥材料...";
translations["en-US"].generatingKey = "Generating SHRINCS-B key material...";
translations["zh-CN"].verifyingPassword = "正在验证密码...";
translations["en-US"].verifyingPassword = "Verifying password...";
translations["zh-CN"].missingVault = "未找到钱包数据.";
translations["en-US"].missingVault = "Wallet data not found.";
translations["zh-CN"].wrongPassword = "密码不正确或钱包数据已损坏.";
translations["en-US"].wrongPassword = "Incorrect password or corrupted wallet data.";
translations["zh-CN"].balanceQuery = "正在查询测试网余额...";
translations["en-US"].balanceQuery = "Querying testnet balance...";
translations["zh-CN"].balanceUpdated = "余额已更新.";
translations["en-US"].balanceUpdated = "Balance updated.";
translations["zh-CN"].balanceError = "无法查询余额: {error}";
translations["en-US"].balanceError = "Unable to query balance: {error}";
translations["zh-CN"].copySuccess = "地址已复制.";
translations["en-US"].copySuccess = "Address copied.";
translations["zh-CN"].copyError = "无法复制地址.";
translations["en-US"].copyError = "Unable to copy address.";
translations["zh-CN"].exportSuccess = "私钥备份已下载, 请妥善保管并及时删除临时文件.";
translations["en-US"].exportSuccess = "Key backup downloaded. Keep it secure and delete the temporary file.";
translations["zh-CN"].exportError = "导出失败: {error}";
translations["en-US"].exportError = "Export failed: {error}";
translations["zh-CN"].preparingFast = "首次使用 Fast stateless signing, 正在预计算...";
translations["en-US"].preparingFast = "Preparing Fast stateless signing for the first transfer...";
translations["zh-CN"].fastSigning = "正在生成 SHRINCS Fast 无状态签名.";
translations["en-US"].fastSigning = "Generating SHRINCS Fast stateless signature.";
translations["zh-CN"].buildingTransaction = "正在构造并签名交易...";
translations["en-US"].buildingTransaction = "Building and signing transaction...";
translations["zh-CN"].broadcasting = "正在广播交易...";
translations["en-US"].broadcasting = "Broadcasting transaction...";
translations["zh-CN"].transferError = "转账失败: {error}";
translations["en-US"].transferError = "Transfer failed: {error}";
translations["zh-CN"].shrincsRejected = "SHRINCS 签名已完成, 但测试网拒绝了零占位脚本交易: {error}";
translations["en-US"].shrincsRejected = "SHRINCS signing completed, but the testnet rejected the zero-placeholder script transaction: {error}";
translations["zh-CN"].shrincsRejected = "SHRINCS 签名已完成, 但测试网拒绝了交易: {error}";
translations["en-US"].shrincsRejected = "SHRINCS signing completed, but the testnet rejected the transaction: {error}";
translations["zh-CN"].invalidAddress = "请输入 CKB 测试网地址(ckt1...).";
translations["en-US"].invalidAddress = "Enter a CKB testnet address (ckt1...).";
translations["zh-CN"].invalidAmount = "请输入最多 8 位小数的有效 CKB 金额.";
translations["en-US"].invalidAmount = "Enter a valid CKB amount with at most 8 decimals.";
translations["zh-CN"].amountTooSmall = "CKB 单个转账输出至少需要 61 CKB.";
translations["en-US"].amountTooSmall = "Each CKB transfer output must be at least 61 CKB.";
translations["zh-CN"].unsupportedAccount = "不支持的账户类型.";
translations["en-US"].unsupportedAccount = "Unsupported account type.";
translations["zh-CN"].invalidShrincsKey = "无效的 SHRINCS 签名密钥.";
translations["en-US"].invalidShrincsKey = "Invalid SHRINCS signing key.";
translations["zh-CN"].walletLocked = "钱包尚未解锁.";
translations["en-US"].walletLocked = "Wallet is not unlocked.";
translations["zh-CN"].missingData = "SHRINCS 钱包数据不可用.";
translations["en-US"].missingData = "SHRINCS wallet data is unavailable.";
translations["zh-CN"].noState = "此账户没有可用的状态化签名状态.";
translations["en-US"].noState = "This account has no usable stateful signing state.";
translations["zh-CN"].stateExhausted = "SHRINCS 状态化签名叶子已耗尽, 请切换为无状态签名.";
translations["en-US"].stateExhausted = "SHRINCS stateful signing leaves are exhausted. Switch to stateless signing.";
translations["zh-CN"].stateMismatch = "SHRINCS 状态计数器不一致.";
translations["en-US"].stateMismatch = "SHRINCS state counter mismatch.";
translations["zh-CN"].verifyFailed = "SHRINCS 本地验签失败.";
translations["en-US"].verifyFailed = "Local SHRINCS signature verification failed.";
translations["zh-CN"].addressMismatch = "钱包地址校验失败.";
translations["en-US"].addressMismatch = "Wallet address verification failed.";
translations["zh-CN"].notEnoughKey = "钱包加密密钥不可用, 请重新解锁.";
translations["en-US"].notEnoughKey = "Wallet encryption key is unavailable. Unlock again.";
translations["zh-CN"].txSuccess = "交易已广播. 交易哈希: ";
translations["en-US"].txSuccess = "Transaction broadcast. Transaction hash:";
translations["zh-CN"].explorerLink = "在区块浏览器中查看";
translations["en-US"].explorerLink = "View in block explorer";
translations["zh-CN"].statelessSigningHint = "无状态签名使用更大的签名, 并会产生更高的交易手续费.";
translations["en-US"].statelessSigningHint = "Stateless signing uses larger signatures and costs more transaction fees.";
translations["zh-CN"].signModeHelp = "导入的 SHRINCS 账户不能使用有状态签名, 以避免签名状态在多台设备之间不同步而带来安全风险。新生成的账户应优先使用有状态签名, 因为签名更小、手续费更低。";
translations["en-US"].signModeHelp = "Imported SHRINCS accounts cannot use stateful signing, because an unsynchronized state across devices could create a security risk. For newly generated accounts, stateful signing is preferred because its signatures are smaller and fees are lower.";
translations["zh-CN"].shrincsImportSigningHint = "SHRINCS 导入账户只能使用无状态签名.";
translations["en-US"].shrincsImportSigningHint = "Imported SHRINCS accounts can only use stateless signing.";
translations["zh-CN"].newAccountTitle = "生成随机账户";
translations["en-US"].newAccountTitle = "Generate account";
translations["zh-CN"].newAccountHint = "创建新的安全账户";
translations["en-US"].newAccountHint = "Create a new secure account";
translations["zh-CN"].importTitle = "导入已有账户";
translations["en-US"].importTitle = "Import account";
translations["zh-CN"].importHint = "使用私钥恢复账户";
translations["en-US"].importHint = "Restore with a private key";
translations["zh-CN"].historyTitle = "交易历史";
translations["en-US"].historyTitle = "Transaction history";
translations["zh-CN"].historyEmpty = "暂无交易记录";
translations["en-US"].historyEmpty = "No transactions yet";
translations["zh-CN"].historyPending = "已提交";
translations["en-US"].historyPending = "Submitted";
translations["zh-CN"].historySuccess = "已完成";
translations["en-US"].historySuccess = "Completed";
translations["zh-CN"].historyAmount = "金额";
translations["en-US"].historyAmount = "Amount";
translations["zh-CN"].defaultOption = "默认";
translations["en-US"].defaultOption = "Default";
translations["zh-CN"].deleteAccountTitle = "删除账户";
translations["en-US"].deleteAccountTitle = "Delete account";
translations["zh-CN"].deleteAccountHint = "删除本地保存的账户和私钥. 此操作无法撤销.";
translations["en-US"].deleteAccountHint = "Delete the locally stored account and private key. This cannot be undone.";
translations["zh-CN"].deleteAccountConfirm = "确认删除账户";
translations["en-US"].deleteAccountConfirm = "Delete account";
translations["zh-CN"].deleteAccountCancel = "取消";
translations["en-US"].deleteAccountCancel = "Cancel";
translations["zh-CN"].changePasswordTitle = "修改密码";
translations["en-US"].changePasswordTitle = "Change password";
translations["zh-CN"].changePasswordHint = "请输入原密码和新密码.";
translations["en-US"].changePasswordHint = "Enter your current password and a new password.";
translations["zh-CN"].currentPasswordLabel = "原密码";
translations["en-US"].currentPasswordLabel = "Current password";
translations["zh-CN"].newPasswordLabel = "新密码";
translations["en-US"].newPasswordLabel = "New password";
translations["zh-CN"].changePasswordButton = "确认修改";
translations["en-US"].changePasswordButton = "Change password";
translations["zh-CN"].passwordChanged = "密码修改成功.";
translations["en-US"].passwordChanged = "Password changed successfully.";
translations["zh-CN"].passwordChangeError = "密码修改失败: {error}";
translations["en-US"].passwordChangeError = "Unable to change password: {error}";
let language = "en-US";
let viewBeforeSettings = "setup";
function t(key, variables = {}) {
  return Object.entries(variables).reduce((text, [name, value]) => text.replace(`{${name}}`, value), translations[language][key] || key);
}
function applyTranslations() {
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.i18nAria)); });
  elements.signModeHelp?.setAttribute("data-tooltip", t("signModeHelp"));
  elements.settingsButton?.setAttribute("aria-label", t("settingsTitle"));
  elements.settingsButton?.setAttribute("title", t("settingsTitle"));
  updateSetupAccountType();
}
const ACCOUNT_TYPES = {
  secp256k1: {
    async createAccount(privateKey) {
      const signer = new ccc.SignerCkbPrivateKey(cccClient, privateKey);
      const address = await signer.getRecommendedAddress();
      return { address };
    },
    canBroadcast: true,
  },
  shrincs: {
    createAccount(seed, publicKey) {
      if (!/^0x[0-9a-f]{64}$/.test(publicKey || "")) throw new Error(language === "zh-CN" ? "SHRINCS 公钥必须是 32 字节十六进制字符." : "SHRINCS public key must be 32-byte hexadecimal.");
      const lock = { codeHash: SHRINCS_SCRIPT.codeHash, hashType: SHRINCS_SCRIPT.hashType, args: publicKey };
      return { address: ccc.Address.fromScript(lock, cccClient).toString(), publicKey, lock };
    },
    canBroadcast: true,
  },
};

globalThis.Buffer ??= Buffer;

const elements = {
  setupView: document.querySelector("#setup-view"), createView: document.querySelector("#create-view"), importView: document.querySelector("#import-view"), unlockView: document.querySelector("#unlock-view"), settingsView: document.querySelector("#settings-view"), resetConfirmView: document.querySelector("#reset-confirm-view"), changePasswordView: document.querySelector("#change-password-view"), walletView: document.querySelector("#wallet-view"),
  privateKey: document.querySelector("#private-key"), privateKeyLabel: document.querySelector("#private-key-label"), setupAccountType: document.querySelector("#setup-account-type"), importAccountType: document.querySelector("#setup-account-type-import"), newPassword: document.querySelector("#new-password"), importPassword: document.querySelector("#new-password-import"), setupStatus: document.querySelector("#setup-status"), createStatus: document.querySelector("#create-status"), importStatus: document.querySelector("#import-status"), generationProgress: document.querySelector("#generation-progress"),
  unlockPassword: document.querySelector("#unlock-password"), unlockStatus: document.querySelector("#unlock-status"), changePasswordCurrent: document.querySelector("#change-password-current"), changePasswordNew: document.querySelector("#change-password-new"), changePasswordStatus: document.querySelector("#change-password-status"), walletStatus: document.querySelector("#wallet-status"),
  address: document.querySelector("#address"), accountType: document.querySelector("#account-type"), balance: document.querySelector("#balance"), recipient: document.querySelector("#recipient"), amount: document.querySelector("#amount"), signingProgress: document.querySelector("#signing-progress"),
  generateButton: document.querySelector("#generate-button"), showImportButton: document.querySelector("#show-import-button"), saveWalletButton: document.querySelector("#save-wallet-button"), unlockButton: document.querySelector("#unlock-button"), resetConfirmButton: document.querySelector("#reset-confirm-button"), resetCancelButton: document.querySelector("#reset-cancel-button"), changePasswordButton: document.querySelector("#change-password-button"), changePasswordCancelButton: document.querySelector("#change-password-cancel-button"),
  copyAddressButton: document.querySelector("#copy-address-button"), refreshButton: document.querySelector("#refresh-button"), transferForm: document.querySelector("#transfer-form"), sendButton: document.querySelector("#send-button"),
  newAccountButton: document.querySelector("#new-account-button"), showImportButton: document.querySelector("#show-import-button"), createBackButton: document.querySelector("#create-back-button"), importBackButton: document.querySelector("#import-back-button"),
  settingsButton: document.querySelector("#settings-button"), languageSelect: document.querySelector("#language-select"), settingsSignMode: document.querySelector("#settings-sign-mode"), signModeHelp: document.querySelector("#sign-mode-help"), statelessSigningHint: document.querySelector("#stateless-signing-hint"), importSigningHint: document.querySelector("#import-signing-hint"), settingsBackButton: document.querySelector("#settings-back-button"), exportButton: document.querySelector("#export-settings-button"), settingsLockButton: document.querySelector("#settings-lock-button"), settingsChangePasswordButton: document.querySelector("#settings-change-password-button"), deleteAccountButton: document.querySelector("#delete-account-button"), sendTab: document.querySelector("#send-tab"), historyTab: document.querySelector("#history-tab"), historyPanel: document.querySelector("#history-panel"), historyList: document.querySelector("#transaction-history"), historyEmpty: document.querySelector("#history-empty"),
};

const VIEW_NAMES = ["setup", "create", "import", "unlock", "settings", "reset-confirm", "change-password", "wallet"];

let account = null;
let privateKeyInMemory = null;
let shrincsPreparedKeyInMemory = null;
let shrincsPreparedKeyPromise = null;
let vaultEncryptionKey = null;
const shrincsInitialization = initShrincs().then(() => initThreadPool(Math.min(navigator.hardwareConcurrency || 1, 8)));
const cccClient = new ccc.ClientPublicTestnet({ url: RPC_URL });
const bytes = {
  bytify: (value) => new Uint8Array(ccc.bytesFrom(value)),
  hexify: (value) => ccc.hexFrom(value),
};

function setStatus(target, message = "", kind = "") {
  target.textContent = message;
  target.className = `status ${kind}`;
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function showView(view) {
  for (const name of VIEW_NAMES) {
    const elementName = name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) + "View";
    elements[elementName].hidden = name !== view;
  }
}

function updateSignModeOptions(accountType = account?.accountType, imported = account?.imported) {
  const isShrincs = accountType === "shrincs";
  const supportsBothModes = isShrincs && !imported;
  elements.settingsSignMode.querySelector('option[value="default"]').hidden = isShrincs;
  elements.settingsSignMode.querySelector('option[value="stateful"]').hidden = !isShrincs || Boolean(imported);
  elements.settingsSignMode.querySelector('option[value="stateless"]').hidden = !isShrincs;
  if (!isShrincs) elements.settingsSignMode.value = "default";
  elements.signModeHelp.hidden = !isShrincs;
  elements.signModeHelp.setAttribute("aria-hidden", String(!isShrincs));
  elements.statelessSigningHint.hidden = !supportsBothModes || elements.settingsSignMode.value !== "stateless";
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
  viewBeforeSettings = VIEW_NAMES.find((view) => view !== "settings" && !elements[`${view.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}View`].hidden) || "setup";
  showView("settings");
}

function normalizePrivateKey(value, accountType = DEFAULT_ACCOUNT_TYPE) {
  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  const expectedLength = accountType === "shrincs" ? 96 : 64;
  if (!new RegExp(`^[0-9a-f]{${expectedLength}}$`).test(normalized)) throw new Error(language === "zh-CN" ? `${accountType === "shrincs" ? "SHRINCS 主种子" : "私钥"}必须是 ${expectedLength} 位十六进制字符. ` : `${accountType === "shrincs" ? "SHRINCS master seed" : "Private key"} must be ${expectedLength} hexadecimal characters.`);
  return `0x${normalized}`;
}

// SHRINCS 的 48 字节主种子 = sk_seed ‖ sk_prf ‖ pk_seed, 可从 96 字节 secret key 还原.
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

async function createAccount(privateKey, accountType = DEFAULT_ACCOUNT_TYPE, publicKey) {
  return getAccountType(accountType).createAccount(privateKey, publicKey);
}

function shrincsStatefulSignatureSize(q) {
  return 16 + SHRINCS_WOTS_SIGNATURE_SIZE + Math.min(q, SHRINCS_MAX_STATEFUL_SIGNATURES - 1) * 16;
}

// 当前转账采用的 SHRINCS 签名方式.
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

function addShrincsCellDep(transaction) {
  transaction.addCellDeps(SHRINCS_SCRIPT.cellDep);
  return transaction;
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
  const cellData = bytes.bytify(input.outputData || "0x");
  hasher.update(bytes.bytify(ccc.CellOutput.from(input.cellOutput).toBytes()));
  appendUint32LE(hasher, cellData.length);
  hasher.update(cellData);
}

function appendShrincsWitnessField(hasher, field) {
  const fieldBytes = field === undefined || field === null
    ? new Uint8Array(0)
    : (() => {
      const value = bytes.bytify(field);
      const result = new Uint8Array(4 + value.length);
      new DataView(result.buffer).setUint32(0, value.length, true);
      result.set(value, 4);
      return result;
    })();
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

function sameScript(left, right) {
  return ccc.Script.from(left).eq(ccc.Script.from(right));
}

function shrincsSigningMessage(transaction, inputCells, firstIndex) {
  const firstWitness = transaction.getWitnessArgs(firstIndex);
  if (!firstWitness) throw new Error("The first SHRINCS witness must be valid WitnessArgs.");
  const hasher = new ShrincsMessageHasher();
  hasher.update(transaction.hash());
  inputCells.forEach((cell) => appendShrincsCell(hasher, cell));
  appendShrincsWitnessField(hasher, firstWitness.inputType);
  appendShrincsWitnessField(hasher, firstWitness.outputType);
  for (let witnessIndex = firstIndex + 1; witnessIndex < transaction.inputs.length; witnessIndex += 1) {
    if (sameScript(inputCells[witnessIndex].cellOutput.lock, inputCells[firstIndex].cellOutput.lock)) appendShrincsWitness(hasher, transaction.getWitness(witnessIndex));
  }
  for (let witnessIndex = transaction.inputs.length; witnessIndex < transaction.witnesses.length; witnessIndex += 1) appendShrincsWitness(hasher, transaction.getWitness(witnessIndex));
  return hasher.digestHex();
}

async function buildShrincsTransaction(recipient, amount) {
  const sender = (await ccc.Address.fromString(account.address, cccClient)).script;
  const signer = new ccc.SignerCkbScriptReadonly(cccClient, sender);
  const transaction = ccc.Transaction.from({ outputs: [{ capacity: amount, lock: recipient.script }], outputsData: ["0x"] });
  addShrincsCellDep(transaction);
  const placeholder = `0x${"00".repeat(shrincsSignaturePlaceholderSize())}`;
  const inputCells = [];
  let inputCapacity = 0n;
  for await (const cell of cccClient.findCellsByLock(sender, null, true)) {
    inputCells.push(cell);
    inputCapacity += BigInt(cell.cellOutput.capacity);
    transaction.addInput(cell);
    if (inputCapacity >= amount + MIN_TRANSFER_CKB * SHANNONS_PER_CKB) break;
  }
  if (inputCells.length === 0) throw new Error("No spendable SHRINCS cells found.");
  for (let index = 0; index < inputCells.length; index += 1) transaction.setWitness(index, index === 0 ? ccc.WitnessArgs.from({ lock: placeholder }).toBytes() : "0x");
  await transaction.completeFeeBy(signer, FEE_RATE, { shouldAddInputs: false });
  const firstIndex = inputCells.findIndex((cell) => sameScript(cell.cellOutput.lock, sender));
  transaction.setWitnessArgs(firstIndex, { lock: placeholder });
  const signature = await signShrincsMessage(shrincsSigningMessage(transaction, inputCells, firstIndex));
  transaction.setWitnessArgs(firstIndex, { lock: signature });
  return transaction;
}

function generatePrivateKey() {
  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const key = `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    try { new ccc.SignerCkbPrivateKey(cccClient, key); return key; } catch { /* Reject the invalid secp256k1 scalar edge case. */ }
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

async function encryptVaultPayload(payload, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherText = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  return { iv: encodeBase64(iv), cipherText: encodeBase64(cipherText) };
}

async function decryptVaultPayload(vault, key) {
  const plainText = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(vault.iv) }, key, decodeBase64(vault.cipherText));
  return JSON.parse(new TextDecoder().decode(plainText));
}

async function encryptPrivateKey(privateKey, password, accountType, publicKey, shrincsState, imported = false, shrincsSecretKey) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveEncryptionKey(password, salt, ["encrypt", "decrypt"]);
  const encrypted = await encryptVaultPayload({ privateKey, shrincsSecretKey }, key);
  const account = await createAccount(privateKey, accountType, publicKey);
  vaultEncryptionKey = key;
  return { version: VAULT_VERSION, salt: encodeBase64(salt), ...encrypted, accountType, publicKey: account.publicKey, address: account.address, shrincsState, imported };
}

async function persistShrincsPreparedKey(preparedKey) {
  if (!vaultEncryptionKey) throw new Error(t("notEnoughKey"));
  const { vault } = await chrome.storage.local.get("vault");
  if (!vault) throw new Error(t("missingVault"));
  const { privateKey, shrincsSecretKey } = await decryptVaultPayload(vault, vaultEncryptionKey);
  const encrypted = await encryptVaultPayload({ privateKey, shrincsSecretKey, shrincsPreparedKey: encodeBase64(preparedKey) }, vaultEncryptionKey);
  await chrome.storage.local.set({ vault: { ...vault, version: VAULT_VERSION, ...encrypted } });
}

async function decryptPrivateKey(vault, password) {
  try {
    const key = await deriveEncryptionKey(password, decodeBase64(vault.salt), ["encrypt", "decrypt"]);
    const payload = await decryptVaultPayload(vault, key);
    const accountType = vault.accountType || DEFAULT_ACCOUNT_TYPE;
    const privateKey = normalizePrivateKey(payload.privateKey, accountType);
    if (accountType === "shrincs" && !/^0x[0-9a-f]{192}$/.test(payload.shrincsSecretKey || "")) throw new Error(t("invalidShrincsKey"));
    return { privateKey, shrincsSecretKey: payload.shrincsSecretKey, shrincsPreparedKey: payload.shrincsPreparedKey ? decodeBase64(payload.shrincsPreparedKey) : null, encryptionKey: key };
  } catch { throw new Error(t("wrongPassword")); }
}

async function changeWalletPassword() {
  setStatus(elements.changePasswordStatus);
  elements.changePasswordButton.disabled = true;
  try {
    const currentPassword = elements.changePasswordCurrent.value;
    const newPassword = elements.changePasswordNew.value;
    if (newPassword.length < 8) throw new Error(t("passwordShort"));
    const { vault } = await chrome.storage.local.get("vault");
    if (!vault) throw new Error(t("missingVault"));
    const decrypted = await decryptPrivateKey(vault, currentPassword);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveEncryptionKey(newPassword, salt, ["encrypt", "decrypt"]);
    const payload = {
      privateKey: decrypted.privateKey,
      shrincsSecretKey: decrypted.shrincsSecretKey,
      shrincsPreparedKey: decrypted.shrincsPreparedKey ? encodeBase64(decrypted.shrincsPreparedKey) : undefined,
    };
    const encrypted = await encryptVaultPayload(payload, key);
    await chrome.storage.local.set({ vault: { ...vault, version: VAULT_VERSION, salt: encodeBase64(salt), ...encrypted } });
    vaultEncryptionKey = key;
    elements.changePasswordCurrent.value = "";
    elements.changePasswordNew.value = "";
    setStatus(elements.changePasswordStatus, t("passwordChanged"), "success");
  } catch (error) {
    setStatus(elements.changePasswordStatus, t("passwordChangeError", { error: error.message }), "error");
  } finally {
    elements.changePasswordButton.disabled = false;
  }
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
    const { script } = await ccc.Address.fromString(account.address, cccClient);
    const capacity = BigInt((await cccClient.getBalance([script])).toString());
    elements.balance.innerHTML = `${formatCkb(capacity)} <small>CKB</small>`;
    setStatus(elements.walletStatus, t("balanceUpdated"), "success");
  } catch (error) {
    setStatus(elements.walletStatus, t("balanceError", { error: error.message }), "error");
  } finally { elements.refreshButton.disabled = false; }
}

// 进入钱包视图(生成/导入后直接进入, 或解锁后进入). privateKey 为内存中用于签名的密钥.
async function enterWallet({ accountType, privateKey, publicKey, shrincsState, imported, expectedAddress }) {
  const restoredAccount = await createAccount(privateKey, accountType, publicKey);
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
    const recipientAddress = await ccc.Address.fromString(recipient, cccClient);
    const amount = parseCkbAmount(elements.amount.value);
    let sealed;
    if (account.accountType === "shrincs") {
      sealed = await buildShrincsTransaction(recipientAddress, amount);
    } else {
      const signer = new ccc.SignerCkbPrivateKey(cccClient, privateKeyInMemory);
      const transaction = ccc.Transaction.from({ outputs: [{ capacity: amount, lock: recipientAddress.script }], outputsData: ["0x"] });
      await transaction.completeFeeBy(signer, FEE_RATE);
      sealed = await signer.signTransaction(transaction);
    }
    transactionSigned = true;
    setStatus(elements.walletStatus, t("broadcasting"));
    const transactionHash = await cccClient.sendTransaction(sealed);
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
  const password = window.prompt(language === "zh-CN" ? "请输入钱包密码以确认导出: " : "Enter your wallet password to confirm export:");
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
  elements.privateKeyLabel.textContent = isShrincs ? (language === "zh-CN" ? "SHRINCS 主种子(48 字节十六进制)" : "SHRINCS master seed (48-byte hex)") : t("privateKeyLabel");
  elements.importAccountType.value = elements.setupAccountType.value;
  elements.importSigningHint.hidden = elements.importAccountType.value !== "shrincs";
}

function renderTransactionHistory(records) {
  elements.historyList.replaceChildren(...records.map((record) => {
    const item = document.createElement("li");
    item.className = "history-item";
    const statusLabel = record.status === "completed" ? t("historySuccess") : t("historyPending");
    item.innerHTML = `<div class="row"><strong>${statusLabel}</strong><span class="history-meta">${new Date(record.time).toLocaleString(language)}</span></div><div class="row history-meta"><span>${t("historyAmount")}: ${record.amount} CKB</span></div>`;
    const hash = document.createElement("code");
    hash.className = "transaction-hash";
    hash.textContent = record.hash;
    const explorerLink = document.createElement("a");
    explorerLink.className = "tx-link";
    explorerLink.href = `https://pudge.explorer.nervos.org/transaction/${encodeURIComponent(record.hash)}`;
    explorerLink.target = "_blank";
    explorerLink.rel = "noreferrer";
    explorerLink.textContent = "↗";
    explorerLink.title = t("explorerLink");
    explorerLink.setAttribute("aria-label", t("explorerLink"));
    item.lastElementChild.append(explorerLink);
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
        const transaction = await cccClient.getTransaction(record.hash);
        const transactionStatus = transaction?.status;
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
  elements.sendTab.setAttribute("aria-selected", String(!history));
  elements.historyTab.setAttribute("aria-selected", String(history));
  if (history) loadTransactionHistory();
}

elements.generateButton.addEventListener("click", generateWallet);
elements.newAccountButton.addEventListener("click", () => showView("create"));
elements.showImportButton.addEventListener("click", () => showView("import"));
elements.createBackButton.addEventListener("click", () => showView("setup"));
elements.importBackButton.addEventListener("click", () => showView("setup"));
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
elements.exportButton.addEventListener("click", () => exportWallet().catch((error) => setStatus(elements.walletStatus, t("exportError", { error: error.message }), "error")));
elements.settingsButton.addEventListener("click", openSettings);
elements.settingsBackButton.addEventListener("click", () => showView(viewBeforeSettings));
elements.settingsLockButton.addEventListener("click", lockWallet);
elements.settingsChangePasswordButton.addEventListener("click", () => showView("change-password"));
elements.changePasswordCancelButton.addEventListener("click", () => showView("settings"));
elements.deleteAccountButton.addEventListener("click", () => showView("reset-confirm"));
elements.resetCancelButton.addEventListener("click", () => showView("settings"));
elements.settingsSignMode.addEventListener("change", () => {
  if (account?.accountType !== "shrincs") return;
  if (account.imported) {
    elements.settingsSignMode.value = "stateless";
    account.shrincsState.mode = "stateless";
    updateSignModeOptions(account.accountType, account.imported);
    return;
  }
  account.shrincsState.mode = elements.settingsSignMode.value;
  updateSignModeOptions(account.accountType, account.imported);
});
elements.changePasswordButton.addEventListener("click", changeWalletPassword);
elements.sendTab.addEventListener("click", () => showWalletPanel("send"));
elements.historyTab.addEventListener("click", () => showWalletPanel("history"));
elements.languageSelect.addEventListener("change", async () => {
  language = elements.languageSelect.value;
  await chrome.storage.local.set({ language });
  applyTranslations();
});
elements.resetConfirmButton.addEventListener("click", async () => {
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
