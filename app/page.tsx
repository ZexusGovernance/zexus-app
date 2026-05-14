export default function DemoPage() {
  return (
    <iframe
      src="/index.html"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
      }}
      title="Zexus App Demo"
    />
  )
}
