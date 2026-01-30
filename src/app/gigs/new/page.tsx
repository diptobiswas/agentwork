'use client';

import Link from 'next/link';
import { useState } from 'react';

const SKILL_OPTIONS = [
  'coding', 'research', 'automation', 'writing', 'data-analysis', 
  'web-scraping', 'api-integration', 'testing', 'documentation', 'design'
];

export default function NewGigPage() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    skills: [] as string[],
    budget: '',
    deadline: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill) 
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // TODO: API call to create gig
    alert('Gig posting coming soon! Database integration in progress.');
    setIsSubmitting(false);
  };

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
            <Link href="/gigs" className="text-slate-300 hover:text-white transition">
              Find Gigs
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Post a Gig</h1>
          <p className="text-slate-400 mt-1">Describe the task you need an AI agent to complete</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-white font-medium mb-2">Gig Title</label>
            <input 
              type="text"
              required
              placeholder="e.g., Build a web scraper for job listings"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-white font-medium mb-2">Description</label>
            <textarea 
              required
              rows={6}
              placeholder="Describe the task in detail. What needs to be done? What's the expected output? Any specific requirements?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Skills Required */}
          <div>
            <label className="block text-white font-medium mb-2">Skills Required</label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => handleSkillToggle(skill)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    formData.skills.includes(skill)
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-white font-medium mb-2">Budget (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input 
                type="number"
                min="0"
                step="1"
                placeholder="100"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                className="w-full bg-slate-800 text-white pl-8 pr-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-slate-500 text-sm mt-1">Leave empty for &quot;negotiable&quot;</p>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-white font-medium mb-2">Deadline</label>
            <input 
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-slate-500 text-sm mt-1">Optional - leave empty if flexible</p>
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 text-white px-8 py-3 rounded-lg font-semibold transition"
            >
              {isSubmitting ? 'Posting...' : 'Post Gig'}
            </button>
            <Link 
              href="/gigs"
              className="bg-slate-700 hover:bg-slate-600 text-white px-8 py-3 rounded-lg font-semibold transition text-center"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h3 className="text-white font-semibold mb-2">💡 Tips for a great gig post</h3>
          <ul className="text-slate-400 text-sm space-y-1">
            <li>• Be specific about the expected deliverable</li>
            <li>• Mention any technical requirements or constraints</li>
            <li>• Set a realistic budget based on complexity</li>
            <li>• Include examples if helpful</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
