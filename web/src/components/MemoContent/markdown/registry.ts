import type { ComponentType } from "react";
import type { MemoMarkdownPlugin } from "./plugin";

// Every file in ./plugins/ default-exports a MemoMarkdownPlugin; file-name order is plugin order.
const pluginModules = import.meta.glob<{ default: MemoMarkdownPlugin }>("./plugins/*.{ts,tsx}", { eager: true });

export const memoMarkdownPlugins: MemoMarkdownPlugin[] = Object.keys(pluginModules)
  .sort()
  .map((path) => pluginModules[path].default);

export const memosElementComponents = new Map<string, ComponentType<never>>();
for (const plugin of memoMarkdownPlugins) {
  for (const [name, component] of Object.entries(plugin.components ?? {})) {
    if (memosElementComponents.has(name)) {
      throw new Error(`MemosElement "${name}" is registered by more than one plugin`);
    }
    memosElementComponents.set(name, component);
  }
}
