import { encryptVault, decryptVault, type VaultData } from './encryption';

export const VAULT_KEY = 'soc_dashboard_vault';

export interface VaultPayload {
  credentials: {
    domain: string;
    email: string;
    apiToken: string;
  };
  projects: {
    selectedKeys: string[];
    irProjectKey?: string;
  };
  statusMappings: Record<string, Record<string, string>>;
  ttftAnchors: Record<string, { method: string; targetStatus?: string }>;
  workSchedule: {
    timezone: string;
    shifts: Array<{
      name: string;
      timezone: string;
      startHour: number;
      endHour: number;
      workDays: string[];
      baseHeadcount: number;
    }>;
  };
  preferences: {
    viewMode: 'analyst' | 'lead' | 'executive';
    defaultDateRange: number;
  };
}

export class VaultManager {
  static async createVault(
    payload: VaultPayload,
    password: string
  ): Promise<void> {
    const vault = await encryptVault(payload, password);
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  }

  static async loadVault(password: string): Promise<VaultPayload | null> {
    const stored = localStorage.getItem(VAULT_KEY);
    if (!stored) return null;

    try {
      const vault: VaultData = JSON.parse(stored);
      return (await decryptVault(vault, password)) as VaultPayload;
    } catch (e) {
      throw new Error('Failed to decrypt vault - incorrect password');
    }
  }

  static vaultExists(): boolean {
    return localStorage.getItem(VAULT_KEY) !== null;
  }

  static clearVault(): void {
    localStorage.removeItem(VAULT_KEY);
  }

  static async updateVault(
    password: string,
    updater: (payload: VaultPayload) => VaultPayload
  ): Promise<void> {
    const current = await this.loadVault(password);
    if (!current) throw new Error('No vault exists');
    
    const updated = updater(current);
    await this.createVault(updated, password);
  }
}

