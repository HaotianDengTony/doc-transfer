# Document Transfer Tool

A browser-based tool that converts Siemens Healthineers product manuals (翻译版说明书) into Chinese NMPA regulatory compliance format (合规说明书).

## What it does

1. Upload a Siemens product manual (`.docx`, Chinese translated version)
2. The tool automatically extracts content and fills it into the standardized NMPA template
3. Review the extraction summary and fill in two manual fields (validity period)
4. Download the ready-to-use compliance document (`.docx`)

## Key features

- **Fully browser-based** — no server, no login, no data leaves your machine
- **Preserves tables and images** from the source document
- **Auto-maps ~25 sections** from the source manual to the correct template locations
- **Warns on missing sections** — generation never fails; unfilled fields are highlighted in the output for manual follow-up
- **Output filename**: `合规说明书-{English product name}.docx`

## How to use

Open the app in your browser and follow the three-step flow:

1. **Upload** — drag and drop (or click to browse) your `.docx` source manual
2. **Review** — check the extraction summary, enter validity months and opened-stability days
3. **Generate & Download** — click Generate, then download the filled compliance document

## Tech stack

- React + Vite (TypeScript)
- JSZip for `.docx` parsing and generation
- Plain CSS — no UI framework
- No backend, no dependencies on external services

## Development

```bash
npm install
npm run dev      # local dev server at http://localhost:5173
npm run build    # production build → dist/
```

## Sample documents

The three HBcT2 AIM reference documents (translated manual, template, annotated reference) are used for development and validation. They are not included in this repository.
