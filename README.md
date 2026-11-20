# AutoTab

一个为个人使用设计的 Chrome 标签分组插件。先按根域名本地分组，再用模型概括组名并合并相关分组。支持 OpenAI 兼容 API 和 Anthropic 兼容 API。原生 JavaScript + Manifest V3，无构建依赖。

## 安装扩展

1. 打开 `chrome://extensions`，启用右上角「开发者模式」。
2. 点击「加载已解压的扩展程序」，选择本项目的 `extension/` 目录。
3. 点击扩展图标 →「设置」，选择模型来源，填写配置并保存。
4. 点击「整理当前窗口」；也可以在设置中开启定时任务。

API 基础地址需要包含服务商规定的前缀，例如 `https://api.openai.com/v1` 或 `https://api.anthropic.com/v1`。插件分别追加 `/chat/completions` 或 `/messages`，无需填写完整端点。模型 ID 使用服务商实际提供的名称。

支持 HTTPS 自定义服务商及 `http://localhost:端口/v1`、`http://127.0.0.1:端口/v1` 本地服务。保存设置时 Chrome 会请求该来源的访问权限。兼容 API 必须支持相应的请求和响应格式；不支持流式或只提供 Responses API 的服务。

## API 配置

仅提供 OpenAI 兼容与 Anthropic 兼容两种接口格式。填写服务的基础地址、模型 ID 和 API Key；兼容服务可直接使用自定义地址。保存时申请当前 API 来源的访问权限，不限制供应商。现有地址、模型与密钥配置会保留。

## 取消所有分组

点击插件弹窗中的「取消所有分组」，会取消所有普通窗口内的所有标签分组（包括手动创建的组），保留所有标签页，不请求模型、不影响隐身窗口。整理任务与取消操作互斥。

此操作不会关闭定时整理；开启自动整理时，下次定时任务会重新分组。需要保持未分组状态时，在设置中关闭定时整理。

## 语言

界面跟随 Chrome 的界面语言：中文（包括 zh-CN、zh-TW）显示中文，英文及其他语言显示英文，默认语言为英文。不提供手动语言开关。静态界面、工具提示、无障碍标签及执行状态均支持中英文。

内置模型提示词统一使用英文，要求模型按界面语言生成组名与摘要；用户填写的偏好和网页标题作为原始数据保留。

0.3.0 已移除本地模型桥接与相关权限；旧版的本地来源配置会回退到待配置的 OpenAI 模式，并关闭定时整理。曾安装旧桥接的用户可以自行删除 `~/.local/share/autotab/` 与 Chrome 用户目录下 `NativeMessagingHosts/com.autotab.codex.json`，扩展不再调用它。

## 分组规则与隐私

