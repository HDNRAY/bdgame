# 发行渠道调研:TapTap 与替代方案

> 本文是 **2026-10-08** 的调研。平台政策、产品形态与资质要求都会变,阅读前请先核对日期,并以官方文档的最新版本为准。
>
> 全文区分**事实**(有出处)与**判断**(本文的推断,单独标出)。二手来源(博客、媒体)一律标注。

## 0. 方法说明(可复现信息)

- 本机 DNS 走 fake-IP 代理:几乎所有域名都解析到 `198.18.x.x` 段,`web_fetch` 判定为 "non-public IP address" 并直接拒绝(github.com 是例外,解析到真实 IP)。
- 所以中文站点的正文是**用 `curl` 抓取 HTML、去掉标签后读原文**得到的,不是靠搜索摘要推测。凡是标注「访问 2026-10-08」的条目,都是当天读到正文的。
- `web_search` 只用于发现线索;凡本文引用为事实的条目,均已打开原页确认。少数只出现在搜索结果标题、未能打开正文的条目,已逐条标注「未逐字核验」。
- 官方文档站多为 SPA,但服务端渲染的 HTML 里已含正文;提取时会丢表格结构,表格类内容以文字复述并标注原页。

## 1. TapTap 侧有哪几条通道

**事实:**

- **没查到在运产品叫「TapTap 创造」。** 截至 2026-10-08,官方文档、开发者中心与 TapTap 站内均未出现该名称的入口或协议。近两年实际相关的是下面三条通道。
- **TapTap 商店(APK / PC)**:常规发行通道,资质规则与分成见[开发者快速入门指南](https://developer.taptap.cn/docs/store/standardies-operation/)(访问 2026-10-08)。
- **TapTap 小游戏(H5)**:官方定义为「基于 TapTap 平台开发,**无需下载、点击即玩**」,「支持商业化变现功能,以**零分成**的合作模式」——见[小游戏文档指引](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/)(访问 2026-10-08)。
- **TapTap 制造(又名 TapTap Maker)**:AI 游戏创作智能体。
  - 上线时间:2026 年 1 月,心动推出;2026 年上半年 TapTap 新发行可玩游戏 5002 款(去年同期 530 款),其中超过 4000 款借助 AI 制作;制造已帮助 3000 多名创作者做出接近 5000 款游戏,累计玩家超过 1100 万 —— [证券之星 2026-09-23](https://4g.stockstar.com/detail/SS2026092300031518)。
  - 2026-08-11 起「无门槛开放测试」,线上网页模式全面开放、无需资格,新用户赠 1000 积分 —— [制造公告](https://www.taptap.cn/moment/837353116297855382)(页内日期 2026-08-11;同一页内 2026-10-07 的积分购买公告:¥45 兑 6000 积分)。
  - 产品定位与「对话即创作,完成即发布」见[制造内测招募答疑贴](https://www.taptap.cn/moment/766427294423056451)(页面标注「修改于 01/30」,**未标年份**)。
- **创意工坊快速上架服务**:面向「游戏关卡」的上架服务,发布方式为「(1) 在您的 TapTap 个人主页中展示;(2) 授权游戏发行方将游戏关卡嵌入其游戏中并发行运营」,不是整包发行 —— [创意工坊内容授权协议](https://m.tpp315.com/doc/ugcgame-agreement/)(发布日期 2026-03-11)。

**判断:** 「TapTap 创造」很可能是口头简称或旧称,指向的对象不明;如果指的是「个人创作者通道」,对应的应是「创意工坊快速上架服务」或「TapTap 制造」,两者都不是「网页游戏直接上架」。

## 2. 能不能直接发一个网页游戏

**事实:**

- **小游戏用网页技术,但运行环境不是浏览器。** 官方原文:「TapTap 小游戏的运行环境不同于浏览器,一方面**并不提供 BOM 和 DOM API**,另一方面额外提供了 FileSystem 这类浏览器不具备的 API」,需要引擎侧的 **Adapter** 抹平 `document.createElement`、touch 事件、音频、图片、socket、request 等差异 —— [Cocos/Laya/Egret 引擎适配](https://developer.taptap.cn/minigameapidoc/dev/engine/Cocos-Laya-Egret/)(访问 2026-10-08)。
- **项目结构是 `game.js` + `game.json`**,画布通过 `tap.createCanvas()` 创建,触摸事件与 `requestAnimationFrame` 循环自己接管 —— [开发小游戏](https://developer.taptap.cn/minigameapidoc/quick-start/guide/dev/)(访问 2026-10-08)。
- **包体必须是 TapTap 打包工具产出的 zip**,内置平台支持的分包技术只有 Unity、Cocos Creator;自定义引擎或框架要「手动集成 WASM 编译工具链」;首包大小不超过 **60M**;必须接入 TapTap 登录 —— [创建小游戏](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/)、[Unity 引擎适配](https://developer.taptap.cn/minigameapidoc/dev/engine/unity-adaptation/guide/)(均访问 2026-10-08)。
- **TapTap 制造的作品跑在 UrhoX 引擎上。** 制造文档把本地项目目录写成 `assets/`(image/sprites/video/audio)与 `scripts/`,运行环境是「WASM 浏览器预览 + 实机客户端 + UrhoXServer」三套,存档走引擎的 `File`/`FileSystem`、`clientCloud`、`serverCloud` —— [运行环境与数据](https://maker.taptap.cn/docs/runtime-data.md)、[本地开发](https://maker.taptap.cn/docs/local-development.md)(均访问 2026-10-08)。Maker MCP 的 `init` 只能「选择或创建 Maker 项目、绑定本地目录并拉取项目」,即绑定的是 Maker 项目格式。
- 另有官方仓库 [taptap/instant-games-open-mcp](https://github.com/taptap/instant-games-open-mcp)(TapTap 小游戏开放能力 MCP)。搜索结果里出现过一个名为 `upload_h5_game` 的工具条目(来源:[glama.ai 收录页](https://glama.ai/mcp/servers/taptap/instant-games-open-mcp/tools/upload_h5_game)),但**该页正文未能打开,未逐字核验**;仓库页可打开但内容被截断,未读到工具清单。

**判断:** 就「把 `npm run build` 的 `dist/` 直接上传」这件事而言,**没有查到任何 TapTap 通道支持**。纯前端产物若要进 TapTap,只有两条路:(a) 改成小游戏包体并写 Adapter,(b) 打包成安卓包(WebView 套壳)走商店。前者要动渲染层,后者要走 APK 资质。

## 3. 合规门槛(中国大陆)

**事实:**

- **无版号不得内购或收费。** 官方商店指南:「无版号游戏不得进行收费或内购,否则属于非法经营」;小游戏内容规范亦写明「游戏需具备国家新闻出版署批准的版号(ISBN),无版号游戏不得含内购计费内容」—— [开发者快速入门指南](https://developer.taptap.cn/docs/store/standardies-operation/)、[小游戏内容规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/content-standards/)(均访问 2026-10-08)。
- **小游戏:无内购就无需版号,但必须做「前置备案」。** 原文:「**不涉及内购功能的小游戏无需提交版号**,普通小游戏在正式上架前需完成小游戏前置备案,以满足上线前备案要求」—— [创建小游戏](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/)(访问 2026-10-08)。
  - 前置备案是「面向普通小游戏提供的一站式备案服务,整合了原有的小游戏备案与 ICP 核准流程」;材料含开发者认证、包体、**软件著作权人**、游戏内容介绍说明(已有版号则直接传版号)、小游戏负责人情况、身份信息核验;流程为「填写核准资料 → 电子化核验(负责人微信/支付宝扫码,约 10 分钟)→ 提交审核」;**全程预计 20 个工作日**,初审约 12~16 工作日,工信部短信核验须在 24 小时内完成 —— [小游戏前置备案](https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/)(访问 2026-10-08)。
  - 该页明确:「本文内容主要面向普通小游戏;**创意工坊或 TapTap 制造游戏请以对应的实际要求为准**」。
- **防沉迷:纯小游戏由平台兜底。** 「游玩方式仅有小游戏的情况下,防沉迷系统默认依托平台开启,开发者无需额外操作;如游戏同时提供 APK 包体测试或下载,则必须完善防沉迷系统,或接入 TapPlay」—— [创建小游戏](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/)(访问 2026-10-08)。
- **APK 路线:无版号只能「开放试玩」。** 资质表(官方原文):「『正式上线』开放下载或开放内购,必须提供官方游戏出版物号(ISBN),若厂商没有提供游戏版号,只能以『开放试玩』形式上架」;不联网 + 无内购的案例只需防沉迷与隐私合规;联网 + 无内购需 ICP 备案 + 防沉迷 + 隐私合规 —— [开发者快速入门指南](https://developer.taptap.cn/docs/store/standardies-operation/)(访问 2026-10-08)。
- **无版号的联网游戏可以先办 APP 核准。** 依工信部 2023-08-04《关于开展移动互联网应用程序备案工作的通知》,游戏类 APP 办核准需版号作前置审批;TapTap 提供《测试游戏核准辅助证明》,条件是:游戏推荐接入 TapTap 登录;**包名必须为 `game.taptap.XXX`**、**游戏名称必须为「XXX(TapTap 测试版)」**;合作期内**仅在 TapTap 测试**,不得主动提交其他安卓渠道;需签独家游戏测试协议、测试游戏承诺书、维权授权书,并提供软著证书(支持同时办理软著) —— [TapTap 测试游戏核准辅助证明申请介绍 v4](https://developer.taptap.cn/docs/store/release/policy/filing-certificate/)(访问 2026-10-08)。核准由省级通信管理局办理,材料齐全时 20 个工作日内发放核准编号;开通后 30 日内还要做公安联网备案 —— 同页与 [APP 核准通知及要求 v4](https://developer.taptap.cn/docs/store/release/policy/filing-notice/)(访问 2026-10-08)。
- **个人开发者可以认证。** 认证开发者分个人主体与企业主体:个人需厂商名称、开发者姓名、地址、身份证正反面扫描件、邮箱手机号;企业需营业执照、统一社会信用代码、**盖章的认证公函**(不支持电子公章、有效期一年)、紧急联系人等;官方称 2 个工作日内处理 —— [开发者注册与登录(入驻审核规范)](https://developer.taptap.cn/minigameapidoc/quick-start/guide/registration-login/)(访问 2026-10-08)。
- **内容审核。** 小游戏内容规范逐条限制:政治与国家安全、封建迷信、现金符号(禁止「¥」「$」或暗示真实货币交易)、未成年人保护、血腥(「角色死亡后尸体需在 5 秒内消失或转化为不可交互物体」)、色情低俗、UGC 需接 TapTap 内容安全接口、广告须标「广告」、禁止现金奖励与网赚玩法、需加适龄提示与防沉迷说明;违规后果为整改下架直至永久封禁账号 —— [小游戏内容规范](https://developer.taptap.cn/minigameapidoc/tap-operation/operation-standards/content-standards/)(访问 2026-10-08)。

**判断:** 对小体量个人开发者,「小游戏 + 无内购」是唯一**不需要版号**且能正式上架的国内路径,代价是软著 + 前置备案(约 20 个工作日)与无法内购变现。想内购就必须有版号,而版号要求主体通常为公司,个人基本走不通。

## 4. 费用与流程

**事实:**

- **认证费用:官方文档未列出任何认证或上架收费项**,入驻规范只列材料与 2 个工作日审核;上架流程也无「上架费」条目 —— [开发者注册与登录](https://developer.taptap.cn/minigameapidoc/quick-start/guide/registration-login/)、[开发者快速入门指南](https://developer.taptap.cn/docs/store/standardies-operation/)(访问 2026-10-08)。
- **提审周期:**「游戏物料、资质提审周期一般为 5-7 天左右」;创建游戏首次提交「官方预计 1-3 日通过审核」,版本更新「1 日内」;可定时上线,首次定时须设在当前时间 6 小时后 —— [开发者快速入门指南](https://developer.taptap.cn/docs/store/standardies-operation/)、[创建小游戏](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/)(访问 2026-10-08)。
- **分成:** TapTap 官方自述「不联运、不分成」「零分成允许开发者保留全部游戏收入」;同一页面把行业联运的常见分成描述为 30%-70% —— [开发者快速入门指南](https://developer.taptap.cn/docs/store/standardies-operation/)(访问 2026-10-08)。小游戏同样以「零分成」为卖点 —— [小游戏文档指引](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/)(访问 2026-10-08)。
- **小游戏变现走广告**:文档的运营章节列有「Dirichlet 广告联盟」「TapTap 推广中心」等 —— [小游戏文档指引](https://developer.taptap.cn/minigameapidoc/quick-start/document-guide/)(访问 2026-10-08);[Dirichlet 广告联盟介绍](https://developer.taptap.cn/minigameapidoc/tap-operation/operation/monetization-operation/IAA/dirichlet-intro/)**未逐字核验**(仅见于搜索结果)。
- **制造的计费:** 官方 2026-08-11 公告称新用户赠 1000 积分 Token;同一页 2026-10-07 的公告称上线积分购买,「¥45:6,000 积分,每周可按 ¥25 的折扣」;另有公告称「**发布不再消耗积分**」—— [制造无门槛开放测试公告](https://www.taptap.cn/moment/837353116297855382)、[制造本地开发模式上线](https://www.taptap.cn/moment/821837049639207708)(后者未标年份)。
- **制造的服务协议**含两条需要注意的条款:6.3「授权公司一项永久的、不可撤销的、独占的、全球范围内、免费、可再许可(通过多层次)的权利,即**仅在 TapTap 平台发布您的输出**」;6.2 输出内容知识产权归用户。协议同时写明「可根据业务发展需要,对服务的**收费模式、价格进行调整**,或将部分免费服务转为付费模式」—— [TapTap 制造服务协议](https://m.tpp315.com/doc/taptap-maker-agreement/)(访问 2026-10-08,协议本身未标版本日期)。
  - 补充事实:2026-09 的媒体口径已变为「制作完成的游戏也**不要求必须发布在 TapTap**,可以去 Steam 等其他平台」—— [证券之星 2026-09-23](https://4g.stockstar.com/detail/SS2026092300031518)。**判断:** 协议文本与官方对外口径存在时间差,以签约时的最新协议为准。

## 5. 替代方案

| 方案 | 改造成本 | 依据与时效 |
| --- | --- | --- |
| itch.io(HTML5) | **低** | 官方文档:「itch.io supports uploading HTML games for play directly in the browser」,在 New Game 里选「HTML Game」并上传 **ZIP**;「you can upload any kind of HTML/JavaScript/CSS project」—— [Uploading HTML5 games](https://itch.io/docs/creators/html5)(访问 2026-10-08)。免费上传;分成比例由作者自设,默认 10%,另扣支付通道费 —— [Pricing](https://itch.io/docs/creators/pricing)、[Payments](https://itch.io/docs/creators/payments)(访问 2026-10-08) |
| GitHub Pages / Cloudflare Pages | **低** | 静态产物直接部署,无审核。**判断:** 无分发入口、国内访问不稳;若要绑自有域名在国内做「网站」形式运营,网站本身也涉及 ICP 备案,未在本次调研中查证 |
| Steam | **中** | 每款应用 100 美元,「当您的产品通过 Steam 商店或应用内购买获得的调整后总收入达到至少 1,000 美元后,该费用将会在之后向您支付的款项中予以返还」—— [Steam Direct 费](https://partner.steamgames.com/doc/gettingstarted/appfee?l=schinese)(访问 2026-10-08)。需 Electron/Tauri 之类的桌面套壳(本次未查证具体模板的维护状态)。版号:律师文章认为「在国外平台 Steam 发行的游戏,不会因此受到行政处罚」,但「若在蒸汽平台(Steam 中国)上架游戏,仍需取得版号」—— [邵诗巍律师,2025-07-12](https://www.mankunlaw.com/insights/shao-shi-wei-lu-shi-wu-you-xi-ban-hao-shang-jiasteam-fa-xing-you-xi-wei-fa-ma/)(**二手来源:律所文章,非官方口径**) |
| 微信小游戏 | **高** | 官方类目规范要求「选择游戏类目,应提供国家法律法规要求的各类资质文件」,软著对外授权需完整授权链 —— [游戏类目选择规范](https://developers.weixin.qq.com/minigame/product/)(访问 2026-10-08)。个人主体的具体边界见二手整理:个人主体只能纯广告变现(IAA)、不能开通虚拟支付/内购,需软著 + 自审自查报告 + ICP 备案,软著约 60 日 —— [博客园《免版号!Unity 微信小游戏 个人主体接入发布全流程》](https://www.cnblogs.com/behavioursblogs/articles/22809959)(**二手来源:个人博客,未标发布日期,正文自称涉及 2026 年新政**)。软著审查时限为官方口径:「自受理日起 60 日内审查完成」—— [中国版权保护中心·办理时限](https://www.ccopyright.com/mobile/index.php?optionid=1390)、[办理步骤](https://www.ccopyright.com/mobile/index.php?optionid=1367)(访问 2026-10-08) |

## 6. TapTap 制造(Maker):能否发布,以及不内购

### 6.1 首要结论(事实)

- 制造只有两条创作入口:浏览器工作区的「新建项目」,与「本地开发模式」。本地模式的做法是在**空白目录**执行 `npx -y @taptap/maker init`,其行为是「选择或创建 Maker 项目、绑定本地目录并拉取项目」——即本地目录是 **Maker 项目的克隆**。文档中没有提供任何「导入既有工程」的通道;素材面板接受的只是素材文件、文件夹或 zip(Spine 与 3D 模型可整包导,单个压缩包最多 500 个文件),不是工程导入 —— [本地开发](https://maker.taptap.cn/docs/local-development.md)、[素材与资源](https://maker.taptap.cn/docs/assets.md)(均访问 2026-10-08)。
- 制造作品跑在 **UrhoX** 引擎上,游戏逻辑用 **Lua** 写;项目结构为 `assets/`(image、sprites、video、audio、model)与 `scripts/`;运行环境分 WASM 浏览器预览、实机客户端、UrhoXServer 三套 —— [Benchmark](https://maker.taptap.cn/docs/benchmark.md)、[运行环境与数据](https://maker.taptap.cn/docs/runtime-data.md)(均访问 2026-10-08)。
- 服务协议 2.1 明确列出「本公司不提供以下服务内容」:(1) **源码交付与导出**:不提供输出内容对应的底层源代码导出及交付;(2) **独立运行包**:不为输出内容单独生成可脱离本平台环境独立分发、运行的源代码包或二进制文件;(3) 底层解析 —— [TapTap 制造服务协议](https://m.tpp315.com/doc/taptap-maker-agreement/)(访问 2026-10-08,协议本身未标版本日期)。
- **两条合起来是决策性的:既有的 React + Vite 工程搬不进制造,必须在 Maker/UrhoX 里重做;而且做完的产出也导不出来,只能留在 TapTap 平台内。**

### 6.2 能不能发布(事实)

- 能发,但发的是「在制造里做出来的新作品」。发布面板的「确认发布」会检查物料,通常需要:游戏图标、至少 3 张截图、宣传图与横竖封面、游戏名称、至少 10 个字的简介与「开发者的话」,以及**首次正式发布所需的实机测试视频**;物料可由 AI 生成,也可上传自己的文件 —— [预览、调试与发布](https://maker.taptap.cn/docs/preview-publish.md)(访问 2026-10-08)。
- 账号有多个发布厂商时,发布前要先在发布面板选择「发布厂商」—— 同上(访问 2026-10-08)。**判断:** 这意味着发布仍挂在 TapTap 的厂商/开发者主体下,而不是完全脱离平台身份。
- 积分:创作消耗积分(官方 2026-10-07 公告:¥45 兑 6000 积分);**发布面板内的操作不消耗积分** —— [制造无门槛开放测试公告](https://www.taptap.cn/moment/837353116297855382)(页内日期 2026-08-11 与 2026-10-07)、[积分规则](https://maker.taptap.cn/docs/credits.md)(访问 2026-10-08)。

### 6.3 不内购的门槛(事实 + 没查到)

- **事实:** 制造的全部官方文档(产品概览、创建第一个游戏、用 AI 对话开发、积分规则、预览调试与发布、运行环境与数据、素材与资源、UI 主题、制造 Skills、本地开发、Benchmark、制造研究所,共 12 页)与[服务协议](https://m.tpp315.com/doc/taptap-maker-agreement/)中,均**没有出现「版号」「备案」「实名」「防沉迷」「内购」任何字样**;正式发布的前置条件只列物料与首次实机测试视频,并要求选择「发布厂商」。
- **没查到:** 因此「不做内购是否就免备案」「免费游戏要不要实名/防沉迷」**没有查到任何明文依据,不能推断为免**。官方在小游戏前置备案页只写了一句「创意工坊或 TapTap 制造游戏请以对应的实际要求为准」—— [小游戏前置备案](https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/)(访问 2026-10-08)。本文旧版把这一条记在「没查到的三项」里,现已并入本小节。

### 6.4 发布形态(事实)

- 三类环境:预览(浏览器工作区)、测试(项目分享页或实机测试二维码)、线上(从 TapTap 启动的正式版游戏)—— [运行环境与数据](https://maker.taptap.cn/docs/runtime-data.md)(访问 2026-10-08)。
- 非公开档位存在:预览工具栏的「分享」可为当前开发版本生成分享链接与二维码,**一个分享链接最多可供 100 人参与测试**,重新构建后可「同步当前构建版本」;另有实机测试二维码,文档强调它「不是正式发布链接」—— [预览、调试与发布](https://maker.taptap.cn/docs/preview-publish.md)(访问 2026-10-08)。
- 公开形态:媒体口径称,通过 TapTap 制造完成的作品「目前在分发端和其他游戏呈现相同的产品形态,也会一起参与推荐和分发,并不会单独放进一个 AI 游戏专区」—— [证券之星 2026-09-23](https://4g.stockstar.com/detail/SS2026092300031518)。
- **判断:** 想「只给朋友看」有现成档位(分享链接、测试二维码);但没有查到「仅好友可见的正式发布档」,正式发布就是公开上架。

### 6.5 重做成本:高

- **渲染底座**:PixiJS(`src/ui/canvas/renderer.ts`)与 React DOM 都不能用,画面要改成 UrhoX 的渲染与 UI 体系。
- **逻辑**:游戏逻辑要用 Lua 重写;官方 Benchmark 评测的正是「AI Agent 在 UrhoX 引擎上完成 **Lua** 游戏开发任务」—— [Benchmark](https://maker.taptap.cn/docs/benchmark.md)(访问 2026-10-08)。**判断:** 相当于换一套引擎与语言,而不是移植。
- **美术**:素材面板接受的图片是 PNG、JPG/JPEG、WebP、GIF,单文件上限 16 MB,**拒绝 SVG、AVIF、HEIC/HEIF**;像素外观可以从现有 TS 像素数据导出成 PNG 复用,但武器挂点、姿势、手部遮罩这类逻辑要按 UrhoX 重写 —— [素材与资源](https://maker.taptap.cn/docs/assets.md)(访问 2026-10-08)。
- **判断(一句话理由):** 换引擎换语言重写逻辑与渲染,且产出不可导出 —— 高,不是中。

### 6.6 一处冲突(判断,非事实)

- **协议 2.1 的「不提供源码交付与导出」「不生成可脱离本平台环境独立分发的产物」**,与 **2026-09 的媒体口径「心动后来进一步开放 TapTap 制造……制作完成的游戏也不要求必须发布在 TapTap,可以去 Steam 等其他平台」**([证券之星 2026-09-23](https://4g.stockstar.com/detail/SS2026092300031518))互相矛盾。
- **判断:** 若协议文本仍有效,「去 Steam 等」缺少导出与独立打包的通道支撑,或者需要另开渠道、另行书面约定。两者不一致时,**以签约时最新的协议文本为准**;本节把冲突如实列出,不选边。

## 7. 本仓库的现状与三条路的距离

**事实(核对于 2026-10-08 的工作区):**

- 依赖:`react` / `react-dom` 19.2.6、`react-router-dom` 7.18、`zustand` 5.0.14、`sass` 1.101、`pixi.js` 8.19、`vite` 8.0.16、`typescript` 6.0.2(`package.json`)。
- 界面层是 **React DOM + Sass**:`src/ui/screens/` 下 9 个屏(ModeSelect、RogueliteScreen、BattleScreen、BuildScreen、EncyclopediaScreen、SettingsScreen、AboutScreen、DevMode、NotFound),`src/` 下共 43 个 `.scss`。
- **只有战斗画面走 PixiJS**:`pixi.js` 的 import 只出现在 `src/ui/canvas/renderer.ts`(文件头注释:「CanvasRenderer — 基于 PixiJS 的像素战斗画面渲染器」)与 `src/ui/canvas/float-text.ts`;渲染器由 `src/ui/components/AnimationPanel/AnimationPanel.tsx` 实例化。
- 另有一批**内嵌 2D canvas**:`src/ui/components/ui/PixelCanvas/PixelCanvas.tsx`(用 `<canvas>` + `getContext`),被 `CharacterPanel`、`RewardPicker`、`SelectionPanel`、`RoundCard`、`AnimationPanel`、`EncyclopediaScreen`、`DevMode/PixelEditor` 等 React 组件直接嵌在 DOM 里使用。
- 存档走 `localStorage`(`src/game/meta-save.ts`,key `dantiao:meta:v1`);构建产物是 `dist/` 静态站点。

**三条路的距离(判断,基于上面的事实):**

1. **itch.io / 自建静态站:低,近乎零改动。** `npm run build` 的 `dist/` 就是 itch.io 要的 HTML/JS/CSS 项目(ZIP 上传),`localStorage` 存档在浏览器里照常工作。
2. **TapTap 小游戏:中到高,必须动 UI 与渲染层。** 需要办的事:(a) 提供 `game.js` + `game.json` 入口;(b) 抹平 DOM/BOM —— React DOM 本身依赖 `document`/`window`,官方只为 Unity/Cocos/Laya/Egret 提供 Adapter,我们需要自己写;(c) `PixelCanvas` 的 `<canvas>` 与 `PixiJS Application` 都要改成 `tap.createCanvas` 路径;(d) 接 TapTap 登录;(e) 压首包到 60M 以内;(f) 软著 + 小游戏前置备案。如果 UI 保持 React DOM,这一步不是「移植」而是「换渲染底座」。
3. **TapTap 制造:高,等于重做,且产出导不出来。** 没有导入既有工程的通道,项目格式是 `assets/` + `scripts/`、引擎是 UrhoX(Lua),服务协议 2.1 还明确不提供源码导出、不生成可脱离平台独立分发的产物 —— 详见第 6 节。**判断:** 制造更适合「用它的引擎另做一个轻量版当引流入口」,不适合当现有项目的发行通道。

## 8. 没查到的两项

以下两项**没有查到**明确依据,不做推测(旧版第三项「制造作品是否免前置备案」已并入第 6.3 节):

1. **「TapTap 创造」作为一个在运产品的实体。** 未在官方文档、开发者中心、站内协议中找到该名称的入口、页面或条款。只能确定存在「创意工坊快速上架服务」(协议 2026-03-11)与「TapTap 制造」(2026-01 上线,2026-08-11 无门槛开放测试)。
2. **开发者认证是否收费的明示条款。** 官方入驻规范与快速入门都只列材料、审核时限与分成,未见任何「认证费」「上架费」的说明;也未查到「永久免费」的正面承诺。即:没查到收费项,不等于官方承诺免费。

## 9. 结论与建议

- **最省事的一条路:itch.io + 自建静态站。** `dist/` 直接传,改动近零,今天就能发出去;缺点是拿不到国内流量与社区。
- **要国内流量:TapTap 小游戏是唯一「网页技术栈能吃到 TapTap 流量」的通道。** 个人主体可认证、无内购即免版号、零分成;要付的代价是:改渲染底座(DOM/BOM 缺失)、软著 + 前置备案约 20 个工作日、首包 60M 以内、变现只能走广告。
- **不推荐:TapTap 制造。** 理由(见第 6 节):没有导入既有工程的通道、必须用 UrhoX + Lua 重做,**且协议 2.1 明确不提供源码导出、不生成可脱离平台独立分发的产物 —— 产出锁定在平台内**;此外「不做内购是否免备案」查不到明文。
- **不推荐:APK 套壳。** 无版号只能以「开放试玩」上架;要为 APP 核准签独家测试协议,并把包名与游戏名改成 `game.taptap.XXX` 与「XXX(TapTap 测试版)」。
- **判断:真正的成本不在合规流程,而在把 React DOM 界面 + 内嵌 canvas 换成小游戏运行时可跑的适配层。** 如果哪天要做,建议先只做一个「战斗 + 一局流程」的最小可玩切片去验证,而不是整包移植。

---

# 国内可访问的静态托管对比

> 本节是 **2026-10-11** 的调研,与上面第 1~9 节(2026-10-08,TapTap / itch.io / Steam / 微信小游戏)是**两套问题**:上面问的是「发到哪个游戏平台」,本节只问一件事 —— **把 `npm run build` 的静态产物放到哪里,中国大陆用户能方便打开**。上面做过的方案本节不重复,只在需要对照时引用。
>
> 本节编号从 10 起,不改动第 1~9 节任何一行。事实与判断继续分开标注;二手来源(博客、社区、媒体)逐条标注;**未打开正文的只标出处、不当作事实**。
>
> 方法同第 0 节:本机 DNS 走 fake-IP 代理,`web_fetch` 对非 github 站点被拒,所以正文一律用 `curl --compressed` 抓 HTML、去标签后读原文(少数站点需按 `text/markdown` 取)。**注意:本机所有域名都解析到 `198.18.x.x`,`curl` 的连通性/延迟数据在本机无意义,本节因此不提供任何「本机实测速度」数字。**

## 10. 先回答:用户说的「html2link」到底是什么

**事实:**

- **存在这个服务。** npm 包 `html2link`(0.1.0,2026-07-19 首发,MIT)自述为「Publish HTML, static sites, documents, spreadsheets, and presentations as shareable links」,主页 `https://html2link.dev`,仓库 `github.com/joohw/html2link` —— [npm registry 元数据](https://registry.npmjs.org/html2link)(访问 2026-10-11)。
- 它是一个**「把本地文件变成一个可分享链接」的上传型服务**,不是静态托管平台,也不提供 git 集成或自定义域名。官方首页原文支持的格式:HTML、静态站 ZIP、Markdown、PDF、Excel( XLSX/XLS )、CSV、DOCX、PPTX;首页角标写「Sign in for **20 MB** uploads」,技能文档写「**Anonymous uploads up to 1 MB require no account**」,并说明「Generated links are public to anyone who has the URL」—— [html2link.dev 首页与其内嵌 skill 文档](https://html2link.dev)(访问 2026-10-11)。
- **没查到定价。** `https://html2link.dev/pricing` 返回 404(并重定向到 `/en/pricing`,同为 404);首页、`/terms`、`/privacy` 正文里都**没有出现任何价格、套餐或额度条款**。隐私政策只写「Files and metadata may remain available until removed by the service operator」(保留期无承诺)—— 同页(访问 2026-10-11)。**即:没查到收费项,不等于承诺免费或长期免费。**
- **同一类服务还有 `htmlto.link`**(npm 包 `htmlto-link-skill`,作者邮箱 `liccwork@126.com`,仓库在 gitee)。首页原文:单次上传「**20 MB max total size**」、「**20 MB** max total size per upload」、「In guest mode, uploaded links are kept for **24 hours** only」,登录后才可管理与延长;提供 CLI / skill 一键部署(`npx htmlto-link-skill`)、支持自定义域名项但**需要登录** —— [htmlto.link 首页](https://htmlto.link)(访问 2026-10-11)。同期搜索还出现过 `html.run`(HTMLRun,`pypi.org/project/htmlrun-cli`)等同类,**未打开正文核验**,不列为事实。

**判断:** 「html2link」确实存在,但它的定位是「**临时把文件变成链接**」—— 1 MB 匿名上限、无自定义域名、保留期无承诺,与本项目 4.1 MB / 需要稳定 origin 的 PWA 需求不匹配。用户想要的其实是**后面那件事:把游戏放到一个国内能打开的网址上**。所以本节按「同类:把静态 HTML 一键发布成链接的服务」+「能长期承载一个游戏站点的静态托管」两条线一起调研。

## 11. 先量产物:本项目的硬约束

**事实(核对于 2026-10-11 的工作区与 `bdgame/` 目录,不动任何源码):**

- `vite.config.ts`:`base: command === 'serve' ? '/' : '/bdgame/'` —— **线上构建强制走 `/bdgame/` 子路径**;`build.outDir: 'bdgame'`。
- 产物体积(2026-10-09 那次构建的 `bdgame/`,43 个文件):**总计 4 221 342 字节(约 4.1 MB)**;打成 zip / tar.gz 后 **约 2.71 MB**(2 714 330 / 2 714 876 字节)。**单个最大文件 668 064 字节**(`assets/fusion-bold-pixel-12px-proportional-zh_hans-hbW_SK4T.woff2`,像素中文字体,共 4 个字体文件合计约 2.1 MB)。没有任何单文件接近 25 MB 一档的限制,但**总体积已超过 html2link 的 1 MB 匿名上限**。
- 产物结构:`bdgame/index.html`、`404.html`(与 `index.html` **逐字节相同**,md5 均为 `7aa470341e7bb9fb8d4b11064ba24386`,由 vite 插件 `gh-pages-404-fallback` 复制)、`manifest.webmanifest`、`registerSW.js`、`sw.js`、`workbox-*.js`、`assets/*`。
- **SPA 回退现在是「靠 404 文档」实现的**,不是靠重写规则:GitHub Pages 对未知路径返回 `404.html`,由 React Router 接管深链 —— 这一步写在 `vite.config.ts` 的 `gh-pages-404-fallback` 插件注释里。换平台时**这台机器要么保留、要么换成平台自己的 rewrite 机制**。
- PWA(`VitePWA`,`registerType: 'autoUpdate'`):
  - `registerSW.js` 原文:`navigator.serviceWorker.register('/bdgame/sw.js', { scope: '/bdgame/' })` —— SW 与 scope 都是**绝对路径**。
  - `manifest.webmanifest` 原文:`"start_url":"/bdgame/"`、`"scope":"/bdgame/"` —— 也是绝对路径;而图标是 `"src":"/icon.svg"`,**没有 `/bdgame/` 前缀**。
  - `sw.js` 里持久化预缓存清单用的是**相对路径**(`{"url":"index.html",...}`),所以**子路径下预缓存本身仍能装上**;但导航回退是 `registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")))` —— **写死的根路径 `/index.html`,没有配置 `workbox.navigateFallback`(生成物里搜不到该字符串)**。
- 埋点:`vite.config.ts` 的 umami 插件默认 `VITE_UMAMI_DOMAINS = 'hdnray.github.io'`,`data-domains` 不匹配时 tracker 不初始化;`.env.production` 里也配了该值(**只看键名与默认值,未读取具体值**)。**换域名/换主机 = 埋点静默失效**,要同步改默认值或环境变量。
- 现部署链路:`.github/workflows/deploy.yml` 在 push `master` 时构建,再用 `cpina/github-action-push-to-another-repository@v1.7.2` 把 `bdgame/` 推到 **`HDNRAY.github.io` 仓库的 `bdgame/` 目录**,即现网址为 `https://hdnray.github.io/bdgame/`。**子路径不是可选项,是已经上线的事实。**
- 生产构建开放 DevMode(`VITE_ENABLE_DEV_MODE` 已配置并注释写明「线上部署也开放 /dev(DevMode)路由」);DevMode 含**像素编辑器**,公开站点等于公开一套编辑器。

**判断(三条筛选结论,后面所有候选都按这三条过):**

1. **备案**:用中国大陆境内节点对外提供服务**必须**先 ICP 备案(见第 15 节),这是最贵的一条;不备案就只能用境外/香港节点。
2. **子路径**:支持 `/bdgame/` 子路径的候选**零改动**;**只支持根路径的候选必须把 `base` 改成 `/`**(代价见下条),或者用平台的 rewrite 把 `/bdgame/*` 映射过去。
3. **PWA**:改 `base` 不只是改一个字符串 —— `registerSW.js`、`manifest.webmanifest` 的 `start_url`/`scope`、以及 `sw.js` 里 `/index.html` 的导航回退**都是绝对路径**;而 `/icon.svg` 又漏了前缀(在子路径下是靠「`/icon.svg` 恰好被根路径服务到」才没坏,根路径部署反而要顺便统一)。另有一条**不可逆**代价:**换 origin(域名)后,已安装的 PWA 是另一份安装,`localStorage` 里的元进度存档(`dantiao:meta:v1`,见 `src/game/meta-save.ts`)不会跟着走** —— 对**已经装过旧地址**的玩家,存档等于清零;要迁移得先做导出/导入。

## 12. 候选逐条:能查到的事实

**证据强度口径:** 「强」= 服务商官方文档原文或官方后台行为可直接核对;「中」= 官方站点可读但未覆盖该问题;「弱」= 只有二手来源(博客/社区/媒体),仅作线索。

### 12.1 一键发布类(用户提的「html2link 同类」)

| 服务 | 免费额度 | 保留期 | 自定义域名 / HTTPS | 子路径 | 国内可访问(证据强度) |
| --- | --- | --- | --- | --- | --- |
| html2link(npm `html2link`) | 匿名 **1 MB**;登录 **20 MB**。**没查到定价页** | 无承诺(隐私政策原文只写「until removed by the service operator」) | 没查到自定义域名;链接域名是 `html2link.dev` | 取决于 ZIP 内路径,**没查到明文** | 站点经 Cloudflare(`server: cloudflare`),响应头 `cf-ray: ...-HKG` 说明**边缘节点落在香港**;是否被墙**没查到**(弱) |
| htmlto.link(npm `htmlto-link-skill`) | **20 MB**/次;游客链接**仅保留 24 小时** | 登录后可延长,**具体时长没查到** | 有定制域名/绑定的入口,但需登录,**细节未逐字核验** | 支持上传「文件夹 / ZIP」,**子路径规则没查到** | 服务端 `server: nginx` **未披露节点位置**;国内是否可访问**没查到**(弱) |
| html.run / HTMLRun(`htmlrun-cli`) | 未核验 | 未核验 | 未核验 | 未核验 | **只在搜索结果里见到,未打开正文** |

**判断:** 一类服务**只适合「把一个小样例发给朋友试玩」**,不适合当这个 4.1 MB 游戏的正式发布地:额度是「单文件/单包」量级、无稳定 origin、保留期无承诺(游客 24 小时那种更不适合当链接发出去)。**本项目首选只需一个 `curl -F file=@bdgame.zip`** —— 如果只想给几个人试,用 `htmlto.link` 登录后传 zip 比 html2link 更宽裕(20 MB),但两者都**没有给国内可访问性任何承诺**。

### 12.2 国内云厂商对象存储(静态网站托管)

四家的**共同硬约束**(逐家官方原文见下):**用中国大陆地域的 Bucket 直接对外提供网页访问,必须绑定已备案的自定义域名**;Bucket 自带的默认域名只能当下载用(阿里云明确写了浏览器会强制下载而非预览)。因此 **ICP 备案是这四家的前置条件,绕不开**。

| 厂商 | 免费额度(官方原文) | 超额价格 | 自定义域名 + HTTPS | 子路径 | SPA 回退 | 单文件/总量 | 上手 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 腾讯云 COS | 新用户**个人 50 GB 标准存储 / 180 天**;**明确不可抵扣**流量、请求、非标准存储 | 存储按量;**外网下行流量 0.5 元/GB**(官方计费案例原文) | 自定义源站域名(约 30 分钟生效);证书用「新上传」或「已托管」 | 支持(桶内目录即路径) | **不提供 rewrite**,只有「索引文档 + 错误文档」;要 SPA 只能自建 `404.html` 或上 CDN | 无公开小文件限制说明 | 控制台拖拽 / CLI / SDK |
| 阿里云 OSS | **没查到**面向个人的长期免费存储额度(只见「免费试用」入口) | **没查到**官方价目原文(搜索到的二手文章未采信) | 官方原文:**Bucket 域名访问 HTML 会强制下载**;要正常浏览**必须绑自定义域名**,且**「若 Bucket 位于中国内地,绑定的域名需要完成 ICP 备案」** | 支持,并有「子目录首页」开关 | 有「文件 404 规则」:`Redirect` / `Index` / `NoSuchKey`(**是目录首页语义,不是全站 rewrite**) | 无公开小文件限制说明 | 控制台 / CLI / SDK |
| 七牛云 Kodo | **实名认证用户每月免费:10 GB 存储 + 10 GB CDN 回源流量 + 10 万次写 + 100 万次读**;上传流量无上限 | 存储 **0.115 元/GB/月**;**外网流出 0.26 元/GB**(0-100 TB 档) | 支持(需实名) | 支持 | **本次未逐条核验**,不写成结论 | 无公开小文件限制说明 | 控制台 / CLI / SDK |
| 又拍云 | **没查到**(本次只抓了 CDN 产品页,未读到免费额度条款) | **没查到**(同上) | 支持 | 支持 | **未核验** | 未核验 | 控制台 / API |

**判断(费用这一栏最容易看错):** 对象存储的成本几乎全在**流量**而不是存储。以本游戏 4.1 MB 一个「首屏 + 字体全部加载」的会话算,一次完整体验约 4 MB 下行:**腾讯云 COS 0.5 元/GB ≈ 0.002 元/次**,1000 次约 2 元;**七牛 0.26 元/GB ≈ 0.001 元/次**,而且每月有 10 GB 免费额度,够约 2500 次完整加载。所以**费用不是决策项,备案才是**。另外「免费额度不可抵扣流量」是 COS 原文里写明的一句话,别把 50 GB 免费当成「全免费」。

### 12.3 国内静态托管 / PaaS

| 平台 | 现状(官方依据) | 备案 | 子路径 | 判断 |
| --- | --- | --- | --- | --- |
| **Gitee Pages** | **没找到任何在运入口。** Gitee 帮助中心(新版 Docusaurus 站点)搜索无 Pages 条目,`gitee.com/help/articles/4136`、`/4228` 这类旧页码**全部 301/回落到帮助中心首页**(响应体与首页逐字节相同);`https://hdnray.gitee.io/` 返回 **404**。**「Gitee Pages Pro」页面只能从 2022-06-18 的 Internet Archive 快照读到**,说明该产品页已下线 —— [archive.org 快照](https://web.archive.org/web/20220618110141/https://gitee.com/help/articles/4228)(快照 2022-06-18,访问 2026-10-11) | **没查到官方公告**;但产品入口确已不可达 | 历史上是 `用户名.gitee.io/仓库名`,天然子路径 | **按「不可用」处理。** 社区侧有旁证(弱):[Cocos 论坛帖](https://forum.cocos.org/t/topic/157839/7)、[LINUX DO 帖](https://linux.do/t/topic/1201281/13)都提到 Gitee Pages 已下架/找不到入口。**没有官方停服公告**,所以措辞是「入口不可达 + 无公告」,不写「官方宣布停止服务」 |
| **Coding / 腾讯云开发者平台** | **正在下线。** 二手来源(弱,未逐字核验官方公告):2025-09-01 标准版下线(原免费版客户不可用)、2025-09-30 停止新购、2026-03-30 停止续购、**2028-09-30 全部停止服务**;官方替代品为 `cnb.cool`(云原生构建) —— [掘金《腾讯云 CODING DevOps 系列产品即将下线》2025-06-26](https://juejin.cn/post/7520071503331213339) | 原平台在国内,同样要备案 | 无意义(正在下线) | **不推荐**:给一个 2028 年停服的平台做迁移不划算;`coding.net` 首页目前仍 200,但那是存量 |
| **腾讯云 EdgeOne Makers**(原 EdgeOne Pages,`pages.edgeone.ai` / `edgeone.ai`) | **免费版在用**(官方 Limits 页原文:「EdgeOne Makers currently offers a **free edition**」);免费额度:项目 **40** 个、**单文件 ≤ 25 MB**、**单项目文件数 ≤ 20000**、**总存储 5 GB**、构建 500 次/月、自定义域名 **200** 个、**免费 SSL 证书**;官方同时写明「免费版配额在商业版正式上线前执行得更宽松,超限时优先保障业务稳定」—— [Limits](https://edgeone.ai/document/211893332490612736)(访问 2026-10-11) | **没查到「必须备案」的原文,但也没有豁免依据。** 官方在免费额度表里单独列了「Traffic Fraud Prevention — Applicable only to the Chinese mainland」,说明**大陆线路确实是产品的一部分**;自定义域名走的是腾讯云证书体系 | **支持**(整包上传,路径即桶内路径) | **本节的推荐对象,见 12.4 与第 16 节** |
| **华为云 OBS** | **没查到**官方静态网站托管的免费额度(本次只抓到最佳实践 PDF 与一个西班牙语国际站的用户域名页,**未读到中文产品页的计费条款**) | 未核验(华为云大陆地域同属「境内提供服务」,按第 15 节规则应同样要求备案,**但本次没有拿到该产品的官方原文,不写成结论**) | 未核验 | **本次没查到,不作为推荐** |

### 12.4 重点候选:EdgeOne Makers(为什么它最贴)

**事实(均取自官方文档,访问 2026-10-11):**

- **直接上传整包**:「您可以将项目构建后的资产直接上传到 Pages」,控制台「创建项目 → 直接上传」,填项目名与**加速区域**后拖拽资产;注意原文提示「如果您选择直接上传,则以后无法切换到 Git 集成」—— [直接上传](https://edgeone.ai/document/173731777484574720)。**这就是「一次性把 `bdgame/` 传上去」的通道,不需要 git。**
- **自定义域名 + 免费 HTTPS**:免费证书由 TrustAsia / Let's Encrypt 签发,**有效期 90 天,平台在到期前 15 天自动续期**,支持自动验证 / DNS 委派 / 文件验证三种方式 —— [申请免费证书](https://edgeone.ai/document/194861523546566656)。
- **SPA 回退**:官方对 SPA(React/Vue)的原文是「**SPA cannot place 404.html in the output directory root path, which will impact client-side routing configuration**」,并建议用路由的通配规则处理 —— [自定义 404 页面](https://edgeone.ai/document/192123212580007936)。**这句话对我们很关键**:我们现在 `bdgame/404.html` 是与 `index.html` 逐字节相同的深链兜底文件,**上传时不能按 GitHub Pages 那套把 `404.html` 留在根目录**;要么删掉它、靠客户端路由,要么改用 `edgeone.json` 的 `rewrites`(免费版允许 100 条 rewrite,见 Limits 第 10.1 节)。
- **额度对得上**:单文件 25 MB > 我们最大的 668 KB;总存储 5 GB > 4.1 MB;完全不是问题。
- **费用**:官方 Pricing 页原文「**Specific pricing and quotas have not been released yet**」,商业版未发布 —— [Pricing](https://edgeone.ai/document/211893439055294464)。**即:目前免费,但官方明确说了将来会商业化、配额会调整** —— 这一点要当作「免费期不稳定」的风险记着。

**判断:** 在「**要国内快、但还不想备案**」的档位上,EdgeOne Makers 是唯一一个**免费、官方支持直接上传整包、支持自定义域名与免费证书、且在中国大陆有明确服务条款痕迹(流量反欺诈只适用大陆)**的候选。它的不确定性是:(a) 不备案时**加速区域只能选境外/香港**一类,大陆用户拿到的仍不是境内节点;(b) 免费版未来会商业化。**这两条我都标成「没查到确证」而不是结论。**

### 12.5 国外但在国内「相对可用」的

| 平台 | 官方对「中国大陆」的原话 | 额度 | 子路径 | HTTPS |
| --- | --- | --- | --- | --- |
| **Vercel** | **最明确的一家。** 官方知识库专文写:「**Vercel has no servers or CDN nodes in mainland China.** Requests are served from nearby regions, which adds latency.」「China's network controls can block or throttle traffic to foreign domains, including Vercel's `.vercel.app` subdomains.」「**Even unblocked traffic routes through international gateways, which slows connections.**」「Blocking is applied per domain and **can change over time or differ between ISPs**... may be throttled or blocked later without notice」;官方给的建议是自带域名 + 自托管字体/统计,或用境内镜像(**需要 ICP 许可**),并明说「**Vercel can't guarantee availability or performance within mainland China**」—— [Accessing Vercel-hosted sites from mainland China](https://vercel.com/kb/guide/accessing-vercel-hosted-sites-from-mainland-china)(访问 2026-10-11) | **没查到**本文档核对的额度细节(免费版带宽/Hobby 限制需另查,本次未核验) | 支持 | 支持 |
| **Netlify** | **没查到官方关于中国大陆的原话。** `docs.netlify.com` 的域名与构建文档正文里**没有出现 China / ICP 字样** | Free `$0`;用量已改「credits」制(**300 credits 限额/月**),带宽「**20 credits per GB**」—— [Netlify Pricing](https://www.netlify.com/pricing/)(访问 2026-10-11) | 支持 | 支持 |
| **Cloudflare Pages** | **没查到官方关于中国大陆的原话**(`developers.cloudflare.com` 的 Pages 文档无 China/ICP 表述)。**旁证(需谨慎):** Cloudflare 自家网络地图列出「Mainland China 36」个点 —— [Cloudflare Network](https://www.cloudflare.com/network/)(访问 2026-10-11);但公开资料一致说明**大陆节点属于独立的 China Network 商业产品(需备案、需企业合约)**,**免费版 Pages 不经过这些节点**(**该结论本次未拿到 Cloudflare 官方原文,标为「未逐字核验的旁证」**) | 免费版:**单文件 ≤ 25 MiB**、**≤ 20,000 个文件**、构建 500 次/月;另有「新账号 48 小时内可建项目数受限」—— [Pages limits](https://developers.cloudflare.com/pages/platform/limits/)(访问 2026-10-11) | 支持 | 支持 |
| **GitHub Pages** | **没查到官方关于中国大陆访问质量的说法**(`docs.github.com` 只写资源与用途限制,不写地区可用性)。**判断(弱):** 国内时快时慢、移动网络尤甚,是社区长期共识 —— 本次只把它当**待验证线索**,没有可引用的实测(参见第 18 节) | **发布站点 ≤ 1 GB**、源仓建议 ≤ 1 GB、**软带宽 100 GB/月**、构建超时 10 分钟、**每小时最多 10 次构建**(用自定义 Actions 工作流构建时该条不适用),并「可应用速率限制」—— [GitHub Pages 限制](https://docs.github.com/zh/pages/getting-started-with-github-pages/github-pages-limits)(访问 2026-10-11) | 天然子路径 | 官方域名自带 HTTPS;自定义域名可开 |

**判断:** 现有部署(GitHub Pages + `/bdgame/` 子路径 + Actions 推送到 `HDNRAY.github.io`)在**额度上绰绰有余**(4.1 MB vs 1 GB),问题只在**国内访问质量无人承诺**。Vercel 的具体价值是:它**用官方口吻承认了这件事**,而且给出了三条替代路线(自带域名、自托管资源、境内镜像),可以拿它当「境外托管在国内的真实处境」的官方背书来引用。Cloudflare Pages 的额度对我们完全够用(单文件 25 MiB),但**「国内是否真的快」本次没拿到官方结论**。

### 12.6 香港 / 新加坡节点(不备案,但比欧美近)

**没查到**面向「个人静态游戏站」的、可核对的港新静态托管套餐与价格的官方原文。本次只拿到两条间接信息:(a) html2link 的响应头显示其 Cloudflare 边缘落在 HKG;(b) Vercel 官方说「Requests are served from nearby regions」。**因此这一档只能给方向、给不出具体产品与价格** —— 见第 17 节。

## 13. 逐条筛选结论(备案 / 子路径 / PWA)

把 11 节的三条硬约束套到 12 节的候选上:

| 候选 | ① 备案 | ② 子路径 `/bdgame/` | ③ PWA(HTTPS + 稳定 origin) | 结论 |
| --- | --- | --- | --- | --- |
| **EdgeOne Makers(直接上传)** | 不备案则只能选境外加速区域;**要大陆节点须自有已备案域名** | 支持,零改动(或加 `edgeone.json` rewrite) | 自定义域名 + 免费证书 → SW 可用;**换到新域名 = 旧安装的存档归零** | **不备案档首选** |
| **七牛云 Kodo** | 大陆地域 + 自定义域名 → **要备案**(未逐条核验原文,按同类规则推定,标注为判断) | 支持 | 可用 | 备案后**最便宜**的一档(免费额度 + 0.26 元/GB) |
| **腾讯云 COS** | **要备案**(官方原文:「请确保输入的域名已备案」) | 支持 | 可用 | 备案后**文档最齐**的一档;注意 SPA 回退要自己想办法 |
| **阿里云 OSS** | **要备案**(官方原文:「若 Bucket 位于中国内地,绑定的域名需要完成 ICP 备案」) | 支持,且有子目录首页 | 可用 | 同上;桶域名直接访问会被强制下载 |
| **Gitee Pages** | — | — | — | **按不可用处理**(入口不可达) |
| **Coding** | — | — | — | **不推荐**(2028-09-30 停服) |
| **Vercel** | 不必 | 支持 | 支持 | **可用但不保证**:官方明说无大陆节点、可能被限速或封 |
| **Cloudflare Pages** | 不必 | 支持 | 支持 | 额度够;**国内实况本次没拿到官方结论** |
| **GitHub Pages** | 不必 | 天然支持(已在用) | 支持 | **现状基线**:零成本、零改动,国内无保证 |
| **Netlify** | 不必 | 支持 | 支持 | 免费额度已改 credits 制;国内实况**没查到** |
| **html2link / htmlto.link** | 不必 | 未核验 | **不适合**(临时链接、保留期无承诺) | 仅用于「发个试玩包」 |

## 14. 备案这一条具体要付什么(本项目最贵的一项)

**事实:**

- **法律依据与强制程度(官方原文):** 「所有对中国境内提供服务的网站/APP(非经营性互联网信息服务)都必须先进行 ICP 备案,备案成功并获取通信管理局下发的 ICP 备案号后才能开通访问」;未备案而把域名解析到境内云服务器会被**未备案监测系统识别并阻断**、跳转到固定页面;「如域名使用 HTTPS 协议访问,将会被未备案拦截阻断」—— [腾讯云·备案概述](https://cloud.tencent.com/document/product/243/18907)(最近更新 2025-05-23,访问 2026-10-11)。
- **域名前提(官方原文):** 备案域名必须是**国家批复的域名后缀**、在有效期内;「**境外注册商所注册的域名不能直接备案,请转入境内有资质的服务商**」;「**个人备案:备案负责人信息与域名所有者实名认证信息需保持一致**(比对姓名、证件类型、证件号码)」;域名实名认证入库工信部还需约 3 天,建议实名前先等 3 天再提交否则可能核验失败 —— [腾讯云·备案域名](https://cloud.tencent.com/document/product/243/18905)(访问 2026-10-11)。
- **备案必须有「云资源」:** 备案前需准备符合条件的**云服务器、轻量应用服务器、Serverless 服务资源包、负载均衡实例,或生成备案授权码** —— [如何快速备案您的网站或 APP](https://cloud.tencent.com/document/product/243/39038)(最近更新 2026-05-14)。**判断:** 这就是「对象存储也要买点东西」的原因 —— 纯对象存储账户通常要先有可备案的云资源(各厂商有「备案授权码」等变通,细节需按厂商当期规则问客服,**本次未逐条核验**)。
- **耗时(官方原文):** 腾讯云初审「预计 **1-2 个工作日**」反馈;管局审核「**不超过 20 个工作日**」(工作日不含周末与法定节假日)—— [备案审核](https://cloud.tencent.com/document/product/243/19650)(最近更新 2026-08-21)。即**顺利情况下 2~4 周**。
- **游戏是最敏感的一类:可能被要求前置审批。** 官方原文:拟从事新闻、出版、药品和医疗器械、文化、广播电影电视节目、**网络游戏**等互联网信息服务,**需要进行前置审批才能通过备案**;游戏对应的材料是「**《游戏版号核发单》**」,办理部门为国家新闻出版署 / 省级新闻出版部门,依据《网络出版服务管理规定》第二十七条「网络游戏上网出版前,必须向所在地省、自治区、直辖市出版行政主管部门提出申请」;官方同时写「游戏产品前置审批通过选择**出版**,填写游戏版号以及上传《游戏版号核发单》」—— [腾讯云·前置审批相关](https://cloud.tencent.com/document/product/243/36185)(最近更新 2025-06-06)。
  - **未逐字核验的搜索摘要(弱):** 同一页的「常见问题」里有一条「咨询相关审批部门后被告知不需要办理前置审批怎么办」,指向一份「被告知不需要办理前置审批」的说明/承诺书模板。**该子页面本次未逐字核验**,所以「不做内购的免费游戏是否可以不提交版号」**没有拿到明文依据,不能推断为免。**

**判断(一句话):** 备案这条路的真实成本不是钱(免费),是**时间(2~4 周,且要先买云资源、先有境内注册商域名)+ 不确定性(网站/APP 名称与内容一旦被认定涉及「网络游戏」,可能被要求提交版号)**。对一个个人开发者、一个免费、不做内购的网页小游戏,第 15 节给出的路线是**先不备案**。

## 15. 推荐

### 15.1 情形一:不想备案(推荐)

**推荐:继续用现有 GitHub Pages 地址当基线,同时把 `bdgame/` 整包上传一份到 EdgeOne Makers,绑一个自有域名,加速区域选境外/香港,并把这一版当作「给国内用户的入口」。**

理由(按 12 节的事实):

1. **零改动就能起步**:EdgeOne Makers 的「直接上传」通道接受「项目构建后的资产」,`bdgame/` 里就是一个完整站点;单文件 25 MB / 总存储 5 GB 对 4.1 MB 的产物毫无压力。
2. **它免费,而且给了免费证书与自定义域名**:免费证书 90 天自动续期,SW 与 PWA 才能继续工作(HTTPS 是前提)。
3. **它对大陆线路有明确的条款痕迹**:免费额度表里单列「Traffic Fraud Prevention — Applicable only to the Chinese mainland」,说明大陆流量是被正经对待的。
4. **它不需要动 `base`**:路径即目录结构,`/bdgame/` 的原样上传即可。

必须同时接受的代价(不备案档的**天花板**):

- **拿不到境内节点。** 不备案意味着加速区域只能选境外(香港一类)。**判断:** 香港对华南/华东的直连通常明显好于欧美节点,但**本次没有可引用的实测数据**,只能说「比欧美近」,不能说「和境内一样快」。
- **微信内分享有被拦的风险。** 这一点**没有查到官方条款可引用**(本次检索到的都是二手文章,如[百度智能云社区《微信域名拦截检测全攻略》](https://cloud.baidu.com/article/4627478),**弱证据,未逐字核验**)。**判断:** 不要把「发到微信群能直接点开」当成已解决的前提,发布后要自己用微信实测;若被拦,再走微信的申诉通道。
- **免费版会商业化。** 官方 Pricing 页原文即「商业版定价与配额尚未发布」,官方也写了免费版配额「**may be adjusted after commercialization**」。**判断:** 这对一个长期项目是真实风险,建议不要把唯一入口押在免费版上 —— 保留 GitHub Pages 那一份,做成「双部署」。

**如果连 EdgeOne 也不想用**:那就维持现状(GitHub Pages + `/bdgame/`),配合真机实测;或试 Cloudflare Pages(额度:单文件 25 MiB、20 000 文件,对我们够用),但**国内实况没有官方结论**。**不建议**为了这事去试 Gitee Pages(入口已不可达)或 Coding(2028 年停服)。

### 15.2 情形二:愿意备案

**推荐:备案 + 七牛云 Kodo(或腾讯云 COS)作为静态站源站,自定义域名 + 免费证书。** 二者取一,选依据是「谁家你已经有可备案的云资源」;纯看钱,七牛更便宜。

大概流程与耗时(按 14 节的官方口径串起来):

1. **准备域名**(1 天):在**境内有资质的注册商**注册或转入一个**国家批复后缀**的域名,做**实名认证**(个人备案要求域名所有者 = 备案负责人)。
2. **等实名信息入库**(约 3 天):官方建议实名完成后至少等 3 天再提交备案,否则管局核验不到实名信息会驳回。
3. **准备云资源**(当天):买一个满足备案要求的最小资源(轻量应用服务器 / Serverless 资源包等),或取得**备案授权码**。
4. **提交备案**(1~2 个工作日初审 + **最长 20 个工作日**管局审核):走厂商的备案小程序/PC 端;**这里是最可能卡住的一步** —— 网站/APP 名称与内容若被认定涉及「网络游戏」,可能被要求提交《游戏版号核发单》(前置审批)。
5. **公安联网备案**(通过后):拿到 ICP 备案号后,通常还要在规定期限内做公安联网备案(第 1~9 节已记录 TapTap 侧的同类要求:核准后 30 日内)。
6. **配置托管**:绑定自定义域名 → 传 `bdgame/` → 上传或申请证书 → 开强制 HTTPS。**注意 SPA 回退**(见 15.3)。

**判断:** 总耗时以「**2~4 周**」为规划值;对个人开发者,真正的失败风险不在流程而在第 4 步的**内容归类**。想稳妥,建议**先不备案上线(15.1),等真有人玩再做 15.2**,而不是一开始就卡在备案上。

### 15.3 本项目特有的注意点(无论选哪条路都要处理)

1. **`base=/bdgame/` 是子路径约束。** 支持子路径的主机(EdgeOne Makers、对象存储、GitHub Pages 用户名站)可以**原样上传**;若换成只支持根路径的部署方式,就要把 `vite.config.ts` 的 `base` 改成 `'/'` —— 这不是改一个字符串,而要连带处理下面第 3 条的三个绝对路径,并重新确认 `404.html` 兜底、`registerSW.js`、`manifest.webmanifest` 三处。
2. **SPA 回退在两种主机上是两套机制。**
   - GitHub Pages:靠 `bdgame/404.html`(与 `index.html` 逐字节相同),**必须保留**。
   - EdgeOne Makers:官方明确说 **SPA 不要把 `404.html` 留在产物根目录**,否则影响客户端路由;应该靠 React Router 的通配路由,或用 `edgeone.json` 的 `rewrites`(免费版上限 100 条)。**即:同一份产物不能原样丢给两种主机** —— 上传前要决定留不留 `404.html`。
   - 对象存储(阿里云 OSS / 腾讯云 COS):只有「索引文档 + 错误文档(或目录首页)」语义,**没有全站 rewrite**;要么把 `404.html` 指到 `index.html`,要么前面再挂一层能 rewrite 的 CDN。
3. **PWA 会被换 origin / 换路径打断,且最贵的是存档,不是 SW。**
   - **SW 与 scope 是绝对路径**:`registerSW.js` 注册 `/bdgame/sw.js`、scope `/bdgame/`;`manifest.webmanifest` 的 `start_url` 与 `scope` 都是 `/bdgame/`;而图标 `src` 是 `/icon.svg`(**漏了前缀**)。所以「换域名但保持 `/bdgame/` 子路径」时 SW 能正常工作;「改成根路径部署」反而要顺手统一图标路径。
   - **`sw.js` 的导航回退写死 `/index.html`**:子路径下预缓存清单是相对路径、能装上,但导航回退指向根路径。**本项目实际打开时之所以没坏,是因为 `/index.html` 在 `HDNRAY.github.io` 这个 origin 下恰好存在** —— 换成一台**根路径没有 `index.html`** 的主机(或以后统一到根路径),深链与离线回退就会失效。这是发布前必须实测的一条。
   - **换 origin = 玩家存档清零**:元进度存 `localStorage`(`dantiao:meta:v1`),**不随域名迁移**;已安装的 PWA 也是另一份安装。**判断:** 一旦对外发过链接、有了玩家,再换地址就要先做「导出/导入存档」,否则等于把玩家进度丢掉。
4. **埋点要跟着改。** `vite.config.ts` 里 umami 的 `data-domains` 默认 `hdnray.github.io`,不匹配时 tracker 完全不初始化;换域名必须同步改默认值或 `VITE_UMAMI_DOMAINS`,**否则会静默失效(不报错、也没数据)**。
5. **`/dev`(DevMode,含像素编辑器)是公开的。** 生产构建开放了该路由;不管发到哪个主机,它都会跟着上线。**判断:** 若不想让公网玩家摸到编辑器,应在发布前单独确认这个开关(改它涉及 `vite.config.ts` / `.env.production`,**不在本次改动范围内**)。
6. **体积对候选额度都不是问题,但别忽略字体。** 4.1 MB 里约 2.1 MB 是 4 个像素中文字体,是首屏大头;一旦哪天要压到「1 MB 匿名上传」这类限制内,**先动字体子集化**,而不是换托管。

## 16. 没查到的、以及拿不准的(逐条列出,均不推测为结论)

1. **`htmlto.link` 的可访问性与保留期细节** —— 只在首页读到「游客 24 小时」「20 MB/次」;登录后的保留期、自定义域名的具体形态、服务端节点位置**都没打开正文核验**。
2. **`html.run`(HTMLRun)** —— 只在搜索结果与 PyPI 描述里见到,**未打开正文**。
3. **html2link 的定价与保留期承诺** —— `/pricing` 是 404,官方文里**没有任何价格、套餐、保留时长条款**。只能说「没查到收费项」。
4. **又拍云、华为云 OBS 的静态网站免费额度与计费条款** —— 本次没抓到对应中文产品页的正文。**(「没查到」,不是「没有」。)**
5. **Gitee Pages 是否正式停服** —— 只确认「帮助中心无入口、旧页码全部回落首页、`gitee.io` 子域返回 404、Pro 页面只剩 2022 年存档」;**没有找到任何官方停服公告**,社区旁证为弱证据。
6. **Coding 下线的官方公告原文** —— 只有掘金二手文章给出的四个时间点(2025-09-01 / 2025-09-30 / 2026-03-30 / **2028-09-30**);官方文档页本次未找到,**标注为二手**。
7. **Cloudflare 免费版 Pages 是否经过中国大陆节点** —— Cloudflare 网络页列出「Mainland China 36」个点,但「这些点属于独立的企业级 China Network、免费版不走」这一关键区分**本次没拿到 Cloudflare 官方原文**,只作为**未逐字核验的旁证**。
8. **GitHub Pages / Netlify / Cloudflare Pages 在中国大陆的实况** —— 三家官方文档都**没有**关于中国大陆访问质量的表述;本次也没有可引用的实测(本机 fake-IP 代理下 `curl` 的延迟数据无意义)。**因此本节对这三家的国内速度不给结论。**
9. **阿里云 OSS 的长期免费额度、七牛/腾讯云的「个人备案」逐省差异** —— 未逐条核验;各省管局规则不同,以提交时的当期规则为准。
10. **七牛云 Kodo 的 SPA 回退机制(是否有 rewrite)** —— 本次**未逐条核验**,没写成结论。
11. **「不做内购的免费网页游戏」在备案时是否仍需版号** —— 官方前置审批页的「常见问题」里指向一份「被告知不需要办理前置审批」的说明模板,但**该子页面未逐字核验**;所以「免版号」**没有明文依据**,不推断为免。
12. **微信内分享未备案域名是否被拦** —— 检索到的都是二手文章(百度智能云社区等),**未逐字核验**;本节不引用为事实。

## 17. 本节结论(一段话)

- **不想备案:把 `bdgame/` 整包传到 EdgeOne Makers(直接上传),绑自有域名 + 免费证书,加速区域选境外;GitHub Pages 那份保留为备用。** 代价是拿不到境内节点、免费版将来会商业化、微信内能否直接打开要自己实测 —— 但**零改动、零费用、当天能上线**。
- **愿意备案:备案 + 七牛云 Kodo 或腾讯云 COS(自定义域名 + 证书),耗时按 2~4 周规划**;**风险点是「网络游戏」归类可能被要求提交版号**,建议真有人玩再走这条路,而不是先卡在备案。
- **不论哪条路,发布前必须先处理三件事**:`base=/bdgame/` 与三处绝对路径(SW scope、manifest、`sw.js` 的 `/index.html`)、SPA 回退机制(GitHub Pages 要 `404.html`,EdgeOne 反而不要)、以及「换域名 = 玩家 `localStorage` 存档清零」这件事。
- **不推荐**:Gitee Pages(入口不可达)、Coding(2028 年停服)、html2link 类一键服务(额度与保留期都不适合当正式发布地)。
