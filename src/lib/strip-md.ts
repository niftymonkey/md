import removeMarkdown from "remove-markdown";

export function stripMarkdown(content: string): string {
  return removeMarkdown(content, {
    stripListLeaders: true,
    listUnicodeChar: "",
    gfm: true,
    useImgAltText: true,
  })
    .replace(/\s+/g, " ")
    .trim();
}
