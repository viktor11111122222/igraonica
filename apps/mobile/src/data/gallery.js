// Fotografije iz igraonice, spakovane uz aplikaciju.
// `thumb` (640px) ide u grid i u pozadine kartica, `full` (1600px) u pregled
// preko celog ekrana. Kada galerija dobije backend, ovo postaje fallback
// dok se ne ucitaju slike sa servera.

export const photos = [
  {
    id: 'kocke',
    thumb: require('../../assets/gallery/thumbs/kocke.jpg'),
    full: require('../../assets/gallery/full/kocke.jpg'),
    title: 'Igra sa kockama',
    caption: 'Zajednicko gradjenje u velikoj sali',
  },
  {
    id: 'obrok',
    thumb: require('../../assets/gallery/thumbs/obrok.jpg'),
    full: require('../../assets/gallery/full/obrok.jpg'),
    title: 'Vreme za uzinu',
    caption: 'Obrok uz pomoc tetke',
  },
  {
    id: 'citanje',
    thumb: require('../../assets/gallery/thumbs/citanje.jpg'),
    full: require('../../assets/gallery/full/citanje.jpg'),
    title: 'Citanje price',
    caption: 'Mirni kutak za slikovnice',
  },
  {
    id: 'gusar',
    thumb: require('../../assets/gallery/thumbs/gusar.jpg'),
    full: require('../../assets/gallery/full/gusar.jpg'),
    title: 'Mali gusar',
    caption: 'Farbanje lica pred potragu',
  },
  {
    id: 'blago',
    thumb: require('../../assets/gallery/thumbs/blago.jpg'),
    full: require('../../assets/gallery/full/blago.jpg'),
    title: 'Mapa blaga',
    caption: 'Trazenje skrivenog kovcega',
  },
  {
    id: 'zurka',
    thumb: require('../../assets/gallery/thumbs/zurka.jpg'),
    full: require('../../assets/gallery/full/zurka.jpg'),
    title: 'Gusarska zurka',
    caption: 'Tematski rodjendan u igraonici',
  },
];

// Pristup po imenu, za kartice koje traze bas odredjenu sliku.
export const photoById = Object.fromEntries(photos.map((p) => [p.id, p]));
