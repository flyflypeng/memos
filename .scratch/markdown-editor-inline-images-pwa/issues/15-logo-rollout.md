# 15：全站替换 Logo

**要做什么：** 用户选定的 Logo 替换全站所有图标：favicon、浏览器标签页、登录页和侧边栏的 logo/full-logo、apple-touch-icon、PWA 的 192/512 any 和 maskable 图标。应用名称仍为「Memos」。

**被阻塞于：** 13、14

**Status:** resolved

- [ ] 所有栅格图标都由选定的 SVG 生成，不手工修改
- [ ] maskable 图标的主体位于安全区内
- [ ] 在浏览器中检查 favicon、登录页、侧边栏，浅色和深色主题下都正常
- [ ] 安装后的 PWA 图标是新 Logo（开发机 localhost 预检）

参考：`.scratch/markdown-editor-inline-images-pwa/spec.md`、ADR 0001、ADR 0002、`GLOSSARY.md`。
