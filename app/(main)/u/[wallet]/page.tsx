import PublicProfilePage from '@/components/profile/PublicProfilePage'

export default async function Page({
  params,
}: {
  params: Promise<{ wallet: string }>
}) {
  const { wallet } = await params
  return <PublicProfilePage wallet={wallet} />
}
