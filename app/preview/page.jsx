import Link from 'next/link';
import PreviewGallery from '../components/PreviewGallery';

export const metadata = {
  title: 'App Preview',
  description: 'See a quick visual preview of the app and sign in to try the full experience.'
};

export default function PreviewPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-gradient-to-r from-indigo-600 to-indigo-400 text-white py-12">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">CoreFarm — App preview</h1>
            <p className="mt-2 text-indigo-100 max-w-xl">A quick visual tour — click Sign in to try the full app.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/auth" className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm font-medium">
              Sign in
            </Link>
            <Link href="/auth?mode=signup" className="inline-flex items-center px-4 py-2 bg-white text-indigo-700 rounded-md text-sm font-medium">
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-start gap-8">
          <div className="md:w-2/3">
            <h2 className="text-2xl font-semibold mb-3">What you'll see</h2>
            <p className="text-slate-600 mb-6">This preview shows static screenshots of typical workflows — Projects, Assets, Profile and Maps. To interact you'll need to sign up or sign in.</p>
            <PreviewGallery />
          </div>

          <aside className="md:w-1/3 bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-2">Key features</h3>
            <ul className="text-slate-600 space-y-2">
              <li>Organization-based access and permissions</li>
              <li>Projects, holes, and task tracking</li>
              <li>Asset inventory and history</li>
              <li>Consumables, purchase orders, and reports</li>
            </ul>

            <div className="mt-6">
              <Link href="/auth" className="block text-center w-full px-4 py-2 bg-indigo-600 text-white rounded-md font-medium">Try it now — Sign up</Link>
            </div>
          </aside>
        </div>
      </section>

      <footer className="border-t py-6">
        <div className="max-w-5xl mx-auto px-6 text-sm text-slate-500">Screenshots are representative. For a live experience, create an account and sign in.</div>
      </footer>
    </main>
  );
}
