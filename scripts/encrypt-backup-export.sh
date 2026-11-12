#!/bin/sh
# Prépare une copie chiffrée pour un dépôt hors hôte. Aucun transfert réseau.
set -eu
umask 077

if [ "$#" -ne 4 ]; then
  echo 'Usage: encrypt-backup-export.sh ARCHIVE.dump DESTINATION.cms CERTIFICAT.pem EMPREINTE_SHA256' >&2
  exit 2
fi

archive=$1
destination=$2
certificate=$3
fingerprint=$4

case "$archive" in /*.dump) ;; *) echo 'Chemin absolu .dump requis' >&2; exit 2 ;; esac
case "$destination" in /*.cms) ;; *) echo 'Chemin absolu .cms requis' >&2; exit 2 ;; esac
case "$fingerprint" in ''|*[!0-9A-F]*) echo 'Empreinte SHA-256 en hexadécimal majuscule requise' >&2; exit 2 ;; esac
[ "${#fingerprint}" -eq 64 ] || { echo 'Empreinte SHA-256 complète requise' >&2; exit 2; }

if [ ! -f "$archive" ] || [ -L "$archive" ] || [ "$(head -c 5 "$archive")" != PGDMP ]; then
  echo 'Archive PostgreSQL au format custom requise' >&2
  exit 2
fi

# Figer le certificat public avant de vérifier l'empreinte et de l'utiliser.
workdir=$(mktemp -d "$(dirname "$destination")/.gobilan-backup.XXXXXX")
trap 'rm -rf "$workdir"' EXIT
trap 'exit 1' HUP INT TERM
openssl x509 -in "$certificate" -out "$workdir/recipient.pem"
actual=$(openssl x509 -in "$workdir/recipient.pem" -noout -sha256 -fingerprint)
actual=$(printf '%s' "${actual#*=}" | tr -d ':')
if [ "$actual" != "$fingerprint" ]; then
  echo 'Le certificat ne correspond pas à l’empreinte approuvée' >&2
  exit 2
fi
openssl x509 -in "$workdir/recipient.pem" -noout -checkend 0 >/dev/null
openssl cms -encrypt -binary -aes-256-gcm -stream -outform DER -in "$archive" -out "$workdir/archive.cms" \
  -recip "$workdir/recipient.pem" -keyopt rsa_padding_mode:oaep -keyopt rsa_oaep_md:sha256
# Publication atomique dans le même répertoire, sans écraser une sauvegarde existante.
ln -T -- "$workdir/archive.cms" "$destination"
echo 'Copie chiffrée prête pour le transfert approuvé.'
