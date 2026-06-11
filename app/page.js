'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminPin } from '../lib/supabase';

const PAD = ['1','2','3','4','5','6','7','8','9','','0','del'];

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('pos_authed') === 'true') {
        router.replace('/dashboard');
        return;
      }
    }
    setLoading(false);
  }, [router]);

  async function handleKey(key) {
    if (key === 'del') {
      setPin(p => p.slice(0, -1));
      setError(false);
      return;
    }
    const next = pin + key;
    setPin(next);
    setError(false);

    if (next.length === 4) {
      const correct = await getAdminPin();
      if (next === correct) {
        sessionStorage.setItem('pos_authed', 'true');
        router.push('/dashboard');
      } else {
        setError(true);
        setTimeout(() => { setPin(''); setError(false); }, 700);
      }
    }
  }

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 pb-10 gap-4">
      {/* Logo / icon */}
      <div className="w-20 h-20 rounded-3xl bg-brand flex items-center justify-center shadow-lg mb-2">
        <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-white" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-800">Owner Dashboard</h1>
      <p className="text-gray-400 text-sm -mt-2">Enter your 4-digit PIN</p>

      {/* PIN dots */}
      <div className="flex gap-4 my-2">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
            error
              ? 'bg-red-500 border-red-500'
              : pin.length > i
              ? 'bg-brand border-brand'
              : 'border-gray-300 bg-transparent'
          }`} />
        ))}
      </div>

      {error && <p className="text-red-500 text-sm font-medium h-5">Incorrect PIN</p>}
      {!error && <div className="h-5" />}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {PAD.map((key, idx) => {
          if (key === '') return <div key={idx} />;
          return (
            <button
              key={idx}
              onClick={() => handleKey(key)}
              className={`h-16 rounded-2xl text-xl font-semibold flex items-center justify-center active:scale-95 transition-transform select-none ${
                key === 'del'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-white shadow-sm text-gray-800 hover:bg-gray-50'
              }`}
            >
              {key === 'del' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0L16.5 14.25M14.25 12L16.5 9.75M14.25 12L12 14.25M4.86 6.573A2 2 0 016.414 6H19a2 2 0 012 2v8a2 2 0 01-2 2H6.414a2 2 0 01-1.553-.746l-3.5-4.5a1.5 1.5 0 010-1.508l3.5-4.5z" />
                </svg>
              ) : key}
            </button>
          );
        })}
      </div>

      <p className="text-gray-300 text-xs mt-4">Quick POS  •  Owner Access</p>
    </div>
  );
}
