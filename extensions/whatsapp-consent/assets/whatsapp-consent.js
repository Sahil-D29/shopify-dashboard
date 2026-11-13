(() => {
  const initialise = (root) => {
    if (root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';
    const form = root.querySelector('.dorza-consent__form');
    const phone = root.querySelector('.dorza-consent__phone');
    const checkbox = root.querySelector('.dorza-consent__checkbox');
    const button = root.querySelector('.dorza-consent__submit');
    const status = root.querySelector('.dorza-consent__status');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity() || !checkbox.checked) return;
      button.disabled = true;
      status.textContent = '';
      try {
        const cartResponse = await fetch(`${window.Shopify.routes.root}cart.js`, { credentials: 'same-origin' });
        const cart = cartResponse.ok ? await cartResponse.json() : {};
        const response = await fetch(root.dataset.endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            granted: true,
            phone: phone.value,
            email: root.dataset.email || null,
            cartToken: cart.token || null,
            wordingVersion: root.dataset.wordingVersion,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || root.dataset.error);
        status.textContent = root.dataset.success;
        status.dataset.state = 'success';
        phone.disabled = true;
        checkbox.disabled = true;
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : root.dataset.error;
        status.dataset.state = 'error';
        button.disabled = false;
      }
    });
  };
  document.querySelectorAll('[data-dorza-whatsapp-consent]').forEach(initialise);
  document.addEventListener('shopify:section:load', (event) => {
    event.target.querySelectorAll('[data-dorza-whatsapp-consent]').forEach(initialise);
  });
})();
