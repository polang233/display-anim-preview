# Publishing channels

Java Display Animator uses two separate publishing channels. Keep their files separate.

## Official Blockbench plugin repository

The official pull request receives only the Universal compiled plugin and the files required by the
Blockbench plugin repository:

```text
plugins/display_anim_preview/
├── about.md
├── changelog.json
├── display_anim_preview.js
├── icon.png
└── members.yml
```

The official metadata and About page use English. The compiled Universal plugin contains English and
Simplified Chinese translations and follows the Blockbench interface language. Do not submit the
fixed Simplified Chinese build, source files, GitHub release ZIPs, or copyright documents in this PR.

## Personal GitHub repository

The personal repository contains the public source, reproducible build, automated tests, complete
English and Simplified Chinese tutorials, copyright notice, and both compiled artifacts under
`dist/`. It intentionally has no open-source `LICENSE`; `package.json` uses `UNLICENSED`.

The repository also prepares two user-facing GitHub Release ZIPs:

- Universal: follows the Blockbench interface language.
- Simplified Chinese: always uses Simplified Chinese.

Release upload details are documented in [RELEASES.md](RELEASES.md). Local release-upload staging
directories are ignored by Git and must not be committed to the source repository.

## Required verification

Before updating either publishing channel, run:

```bash
npm ci
npm test
npm run typecheck
npm run build:release
npm audit
```

After building, copy only `dist/display_anim_preview.js` to the official PR folder. The Simplified
Chinese artifact remains exclusive to the personal repository and GitHub Releases.
