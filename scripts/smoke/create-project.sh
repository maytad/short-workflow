#!/usr/bin/env bash
set -euo pipefail

curl -sS http://127.0.0.1:3001/projects \
  -H 'content-type: application/json' \
  -d '{"title":"Test Short","topic":"Why tiny habits compound","targetDurationSeconds":45}'
