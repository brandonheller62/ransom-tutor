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

/*
 * Currency guard. remark-math treats any $...$ pair as inline math, so prose
 * with two dollar amounts ("say, $100 now ... that future $100") gets its
 * middle span handed to KaTeX and rendered as squashed math italic. The
 * system prompts tell the model to escape currency, but RAG'd syllabus chunks
 * and student-typed text flow through this renderer too, so we also guard
 * deterministically: any single-$ span that doesn't look like math gets both
 * dollars escaped and renders literally. $$...$$ display math is never touched.
 */

// A span is real math if it has a LaTeX command, a sub/superscript, an
// equals sign, or is a single whitespace-free token containing a letter.
function looksLikeMath(inner: string): boolean {
  if (/\\[a-zA-Z]/.test(inner)) return true; // \text, \frac, \pi
  if (/[\^_=]/.test(inner)) return true; // v_0, x^2, F = ma
  if (/^\S{1,15}$/.test(inner) && /[a-zA-Z]/.test(inner)) return true; // $x$, $v_0$
  return false;
}

function protectCurrency(text: string): string {
  return text.replace(
    /(?<!\$)\$(?!\$)([^$\n]{0,200})\$(?!\$)/g,
    (whole, inner: string) => (looksLikeMath(inner) ? whole : `\\$${inner}\\$`)
  );
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
      {protectCurrency(stripDashes(children))}
    </ReactMarkdown>
  );

  if (inline) return <span className={className}>{body}</span>;
  return <div className={className}>{body}</div>;
}
