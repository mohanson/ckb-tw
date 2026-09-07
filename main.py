import pyckb

pyckb.config.current = pyckb.config.testnet

user = pyckb.wallet.Wallet(1)
# ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt4z78ng4yutl5u6xsv27ht6q08mhujf8s2r0n40
hole = pyckb.wallet.Wallet(2)
# ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqdrcaufs8qeu8wvvy0myyedek4vqad9qeq3gc4cf

dest = pyckb.core.Script.addr_decode('ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqtqdupwutx6pky203uwwuh2202jw6nm6vg9qh65h')
txid = user.transfer(dest, 1000 * pyckb.denomination.ckbytes)

print(txid.hex())


# 0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
