const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
if (toggle && nav) {
  const close = () => { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); };
  toggle.addEventListener('click', () => {
    const opened = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(opened));
    nav.classList.toggle('is-open', opened);
  });
  nav.addEventListener('click', (event) => { if (event.target.closest('a')) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { close(); toggle.focus(); } });
  document.addEventListener('click', (event) => { if (!nav.contains(event.target) && !toggle.contains(event.target)) close(); });
  window.matchMedia('(min-width: 1101px)').addEventListener('change', close);
}
// Native fragment links handle scrolling and history, including when JavaScript is off.
const sectionLinks = [...document.querySelectorAll('#main-nav a[href^="#"]')];
const updateCurrentSection = () => {
  const hash = window.location.hash;
  const section = document.getElementById(hash.slice(1))?.closest('section[id]');
  const destination = section ? `#${section.id}` : hash;
  const current = sectionLinks.find(link => link.getAttribute('href') === destination) || sectionLinks.find(link => link.getAttribute('href') === '#home');
  sectionLinks.forEach(link => {
    if (link === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
};
window.addEventListener('hashchange', updateCurrentSection);
updateCurrentSection();
const copy = document.querySelector('.copy-email');
copy?.addEventListener('click', async () => {
  const status = document.querySelector('.copy-status');
  try {
    await navigator.clipboard.writeText(copy.dataset.email);
    status.textContent = 'Email address copied.';
  } catch {
    status.textContent = 'Copy unavailable. Select and copy the email address above.';
  }
});
document.querySelectorAll('img').forEach((img) => {
  const markUnavailable = () => {
    img.classList.add('image-unavailable');
    const container = img.closest('.product-image, .hero, figure');
    if (container) container.classList.add('image-fallback');
  };
  img.addEventListener('error', markUnavailable);
  if (img.complete && !img.naturalWidth) markUnavailable();
});
