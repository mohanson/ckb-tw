# 1

帮我编写一个 ckb 区块链的浏览器钱包插件. 功能

1. 允许导入或自动生成私钥.
    1. 导入的私钥以 16 进制表示, 不要使用助记词.
    2. 生成钱包时随机生成密码学安全的私钥.
2. 允许导出私钥.
3. 可查看账户余额.
4. 可在测试网上进行转账交易.

# 2

目前钱包用的是测试网默认的 secp256k1 签名(code_hash: 9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8), 后续我想支持其它类型的签名算法, 你目前做以下几个修改:

1. 导入或者生成私钥的时候, 账户类型是可选的. 目前可以只支持一个账户类型, 叫做 secp256k1 就可以了; 用户解锁钱包后, 会在地址后面显示账户类型, 并且可以修改账户类型.

# 3

阅读 https://delvingbitcoin.org/t/shrincs-324-byte-stateful-post-quantum-signatures-with-static-backups/2158, 我想尝试在 ckb 钱包里实现 shrincs 签名. 账户类型增加 shrincs, 但是由于 shrincs 目前尚未在测试网部署, 你可以假设 shrincs 脚本的 code_hash, cell_dep 的 out_point 的 tx_hash 等数据都为零.

- 尽量使用 stateful 签名, 因为该签名的 signature 较小. 尽量不用 stateless 签名, 签名很大.
- 当导入 secret key 时, 需要将该 key 的 stateful 签名禁止掉. 因为不清楚导出时, 该 key 是否使用了 stateful 签名.
- stateless 签名时, 耗时较长, 需要在 UI 上提示, 同时提供进度条
