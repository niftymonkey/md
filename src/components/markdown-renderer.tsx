import { MarkdownAsync } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeShiki from "@shikijs/rehype";
import { rehypeMermaid } from "@/lib/rehype-mermaid";
import { Mermaid } from "@/components/mermaid";

export async function MarkdownRenderer({ content }: { content: string }) {
  return (
    <MarkdownAsync
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeMermaid,
        [
          rehypeShiki,
          {
            themes: { light: "github-light", dark: "github-dark" },
            defaultColor: false,
            langs: [
              "bash",
              "css",
              "diff",
              "go",
              "html",
              "java",
              "js",
              "json",
              "jsx",
              "md",
              "py",
              "rb",
              "rs",
              "sh",
              "sql",
              "ts",
              "tsx",
              "yaml",
            ],
          },
        ],
      ]}
      components={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        div(props: any) {
          if (props.className === "mermaid-block") {
            const chart = props["data-chart"] ?? "";
            return <Mermaid chart={chart} />;
          }
          return <div {...props} />;
        },
        a(props) {
          return <a {...props} target="_blank" rel="noopener noreferrer" />;
        },
      }}
    >
      {content}
    </MarkdownAsync>
  );
}
