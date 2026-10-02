// SPDX-License-Identifier: MIT
import { useLayoutEffect, useRef } from 'react';
export function ErrorAlert({ message }: { message: string }) {
  const alert = useRef<HTMLParagraphElement>(null);
  const canReload = message === 'Reconnect to this room before throwing.';
  useLayoutEffect(() => {
    if (canReload) alert.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }, [canReload]);
  return <p ref={alert} className="error" role="alert">
    {message}
    {canReload && <>
      {' '}
      <button type="button" className="error-reload"
        onClick={event => event.currentTarget.ownerDocument.defaultView?.location.reload()}>
        Reload
      </button>
    </>}
  </p>;
}
