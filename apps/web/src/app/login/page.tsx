import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });
    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className={styles['container']}>
      <form onSubmit={handleSubmit} className={styles['form']}>
        <h1 className={styles['title']}>Welcome back</h1>
        {error && <p className={styles['error']}>{error}</p>}
        <label htmlFor="email" className={styles['label']}>Email</label>
        <input
          id="email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={styles['input']}
        />
        <label htmlFor="password" className={styles['label']}>Password</label>
        <input
          id="password"
          type="password"
          required
          placeholder="Your password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={styles['input']}
        />
        <button id="sign-in-btn" type="submit" disabled={loading} className={styles['button']}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
