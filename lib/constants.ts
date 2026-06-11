import { Team, Driver, Crew, Truck, Venue } from "./types";

export const TPAL = [
  { bg: 'rgba(96,165,250,.22)', fg: '#60a5fa', dot: '#60a5fa' },
  { bg: 'rgba(62,207,142,.22)', fg: '#3ecf8e', dot: '#3ecf8e' },
  { bg: 'rgba(245,166,35,.22)', fg: '#f5a623', dot: '#f5a623' },
  { bg: 'rgba(240,82,82,.22)', fg: '#f05252', dot: '#f05252' },
  { bg: 'rgba(167,139,250,.22)', fg: '#a78bfa', dot: '#a78bfa' },
  { bg: 'rgba(45,212,191,.22)', fg: '#2dd4bf', dot: '#2dd4bf' },
  { bg: 'rgba(251,146,60,.22)', fg: '#fb923c', dot: '#fb923c' },
  { bg: 'rgba(163,230,53,.22)', fg: '#a3e635', dot: '#a3e635' },
  { bg: 'rgba(244,114,182,.22)', fg: '#f472b6', dot: '#f472b6' },
];

export const HUB = {
  name: 'Mint Event Rentals DIC Warehouse',
  short: 'DIC Warehouse',
  address: 'Dubai Industrial City',
  zone: 'dic'
};

export const SIZE = {
  XS: { frac: 0.10, tons: 0.5, lbl: '10%' },
  S:  { frac: 0.25, tons: 1.25, lbl: '25%' },
  M:  { frac: 0.50, tons: 2.5,  lbl: '50%' },
  L:  { frac: 0.75, tons: 3.75, lbl: '75%' },
  XL: { frac: 1.00, tons: 5.0,  lbl: '100%' },
};

export type SizeKey = keyof typeof SIZE;

export const SIZE_ORDER: SizeKey[] = ['XS', 'S', 'M', 'L', 'XL'];

export const LOADMIN: Record<SizeKey, number> = {
  XS: 10,
  S: 15,
  M: 25,
  L: 30,
  XL: 45
};

export const DEFAULT_VENUES: Omit<Venue, "id">[] = [
  { name: 'Villa - Small Order', setup: 30 },
  { name: 'Villa - Big Order', setup: 90 },
  { name: 'Hotel Ballroom - Small Order', setup: 90 },
  { name: 'Hotel Ballroom - Big Order', setup: 240 },
  { name: 'Exhibition Centre', setup: 120 },
  { name: 'Mall', setup: 90 },
  { name: 'Restaurant', setup: 60 },
  { name: 'Warehouse', setup: 30 },
  { name: 'High Rise Building', setup: 120 },
];

export const MINT_ROSTER: [string, string, string, number, string, string, string][] = [
  ['Alpha', 'G-13096', 'Canter', 3, 'Akhil Aruleedharan Nair Bhaskara', 'Dalpat Singh', 'Muhammad Sohail'],
  ['Bravo', 'Z-60042', 'Hino', 5, 'Narpat Singh Sujan SIngh', 'Muhammad Ahmad Nawaz', 'Callistus Anayo Njoku'],
  ['Charlie', 'C-81546', 'Canter', 3, 'Syed Hussain', 'Md Shala Uddin', 'Jorgille Nuez Lorempo'],
  ['Delta', 'R-99145', 'Hino', 5, 'Liaqat Hussain', 'Mark Joseph Alising Dumaquita', 'Muhammad Usman'],
  ['Echo', 'R-99153', 'Hino', 5, 'Shakeel Haider', 'Wasiu Adedamola Ogunleye', 'Sohel Rana'],
  ['Foxtrot', 'Y-89657', 'Hino', 5, 'Aqib Javed', 'Binod Damai', 'Muhammad Jubaid'],
  ['Golf', 'R-24437', 'Hino', 5, 'Muhammad Zulfiqar', 'Arjun Manikuttan', 'Aswin Manikuttan'],
  ['Hotel', 'EE-33286', 'Van', 1, 'Pranuka Rashin Kondasinghe Arachchige', 'Christian Arthur', 'Ebenezer Kwenor Teye'],
  ['India', 'Y-85780', 'Isuzu', 1, 'Ketheshwar Singh', 'Mukalesh', 'Mark'],
  ['Juliet', 'EE-33287', 'Van', 1, 'Shravan Singh', 'Manohar', 'Babu']
];

