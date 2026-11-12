#!/usr/bin/env bash
# Prompt locally with echo disabled, or inherit credentials from a trusted runner.
set +x
set -euo pipefail

unset DEBUG PWDEBUG NODE_DEBUG NODE_OPTIONS
export E2E_RECETTE_URL=https://deploy-preview-12--gobilan-pwa.netlify.app

if [[ -z ${E2E_RECETTE_PHONES:-} || -z ${E2E_RECETTE_OTP:-} || -z ${E2E_RECETTE_PIN:-} ]]; then
  if [[ ! -t 0 ]]; then
    printf '%s\n' 'Injecter les trois comptes de recette, l’OTP et le PIN dans le lanceur de confiance.' >&2
    exit 2
  fi
  if [[ -z ${E2E_RECETTE_PHONES:-} ]]; then
    read -r -s -p 'Trois numéros fictifs autorisés, séparés par des virgules : ' E2E_RECETTE_PHONES
    printf '\n' >&2
  fi
  if [[ -z ${E2E_RECETTE_OTP:-} ]]; then
    read -r -s -p 'OTP de recette : ' E2E_RECETTE_OTP
    printf '\n' >&2
  fi
  if [[ -z ${E2E_RECETTE_PIN:-} ]]; then
    read -r -s -p 'PIN temporaire de test : ' E2E_RECETTE_PIN
    printf '\n' >&2
  fi
fi
export E2E_RECETTE_PHONES E2E_RECETTE_OTP E2E_RECETTE_PIN
exec node "$(dirname -- "${BASH_SOURCE[0]}")/pwa-smoke.mjs"
