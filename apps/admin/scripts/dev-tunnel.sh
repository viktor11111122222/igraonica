#!/usr/bin/env bash
# Panel na telefonu bez ijednog koraka na telefonu.
#
# Sopstveni sertifikat trazi da se CA instalira i rucno oznaci kao pouzdan, a
# dok to nije uradjeno pregledac odbija da zapamti dozvolu za kameru - pa se
# pitanje vraca pri svakoj poseti. Tunel daje adresu sa sertifikatom kojem
# svaki telefon vec veruje, pa nema ni upozorenja ni podesavanja: dozvola se
# potvrdi jednom i pamti se.
#
# Adresa je nasumicna pri svakom pokretanju, a dozvola se pamti po adresi.
# Za adresu koja se ne menja ide imenovan tunel (Cloudflare nalog + domen) ili
# obicna produkcijska adresa panela.
set -euo pipefail

if ! command -v cloudflared >/dev/null; then
  echo "Nema cloudflared. Instalacija: brew install cloudflared" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
npx vite &
VITE=$!
trap 'kill $VITE 2>/dev/null || true' EXIT

# Dev server mora da odgovara pre nego sto tunel krene, inace prvi zahtev padne.
until curl -sf -o /dev/null http://localhost:5173; do sleep 0.3; done

echo
echo "Adresa za telefon se ispisuje ispod (trycloudflare.com):"
cloudflared tunnel --url http://localhost:5173
