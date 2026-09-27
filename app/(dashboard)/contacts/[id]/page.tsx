import { ContactDetail } from '@/components/platform/contacts';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactDetail id={id} />;
}
