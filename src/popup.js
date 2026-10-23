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
} from "../shrincs-wasm/pkg/shrincs.js";


let config = {
  current: {},
  develop: {
    hrp: "ckt",
    rpc: "http://127.0.0.1:8114",
    script: {
      dao: {
        codeHash: "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
        hashType: "type",
        cellDep: {
          outPoint: {
            txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            index: "0x2",
          },
          depType: "code",
        }
      },
      secp256k1: {
        codeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
        hashType: "type",
        cellDep: {
          outPoint: { txHash: "0x0000000000000000000000000000000000000000000000000000000000000000", index: "0x0" },
          depType: "depGroup",
        }
      },
      shrincs: {
        codeHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        hashType: "type",
        cellDep: {
          outPoint: { txHash: "0x0000000000000000000000000000000000000000000000000000000000000000", index: "0x0" },
          depType: "code",
        },
      }
    }
  },
  mainnet: {
    hrp: "ckb",
    rpc: "https://mainnet.ckbapp.dev",
    script: {
      dao: {
        codeHash: "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
        hashType: "type",
        cellDep: {
          outPoint: {
            txHash: "0xe2fb199810d49a4d8beec56718ba2593b665db9d52299a0f9e6e75416d73ff5c",
            index: "0x2",
          },
          depType: "code",
        }
      },
      secp256k1: {
        codeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
        hashType: "type",
        cellDep: {
          outPoint: { txHash: "0x71a7ba8fc96349fea0ed3a5c47992e3b4084b031a42264a018e0072e8172e46c", index: "0x0" },
          depType: "depGroup",
        }
      },
      shrincs: {
        codeHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        hashType: "type",
        cellDep: {
          outPoint: { txHash: "0x0000000000000000000000000000000000000000000000000000000000000000", index: "0x0" },
          depType: "code",
        },
      }
    }
  },
  testnet: {
    hrp: "ckt",
    rpc: "https://testnet.ckbapp.dev",
    script: {
      dao: {
        codeHash: "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
        hashType: "type",
        cellDep: {
          outPoint: {
            txHash: "0x8f8c79eb6671709633fe6a46de93c0fedc9c1b8a6527a18d3983879542635c9f",
            index: "0x2",
          },
          depType: "code",
        }
      },
      secp256k1: {
        codeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
        hashType: "type",
        cellDep: {
          outPoint: { txHash: "0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37", index: "0x0" },
          depType: "depGroup",
        }
      },
      shrincs: {
        codeHash: "0x387496fafe46562bb3bb2fa4446f1fc1054ba2f1b4df229a88056d5422a196ac",
        hashType: "type",
        cellDep: {
          outPoint: { txHash: "0x3216d00b72e8229d7dbb46a93ea47bd0c650f2bdae42be2f92837328413da48e", index: "0x0" },
          depType: "code",
        },
      }
    }
  },
  switchDevelop: async function () {
    const httpret = await fetch(config.develop.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "get_block_by_number", params: ["0x0"] }),
    });
    const payload = await httpret.json();
    if (!httpret.ok || payload.error) {
      throw new Error(payload.error?.message);
    }
    config.develop.script.dao.cellDep.outPoint.txHash = payload.result?.transactions?.[0]?.hash;
    config.develop.script.secp256k1.cellDep.outPoint.txHash = payload.result?.transactions?.[1]?.hash;
    config.current = config.develop;
  },
  switchMainnet: async function () {
    config.current = config.mainnet;
  },
  switchTestnet: async function () {
    config.current = config.testnet;
  },
}
await config.switchTestnet();

let client = new ccc.ClientPublicTestnet({ url: config.testnet.rpc });
client.switchCurrent = async function () {
  scripts = structuredClone(client.scripts);
  scripts.Dao = {
    ...scripts.Dao,
    codeHash: config.develop.script.dao.codeHash,
    hashType: config.develop.script.dao.hashType,
    cellDeps: [{ cellDep: config.develop.script.dao.cellDep }],
  };
  scripts.Secp256k1Blake160 = {
    ...scripts.Secp256k1Blake160,
    codeHash: config.develop.script.secp256k1.codeHash,
    hashType: config.develop.script.secp256k1.hashType,
    cellDeps: [{ cellDep: config.develop.script.secp256k1.cellDep }],
  };
  client = new ccc.ClientPublicTestnet({ url: config.develop.rpc, scripts: scripts });
};


