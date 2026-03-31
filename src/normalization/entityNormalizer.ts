/** SIEM Title Normalization - Entity Extraction */

// Entity patterns
const ENTITY_PATTERNS = {
  ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  ipv6: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  md5: /\b[a-fA-F0-9]{32}\b/g,
  sha1: /\b[a-fA-F0-9]{40}\b/g,
  sha256: /\b[a-fA-F0-9]{64}\b/g,
  url: /https?:\/\/[^\s]+/g,
  filePath: /(?:\/[\w-]+)+\/?|\b[A-Z]:\\[^\s]+/g,
  timestamp: /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g,
  port: /\bport[:\s]+(\d{1,5})\b/gi,
  cve: /CVE-\d{4}-\d{4,}/gi,
};

export interface ExtractedEntities {
  ips: string[];
  emails: string[];
  hashes: string[];
  urls: string[];
  paths: string[];
  timestamps: string[];
  ports: string[];
  cves: string[];
}

export function extractEntities(title: string): ExtractedEntities {
  return {
    ips: [...title.matchAll(ENTITY_PATTERNS.ipv4)].map(m => m[0])
      .concat([...title.matchAll(ENTITY_PATTERNS.ipv6)].map(m => m[0])),
    emails: [...title.matchAll(ENTITY_PATTERNS.email)].map(m => m[0]),
    hashes: [
      ...[...title.matchAll(ENTITY_PATTERNS.md5)].map(m => m[0]),
      ...[...title.matchAll(ENTITY_PATTERNS.sha1)].map(m => m[0]),
      ...[...title.matchAll(ENTITY_PATTERNS.sha256)].map(m => m[0]),
    ],
    urls: [...title.matchAll(ENTITY_PATTERNS.url)].map(m => m[0]),
    paths: [...title.matchAll(ENTITY_PATTERNS.filePath)].map(m => m[0]),
    timestamps: [...title.matchAll(ENTITY_PATTERNS.timestamp)].map(m => m[0]),
    ports: [...title.matchAll(ENTITY_PATTERNS.port)].map(m => m[1]),
    cves: [...title.matchAll(ENTITY_PATTERNS.cve)].map(m => m[0]),
  };
}

export function normalizeTitle(title: string): { normalized: string; entities: ExtractedEntities } {
  const entities = extractEntities(title);
  
  let normalized = title;
  
  // Replace entities with tokens
  normalized = normalized.replace(ENTITY_PATTERNS.ipv4, '<IP>');
  normalized = normalized.replace(ENTITY_PATTERNS.ipv6, '<IPV6>');
  normalized = normalized.replace(ENTITY_PATTERNS.email, '<EMAIL>');
  normalized = normalized.replace(ENTITY_PATTERNS.sha256, '<HASH>');
  normalized = normalized.replace(ENTITY_PATTERNS.sha1, '<HASH>');
  normalized = normalized.replace(ENTITY_PATTERNS.md5, '<HASH>');
  normalized = normalized.replace(ENTITY_PATTERNS.url, '<URL>');
  normalized = normalized.replace(ENTITY_PATTERNS.filePath, '<PATH>');
  normalized = normalized.replace(ENTITY_PATTERNS.timestamp, '<TIMESTAMP>');
  normalized = normalized.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '<IP>');
  
  // Clean up extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return { normalized, entities };
}

// SIEM Pattern Detection
export interface SIEMPattern {
  sourceSystem: string;
  severity?: string;
  ruleName: string;
  confidence: 'high' | 'medium' | 'low';
}

export function detectSIEMPattern(title: string): SIEMPattern | null {
  // Pattern: [SEVERITY] Rule Name
  const severityMatch = title.match(/^\[(\w+)\]\s*(.+)/);
  if (severityMatch) {
    return {
      sourceSystem: 'Unknown',
      severity: severityMatch[1],
      ruleName: severityMatch[2].replace(/-\s*Host:\s*<HOST>/i, '').trim(),
      confidence: 'high',
    };
  }
  
  // Pattern: Vendor: Rule Name
  const vendorMatch = title.match(/^(AWS GuardDuty|Microsoft Defender|CrowdStrike|Splunk|Proofpoint):\s*(.+)/i);
  if (vendorMatch) {
    return {
      sourceSystem: vendorMatch[1].split(' ')[0],
      ruleName: vendorMatch[2].trim(),
      confidence: 'high',
    };
  }
  
  // Pattern: DLP Alert | Policy: XXX | ...
  const dlpMatch = title.match(/^DLP Alert\s*\|\s*Policy:\s*([^|]+)/i);
  if (dlpMatch) {
    return {
      sourceSystem: 'DLP',
      ruleName: `DLP: ${dlpMatch[1].trim()}`,
      confidence: 'high',
    };
  }
  
  // Low confidence - just use normalized title
  return {
    sourceSystem: 'Unknown',
    ruleName: title.substring(0, 100),
    confidence: 'low',
  };
}

export function getAssetClass(entities: ExtractedEntities): 'endpoint' | 'network' | 'cloud' | 'identity' | 'data' | 'unknown' {
  if (entities.urls.length > 0 || entities.paths.some(p => p.includes('s3') || p.includes('bucket'))) {
    return 'cloud';
  }
  if (entities.emails.length > 0) {
    return 'identity';
  }
  if (entities.paths.length > 0) {
    return 'endpoint';
  }
  if (entities.ips.length > 0) {
    return 'network';
  }
  return 'unknown';
}

