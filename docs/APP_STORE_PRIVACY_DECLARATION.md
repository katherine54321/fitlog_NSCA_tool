# FitMine App Store 隐私申报材料

更新时间：2026 年 10 月 24 日

本材料依据当前 iOS 版本的实际实现编制：App 可离线使用；用户选择邮箱 OTP 登录后，Supabase 会保存账户与同步数据；Resend 用于发送验证码邮件；当前无广告、第三方分析、跨 App 跟踪、HealthKit、定位、通讯录、相机、麦克风或支付功能。

## 一、App Store Connect 基础填写

| 项目 | 填写内容 |
| --- | --- |
| Privacy Policy URL | `https://fitminetech.com/legal/privacy.html` |
| User Privacy Choices URL | `https://fitminetech.com/legal/privacy-choices.html` |
| 是否收集数据 | **Yes, we collect data from this app** |
| 是否用于跟踪 | **No** |
| 是否需要 ATT 弹窗 | **No**，当前不访问 IDFA，也不进行跨 App/网站跟踪 |

## 二、Data Types 勾选项

在 **App Privacy → Data Types → Edit** 中勾选以下项目：

1. **Contact Info → Email Address**
2. **Health & Fitness → Health**
3. **Health & Fitness → Fitness**
4. **Identifiers → User ID**
5. **Usage Data → Product Interaction**
6. **Diagnostics → Other Diagnostic Data**

不要勾选 Name、Phone Number、Location、Contacts、Photos or Videos、Audio Data、Search History、Device ID、Purchases、Advertising Data、Crash Data 或 Performance Data。当前版本没有采集这些数据的功能或 SDK。

## 三、逐项问卷答案

### 1. Email Address

| 问题 | 选择 |
| --- | --- |
| 用途 | **App Functionality** |
| 是否关联用户身份 | **Yes** |
| 是否用于跟踪 | **No** |

说明：邮箱用于 OTP 登录、账户认证和必要的账户邮件，不用于营销。

### 2. Health

| 问题 | 选择 |
| --- | --- |
| 用途 | **App Functionality**、**Product Personalization** |
| 是否关联用户身份 | **Yes** |
| 是否用于跟踪 | **No** |

说明：包括用户主动填写的训练前风险问卷、年龄、生理性别、体重、心率，以及心肺和力量评估输入与结果。登录并同步后，这些数据与用户 ID 关联，用于安全提示和个性化训练内容。

### 3. Fitness

| 问题 | 选择 |
| --- | --- |
| 用途 | **App Functionality**、**Product Personalization** |
| 是否关联用户身份 | **Yes** |
| 是否用于跟踪 | **No** |

说明：包括训练目标、计划、动作、组数、次数、重量、完成状态、训练容量和趋势数据，用于记录、同步及生成训练建议。

### 4. User ID

| 问题 | 选择 |
| --- | --- |
| 用途 | **App Functionality** |
| 是否关联用户身份 | **Yes** |
| 是否用于跟踪 | **No** |

说明：Supabase 为账户生成 UUID，用于数据归属、行级安全和账户删除。

### 5. Product Interaction

| 问题 | 选择 |
| --- | --- |
| 用途 | **App Functionality** |
| 是否关联用户身份 | **Yes** |
| 是否用于跟踪 | **No** |

说明：同步快照可能包含语言设置、收藏动作、计划偏好和完成状态，仅用于恢复用户在 App 内的设置和进度，不用于分析或广告。

### 6. Other Diagnostic Data

| 问题 | 选择 |
| --- | --- |
| 用途 | **App Functionality** |
| 是否关联用户身份 | **Yes** |
| 是否用于跟踪 | **No** |

说明：Supabase 认证与接口安全日志可能保留 IP 地址、User-Agent、请求时间和认证事件，用于速率限制、防滥用、故障排查和服务安全。认证日志可包含用户 ID，因此按“关联用户”申报。

## 四、App Store 隐私标签预期

### Data Linked to You

- Contact Info：Email Address
- Health & Fitness：Health、Fitness
- Identifiers：User ID
- Usage Data：Product Interaction
- Diagnostics：Other Diagnostic Data

### Data Used to Track You

- **None**

## 五、审核备注（可直接粘贴）

### 中文

FitMine 可在不登录的情况下离线使用主要功能。用户只有在主动选择邮箱验证码登录并同意隐私政策后，才会启用 Supabase 云端备份与跨设备同步。同步数据包括训练计划、训练记录、体能与风险评估、收藏和 App 偏好，并与 Supabase 用户 ID 关联。Supabase 认证服务可能为安全和防滥用保留 IP、User-Agent 和认证事件日志。Resend 仅用于发送登录验证码邮件。App 不包含广告或第三方分析 SDK，不访问 IDFA，不进行跨 App 或网站跟踪。用户可在“我的 → 账户与同步 → 删除账户与云端数据”中直接删除账户和关联云端数据。

### English

FitMine's main features can be used offline without signing in. Supabase cloud backup and cross-device sync are enabled only after the user voluntarily signs in with an email verification code and accepts the privacy policy. Synced data includes training plans, workout records, fitness and risk assessments, favorites, and app preferences, and is linked to the Supabase user ID. Supabase authentication may retain IP address, user-agent, and authentication event logs for security and abuse prevention. Resend is used only to deliver login verification emails. The app contains no advertising or third-party analytics SDK, does not access IDFA, and does not track users across apps or websites. Users can delete their account and associated cloud data in My → Account & Sync → Delete account and cloud data.

## 六、与二进制和公开页面的一致性

- iOS 隐私清单：`ios/App/App/PrivacyInfo.xcprivacy`
- 隐私政策：`legal/privacy.html`
- 隐私选择：`legal/privacy-choices.html`
- 账户删除：App 内“我的 → 账户与同步 → 删除账户与云端数据”
- 支持邮箱：`support@fitminetech.com`
- 数据处理服务商：Supabase、Resend

## 七、提交前核对

- [ ] 两个隐私 URL 在未登录浏览器中均返回 HTTPS 200。
- [ ] App Store Connect 6 个数据类型与本文件一致。
- [ ] 所有类型均选择“不用于跟踪”。
- [ ] Health 与 Fitness 同时勾选 App Functionality、Product Personalization。
- [ ] 其余四项仅勾选 App Functionality。
- [ ] Product Page Preview 显示“Data Linked to You”，不出现“Data Used to Track You”。
- [ ] TestFlight 包内包含最新 `PrivacyInfo.xcprivacy`。
- [ ] 真机验证不登录可使用、登录同步正常、删除账户后云端记录删除。
- [ ] 若以后接入分析、崩溃统计、订阅、HealthKit 或广告 SDK，先更新本申报和隐私政策再发版。

## 依据

- Apple：App Privacy Details — https://developer.apple.com/app-store/app-privacy-details/
- Apple：Manage App Privacy — https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Supabase：Auth Audit Logs — https://supabase.com/docs/guides/auth/audit-logs