const SHANNONS_PER_CKB = 100000000n;
const MIN_TRANSFER_CKB = 61n;
const FEE_RATE = 1000n;
const DEFAULT_ACCOUNT_TYPE = "secp256k1";
const VAULT_VERSION = 6;
const LOGIN_SESSION_KEY = "walletLoginSession";
const LOGIN_SESSION_TTL = 60 * 60 * 1000;
const SHRINCS_MAX_STATEFUL_SIGNATURES = 142;
const SHRINCS_WOTS_SIGNATURE_SIZE = 292;
const SHRINCS_STATELESS_SIGNATURE_SIZE = 2568;
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
translations["zh-CN"].privateKeyName = "私钥";
translations["en-US"].privateKeyName = "Private key";
translations["zh-CN"].passwordLabel = "保护密码";
translations["en-US"].passwordLabel = "Protection password";
translations["zh-CN"].passwordPlaceholder = "至少 8 位";
translations["en-US"].passwordPlaceholder = "At least 8 characters";
translations["zh-CN"].welcomeTitle = "欢迎使用";
translations["en-US"].welcomeTitle = "Welcome";
translations["zh-CN"].welcomeHint = "欢迎使用 CKB 钱包. 设置密码后即可开始使用.";
translations["en-US"].welcomeHint = "Welcome to your CKB wallet. Set a password to get started.";
translations["zh-CN"].startButton = "开始使用";
translations["en-US"].startButton = "Get started";
translations["zh-CN"].setPasswordTitle = "设置钱包密码";
translations["en-US"].setPasswordTitle = "Set wallet password";
translations["zh-CN"].setPasswordHint = "此密码用于保护钱包, 且无法找回.";
translations["en-US"].setPasswordHint = "This password protects your wallet and cannot be recovered.";
translations["zh-CN"].confirmPasswordLabel = "再次输入密码";
translations["en-US"].confirmPasswordLabel = "Confirm password";
translations["zh-CN"].confirmButton = "确定";
translations["en-US"].confirmButton = "Confirm";
translations["zh-CN"].passwordMismatch = "两次输入的密码不一致.";
translations["en-US"].passwordMismatch = "The passwords do not match.";
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
translations["zh-CN"].networkLabel = "网络";
translations["en-US"].networkLabel = "Network";
translations["zh-CN"].switchNetworkButton = "切换网络";
translations["en-US"].switchNetworkButton = "Switch network";
translations["zh-CN"].networkSettingsTitle = "切换网络";
translations["en-US"].networkSettingsTitle = "Switch network";
translations["zh-CN"].testnetOption = "测试网";
translations["en-US"].testnetOption = "Testnet";
translations["zh-CN"].mainnetOption = "主网";
translations["en-US"].mainnetOption = "Mainnet";
translations["zh-CN"].shrincsTestnetOnly = "SHRINCS 仅支持测试网, 主网和本地开发网请使用 secp256k1 账户.";
translations["en-US"].shrincsTestnetOnly = "SHRINCS is only supported on Testnet. Use a secp256k1 account on Mainnet or local Devnet.";
translations["zh-CN"].devnetOption = "开发网";
translations["en-US"].devnetOption = "Develop";
translations["zh-CN"].rpcUrlLabel = "RPC 地址";
translations["en-US"].rpcUrlLabel = "RPC URL";
translations["zh-CN"].applyNetworkButton = "应用网络";
translations["en-US"].applyNetworkButton = "Apply network";
translations["zh-CN"].networkChanged = "网络已切换";
translations["en-US"].networkChanged = "Network switched";
translations["zh-CN"].networkChangeError = "网络切换失败: {error}";
translations["en-US"].networkChangeError = "Unable to switch network: {error}";
translations["zh-CN"].networkPermissionDenied = "未授予该 RPC 地址的访问权限.";
translations["en-US"].networkPermissionDenied = "Permission for this RPC origin was not granted.";
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
translations["zh-CN"].recipientLabel = "收款地址";
translations["en-US"].recipientLabel = "Recipient address";
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
translations["zh-CN"].invalidPrivateKey = "{keyType}必须是 {length} 位十六进制字符.";
translations["en-US"].invalidPrivateKey = "{keyType} must be {length} hexadecimal characters.";
translations["zh-CN"].shrincsMasterSeedLabel = "SHRINCS 主种子(48 字节十六进制)";
translations["en-US"].shrincsMasterSeedLabel = "SHRINCS master seed (48-byte hex)";
translations["zh-CN"].shrincsMasterSeedName = "SHRINCS 主种子";
translations["en-US"].shrincsMasterSeedName = "SHRINCS master seed";
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
translations["zh-CN"].passwordSaved = "密码已保存, 请选择账户操作.";
translations["en-US"].passwordSaved = "Password saved. Choose an account action.";
translations["zh-CN"].balanceQuery = "正在查询余额...";
translations["en-US"].balanceQuery = "Querying balance...";
translations["zh-CN"].balanceUpdated = "余额已更新.";
translations["en-US"].balanceUpdated = "Balance updated.";
translations["zh-CN"].balanceError = "无法查询余额: {error}";
translations["en-US"].balanceError = "Unable to query balance: {error}";
translations["zh-CN"].daoTab = "Nervos DAO";
translations["en-US"].daoTab = "Nervos DAO";
translations["zh-CN"].daoTitle = "Nervos DAO";
translations["en-US"].daoTitle = "Nervos DAO";
translations["zh-CN"].daoHint = "存款可获得二级发行收益。取款需先预取款，再等待 180 个 epoch 的锁定期。";
translations["en-US"].daoHint = "Deposits earn secondary issuance. Withdrawal requires a preparation transaction and a 180-epoch lock period.";
translations["zh-CN"].daoBalanceLabel = "DAO 容量";
translations["en-US"].daoBalanceLabel = "DAO capacity";
translations["zh-CN"].daoDepositTitle = "存入 DAO";
translations["en-US"].daoDepositTitle = "Deposit into DAO";
translations["zh-CN"].daoAmountLabel = "金额 (CKB)";
translations["en-US"].daoAmountLabel = "Amount (CKB)";
translations["zh-CN"].daoAmountPlaceholder = "至少满足 cell 占用容量";
translations["en-US"].daoAmountPlaceholder = "At least the occupied capacity";
translations["zh-CN"].daoDepositButton = "存款";
translations["en-US"].daoDepositButton = "Deposit";
translations["zh-CN"].daoCellsTitle = "DAO cells";
translations["en-US"].daoCellsTitle = "DAO cells";
translations["zh-CN"].daoRefreshButton = "刷新";
translations["en-US"].daoRefreshButton = "Refresh";
translations["zh-CN"].daoEmpty = "当前钱包没有 DAO cell。";
translations["en-US"].daoEmpty = "This wallet has no DAO cells.";
translations["zh-CN"].daoDepositCell = "存款中";
translations["en-US"].daoDepositCell = "Deposited";
translations["zh-CN"].daoWithdrawingCell = "预取款中";
translations["en-US"].daoWithdrawingCell = "Withdrawing";
translations["zh-CN"].daoCountdown = "约 {days} 天 {hours} 小时后可取款";
translations["en-US"].daoCountdown = "Estimated {days}d {hours}h until withdrawal";
translations["zh-CN"].daoCountdownReady = "已到可取款时间";
translations["en-US"].daoCountdownReady = "Withdrawal is available";
translations["zh-CN"].daoCountdownWaiting = "预计时间已到，等待链上 epoch 确认";
translations["en-US"].daoCountdownWaiting = "Estimated time reached; waiting for the on-chain epoch";
translations["zh-CN"].daoCountdownPending = "等待预取款交易确认后计算倒计时";
translations["en-US"].daoCountdownPending = "Countdown starts when the preparation transaction is confirmed";
translations["zh-CN"].daoCountdownLoading = "正在计算可取款时间...";
translations["en-US"].daoCountdownLoading = "Calculating withdrawal time...";
translations["zh-CN"].daoCountdownError = "暂时无法计算倒计时，请刷新重试";
translations["en-US"].daoCountdownError = "Countdown unavailable; refresh to retry";
translations["zh-CN"].daoTipRefreshError = "无法更新链上 epoch: {error}";
translations["en-US"].daoTipRefreshError = "Unable to refresh the on-chain epoch: {error}";
translations["zh-CN"].daoPrepareButton = "预取款";
translations["en-US"].daoPrepareButton = "Prepare withdrawal";
translations["zh-CN"].daoWithdrawButton = "取款";
translations["en-US"].daoWithdrawButton = "Withdraw";
translations["zh-CN"].daoLoading = "正在查询 DAO cells...";
translations["en-US"].daoLoading = "Querying DAO cells...";
translations["zh-CN"].daoLoadError = "无法查询 DAO cells: {error}";
translations["en-US"].daoLoadError = "Unable to query DAO cells: {error}";
translations["zh-CN"].daoDepositMinimum = "存款金额必须至少为 {capacity} CKB，以满足该 cell 的占用容量。";
translations["en-US"].daoDepositMinimum = "Deposit must be at least {capacity} CKB to cover this cell's occupied capacity.";
translations["zh-CN"].daoNotReady = "尚未达到可取款 epoch {epoch}。";
translations["en-US"].daoNotReady = "Withdrawal is not available until epoch {epoch}.";
translations["zh-CN"].daoInvalidCell = "所选 cell 不是有效的 DAO 存款或预取款 cell。";
translations["en-US"].daoInvalidCell = "The selected cell is not a valid DAO deposit or withdrawal cell.";
translations["zh-CN"].daoCellSpent = "此 DAO cell 已被花费，请刷新列表。";
translations["en-US"].daoCellSpent = "This DAO cell has already been spent. Refresh the list.";
translations["zh-CN"].daoActionError = "DAO 操作失败: {error}";
translations["en-US"].daoActionError = "DAO operation failed: {error}";
translations["zh-CN"].daoBroadcasting = "正在广播 DAO 交易...";
translations["en-US"].daoBroadcasting = "Broadcasting DAO transaction...";
translations["zh-CN"].daoDepositSuccess = "DAO 存款交易已广播. 交易哈希: ";
translations["en-US"].daoDepositSuccess = "DAO deposit broadcast. Transaction hash:";
translations["zh-CN"].daoPrepareSuccess = "DAO 预取款交易已广播. 交易哈希: ";
translations["en-US"].daoPrepareSuccess = "DAO withdrawal preparation broadcast. Transaction hash:";
translations["zh-CN"].daoWithdrawSuccess = "DAO 取款交易已广播. 交易哈希: ";
translations["en-US"].daoWithdrawSuccess = "DAO withdrawal broadcast. Transaction hash:";
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
translations["zh-CN"].invalidAddress = "请输入当前网络的 CKB 地址.";
translations["en-US"].invalidAddress = "Enter a CKB address for the current network.";
translations["zh-CN"].invalidShrincsPublicKey = "SHRINCS 公钥必须是 32 字节十六进制字符.";
translations["en-US"].invalidShrincsPublicKey = "SHRINCS public key must be 32-byte hexadecimal.";
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
translations["zh-CN"].signModeHelp = "导入的 SHRINCS 账户不能使用有状态签名, 以避免签名状态在多台设备之间不同步而带来安全风险。新生成的账户应优先使用有状态签名, 因为签名更小、手续费更低。";
translations["en-US"].signModeHelp = "Imported SHRINCS accounts cannot use stateful signing, because an unsynchronized state across devices could create a security risk. For newly generated accounts, stateful signing is preferred because its signatures are smaller and fees are lower.";
translations["zh-CN"].shrincsImportSigningHint = "SHRINCS 导入账户已禁用 stateful 签名, 只能使用 stateless 签名.";
translations["en-US"].shrincsImportSigningHint = "Stateful signing is disabled for imported SHRINCS accounts; only stateless signing is available.";
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
translations["zh-CN"].historyTransfer = "转账";
translations["en-US"].historyTransfer = "Transfer";
translations["zh-CN"].historyDaoDeposit = "DAO 存款";
translations["en-US"].historyDaoDeposit = "DAO deposit";
translations["zh-CN"].historyDaoPrepare = "DAO 预取款";
translations["en-US"].historyDaoPrepare = "DAO withdrawal preparation";
translations["zh-CN"].historyDaoWithdraw = "DAO 取款";
translations["en-US"].historyDaoWithdraw = "DAO withdrawal";
translations["zh-CN"].defaultOption = "默认";
translations["en-US"].defaultOption = "Default";
translations["zh-CN"].deleteAccountTitle = "删除账户";
translations["en-US"].deleteAccountTitle = "Delete account";
translations["zh-CN"].deleteAccountHint = "删除本地保存的账户和私钥. 此操作无法撤销.";
translations["en-US"].deleteAccountHint = "Delete the locally stored account and private key. This cannot be undone.";
translations["zh-CN"].deleteAccountConfirm = "确认删除账户";
translations["en-US"].deleteAccountConfirm = "Delete account";
translations["zh-CN"].createAccountButton = "创建账户";
translations["en-US"].createAccountButton = "Create account";
translations["zh-CN"].switchAccountTitle = "切换账户";
translations["en-US"].switchAccountTitle = "Switch account";
translations["zh-CN"].switchAccountButton = "切换账户";
translations["en-US"].switchAccountButton = "Switch";
translations["zh-CN"].accountListEmpty = "暂无其他账户.";
translations["en-US"].accountListEmpty = "No other accounts.";
translations["zh-CN"].accountSwitchError = "切换账户失败: {error}";
translations["en-US"].accountSwitchError = "Unable to switch account: {error}";
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
translations["zh-CN"].providerConfirmTitle = "确认网页请求";
translations["en-US"].providerConfirmTitle = "Confirm wallet request";
translations["zh-CN"].providerConfirmHint = "请检查请求内容, 确认后钱包才会签名.";
translations["en-US"].providerConfirmHint = "Review this request before the wallet signs anything.";
translations["zh-CN"].providerOriginLabel = "网站";
translations["en-US"].providerOriginLabel = "Website";
translations["zh-CN"].providerFromLabel = "发送账户";
translations["en-US"].providerFromLabel = "From";
translations["zh-CN"].providerToLabel = "接收账户";
translations["en-US"].providerToLabel = "To";
translations["zh-CN"].providerAmountLabel = "金额";
translations["en-US"].providerAmountLabel = "Amount";
translations["zh-CN"].providerSummaryLabel = "资产变化";
translations["en-US"].providerSummaryLabel = "Asset movement";
translations["zh-CN"].providerAddressLabel = "地址";
translations["en-US"].providerAddressLabel = "Address";
translations["zh-CN"].providerNetChangeLabel = "净变化";
translations["en-US"].providerNetChangeLabel = "Net change";
translations["zh-CN"].providerRejectButton = "拒绝";
translations["en-US"].providerRejectButton = "Reject";
translations["zh-CN"].providerConfirmButton = "确认并签名";
translations["en-US"].providerConfirmButton = "Confirm and sign";
translations["zh-CN"].providerRequestError = "签名请求失败: {error}";
translations["en-US"].providerRequestError = "Signing request failed: {error}";
translations["zh-CN"].providerNoOwnedInput = "交易不包含当前钱包账户的输入, 无法签名.";
translations["en-US"].providerNoOwnedInput = "The transaction has no input owned by the active wallet.";
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
  elements.recipient.placeholder = `${config.current.hrp}1...`;
  updateSetupAccountType();
}
const ACCOUNT_TYPES = {
  secp256k1: {
    async createAccount(privateKey) {
      const signer = new ccc.SignerCkbPrivateKey(client, privateKey);
      const address = await signer.getRecommendedAddress();
      return { address };
    },
  },
  shrincs: {
    createAccount(seed, publicKey) {
      if (config.current !== config.testnet) throw new Error(t("shrincsTestnetOnly"));
      if (!/^0x[0-9a-f]{64}$/.test(publicKey || "")) throw new Error(t("invalidShrincsPublicKey"));
      const { codeHash, hashType } = config.current.script.shrincs;
      const lock = { codeHash, hashType, args: publicKey };
      return { address: ccc.Address.fromScript(lock, client).toString(), publicKey, lock };
    },
  },
};

globalThis.Buffer ??= Buffer;

const elements = {
  networkView: document.querySelector("#network-view"), networkBadge: document.querySelector("#network-badge"), networkSettingsButton: document.querySelector("#network-settings-button"), networkBackButton: document.querySelector("#network-back-button"), networkSelect: document.querySelector("#network-select"), devnetRpcField: document.querySelector("#devnet-rpc-field"), devnetRpcUrl: document.querySelector("#devnet-rpc-url"), networkApplyButton: document.querySelector("#network-apply-button"), networkStatus: document.querySelector("#network-status"),
  setupView: document.querySelector("#setup-view"), setupBackButton: document.querySelector("#setup-back-button"), welcomeView: document.querySelector("#welcome-view"), setPasswordView: document.querySelector("#set-password-view"), createView: document.querySelector("#create-view"), importView: document.querySelector("#import-view"), unlockView: document.querySelector("#unlock-view"), settingsView: document.querySelector("#settings-view"), resetConfirmView: document.querySelector("#reset-confirm-view"), switchAccountView: document.querySelector("#switch-account-view"), changePasswordView: document.querySelector("#change-password-view"), walletView: document.querySelector("#wallet-view"),
  privateKey: document.querySelector("#private-key"), privateKeyLabel: document.querySelector("#private-key-label"), setupAccountType: document.querySelector("#setup-account-type"), importAccountType: document.querySelector("#setup-account-type-import"), setupPassword: document.querySelector("#setup-password"), setupPasswordConfirm: document.querySelector("#setup-password-confirm"), setupPasswordStatus: document.querySelector("#set-password-status"), setupStatus: document.querySelector("#setup-status"), createStatus: document.querySelector("#create-status"), importStatus: document.querySelector("#import-status"), importProgress: document.querySelector("#import-progress"), generationProgress: document.querySelector("#generation-progress"),
  unlockPassword: document.querySelector("#unlock-password"), unlockStatus: document.querySelector("#unlock-status"), changePasswordCurrent: document.querySelector("#change-password-current"), changePasswordNew: document.querySelector("#change-password-new"), changePasswordStatus: document.querySelector("#change-password-status"), walletStatus: document.querySelector("#wallet-status"),
  address: document.querySelector("#address"), accountType: document.querySelector("#account-type"), balance: document.querySelector("#balance"), recipient: document.querySelector("#recipient"), amount: document.querySelector("#amount"), signingProgress: document.querySelector("#signing-progress"), providerConfirmView: document.querySelector("#provider-confirm-view"), providerRequestOrigin: document.querySelector("#provider-request-origin"), providerRequestSummary: document.querySelector("#provider-request-summary"), providerConfirmButton: document.querySelector("#provider-confirm-button"), providerRejectButton: document.querySelector("#provider-reject-button"), providerConfirmStatus: document.querySelector("#provider-confirm-status"),
  generateButton: document.querySelector("#generate-button"), saveWalletButton: document.querySelector("#save-wallet-button"), unlockButton: document.querySelector("#unlock-button"), resetConfirmButton: document.querySelector("#reset-confirm-button"), resetCancelButton: document.querySelector("#reset-cancel-button"), changePasswordButton: document.querySelector("#change-password-button"), changePasswordCancelButton: document.querySelector("#change-password-cancel-button"),
  copyAddressButton: document.querySelector("#copy-address-button"), refreshButton: document.querySelector("#refresh-button"), transferForm: document.querySelector("#transfer-form"), sendButton: document.querySelector("#send-button"), daoTab: document.querySelector("#dao-tab"), daoPanel: document.querySelector("#dao-panel"), daoRefreshButton: document.querySelector("#dao-refresh-button"), daoDepositForm: document.querySelector("#dao-deposit-form"), daoAmount: document.querySelector("#dao-amount"), daoDepositButton: document.querySelector("#dao-deposit-button"), daoCells: document.querySelector("#dao-cells"), daoBalance: document.querySelector("#dao-balance"), daoListStatus: document.querySelector("#dao-list-status"), daoStatus: document.querySelector("#dao-status"),
  newAccountButton: document.querySelector("#new-account-button"), showImportButton: document.querySelector("#show-import-button"), welcomeStartButton: document.querySelector("#welcome-start-button"), setPasswordBackButton: document.querySelector("#set-password-back-button"), setPasswordButton: document.querySelector("#set-password-button"), createBackButton: document.querySelector("#create-back-button"), importBackButton: document.querySelector("#import-back-button"),
  settingsButton: document.querySelector("#settings-button"), languageSelect: document.querySelector("#language-select"), settingsSignMode: document.querySelector("#settings-sign-mode"), signModeHelp: document.querySelector("#sign-mode-help"), importSigningHint: document.querySelector("#import-signing-hint"), settingsBackButton: document.querySelector("#settings-back-button"), exportButton: document.querySelector("#export-settings-button"), settingsLockButton: document.querySelector("#settings-lock-button"), settingsCreateAccountButton: document.querySelector("#settings-create-account-button"), settingsChangePasswordButton: document.querySelector("#settings-change-password-button"), deleteAccountButton: document.querySelector("#delete-account-button"), switchAccountButton: document.querySelector("#switch-account-button"), switchAccountBackButton: document.querySelector("#switch-account-back-button"), accountList: document.querySelector("#account-list"), accountListStatus: document.querySelector("#account-list-status"), sendTab: document.querySelector("#send-tab"), historyTab: document.querySelector("#history-tab"), historyPanel: document.querySelector("#history-panel"), historyList: document.querySelector("#transaction-history"), historyEmpty: document.querySelector("#history-empty"),
};

