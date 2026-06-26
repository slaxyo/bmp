// ============================== TYPING ANIMATION ==============================
const rotatingPhrases = ['one portal.', 'zero chaos.', 'two weeks.', 'total control.', 'your brand.'];
let phraseIndex = 0;
const typedEl = document.getElementById('heroTyped');

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

async function typeText(str) {
  for (let i = 0; i <= str.length; i++) {
    typedEl.textContent = str.slice(0, i);
    await wait(68);
  }
}

async function eraseText(str) {
  for (let i = str.length; i >= 0; i--) {
    typedEl.textContent = str.slice(0, i);
    await wait(36);
  }
}

async function cycleTyping() {
  if (!typedEl) return;
  await typeText(rotatingPhrases[0]);
  while (true) {
    await wait(2200);
    await eraseText(rotatingPhrases[phraseIndex]);
    await wait(260);
    phraseIndex = (phraseIndex + 1) % rotatingPhrases.length;
    await typeText(rotatingPhrases[phraseIndex]);
  }
}

cycleTyping();


// ============================== NAV SCROLL SHADOW ==============================
const navEl = document.getElementById('nav');
window.addEventListener('scroll', () => {
  navEl.classList.toggle('scrolled', window.scrollY > 8);
}, { passive: true });


// ============================== MOBILE MENU ==============================
const burger = document.getElementById('navBurger');
const mobileMenu = document.getElementById('navMobile');

if (burger && mobileMenu) {
  burger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });
  // Close on any link click
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });
}


// ============================== PRODUCT TABS ==============================
const tabs = document.querySelectorAll('.ptab');
const panels = document.querySelectorAll('.prod-panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    tabs.forEach(t => t.classList.remove('ptab-active'));
    panels.forEach(p => {
      p.classList.remove('prod-panel-active');
      p.style.display = 'none';
    });

    tab.classList.add('ptab-active');
    const targetPanel = document.querySelector(`.prod-panel[data-panel="${target}"]`);
    if (targetPanel) {
      targetPanel.style.display = '';
      targetPanel.classList.add('prod-panel-active');
    }
  });
});

// Init: show first panel
panels.forEach((p, i) => {
  if (i > 0) p.style.display = 'none';
});


// ============================== FAQ ACCORDION ==============================
document.querySelectorAll('[data-faq]').forEach(item => {
  const btn = item.querySelector('.faq-q');
  const answer = item.querySelector('.faq-a');

  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';

    document.querySelectorAll('[data-faq]').forEach(other => {
      other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      other.querySelector('.faq-a').classList.remove('open');
    });

    if (!isOpen) {
      btn.setAttribute('aria-expanded', 'true');
      answer.classList.add('open');
    }
  });
});


// ============================== SCROLL REVEAL ==============================
const revealTargets = document.querySelectorAll(
  '.kn-card, .testi-card, .price-card, .faq-item, .hiw-step'
);

revealTargets.forEach(el => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    const siblings = Array.from(entry.target.parentElement.children).filter(
      c => c.classList.contains('reveal')
    );
    const delay = siblings.indexOf(entry.target) * 70;

    setTimeout(() => {
      entry.target.classList.add('visible');
    }, delay);

    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

revealTargets.forEach(el => revealObserver.observe(el));


// ============================== SMOOTH ANCHOR SCROLL ==============================
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
