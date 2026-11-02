import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/Button';

export function Header() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <h1 className="text-lg font-semibold text-brand">Email Scheduler</h1>
      <div className="flex items-center gap-3">
        <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full bg-gray-200" />
        <div className="text-right text-sm leading-tight">
          <div className="font-medium">{user.name}</div>
          <div className="text-gray-500">{user.email}</div>
        </div>
        <Button variant="outline" onClick={logout}>Logout</Button>
      </div>
    </header>
  );
}
