import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-950">
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-100">Your Projects</h1>
          <Link
            href="/project/new"
            className="px-6 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded transition-colors"
          >
            New Project
          </Link>
        </div>

        {!projects || projects.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No projects yet</p>
            <Link
              href="/project/new"
              className="inline-block px-6 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded transition-colors"
            >
              Create Your First Project
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="border border-gray-800 bg-gray-900/50 rounded-lg p-6 hover:border-[#E8841A]/50 transition-colors"
              >
                <h3 className="text-lg font-semibold text-gray-100 mb-2">
                  {project.name}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {project.location || 'No location'}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    UTM Zone {project.utm_zone}{project.hemisphere}
                  </span>
                  <span className="text-gray-500">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>
                <Link
                  href={`/project/${project.id}`}
                  className="mt-4 block w-full text-center py-2 bg-gray-800 hover:bg-gray-700 text-[#E8841A] rounded transition-colors"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
