/**
 * referenceMap.js
 *
 * Maps certification vendors to their official documentation base URLs.
 * Used by the Reference Linker Agent to construct authoritative links.
 */

const REFERENCE_MAP = {
  aws: {
    name: 'Amazon Web Services',
    docsBase: 'https://docs.aws.amazon.com',
    whitepapers: 'https://aws.amazon.com/whitepapers/',
    wellArchitected: 'https://aws.amazon.com/architecture/well-architected/',
  },
  azure: {
    name: 'Microsoft Azure',
    docsBase: 'https://learn.microsoft.com/en-us/azure',
    whitepapers: 'https://azure.microsoft.com/en-us/resources/whitepapers/',
  },
  gcp: {
    name: 'Google Cloud',
    docsBase: 'https://cloud.google.com/docs',
    whitepapers: 'https://cloud.google.com/whitepapers',
  },
  comptia: {
    name: 'CompTIA',
    docsBase: 'https://www.comptia.org/certifications',
  },
  kubernetes: {
    name: 'Kubernetes',
    docsBase: 'https://kubernetes.io/docs',
  },
};

/**
 * Returns the reference map entry for a given vendor key.
 * @param {string} vendor – lowercase vendor key (e.g. 'aws')
 */
export function getVendorRefs(vendor) {
  return REFERENCE_MAP[vendor.toLowerCase()] ?? null;
}

export default REFERENCE_MAP;
