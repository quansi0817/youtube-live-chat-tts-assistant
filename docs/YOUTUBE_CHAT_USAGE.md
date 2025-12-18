# YouTube 直播聊天抓取使用说明

## 功能特点

本工具可以完整抓取 YouTube 直播聊天的所有内容，并保持原样显示，包括：

- ✅ **普通文字消息** - 完整保留原文
- ✅ **表情符号** - 包括 emoji 和 YouTube 自定义表情图片
- ✅ **Super Chat（打赏）** - 保留金额、颜色和消息内容
- ✅ **Super Sticker（付费贴纸）** - 显示贴纸图片和金额
- ✅ **会员消息** - 显示会员加入、升级等信息
- ✅ **用户头像** - 显示发言者的头像
- ✅ **时间戳** - 显示消息发送时间
- ✅ **点击朗读** - 点击任何消息即可使用 TTS 朗读

## 使用方法

### 方式一：使用浏览器扩展（推荐）

1. **安装扩展**
   - 打开 Chrome 浏览器
   - 进入 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择项目中的 `extension` 文件夹

2. **打开 YouTube 直播**
   - 访问任意 YouTube 直播页面
   - 扩展会自动在直播聊天页面运行

3. **打开聊天显示页面**
   - 在浏览器中打开 `src/html/simple-chat.html`
   - 或者在本地服务器中访问该文件

4. **查看效果**
   - 聊天消息会自动显示在页面中
   - 包括完整的表情、Super Chat 等
   - 点击消息可以朗读

### 方式二：直接在 YouTube 页面使用

1. **打开 YouTube 直播聊天**
   - 访问直播页面
   - 点击聊天区域的弹出按钮，或访问：
     ```
     https://www.youtube.com/live_chat?is_popout=1&v=视频ID
     ```

2. **打开浏览器控制台**
   - 按 `F12` 或右键点击 → 检查
   - 切换到"Console"标签

3. **复制并运行脚本**
   - 打开 `extension/content-script.js` 文件
   - 复制全部内容
   - 粘贴到控制台并按回车

4. **打开聊天显示页面**
   - 在新标签页打开 `src/html/simple-chat.html`
   - 消息会自动显示

## 文件说明

### 核心文件

1. **extension/content-script.js**
   - YouTube 聊天页面的内容脚本
   - 负责抓取聊天消息
   - 支持所有消息类型（普通、Super Chat、会员等）
   - 保留完整的 HTML 内容（包括表情图片）

2. **src/html/simple-chat.html**
   - 聊天显示页面
   - 接收并显示抓取的消息
   - 支持点击朗读功能
   - 完整还原 YouTube 样式

3. **src/css/youtube-chat.css**
   - YouTube 风格的样式表
   - 模仿官方聊天界面
   - 支持 Super Chat 不同等级的颜色
   - 响应式设计

## 消息类型说明

### 1. 普通文本消息
- 显示用户头像
- 显示用户名（彩色）
- 显示消息内容（支持表情）
- 显示时间戳

### 2. Super Chat（付费消息）
- 根据金额显示不同颜色背景
- 显示打赏金额
- 显示消息内容
- 支持 7 个等级的颜色（从蓝色到红色）

**金额等级分类：**
- Tier 1: < ¥5（蓝色）
- Tier 2: ¥5-20（青色）
- Tier 3: ¥20-50（绿色）
- Tier 4: ¥50-100（黄色）
- Tier 5: ¥100-200（橙色）
- Tier 6: ¥200-500（粉色）
- Tier 7: ≥ ¥500（红色）

### 3. Super Sticker（付费贴纸）
- 显示贴纸图片
- 显示打赏金额
- 紫色渐变背景

### 4. 会员消息
- 显示会员加入/升级信息
- 绿色主题
- 显示会员等级和消息

## 技术实现

### 消息抓取机制

使用 `MutationObserver` 监听 YouTube 聊天容器的 DOM 变化：

