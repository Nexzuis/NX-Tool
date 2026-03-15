import { redirect } from 'next/navigation';

/**
 * Root route — redirects to /dashboard.
 */
export default function RootPage() {
  redirect('/dashboard');
}
