# FitMine 计划生成规则：NSCA 资料核对与优化建议

日期：2026-10-29。本文用于讨论，除已单独实施的高风险生成拦截外，以下建议尚未实施。

## 资料范围和判断方式

本次对照 NSCA 官方网站公开的教材摘录、教练及私人教练文章、CSCS 考试内容纲要，以及 FitMine 当前代码。用户以初学者训练频率表说明不建议新手每周训练 4 天；这不是要求单独核验该表。指定教材范围和后续核对详见 [教材导向核对](NSCA_TEXTBOOK_PLAN_REVIEW_ZH.md)。NSCA 明确区分官方立场声明与其他出版物；教练文章中的数值应按作者观点和适用人群理解。

标记：**已应用**＝代码有对应机制；**部分应用**＝有提示或部分场景实现，但没有完整验证；**未应用**＝未发现自动计算或约束。

## 逐项核对

| 主题 | NSCA 资料能支持的原则 | FitMine 当前实现 | 状态与建议 |
| --- | --- | --- | --- |
| 训练前风险 | 有既往疾病、症状或其他风险时应按具体情况评估，必要时取得医疗许可；危险信号不能被单一自动处方替代。[NSCA 风险管理](https://dxpprod.nsca.com/education/articles/career-articles/understanding-risk-management-as-a-fitness-professional/) | 已保存评估为高风险时，阻止自主生成及官方/历史模板生成；提示咨询医生，获许可后遵医嘱低强度活动。 | **已应用于新计划生成。**已有计划是否需提示、医生建议如何录入、复评后如何恢复，需另行设计；系统目前不核验许可。 |
| 增肌每肌群每周有效组数 | NSCA 出版的警员训练文章将每肌群每周约 10–20 组作为一般参考，指出范围外也可能有效；另一篇臀肌文章建议依据恢复从约 10 组开始。两者不是 NSCA 对每个人的强制门槛。[警员训练文章](https://dxpprod.nsca.com/contentassets/e619b345e9d7445f89be0a83e5861a44/tsac-69.1-exercise-programming-in-a-police-academy-sample-program-and-logistical-considerations.pdf)、[臀肌训练文章](https://dxpprod.nsca.com/contentassets/f921c5b3fe4142db964a943d3554b324/ptq-10.4.4-program-design-considerations-for-optimal-strength-hypertophy-glute-mucsles.pdf) | 计划按动作分配组数，重点日可能增加 2–4 组；记录页可统计已记录的主要肌群正式组。生成器没有逐肌群周目标、最低值或总量上限判断。 | **未应用周目标校验。**建议把 10 组左右作为可讨论的参考起点而非新手硬门槛；先定义有效组及直接/间接贡献，统计每周预估组数和实际组数，再按经验、恢复与反馈渐进调整。不要把所有肌群统一强推到 10–20 组。 |
| 同肌群恢复 | NSCA 公开文章给出的常用经验是相同肌群训练间至少间隔一天；训练频率也受强度、训练量和整体压力影响。该建议不是所有人都必须恰好 48 小时。[训练频率教材摘录](https://dxpprod.nsca.com/education/articles/kinetic-select/determination-of-resistance-training-frequency/) | 初学者 ≤3 天计划采用训练日相隔至少两个日历日，其他人相邻训练日至少隔一个日历日；没有根据主次肌群分别核对，也没有训练时刻。 | **部分应用。**建议按照动作涉及的主要及次要肌群建立疲劳关联；将同肌群间隔作为可配置的恢复提示，结合强度和训练量显示具体冲突。没有时刻数据时说明只是日历日近似。 |
| 初学者频率 | NSCA 教材摘录建议初学者全身训练每周 2–3 次、不连续安排；中级一般 3–4 次，高级一般 4–6 次，分化结构及个体情况会影响安排。[训练频率教材摘录](https://dxpprod.nsca.com/education/articles/kinetic-select/determination-of-resistance-training-frequency/) | 初学者选择每周 4 天及以上会阻止保存；2–3 天使用全身结构。 | **部分应用。**当前限制可作为 FitMine 保守产品策略；公开资料并未证明所有初学者每周 4 天都不合规。建议改为准确说明“本版暂不提供初学者四天计划”，后续若提供需针对分化、恢复、训练量验证。 |
| 中级/高级及每周结构 | NSCA 示例如 4 天上下肢分化、5–6 天推拉腿等，目的在于分配训练量与恢复，并非唯一固定方案。[训练频率教材摘录](https://dxpprod.nsca.com/education/articles/kinetic-select/determination-of-resistance-training-frequency/) | 2–3 天多采用全身，4 天上下肢，5–6 天推拉腿；高级 3 天使用推拉腿。默认日期可调整。 | **部分应用。**建议在生成后检查每周肌群覆盖次数、主要/辅助肌群的重叠、相邻训练的疲劳；尤其检查 5 天截取模板后的左右平衡与每个肌群实际训练频率。 |
| 动作排序 | NSCA 资料建议技术和爆发力需求高的动作优先，其后为其他主要多关节动作，再安排辅助动作；顺序可因目标及上下肢、推拉交替等策略调整。[NSCA Coach](https://www.nsca.com/contentassets/6aed7b59b3b14393963319e30ff16c9e/nsca-coach-9.2--final--bonder.pdf)、[CSCS 内容纲要](https://www.nsca.com/contentassets/483ac6a781884a7783780328100ff23b/certified-strength-and-conditioning-specialist-job-task-analysis-summary.pdf) | 内置模板大致把主要动作排在前面；重点复合动作通过名称匹配提前。缺少完整的动作类型、技术复杂度及排序校验。 | **部分应用。**建议为动作增加爆发力/主要多关节/辅助等结构化标签；先满足安全和技术优先，再在同一优先级内提升重点动作；输出可解释的排序原因。 |
| 主要动作模式 | NSCA 文章列出髋主导、膝主导、水平及垂直推拉、旋转等基本模式，并讨论躯干稳定、步态等。具体覆盖取决于个人目标与情况。[NSCA 动作模式文章](https://www.nsca.com/globalassets/education/ptq/ptq-5.2.pdf)、[动作模式教学](https://www.nsca.com/education/articles/ptq/teaching-resistance-training-movement-patterns/) | 使用固定模板和名称关键词；有重点动作追加及重复动作替换。没有统一的周期覆盖核对。 | **部分应用。**建议建立动作模式标签，在整个周计划上检查膝主导、髋主导、水平/垂直推拉及躯干稳定的覆盖；无法满足时给出原因，不简单强行凑动作。 |
| 动力链及后链 | NSCA 教材摘录区分开放和闭合动力链，强调关节之间的耦合与动作功能；CSCS 纲要要求能依据动作链及肌群平衡选择动作。两者不规定开链与闭链各占固定比例。[动力链教材摘录](https://dxpprod.nsca.com/education/articles/kinetic-select/kinematic-and-kinetic-chains/)、[CSCS 内容纲要](https://www.nsca.com/contentassets/483ac6a781884a7783780328100ff23b/certified-strength-and-conditioning-specialist-job-task-analysis-summary.pdf) | 上下肢及臀腿模板包含部分复合与单关节动作，当前未按动力链、关节约束、前后侧肌群重叠系统核对。 | **部分应用。**先区分“开链/闭链”与“前链/后链”两个概念，为动作标注且允许不确定；按目标、技术能力与限制组合复合及辅助动作，不强制固定比例。 |
| 负荷、次数与休息 | NSCA 出版物针对不同目标提出不同负荷、次数及休息范围；同一负荷的可完成次数存在个体差异。NSCA 一份战术训练教材摘录列出增肌 6–12 RM、休息 30–90 秒作为一种处方，并非适用于所有人和动作的唯一答案。[教材摘录](https://www.nsca.com/certification/tsac-f/essentials-of-tactical-strength-training-and-conditioning-2nd-edition/excerpts/program-design-and-sample-training-approaches/)、[负荷设定](https://www.nsca.com/education/articles/nsca-coach/using-intensity-based-on-sets-and-repetitions-over-50-years-of-experience-a-brief-overview-of-load-setting-and-programming-strategy/) | 按目标使用固定的百分比、RM、次数与休息表；所有动作基本继承当周目标，最后辅助动作另有固定规则。 | **部分应用。**建议区分主项、孤立及爆发动作，按动作技术和用户经验提供范围；百分比和 RM 视为估计，允许依据 RIR/实际表现修正，避免把固定百分比和次数显示成精确等价。 |
| 爆发力进阶 | NSCA 资料强调动作技术、动作复杂性及按目标编排；爆发力动作通常应在疲劳较低时安排。是否从入门级低负荷动作开始需要个体判断。 | 初学者选择爆发力目标被禁止；其他经验的爆发力目标可生成，但实际使用通用力量动作模板，未保证含专门的爆发动作。 | **部分应用。**当前禁用属于产品保守限制，不能称为 NSCA 对初学者所有爆发训练的绝对禁令。建议新增动作分类、技术门槛和合适的低负荷选项，不能满足时明确提示而非仅改次数。 |
| 热身和拉伸 | 应依据目标动作和训练内容准备，实际选择受动作、用户能力与限制影响。[NSCA 时间效率训练文章](https://www.nsca.com/education/articles/ptq/time-efficient-training) | 按当天动作名称/重点关键词识别上肢、后链、膝主导或全身；选择对应动态准备和拉伸。 | **部分应用。**建议按动作标签和关节要求评估，并为主要复合动作预留专项渐进热身；对受限动作提供替代。 |
| 渐进超负荷 | NSCA 资料支持根据个人表现和准备程度调整，RIR 是可选方法之一。2-for-2 示例为连续两次训练最后一组均比目标多完成两次后再加重。[NSCA Coach 负荷设定](https://www.nsca.com/education/articles/nsca-coach/using-intensity-based-on-sets-and-repetitions-over-50-years-of-experience-a-brief-overview-of-load-setting-and-programming-strategy/)、[2-for-2 应用示例](https://www.nsca.com/education/articles/ptq/using-feedback-drills-to-coach-the-turkish-get-up/) | 页面文字说明 2-for-2；自动建议基于本次各组完成情况与最后一组难度，建议不自动应用到下次重量。 | **按用户确认：**2-for-2 为加重建议提示，不增加连续两次的系统检查；单次记录建议应清楚标明其依据。 |
| 周期及减量 | NSCA 教材摘录说明恢复周可穿插周期，负荷和训练量可以随目标调整，并没有要求所有人每四周固定减量 40%–50%。[准备期教材摘录](https://dxpprod.nsca.com/education/articles/kinetic-select/preparatory-period/) | 固定四周，第 4 周写减组 40%–50%，实际为基础组数减 1、至少 2 组；中风险降低组数也是提示，没有自动扣减。 | **部分应用。**建议先统一文案和实际计算，再依据训练史、疲劳、计划完成率设定减量触发及幅度；避免将固定四周或固定百分比描述为 NSCA 必须执行。 |

## 建议优先顺序

1. **一致性与安全：**明确高风险后续流程；修正中风险减量、第四周减量和 2-for-2 提示与实际计算的差异；核对爆发力目标是否包含相应动作。
2. **动作和肌群数据：**为动作定义主要/次要肌群、动作模式、类型、开闭链及技术难度；标记未知项，保留稳定 exercise ID。
3. **周计划校验：**生成预估每肌群组数、训练频率、日期间隔和主要动作模式覆盖报告；用户调整训练日或替换动作后重新校验。
4. **个体化调整：**依据经验、实际完成情况、主观难度、可用器械及恢复反馈调整；参考范围作为建议，不作为未经验证的统一硬性门槛。
5. **体验与验证：**将提示写成可执行说明，明确哪些规则是 FitMine 的保守限制；用不同经验、目标、天数、风险和重点部位的组合回归测试，并由具备相关资质的专业人员审阅。

## 关于术语和证据

- “有效组”统计必须先定义：训练组是否完成、训练强度/接近力竭程度是否足够、复合动作对次要肌群如何计入。当前记录统计主要肌群，不能直接视为完整肌群训练量。
- “开链/闭链”描述末端约束及关节运动关系；“前链/后链”描述参与肌群或动作重点，两者不能互换。
- 初学者 2–3 次全身训练是来源中针对特定安排的推荐；四天禁用及初学者爆发力禁用是当前产品限制。
- NSCA 网站上作者署名的文章、教材摘录、CSCS 考试纲要及官方立场声明证据性质不同。本文对具体数值标明来源和适用背景，不将所有文章观点称为官方硬性标准。
