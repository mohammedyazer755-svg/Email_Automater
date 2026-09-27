import { Composer } from '@/components/platform/composer';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Composer id={id} />;
}
