// SPDX-License-Identifier: MIT
export function ErrorAlert({ message }: { message: string }) {
  return <p className="error" role="alert">
    {message}
    {message === 'Reconnect to this room before throwing.' && <>
      {' '}
      <button type="button" className="error-reload"
        onClick={event => event.currentTarget.ownerDocument.defaultView?.location.reload()}>
        Reload
      </button>
    </>}
  </p>;
}
