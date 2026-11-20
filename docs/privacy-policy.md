# AutoTab Privacy Policy

Effective date: November 20, 2026

AutoTab is a Chrome extension with one purpose: organizing browser tabs into meaningful groups. This policy describes version 0.3.1. English and Chinese versions are provided below.

## Information processed

AutoTab reads tab titles, URLs, tab and window identifiers, pinned status and existing group membership to organize tabs and avoid moving protected or changed tabs. Full URLs are used locally to determine root domains and check whether a tab has navigated; full URLs, URL paths, query parameters, fragments and Chrome tab identifiers are not included in model requests.

For group naming, AutoTab sends the configured model service each group's root domain, number of tabs, a temporary group identifier and up to three sample titles, each limited to 100 characters. For relationship analysis, it sends group names, root domains, topic summaries and temporary group identifiers. Your grouping preferences and configured model ID are included in requests. Titles and your preferences may contain personal or sensitive information even though page bodies are not read.

AutoTab stores the model API base URL, model ID, API key, grouping preferences, schedule settings and latest operation status in Chrome's local extension storage. Operation status can contain counts, timestamps and error messages. Settings are not stored using Chrome sync storage. API keys are not stored in an encrypted vault implemented by the extension.

## Purpose and recipients

This information is used only to group tabs by domain, generate group names, identify related groups, apply those groups and display operation results. Manual organization processes the current regular window. If you enable scheduling, the extension periodically processes eligible tabs in regular windows while Chrome is running, without requiring a separate click for each run.

Model requests go directly from your browser to the API address you configure. Your API key is sent to that service as an authentication header. AutoTab does not route those requests through a developer-operated server. The selected service also receives the connection information needed to serve a request, such as your IP address and request time. Its privacy policy and your account settings govern its retention, processing location and any use of request data for model training; AutoTab cannot promise those services will retain no data or use no data for training.

Remote API endpoints must use HTTPS. HTTP is allowed only for services addressed as localhost or 127.0.0.1 on your device.

## Data not collected for other purposes

AutoTab has no advertising, analytics, tracking pixels, developer-operated telemetry or sale of user data. The developer does not receive your API key or tab metadata through an AutoTab backend. AutoTab does not read page bodies, cookies, form inputs or Chrome's historical browsing database. Incognito tabs, pinned tabs, non-HTTP(S) pages and tabs already in groups are excluded from automatic organization. “Ungroup all” changes existing groups in regular windows without making model requests.

## Storage, retention and control

Local settings remain until changed or the extension is uninstalled; the latest operation status is overwritten by subsequent operations. Working tab snapshots and group descriptions are held temporarily for a running task and are not intentionally archived by the extension. Chrome itself retains its native tab groups according to normal browser behavior.

You can change the API endpoint, key, model and preferences in Settings, disable scheduled organization, revoke site access in Chrome's extension controls, cancel groups, or uninstall AutoTab to remove its local extension data. Uninstalling AutoTab does not delete information already received by a model provider. Contact that provider about its retention, deletion and account controls; revoke API keys in that provider's console if needed.

## Limited use and policy updates

AutoTab's use and transfer of user data are limited to providing the tab-organization feature described in the interface and store listing, consistent with the Chrome Web Store User Data Policy, including its Limited Use requirements. Data is not used for advertising, creditworthiness or lending decisions, or other unrelated purposes.

This policy will be updated when the extension's data practices materially change. The effective date above identifies the current version.

## Contact

For privacy questions or deletion requests relating to data held by the developer, contact yeezhang.go@gmail.com. For information already sent to a model provider, contact that provider directly.

---

# AutoTab 隐私政策

生效日期：2026 年 11 月 20 日

AutoTab 是一款用于整理浏览器标签页的 Chrome 扩展。本政策描述 0.3.1 版本的数据处理方式。

## 处理哪些信息

扩展在本机读取标签标题、完整网址、标签与窗口标识、固定状态和已有分组，用于按根域名归类、保护固定标签，以及检查执行期间标签是否跳转。完整网址仅在本机使用，不会把完整网址、路径、查询参数、片段或 Chrome 标签标识发送给模型。

命名阶段发送每组的根域名、标签数量、临时分组标识，以及最多三个标题样本，每个最多 100 字符。关联分析阶段发送组名、根域名、主题摘要与临时分组标识。请求还包含你填写的分组偏好和模型 ID。标题及偏好仍可能包含个人或敏感信息，尽管扩展不读取网页正文。

API 地址、模型 ID、API Key、分组偏好、定时配置和最近一次操作状态保存在 Chrome 本地扩展存储中，不使用 Chrome 同步存储。状态可能包含计数、时间戳及错误信息。扩展未为密钥实现独立的加密保险库。

## 用途与接收方

这些信息仅用于标签归类、生成组名、分析关联、应用分组与展示执行结果。手动整理处理当前普通窗口；开启定时整理后，Chrome 运行期间会定期处理普通窗口中的符合条件标签，无需每次点击确认。

请求从浏览器直接发往你配置的 API 服务，API Key 通过认证请求头发送给该服务，不经过开发者运营的中转服务器。服务商也会收到提供网络服务所需的连接信息，例如 IP 地址和请求时间。服务商的数据保留、处理地区以及是否用于模型训练，受其隐私政策和你的账户设置约束；AutoTab 不能承诺第三方服务不保留数据或不用于训练。

远程接口必须使用 HTTPS；仅本机 localhost 和 127.0.0.1 服务允许使用 HTTP。

## 不用于其他目的

扩展没有广告、分析统计、跟踪像素、开发者遥测或用户数据交易。开发者不会通过 AutoTab 后端接收标签信息或 API Key。扩展不读取网页正文、Cookie、表单内容或 Chrome 历史浏览数据库。自动整理跳过隐身、固定、非 HTTP(S) 标签和已有分组。“取消所有分组”仅处理普通窗口的分组，不请求模型。

## 保存期限与控制方式

本地配置保存至修改或卸载扩展，最近操作状态会被后续操作覆盖。运行中的标签快照和分组描述临时保存在内存中，扩展不会主动归档。Chrome 原生分组由浏览器按自身机制保留。

你可以在设置中修改接口、密钥、模型及偏好，关闭定时任务，在 Chrome 中撤销网站访问权限，取消分组，或卸载扩展以移除本地扩展数据。卸载不会删除第三方服务商已收到的数据；有关数据保留、删除或账户控制，请联系对应服务商；需要时可在服务商后台撤销 API Key。

## 限定用途与更新

扩展对用户数据的使用与传输仅限界面和商店介绍中说明的标签整理功能，并遵循 Chrome Web Store 用户数据政策及其 Limited Use 要求。数据不用于广告、信用或贷款决策及其他无关目的。

数据处理方式发生重大变化时，本政策将更新，并调整生效日期。


## 联系方式

如需咨询本政策，或提出与开发者持有数据相关的删除请求，请发送邮件至 yeezhang.go@gmail.com。已经发送给模型服务商的数据，请直接联系对应服务商。
