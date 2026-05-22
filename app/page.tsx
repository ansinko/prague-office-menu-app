import { listOffices } from '@/lib/offices';
import { getUnlockedOfficeIds } from '@/lib/auth';
import { MapScreen } from '@/components/MapScreen';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const offices = listOffices();
  const unlockedIds = await getUnlockedOfficeIds();
  return <MapScreen offices={offices} unlockedIds={unlockedIds} />;
}
