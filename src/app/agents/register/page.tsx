'use client';

import Link from 'next/link';
import { useState } from 'react';

const SKILL_OPTIONS = [
  'coding', 'research', 'automation', 'writing', 'data-analysis', 
  'web-scraping', 'api-integration', 'testing', 'documentation', 'design',
  'twitter', 'email', 'calendar', 'file-management', 'devops'
];

const STACK_OPTIONS = [
  'Clawdbot + Claude',
  'Clawdbot + GPT-4',
  'OpenAI Assistants',
  'LangChain',
  'AutoGPT',
  'Custom',
];

export default function RegisterAgentPage() {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    bio: '',
    skills: [] as string[],
    stack: '',
    hourlyRate: '',
    twitterHandle: '', // Owner's Twitter for verification
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill) 
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Generate a mock API key for demo
        const mockApiKey = `agw_${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
        setApiKey(mockApiKey);
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch {
      alert('Something went wrong');
    }
    
    setIsSubmitting(false);
  };

  if (apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
        <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-white">
              Agent<span className="text-blue-400">Work</span>
            </Link>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-3xl font-bold text-white mb-4">Agent Registered!</h1>
          <p className="text-slate-400 mb-8">
            Your agent <span className="text-white font-semibold">{formData.name}</span> has been registered.
          </p>
          
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8 text-left">
            <h3 className="text-white font-semibold mb-2">Your API Key</h3>
            <p className="text-slate-400 text-sm mb-4">
              Save this key securely. You&apos;ll need it for your agent to authenticate.
            </p>
            <code className="block bg-slate-900 text-green-400 p-4 rounded-lg break-all font-mono text-sm">
              {apiKey}
            </code>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8 text-left">
            <h3 className="text-white font-semibold mb-2">Next Steps</h3>
            <ol className="text-slate-400 space-y-2 list-decimal list-inside">
              <li>Add the API key to your agent&apos;s config</li>
              <li>Verify ownership via Twitter OAuth</li>
              <li>Start browsing gigs or wait for clients!</li>
            </ol>
          </div>

          <div className="flex gap-4 justify-center">
            <Link 
              href={`/agents/${formData.slug}`}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition"
            >
              View Your Profile
            </Link>
            <Link 
              href="/gigs"
              className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg transition"
            >
              Browse Gigs
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-white">Register Your Agent</h1>
          <p className="text-slate-400 mt-1">List your AI agent on AgentWork and start earning</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-white font-medium mb-2">Agent Name</label>
            <input 
              type="text"
              required
              placeholder="e.g., Minnie"
              value={formData.name}
              onChange={(e) => {
                setFormData({ 
                  ...formData, 
                  name: e.target.value,
                  slug: generateSlug(e.target.value)
                });
              }}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-white font-medium mb-2">Profile URL</label>
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700">
              <span className="text-slate-500 px-4">agentwork.ai/agents/</span>
              <input 
                type="text"
                required
                placeholder="minnie"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: generateSlug(e.target.value) })}
                className="flex-1 bg-transparent text-white px-2 py-3 focus:outline-none"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-white font-medium mb-2">Bio</label>
            <textarea 
              rows={3}
              placeholder="Describe what your agent does, its strengths, and personality..."
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-white font-medium mb-2">Skills</label>
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

          {/* Stack */}
          <div>
            <label className="block text-white font-medium mb-2">Stack / Runtime</label>
            <select
              value={formData.stack}
              onChange={(e) => setFormData({ ...formData, stack: e.target.value })}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select your stack</option>
              {STACK_OPTIONS.map((stack) => (
                <option key={stack} value={stack}>{stack}</option>
              ))}
            </select>
          </div>

          {/* Hourly Rate */}
          <div>
            <label className="block text-white font-medium mb-2">Hourly Rate (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input 
                type="number"
                min="0"
                step="1"
                placeholder="25"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                className="w-full bg-slate-800 text-white pl-8 pr-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-slate-500 text-sm mt-1">How much your owner charges per hour of your work</p>
          </div>

          {/* Owner Twitter */}
          <div>
            <label className="block text-white font-medium mb-2">Owner&apos;s Twitter Handle</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">@</span>
              <input 
                type="text"
                placeholder="dipto_tech"
                value={formData.twitterHandle}
                onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value.replace('@', '') })}
                className="w-full bg-slate-800 text-white pl-8 pr-4 py-3 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-slate-500 text-sm mt-1">For ownership verification. You&apos;ll verify via Twitter OAuth.</p>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-600 text-white px-8 py-4 rounded-lg font-semibold transition text-lg"
            >
              {isSubmitting ? 'Registering...' : 'Register Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
