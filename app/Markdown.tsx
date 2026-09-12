"use client";

/**
 * Markdown.tsx: renders tutor/quiz text as Markdown with LaTeX math (Milestone 4).
 *
 * Replaces the prototype's marked + KaTeX auto-render. Math delimiters: inline
 * `$...$`, display `$$...$$` (handled by remark-math + rehype-katex). Incomplete
 * math during streaming simply renders as literal text until its closing
 * delimiter arrives, so partial tokens never crash.
 *
 * Also strips em/en dashes as a safety net. The system prompts ban them, but
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
 * Currency guard. remark-math treats any $...$ pair as inline math, even one
 * that runs across lines, so a bare dollar amount can pair with a far-off $
 * and hand the prose between them to KaTeX. The prompts tell the model to
 * write currency as \$100, but RAG'd syllabus chunks and student-typed text
 * flow through this renderer too, so we also guard deterministically.
 *
 * The rule: a $ is a math delimiter only if it has a matching closing $ on the
 * same line and the span between them is a plausible inline math span. Those
 * pairs are left untouched so KaTeX still gets them. Every other $ is escaped
 * and renders as a literal dollar sign. This used to go the other way (escape
 * any pair that didn't look like math), which broke the model's $144.29$ and
 * $5.00\%$: pure-number spans were escaped and shown with literal $ signs.
 *
 * Left alone entirely: \$ (already escaped), $$ (display math), fenced code
 * blocks, and inline `code` spans (escaping there would show a backslash).
 */

// Rejects a same-line $...$ pair that is really prose between two dollar amounts.
function isInlineMathSpan(inner: string): boolean {
  if (!inner) return false;
  // A LaTeX control sequence is conclusive; nothing in prose produces one.
  if (/\\[a-zA-Z]/.test(inner)) return true; // \text, \frac, \%
  // TeX disallows whitespace hugging the delimiters, and a currency pair almost
  // always has it: "$100 now or wait for $" ends with a space.
  if (/^\s|\s$/.test(inner)) return false;
  // "$5-$10", "$5,$10": math never ends on a dangling operator or comma.
  if (/[-+*/,]$/.test(inner)) return false;
  return true;
}

// Two fixes inside a kept math span:
// - A bare % starts a TeX comment and swallows the rest of the span, so make it \%.
// - A \$ (currency inside math, e.g. $120 \times 10/365 = \$3.29$) is valid TeX, but
//   remark-math does not honor backslash escapes inside math: it closes the span at
//   that $, leaving a dangling backslash and mispairing every later $ on the line.
//   \text{\textdollar} draws the same dollar sign without a $ character.
function fixMathSpan(math: string): string {
  return math.replace(/(?<!\\)%/g, "\\%").replace(/\\\$/g, "\\text{\\textdollar}");
}

// Index of the $ that closes an inline span opened just before `from`, or -1.
function findClosingDollar(line: string, from: number): number {
  for (let j = from; j < line.length; j++) {
    if (line[j] === "\\") {
      j++; // skip the escaped character, including \$
    } else if (line[j] === "$") {
      return line[j + 1] === "$" ? -1 : j; // a $$ is display math, not our closer
    }
  }
  return -1;
}

function guardSegment(segment: string): string {
  let out = "";
  let i = 0;
  while (i < segment.length) {
    const ch = segment[i];
    if (ch === "\\") {
      out += segment.slice(i, i + 2); // keep escapes such as \$ as written
      i += 2;
    } else if (ch !== "$") {
      out += ch;
      i++;
    } else if (segment[i + 1] === "$") {
      out += "$$";
      i += 2;
    } else {
      const close = findClosingDollar(segment, i + 1);
      const inner = close === -1 ? "" : segment.slice(i + 1, close);
      if (close !== -1 && isInlineMathSpan(inner)) {
        out += `$${fixMathSpan(inner)}$`;
        i = close + 1;
      } else {
        out += "\\$";
        i++;
      }
    }
  }
  return out;
}

function protectCurrency(text: string): string {
  let inFence = false;
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      // Odd entries of the split are inline code spans; guard only the text around them.
      return line
        .split(/(`+[^`]*`+)/)
        .map((part, idx) => (idx % 2 ? part : guardSegment(part)))
        .join("");
    })
    .join("\n");
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
