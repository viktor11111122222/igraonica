#!/usr/bin/env bash
# Izdaje sertifikat za dev server, potpisan sopstvenim CA-om.
#
# Zasto uopste: pregledac pamti dozvolu za kameru samo za origin sa
# sertifikatom kojem uredjaj veruje. Samopotpisan sertifikat koji je korisnik
# "propustio" kroz upozorenje se ne racuna - tada se dozvola trazi iznova pri
# svakoj poseti.
#
# Origin je i ime, ne samo adresa. LAN adresa se menja (DHCP, druga mreza,
# hotspot) i sa njom se gubi zapamcena dozvola, pa sertifikat pokriva i
# `<ime-racunara>.local` - to ime ostaje isto i telefon ga nalazi preko
# Bonjour-a. Na telefonu zato treba otvarati bas `.local` adresu.
#
# CA se pravi samo prvi put. Kada vec postoji, izdaje se nov server
# sertifikat pod istim CA - telefon tada ne mora nista ponovo da instalira.
set -euo pipefail

CERT_DIR="${SSL_CERT_DIR:-$HOME/.local/share/igraonica-dev-certs}"
mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

IME="$(scutil --get LocalHostName 2>/dev/null || hostname -s).local"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)"

# Bez privatnog kljuca CA ne moze da potpise nov sertifikat, pa se pravi nov
# CA - i tada telefon mora jos jednom da instalira profil.
if [ ! -f rootCA.crt ] || [ ! -f rootCA.key ]; then
  if [ -f rootCA.crt ]; then
    echo "CA postoji ali mu nedostaje kljuc - pravim nov."
    mv rootCA.crt "rootCA.crt.stari-$(date +%Y%m%d)"
  fi
  echo "Pravim CA (ovo ide na telefon jednom)..."
  openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
    -keyout rootCA.key -out rootCA.crt -subj "/CN=Igraonica Dev CA" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
else
  echo "CA vec postoji - telefon ne mora nista ponovo da instalira."
fi

openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr \
  -subj "/CN=$IME" 2>/dev/null
printf "subjectAltName=DNS:%s,DNS:localhost,IP:%s,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n" \
  "$IME" "$IP" > ext.cnf
openssl x509 -req -in server.csr -CA rootCA.crt -CAkey rootCA.key -CAcreateserial \
  -out server.crt -days 397 -sha256 -extfile ext.cnf 2>/dev/null
rm -f server.csr

echo
echo "Sertifikat izdat za:"
openssl x509 -in server.crt -noout -text | sed -n '/Subject Alternative Name/{n;s/^ */  /;p;}'
echo
echo "Na telefonu otvaraj:  https://$IME:5173"
echo "CA za instalaciju:    $CERT_DIR/rootCA.crt"
