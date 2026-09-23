# ckb-tw Wallet-Web Communication Protocol

This document defines the Provider communication protocol between a web page and the `ckb-tw` wallet. The protocol is used to:

- Query the current wallet account.
- Request the wallet to sign a complete CKB transaction.
- Receive the signed transaction and broadcast it from the web page.

## Connectivity

The wallet injects the following object into the web page:

```js
window.ckb
```

The Provider exposes the following basic properties and methods:

|     Field     |   Type     |             Description                 |
| ------------- | ---------- | --------------------------------------- |
| `isCkbWallet` | `boolean`  | Always `true`; identifies the ckb-tw Provider |
| `request`     | `function` | Sends a wallet request                  |

The web page sends requests in the following form:

```js
window.ckb.request({
  method: string,
  params?: array,
})
```

This is a Provider request protocol, not a direct call to internal wallet functions.

## API

The request object contains the following fields:

|  Field   |  Type    | Required |          Description          |
| -------- | -------- | ---- | -------------------------------- |
| `method` | `string` | Yes  | Wallet method name               |
| `params` | `array`  | No   | Method parameters; defaults to an empty array |

Currently supported methods:

|         Method        |      Purpose     | `params` type | Return type |
| --------------------- | ---------------- | --------------- | ------------- |
| `ckb_requestAccounts` | Request the current wallet account | `[]` | `string[]` |
| `ckb_signTransaction` | Request signing of a complete transaction | `[Transaction]` | `Transaction` |

- `Transaction` is a JSON object that uses the CKB/CCC camelCase field names.

## Error

When a request fails, the Promise rejects with an error object:

```text
{
  code: number,
  message: string
}
```

Current error codes:

|   Code   |             Meaning              |
| -------- | ---------------------------------- |
| `4001`   | User rejected the request, the request timed out, or the request is no longer valid |
| `4100`   | Wallet is not initialized           |
| `-32601` | Requested method is not supported   |
| `-32603` | Internal wallet error               |
