# FitMine App Store 隐私申报材料

更新时间：2026 年 10 月 28 日

本材料依据当前 iOS 版本的实际实现编制：App 可离线使用；用户选择邮箱 OTP 登录后，Supabase 会保存账户与同步数据；Resend 用于发送验证码邮件；当前无广告、第三方分析、跨 App 跟踪、HealthKit、定位、通讯录、相机、麦克风或支付功能。

## 一、App Store Connect 基础填写

| 项目 | 填写内容 |
| --- | --- |
| Privacy Policy URL（英语区） | `https://fitminetech.com/legal/privacy-en.html` |
| User Privacy Choices URL（英语区，可选） | `https://fitminetech.com/legal/privacy-choices-en.html` |
| 是否收集数据 | **Yes, we collect data from this app** |
| 是否用于跟踪 | **No** |
| 是否需要 ATT 弹窗 | **No**，当前不访问 IDFA，也不进行跨 App/网站跟踪 |

## 二、Data Types 勾选项

在 **App Privacy → Data Types → Edit** 中，下面前四项由当前登录和同步实现支持；后两项是现有申报草稿和 iOS 隐私清单中的候选项，须核实服务端实际采集与用途后再定稿：

1. **Contact Info → Email Address**
2. **Health & Fitness → Health**
3. **Health & Fitness → Fitness**
4. **Identifiers → User ID**
5. **Usage Data → Product Interaction（待核实分类）**
6. **Diagnostics → Other Diagnostic Data（待核实分类）**

代码中未发现采集 Name、Phone Number、Location、Contacts、Photos or Videos、Audio Data、Device ID、Purchases 或 Advertising Data 的功能或 SDK；正式提交前仍须以最终 IPA、SDK 清单与服务商配置复核。特别是支持邮件如由 App 内表单或 SDK 发送，须重新判断 **User Content → Customer Support**。

## 三、逐项问卷预填答案（第 5、6 项待核实）

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
| 用途 | **App Functionality（如确认需要申报）** |
| 是否关联用户身份 | **Yes（如确认需要申报）** |
| 是否用于跟踪 | **No** |

说明：同步快照包含语言设置、收藏动作、计划偏好和完成状态，仅用于恢复用户在 App 内的设置和进度，不用于分析或广告。Apple 将 App 点击、收藏等交互归入 Product Interaction 的可能性需要结合实际同步字段确认；不能仅因保存偏好就断言该类别必选。

### 6. Other Diagnostic Data

| 问题 | 选择 |
| --- | --- |
| 用途 | **App Functionality（如确认需要申报）** |
| 是否关联用户身份 | **Yes（如确认需要申报且可关联）** |
| 是否用于跟踪 | **No** |

说明：Supabase 官方 Auth Audit Logs 示例包含用户 ID、IP 地址、User-Agent、时间及认证事件。须核实生产项目是否保留该日志、保存多久、日志用途及能否关联账号。Apple 的 Other Diagnostic Data 指为测量 App 技术诊断而采集的其他数据；**不能自动把所有安全/认证日志归入该类**。如目的仅为认证和安全，应依据 Apple 定义确认是否属于其他类别，必要时调整申报及 `PrivacyInfo.xcprivacy`。

## 四、App Store 隐私标签预期

### Data Linked to You（待后台核实的预期）

- Contact Info：Email Address
- Health & Fitness：Health、Fitness
- Identifiers：User ID
- Usage Data：Product Interaction（待核实）
- Diagnostics：Other Diagnostic Data（待核实）

### Data Used to Track You

- **None**

## 五、审核备注（可直接粘贴）

### 中文

FitMine 可在不登录的情况下离线使用主要功能。用户只有在主动选择邮箱验证码登录并同意隐私政策后，才会启用 Supabase 云端备份与跨设备同步。同步数据包括训练计划、训练记录、体能与风险评估、收藏和 App 偏好，并与 Supabase 用户 ID 关联。Supabase 认证服务可能为安全和防滥用保留 IP、User-Agent 和认证事件日志。Resend 仅用于发送登录验证码邮件。App 不包含广告或第三方分析 SDK，不访问 IDFA，不进行跨 App 或网站跟踪。用户可在“我的 → 账户与同步 → 删除账户与云端数据”中直接删除账户和关联云端数据。

### English

