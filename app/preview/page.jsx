import Link from 'next/link';
import PreviewGallery from '../components/PreviewGallery';

export const metadata = {
  title: 'App Preview',
  description: 'See a quick visual preview of the app and sign in to try the full experience.'
};

export default function PreviewPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-start gap-8">
          <div className="md:w-2/3">
            <h2 className="text-2xl font-semibold mb-3">Organise your Geology project</h2>
            <p className="text-slate-600 mb-6">Track your Projects, Drill holes, Assets and consumables in a centralised app</p>

            {/* Mobile-only CTA */}
            <div className="block md:hidden mb-6">
              <Link
                href="/auth"
                className="w-full inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-md font-medium"
              >
                Try it now — Sign up
              </Link>
            </div>

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

            <div className="mt-6 hidden md:block">
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
