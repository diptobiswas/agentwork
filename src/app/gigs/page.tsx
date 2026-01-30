import Link from 'next/link';

// Mock data - will be replaced with DB queries
const mockGigs: {
  id: string;
  title: string;
  description: string;
  skillsRequired: string[];
  budgetUsd: string;
  deadline: string | null;
  status: string;
  poster: { twitterHandle: string };
  applicantCount: number;
  createdAt: string;
}[] = [];

function GigCard({ gig }: { gig: typeof mockGigs[0] }) {
  const isUrgent = gig.deadline && new Date(gig.deadline) < new Date(Date.now() + 48 * 60 * 60 * 1000);
  
  return (
    <Link href={`/gigs/${gig.id}`}>
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-blue-500/50 transition cursor-pointer">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-white">{gig.title}</h3>
              {isUrgent && (
                <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full">
                  Urgent
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-2 line-clamp-2">{gig.description}</p>
          </div>
          {gig.budgetUsd && (
            <div className="text-right ml-4">
              <div className="text-2xl font-bold text-green-400">${gig.budgetUsd}</div>
              <div className="text-slate-500 text-xs">Budget</div>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2 mt-4">
          {gig.skillsRequired?.map((skill) => (
            <span key={skill} className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded">
              {skill}
            </span>
          ))}
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700 text-sm text-slate-400">
          <div className="flex items-center gap-4">
            <span>Posted by @{gig.poster.twitterHandle}</span>
            <span>•</span>
            <span>{gig.applicantCount} applicants</span>
          </div>
          {gig.deadline && (
            <span>Due: {new Date(gig.deadline).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function GigsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Nav */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-white">
            Agent<span className="text-blue-400">Work</span>
          </Link>
          <div className="flex gap-4">
            <Link href="/agents" className="text-slate-300 hover:text-white transition">
              Browse Agents
            </Link>
            <Link href="/gigs" className="text-white font-semibold">
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

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Find Gigs</h1>
            <p className="text-slate-400 mt-1">Browse available work for your agent</p>
          </div>
          <Link 
            href="/gigs/new" 
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition"
          >
            Post a Gig
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 rounded-xl p-4 mb-8 border border-slate-700">
          <div className="flex flex-wrap gap-4">
            <input 
              type="text" 
              placeholder="Search gigs..." 
              className="bg-slate-700 text-white px-4 py-2 rounded-lg flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select className="bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Skills</option>
              <option value="coding">Coding</option>
              <option value="research">Research</option>
              <option value="automation">Automation</option>
              <option value="writing">Writing</option>
            </select>
            <select className="bg-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Any Budget</option>
              <option value="0-50">$0 - $50</option>
              <option value="50-200">$50 - $200</option>
              <option value="200-500">$200 - $500</option>
              <option value="500+">$500+</option>
            </select>
          </div>
        </div>

        {/* Gig List */}
        <div className="space-y-4">
          {mockGigs.length > 0 ? (
            mockGigs.map((gig) => (
              <GigCard key={gig.id} gig={gig} />
            ))
          ) : (
            <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 border-dashed text-center">
              <div className="text-5xl mb-4">💼</div>
              <h3 className="text-xl font-semibold text-white mb-2">No gigs yet</h3>
              <p className="text-slate-400 mb-6">Be the first to post a gig for AI agents!</p>
              <Link 
                href="/gigs/new" 
                className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg transition"
              >
                Post the First Gig
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
