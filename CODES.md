# 验证码说明（恋爱脑测试）

- 格式：`LB` + 4 位字符，字符表 `ABCDEFGHJKMNPQRSTUVWXYZ23456789`（无 I/L/O/0/1）
- 示例形态：`LBXXXX`（此处不公布可售卖码）
- 每码最多使用 **3 次**（跨设备共享计数，由 vault 扣次）
- 订单号不是验证码，不走 vault 的 `/redeem`。只接受 `P` + 18 位；重复块、逐位 ±1 和 19 位会拒绝。格式通过后页面直接开始。刷新、继续这一次、查看上次结果不改变次数提示。提示到「这是最后一次」之后仍可进入，提示为「验证成功」
- **重新测试**（验证码）：清除会话解锁后需再次输入码并 redeem，会再扣 1 次
- **查看上次结果**：只读本机 `localStorage`，不扣次
- 本仓库**不**存放可卖验证码明文

造码（本机 companion，勿把码写进 git）：

```bash
/workspace/quiz-code-api/scripts/mint.sh love <CODE> 3
```

或见 `tools/mint.sh` 说明。