const VIEW_NAMES = ["setup", "welcome", "set-password", "create", "import", "unlock", "provider-confirm", "settings", "network", "reset-confirm", "switch-account", "change-password", "wallet"];

let account = null;
let privateKeyInMemory = null;
let shrincsPreparedKeyInMemory = null;
let shrincsPreparedKeyPromise = null;
let vaultEncryptionKey = null;
let walletPassword = null;
let accountCreationReturnView = "setup";
let providerRequestId = new URLSearchParams(location.search).get("providerRequest");
let providerRequest = null;
let providerSummaryContext = null;
let walletOperationInProgress = false;
let walletLockVersion = 0;
let daoCells = [];
let daoCountdowns = new Map();
let daoTipHeader = null;
let daoTipFetchedAt = 0;
let daoCountdownTimer = null;
let daoLoadInProgress = false;
const shrincsInitialization = initShrincs().then(() => initThreadPool(Math.min(navigator.hardwareConcurrency || 1, 8)));
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

function updateNetworkForm() {
  elements.devnetRpcField.hidden = elements.networkSelect.value !== "devnet";
}

function updateNetworkBadge(network) {
  elements.networkBadge.textContent = network.toUpperCase();
}

function getDevnetRpcPermissionPattern(rpc) {
  const url = new URL(rpc);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new Error("Enter a valid HTTP or HTTPS RPC URL without credentials.");
  }
  return `${url.origin}/*`;
}

async function applyNetworkSelection({ requestPermission = true, persist = true } = {}) {
  if (walletOperationInProgress || providerRequest) throw new Error("Finish or reject the signing request before switching networks.");
  const networkName = elements.networkSelect.value;
  const previousClient = client;
  const previousNetwork = config.current;
  const previousDevnetRpc = config.develop.rpc;
  const previousDaoTxHash = config.develop.script.dao.cellDep.outPoint.txHash;
  const previousSecpTxHash = config.develop.script.secp256k1.cellDep.outPoint.txHash;
  let nextClient;

  try {
    if (networkName !== "testnet" && account?.accountType === "shrincs") {
      throw new Error(t("shrincsTestnetOnly"));
    }
    if (networkName === "mainnet") {
      await config.switchMainnet();
      nextClient = new ccc.ClientPublicMainnet({ url: config.mainnet.rpc });
    } else if (networkName === "testnet") {
      await config.switchTestnet();
      nextClient = new ccc.ClientPublicTestnet({ url: config.testnet.rpc });
    } else {
      const rpc = elements.devnetRpcUrl.value.trim();
      const originPattern = getDevnetRpcPermissionPattern(rpc);
      const originPermission = { origins: [originPattern] };
      const permitted = requestPermission
        ? await chrome.permissions.request(originPermission)
        : await chrome.permissions.contains(originPermission);
      if (!permitted) throw new Error(t("networkPermissionDenied"));

      config.develop.rpc = rpc;
      await config.switchDevelop();
      const daoTxHash = config.develop.script.dao.cellDep.outPoint.txHash;
      const secpTxHash = config.develop.script.secp256k1.cellDep.outPoint.txHash;
      const validHash = (hash) => typeof hash === "string" && /^0x[0-9a-f]{64}$/i.test(hash);
      if (!validHash(daoTxHash) || !validHash(secpTxHash)) {
        throw new Error("The Devnet RPC returned invalid genesis dependency hashes.");
      }

      const scripts = structuredClone(new ccc.ClientPublicTestnet().scripts);
      scripts.Dao = {
        ...scripts.Dao,
        codeHash: config.develop.script.dao.codeHash,
        hashType: config.develop.script.dao.hashType,
        cellDeps: [{ cellDep: config.develop.script.dao.cellDep }],
      };
      scripts.Secp256k1Blake160 = {
        ...scripts.Secp256k1Blake160,
        codeHash: config.develop.script.secp256k1.codeHash,
        hashType: config.develop.script.secp256k1.hashType,
        cellDeps: [{ cellDep: config.develop.script.secp256k1.cellDep }],
      };
      nextClient = new ccc.ClientPublicTestnet({ url: rpc, scripts });
    }

    client = nextClient;
    const nextAccount = account ? await createAccount(privateKeyInMemory, account.accountType, account.publicKey) : null;
    if (persist) {
      const { vault } = await chrome.storage.local.get("vault");
      await chrome.storage.local.set({ selectedNetwork: networkName, devnetRpc: elements.devnetRpcUrl.value.trim(), providerAddress: nextAccount?.address || null, providerAddressAccount: vault?.address || null });
    }
    if (nextAccount) {
      Object.assign(account, nextAccount);
      elements.address.textContent = account.address;
      elements.balance.textContent = "-- CKB";
      elements.recipient.value = "";
      elements.historyList.replaceChildren();
      refreshBalance();
    }
    updateSetupAccountType();
    elements.recipient.placeholder = `${config.current.hrp}1...`;
    updateNetworkBadge(networkName);
    setStatus(elements.networkStatus, t("networkChanged"), "success");
  } catch (error) {
    client = previousClient;
    config.current = previousNetwork;
    config.develop.rpc = previousDevnetRpc;
    config.develop.script.dao.cellDep.outPoint.txHash = previousDaoTxHash;
    config.develop.script.secp256k1.cellDep.outPoint.txHash = previousSecpTxHash;
    throw error;
  }
}

async function restoreNetworkPreference() {
  const { selectedNetwork, devnetRpc } = await chrome.storage.local.get(["selectedNetwork", "devnetRpc"]);
  elements.devnetRpcUrl.value = typeof devnetRpc === "string" && devnetRpc ? devnetRpc : config.develop.rpc;
  elements.networkSelect.value = ["devnet", "mainnet"].includes(selectedNetwork) ? selectedNetwork : "testnet";
  updateNetworkForm();
  if (selectedNetwork === "mainnet") {
    await applyNetworkSelection({ requestPermission: false, persist: false });
    return;
  }
  if (selectedNetwork !== "devnet") {
    updateNetworkBadge("testnet");
    return;
  }

  try {
    const originPattern = getDevnetRpcPermissionPattern(elements.devnetRpcUrl.value.trim());
    const permitted = await chrome.permissions.contains({ origins: [originPattern] });
    if (!permitted) throw new Error("Devnet RPC origin permission is not available.");
    await applyNetworkSelection({ requestPermission: false, persist: false });
  } catch {
    elements.networkSelect.value = "testnet";
    updateNetworkForm();
    updateNetworkBadge("testnet");
  }
}

function updateSignModeOptions(accountType = account?.accountType, imported = account?.imported) {
  const isShrincs = accountType === "shrincs";
  elements.settingsSignMode.querySelector('option[value="default"]').hidden = isShrincs;
  elements.settingsSignMode.querySelector('option[value="stateful"]').hidden = !isShrincs || Boolean(imported);
  elements.settingsSignMode.querySelector('option[value="stateless"]').hidden = !isShrincs;
  if (!isShrincs) elements.settingsSignMode.value = "default";
  elements.signModeHelp.hidden = !isShrincs;
  elements.signModeHelp.setAttribute("aria-hidden", String(!isShrincs));
}

function updateDeleteAccountButton(hasWalletData) {
  elements.deleteAccountButton.disabled = !hasWalletData;
}

async function saveLoginSession(password) {
  await chrome.storage.session.set({ [LOGIN_SESSION_KEY]: { password, unlockedAt: Date.now() } });
}

async function getLoginSessionPassword() {
  const { [LOGIN_SESSION_KEY]: session } = await chrome.storage.session.get(LOGIN_SESSION_KEY);
  if (!session || typeof session.password !== "string" || !Number.isFinite(session.unlockedAt) || Date.now() - session.unlockedAt >= LOGIN_SESSION_TTL) {
    if (session) await chrome.storage.session.remove(LOGIN_SESSION_KEY);
    return null;
  }
  return session.password;
}

async function clearLoginSession() {
  await chrome.storage.session.remove(LOGIN_SESSION_KEY);
}

function openAccountCreation(returnView) {
  if (walletOperationInProgress) {
    setStatus(elements.walletStatus, "Wait for signing to finish before creating an account.", "error");
    return;
  }
  accountCreationReturnView = returnView;
  elements.setupBackButton.hidden = returnView === "setup";
  showView("setup");
}

function lockWallet({ clearSession = true } = {}) {
  walletLockVersion += 1;
  privateKeyInMemory = null;
  shrincsPreparedKeyInMemory = null;
  shrincsPreparedKeyPromise = null;
  vaultEncryptionKey = null;
  walletPassword = null;
  account = null;
  if (clearSession) clearLoginSession().catch(() => { });
  elements.providerConfirmButton.disabled = true;
  elements.balance.textContent = "-- CKB";
  updateSignModeOptions();
  showView("unlock");
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  const change = changes[LOGIN_SESSION_KEY];
  if (areaName === "session" && change && change.newValue?.password !== change.oldValue?.password && change.newValue?.password !== walletPassword) {
    lockWallet({ clearSession: false });
  }
});

async function confirmWalletPassword() {
  setStatus(elements.setupPasswordStatus);
  const password = elements.setupPassword.value;
  if (password.length < 8) {
    setStatus(elements.setupPasswordStatus, t("passwordShort"), "error");
    return;
  }
  if (password !== elements.setupPasswordConfirm.value) {
    setStatus(elements.setupPasswordStatus, t("passwordMismatch"), "error");
    return;
  }
  elements.setPasswordButton.disabled = true;
  try {
    const walletCredential = await createWalletCredential(password);
    await chrome.storage.local.set({ walletCredential });
    await saveLoginSession(password);
    walletPassword = password;
    elements.setupPassword.value = "";
    elements.setupPasswordConfirm.value = "";
    showView("setup");
  } catch (error) {
    setStatus(elements.setupPasswordStatus, error.message, "error");
  } finally {
    elements.setPasswordButton.disabled = false;
  }
}

function openSettings() {
  viewBeforeSettings = VIEW_NAMES.find((view) => view !== "settings" && !elements[`${view.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}View`].hidden) || "setup";
  showView("settings");
}

