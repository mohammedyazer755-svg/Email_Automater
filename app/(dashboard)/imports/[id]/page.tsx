import { ImportDetail } from '@/components/platform/imports';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ImportDetail id={id} />;
}
