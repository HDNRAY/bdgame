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