function normalizePrivateKey(value, accountType = DEFAULT_ACCOUNT_TYPE) {
  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  const expectedLength = accountType === "shrincs" ? 96 : 64;
  if (!new RegExp(`^[0-9a-f]{${expectedLength}}$`).test(normalized)) throw new Error(t("invalidPrivateKey", { keyType: accountType === "shrincs" ? t("shrincsMasterSeedName") : t("privateKeyName"), length: expectedLength }));
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
  return mode === "stateful" ? shrincsStatefulSignatureSize(SHRINCS_MAX_STATEFUL_SIGNATURES) : SHRINCS_STATELESS_SIGNATURE_SIZE;
}

function incrementShrincsState(state) {
  const next = new Uint8Array(state);
  const view = new DataView(next.buffer);
  view.setUint32(0, view.getUint32(0, true) + 1, true);
  return next;
}

function addShrincsCellDep(transaction) {
  if (config.current !== config.testnet) throw new Error(t("shrincsTestnetOnly"));
  transaction.addCellDeps(config.current.script.shrincs.cellDep);
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
  const sender = (await ccc.Address.fromString(account.address, client)).script;
  const signer = new ccc.SignerCkbScriptReadonly(client, sender);
  const transaction = ccc.Transaction.from({ outputs: [{ capacity: amount, lock: recipient.script }], outputsData: ["0x"] });
  addShrincsCellDep(transaction);
  const placeholder = `0x${"00".repeat(shrincsSignaturePlaceholderSize())}`;
  const inputCells = [];
  let inputCapacity = 0n;
  for await (const cell of client.findCells({
    script: sender,
    scriptType: "lock",
    scriptSearchMode: "exact",
    filter: { scriptLenRange: [0, 1], outputDataLenRange: [0, 1] },
    withData: true,
  })) {
    if (cell.cellOutput.type || cell.outputData !== "0x") continue;
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
    try { new ccc.SignerCkbPrivateKey(client, key); return key; } catch { /* Reject the invalid secp256k1 scalar edge case. */ }
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

async function createWalletCredential(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveEncryptionKey(password, salt, ["encrypt"]);
  const encrypted = await encryptVaultPayload({ purpose: "wallet-password" }, key);
  return { version: VAULT_VERSION, salt: encodeBase64(salt), ...encrypted };
}

async function verifyWalletCredential(credential, password) {
  try {
    const key = await deriveEncryptionKey(password, decodeBase64(credential.salt), ["decrypt"]);
    const payload = await decryptVaultPayload(credential, key);
    if (payload.purpose !== "wallet-password") throw new Error();
  } catch {
    throw new Error(t("wrongPassword"));
  }
}

async function decryptVaultPayload(vault, key) {
  const plainText = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64(vault.iv) }, key, decodeBase64(vault.cipherText));
  return JSON.parse(new TextDecoder().decode(plainText));
}

function accountIdentifier(vault) {
  return vault.address || vault.publicKey;
}

async function getStoredAccounts() {
  const { accounts, vault } = await chrome.storage.local.get(["accounts", "vault"]);
  if (Array.isArray(accounts)) return accounts;
  return vault ? [vault] : [];
}

async function saveAccounts(accounts, activeVault) {
  const vault = accounts.find((entry) => accountIdentifier(entry) === accountIdentifier(activeVault)) || activeVault;
  await chrome.storage.local.set({ accounts, vault });
}

async function saveNewAccount(vault) {
  await navigator.locks.request("ckb-wallet-storage", async () => {
    const accounts = await getStoredAccounts();
    if (vault.accountType === "shrincs" && accounts.some((entry) => entry.publicKey === vault.publicKey)) {
      throw new Error("This SHRINCS account already exists. Switch to it instead of importing it again.");
    }
    const updatedAccounts = [...accounts.filter((entry) => accountIdentifier(entry) !== accountIdentifier(vault)), vault];
    await saveAccounts(updatedAccounts, vault);
  });
}

async function updateStoredAccount(updatedVault) {
  const accounts = await getStoredAccounts();
  const updatedAccounts = accounts.map((entry) => accountIdentifier(entry) === accountIdentifier(updatedVault) ? updatedVault : entry);
  await saveAccounts(updatedAccounts, updatedVault);
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
  const expectedAccount = account;
  await navigator.locks.request("ckb-wallet-storage", async () => {
    if (!vaultEncryptionKey) throw new Error(t("notEnoughKey"));
    const vault = await getActiveShrincsVault(expectedAccount);
    const { privateKey, shrincsSecretKey } = await decryptVaultPayload(vault, vaultEncryptionKey);
    const encrypted = await encryptVaultPayload({ privateKey, shrincsSecretKey, shrincsPreparedKey: encodeBase64(preparedKey) }, vaultEncryptionKey);
    if (account !== expectedAccount) throw new Error(t("walletLocked"));
    await updateStoredAccount({ ...vault, version: VAULT_VERSION, ...encrypted });
  });
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
  if (walletOperationInProgress) {
    setStatus(elements.changePasswordStatus, "Wait for signing to finish before changing the password.", "error");
    return;
  }
  return navigator.locks.request("ckb-wallet-storage", changeWalletPasswordUnlocked);
}

async function changeWalletPasswordUnlocked() {
  setStatus(elements.changePasswordStatus);
  elements.changePasswordButton.disabled = true;
  try {
    const currentPassword = elements.changePasswordCurrent.value;
    const newPassword = elements.changePasswordNew.value;
    if (newPassword.length < 8) throw new Error(t("passwordShort"));
    const { vault } = await chrome.storage.local.get("vault");
    if (!vault) throw new Error(t("missingVault"));
    await decryptPrivateKey(vault, currentPassword);
    const accounts = await getStoredAccounts();
    const updatedAccounts = [];
    for (const storedAccount of accounts) {
      const decryptedAccount = await decryptPrivateKey(storedAccount, currentPassword);
      const accountSalt = crypto.getRandomValues(new Uint8Array(16));
      const accountKey = await deriveEncryptionKey(newPassword, accountSalt, ["encrypt", "decrypt"]);
      const accountPayload = {
        privateKey: decryptedAccount.privateKey,
        shrincsSecretKey: decryptedAccount.shrincsSecretKey,
        shrincsPreparedKey: decryptedAccount.shrincsPreparedKey ? encodeBase64(decryptedAccount.shrincsPreparedKey) : undefined,
      };
      const accountEncrypted = await encryptVaultPayload(accountPayload, accountKey);
      updatedAccounts.push({ ...storedAccount, version: VAULT_VERSION, salt: encodeBase64(accountSalt), ...accountEncrypted });
    }
    const walletCredential = await createWalletCredential(newPassword);
    const updatedVault = updatedAccounts.find((entry) => accountIdentifier(entry) === accountIdentifier(vault));
    await chrome.storage.local.set({ accounts: updatedAccounts, vault: updatedVault, walletCredential });
    vaultEncryptionKey = await deriveEncryptionKey(newPassword, decodeBase64(updatedVault.salt), ["encrypt", "decrypt"]);
    walletPassword = newPassword;
    await saveLoginSession(newPassword);
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

async function getActiveShrincsVault(expectedAccount) {
  const { vault } = await chrome.storage.local.get("vault");
  if (!expectedAccount || account !== expectedAccount || vault?.accountType !== "shrincs" || vault.publicKey !== expectedAccount.publicKey) {
    throw new Error("The active account changed. Unlock the selected account and retry.");
  }
  return vault;
}

async function reserveShrincsState(expectedAccount) {
  return navigator.locks.request("ckb-wallet-storage", async () => {
    const vault = await getActiveShrincsVault(expectedAccount);
    const state = vault.shrincsState;
    if (vault.imported || !state || state.mode !== "stateful" || !state.data) throw new Error(t("noState"));
    const stateBytes = bytes.bytify(state.data);
    const q = stateCounter(stateBytes);
    if (q >= SHRINCS_MAX_STATEFUL_SIGNATURES) throw new Error(t("stateExhausted"));
    const reservedState = { mode: "stateful", q: q + 1, data: bytes.hexify(incrementShrincsState(stateBytes)) };
    await updateStoredAccount({ ...vault, version: VAULT_VERSION, shrincsState: reservedState });
    expectedAccount.shrincsState = reservedState;
    return { stateBytes, reservedState };
  });
}

async function signShrincsMessage(message) {
  if (config.current !== config.testnet) throw new Error(t("shrincsTestnetOnly"));
  const signingAccount = account;
  const signingClient = client;
  const signingKey = privateKeyInMemory;
  await shrincsInitialization;
  const messageBytes = bytes.bytify(message);
  const secretKey = bytes.bytify(signingKey);
  await getActiveShrincsVault(signingAccount);
  const mode = currentShrincsSignMode();
  let signature;
  if (mode === "stateful") {
    const { stateBytes, reservedState } = await reserveShrincsState(signingAccount);
    if (account !== signingAccount || client !== signingClient || privateKeyInMemory !== signingKey) throw new Error(t("walletLocked"));
    const result = signStateful(ParamsType.B, messageBytes, secretKey, stateBytes);
    const nextState = stateFromStatefulSignResult(result);
    if (stateCounter(nextState) !== reservedState.q) throw new Error(t("stateMismatch"));
    signature = signatureFromStatefulSignResult(result);
  } else {
    const preparedKey = await ensureShrincsPreparedKey();
    setStatus(elements.walletStatus, t("fastSigning"), "");
    elements.signingProgress.hidden = false;
    await nextPaint();
    if (account !== signingAccount || client !== signingClient || privateKeyInMemory !== signingKey) throw new Error(t("walletLocked"));
    signature = signStatelessWithPrepare(ParamsType.B, messageBytes, secretKey, preparedKey);
  }
  const publicKey = bytes.bytify(signingAccount.publicKey);
  if (!verify(ParamsType.B, messageBytes, signature, publicKey)) throw new Error(t("verifyFailed"));
  return bytes.hexify(signature);
}

function serializableCkbValue(value) {
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (Array.isArray(value)) return value.map(serializableCkbValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, serializableCkbValue(nested)]));
  return value;
}

function parseCkbAmount(value, minimum = MIN_TRANSFER_CKB * SHANNONS_PER_CKB) {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,8}))?$/);
  if (!match) throw new Error(t("invalidAmount"));
  const fraction = (match[2] || "").padEnd(8, "0");
  const amount = BigInt(match[1]) * SHANNONS_PER_CKB + BigInt(fraction);
  if (amount < minimum) throw new Error(t("amountTooSmall"));
  return amount;
}

async function buildAndSignTransfer(recipient, amount) {
  const signingAccount = account;
  const signingClient = client;
  const signingKey = privateKeyInMemory;
  const recipientAddress = await ccc.Address.fromString(recipient, client);
  assertWalletContext(signingAccount, signingClient, signingKey);
  let sealed;
  if (account.accountType === "shrincs") {
    sealed = await buildShrincsTransaction(recipientAddress, amount);
  } else {
    const signer = new ccc.SignerCkbPrivateKey(client, privateKeyInMemory);
    const transaction = ccc.Transaction.from({ outputs: [{ capacity: amount, lock: recipientAddress.script }], outputsData: ["0x"] });
    await transaction.completeFeeBy(signer, FEE_RATE);
    assertWalletContext(signingAccount, signingClient, signingKey);
    sealed = await signer.signTransaction(transaction);
  }
  return serializableCkbValue(sealed);
}

async function resolveProviderTransaction(transactionJson) {
  const transaction = ccc.Transaction.from(transactionJson);
  for (const input of transaction.inputs) {
    input.cellOutput = undefined;
    input.outputData = undefined;
    await input.getCell(client);
  }
  return transaction;
}

