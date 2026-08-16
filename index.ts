import { StringEnum } from "@earendil-works/pi-ai";
import {
  type ExtensionAPI,
  getMarkdownTheme,
  keyHint,
  type Theme,
  type ToolRenderResultOptions,
} from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

interface SearchResult {
  title: string;
  url: string;
  description: string;
  extra_snippets?: string[];
}

/** Number of markdown lines shown when the result row is collapsed (ctrl+o to expand). */
const PREVIEW_LINES = 10;

function moreLinesHint(remaining: number, theme: Theme): string {
  return (
    theme.fg("muted", `... (${remaining} more lines,`) +
    " " +
    keyHint("app.tools.expand", "to expand") +
    theme.fg("muted", ")")
  );
}

function renderMarkdownResult(
  result: { content: Array<{ type: string; text?: string }> },
  options: ToolRenderResultOptions,
  theme: Theme,
  context: { isError: boolean },
): Container {
  const textContent = result.content.find((item) => item.type === "text");
  let output = textContent?.text ?? "";

  let hint = "";
  if (output && !options.expanded && !options.isPartial && !context.isError) {
    const lines = output.split("\n");
    if (lines.length > PREVIEW_LINES) {
      hint = moreLinesHint(lines.length - PREVIEW_LINES, theme);
      output = lines.slice(0, PREVIEW_LINES).join("\n");
    }
  }

  const container = new Container();
  container.addChild(new Spacer(1));
  if (output) {
    container.addChild(new Markdown(output, 0, 0, getMarkdownTheme()));
  }
  if (hint) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(hint, 0, 0));
  }
  return container;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search Brave's web index and return relevant results as markdown.",
    promptSnippet: "Search the web for information on a topic",
    promptGuidelines: [
      "Use web_search when the user asks you to look up current information, facts, or content from the web.",
    ],
    renderCall(args, theme, _context) {
      let text = theme.fg("toolTitle", theme.bold("web_search "));
      text += theme.fg("accent", args.query);
      if (args.freshness) {
        text += theme.fg("dim", " (" + args.freshness + ")");
      }
      return new Text(text, 0, 0);
    },
    renderResult: renderMarkdownResult,

    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      freshness: Type.Optional(
        StringEnum(["pd", "pw", "pm", "py"] as const, {
          description:
            "Filter by recency: pd (last 24h), pw (last 7 days), pm (last 31 days), py (last year)",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const { query, freshness } = params as {
        query: string;
        freshness?: string;
      };

      const apiKey = process.env.BRAVE_API_KEY;
      if (!apiKey) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: BRAVE_API_KEY environment variable is not set.",
            },
          ],
          details: {},
        };
      }

      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", "10");
      url.searchParams.set("extra_snippets", "true");
      if (freshness) {
        url.searchParams.set("freshness", freshness);
      }

      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            "X-Subscription-Token": apiKey,
            Accept: "application/json",
          },
          signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return {
            content: [{ type: "text" as const, text: "Search aborted." }],
            details: {},
          };
        }
        throw err;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return {
          content: [
            {
              type: "text" as const,
              text: `Search failed (${response.status}): ${body || response.statusText}`,
            },
          ],
          details: {},
        };
      }

      const data = (await response.json()) as {
        web?: { results?: SearchResult[] };
      };
      const results = data.web?.results;

      if (!results || results.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No results found for "${query}".` }],
          details: {},
        };
      }

      const lines = results.map((r, i) => {
        const parts = [`${i + 1}. **[${r.title}](${r.url})**`];
        if (r.description) {
          parts.push(`   ${r.description}`);
        }
        if (r.extra_snippets) {
          for (const snippet of r.extra_snippets) {
            parts.push(`   > ${snippet}`);
          }
        }
        return parts.join("\n");
      });

      return {
        content: [{ type: "text" as const, text: lines.join("\n\n") }],
        details: {},
      };
    },
  });
}
