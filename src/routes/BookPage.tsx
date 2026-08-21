import { Navigate, useParams } from 'react-router-dom'
import { BookDetail } from '../components/Detail/BookDetail'
import { bookBySlug } from '../data/books'

type Props = { onReturn: () => void }

export function BookPage({ onReturn }: Props) {
  const { slug } = useParams<{ slug: string }>()
  const book = bookBySlug(slug)

  // Unknown slug is not an error state in this IA — it is simply the shelf.
  if (!book) return <Navigate to="/" replace />

  return <BookDetail book={book} onReturn={onReturn} />
}
