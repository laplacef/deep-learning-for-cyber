/* version.js — per-site config (single source of truth).
   Holds everything about THIS site that the shared deck chrome needs: the
   displayed version, the menu label, the repository URL, and the deck list.

   This file is site-specific; the mechanism that reads it, deck-chrome.js, is
   shared framework. Bump the version and edit the deck list here only.

   Load this before deck-chrome.js, and before index.html's version readout. */
window.SITE = {
  version: 'v0.6.2',
  label:   'Deep Learning for Cyber',
  repoUrl: 'https://github.com/laplacef/deep-learning-for-cyber',

  // Teaching order; mirrors docs/index.html. built:false renders as a
  // dimmed, non-linked "soon" row in the deck menu.
  decks: [
    { n: '01', slug: 'neural-networks',           title: 'Neural Networks',           built: true },
    { n: '02', slug: 'how-neural-networks-learn', title: 'How Neural Networks Learn', built: true },
    { n: '03', slug: 'training-deep-networks',    title: 'Training Deep Networks',    built: true },
    { n: '04', slug: 'text-embeddings',           title: 'Text Embeddings',           built: true },
    { n: '05', slug: 'malware-as-images',         title: 'Malware as Images',         built: true },
    { n: '06', slug: 'sequences-recurrence',      title: 'Sequences & Recurrence',    built: true }
  ]
};

// Back-compat: the landing page reads this.
window.DLFC_VERSION = window.SITE.version;