FitMine's main features can be used offline without signing in. Supabase cloud backup and cross-device sync are enabled only after the user voluntarily signs in with an email verification code and accepts the privacy policy. Synced data includes training plans, workout records, fitness and risk assessments, favorites, and app preferences, and is linked to the Supabase user ID. Supabase authentication may retain IP address, user-agent, and authentication event logs for security and abuse prevention. Resend is used only to deliver login verification emails. The app contains no advertising or third-party analytics SDK, does not access IDFA, and does not track users across apps or websites. Users can delete their account and associated cloud data in My → Account & Sync → Delete account and cloud data.

## 六、与二进制和公开页面的一致性

- iOS 隐私清单：`ios/App/App/PrivacyInfo.xcprivacy`
- 英文隐私政策：`legal/privacy-en.html`
- 英文隐私选择：`legal/privacy-choices-en.html`
- 英文支持：`legal/support-en.html`
- 账户删除：App 内“我的 → 账户与同步 → 删除账户与云端数据”
- 支持邮箱：`support@fitminetech.com`
- 数据处理服务商：Supabase、Resend

## 七、提交前核对

- [ ] 英文隐私、隐私选择和支持 URL 在未登录浏览器中均返回 HTTPS 200。
- [ ] 核实下节待确认信息后，确定 Data Types；App Store Connect、iOS 隐私清单及政策保持一致。
- [ ] 所有类型均选择“不用于跟踪”。
- [ ] Health 与 Fitness 同时勾选 App Functionality、Product Personalization。
- [ ] 确定其余项目的实际用途与 Apple 数据类别，避免把安全日志直接等同于诊断数据。
- [ ] Product Page Preview 中的关联数据与实际处理一致；若未启用跨 App/网站跟踪，不出现“Data Used to Track You”。
- [ ] TestFlight 包内包含最新 `PrivacyInfo.xcprivacy`。
- [ ] 真机验证不登录可使用、登录同步正常、删除账户后云端记录删除。
- [ ] 若以后接入分析、崩溃统计、订阅、HealthKit 或广告 SDK，先更新本申报和隐私政策再发版。

## 八、隐私申报定稿前需要取得的信息

| 需要核实 | 在哪里核实 | 影响 |
| --- | --- | --- |
| App Store Connect 中的开发者/销售者法定名称、运营主体 FitMine 的法律身份及联系地址 | Apple Developer 账户和运营主体资料 | 确保政策中的运营者、联系方式与商店资料一致，尤其是海外上架 |
| 最终 IPA 是否包含额外分析、崩溃、广告、支付或网络 SDK | Codemagic 构建日志、Xcode 隐私报告、依赖清单 | 可能增加数据类别、用途或跟踪申报 |
| Supabase 生产项目 Auth/API/Edge Function 日志是否保存 IP、User-Agent、请求元数据；是否可与用户 ID 关联；保留多久 | Supabase 项目日志、Auth Audit Logs 设置及当前套餐 | 决定日志的类别、关联状态和政策保留说明 |
| Resend 是否开启邮件打开/点击追踪，以及发送日志、邮件内容的保留期限 | Resend 域名/邮件设置及当前套餐 | 可能增加使用/设备数据；核对服务商保留说明 |
| 支持请求是否只通过外部邮箱处理，是否有 App 内表单或 SDK 收集内容 | App 最终版本及支持流程 | 判断是否申报 Customer Support 内容 |
| 云端快照中的 `fitlog-*` 实际键和值，特别是评估、收藏、搜索和自由文本 | 用测试账号创建样例并检查 Supabase `user_sync_snapshots` | 确认 Health、Fitness、Product Interaction、Other User Content 等类别 |
| Supabase 项目区域、备份与删除后的残留周期；Resend 服务区域/保留期 | 两家服务商后台与合同/套餐 | 校准英文政策中的数据处理和保留表述 |

Apple 将“收集”定义为数据离开设备并由开发者或服务商存取超过实时请求处理所需时间；纯本地数据无需申报。即使登录可选，启用登录时会同步的数据仍须申报。每项均需回答用途、是否关联用户、是否跟踪。服务商处理也计入 App 的披露范围。

## 依据

- Apple：App Privacy Details — https://developer.apple.com/app-store/app-privacy-details/
- Apple：Manage App Privacy — https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Supabase：Auth Audit Logs — https://supabase.com/docs/guides/auth/audit-logs
- Resend：GDPR / retention — https://resend.com/security/gdpr
