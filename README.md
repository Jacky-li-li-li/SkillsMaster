# Skills Master 🚀

<div align="center">

**轻松上手体验 Skills 是什么 - 探索 Claude Agent SDK 的技能管理系统**

一个基于 Claude Agent SDK 构建的强大技能管理平台，让 AI 助手拥有文件操作、网络搜索、数据分析等通用能力。

[快速开始](#快速开始) • [功能特性](#功能特性) • [安装指南](#安装指南) • [使用教程](#使用教程)

</div>

---

## 📖 目录

- [什么是 Skills Master](#什么是-skills-master)
- [什么是 Skills](#什么是-skills)
- [功能特性](#功能特性)
- [环境要求](#环境要求)
- [安装指南](#安装指南)
- [快速开始](#快速开始)
- [使用教程](#使用教程)
- [测试指南](#测试指南)
- [技能能力展示](#技能能力展示)
- [技术栈](#技术栈)
- [常见问题](#常见问题)
- [关于作者](#关于作者)
- [贡献指南](#贡献指南)

---

## 🎯 什么是 Skills Master

Skills Master 是一个基于 **Claude Agent SDK** 构建的技能管理平台，它让你能够：

- 📝 **创建自定义技能**：为 AI 助手编写专属的能力扩展
- 🌐 **从 Registry 安装技能**：浏览并安装社区共享的技能
- 💬 **在聊天中使用技能**：与 Claude AI 对话时动态加载和使用技能
- 🎨 **可视化管理界面**：友好的 Web UI，无需命令行操作

---

## 💡 什么是 Skills

**Skills（技能）** 是 Claude Agent SDK 中的核心概念，它是一种扩展 AI 能力的方式。通过 Skills，AI 不再局限于简单的对话，而是可以：

### 🔥 Skills 的强大能力

| 能力类型 | 说明 | 示例 |
|---------|------|------|
| **📁 文件操作** | 读取、写入、搜索本地文件 | 分析代码库、生成报告、批量处理文档 |
| **🌍 网络搜索** | 实时搜索互联网信息 | 查找最新资讯、技术文档、市场数据 |
| **🔍 数据分析** | 处理和分析结构化数据 | CSV 分析、日志解析、数据可视化 |
| **🛠️ 工具调用** | 执行系统命令、API 调用 | 运行测试、部署应用、数据库查询 |
| **🎨 内容生成** | 创建各类格式的内容 | Markdown 文档、代码模板、配置文件 |
| **🤖 自动化任务** | 自动完成重复性工作 | 批量重命名、定时备份、数据同步 |

### 🌟 为什么 Skills 重要

传统的 AI 对话只能"说"，而有了 Skills 的 AI 能够"做"：

```
❌ 没有 BrainStroming Skills：
用户：我想开发一个 AI 对话聊天软件
AI：好的，现在就为你准备你需要的方案和代码.....

✅ 有了 BrainStroming Skills：
用户：我想开发一个 AI 对话聊天软件
AI：我来帮你扫描项目...
    [自动读取文件] → [分析代码] → [生成报告]
    好的，这是基于你当前的文件，你是希望针对 A、B、C 哪些人群开发，希望有 1、2、3 哪些功能呢：...
```

**Skills 让 AI 成为真正的工作助手，而不仅仅是聊天机器人。**

### 👤 身份语义规则（重要）

- Skill 内容中的第一人称（例如“我叫 Jacky”）默认表示 **助手 persona**，不是对话用户身份。
- 助手不应仅根据 Skill 内容推断“用户叫什么名字”。
- 只有用户在当前会话中明确自报身份时，助手才应引用该身份信息。

---

## ✨ 功能特性

### 🎛️ 技能管理
- ✅ 创建自定义技能（Markdown 格式）
- ✅ 编辑和删除现有技能
- ✅ 查看技能详情和元数据
- ✅ 技能图标自定义

### 🌐 Registry 集成
- ✅ 浏览 [Skills.sh](https://skills.sh) 社区技能库
- ✅ 一键安装社区技能
- ✅ 查看技能下载量和评分

### 💬 智能对话
- ✅ 实时流式对话体验
- ✅ 动态选择要使用的技能
- ✅ 支持对话历史记录
- ✅ 支持文件上传（多文件）

### ⚙️ 灵活配置
- ✅ 自定义 API Key
- ✅ 支持自定义 Base URL
- ✅ 多模型选择（支持所有 Claude 模型）

---

## 📋 环境要求

在开始之前，请确保你的系统满足以下要求：

| 要求 | 版本 | 说明 |
|------|------|------|
| **Node.js** | ≥ 18.0.0 | [下载安装](https://nodejs.org/) |
| **pnpm** | ≥ 8.0.0 | 推荐的包管理器 |
| **Anthropic API Key** | - | [获取 API Key](https://console.anthropic.com/) |

### 安装 pnpm

如果你还没有安装 pnpm，可以使用以下命令：

```bash
# 使用 npm 安装
npm install -g pnpm

# 或使用 Homebrew (macOS)
brew install pnpm

# 验证安装
pnpm --version
```

---

## 🚀 安装指南

### 步骤 1: 克隆项目

```bash
# 克隆仓库
git clone https://github.com/ErlichLiu/skills-master.git

# 进入项目目录
cd skills-master
```

### 步骤 2: 安装依赖

```bash
# 使用 pnpm 安装所有依赖
pnpm install
```

这个过程可能需要几分钟，请耐心等待。

### 步骤 3: 获取 MiniMax API KEY（推荐购买编程包更划算）

1. 访问 [MiniMax 编程包地址](https://platform.minimaxi.com/subscribe/coding-plan)
2. 注册或登录账号
3. 推荐购买 Starter 版本即可
4. 进入 [Coding Plan 页面](https://platform.minimaxi.com/user-center/payment/coding-plan)，API KEY 区域创建 API KEY 并复制

> ⚠️ **注意**：API Key 非常重要，请妥善保管，不要泄露给他人。

### 步骤 4: 启动开发服务器

```bash
# 启动 Next.js 开发服务器
pnpm dev
```

看到以下输出表示启动成功：

```
✓ Ready in 2.5s
○ Local:    http://localhost:3000
```

---

## 🎬 快速开始

### 1️⃣ 访问应用

在浏览器中打开 [http://localhost:3000](http://localhost:3000)

你会看到 Skills Master 的首页，有两个主要入口：

- **Chat**：进入聊天界面
- **Manage Skills**：管理你的技能

### 2️⃣ 配置 API Key

首次使用需要配置 API Key：

1. 点击 **Chat** 进入聊天界面
2. 在左侧边栏看到设置部分
3. 在 **API Key** 字段粘贴你的 MiniMax API Key，会自动保存

> 💡 **提示**：API Key 会保存在浏览器本地存储中，仅在你的浏览器中使用。

### 3️⃣ 推荐安装你的第一个 Skill

5. 点击 Skills 区域的添加按钮
5. 搜索 brainstorming，安装 obra 版本的 skills
5. 复制命令，在终端软件里输入，选择安装到 Claude Code 即可

### 4️⃣ 在聊天中使用 Skill

1. 返回 **Chat** 页面，刷新
2. 在左侧边栏的 ** Skills** 中找到你刚安装的 **Brainstroming**
3. 点击技能名称，激活该技能
4. 在输入框中输入消息，例如：

   ```
   你好！我想 xxxx
   ```

5. 按下 **Enter** 发送，AI 会使用你创建的技能来回复

---

## 📚 使用教程

### 📝 创建自定义技能

技能文件使用 Markdown 格式，包含两部分：

#### 1. Front Matter（元数据）

```markdown
---
name: 技能名称
description: 技能描述
globs: ["*.js", "*.ts"]  # 可选：文件匹配模式
alwaysAllow: ["read", "write"]  # 可选：自动允许的操作
icon: 🎨  # 可选：技能图标
---
```

#### 2. Prompt Content（提示词内容）

```markdown
你是一个专业的代码审查助手。当用户请求代码审查时：

1. 仔细阅读代码
2. 检查以下方面：
   - 代码风格和规范
   - 潜在的 bug
   - 性能问题
   - 安全隐患
3. 提供具体的改进建议

# 示例

用户：帮我审查这段代码
助手：我来帮你审查...
```

### 🌐 从 Registry 安装技能

1. 进入 **Manage Skills** 页面
2. 切换到 **Browse Registry** 标签
3. 浏览可用的技能列表
4. 点击感兴趣的技能查看详情
5. 点击 **Install** 安装技能
6. 安装成功后，技能会出现在 **My Skills** 列表中

### 💬 在聊天中使用技能

#### 单个技能使用

1. 在 **Available Skills** 列表中选择一个技能
2. 直接在聊天中提问，AI 会自动使用该技能的上下文

#### 多个技能组合

1. 可以同时选择多个技能
2. AI 会根据你的问题自动选择最合适的技能
3. 例如：同时启用"文件搜索"和"代码分析"技能

#### 文件上传

1. 点击输入框左侧的 📎 图标
2. 选择要上传的文件（支持多文件）
3. 文件内容会作为上下文发送给 AI
4. AI 可以分析、处理这些文件

---

## 🧪 测试指南

### 基础功能测试

#### 测试场景 1：文本对话

```
用户：你好，请介绍一下你自己
预期：AI 正常回复介绍
```

#### 测试场景 2：使用技能

```
1. 创建一个"天气助手"技能
2. 在聊天中激活该技能
3. 询问：今天天气怎么样？
预期：AI 按照技能提示词回复
```

#### 测试场景 3：文件上传

```
1. 上传一个 .txt 或 .md 文件
2. 询问：帮我总结这个文件的内容
预期：AI 能够读取并总结文件内容
```

### 高级功能测试

#### 测试场景 4：多技能组合

```
1. 同时激活"文件分析"和"代码审查"技能
2. 上传一个代码文件
3. 询问：帮我分析这段代码的结构并提出改进建议
预期：AI 综合使用两个技能进行分析
```

#### 测试场景 5：长对话历史

```
1. 进行 10 轮以上的对话
2. 询问之前对话中提到的内容
预期：AI 能够记住并引用历史对话
```

---

## 🎨 技能能力展示

### 📁 文件操作示例

创建一个"项目分析"技能：

```markdown
---
name: 项目分析
description: 分析项目代码结构
globs: ["**/*.js", "**/*.ts", "**/*.tsx"]
---

你是一个代码库分析专家。当用户要求分析项目时：

1. 使用 glob 模式查找所有相关文件
2. 分析项目结构：
   - 目录组织
   - 文件命名规范
   - 依赖关系
3. 生成可视化的项目结构图
4. 提供改进建议
```

**使用示例：**

```
用户：帮我分析当前项目的结构
AI：我来扫描你的项目...
    [扫描文件] → [分析结构] → [生成报告]
```

### 🌍 网络搜索示例

创建一个"技术研究"技能：

```markdown
---
name: 技术研究
description: 搜索并总结最新技术资讯
---

你是一个技术研究助手。当用户询问技术相关问题时：

1. 理解用户的技术需求
2. 搜索互联网获取最新信息
3. 对比不同来源的信息
4. 提供清晰的总结和建议

注意：
- 优先查找官方文档
- 标注信息来源和时效性
- 如果信息有争议，说明不同观点
```

**使用示例：**

```
用户：Next.js 15 有哪些新特性？
AI：我来为你搜索 Next.js 15 的最新信息...
    [搜索官方文档] → [整理特性] → [对比版本]
```

### 🔍 数据分析示例

创建一个"CSV 分析"技能：

```markdown
---
name: CSV 分析
description: 分析和可视化 CSV 数据
globs: ["*.csv"]
---

你是一个数据分析专家。当用户上传 CSV 文件时：

1. 读取并解析 CSV 文件
2. 分析数据：
   - 行列数统计
   - 数据类型推断
   - 缺失值检查
   - 基本统计量（均值、中位数等）
3. 发现数据模式和异常
4. 提供数据清洗建议
```

**使用示例：**

```
用户：[上传 sales_data.csv] 帮我分析这份销售数据
AI：我来分析这份 CSV 文件...
    数据概览：
    - 总行数：1000
    - 列数：8
    - 主要字段：日期、产品、销量、金额

    发现：
    - 10月份销量异常高
    - 产品A占比60%
    - 有3条数据缺失金额
```

### 🛠️ 自动化任务示例

创建一个"批量重命名"技能：

```markdown
---
name: 批量重命名
description: 批量重命名文件
alwaysAllow: ["read", "write"]
---

你是一个文件管理助手。当用户需要批量重命名文件时：

1. 理解用户的命名规则
2. 预览重命名效果（不实际修改）
3. 征得用户确认后执行
4. 报告执行结果

安全提示：
- 始终先预览再执行
- 避免覆盖重要文件
- 保留原文件扩展名
```

---

## 🏗️ 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 16.1.4 | React 全栈框架 |
| **React** | 19.2.3 | UI 组件库 |
| **TypeScript** | 5.x | 类型安全 |
| **Tailwind CSS** | 4.x | 样式框架 |
| **Claude Agent SDK** | 0.2.9 | AI 能力核心 |
| **Anthropic SDK** | 0.71.2 | Claude API 客户端 |
| **Radix UI** | - | 无障碍 UI 组件 |
| **React Hook Form** | 7.71.1 | 表单管理 |
| **Zod** | 4.3.6 | 数据验证 |
| **React Markdown** | 10.1.0 | Markdown 渲染 |

### 项目结构

```
skills-master/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── agent/         # Agent 对话接口
│   │   ├── registry/      # Registry 集成
│   │   └── skills/        # Skills CRUD API
│   ├── chat/              # 聊天页面
│   ├── skills/            # 技能管理页面
│   ├── page.tsx           # 首页
│   └── layout.tsx         # 根布局
├── components/            # React 组件
│   ├── chat/             # 聊天相关组件
│   ├── skills/           # 技能管理组件
│   └── ui/               # 通用 UI 组件
├── lib/                  # 工具库
│   ├── agent/           # Agent 封装
│   ├── skills/          # Skills 管理逻辑
│   └── utils.ts         # 工具函数
├── types/               # TypeScript 类型定义
└── public/              # 静态资源
```

---

## 👨‍💻 关于作者

### Erlich

嗨！我是 **Erlich**，一名独立开发者。

#### 🚀 我正在做什么

我正在构建 **[Proma](https://proma.cool/download)** - 下一代通用的智能软件。

**Proma** 是一个定位下一代的智能软件，目前项目正在重构中，预计 **两周后上线全新版本**！

#### 📮 联系我

- **微信**: geekthings
- **下载**: [https://proma.cool/download](https://proma.cool/download)

> 💡 如果你对 AI、智能软件或 Skills Master 有任何想法，欢迎联系我交流！

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！无论是：

- 🐛 报告 Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码

### 如何贡献

1. **Fork 项目**
   ```bash
   # 点击 GitHub 页面的 Fork 按钮
   ```

2. **创建特性分支**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **提交更改**
   ```bash
   git commit -m "Add some amazing feature"
   ```

4. **推送到分支**
   ```bash
   git push origin feature/amazing-feature
   ```

5. **创建 Pull Request**
   - 在 GitHub 上打开 Pull Request
   - 描述你的更改
   - 等待审查

### 代码规范

- 使用 TypeScript，避免使用 `any` 类型
- 遵循 ESLint 规则
- 编写清晰的注释
- 为新功能添加测试

### 技能贡献

如果你创建了优秀的技能，欢迎：

1. 提交到 [Skills.sh](https://skills.sh) Registry
2. 在项目 Discussions 中分享
3. 创建 Pull Request 添加示例

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 🙏 致谢

感谢以下项目和服务：

- [Anthropic Claude](https://www.anthropic.com/) - 强大的 AI 能力
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk) - 核心框架
- [Skills.sh](https://skills.sh) - 技能注册中心
- [Next.js](https://nextjs.org/) - 优秀的 React 框架
- [Vercel](https://vercel.com/) - 部署平台

---

## 🌟 Star History

如果这个项目对你有帮助，请给我们一个 ⭐️ Star！

---

<div align="center">

**Built with ❤️ by [Erlich](https://proma.cool)**

[⬆ 回到顶部](#skills-master-)

</div>
