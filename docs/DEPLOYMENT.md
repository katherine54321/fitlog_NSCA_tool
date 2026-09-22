# FitMine 部署与云端配置

## 1. 创建 Supabase 项目

1. 新建一个 Production 项目，并在 SQL Editor 执行 `supabase/migrations/0001_fitlog_schema.sql`。
2. Authentication 中开启 Email OTP；生产环境建议同时配置 Sign in with Apple。
3. 将生产 Web 域名配置为 Site URL，例如 `https://app.example.com/`。
4. 在 Edge Functions 中部署 `supabase/functions/delete-account`。服务端保存的 `SUPABASE_SERVICE_ROLE_KEY` 绝不能进入网页、iOS 包或 Git。

## 2. 配置邮箱验证码模板

在 **Authentication > Email Templates > Magic Link** 中，将邮件内容改为展示一次性验证码：

```html
<p>你的 FitMine 登录验证码是：</p>
<p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">{{ .Token }}</p>
```

FitMine 会在应用内验证 6 位一次性验证码，再建立本地登录会话。开发阶段 `Site URL` 应为 `http://localhost:4173`；生产环境必须改为实际的 HTTPS 域名。不要将验证码发给任何人。

## 3. 配置生产构建

构建环境设置以下变量，再执行 `pnpm build`：

```text
FITLOG_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
FITLOG_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

当前生产测试地址为 `https://fitlog-science-fitness.katherine54321.workers.dev/`；正式绑定自定义域名后，将 Supabase 的 Site URL 一并替换为自定义 HTTPS 域名。

构建产物是 `dist-pwa/`。其中的 `config/fitlog-runtime.js` 只允许包含 Supabase URL 与 anon key；不可写入数据库密码、service role key 或 Apple 私钥。

## 4. 上线前检查

- 在 Supabase Authentication 配置真实发信域名和模板。
- 用两个不同账户验证：登录、首次备份、换设备恢复、退出、删除账户。
- 验证 RLS：A 用户无法读写 B 用户的计划、记录和评估。
- 为数据库启用备份、设置访问告警，并定期演练恢复。
- 将 `legal/privacy.html` 和 `legal/support.html` 部署到公开 HTTPS 域名，替换模板中的支持邮箱。

## 5. 数据迁移策略

当前 App 仍以 localStorage 为本地优先存储。登录后，`sync/fitlog-sync.js` 将现有 `fitlog-*` 数据生成加密传输快照，写入 `user_sync_snapshots`。这是兼容迁移层；后续将计划、训练记录和评估分别写入结构化表，历史数据不会因动作库更新而改变。
