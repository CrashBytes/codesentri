import { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email',
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id
        // Fetch plan from database
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { plan: true },
        })
        ;(session.user as any).plan = dbUser?.plan || 'FREE'
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
