# Privacy Policy

**Effective date: September 11, 2026**

CKB Testnet Wallet (the "Extension") is a testnet-only wallet extension for the CKB blockchain. This policy explains how information is handled when you use the Extension.

## Information We Collect

The developer does not collect, sell, share, or use your personal information for advertising, analytics, or tracking. The Extension does not include analytics or telemetry services.

## Information Stored on Your Device

The Extension uses Chrome's local extension storage to save:

- Your private key or seed and related signing material, encrypted with AES-256-GCM using a key derived from your password with PBKDF2-SHA-256.
- Wallet metadata required to operate the account, including the account type, public key, address, and SHRINCS signing state.
- Your language and signing-mode preferences.
- Up to 30 recent transaction records per wallet address, including transaction hashes, amounts, timestamps, and confirmation status.

Your password is used locally to derive the encryption key and is not stored. Decrypted private keys and signing material are held in memory only while the wallet is unlocked. Wallet backup files are created locally at your request and may contain an unencrypted private key or seed; you are responsible for securing and deleting those files.

Chrome's `storage.local` area does not synchronize this information between browsers through Chrome Sync.

## Network Communications

To provide wallet functionality, the Extension communicates with the public CKB testnet RPC service at `https://testnet.ckb.dev`. Requests may include wallet addresses or lock scripts, transaction hashes, and signed transactions. Signed transactions become public blockchain data when broadcast. Private keys, seeds, passwords, and decrypted signing material are not sent to the RPC service.

When you choose to open a transaction in the CKB testnet explorer, your browser visits `https://pudge.explorer.nervos.org` with the public transaction hash in the URL.

These third-party services may receive technical information normally sent with web requests, such as your IP address and browser information. Their handling of that information is governed by their own privacy policies and practices, not this policy.

## Permissions

The Extension requests only the following permissions:

- **Storage:** Save encrypted wallet data, wallet metadata, preferences, and transaction history locally.
- **Side panel:** Display the wallet in Chrome's side panel.
- **Access to `https://testnet.ckb.dev/*`:** Query testnet blockchain data and broadcast signed testnet transactions.

## Retention and Deletion

Local information remains in the Extension's storage until you delete the wallet data or uninstall the Extension. Deleting an account removes its local encrypted wallet vault, but locally stored transaction history may remain until the Extension is uninstalled or its site data is cleared. Data already broadcast to the CKB testnet is public blockchain data and cannot be deleted by the Extension or its developer.

## Security

The Extension uses browser cryptography APIs to protect locally stored secret material. No method of storage or transmission is completely secure. Keep your password and backups private, and use this beta Extension only with CKB testnet assets. Do not use mainnet keys or assets.

## Children's Privacy

The Extension is not directed to children under 13, and the developer does not knowingly collect personal information from children.

## Changes to This Policy

This policy may be updated if the Extension's data practices change. The effective date above will be revised when an update is published.

## Contact

For privacy questions or requests, open an issue at [github.com/mohanson/ckb-web-wallet/issues](https://github.com/mohanson/ckb-web-wallet/issues).
