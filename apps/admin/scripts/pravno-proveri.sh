#!/usr/bin/env bash
# Provera da u pravnim tekstovima nije ostalo nepopunjeno polje.
#
# Politika privatnosti bez imena rukovaoca nema pravnu vrednost, a Apple i
# Google odbijaju predaju sa takvim dokumentom. Zato je ovo zasebna komanda
# koja se pokrece pre slanja na prodavnicu, a ne deo build-a: dok se panel
# razvija, praznine su u redu.
set -uo pipefail

cd "$(dirname "$0")/../public/pravno"

nadjeno=$(grep -c "POPUNITI" ./*.html | grep -v ":0$" || true)

if [ -z "$nadjeno" ]; then
  echo "Pravni tekstovi su popunjeni."
  exit 0
fi

echo "Nepopunjena polja u pravnim tekstovima:" >&2
echo >&2
grep -n "POPUNITI" ./*.html | sed 's/^/  /' >&2
echo >&2
echo "Popuni ih pre slanja na App Store i Google Play." >&2
exit 1
