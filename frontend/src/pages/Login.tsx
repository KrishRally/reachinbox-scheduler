import { googleLoginUrl } from '../api';

export default function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow">
        <h1 className="mb-1 text-2xl font-semibold text-brand">Email Scheduler</h1>
        <p className="mb-6 text-sm text-gray-500">Sign in to schedule and track your emails</p>
        <a
          href={googleLoginUrl}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Continue with Google
        </a>
      </div>
    </div>
  );
}
