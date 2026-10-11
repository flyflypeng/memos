# Memo 正文改由浏览器用 remark/GFM 渲染；服务端只保留 gomark 提取元数据

过去由服务端用 gomark 解析 Memo 正文，再以 `memo.nodes` 的形式发给浏览器。gomark 的表格解析有这些问题：

- 遇到每个 `|` 都切开单元格，不管是 `\|` 还是写在行内代码里；
- 要求每个单元格两侧都有空格，不允许空单元格；
- HTML 只支持 `<br />`。

因此常见的 GFM 表格会退化成纯文本。

现在改由浏览器解析 `memo.content`，使用 unified/remark 生态（GFM、数学公式、经过消毒的 HTML）。Memos 专有语法通过 remark 插件支持，包括 `#tag`、`![[memos/uid]]`、`![[resources/uid]]`、`[[memos/uid]]`、`==highlight==`、`||spoiler||`、`^sup^`、`~sub~`、```` ```mermaid ````、```` ```__html ````。

同时删除 `memo.nodes`，浏览器也不再调用 `RestoreMarkdownNodes`；勾选任务改为按源码位置直接修改文本。服务端保留 gomark，只用于提取标签和 payload 属性、生成摘要、渲染 RSS。

## 考虑过的方案

- **修补 gomark 的表格解析器。** 改动最小，但只能修好表格。gomark 的其他非标准行为（HTML 只支持 `<br />`、图片 URL 不能含空格、嵌套受限）还会不断带来零散的 bug。
- **服务端换成 goldmark，保留 `nodes` 协议。** 前后端结果一致，但要用 Go 重写 AST 与 proto 之间的转换、Restore，以及每一种 Memos 专有语法扩展。可见效果相同，工作量却最大。

## 后果

- 标签识别会有两份实现：前端 remark 插件负责显示，服务端 gomark 负责筛选。两边必须遵循同一套标签规则。如果不一致，会出现显示了标签却筛选不到，或者筛选得到却没有显示的情况。
- 读取 `memo.nodes` 的第三方客户端将无法使用。本 fork 只通过自己的网页界面使用。
- RSS 输出仍然使用 gomark，表格限制依旧存在。
