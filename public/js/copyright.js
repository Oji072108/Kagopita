(() => {
  const form = document.getElementById('copyrightForm');
  const message = document.getElementById('copyrightMessage');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (!form.reportValidity()) return;
    button.disabled = true;
    message.textContent = '';
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      body.goodFaith = form.elements.goodFaith.checked;
      body.accuracy = form.elements.accuracy.checked;
      const response = await fetch('/api/copyright/notice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || '申立てを送信できませんでした。');
      form.reset();
      message.textContent = '申立てを受け付けました。 / Your notice was received.';
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
})();