async function signProviderTransaction(transactionJson) {
  const transaction = await resolveProviderTransaction(transactionJson);
  if (!privateKeyInMemory || !account) throw new Error(t("walletLocked"));
  if (account.accountType === "shrincs") {
    throw new Error("Full transaction signing for SHRINCS accounts is not supported by this provider yet.");
  }
  const signerScript = (await ccc.Address.fromString(account.address, client)).script;
  let ownsInput = false;
  let ownedInputIndex;
  for (const input of transaction.inputs) {
    const cell = await input.getCell(client);
    if (sameScript(cell.cellOutput.lock, signerScript)) {
      ownsInput = true;
      ownedInputIndex = transaction.inputs.indexOf(input);
      break;
    }
  }
  if (!ownsInput) throw new Error(t("providerNoOwnedInput"));
  const witness = transaction.getWitnessArgs(ownedInputIndex) ?? ccc.WitnessArgs.from({});
  if (!witness.lock) witness.lock = `0x${"00".repeat(65)}`;
  transaction.setWitnessArgs(ownedInputIndex, witness);
  const signer = new ccc.SignerCkbPrivateKey(client, privateKeyInMemory);
  const signed = await signer.signOnlyTransaction(transaction);
  return JSON.parse(signed.stringify());
}

function addSummaryAmount(summary, address, field, amount) {
  const entry = summary.get(address) || { spent: 0n, received: 0n };
  entry[field] += amount;
  summary.set(address, entry);
}

async function summarizeProviderTransaction(transactionJson) {
  const transaction = await resolveProviderTransaction(transactionJson);
  const summary = new Map();
  for (const input of transaction.inputs) {
    const cell = await input.getCell(client);
    const address = ccc.Address.fromScript(cell.cellOutput.lock, client).toString();
    addSummaryAmount(summary, address, "spent", BigInt(cell.cellOutput.capacity));
  }
  for (const output of transaction.outputs) {
    const address = ccc.Address.fromScript(output.lock, client).toString();
    addSummaryAmount(summary, address, "received", BigInt(output.capacity));
  }
  return [...summary.entries()]
    .map(([address, values]) => ({ address, netChange: values.received - values.spent }))
    .filter(({ netChange }) => netChange !== 0n);
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
  elements.walletStatus.replaceChildren(t("txSuccess"), hash);
  elements.walletStatus.className = "status success";
}

async function refreshBalance() {
  elements.refreshButton.disabled = true;
  setStatus(elements.walletStatus, t("balanceQuery"));
  try {
    const { script } = await ccc.Address.fromString(account.address, client);
    const capacity = BigInt(await client.getBalance([script]));
    elements.balance.innerHTML = `${formatCkb(capacity)} <small>CKB</small>`;
    setStatus(elements.walletStatus, t("balanceUpdated"), "success");
  } catch (error) {
    setStatus(elements.walletStatus, t("balanceError", { error: error.message }), "error");
  } finally { elements.refreshButton.disabled = false; }
}

const DAO_ZERO_DATA = `0x${"00".repeat(8)}`;
const DAO_FEE_CELL_FILTER = { scriptLenRange: [0, 1], outputDataLenRange: [0, 1] };

function currentDaoScript() {
  return ccc.Script.from({
    codeHash: config.current.script.dao.codeHash,
    hashType: config.current.script.dao.hashType,
    args: "0x",
  });
}

function uint64LeHex(value) {
  const number = BigInt(value);
  if (number < 0n || number > 0xffffffffffffffffn) throw new Error("Value is outside the uint64 range.");
  return bytes.hexify(Uint8Array.from({ length: 8 }, (_, index) => Number((number >> BigInt(index * 8)) & 0xffn)));
}

function daoCellIsWithdrawal(cell) {
  return cell.outputData.toLowerCase() !== DAO_ZERO_DATA;
}

function daoCellKey(cell) {
  return `${cell.outPoint.txHash}:${cell.outPoint.index}`;
}

function readUint64Le(value) {
  const data = bytes.bytify(value);
  if (data.length !== 8) throw new Error("DAO cell data must contain an 8-byte block number.");
  let number = 0n;
  for (let index = data.length - 1; index >= 0; index -= 1) number = (number << 8n) | BigInt(data[index]);
  return number;
}

function updateDaoCountdowns() {
  const countdownElements = elements.daoCells.querySelectorAll("[data-dao-countdown-key]");
  for (const countdown of countdownElements) {
    const entry = daoCountdowns.get(countdown.dataset.daoCountdownKey);
    countdown.title = entry?.error || "";
    if (!entry || entry.status === "loading") {
      countdown.textContent = t("daoCountdownLoading");
    } else if (entry.status === "pending") {
      countdown.textContent = t("daoCountdownPending");
    } else if (entry.status === "error") {
      countdown.textContent = t("daoCountdownError");
    } else if (daoTipHeader?.epoch.ge(entry.claimEpoch)) {
      countdown.textContent = t("daoCountdownReady");
    } else {
      const remainingMs = entry.claimTime - BigInt(Date.now());
      if (remainingMs <= 0n) {
        countdown.textContent = t("daoCountdownWaiting");
      } else {
        const remainingHours = Number((remainingMs + 3_600_000n - 1n) / 3_600_000n);
        const days = Math.floor(remainingHours / 24);
        const hours = remainingHours % 24;
        countdown.textContent = t("daoCountdown", { days, hours });
      }
    }
  }
}

async function refreshDaoTipHeader() {
  const expectedClient = client;
  try {
    const tipHeader = await expectedClient.getTipHeader();
    if (client !== expectedClient) return;
    daoTipHeader = tipHeader;
    daoTipFetchedAt = Date.now();
    updateDaoCountdowns();
    setStatus(elements.daoListStatus);
  } catch (error) {
    setStatus(elements.daoListStatus, t("daoTipRefreshError", { error: error.message }), "error");
  }
}

function renderDaoCells() {
  elements.daoCells.replaceChildren();
  let totalCapacity = 0n;
  daoCells.forEach((cell, index) => {
    totalCapacity += BigInt(cell.cellOutput.capacity);
    const isWithdrawal = daoCellIsWithdrawal(cell);
    const item = document.createElement("article");
    item.className = "dao-cell";
    const row = document.createElement("div");
    row.className = "row";
    const state = document.createElement("strong");
    state.textContent = t(isWithdrawal ? "daoWithdrawingCell" : "daoDepositCell");
    const capacity = document.createElement("strong");
    capacity.textContent = `${formatCkb(BigInt(cell.cellOutput.capacity))} CKB`;
    row.append(state, capacity);
    const outPoint = document.createElement("p");
    outPoint.className = "dao-cell-meta";
    outPoint.textContent = `${cell.outPoint.txHash}:${cell.outPoint.index}`;
    if (isWithdrawal) {
      const countdown = document.createElement("p");
      countdown.className = "dao-cell-countdown";
      countdown.dataset.daoCountdownKey = daoCellKey(cell);
      const actions = document.createElement("div");
      actions.className = "actions";
      actions.append(countdown);
      const action = document.createElement("button");
      action.type = "button";
      action.className = "secondary";
      action.dataset.daoAction = "withdraw";
      action.dataset.daoIndex = String(index);
      action.disabled = walletOperationInProgress;
      action.textContent = t("daoWithdrawButton");
      actions.append(action);
      item.append(row, outPoint, actions);
      elements.daoCells.append(item);
      return;
    }
    const actions = document.createElement("div");
    actions.className = "actions";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "secondary";
    action.dataset.daoAction = "prepare";
    action.dataset.daoIndex = String(index);
    action.disabled = walletOperationInProgress;
    action.textContent = t("daoPrepareButton");
    actions.append(action);
    item.append(row, outPoint, actions);
    elements.daoCells.append(item);
  });
  elements.daoBalance.innerHTML = `${formatCkb(totalCapacity)} <small>CKB</small>`;
  if (daoCells.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = t("daoEmpty");
    elements.daoCells.append(empty);
  }
  updateDaoCountdowns();
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]);
    }
  }));
  return results;
}

async function loadDaoCountdowns(cells, expectedClient) {
  const withdrawals = cells.filter(daoCellIsWithdrawal);
  daoCountdowns = new Map(withdrawals.map((cell) => [daoCellKey(cell), { status: "loading" }]));
  if (withdrawals.length === 0) {
    daoTipHeader = null;
    daoTipFetchedAt = 0;
    return;
  }

  const depositNumbers = new Map();
  const transactionHashes = new Set();
  for (const cell of withdrawals) {
    try {
      depositNumbers.set(daoCellKey(cell), readUint64Le(cell.outputData).toString());
      transactionHashes.add(cell.outPoint.txHash);
    } catch (error) {
      daoCountdowns.set(daoCellKey(cell), { status: "error", error: error.message });
    }
  }
  if (transactionHashes.size === 0) {
    daoTipHeader = null;
    daoTipFetchedAt = 0;
    return;
  }

  const transactionResults = new Map();
  await mapWithConcurrency([...transactionHashes], 6, async (transactionHash) => {
    try {
      transactionResults.set(transactionHash, { value: await expectedClient.getTransactionWithHeader(transactionHash) });
    } catch (error) {
      transactionResults.set(transactionHash, { error: error.message });
    }
  });

  const depositBlockNumbers = [...new Set(depositNumbers.values())];
  const depositHeaders = new Map();
  await mapWithConcurrency(depositBlockNumbers, 6, async (number) => {
    try {
      const header = await expectedClient.getHeaderByNumber(BigInt(number));
      depositHeaders.set(number, header ? { value: header } : { error: "Deposit block header was not found." });
    } catch (error) {
      depositHeaders.set(number, { error: error.message });
    }
  });

  try {
    daoTipHeader = await expectedClient.getTipHeader();
    daoTipFetchedAt = Date.now();
  } catch (error) {
    daoTipHeader = null;
    daoTipFetchedAt = 0;
    for (const cell of withdrawals) {
      daoCountdowns.set(daoCellKey(cell), { status: "error", error: error.message });
    }
    return;
  }

  for (const cell of withdrawals) {
    const key = daoCellKey(cell);
    const depositNumber = depositNumbers.get(key);
    if (depositNumber === undefined) continue;
    const transactionResult = transactionResults.get(cell.outPoint.txHash);
    if (transactionResult?.error) {
      daoCountdowns.set(key, { status: "error", error: transactionResult.error });
      continue;
    }
    const transactionInfo = transactionResult?.value;
    if (!transactionInfo || transactionInfo.transaction.status !== "committed") {
      daoCountdowns.set(key, { status: "pending" });
      continue;
    }
    if (!transactionInfo.header) {
      daoCountdowns.set(key, { status: "error", error: "Withdrawal preparation block header is unavailable." });
      continue;
    }
    const depositHeader = depositHeaders.get(depositNumber);
    if (!depositHeader?.value) {
      daoCountdowns.set(key, { status: "error", error: depositHeader?.error || "Deposit block header is unavailable." });
      continue;
    }
    try {
      const claimEpoch = ccc.calcDaoClaimEpoch(depositHeader.value, transactionInfo.header);
      daoCountdowns.set(key, {
        status: "ready",
        claimEpoch,
        claimTime: claimEpoch.toUnix(daoTipHeader),
      });
    } catch (error) {
      daoCountdowns.set(key, { status: "error", error: error.message });
    }
  }
}

async function loadDaoCells() {
  const expectedAccount = account;
  const expectedClient = client;
  if (!expectedAccount || !privateKeyInMemory || daoLoadInProgress) return;
  daoLoadInProgress = true;
  elements.daoRefreshButton.disabled = true;
  setStatus(elements.daoListStatus, t("daoLoading"));
  try {
    const { script: ownerLock } = await ccc.Address.fromString(expectedAccount.address, expectedClient);
    const cells = [];
    const daoScript = currentDaoScript();
    for await (const cell of expectedClient.findCells({
      script: ownerLock,
      scriptType: "lock",
      scriptSearchMode: "exact",
      filter: { script: daoScript, outputDataLenRange: [8, 9] },
      withData: true,
    }, "desc", 50)) {
      cells.push(cell);
    }
    if (account !== expectedAccount || client !== expectedClient) return;
    daoCells = cells;
    daoCountdowns = new Map(cells
      .filter(daoCellIsWithdrawal)
      .map((cell) => [daoCellKey(cell), { status: "loading" }]));
    daoTipHeader = null;
    daoTipFetchedAt = 0;
    renderDaoCells();
    await loadDaoCountdowns(cells, expectedClient);
    if (account !== expectedAccount || client !== expectedClient) return;
    renderDaoCells();
    setStatus(elements.daoListStatus);
  } catch (error) {
    if (account === expectedAccount && client === expectedClient) {
      setStatus(elements.daoListStatus, t("daoLoadError", { error: error.message }), "error");
    }
  } finally {
    daoLoadInProgress = false;
    elements.daoRefreshButton.disabled = walletOperationInProgress;
  }
}

