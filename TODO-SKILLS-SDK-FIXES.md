# Skills SDK 修复 TODO 清单

## P0 必做（先修）

- [x] 将聊天执行链路从自定义 `@anthropic-ai/sdk` 切到 `@anthropic-ai/claude-agent-sdk` 的 `query(...)`
  - 目标：不再手工拼接 system prompt 注入技能全文
  - 验收：请求路径中能看到 `options.settingSources` 与 `options.allowedTools`

- [x] 按官方目录改造技能存储位置
  - 项目级：`<cwd>/.claude/skills/*/SKILL.md`
  - 用户级：`~/.claude/skills/*/SKILL.md`
  - 验收：删除 `~/.agents/skills`、`~/.skills` 依赖路径

- [x] 接入官方 Skills 启用方式
  - 在 SDK 配置中显式设置：
    - `settingSources: ["user", "project"]`（必要时含 `"local"`）
    - `allowedTools` 至少包含 `"Skill"`
  - 验收：不再依赖前端“手动选择 skillSlugs”才能生效

## P1 应做（功能与一致性）

- [ ] 重构 Skills API（`/api/skills*`）语义
  - 从“私有技能仓库”语义改为“管理 `.claude/skills` 文件系统资产”
  - 验收：列表、创建、更新、删除都直接映射官方目录结构

- [ ] 重构 Registry 安装流程
  - 安装后目标应落在 `.claude/skills/<slug>/SKILL.md`
  - 保留 slug 安全校验与命令参数化执行（已做）
  - 验收：安装后无需额外复制/同步即可被 SDK 自动发现

- [ ] 更新前端交互策略
  - 将“技能开关”从强制选择改为可选（默认自动发现+自动触发）
  - 增加“已发现 Skills”只读列表，展示来源（project/user/plugin）

## P2 建议做（质量与文档）

- [ ] 更新 README 与 UI 文案
  - 用官方术语替换当前描述：`settingSources`、`allowedTools`、`Skill`
  - 明确 `SKILL.md` 的 SDK 约束（例如 frontmatter 的工具限制在 SDK 下不生效）

- [ ] 增加回归测试
  - 覆盖场景：
    - 未配置 `settingSources` 时找不到 Skills
    - 配置后可发现 project/user Skills
    - `allowedTools` 不含 `Skill` 时技能不触发

- [ ] 增加运行时诊断日志
  - 输出当前加载到的 setting sources、发现的 skill 数量、被拒绝工具原因

## 建议实施顺序

1. 执行链路切换到 `claude-agent-sdk query(...)`
2. 目录与 API 迁移到 `.claude/skills`
3. 前端交互与 README 同步
4. 自动化测试与诊断补齐
