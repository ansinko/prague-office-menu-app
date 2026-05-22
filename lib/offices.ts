// Static config — single source of truth for offices. Adding another office is
// just a new entry here (name, coords, password hash, restaurant pins).
//
// passwordHash = HMAC-SHA256(plaintext, AUTH_SECRET) hex. Generate with:
//   node -e "console.log(require('crypto').createHmac('sha256', process.env.AUTH_SECRET).update('PASSWORD').digest('hex'))"
// Restaurant `name` MUST match the name returned by the menu data (slug match).

export interface OfficeRestaurant {
  name: string;
  coords: [number, number];
}

export interface Office {
  id: string;
  name: string;
  address: string;
  coords: [number, number];
  passwordHash: string;
  restaurants: OfficeRestaurant[];
}

/** Public shape sent to the client — never includes the password hash. */
export type PublicOffice = Omit<Office, 'passwordHash'>;

const OFFICES: Office[] = [
  {
    id: 'mocha',
    name: 'Mo-cha',
    address: 'Praha',
    coords: [50.05948178104082, 14.429651742327714],
    passwordHash:
      '917c2ac946c01b4477ba08b4fc8ea99fa9ed748fc07afef6cda31e727c1aa9b6',
    restaurants: [
      { name: 'Krušovická Chalupa', coords: [50.060470859502686, 14.432690840274141] },
      { name: 'Restaurant Kandelábr', coords: [50.05990557578166, 14.429985525902246] },
      { name: 'U Smrtáka', coords: [50.060572239939226, 14.427500574268853] },
      { name: 'U Sotonů', coords: [50.059224886342655, 14.430785949807154] },
    ],
  },
  {
    id: 'viagem',
    name: 'Viagem',
    address: 'Praha — Karlín',
    coords: [50.093932220982595, 14.450909683640813],
    passwordHash:
      '79d94e3f37234c17ec3db2f9651cf9814bc36bc35cc4688a6c78d8c6b0b0fa62',
    restaurants: [
      { name: 'Jídlovice Karlín', coords: [50.094722055574096, 14.448890245117077] },
      { name: 'Dvorek', coords: [50.09184081762309, 14.450830583575792] },
      { name: 'Cafe Frida', coords: [50.0921941015992, 14.446565997068415] },
    ],
  },
];

function toPublic(o: Office): PublicOffice {
  const { passwordHash: _passwordHash, ...rest } = o;
  return rest;
}

export function listOffices(): PublicOffice[] {
  return OFFICES.map(toPublic);
}

export function getOffice(id: string): Office | undefined {
  return OFFICES.find((o) => o.id === id);
}

export function getPublicOffice(id: string): PublicOffice | undefined {
  const o = getOffice(id);
  return o ? toPublic(o) : undefined;
}
