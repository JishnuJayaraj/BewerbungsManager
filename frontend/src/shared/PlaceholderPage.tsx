type PlaceholderPageProps = {
  eyebrow?: string
  title: string
  copy?: string
}

export function PlaceholderPage({ eyebrow = 'JobCraft', title, copy = 'Placeholder route' }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page" aria-labelledby="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id="page-title">{title}</h2>
      <p className="placeholder-copy">{copy}</p>
    </section>
  )
}
