import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/campaigns');
  return null; // redirect does not return a value
}