- 手动操作处理当前普通窗口；定时任务处理所有普通窗口。间隔以秒为单位，默认 30 秒，支持 30–86400 秒。旧版分钟配置升级时会换算为秒，保持原有频率；需要加快时在设置中修改。
- 保留固定标签和已有分组，跳过隐身窗口及 `chrome://` 等非 HTTP(S) 页面。
- **本地归类**：使用随扩展附带的 Public Suffix List 识别可注册根域名，包括 `co.uk` 等多级后缀及 `github.io` 等私有后缀。`docs.example.com` 和 `www.example.com` 会归为 `example.com`；独立托管站点不会误合并。根域名组立即创建，允许只有一个标签，以便后续跨域合并。
- **概括命名**：每次最多 4 个根域名组，每组只发送最多 3 个代表性标题（各最多 100 字符）、根域名及标签数量。模型只能为完整域名组命名，不能拆分组或挑选标签。
- **关联合并**：只发送组名、根域名与最多 120 字符的主题摘要，每次最多比较 12 个组。通过组块两两比较覆盖跨批次的关联；有具体主题或任务关联才合并。关联链通过本地算法合并为一个组。组数很多时比较次数会增加，但单次请求大小有上限。
- 两个模型阶段共用最多 **3 个并发请求**的请求池，先完成命名，再分析关联。同一轮整理不会重入。
- 已归组标签不会在下一轮重新分类。模型失败后，本轮已创建的根域名组及已完成的命名会保留；需要重试这些组时，可先用 Chrome 原生菜单取消其分组。
- 不向模型发送完整标签列表、标签 ID、网址路径、查询参数或片段，不读取正文。标题样本仍可能包含敏感信息。
- 模型结果必须通过格式、颜色、组 ID、重复及命名完整性检查。合并前再次检查标签是否仍存在、是否已固定或被用户移到其他组，以及 URL 是否改变。保留窗口边界。
- API Key 只保存到本地扩展存储，不同步、不写日志。它不是加密凭据保险库。
- 定时任务依赖浏览器运行，Chrome Alarms 最短周期为 30 秒，休眠期间可能延迟。[定时器限制](https://developer.chrome.com/docs/extensions/reference/api/alarms)API 超时为 25 秒。
- 若模型阶段失败，本地分组不会回滚；状态会显示错误和已完成数量。当前没有自动撤销功能，可通过 Chrome 原生分组菜单取消分组。

## 没有看到请求时

更新代码后，在 `chrome://extensions` 找到 AutoTab，点击「重新加载」，再关闭并重新打开插件弹窗。0.1.1 修复了后台 Service Worker 使用顶层 `await` 导致无法注册的问题。

请求由后台发出：在扩展卡片中点击「Service Worker」检查视图，打开其 **Network** 面板，再点击插件的整理按钮。普通网页、设置页或弹窗自己的 Network 面板不会展示后台的 API 请求。

弹窗会显示正在检查、正在请求、完成的请求次数或错误。如果没有未固定、未分组的 HTTP(S) 标签，插件不会请求模型，并会显示跳过原因。

## 开发和验证

Node.js 20+：

```sh
npm test
npm run check
npm run test:browser
npm run test:ui
```

`test:browser` 使用独立的临时 Chrome profile，验证真实浏览器拒绝顶层 await、修复后的 Service Worker 可注册及消息到模拟请求的完整链路。默认使用 macOS 的 Chrome 路径，其他系统通过 `CHROME_PATH` 指定浏览器可执行文件；不加载或修改个人浏览器配置。

`test:ui` 使用独立 Chrome 实例与模拟数据验证弹窗统计、模型切换、密钥显示、定时开关和配置保存，并生成 `.artifacts/` 下的界面截图。字体与 GSAP 均随扩展打包，不从远程加载。

测试使用 Node 内置 runner 和模拟的网络、Chrome API，不调用付费模型。浏览器实测时，请检查：手动整理、跨窗口定时任务、固定和已有分组保护、权限拒绝、错误密钥、关闭或导航中的标签。修改扩展文件后在 `chrome://extensions` 点击重新加载。

结构：`extension/` 为扩展和界面，`tests/` 为自动化测试，`AGENTS.md` 为贡献指南。

接口参考：[Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)、[Chrome service worker 生命周期](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle/)、[Anthropic Messages API](https://platform.claude.com/docs/en/api/messages/create)、[Public Suffix List](https://publicsuffix.org/list/)。扩展内置后缀数据位于 `extension/vendor/public-suffix-list.js`，基于 MPL-2.0 授权的官方列表转换为 ASCII 规则，运行时不联网获取。

## 图标资源

`extension/icons/icon.svg` 是与界面一致的叠放标签图形，PNG 提供透明背景的 16、32、48、128 和 512 像素版本。工具栏、扩展管理页与页面 favicon 均已接入。修改矢量源后运行 `npm run icons` 重新导出，需要 Chrome；可通过 `CHROME_PATH` 指定路径。

## 打包上传 Chrome 商店

运行 `npm run package`，生成 `dist/autotab-版本号.zip`。脚本只打包 `extension/` 内的文件，ZIP 根目录包含 `manifest.json`，不包含本地设置、测试或开发截图。需要系统提供 `zip` 和 `unzip`。

在 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 注册开发者账号，创建新项目并上传 ZIP。商店说明需清楚描述标签分组用途和第三方 AI 数据传输，并准备 128px 图标与至少一张 1280×800 截图；440×280 小宣传图可选。

提交前填写单一用途、权限理由及数据处理声明，提供公开可访问的隐私政策 URL。隐私政策应说明：根域名、标题样本和用户偏好会发送到用户配置的 API 服务；分组关联阶段发送组名、根域名与摘要；密钥保存在本地扩展存储。审核人员还需要可复现的配置和操作说明。材料齐全后选择可见范围并提交审核。

后续更新必须递增 `extension/manifest.json` 的版本，再重新打包上传。[官方发布流程](https://developer.chrome.com/docs/webstore/publish)

隐私政策公开地址：[AutoTab Privacy Policy](https://yeezc.github.io/autotab/privacy.html)。通过 `main` 分支的 `docs/` 目录部署到 GitHub Pages。
