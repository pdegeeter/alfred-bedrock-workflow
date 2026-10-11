# Changelog

## [2.0.0](https://github.com/pdegeeter/alfred-bedrock-workflow/compare/v1.0.0...v2.0.0) (2026-10-11)


### ⚠ BREAKING CHANGES

* the workflow is now an arm64 binary and no longer needs Node.js. Intel Macs are not supported.

### Features

* **auth:** allow choosing the browser opening the SSO login ([15b554a](https://github.com/pdegeeter/alfred-bedrock-workflow/commit/15b554a1a5078dca9b361de96150787607f02aa1))
* **auth:** generate bedrock short-term keys from IAM Identity Center ([b393ff0](https://github.com/pdegeeter/alfred-bedrock-workflow/commit/b393ff070a3bb86c60819a54715ddce7245f7d0c))
* **auth:** sign bedrock keys from an aws cli profile ([a630a4a](https://github.com/pdegeeter/alfred-bedrock-workflow/commit/a630a4a34b405e2b6040fb001e3939a7fcd1590a))
* **config:** make token optional with env fallback ([3e15550](https://github.com/pdegeeter/alfred-bedrock-workflow/commit/3e15550281bfb87a61e1d81d3fe05dc5b22b1cec))
* **models:** add claude 5 models with an effort level ([85bd441](https://github.com/pdegeeter/alfred-bedrock-workflow/commit/85bd4414ef213ad26150b64ea4271a9dd465a193))
* **models:** add claude opus 5.5 ([99b8a3d](https://github.com/pdegeeter/alfred-bedrock-workflow/commit/99b8a3d4208a5d6eac22ad6bfe127d1136e9f384))
* rewrite the workflow as a native Rust binary ([d21c0de](https://github.com/pdegeeter/alfred-bedrock-workflow/commit/d21c0dec88fcf37708a222b307405d97a5fed564))


### Bug Fixes

* **translate:** use full language names in prompts ([5655a05](https://github.com/pdegeeter/alfred-bedrock-workflow/commit/5655a0528d7e71ce44eeb8eb03a12870449a1fa9))
