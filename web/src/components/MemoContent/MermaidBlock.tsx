import { useEffect, useRef, useSyncExternalStore } from "react";

interface Props {
  content: string;
}

// The app theme is the `dark` class on <html> (set in App), so it also works outside the MUI provider.
// Module-level so useSyncExternalStore keeps one subscription instead of resubscribing every render.
const subscribeToTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};

const MermaidBlock = ({ content }: Props) => {
  const theme = useSyncExternalStore(subscribeToTheme, () => document.documentElement.classList.contains("dark")) ? "dark" : "default";
  const mermaidDockBlock = useRef<HTMLPreElement>(null);

  useEffect(() => {
    // Lazy import: mermaid is several MB, so it loads only when a memo contains a diagram.
    const initializeMermaid = async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme });
      if (mermaidDockBlock.current) {
        mermaid.run({
          nodes: [mermaidDockBlock.current],
        });
      }
    };

    initializeMermaid();
  }, [content, theme]);

  // not-prose: prose paints <pre> dark, which hides the light theme's dark labels and arrows.
  // key: mermaid replaces the source with an SVG, so a new theme or source needs a fresh element.
  return (
    <pre key={`${theme}\n${content}`} ref={mermaidDockBlock} className="not-prose w-full p-2 whitespace-pre-wrap relative">
      {content}
    </pre>
  );
};

export default MermaidBlock;
