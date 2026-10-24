# FitMine App Store 素材说明

## 中文 iPhone 截图

目录：`screenshots-zh/`

所有图片均为 `1290 × 2796` PNG、RGB 无透明通道，符合 App Store Connect 接受的 6.9 英寸 iPhone 竖屏尺寸之一。画面由真实 FitMine 页面与演示训练数据生成，不包含真实账户、邮箱或验证码。

建议上传顺序：

1. `01-home-overview.png`：今日计划、四周完成进度与训练日历。
2. `02-periodized-plan.png`：周期化计划、负荷指标与四周微周期。
3. `03-workout-exercises.png`：训练日动作清单及“记录数据/查看数据”状态。
4. `04-per-set-logging.png`：固定计划组数，逐组填写重量和次数。
5. `05-exercise-details.png`：动作示意、收藏、训练肌群与动作步骤。
6. `06-strength-trends.png`：历史峰值、最近 1RM、净变化及力量趋势图。

## 重新生成

在项目根目录运行：

```powershell
node scripts/capture-app-store-screenshots.mjs
```

脚本会启动本地预览和隐藏的无头 Edge，写入隔离的演示数据后重新生成以上 6 张截图，不会读取或修改真实用户数据。

## 正式提交前

- 会员和签名配置完成后，再用 TestFlight 真机版本复核界面是否与这些素材一致。
- 如果最终 iOS WebView 与 PWA 出现任何视觉差异，应以真机重新截取对应画面。
- 上线前不要把测试邮箱、验证码、Apple ID 或真实健康信息放入截图。

