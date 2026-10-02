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

const sharingVideo = document.querySelector<HTMLVideoElement>('.sharing-demo video');
if (sharingVideo) {
  let onScreen = false;
  const source = sharingVideo.querySelector<HTMLSourceElement>('source[data-src]');
  const updatePlayback = () => {
    if (!onScreen || document.hidden) {
      sharingVideo.pause();
      return;
    }
    if (source?.dataset.src) {
      source.src = source.dataset.src;
      delete source.dataset.src;
      sharingVideo.load();
    }
    void sharingVideo.play().then(() => {
      if (!onScreen || document.hidden) sharingVideo.pause();
    }).catch(() => { /* The poster remains visible if autoplay is unavailable. */ });
  };
  const observer = new IntersectionObserver(entries => {
    onScreen = entries.some(entry => entry.isIntersecting);
    updatePlayback();
  });
  observer.observe(sharingVideo);
  document.addEventListener('visibilitychange', updatePlayback);
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
