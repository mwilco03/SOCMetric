import React, { useState } from 'react';
import { VaultManager } from '../../vault/vaultManager';

interface VaultUnlockProps {
  onUnlock: (payload: Awaited<ReturnType<typeof VaultManager.loadVault>>) => void;
  onReset: () => void;
}

export const VaultUnlock: React.FC<VaultUnlockProps> = ({ onUnlock, onReset }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleUnlock = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await VaultManager.loadVault(password);
      if (payload) {
        onUnlock(payload);
      } else {
        setError('No vault data found');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to decrypt vault');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    VaultManager.clearVault();
    onReset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-soc-bg p-6">
      <div className="w-full max-w-sm bg-soc-card border border-soc-border rounded-lg p-6">
        <h1 className="text-xl font-semibold text-gray-100 mb-2">Unlock Vault</h1>
        <p className="text-sm text-gray-400 mb-6">
          Enter your passphrase to decrypt stored credentials.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Passphrase</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && password.length >= 8 && handleUnlock()}
              placeholder="Enter vault passphrase"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-200"
              autoFocus
            />
          </div>
          <button
            onClick={handleUnlock}
            disabled={isLoading || password.length < 8}
            className="w-full py-2 bg-kpi-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Decrypting...' : 'Unlock'}
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700">
          {!showReset ? (
            <button
              onClick={() => setShowReset(true)}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Forgot passphrase? Reset vault
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-red-400">This will delete all stored credentials.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Confirm Reset
                </button>
                <button
                  onClick={() => setShowReset(false)}
                  className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
