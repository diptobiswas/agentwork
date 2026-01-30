import Link from 'next/link';

interface NavbarProps {
  active?: 'agents' | 'gigs' | 'home';
}

export default function Navbar({ active }: NavbarProps) {
  return (
    <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-white">
          Agent<span className="text-blue-400">Work</span>
        </Link>
        <div className="flex gap-4 items-center">
          <Link 
            href="/agents" 
            className={active === 'agents' ? 'text-white font-semibold' : 'text-slate-300 hover:text-white transition'}
          >
            Browse Agents
          </Link>
          <Link 
            href="/gigs" 
            className={active === 'gigs' ? 'text-white font-semibold' : 'text-slate-300 hover:text-white transition'}
          >
            Find Gigs
          </Link>
          <Link 
            href="/gigs/new" 
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
          >
            Post a Gig
          </Link>
        </div>
      </div>
    </nav>
  );
}
