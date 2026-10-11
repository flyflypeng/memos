# Issue tracker：本地 Markdown

本仓库的 issue 和 spec 以 Markdown 文件的形式存放在 `.scratch/` 中。

## 约定

- 每个功能一个目录：`.scratch/<feature-slug>/`
- spec 文件为 `.scratch/<feature-slug>/spec.md`
- 实现类 issue 每张工单一个文件，路径为 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 开始编号；不要把多张工单合并到一个文件里
- triage 状态写在每个 issue 文件顶部附近的 `Status:` 行（状态取值见 `triage-labels.md`）
- 评论和讨论记录追加在文件末尾的 `## Comments` 标题下（标题保持英文原样，供工具解析）

## 当 skill 要求「发布到 issue tracker」时

在 `.scratch/<feature-slug>/` 下新建文件；目录不存在时先创建。

## 当 skill 要求「获取相关工单」时

读取给定路径的文件。用户通常会直接给出路径或 issue 编号。

## Wayfinding 操作

供 `/wayfinder` 使用。**map** 是一个文件，每张工单对应一个 **child** 文件。

- **Map**：`.scratch/<effort>/map.md`，正文包含 Notes、Decisions-so-far、Fog 三部分。
- **Child 工单**：`.scratch/<effort>/issues/NN-<slug>.md`，从 `01` 开始编号，正文写问题。用 `Type:` 行记录工单类型（`research`/`prototype`/`grilling`/`task`），用 `Status:` 行记录 `claimed`/`resolved`。
- **阻塞**：在文件顶部附近写一行 `Blocked by: NN, NN`。所列文件全部为 `resolved` 时，该工单解除阻塞。
- **Frontier**：扫描 `.scratch/<effort>/issues/`，找出未关闭、未阻塞且无人认领的文件，编号最小的优先。
- **认领**：开始任何工作前，先把 `Status:` 改为 `claimed` 并保存。
- **解决**：在 `## Answer` 标题下追加答案，把 `Status:` 改为 `resolved`，再在 `map.md` 的 Decisions-so-far 中追加一条上下文指引（要点和链接）。
