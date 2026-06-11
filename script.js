// ============================== TYPING ANIMATION ==============================
const rotatingPhrases = ['one portal.', 'zero chaos.', 'two weeks.', 'total control.'];
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
    await wait(2000);
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


// ============================== FAQ ACCORDION ==============================
document.querySelectorAll('[data-faq]').forEach(item => {
  const btn = item.querySelector('.faq-q');
  const answer = item.querySelector('.faq-a');

  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';

    // Close every item first
    document.querySelectorAll('[data-faq]').forEach(other => {
      other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      other.querySelector('.faq-a').classList.remove('open');
    });

    // If this item was closed, open it
    if (!isOpen) {
      btn.setAttribute('aria-expanded', 'true');
      answer.classList.add('open');
    }
  });
});


// ============================== SCROLL REVEAL ==============================
const revealTargets = document.querySelectorAll(
  '.kn-card, .bc, .step, .price-card, .faq-item'
);

revealTargets.forEach(el => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (!entry.isIntersecting) return;

    // Stagger cards that share a parent grid
    const siblings = Array.from(entry.target.parentElement.children).filter(
      c => c.classList.contains('reveal')
    );
    const delay = siblings.indexOf(entry.target) * 60;

    setTimeout(() => {
      entry.target.classList.add('visible');
    }, delay);

    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

revealTargets.forEach(el => revealObserver.observe(el));