export const ZPAT: [string, string][] = [
  ['dubai industrial city', 'dic'], ['dubai industrial', 'dic'],
  ['abu dhabi', 'abu_dhabi'], ['sharjah', 'sharjah'], ['ajman', 'ajman'],
  ['silicon oasis', 'silicon_oasis'], ['academic city', 'silicon_oasis'],
  ['al jaddaf', 'al_jaddaf'], ['festival city', 'al_jaddaf'],
  ['al quoz', 'al_quoz'], ['al barsha', 'al_barsha'],
  ['palm jumeirah', 'palm'], ['jumeirah beach residence', 'jbr'],
  ['jbr', 'jbr'], ['jumeirah lake', 'jlt'], ['jlt', 'jlt'],
  ['dubai marina', 'marina'], ['marina', 'marina'], ['palm', 'palm'],
  ['meadows', 'meadows'], ['mirdif', 'mirdif'],
  ['downtown dubai', 'downtown'], ['burj khalifa', 'downtown'], ['downtown', 'downtown'],
  ['business bay', 'business_bay'], ['gate village', 'difc'], ['difc', 'difc'],
  ['jumeirah', 'jumeirah'], ['deira', 'deira'], ['gold souk', 'deira'],
  ['bur dubai', 'bur_dubai'], ['karama', 'bur_dubai'],
  ['jebel ali', 'dic'], ['dic', 'dic'],
];