function daoCellInput(cell, since = 0n) {
  return {
    previousOutput: cell.outPoint,
    since,
    cellOutput: cell.cellOutput,
    outputData: cell.outputData,
  };
}

function addDaoCellDep(transaction) {
  transaction.addCellDeps(config.current.script.dao.cellDep);
}

async function buildDaoDepositTransaction(amount, ownerLock) {
  const daoScript = currentDaoScript();
  const output = ccc.CellOutput.from({ capacity: amount, lock: ownerLock, type: daoScript });
  const minimumCapacity = BigInt(output.occupiedSize + 8) * SHANNONS_PER_CKB;
  if (amount < minimumCapacity) {
    throw new Error(t("daoDepositMinimum", { capacity: formatCkb(minimumCapacity) }));
  }
  const transaction = ccc.Transaction.from({
    outputs: [output],
    outputsData: [DAO_ZERO_DATA],
  });
  addDaoCellDep(transaction);
  return transaction;
}

async function buildDaoPrepareTransaction(cell, ownerLock) {
  const daoInfo = await cell.getNervosDaoInfo(client);
  if (!daoInfo.depositHeader || daoInfo.withdrawHeader) throw new Error(t("daoInvalidCell"));
  const transaction = ccc.Transaction.from({
    headerDeps: [daoInfo.depositHeader.hash],
    inputs: [daoCellInput(cell)],
    outputs: [cell.cellOutput],
    outputsData: [uint64LeHex(daoInfo.depositHeader.number)],
  });
  addDaoCellDep(transaction);
  return transaction;
}

async function buildDaoWithdrawTransaction(cell, ownerLock) {
  const daoInfo = await cell.getNervosDaoInfo(client);
  if (!daoInfo.depositHeader || !daoInfo.withdrawHeader) throw new Error(t("daoInvalidCell"));
  const claimEpoch = ccc.calcDaoClaimEpoch(daoInfo.depositHeader, daoInfo.withdrawHeader);
  const tipHeader = await client.getTipHeader();
  if (tipHeader.epoch.lt(claimEpoch)) {
    const epochText = claimEpoch.numerator === 0n
      ? claimEpoch.integer.toString()
      : `${claimEpoch.integer}+${claimEpoch.numerator}/${claimEpoch.denominator}`;
    throw new Error(t("daoNotReady", { epoch: epochText }));
  }
  const transaction = ccc.Transaction.from({
    headerDeps: [daoInfo.depositHeader.hash, daoInfo.withdrawHeader.hash],
    inputs: [daoCellInput(cell, ccc.Since.from({
      relative: "absolute",
      metric: "epoch",
      value: claimEpoch.toNum(),
    }).toNum())],
    outputs: [{
      capacity: BigInt(cell.cellOutput.capacity),
      lock: ownerLock,
    }],
    outputsData: ["0x"],
  });
  transaction.setWitnessArgs(0, { inputType: uint64LeHex(0n) });
  addDaoCellDep(transaction);
  return transaction;
}

function setShrincsDaoWitnessPlaceholders(transaction, ownerLock) {
  const firstIndex = transaction.inputs.findIndex((input) => input.cellOutput && sameScript(input.cellOutput.lock, ownerLock));
  if (firstIndex < 0) return -1;
  const placeholder = `0x${"00".repeat(shrincsSignaturePlaceholderSize())}`;
  for (let index = 0; index < transaction.inputs.length; index += 1) {
    const witness = transaction.getWitnessArgs(index);
    if (index === firstIndex) {
      transaction.setWitnessArgs(index, {
        lock: placeholder,
        inputType: witness?.inputType,
        outputType: witness?.outputType,
      });
    } else if (witness) {
      transaction.setWitnessArgs(index, { inputType: witness.inputType, outputType: witness.outputType });
    } else {
      transaction.setWitness(index, "0x");
    }
  }
  return firstIndex;
}

async function signDaoTransaction(transaction, ownerLock, action, expectedAccount, expectedClient, expectedKey) {
  if (expectedAccount.accountType === "shrincs") {
    addShrincsCellDep(transaction);
    const signer = new ccc.SignerCkbScriptReadonly(expectedClient, ownerLock);
    let transactionToSign = transaction;
    let feeCompletedFromDaoProfit = false;
    if (action === "withdraw") {
      const daoProfit = BigInt(await transaction.inputs[0].getExtraCapacity(expectedClient));
      const profitFundedTransaction = transaction.clone();
      setShrincsDaoWitnessPlaceholders(profitFundedTransaction, ownerLock);
      try {
        await profitFundedTransaction.completeFeeChangeToOutput(
          signer, 0, FEE_RATE, DAO_FEE_CELL_FILTER, { shouldAddInputs: false },
        );
        transactionToSign = profitFundedTransaction;
        feeCompletedFromDaoProfit = true;
      } catch (error) {
        if (!(error instanceof ccc.ErrorTransactionInsufficientCapacity)) throw error;
        transaction.outputs[0].capacity = BigInt(transaction.outputs[0].capacity) + daoProfit;
      }
    }
    if (!feeCompletedFromDaoProfit) {
      let inputCount = -1;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        if (transactionToSign.inputs.length > 0) setShrincsDaoWitnessPlaceholders(transactionToSign, ownerLock);
        inputCount = transactionToSign.inputs.length;
        await transactionToSign.completeFeeBy(signer, FEE_RATE, DAO_FEE_CELL_FILTER, { shouldAddInputs: true });
        if (transactionToSign.inputs.length === inputCount) break;
        if (attempt === 7) throw new Error("Unable to settle DAO transaction fees with the selected cells.");
      }
    }
    assertWalletContext(expectedAccount, expectedClient, expectedKey);
    const firstIndex = setShrincsDaoWitnessPlaceholders(transactionToSign, ownerLock);
    if (firstIndex < 0) throw new Error("No input belongs to the active SHRINCS lock.");
    await Promise.all(transactionToSign.inputs.map(async (input) => {
      if (!input.cellOutput || input.outputData === undefined) await input.completeExtraInfos(expectedClient);
    }));
    const signature = await signShrincsMessage(shrincsSigningMessage(transactionToSign, transactionToSign.inputs, firstIndex));
    const witness = transactionToSign.getWitnessArgs(firstIndex) ?? ccc.WitnessArgs.from({});
    transactionToSign.setWitnessArgs(firstIndex, {
      lock: signature,
      inputType: witness.inputType,
      outputType: witness.outputType,
    });
    return transactionToSign;
  }
  const signer = new ccc.SignerCkbPrivateKey(expectedClient, expectedKey);
  if (action === "withdraw") {
    const daoProfit = BigInt(await transaction.inputs[0].getExtraCapacity(expectedClient));
    const profitFundedTransaction = transaction.clone();
    try {
      await profitFundedTransaction.completeFeeChangeToOutput(
        signer, 0, FEE_RATE, DAO_FEE_CELL_FILTER, { shouldAddInputs: false },
      );
      assertWalletContext(expectedAccount, expectedClient, expectedKey);
      return signer.signTransaction(profitFundedTransaction);
    } catch (error) {
      if (!(error instanceof ccc.ErrorTransactionInsufficientCapacity)) throw error;
      transaction.outputs[0].capacity = BigInt(transaction.outputs[0].capacity) + daoProfit;
    }
  }
  await transaction.completeFeeBy(signer, FEE_RATE, DAO_FEE_CELL_FILTER, { shouldAddInputs: true });
  assertWalletContext(expectedAccount, expectedClient, expectedKey);
  return signer.signTransaction(transaction);
}

function showDaoTransactionLink(action, transactionHash) {
  const hash = document.createElement("code");
  hash.className = "transaction-hash";
  hash.textContent = transactionHash;
  elements.daoStatus.replaceChildren(t({
    deposit: "daoDepositSuccess",
    prepare: "daoPrepareSuccess",
    withdraw: "daoWithdrawSuccess",
  }[action]), hash);
  elements.daoStatus.className = "status success";
}

async function performDaoAction(action, { amount, cell } = {}) {
  if (walletOperationInProgress) return;
  const signingAccount = account;
  const signingClient = client;
  const signingKey = privateKeyInMemory;
  const signingAddress = signingAccount?.address;
  if (!signingAccount || !signingClient || !signingKey) {
    setStatus(elements.daoStatus, t("walletLocked"), "error");
    return;
  }
  walletOperationInProgress = true;
  elements.daoDepositButton.disabled = true;
  elements.daoRefreshButton.disabled = true;
  elements.daoCells.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  setStatus(elements.daoStatus, t("buildingTransaction"));
  try {
    const { script: ownerLock } = await ccc.Address.fromString(signingAddress, signingClient);
    let transaction;
    if (action === "deposit") {
      transaction = await buildDaoDepositTransaction(amount, ownerLock);
    } else {
      const freshCell = await signingClient.getCellLive(cell.outPoint, true);
      if (!freshCell) throw new Error(t("daoCellSpent"));
      const daoScript = currentDaoScript();
      if (!freshCell.cellOutput.type || !sameScript(freshCell.cellOutput.type, daoScript) ||
          !sameScript(freshCell.cellOutput.lock, ownerLock) || typeof freshCell.outputData !== "string" || freshCell.outputData.length !== 18) {
        throw new Error(t("daoInvalidCell"));
      }
      transaction = action === "prepare"
        ? await buildDaoPrepareTransaction(freshCell, ownerLock)
        : await buildDaoWithdrawTransaction(freshCell, ownerLock);
    }
    assertWalletContext(signingAccount, signingClient, signingKey);
    const sealed = await signDaoTransaction(transaction, ownerLock, action, signingAccount, signingClient, signingKey);
    assertWalletContext(signingAccount, signingClient, signingKey);
    setStatus(elements.daoStatus, t("daoBroadcasting"));
    const transactionHash = await signingClient.sendTransaction(serializableCkbValue(sealed));
    await recordTransaction(transactionHash, BigInt(sealed.outputs[0].capacity), signingAddress, `dao-${action}`);
    assertWalletContext(signingAccount, signingClient, signingKey);
    await refreshBalance();
    await loadDaoCells();
    showDaoTransactionLink(action, transactionHash);
  } catch (error) {
    setStatus(elements.daoStatus, t("daoActionError", { error: error.message }), "error");
  } finally {
    walletOperationInProgress = false;
    elements.daoDepositButton.disabled = false;
    elements.daoRefreshButton.disabled = false;
    renderDaoCells();
  }
}

// 进入钱包视图(生成/导入后直接进入, 或解锁后进入). privateKey 为内存中用于签名的密钥.
async function enterWallet({ accountType, privateKey, publicKey, shrincsState, imported, expectedAddress, preparedKey = null }) {
  const lockVersion = walletLockVersion;
  const restoredAccount = await createAccount(privateKey, accountType, publicKey);
  if (expectedAddress) {
    const storedClient = expectedAddress.startsWith("ckb1") ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet();
    const expectedScript = (await ccc.Address.fromString(expectedAddress, storedClient)).script;
    const restoredScript = (await ccc.Address.fromString(restoredAccount.address, client)).script;
    if (!sameScript(expectedScript, restoredScript)) throw new Error(t("addressMismatch"));
  }
  const { vault } = await chrome.storage.local.get("vault");
  await chrome.storage.local.set({ providerAddress: restoredAccount.address, providerAddressAccount: vault?.address || null });
  if (walletLockVersion !== lockVersion) throw new Error(t("walletLocked"));
  privateKeyInMemory = privateKey;
  shrincsPreparedKeyInMemory = preparedKey;
  shrincsPreparedKeyPromise = null;
  account = { ...restoredAccount, accountType, shrincsState: accountType === "shrincs" ? shrincsState : undefined, imported };
  elements.address.textContent = account.address;
  elements.accountType.textContent = accountType;
  updateSignModeOptions(accountType, imported);
  elements.settingsSignMode.value = accountType === "shrincs" ? currentShrincsSignMode() : "default";
  elements.settingsSignMode.disabled = false;
  updateDeleteAccountButton(true);
  const confirmingProviderRequest = Boolean(providerRequestId && providerRequest);
  if (confirmingProviderRequest) elements.providerConfirmButton.disabled = !providerSummaryContext || providerSummaryContext.client !== client;
  showView(confirmingProviderRequest ? "provider-confirm" : "wallet");
  const balanceRefresh = refreshBalance();
  if (confirmingProviderRequest) balanceRefresh.catch(() => { });
  else await balanceRefresh;
}

