# scry

A [pi](https://github.com/earendil-works/pi-coding-agent) extension that gives the LLM web search via the [Brave Search API](https://api-dashboard.search.brave.com/documentation).

## Install

```bash
pi install github.com/johanvandegriff/scry
```

Or clone and link locally:

```bash
git clone https://github.com/johanvandegriff/scry
cd scry && npm install
pi -e ./index.ts
```

## Setup

Get a free API key at [brave.com/search/api](https://brave.com/search/api/) and set it:

```bash
export BRAVE_API_KEY=your_key_here
```

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) to persist it.

## Usage

Ask pi anything that benefits from up-to-date web results. The LLM will call `web_search` automatically when it needs to look something up.

You can also prompt it directly:

> Search the web for the latest Node.js 22 changelog

## Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | yes | Search query |
| `freshness` | enum | no | `pd` (24h), `pw` (7d), `pm` (31d), `py` (year) |

Returns 10 results with titles, URLs, descriptions, and extra snippets.
