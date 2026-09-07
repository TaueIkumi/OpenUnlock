# OpenUnlock

**Your data should survive the SaaS that created it.**

[![CI](https://github.com/TaueIkumi/OpenUnlock/actions/workflows/ci.yml/badge.svg)](https://github.com/TaueIkumi/OpenUnlock/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/openunlock.svg)](https://www.npmjs.com/package/openunlock)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![GitHub stars](https://img.shields.io/github/stars/TaueIkumi/OpenUnlock?style=social)](https://github.com/TaueIkumi/OpenUnlock/stargazers)

Almost every app has an "export my data" button — ChatGPT, Notion, Slack,
Google, and dozens more. What comes out is usually a folder of confusing
files: raw JSON with no formatting, oddly named files, or a format only that
one app understands. **OpenUnlock turns that export into files you can
actually open, read, and search** — plain text, Markdown, or a simple
database — using nothing but your own computer.

> If you know [FFmpeg](https://ffmpeg.org) (the tool that converts between
> video formats): it's that, but for SaaS data exports.

**Local-first. No account. No cloud. No telemetry.**

![OpenUnlock demo: converting a ChatGPT export into readable Markdown and validating it](./docs/media/demo.gif)

```bash
npx openunlock convert my-chatgpt-export.zip
```

---

## Why OpenUnlock

- 🔓 **No lock-in.** Convert once, and what you get back is a plain file you
  can open in any text editor forever — not a format only one app understands.
- 🧩 **Works the same way for every service.** Under the hood, every source
  and every output format plugs into one shared model, which is why
  OpenUnlock can support 11 services and 8 output formats at once without
  turning into an unmaintainable mess (see [How it works](#how-it-works)).
- 🕵️ **Never silently throws anything away.** If something in your export
  genuinely can't be converted (it happens sometimes), OpenUnlock tells you
  exactly what and why, in a plain report file — instead of quietly dropping it.
- 🌱 **The same input always produces the same output.** Convert the same
  export twice and get an identical result, byte for byte — nothing shuffled,
  nothing random. That makes it possible to track how your data changes over
  time using ordinary version control (like Git), if you want to.
- 🩺 **Checks its own work.** `openunlock doctor` scans a converted folder
  for broken links, missing files, or anything that looks tampered with.
- 🔒 **Never touches the network.** Nothing is uploaded anywhere — your data
  never leaves your machine during conversion.

## Quick start

No install needed — `npx` fetches it on the fly:

```bash
npx openunlock inspect export.zip                  # what's in here, before committing to anything
npx openunlock convert export.zip                  # auto-detect source, convert to Markdown
npx openunlock convert export.zip --to sqlite       # ...or SQLite, Obsidian, static HTML, JSON...
npx openunlock doctor ./openunlock-output          # validate the result
```

Or install it once and drop the `npx`:

```bash
npm install -g openunlock
openunlock convert export.zip
```

### Running from source

```bash
git clone https://github.com/TaueIkumi/OpenUnlock.git && cd OpenUnlock
pnpm install
pnpm dev -- convert export.zip
```

`pnpm dev --` runs the CLI directly from TypeScript source with no build
step — useful for trying an in-progress change, or for contributing.

## Supported sources → destinations

**12 sources in:** ChatGPT · Notion · Slack · Trello · Evernote · Discord ·
Claude · Linear · Airtable · Google Keep · Google Tasks · Gemini Gems

**8 formats out:** Markdown · JSON · JSONL (JSON, one record per line) ·
normalized filesystem tree (one file per item) · SQLite (a queryable
database file) · Obsidian vault · static HTML archive (open in any browser)
· Mattermost bulk-import

Every source is detected **structurally** (never by filename alone), every
conversion is **deterministic**, and every adapter has its own test suite,
synthetic fixtures, and golden-output snapshots. See
[`docs/format-compatibility.md`](./docs/format-compatibility.md) for the full,
warts-and-all compatibility matrix — including the handful of places where a
source export is genuinely lossy (e.g. Slack's official export never includes
attachment bytes) and exactly how that's surfaced instead of hidden.

## How it works

```
Source Export  →  Adapter  →  Canonical Model  →  Exporter  →  Portable Output
```

Adapters only know how to *read* one source format into the shared canonical
schema (`Workspace`, `Document`, `Conversation`, `Message`, `Person`,
`Attachment`, `Relation`...). Exporters only know how to *write* that schema
into one output format. Neither side knows the other exists. That's the whole
architecture — see [`docs/canonical-schema.md`](./docs/canonical-schema.md)
and [`docs/adapter-authoring.md`](./docs/adapter-authoring.md) if you want to
add a new source or destination yourself.

## Development

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
```

## Contributing

Issues and PRs are welcome — new adapters, new exporters, bug reports, or
just export samples from a service that isn't supported yet. If you're adding
a source, start with [`docs/adapter-authoring.md`](./docs/adapter-authoring.md);
fixtures must be synthetic (never real private exports).

## Star History

If OpenUnlock is useful to you, a star helps other people find it — and
genuinely helps prioritize what gets built next.

[![Star History Chart](https://api.star-history.com/svg?repos=TaueIkumi/OpenUnlock&type=Date)](https://star-history.com/#TaueIkumi/OpenUnlock&Date)

## License

[MIT](./LICENSE)
