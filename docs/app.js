/**
 * Voltrex Vault — Official Website Client Script (docs/app.js)
 * Clean, lightweight vanilla JavaScript for screenshot tab management and fullscreen modal.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Screenshot items dataset
  const screenshots = [
    {
      src: 'screenshots/Screenshot 1.png',
      title: 'Screenshot 1: Main Vault & Category Overview',
      badge: 'DASHBOARD',
      desc: 'Organize your digital footprint across Logins, Secure Notes, Payment Cards, and Identity profiles with instant search and quick-lock keyboard commands.'
    },
    {
      src: 'screenshots/Screenshot 2.png',
      title: 'Screenshot 2: Create New Vault Entry',
      badge: 'CREDENTIAL INPUT',
      desc: 'Store encrypted credentials with multi-field attributes, category tagging, security hints, and one-click integration with the cryptographic password generator.'
    },
    {
      src: 'screenshots/Screenshot 3.png',
      title: 'Screenshot 3: Cryptographic Password Generator',
      badge: 'ENTROPY ENGINE',
      desc: 'Generate high-entropy passwords calculated with real-time Shannon entropy (up to 128+ bits). Fully customizable character sets with ambiguous character filtering.'
    },
    {
      src: 'screenshots/Screenshot 4.png',
      title: 'Screenshot 4: Vault Preferences & Encrypted Backups',
      badge: 'PREFERENCES & BACKUP',
      desc: 'Configure inactivity auto-lock and clipboard wiping durations. Export master-password-encrypted standalone .voltrex containers with rollback snapshot safety.'
    }
  ];

  let currentIdx = 0;

  const tabs = document.querySelectorAll('.gallery-tab');
  const mainImage = document.getElementById('gallery-main-image');
  const galleryTitle = document.getElementById('gallery-title');
  const galleryBadge = document.getElementById('gallery-badge');
  const galleryDesc = document.getElementById('gallery-description');
  const btnFullscreen = document.getElementById('btn-fullscreen-preview');

  const modal = document.getElementById('image-modal');
  const modalImg = document.getElementById('modal-image');
  const modalCaption = document.getElementById('modal-caption');
  const modalClose = document.getElementById('modal-close-btn');

  function updateGallery(idx) {
    if (idx < 0 || idx >= screenshots.length) return;
    currentIdx = idx;

    tabs.forEach((tab, i) => {
      const isActive = i === idx;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const item = screenshots[idx];
    mainImage.src = item.src;
    mainImage.alt = item.title;
    galleryTitle.textContent = item.title;
    galleryBadge.textContent = item.badge;
    galleryDesc.textContent = item.desc;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = parseInt(tab.getAttribute('data-target'), 10);
      updateGallery(target);
    });
  });

  // Open Fullscreen Modal
  function openModal() {
    const item = screenshots[currentIdx];
    modalImg.src = item.src;
    modalCaption.textContent = `${item.title} — ${item.desc}`;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (mainImage) {
    mainImage.addEventListener('click', openModal);
  }

  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', openModal);
  }

  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  // Mobile Drawer Navigation Toggle
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  function openMobileMenu() {
    if (!mobileDrawer || !mobileToggle) return;
    mobileDrawer.classList.add('open');
    mobileToggle.classList.add('open');
    mobileToggle.setAttribute('aria-expanded', 'true');
    mobileDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeMobileMenu() {
    if (!mobileDrawer || !mobileToggle) return;
    mobileDrawer.classList.remove('open');
    mobileToggle.classList.remove('open');
    mobileToggle.setAttribute('aria-expanded', 'false');
    mobileDrawer.setAttribute('aria-hidden', 'true');
  }

  function toggleMobileMenu() {
    if (!mobileDrawer) return;
    if (mobileDrawer.classList.contains('open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  if (mobileToggle) {
    mobileToggle.addEventListener('click', toggleMobileMenu);
  }

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMobileMenu();
    });
  });

  // Close drawer when resized back to desktop view
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMobileMenu();
    }
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeMobileMenu();
    } else if (!modal.classList.contains('open')) {
      if (e.key === 'ArrowRight') {
        const next = (currentIdx + 1) % screenshots.length;
        updateGallery(next);
      } else if (e.key === 'ArrowLeft') {
        const prev = (currentIdx - 1 + screenshots.length) % screenshots.length;
        updateGallery(prev);
      }
    }
  });

  // OS Detection for hero button
  try {
    const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
    const heroBtn = document.getElementById('hero-primary-download');
    if (heroBtn && (platform.includes('linux') || platform.includes('x11'))) {
      heroBtn.href = 'https://github.com/ziard47/voltrex-vault/releases/download/v1.0.0/Voltrex-Vault-1.0.0.AppImage';
      const label = heroBtn.querySelector('span');
      if (label) {
        label.textContent = 'Download for Linux (.AppImage)';
      }
      const icon = heroBtn.querySelector('i');
      if (icon) {
        icon.className = 'fa-solid fa-cube';
      }
    }
  } catch {
    // Ignore and fallback to Windows default
  }
});
