import pyckb

pyckb.config.current = pyckb.config.testnet

acc1 = pyckb.wallet.Wallet(1)
# ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt4z78ng4yutl5u6xsv27ht6q08mhujf8s2r0n40
acc2 = pyckb.wallet.Wallet(2)
# ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqdrcaufs8qeu8wvvy0myyedek4vqad9qeq3gc4cf

acc3_seed = 0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001
acc3_script = pyckb.core.Script.addr_decode('ckt1qqu8f9h6ler9v2anhvh6g3r0rlqs2jaz7x6d7g563qzk64pz5xt2cqgqqqqqqqqqqqqqqqqqqqqqqqqpmy0pkhmfg04h04lwrhm33len3q8uyk8p')
txid = acc1.transfer(acc3_script, 1000 * pyckb.denomination.ckbytes)
print(txid.hex())
