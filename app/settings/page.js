'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar';
import { getAdminPin, updateAdminPin } from '../../lib/supabase';

const PAD = ['1','2','3','4','5','6','7','8','9','','0','del'];

// step: null | 'new' | 'confirm'
export default function SettingsPage() {
  const router = useRouter();
  const [step, setStep]         = useState(null); // null = idle
  const [pinInput, setPinInput] = useState('');
  const [newPinTemp, setNewPinTemp] = useState('');
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('pos_authed') !== 'true') {
      router.replace('/');
    }
  }, [router]);

  function handleKey(key) {
    if (key === 'del') {
      setPinInput(p => p.slice(0, -1));
      setError('');
      return;
    }
    const next = pinInput + key;
    if (next.length > 4) return;
    setPinInput(next);
    setError('');

    if (next.length === 4) {
      if (step === 'new') {
        setNewPinTemp(next);
        setStep('confirm');
        setPinInput('');
      } else if (step === 'confirm') {
        if (next === newPinTemp) {
          handleSave(next);
        } else {
          setError('PINs do not match. Try again.');
          setTimeout(() => {
            setStep('new');
            setPinInput('');
            setNewPinTemp('');
            setError('');
          }, 800);
        }
      }
    }
  }

  async function handleSave(pin) {
    setSaving(true);
    const ok = await updateAdminPin(pin);
    setSaving(false);
    if (ok) {
      setStep(null);
      setPinInput('');
      setNewPinTemp('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError('Failed to save. Check your connection.');
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('pos_authed');
    router.push('/');
  }

  const stepLabel = step === 'new' ? 'Enter New PIN' : 'Confirm New PIN';

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-brand text-white px-4 pt-12 pb-4 sticky top-0 z-40"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="px-4 py-4 space-y-3">

        {/* Success banner */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-green-600 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-green-700 font-semibold text-sm">PIN updated successfully! POS app will use the new PIN too.</p>
          </div>
        )}

        {/* Change PIN card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-4 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Security</p>
            <p className="font-semibold text-gray-800">Admin PIN</p>
            <p className="text-xs text-gray-400 mt-0.5">Used to unlock the Admin tab in the POS app and this dashboard.</p>
          </div>

          {step === null ? (
            <button
              onClick={() => { setStep('new'); setPinInput(''); setNewPinTemp(''); }}
              className="w-full flex items-center justify-between px-4 py-4 text-left active:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5 text-brand">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-700">Change PIN</span>
              </div>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-300">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
              </svg>
            </button>
          ) : (
            <div className="px-4 py-5 flex flex-col items-center gap-4">
              <p className="text-sm font-semibold text-gray-700">{stepLabel}</p>
              {step === 'confirm' && (
                <p className="text-xs text-gray-400 -mt-2">Re-enter the same PIN to confirm</p>
              )}

              {/* PIN dots */}
              <div className="flex gap-4">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
                    error
                      ? 'bg-red-500 border-red-500'
                      : pinInput.length > i
                      ? 'bg-brand border-brand'
                      : 'border-gray-300'
                  }`} />
                ))}
              </div>

              {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
              {saving && <p className="text-gray-400 text-xs">Saving…</p>}

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2 w-56">
                {PAD.map((key, idx) => {
                  if (key === '') return <div key={idx} />;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleKey(key)}
                      className={`h-14 rounded-xl text-lg font-semibold flex items-center justify-center active:scale-95 transition-transform select-none ${
                        key === 'del' ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-800'
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

              <button
                onClick={() => { setStep(null); setPinInput(''); setNewPinTemp(''); setError(''); }}
                className="text-gray-400 text-sm mt-1"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* App info */}
        <div className="bg-white rounded-2xl shadow-sm px-4 py-4 space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">About</p>
          <p className="text-sm text-gray-600">Quick POS — Owner Dashboard</p>
          <p className="text-xs text-gray-400">Connected to Supabase cloud database</p>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full bg-white rounded-2xl shadow-sm px-4 py-4 flex items-center gap-3 text-red-500 active:bg-red-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          <span className="font-semibold text-sm">Logout</span>
        </button>

      </div>

      <NavBar />
    </div>
  );
}