async function saveWallet() {
  setStatus(elements.importStatus);
  elements.saveWalletButton.disabled = true;
  try {
    const accountType = elements.importAccountType.value;
    if (accountType === "shrincs" && config.current !== config.testnet) throw new Error(t("shrincsTestnetOnly"));
    if (!walletPassword) throw new Error(t("passwordShort"));
    const password = walletPassword;
    let privateKey = elements.privateKey.value;
    let publicKey;
    let secretKey;
    let shrincsState;
    if (accountType === "shrincs") {
      elements.importProgress.hidden = false;
      await nextPaint();
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
    await saveNewAccount(vault);
    updateDeleteAccountButton(true);
    elements.privateKey.value = "";
    setStatus(elements.importStatus, t("accountImported"), "success");
    await enterWallet({ accountType, privateKey: accountType === "shrincs" ? secretKey : privateKey, publicKey, shrincsState, imported: true });
  } catch (error) { setStatus(elements.importStatus, error.message, "error"); }
  finally {
    elements.importProgress.hidden = true;
    elements.saveWalletButton.disabled = false;
  }
}

async function generateWallet() {
  setStatus(elements.createStatus);
  elements.generateButton.disabled = true;
  try {
    const accountType = elements.setupAccountType.value;
    if (accountType === "shrincs" && config.current !== config.testnet) throw new Error(t("shrincsTestnetOnly"));
    if (!walletPassword) throw new Error(t("passwordShort"));
    const password = walletPassword;
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
    await saveNewAccount(vault);
    updateDeleteAccountButton(true);
    setStatus(elements.createStatus, t("accountGenerated"), "success");
    await enterWallet({ accountType, privateKey: accountType === "shrincs" ? secretKey : privateKey, publicKey, shrincsState, imported: false });
  } catch (error) {
    setStatus(elements.createStatus, error.message, "error");
  } finally {
    elements.generationProgress.hidden = true;
    elements.generateButton.disabled = false;
  }
}

async function unlockWallet(password = elements.unlockPassword.value, silent = false) {
  const lockVersion = walletLockVersion;
  setStatus(elements.unlockStatus);
  elements.unlockButton.disabled = true;
  try {
    const { vault, walletCredential } = await chrome.storage.local.get(["vault", "walletCredential"]);
    if (!vault && !walletCredential) throw new Error(t("missingVault"));
    if (!vault) {
      await verifyWalletCredential(walletCredential, password);
      if (walletLockVersion !== lockVersion) throw new Error(t("walletLocked"));
      walletPassword = password;
      await saveLoginSession(password);
      if (walletLockVersion !== lockVersion) throw new Error(t("walletLocked"));
      elements.unlockPassword.value = "";
      showView("setup");
      return true;
    }
    const accountType = vault.accountType || DEFAULT_ACCOUNT_TYPE;
    if (!silent) setStatus(elements.unlockStatus, t("verifyingPassword"));
    const { privateKey: seed, shrincsSecretKey, shrincsPreparedKey: preparedKey, encryptionKey } = await decryptPrivateKey(vault, password);
    if (walletLockVersion !== lockVersion) throw new Error(t("walletLocked"));
    walletPassword = password;
    await saveLoginSession(password);
    if (walletLockVersion !== lockVersion) throw new Error(t("walletLocked"));
    vaultEncryptionKey = encryptionKey;
    let privateKey = seed;
    if (accountType === "shrincs") {
      privateKey = shrincsSecretKey;
    }
    elements.unlockPassword.value = "";
    await enterWallet({ accountType, privateKey, publicKey: vault.publicKey, shrincsState: vault.shrincsState, imported: Boolean(vault.imported), expectedAddress: vault.address, preparedKey });
    return true;
  } catch (error) {
    if (silent) await clearLoginSession();
    setStatus(elements.unlockStatus, error.message, "error");
    return false;
  }
  finally { elements.unlockButton.disabled = false; }
}

function assertWalletContext(expectedAccount, expectedClient, expectedKey) {
  if (!expectedAccount || account !== expectedAccount || client !== expectedClient || !expectedKey || privateKeyInMemory !== expectedKey) {
    throw new Error("The wallet was locked or its account/network changed. Please retry.");
  }
}

async function sendTransfer(event) {
  event.preventDefault();
  if (walletOperationInProgress) return;
  const signingAccount = account;
  const signingClient = client;
  const signingKey = privateKeyInMemory;
  const signingAddress = account?.address;
  walletOperationInProgress = true;
  elements.sendButton.disabled = true;
  setStatus(elements.walletStatus, t("buildingTransaction"));
  let transactionSigned = false;
  try {
    const recipient = elements.recipient.value.trim();
    if (!recipient.startsWith(`${config.current.hrp}1`)) throw new Error(t("invalidAddress"));
    const amount = parseCkbAmount(elements.amount.value);
    const sealed = await buildAndSignTransfer(recipient, amount);
    assertWalletContext(signingAccount, signingClient, signingKey);
    transactionSigned = true;
    setStatus(elements.walletStatus, t("broadcasting"));
    const transactionHash = await signingClient.sendTransaction(sealed);
    await recordTransaction(transactionHash, amount, signingAddress, "transfer");
    assertWalletContext(signingAccount, signingClient, signingKey);
    elements.amount.value = "";
    await refreshBalance();
    showTransactionLink(transactionHash);
  } catch (error) {
    const prefix = account?.accountType === "shrincs" && transactionSigned
      ? t("shrincsRejected", { error: error.message })
      : t("transferError", { error: error.message });
    setStatus(elements.walletStatus, prefix, "error");
  } finally {
    walletOperationInProgress = false;
    elements.signingProgress.hidden = true;
    elements.sendButton.disabled = false;
  }
}

async function loadProviderRequest() {
  if (!providerRequestId) return false;
  const response = await chrome.runtime.sendMessage({ type: "provider-get-request", requestId: providerRequestId });
  if (response?.error) throw new Error(response.error.message);
  providerRequest = response.result;
  if (providerRequest.method !== "ckb_signTransaction") throw new Error("Unsupported provider method.");
  const request = providerRequest.params?.[0];
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new Error("A JSON transaction is required.");
  elements.providerRequestOrigin.textContent = providerRequest.origin || "Unknown website";
  elements.providerRequestSummary.textContent = "Loading transaction details…";
  providerSummaryContext = null;
  const summaryClient = client;
  elements.providerConfirmButton.disabled = true;
  elements.providerRejectButton.disabled = false;
  summarizeProviderTransaction(request).then((summary) => {
    if (client !== summaryClient) throw new Error("The network changed while loading transaction details.");
    elements.providerRequestSummary.replaceChildren(...summary.map(({ address, netChange }) => {
      const row = document.createElement("div");
      row.className = "request-summary-row";
      const addressElement = document.createElement("span");
      addressElement.className = "request-summary-address";
      addressElement.textContent = address;
      const netChangeElement = document.createElement("span");
      netChangeElement.className = `request-summary-amount ${netChange > 0n ? "increase" : "decrease"}`;
      const sign = netChange > 0n ? "+" : "-";
      netChangeElement.textContent = `${sign}${formatCkb(netChange > 0n ? netChange : -netChange)} CKB`;
      row.append(addressElement, netChangeElement);
      return row;
    }));
    providerSummaryContext = { client: summaryClient, transactionHash: ccc.Transaction.from(request).hash() };
    elements.providerConfirmButton.disabled = !account || !privateKeyInMemory;
  }).catch((error) => {
    providerSummaryContext = null;
    elements.providerConfirmButton.disabled = true;
    elements.providerRequestSummary.textContent = `Unable to load transaction details: ${error.message}`;
  });
  return true;
}

async function completeProviderRequest() {
  if (walletOperationInProgress) return;
  walletOperationInProgress = true;
  const signingAccount = account;
  const signingClient = client;
  const signingKey = privateKeyInMemory;
  elements.providerConfirmButton.disabled = true;
  elements.providerRejectButton.disabled = true;
  setStatus(elements.providerConfirmStatus, t("buildingTransaction"));
  try {
    if (!account || !privateKeyInMemory) throw new Error(t("walletLocked"));
    const request = providerRequest.params?.[0];
    if (!providerSummaryContext || providerSummaryContext.client !== client || providerSummaryContext.transactionHash !== ccc.Transaction.from(request).hash()) {
      throw new Error("Transaction details must load successfully before signing.");
    }
    const sealed = await signProviderTransaction(request);
    assertWalletContext(signingAccount, signingClient, signingKey);
    const response = await chrome.runtime.sendMessage({ type: "provider-confirmation", requestId: providerRequestId, approved: true, result: sealed });
    if (response?.error) throw new Error(response.error.message);
    window.close();
  } catch (error) {
    setStatus(elements.providerConfirmStatus, t("providerRequestError", { error: error.message }), "error");
    elements.providerConfirmButton.disabled = !providerSummaryContext || providerSummaryContext.client !== client;
    elements.providerRejectButton.disabled = false;
  } finally {
    walletOperationInProgress = false;
  }
}

async function rejectProviderRequest() {
  elements.providerConfirmButton.disabled = true;
  elements.providerRejectButton.disabled = true;
  await chrome.runtime.sendMessage({ type: "provider-confirmation", requestId: providerRequestId, approved: false });
  window.close();
}

async function copyAddress() {
  await navigator.clipboard.writeText(account.address);
  setStatus(elements.walletStatus, t("copySuccess"), "success");
}

async function exportWallet() {
  if (!privateKeyInMemory || !account) throw new Error(t("walletLocked"));

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
  const supportsShrincs = config.current === config.testnet;
  elements.setupAccountType.querySelector('option[value="shrincs"]').disabled = !supportsShrincs;
  elements.importAccountType.querySelector('option[value="shrincs"]').disabled = !supportsShrincs;
  if (!supportsShrincs && elements.setupAccountType.value === "shrincs") elements.setupAccountType.value = "secp256k1";
  const isShrincs = elements.setupAccountType.value === "shrincs";
  elements.privateKeyLabel.textContent = isShrincs ? t("shrincsMasterSeedLabel") : t("privateKeyLabel");
  elements.importAccountType.value = elements.setupAccountType.value;
  elements.importSigningHint.hidden = elements.importAccountType.value !== "shrincs";
}

function renderTransactionHistory(records) {
  elements.historyList.replaceChildren(...records.map((record) => {
    const item = document.createElement("li");
    item.className = "history-item";
    const statusLabel = record.status === "completed" ? t("historySuccess") : t("historyPending");
    const actionTranslation = {
      transfer: "historyTransfer",
      "dao-deposit": "historyDaoDeposit",
      "dao-prepare": "historyDaoPrepare",
      "dao-withdraw": "historyDaoWithdraw",
    }[record.action] || "historyTransfer";
    item.innerHTML = `<div class="row"><strong>${t(actionTranslation)}</strong><span class="history-meta">${new Date(record.time).toLocaleString(language)}</span></div><div class="row history-meta"><span>${statusLabel}</span><span>${t("historyAmount")}: ${record.amount} CKB</span></div>`;
    const hash = document.createElement("code");
    hash.className = "transaction-hash";
    hash.textContent = record.hash;
    const explorerLink = document.createElement("a");
    explorerLink.className = "tx-link";
    explorerLink.href = `https://${config.current === config.mainnet ? "explorer" : "pudge.explorer"}.nervos.org/transaction/${encodeURIComponent(record.hash)}`;
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
        const transaction = await client.getTransaction(record.hash);
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

async function recordTransaction(transactionHash, amount, address = account.address, action = "transfer") {
  const { transactionHistory = {} } = await chrome.storage.local.get("transactionHistory");
  const records = transactionHistory[address] || [];
  transactionHistory[address] = [{ hash: transactionHash, amount: formatCkb(amount), time: Date.now(), status: "pending", action }, ...records].slice(0, 30);
  await chrome.storage.local.set({ transactionHistory });
  if (account?.address === address) renderTransactionHistory(transactionHistory[address]);
}

function showWalletPanel(panel) {
  const history = panel === "history";
  const dao = panel === "dao";
  elements.transferForm.hidden = history || dao;
  elements.daoPanel.hidden = !dao;
  elements.historyPanel.hidden = !history;
  elements.sendTab.classList.toggle("active", !history && !dao);
  elements.daoTab.classList.toggle("active", dao);
  elements.historyTab.classList.toggle("active", history);
  elements.sendTab.setAttribute("aria-selected", String(!history && !dao));
  elements.daoTab.setAttribute("aria-selected", String(dao));
  elements.historyTab.setAttribute("aria-selected", String(history));
  if (history) loadTransactionHistory();
  if (dao) {
    loadDaoCells();
    if (daoCountdownTimer === null) {
      daoCountdownTimer = setInterval(() => {
        updateDaoCountdowns();
        if (daoTipHeader && Date.now() - daoTipFetchedAt >= 5 * 60_000) refreshDaoTipHeader();
      }, 60_000);
    }
  } else if (daoCountdownTimer !== null) {
    clearInterval(daoCountdownTimer);
    daoCountdownTimer = null;
  }
}

async function persistShrincsSignMode(mode) {
  const expectedAccount = account;
  await navigator.locks.request("ckb-wallet-storage", async () => {
    const vault = await getActiveShrincsVault(expectedAccount);
    if (!vault.shrincsState || (vault.imported && mode !== "stateless")) throw new Error(t("missingData"));
    const shrincsState = { ...vault.shrincsState, mode };
    await updateStoredAccount({ ...vault, version: VAULT_VERSION, shrincsState });
    expectedAccount.shrincsState = shrincsState;
  });
}

async function openAccountSwitcher() {
  const accounts = await getStoredAccounts();
  elements.accountList.replaceChildren();
  setStatus(elements.accountListStatus);
  if (accounts.length < 2) {
    setStatus(elements.accountListStatus, t("accountListEmpty"));
  }
  for (const storedAccount of accounts) {
    const storedClient = storedAccount.address?.startsWith("ckb1") ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet();
    const displayAddress = storedAccount.address
      ? ccc.Address.fromScript((await ccc.Address.fromString(storedAccount.address, storedClient)).script, client).toString()
      : storedAccount.publicKey;
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.disabled = displayAddress === account?.address || (config.current !== config.testnet && storedAccount.accountType === "shrincs");
    const title = document.createElement("strong");
    title.textContent = storedAccount.accountType || DEFAULT_ACCOUNT_TYPE;
    const address = document.createElement("span");
    address.textContent = displayAddress;
    button.append(title, address);
    button.addEventListener("click", () => switchAccount(storedAccount));
    elements.accountList.append(button);
  }
  showView("switch-account");
}

async function switchAccount(storedAccount) {
  if (walletOperationInProgress) {
    setStatus(elements.accountListStatus, "Wait for signing to finish before switching accounts.", "error");
    return;
  }
  return navigator.locks.request("ckb-wallet-storage", () => switchAccountUnlocked(storedAccount));
}

async function switchAccountUnlocked(storedAccount) {
  setStatus(elements.accountListStatus, t("verifyingPassword"));
  elements.accountList.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  try {
    if (!walletPassword) throw new Error(t("walletLocked"));
    const decrypted = await decryptPrivateKey(storedAccount, walletPassword);
    vaultEncryptionKey = decrypted.encryptionKey;
    const privateKey = storedAccount.accountType === "shrincs" ? decrypted.shrincsSecretKey : decrypted.privateKey;
    await saveAccounts(await getStoredAccounts(), storedAccount);
    await enterWallet({ accountType: storedAccount.accountType || DEFAULT_ACCOUNT_TYPE, privateKey, publicKey: storedAccount.publicKey, shrincsState: storedAccount.shrincsState, imported: Boolean(storedAccount.imported), expectedAddress: storedAccount.address, preparedKey: decrypted.shrincsPreparedKey });
  } catch (error) {
    setStatus(elements.accountListStatus, t("accountSwitchError", { error: error.message }), "error");
    elements.accountList.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  }
}

elements.generateButton.addEventListener("click", generateWallet);
elements.welcomeStartButton.addEventListener("click", () => showView("set-password"));
elements.setPasswordBackButton.addEventListener("click", () => showView("welcome"));
elements.setPasswordButton.addEventListener("click", confirmWalletPassword);
elements.newAccountButton.addEventListener("click", () => showView("create"));
elements.showImportButton.addEventListener("click", () => showView("import"));
elements.setupBackButton.addEventListener("click", () => showView(accountCreationReturnView));
elements.createBackButton.addEventListener("click", () => showView(accountCreationReturnView));
elements.importBackButton.addEventListener("click", () => showView(accountCreationReturnView));
elements.setupAccountType.addEventListener("change", updateSetupAccountType);
elements.importAccountType.addEventListener("change", () => {
  elements.setupAccountType.value = elements.importAccountType.value;
  updateSetupAccountType();
});
elements.saveWalletButton.addEventListener("click", saveWallet);
elements.unlockButton.addEventListener("click", async () => {
  const unlocked = await unlockWallet();
  if (unlocked && providerRequest) showView("provider-confirm");
});
elements.refreshButton.addEventListener("click", refreshBalance);
elements.transferForm.addEventListener("submit", sendTransfer);
elements.providerConfirmButton.addEventListener("click", completeProviderRequest);
elements.providerRejectButton.addEventListener("click", rejectProviderRequest);
elements.copyAddressButton.addEventListener("click", () => copyAddress().catch(() => setStatus(elements.walletStatus, t("copyError"), "error")));
elements.exportButton.addEventListener("click", () => exportWallet().catch((error) => setStatus(elements.walletStatus, t("exportError", { error: error.message }), "error")));
elements.settingsButton.addEventListener("click", openSettings);
elements.settingsBackButton.addEventListener("click", () => showView(viewBeforeSettings));
elements.networkSettingsButton.addEventListener("click", () => {
  elements.networkSelect.value = config.current === config.mainnet ? "mainnet" : config.current === config.develop ? "devnet" : "testnet";
  if (!elements.devnetRpcUrl.value) elements.devnetRpcUrl.value = config.develop.rpc;
  updateNetworkForm();
  setStatus(elements.networkStatus);
  showView("network");
});
elements.networkBackButton.addEventListener("click", () => showView("settings"));
elements.networkSelect.addEventListener("change", updateNetworkForm);
elements.networkApplyButton.addEventListener("click", async () => {
  elements.networkApplyButton.disabled = true;
  setStatus(elements.networkStatus);
  try {
    await applyNetworkSelection();
  } catch (error) {
    setStatus(elements.networkStatus, t("networkChangeError", { error: error.message }), "error");
  } finally {
    elements.networkApplyButton.disabled = false;
  }
});
elements.settingsLockButton.addEventListener("click", lockWallet);
elements.settingsCreateAccountButton.addEventListener("click", () => openAccountCreation("settings"));
elements.settingsChangePasswordButton.addEventListener("click", () => showView("change-password"));
elements.changePasswordCancelButton.addEventListener("click", () => showView("settings"));
elements.deleteAccountButton.addEventListener("click", () => showView("reset-confirm"));
elements.resetCancelButton.addEventListener("click", () => showView("settings"));
elements.switchAccountButton.addEventListener("click", () => openAccountSwitcher().catch((error) => setStatus(elements.walletStatus, t("accountSwitchError", { error: error.message }), "error")));
elements.switchAccountBackButton.addEventListener("click", () => showView("wallet"));
elements.settingsSignMode.addEventListener("change", () => {
  if (account?.accountType !== "shrincs") return;
  if (walletOperationInProgress) {
    elements.settingsSignMode.value = account.shrincsState.mode;
    return;
  }
  if (account.imported) {
    elements.settingsSignMode.value = "stateless";
    account.shrincsState.mode = "stateless";
    updateSignModeOptions(account.accountType, account.imported);
    return;
  }
  account.shrincsState.mode = elements.settingsSignMode.value;
  persistShrincsSignMode(account.shrincsState.mode).catch((error) => setStatus(elements.walletStatus, t("accountSwitchError", { error: error.message }), "error"));
  updateSignModeOptions(account.accountType, account.imported);
});
elements.changePasswordButton.addEventListener("click", changeWalletPassword);
elements.sendTab.addEventListener("click", () => showWalletPanel("send"));
elements.daoTab.addEventListener("click", () => showWalletPanel("dao"));
elements.historyTab.addEventListener("click", () => showWalletPanel("history"));
elements.daoRefreshButton.addEventListener("click", () => loadDaoCells());
elements.daoDepositForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const amount = parseCkbAmount(elements.daoAmount.value, 0n);
    performDaoAction("deposit", { amount });
  } catch (error) {
    setStatus(elements.daoStatus, t("daoActionError", { error: error.message }), "error");
  }
});
elements.daoCells.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-dao-action]");
  if (!button) return;
  const cell = daoCells[Number(button.dataset.daoIndex)];
  if (cell) performDaoAction(button.dataset.daoAction, { cell });
});
elements.languageSelect.addEventListener("change", async () => {
  language = elements.languageSelect.value;
  await chrome.storage.local.set({ language });
  applyTranslations();
  renderDaoCells();
});
elements.resetConfirmButton.addEventListener("click", async () => {
  if (walletOperationInProgress) return;
  const remainingAccounts = await navigator.locks.request("ckb-wallet-storage", async () => {
    const { vault } = await chrome.storage.local.get("vault");
    const accounts = await getStoredAccounts();
    const remaining = accounts.filter((entry) => accountIdentifier(entry) !== accountIdentifier(vault || {}));
    if (remaining.length > 0) await saveAccounts(remaining, remaining[0]);
    else await chrome.storage.local.remove(["vault", "accounts"]);
    return remaining;
  });
  const preservedPassword = walletPassword;
  lockWallet();
  walletPassword = preservedPassword;
  if (preservedPassword) await saveLoginSession(preservedPassword);
  updateDeleteAccountButton(remainingAccounts.length > 0);
  updateSignModeOptions();
  elements.unlockPassword.value = "";
  elements.privateKey.value = "";
  if (remainingAccounts.length > 0) {
    await openAccountSwitcher();
  } else {
    elements.setupBackButton.hidden = true;
    showView("setup");
  }
});

