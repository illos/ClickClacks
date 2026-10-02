// SPDX-License-Identifier: MIT
const mini = document.querySelector<HTMLIFrameElement>('.hero-tray');
if (mini) {
  let onScreen = false;
  let loaded = false;
  const sendVisibility = () => {
    if (onScreen && !document.hidden && !loaded && mini.dataset.src) {
      loaded = true;
      performance.mark('clickclacks:mini-load-start');
      mini.src = mini.dataset.src;
    }
    if (loaded) mini.contentWindow?.postMessage({
      type: 'clickclacks-demo-visibility', active: onScreen && !document.hidden,
    }, location.origin);
  };
  const observer = new IntersectionObserver(entries => {
    onScreen = entries.some(entry => entry.isIntersecting);
    sendVisibility();
  });
  observer.observe(mini);
  mini.addEventListener('load', sendVisibility);
  document.addEventListener('visibilitychange', sendVisibility);
  addEventListener('message', event => {
    if (event.origin === location.origin && event.source === mini.contentWindow &&
        event.data?.type === 'clickclacks-demo-ready') sendVisibility();
  });
}

const sharingFrame = document.querySelector<HTMLIFrameElement>('.sharing-tray');
if (sharingFrame) {
  let onScreen = false;
  let loaded = false;
  const sendVisibility = () => {
    if (onScreen && !document.hidden && !loaded && sharingFrame.dataset.src) {
      loaded = true;
      sharingFrame.src = sharingFrame.dataset.src;
    }
    if (loaded) sharingFrame.contentWindow?.postMessage({
      type: 'clickclacks-sharing-visibility', active: onScreen && !document.hidden,
    }, location.origin);
  };
  const observer = new IntersectionObserver(entries => {
    onScreen = entries.some(entry => entry.isIntersecting);
    sendVisibility();
  });
  observer.observe(sharingFrame);
  const viewport = sharingFrame.parentElement!;
  const resize = new ResizeObserver(() => {
    sharingFrame.style.transform = `scale(${viewport.clientWidth / 720})`;
  });
  resize.observe(viewport);
  sharingFrame.addEventListener('load', sendVisibility);
  document.addEventListener('visibilitychange', sendVisibility);
  addEventListener('message', event => {
    if (event.origin === location.origin && event.source === sharingFrame.contentWindow &&
        event.data?.type === 'clickclacks-sharing-ready') sendVisibility();
  });
}

const customizer = document.getElementById('customizer-root');
if (customizer) {
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    performance.mark('clickclacks:customizer-load-start');
    void import('./customizer').then(module => module.mountCustomizer(customizer)).catch(() => {
      customizer.textContent = 'The customizer could not load. Open the app to customize your dice.';
      customizer.setAttribute('role', 'status');
    });
  }, { rootMargin: '300px' });
  observer.observe(customizer);
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-example]')) {
  button.addEventListener('click', () => {
    const framework = button.dataset.example === 'framework';
    document.getElementById('embed-code')!.hidden = framework;
    document.getElementById('framework-code')!.hidden = !framework;
    document.getElementById('code-label')!.textContent = framework
      ? 'Dice engine example'
      : 'Iframe example';
    for (const choice of document.querySelectorAll('[data-example]')) {
      choice.setAttribute('aria-pressed', String(choice === button));
    }
  });
}
