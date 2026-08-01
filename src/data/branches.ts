export interface Branch {
  value: "san_martin" | "los_olivos" | "san_miguel";
  label: string;
  image: string;
  address: string;
  phone: string;
  hours: string;
  opensAt: number;
  closesAt: number;
  coords: { lat: number; lng: number };
}

export const MAX_PICKUP_DISTANCE_KM = 8;

export const BRANCHES: Branch[] = [
  {
    value: "san_martin",
    label: "Sede San Martín de Porres",
    image: "/images/sedes/sanMartin.webp",
    address: "Av. Proceres 115",
    phone: "+51 986 985 047",
    hours: "Lun - Dom: 8:00 am - 9:00 pm",
    opensAt: 8,
    closesAt: 21,
    coords: { lat: -12.0206241, lng: -77.0865714 },
  },
  {
    value: "los_olivos",
    label: "Sede Los Olivos",
    image: "/images/sedes/olivos.webp",
    address: "Av. Beta Mz Ñ lote 1",
    phone: "+51 932 719 342",
    hours: "Lun - Dom: 8:00 am - 9:00 pm",
    opensAt: 8,
    closesAt: 21,
    coords: { lat: -12.0085609, lng: -77.0710131 },
  },
  {
    value: "san_miguel",
    label: "Sede San Miguel",
    image: "/images/sedes/sanMiguel.webp",
    address: "Av. Brigida Silva 272",
    phone: "+51 954 599 221",
    hours: "Lun - Dom: 8:00 am - 9:00 pm",
    opensAt: 8,
    closesAt: 21,
    coords: { lat: -12.0774344, lng: -77.0934137 },
  },
];

export function isBranchOpen(branch: Branch, now = new Date()): boolean {
  const h = now.getHours();
  return h >= branch.opensAt && h < branch.closesAt;
}

export const BRANCH_BY_VALUE: Record<string, Branch> = Object.fromEntries(
  BRANCHES.map((b) => [b.value, b]),
);

export const BRANCH_COORDS: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  BRANCHES.map((b) => [b.value, b.coords]),
);