(async () => {
  if (providerRequestId) {
    showView("provider-confirm");
    elements.providerConfirmButton.disabled = true;
    elements.providerRejectButton.disabled = true;
    setStatus(elements.providerConfirmStatus, "Loading signing request…");
  }
  const { vault, accounts, language: storedLanguage } = await chrome.storage.local.get(["vault", "accounts", "language"]);
  language = storedLanguage === "zh-CN" ? "zh-CN" : "en-US";
  elements.languageSelect.value = language;
  applyTranslations();
  updateSignModeOptions();
  await restoreNetworkPreference();
  if (providerRequestId) {
    try {
      await loadProviderRequest();
    } catch (error) {
      setStatus(elements.providerConfirmStatus, t("providerRequestError", { error: error.message }), "error");
      showView("provider-confirm");
      return;
    }
  }
  updateDeleteAccountButton(Boolean(vault || (Array.isArray(accounts) && accounts.length > 0)));
  const { walletCredential } = await chrome.storage.local.get("walletCredential");
  if (!vault && !walletCredential) {
    showView("set-password");
    return;
  }
  const sessionPassword = await getLoginSessionPassword();
  if (sessionPassword && await unlockWallet(sessionPassword, true)) {
    if (providerRequest) showView("provider-confirm");
    return;
  }
  showView("unlock");
})();
