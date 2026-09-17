# FitLog 科学健身助手

FitLog 是一个基于 NSCA-CPT 的移动端科学训练助手 PWA，提供动作库、风险与体能自评、训练计划和训练记录。当前版本支持离线使用；配置 Supabase 后可使用邮箱登录、云端备份、跨设备恢复与账户删除。

## 技术组成

- 前端：原生 HTML/CSS/JavaScript PWA，训练内容与动作库随包发布。
- 原生壳：Capacitor iOS，工程位于 `ios/`。
- 云端：Supabase Auth、PostgreSQL、Row Level Security、Edge Function。
- 数据：迁移脚本位于 `supabase/migrations/0001_fitlog_schema.sql`。

## 本地开发

项目使用 pnpm 锁定依赖：

```bash
pnpm install
pnpm dev
```

打开 `http://localhost:4173`。PWA 生产构建与测试：

```bash
pnpm build
pnpm test
```

构建产物是 `dist-pwa/`，可部署到任何 HTTPS 静态托管服务。

## iOS

```bash
pnpm ios:sync
pnpm ios:open
```

首次安装依赖后，`ios/` 已包含 Capacitor Xcode 工程。必须在 macOS 上使用 Xcode 配置签名、CocoaPods、真机运行、Archive 和上传 App Store Connect。

## 云端配置

复制 `.env.example` 中的变量到部署平台。详细步骤见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。`SUPABASE_SERVICE_ROLE_KEY` 只能放在 Supabase Edge Function 环境变量中，绝不能进入浏览器配置或 App 包。

## 发布材料

- [App Store 提交包](docs/APP_STORE_SUBMISSION.md)
- [隐私政策](legal/privacy.html)
- [支持页面](legal/support.html)
- [部署与云端配置](docs/DEPLOYMENT.md)
