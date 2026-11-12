#!/bin/sh
# Test local : certificat et archive synthétiques.
set -eu
umask 077
workspace=$(mktemp -d)
trap 'rm -rf "$workspace"' EXIT
trap 'exit 1' HUP INT TERM

key=$workspace/key.pem
cert=$workspace/cert.pem
openssl req -x509 -newkey rsa:2048 -noenc -days 1 -subj '/CN=GoBilan test only' \
  -keyout "$key" -out "$cert" >/dev/null 2>&1
fingerprint=$(openssl x509 -in "$cert" -noout -sha256 -fingerprint)
fingerprint=$(printf '%s' "${fingerprint#*=}" | tr -d ':')

archive=$workspace/sample.dump
destination=$workspace/sample.cms
printf 'PGDMP\nContenu de test synthétique\n' > "$archive"
sh scripts/encrypt-backup-export.sh "$archive" "$destination" "$cert" "$fingerprint"
openssl cms -decrypt -inform DER -in "$destination" -recip "$cert" -inkey "$key" -out "$workspace/decrypted"
cmp "$archive" "$workspace/decrypted"
# Le flux DER se termine par la balise GCM suivie de quatre octets de fermeture ASN.1.
python3 - "$destination" "$workspace/tampered.cms" <<'PYTEST'
import sys
from pathlib import Path
payload = bytearray(Path(sys.argv[1]).read_bytes())
payload[-8] ^= 1
Path(sys.argv[2]).write_bytes(payload)
PYTEST
if openssl cms -decrypt -inform DER -in "$workspace/tampered.cms" -recip "$cert" -inkey "$key" -out "$workspace/rejected" 2>/dev/null; then
  echo 'Une enveloppe modifiée a été acceptée' >&2; exit 1
fi

if sh scripts/encrypt-backup-export.sh "$archive" "$destination" "$cert" "$fingerprint" >/dev/null 2>&1; then
  echo 'Une destination existante a été écrasée' >&2; exit 1
fi
missing=0000000000000000000000000000000000000000000000000000000000000000
if sh scripts/encrypt-backup-export.sh "$archive" "$workspace/missing.cms" "$cert" "$missing" >/dev/null 2>&1; then
  echo 'Un certificat non approuvé a été accepté' >&2; exit 1
fi
test ! -e "$workspace/missing.cms"
test -z "$(find "$workspace" -name '.gobilan-backup.*' -print)"
echo 'PASS chiffrement, restauration des octets, intégrité, certificat imposé et aucun écrasement'
