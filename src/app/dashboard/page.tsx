import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  const userId = (session.user as any).id
  const plan = (session.user as any).plan || 'FREE'

  const installations = await prisma.installation.findMany({
    where: { userId },
    include: {
      repositories: {
        include: {
          reviews: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      },
    },
  })

  // Get monthly review count
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const monthlyReviewCount = await prisma.review.count({
    where: {
      repository: { installation: { userId } },
      createdAt: { gte: monthStart },
    },
  })

  const planLimits = { FREE: 50, PRO: 500, TEAM: -1 }
  const limit = planLimits[plan as keyof typeof planLimits]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">CodeSentri</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{session.user.email}</span>
            <span className="text-xs px-2 py-1 rounded bg-emerald-900 text-emerald-300 font-mono">{plan}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Usage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-400">Reviews This Month</div>
            <div className="text-2xl font-bold mt-1">
              {monthlyReviewCount}
              {limit !== -1 && <span className="text-sm text-gray-500"> / {limit}</span>}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-400">Active Repos</div>
            <div className="text-2xl font-bold mt-1">
              {installations.reduce((sum, i) => sum + i.repositories.filter(r => r.isActive).length, 0)}
            </div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-400">Plan</div>
            <div className="text-2xl font-bold mt-1">{plan}</div>
            {plan === 'FREE' && (
              <a href="/api/stripe/checkout?plan=PRO" className="text-sm text-emerald-400 hover:text-emerald-300 mt-1 inline-block">
                Upgrade →
              </a>
            )}
          </div>
        </div>

        {/* Repos & Reviews */}
        {installations.length === 0 ? (
          <div className="bg-gray-900 rounded-lg p-8 border border-gray-800 text-center">
            <h2 className="text-lg font-semibold mb-2">No installations yet</h2>
            <p className="text-gray-400 mb-4">Install the CodeSentri GitHub App to start reviewing PRs automatically.</p>
            <a
              href={`https://github.com/apps/${process.env.GITHUB_APP_SLUG}/installations/new`}
              className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium transition"
            >
              Install GitHub App
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {installations.map(installation =>
              installation.repositories.map(repo => (
                <div key={repo.id} className="bg-gray-900 rounded-lg border border-gray-800">
                  <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="font-mono text-sm">{repo.fullName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${repo.isActive ? 'bg-emerald-900 text-emerald-300' : 'bg-gray-800 text-gray-500'}`}>
                      {repo.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  {repo.reviews.length > 0 ? (
                    <div className="divide-y divide-gray-800">
                      {repo.reviews.map(review => (
                        <div key={review.id} className="px-4 py-3 flex justify-between items-center">
                          <div>
                            <span className="text-sm">PR #{review.prNumber}</span>
                            <span className="text-gray-400 text-sm ml-2">{review.prTitle}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">{review.commentsCount} comments</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              review.status === 'COMPLETED' ? 'bg-emerald-900 text-emerald-300' :
                              review.status === 'FAILED' ? 'bg-red-900 text-red-300' :
                              review.status === 'REVIEWING' ? 'bg-yellow-900 text-yellow-300' :
                              'bg-gray-800 text-gray-400'
                            }`}>
                              {review.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center text-gray-500 text-sm">
                      No reviews yet. Open a PR to get started.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
