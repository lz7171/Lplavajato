import type { Metadata } from 'next';
import { AdminApp } from './AdminApp';
import './admin.css';

export const metadata: Metadata = { title: 'Painel', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return <AdminApp />;
}
