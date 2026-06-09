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
    name: 'innovis',
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
