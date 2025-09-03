'use client';
import { useState } from 'react';

const IMAGES = [
  { src: '/demo/Dashboard.png', title: 'Projects dashboard' },
  { src: '/demo/Consumables.png', title: 'Assets inventory' },
  { src: '/demo/Holes.png', title: 'Project details / holes' },
  { src: '/demo/Projects.png', title: 'Profile & settings' }
];

export default function PreviewGallery() {
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {IMAGES.map((img) => (
          <figure key={img.src} className="bg-white rounded-lg border p-2 shadow-sm hover:shadow-md cursor-pointer" onClick={() => setSelected(img)}>
            <img src={img.src} alt={img.title} className="rounded-md w-full h-48 object-cover" />
            <figcaption className="mt-2 text-sm text-slate-600">{img.title}</figcaption>
          </figure>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg overflow-hidden max-w-4xl w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 flex justify-between items-start">
              <h4 className="font-medium">{selected.title}</h4>
              <button className="text-slate-500 hover:text-slate-700" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="bg-slate-50 p-4">
              <img src={selected.src} alt={selected.title} className="w-full h-[60vh] object-contain" />
            </div>
            <div className="p-4 text-right">
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-md" onClick={() => window.location.href = '/auth'}>Sign in to try</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