export const TM: Record<string, Record<string, number>> = {
  downtown: { downtown: 7, business_bay: 8, difc: 9, jumeirah: 18, al_quoz: 20, al_barsha: 24, jbr: 30, jlt: 31, marina: 30, palm: 34, meadows: 37, bur_dubai: 13, deira: 21, al_jaddaf: 13, mirdif: 29, silicon_oasis: 31, abu_dhabi: 80, sharjah: 41, ajman: 54 },
  business_bay: { downtown: 8, business_bay: 6, difc: 9, jumeirah: 17, al_quoz: 18, al_barsha: 23, jbr: 29, jlt: 30, marina: 29, palm: 33, meadows: 35, bur_dubai: 13, deira: 21, al_jaddaf: 12, mirdif: 29, silicon_oasis: 31, abu_dhabi: 80, sharjah: 41, ajman: 54 },
  difc: { downtown: 9, business_bay: 9, difc: 6, jumeirah: 17, al_quoz: 17, al_barsha: 21, jbr: 27, jlt: 27, marina: 27, palm: 31, meadows: 33, bur_dubai: 15, deira: 23, al_jaddaf: 14, mirdif: 31, silicon_oasis: 31, abu_dhabi: 80, sharjah: 43, ajman: 56 },
  jumeirah: { downtown: 18, business_bay: 17, difc: 17, jumeirah: 7, al_quoz: 14, al_barsha: 13, jbr: 19, jlt: 19, marina: 19, palm: 21, meadows: 24, bur_dubai: 21, deira: 29, al_jaddaf: 21, mirdif: 37, silicon_oasis: 37, abu_dhabi: 73, sharjah: 49, ajman: 61 },
  al_quoz: { downtown: 20, business_bay: 18, difc: 17, jumeirah: 14, al_quoz: 6, al_barsha: 11, jbr: 23, jlt: 21, marina: 21, palm: 27, meadows: 25, bur_dubai: 19, deira: 27, al_jaddaf: 21, mirdif: 35, silicon_oasis: 35, abu_dhabi: 69, sharjah: 47, ajman: 59 },
  al_barsha: { downtown: 24, business_bay: 23, difc: 21, jumeirah: 13, al_quoz: 11, al_barsha: 6, jbr: 19, jlt: 15, marina: 17, palm: 21, meadows: 19, bur_dubai: 25, deira: 33, al_jaddaf: 27, mirdif: 41, silicon_oasis: 39, abu_dhabi: 67, sharjah: 51, ajman: 63 },
  jbr: { downtown: 30, business_bay: 29, difc: 27, jumeirah: 19, al_quoz: 23, al_barsha: 19, jbr: 6, jlt: 11, marina: 7, palm: 14, meadows: 17, bur_dubai: 29, deira: 39, al_jaddaf: 33, mirdif: 49, silicon_oasis: 49, abu_dhabi: 69, sharjah: 59, ajman: 71 },
  jlt: { downtown: 31, business_bay: 30, difc: 27, jumeirah: 19, al_quoz: 21, al_barsha: 15, jbr: 11, jlt: 6, marina: 9, palm: 17, meadows: 15, bur_dubai: 31, deira: 41, al_jaddaf: 35, mirdif: 51, silicon_oasis: 49, abu_dhabi: 69, sharjah: 61, ajman: 73 },
  marina: { downtown: 30, business_bay: 29, difc: 27, jumeirah: 19, al_quoz: 21, al_barsha: 17, jbr: 7, jlt: 9, marina: 6, palm: 11, meadows: 15, bur_dubai: 29, deira: 39, al_jaddaf: 33, mirdif: 49, silicon_oasis: 49, abu_dhabi: 69, sharjah: 59, ajman: 71 },
  palm: { downtown: 34, business_bay: 33, difc: 31, jumeirah: 21, al_quoz: 27, al_barsha: 21, jbr: 14, jlt: 17, marina: 11, palm: 6, meadows: 21, bur_dubai: 33, deira: 43, al_jaddaf: 37, mirdif: 53, silicon_oasis: 53, abu_dhabi: 67, sharjah: 63, ajman: 75 },
  meadows: { downtown: 37, business_bay: 35, difc: 33, jumeirah: 24, al_quoz: 25, al_barsha: 19, jbr: 17, jlt: 15, marina: 15, palm: 21, meadows: 6, bur_dubai: 35, deira: 45, al_jaddaf: 39, mirdif: 53, silicon_oasis: 51, abu_dhabi: 64, sharjah: 63, ajman: 75 },
  bur_dubai: { downtown: 13, business_bay: 13, difc: 15, jumeirah: 21, al_quoz: 19, al_barsha: 25, jbr: 29, jlt: 31, marina: 29, palm: 33, meadows: 35, bur_dubai: 6, deira: 13, al_jaddaf: 11, mirdif: 25, silicon_oasis: 31, abu_dhabi: 87, sharjah: 35, ajman: 47 },
  deira: { downtown: 21, business_bay: 21, difc: 23, jumeirah: 29, al_quoz: 27, al_barsha: 33, jbr: 39, jlt: 41, marina: 39, palm: 43, meadows: 45, bur_dubai: 13, deira: 6, al_jaddaf: 17, mirdif: 21, silicon_oasis: 31, abu_dhabi: 95, sharjah: 27, ajman: 37 },
  al_jaddaf: { downtown: 13, business_bay: 12, difc: 14, jumeirah: 21, al_quoz: 21, al_barsha: 27, jbr: 33, jlt: 35, marina: 33, palm: 37, meadows: 39, bur_dubai: 11, deira: 17, al_jaddaf: 6, mirdif: 23, silicon_oasis: 27, abu_dhabi: 87, sharjah: 37, ajman: 49 },
  mirdif: { downtown: 29, business_bay: 29, difc: 31, jumeirah: 37, al_quoz: 35, al_barsha: 41, jbr: 49, jlt: 51, marina: 49, palm: 53, meadows: 53, bur_dubai: 25, deira: 21, al_jaddaf: 23, mirdif: 6, silicon_oasis: 19, abu_dhabi: 103, sharjah: 21, ajman: 31 },
  silicon_oasis: { downtown: 31, business_bay: 31, difc: 31, jumeirah: 37, al_quoz: 35, al_barsha: 39, jbr: 49, jlt: 49, marina: 49, palm: 53, meadows: 51, bur_dubai: 31, deira: 31, al_jaddaf: 27, mirdif: 19, silicon_oasis: 6, abu_dhabi: 95, sharjah: 25, ajman: 35 },
  abu_dhabi: { downtown: 80, business_bay: 80, difc: 80, jumeirah: 73, al_quoz: 69, al_barsha: 67, jbr: 69, jlt: 69, marina: 69, palm: 67, meadows: 64, bur_dubai: 87, deira: 95, al_jaddaf: 87, mirdif: 103, silicon_oasis: 95, abu_dhabi: 11, sharjah: 119, ajman: 129 },
  sharjah: { downtown: 41, business_bay: 41, difc: 43, jumeirah: 49, al_quoz: 47, al_barsha: 51, jbr: 59, jlt: 61, marina: 59, palm: 63, meadows: 63, bur_dubai: 35, deira: 27, al_jaddaf: 37, mirdif: 21, silicon_oasis: 25, abu_dhabi: 119, sharjah: 9, ajman: 17 },
  ajman: { downtown: 54, business_bay: 54, difc: 56, jumeirah: 61, al_quoz: 59, al_barsha: 63, jbr: 71, jlt: 73, marina: 71, palm: 75, meadows: 75, bur_dubai: 47, deira: 37, al_jaddaf: 49, mirdif: 31, silicon_oasis: 35, abu_dhabi: 129, sharjah: 17, ajman: 9 },
  dic: { downtown: 45, business_bay: 43, difc: 46, jumeirah: 33, al_quoz: 28, al_barsha: 26, jbr: 32, jlt: 30, marina: 31, palm: 36, meadows: 24, bur_dubai: 40, deira: 52, al_jaddaf: 44, mirdif: 48, silicon_oasis: 42, abu_dhabi: 55, sharjah: 68, ajman: 78, dic: 6 },
};
