import { describe, expect, it } from "vitest";
import type { VaultEntry } from "./types";
import {
  backlinksFor,
  fileStem,
  injectWikilinksIntoBlocks,
  postProcessWikilinks,
  resolveWikilink,
  splitWikilinks,
  wordCount,
} from "./wikilinks";

const entry = (path: string, title: string, extra: Partial<VaultEntry> = {}): VaultEntry => ({
  path,
  title,
  noteType: null,
  status: null,
  tags: [],
  snippet: "",
  modified: 0,
  created: 0,
  frontmatter: null,
  belongsTo: [],
  relatedTo: [],
  has: [],
  wikilinks: [],
  ...extra,
});

describe("splitWikilinks", () => {
  it("splits text around wikilinks", () => {
    expect(splitWikilinks("see [[Note A]] and [[B|alias]]!")).toEqual([
      { kind: "text", text: "see " },
      { kind: "wikilink", title: "Note A" },
      { kind: "text", text: " and " },
      { kind: "wikilink", title: "B" },
      { kind: "text", text: "!" },
    ]);
  });

  it("returns plain text untouched", () => {
    expect(splitWikilinks("no links")).toEqual([{ kind: "text", text: "no links" }]);
  });
});

describe("postProcessWikilinks", () => {
  it("unescapes brackets that the markdown exporter escaped", () => {
    expect(postProcessWikilinks("a \\[\\[Note\\]\\] b")).toBe("a [[Note]] b");
  });
});

describe("resolveWikilink", () => {
  const entries = [
    entry("Notes/Alpha.md", "Alpha Note"),
    entry("Beta.md", "Beta"),
  ];
  it("matches by title case-insensitively", () => {
    expect(resolveWikilink(entries, "alpha note")?.path).toBe("Notes/Alpha.md");
  });
  it("falls back to filename stem", () => {
    expect(resolveWikilink(entries, "Alpha")?.path).toBe("Notes/Alpha.md");
  });
  it("returns undefined for unknown targets", () => {
    expect(resolveWikilink(entries, "Gamma")).toBeUndefined();
  });
});

describe("backlinksFor", () => {
  it("collects body and frontmatter references", () => {
    const target = entry("Target.md", "Target");
    const viaBody = entry("A.md", "A", { wikilinks: ["Target"] });
    const viaRelation = entry("B.md", "B", { belongsTo: ["target"] });
    const unrelated = entry("C.md", "C");
    expect(
      backlinksFor([target, viaBody, viaRelation, unrelated], target).map((e) => e.path),
    ).toEqual(["A.md", "B.md"]);
  });
});

describe("injectWikilinksIntoBlocks", () => {
  it("converts wikilink text runs into inline content nodes", () => {
    const blocks = [
      {
        type: "paragraph",
        content: [{ type: "text", text: "go to [[Home]] now", styles: {} }],
        children: [],
      },
    ];
    const [block] = injectWikilinksIntoBlocks(blocks);
    expect(block.content).toEqual([
      { type: "text", text: "go to ", styles: {} },
      { type: "wikilink", props: { title: "Home" } },
      { type: "text", text: " now", styles: {} },
    ]);
  });

  it("leaves blocks without wikilinks alone", () => {
    const blocks = [
      { type: "paragraph", content: [{ type: "text", text: "plain", styles: {} }], children: [] },
    ];
    expect(injectWikilinksIntoBlocks(blocks)[0].content).toEqual(blocks[0].content);
  });
});

describe("helpers", () => {
  it("fileStem strips folders and extension", () => {
    expect(fileStem("People/Ada Lovelace.md")).toBe("Ada Lovelace");
  });
  it("wordCount ignores punctuation-only tokens", () => {
    expect(wordCount("hello world — 42")).toBe(3);
  });
});
