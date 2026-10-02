// SPDX-License-Identifier: MIT
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { ColorControls } from '../dice-demo-v2/color-controls';
import type { createDicePreview } from '../dice-demo-v2/preview';
import type { Style } from '../../shared/model';

const presets: { name: string; style: Style }[] = [
  { name: 'Mint condition', style: { color: '#6edbc0', ink: '#182b28', pattern: 'frosted', font: 'modern' } },
  { name: 'Rose quartz', style: { color: '#eaa0b3', ink: '#492233', pattern: 'marble', font: 'serif' } },
  { name: 'After hours', style: { color: '#594586', ink: '#f4e9ca', pattern: 'speckle', font: 'gothic' } },
];

function Customizer() {
  const [style, setStyle] = useState<Style>(presets[0]!.style);
  const [selected, setSelected] = useState<'color' | 'ink'>('color');
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const host = useRef<HTMLDivElement>(null);
  const preview = useRef<ReturnType<typeof createDicePreview> | null>(null);
  const latest = useRef({ style, paused });
  latest.current = { style, paused };

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let generation = 0;
    const observer = new IntersectionObserver(async entries => {
      const visible = entries.some(entry => entry.isIntersecting);
      const attempt = ++generation;
      preview.current?.dispose();
      preview.current = null;
      if (!visible) return;
      setStatus('loading');
      try {
        const [module, fonts] = await Promise.all([
          import('../dice-demo-v2/preview'),
          import('../dice-demo/fonts'),
        ]);
        await fonts.loadDiceFonts();
        if (disposed || attempt !== generation) return;
        preview.current = module.createDicePreview(element, () => setStatus('failed'), {
          motion: latest.current.paused ? 'reduce' : 'device',
        });
        preview.current.style(latest.current.style);
        setStatus('ready');
      } catch {
        if (!disposed && attempt === generation) setStatus('failed');
      }
    }, { rootMargin: '120px' });
    observer.observe(element);
    return () => {
      disposed = true;
      generation++;
      observer.disconnect();
      preview.current?.dispose();
      preview.current = null;
    };
  }, []);

  useEffect(() => { preview.current?.style(style); }, [style]);
  useEffect(() => {
    preview.current?.setPreferences({ motion: paused ? 'reduce' : 'device' });
  }, [paused]);

  return (
    <div className="customizer" style={{ '--die-color': style.color, '--die-ink': style.ink } as CSSProperties}>
      <div className="die-stage">
        <div className="stage-topline"><span><span className="live-dot" aria-hidden="true" /> LIVE 3D PREVIEW</span><span>D10</span></div>
        <div ref={host} className="landing-preview" role="img" aria-label={`3D ten-sided die, ${style.color} body, ${style.ink} numbers, ${style.pattern} finish. Drag to rotate.`} />
        {status !== 'ready' && <p className="preview-status" role="status">{status === 'failed' ? '3D preview unavailable on this device. You can still explore the colors.' : 'Loading your die…'}</p>}
        <div className="stage-bottomline"><span>DRAG TO SPIN</span><button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Resume rotation' : 'Pause rotation'}</button></div>
      </div>
      <div className="customizer-controls">
        <div className="control-title"><h3>Find your color.</h3><span>TRY IT OUT</span></div>
        <div className="color-targets" role="group" aria-label="Choose what to color">
          <button type="button" aria-pressed={selected === 'color'} onClick={() => setSelected('color')}><span className="color-swatch" style={{ background: style.color }} /> Die</button>
          <button type="button" aria-pressed={selected === 'ink'} onClick={() => setSelected('ink')}><span className="color-swatch" style={{ background: style.ink }} /> Numbers</button>
        </div>
        <ColorControls color={style.color} ink={style.ink} selected={selected} onChange={change => setStyle(value => ({ ...value, ...change }))} />
        <div className="finish-controls">
          <label>Finish<select value={style.pattern} onChange={event => setStyle(value => ({ ...value, pattern: event.target.value as Style['pattern'] }))}><option value="solid">Solid</option><option value="frosted">Frosted</option><option value="marble">Marble</option><option value="speckle">Speckled</option></select></label>
          <label>Numbers<select value={style.font} onChange={event => setStyle(value => ({ ...value, font: event.target.value as Style['font'] }))}><option value="modern">Modern</option><option value="serif">Serif</option><option value="rune">Rune</option><option value="gothic">Gothic</option></select></label>
        </div>
        <div className="presets" role="group" aria-label="Try a dice design">{presets.map(preset => <button type="button" key={preset.name} aria-label={preset.name} title={preset.name} aria-pressed={JSON.stringify(style) === JSON.stringify(preset.style)} onClick={() => setStyle(preset.style)} style={{ background: preset.style.color, color: preset.style.ink }}><span aria-hidden="true">✦</span></button>)}<span>A little inspiration</span></div>
        <p className="customizer-note">Just a taste. More dice and designs await in the roller.</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('customizer-root')!).render(<Customizer />);

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-example]')) {
  button.addEventListener('click', () => {
    const framework = button.dataset.example === 'framework';
    document.getElementById('embed-code')!.hidden = framework;
    document.getElementById('framework-code')!.hidden = !framework;
    document.getElementById('code-label')!.textContent = framework
      ? 'A real export from the Click Clacks dice engine.'
      : 'A little dice. Right in your app.';
    for (const choice of document.querySelectorAll('[data-example]')) {
      choice.setAttribute('aria-pressed', String(choice === button));
    }
  });
}
