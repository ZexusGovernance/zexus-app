import Shell from '@/components/shell/Shell'
import InviteGate from '@/components/InviteGate'

export default function Page() {
  return (
    <InviteGate>
      <Shell />
    </InviteGate>
  )
}
