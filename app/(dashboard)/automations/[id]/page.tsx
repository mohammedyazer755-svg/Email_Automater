import { AutomationDetail } from '@/components/platform/automations';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AutomationDetail id={id} />;
}
