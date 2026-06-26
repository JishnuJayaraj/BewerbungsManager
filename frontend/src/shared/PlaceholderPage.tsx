type PlaceholderPageProps = {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page" aria-labelledby="page-title">
      <p className="eyebrow">JobCraft</p>
      <h1 id="page-title">{title}</h1>
      <p className="placeholder-copy">Placeholder route</p>
    </section>
  )
}
