import type { CompileContext, Token } from "mdast-util-from-markdown";
import type { Construct, State, Tokenizer } from "micromark-util-types";
import type { Processor } from "unified";
import EmbeddedMemo from "../embeds/EmbeddedMemo";
import EmbeddedResource from "../embeds/EmbeddedResource";
import ReferencedMemo from "../embeds/ReferencedMemo";
import { memosElement, type MemoMarkdownPlugin } from "../plugin";

declare module "micromark-util-types" {
  interface TokenTypeMap {
    memosEmbed: "memosEmbed";
    memosReference: "memosReference";
  }
}

// Splits an embed or reference target (`memos/uid?params`) into its resource type, UID and params.
// As in gomark, the name ends at the first `?` that is not escaped by a backslash.
const parseTarget = (target: string) => {
  let index = target.indexOf("?");
  while (index > 0 && target[index - 1] === "\\") {
    index = target.indexOf("?", index + 1);
  }
  const match = /^(memos|resources)\/([^/]+)$/.exec(index > 0 ? target.slice(0, index) : target);
  return match && { type: match[1], uid: match[2], params: index > 0 ? target.slice(index + 1) : "" };
};

// `![[memos/uid]]` or `![[resources/uid]]` alone on a line (gomark: the line must end with `]]`).
const parseEmbed = (line: string) => {
  const target = /^!\[\[(.+)\]\]$/.exec(line)?.[1];
  return target === undefined ? null : parseTarget(target);
};

// `[[memos/uid]]` anywhere in a line; the target ends at the first `]]`.
const parseReference = (text: string) => {
  const target = parseTarget(text.slice(2, -2));
  return target?.type === "memos" ? target : null;
};

// micromark codes below -2 are line endings; null is the end of the document.
const isLineEnd = (code: number | null) => code === null || code < -2;

// Flow construct on `!`: takes the whole line, then accepts it only if it is a valid embed. It may
// interrupt a paragraph, since gomark treats every line as its own block.
const tokenizeEmbed: Tokenizer = function (effects, ok, nok) {
  const inside: State = (code) => {
    if (isLineEnd(code)) {
      const token = effects.exit("memosEmbed");
      return parseEmbed(this.sliceSerialize(token)) ? ok(code) : nok(code);
    }
    effects.consume(code);
    return inside;
  };
  return (code) => {
    effects.enter("memosEmbed");
    effects.consume(code);
    return inside;
  };
};

// Text construct on `[`: `[[`, then everything up to the first `]]` on the same line.
const tokenizeReference: Tokenizer = function (effects, ok, nok) {
  const inside: State = (code) => {
    if (isLineEnd(code)) {
      return nok(code);
    }
    effects.consume(code);
    return code === 93 ? close : inside;
  };
  const close: State = (code) => {
    if (code !== 93) {
      return inside(code);
    }
    effects.consume(code);
    const token = effects.exit("memosReference");
    return parseReference(this.sliceSerialize(token)) ? ok : nok;
  };
  const secondBracket: State = (code) => {
    if (code !== 91) {
      return nok(code);
    }
    effects.consume(code);
    return inside;
  };
  return (code) => {
    effects.enter("memosReference");
    effects.consume(code);
    return secondBracket;
  };
};

const embedConstruct: Construct = { name: "memosEmbed", tokenize: tokenizeEmbed };
const referenceConstruct: Construct = { name: "memosReference", tokenize: tokenizeReference };

function remarkMemosEmbeds(this: Processor) {
  const data = this.data();
  (data.micromarkExtensions ??= []).push({ flow: { 33: embedConstruct }, text: { 91: referenceConstruct } });
  (data.fromMarkdownExtensions ??= []).push({
    exit: {
      memosEmbed(this: CompileContext, token: Token) {
        const { type, uid, params } = parseEmbed(this.sliceSerialize(token))!;
        this.enter(memosElement(type === "memos" ? "embeddedMemo" : "embeddedResource", { uid, params }), token);
        this.exit(token);
      },
      memosReference(this: CompileContext, token: Token) {
        const { uid, params } = parseReference(this.sliceSerialize(token))!;
        this.enter(memosElement("referencedMemo", { uid, params }), token);
        this.exit(token);
      },
    },
  });
}

export default {
  remarkPlugins: [remarkMemosEmbeds],
  components: { embeddedMemo: EmbeddedMemo, embeddedResource: EmbeddedResource, referencedMemo: ReferencedMemo },
} satisfies MemoMarkdownPlugin;
