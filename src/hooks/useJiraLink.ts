import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Credential } from '../types';

export function useJiraLink(): (key: string) => string {
  const [domain, setDomain] = useState('');

  useEffect(() => {
    invoke<Credential | null>('get_credentials').then((cred) => {
      if (cred) setDomain(cred.domain);
    }).catch(() => {});
  }, []);

  return (key: string) => domain ? `https://${domain}/browse/${key}` : '#';
}
