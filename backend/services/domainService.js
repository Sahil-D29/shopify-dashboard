// backend/services/domainService.js
import path from 'path';
import dns from 'dns/promises';
import { readFileSafe, writeFileSafe } from '../utils/safeFileStore.js';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../utils/logger.js';

const domainsFile = path.join(process.cwd(), 'backend', 'data', 'email-domains.json');

export async function loadDomains() {
  const data = await readFileSafe(domainsFile, { default: { domains: [] } });
  return data.domains || [];
}

async function saveDomains(domains) {
  await writeFileSafe(domainsFile, { domains });
}

export async function getDomainsByStore(storeId) {
  const domains = await loadDomains();
  return domains.filter(d => d.storeId === storeId);
}

export async function getDomainById(id) {
  const domains = await loadDomains();
  return domains.find(d => d.id === id);
}

export async function addDomain(domain, storeId, actorId) {
  const domains = await loadDomains();
  const normalized = domain.toLowerCase().trim();

  const existing = domains.find(d => d.domain === normalized && d.storeId === storeId);
  if (existing) throw new Error('Domain already exists for this store');

  const dkimSelector = `ses-${Date.now()}`;

  const entry = {
    id: `dom_${uuidv4()}`,
    domain: normalized,
    storeId,
    status: 'pending',
    dnsRecords: {
      spf: {
        type: 'TXT',
        host: normalized,
        value: 'v=spf1 include:amazonses.com ~all',
        verified: false,
      },
      dkim: {
        type: 'CNAME',
        host: `${dkimSelector}._domainkey.${normalized}`,
        value: `${dkimSelector}.dkim.amazonses.com`,
        verified: false,
      },
      dmarc: {
        type: 'TXT',
        host: `_dmarc.${normalized}`,
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${normalized}`,
        verified: false,
      },
    },
    warmup: {
      stage: 'not_started',
      dailyLimit: 10,
      startedAt: null,
    },
    verifiedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: actorId,
  };

  domains.push(entry);
  await saveDomains(domains);

  await logActivity({
    type: 'email_domain_added',
    actorId,
    storeId,
    domain: normalized,
  });

  return entry;
}

export async function verifyDomain(id) {
  const domains = await loadDomains();
  const domain = domains.find(d => d.id === id);
  if (!domain) throw new Error('Domain not found');

  const results = {
    spf: false,
    dkim: false,
    dmarc: false,
  };

  // Verify SPF
  try {
    const txtRecords = await dns.resolveTxt(domain.domain);
    const flat = txtRecords.map(r => r.join(''));
    results.spf = flat.some(r => r.includes('v=spf1') && r.includes('amazonses.com'));
  } catch {
    results.spf = false;
  }

  // Verify DKIM (check CNAME)
  try {
    const cname = await dns.resolveCname(domain.dnsRecords.dkim.host);
    results.dkim = cname.some(r => r.includes('amazonses.com'));
  } catch {
    results.dkim = false;
  }

  // Verify DMARC
  try {
    const txtRecords = await dns.resolveTxt(domain.dnsRecords.dmarc.host);
    const flat = txtRecords.map(r => r.join(''));
    results.dmarc = flat.some(r => r.includes('v=DMARC1'));
  } catch {
    results.dmarc = false;
  }

  // Update domain
  domain.dnsRecords.spf.verified = results.spf;
  domain.dnsRecords.dkim.verified = results.dkim;
  domain.dnsRecords.dmarc.verified = results.dmarc;

  const allVerified = results.spf && results.dkim && results.dmarc;
  domain.status = allVerified ? 'verified' : 'pending';
  if (allVerified && !domain.verifiedAt) {
    domain.verifiedAt = new Date().toISOString();
  }
  domain.updatedAt = new Date().toISOString();

  await saveDomains(domains);

  return { domain, results, allVerified };
}

export async function removeDomain(id, actorId) {
  const domains = await loadDomains();
  const domain = domains.find(d => d.id === id);
  if (!domain) throw new Error('Domain not found');

  const filtered = domains.filter(d => d.id !== id);
  await saveDomains(filtered);

  await logActivity({
    type: 'email_domain_removed',
    actorId,
    domain: domain.domain,
  });

  return true;
}

export async function updateWarmupStage(id, stage, dailyLimit) {
  const domains = await loadDomains();
  const domain = domains.find(d => d.id === id);
  if (!domain) throw new Error('Domain not found');

  domain.warmup.stage = stage;
  domain.warmup.dailyLimit = dailyLimit;
  if (stage === 'active' && !domain.warmup.startedAt) {
    domain.warmup.startedAt = new Date().toISOString();
  }
  domain.updatedAt = new Date().toISOString();

  await saveDomains(domains);
  return domain;
}
