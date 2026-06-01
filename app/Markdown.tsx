"use client";

/**
 * Markdown.tsx — renders tutor/quiz text as Markdown with LaTeX math (Milestone 4).
 *
 * Replaces the prototype's marked + KaTeX auto-render. Math delimiters: inline
 * `$...$`, display `$$...$$` (handled by remark-math + rehype-katex). Incomplete
 * math during streaming simply renders as literal text until its closing
 * delimiter arrives, so partial tokens never crash.
 *
 * Also strips em/en dashes as a safety net — the system prompts ban them, but
 * gpt-5-mini occasionally emits one anyway.
 */

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";

function stripDashes(text: string): string {
  return text.replace(/[—–]/g, ",");
}

export function Markdown({
  children,
  className,
  inline = false,
}: {
  children: string;
  className?: string;
  inline?: boolean;
}) {
  const body = (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkBreaks]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: "#c0392b" }]]}
      // In inline contexts (e.g. an MCQ choice), don't wrap text in block <p>.
      components={inline ? { p: ({ children }: { children?: ReactNode }) => <>{children}</> } : undefined}
    >
      {stripDashes(children)}
    </ReactMarkdown>
  );

  if (inline) return <span className={className}>{body}</span>;
  return <div className={className}>{body}</div>;
}
