import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const { userId } = await auth()

  // If user is signed in, redirect to projects page
  if (userId) {
    redirect('/projects')
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to NextgenSoft's 6 Figure RAG Course</h1>
        <p className="mb-6">Please sign in to continue</p>
        <a href="/sign-in" className="text-blue-600 hover:underline">Sign In</a>
      </div>
    </div>
  )
}