```javascript
const messageSelectors = [
    'yt-live-chat-text-message-renderer',        // 普通消息
    'yt-live-chat-paid-message-renderer',        // Super Chat
    'yt-live-chat-paid-sticker-renderer',        // Super Sticker
    'yt-live-chat-membership-item-renderer',     // 会员消息
    'yt-live-chat-legacy-paid-message-renderer'  // 旧版付费消息
];
```

### 消息传输方式

支持 5 种消息传输方式，确保最大兼容性：

1. **Chrome Extension Messages** - 扩展程序消息
2. **LocalStorage** - 本地存储（最可靠）
3. **PostMessage** - 窗口消息
4. **BroadcastChannel** - 广播频道
5. **Custom Events** - 自定义事件

### 数据结构

每条消息包含以下字段：

```javascript
{
    id: "唯一消息ID",
    author: "用户名",
    authorPhoto: "头像URL",
    timestamp: "时间戳",
    type: "消息类型",
    message: "消息文本内容",
    messageHtml: "消息HTML内容（包含表情）",

    // Super Chat 特有字段
    isSuperChat: true,
    purchaseAmount: "金额",
    backgroundColor: "背景颜色",

    // Super Sticker 特有字段
    isSuperSticker: true,
    stickerUrl: "贴纸URL",

    // 会员消息特有字段
    isMembership: true,
    headerPrimary: "主标题",
    headerSub: "副标题"
}
```

## 样式定制

如果需要自定义样式，可以修改 `src/css/youtube-chat.css` 文件。

### 修改 Super Chat 颜色

```css
.super-chat.tier-1 {
    background: linear-gradient(to right, #yourcolor1, #yourcolor2);
}
```

### 修改字体大小

```css
.chat-message {
    font-size: 14px; /* 修改为你想要的大小 */
}
```

### 修改背景颜色

```css
body {
    background: #0f0f0f; /* 修改为你想要的颜色 */
}
```

## 常见问题

### Q1: 消息没有显示怎么办？

**A:** 检查以下几点：
1. 确保浏览器扩展已安装并启用
2. 确保在 YouTube 直播聊天页面运行
3. 打开浏览器控制台查看是否有错误
4. 刷新页面重试

### Q2: 表情符号显示不正常？

**A:**
- 确保使用最新版本的代码
- 检查网络连接（表情图片需要从 YouTube 加载）
- 清除浏览器缓存后重试

### Q3: Super Chat 颜色不正确？

**A:**
- 颜色等级是根据金额自动判断的
- 可以在代码中调整 `getSuperChatTier()` 函数的金额分级

### Q4: TTS 朗读不工作？

**A:**
- 确保浏览器支持 Web Speech API
- 检查系统是否安装了中文语音包
- Chrome 浏览器支持最好

## 在 OBS 中使用

1. **添加浏览器源**
   - 在 OBS 中添加"浏览器"源
   - 本地文件选择 `src/html/simple-chat.html`
   - 或使用本地服务器 URL

2. **设置尺寸**
   - 推荐宽度: 400-500px
   - 推荐高度: 600-800px
   - 可以根据需要调整

3. **设置透明背景**（可选）
   - 修改 CSS 中的 `body` 背景为 `transparent`
   - 在 OBS 中勾选"当非活动时关闭源"

## 开发与贡献

如果你想参与开发或有改进建议：

1. Fork 本项目
2. 创建功能分支
3. 提交 Pull Request

## 许可证

MIT License

## 更新日志

### v1.1.0 (2024-12-18)
- ✅ 完整支持表情符号（emoji 和图片）
- ✅ 支持 Super Chat（所有等级）
- ✅ 支持 Super Sticker
- ✅ 支持会员消息
- ✅ 保留完整的 HTML 内容
- ✅ 模仿 YouTube 原生样式
- ✅ 优化消息传输机制

### v1.0.0
- 基础聊天抓取功能
- TTS 朗读功能
