fetch('/mfe-config.json')
  .then((res) => {
    if (!res.ok) throw new Error('Failed to load runtime MFE config');
    return res.json();
  })
  .then((config) => {
    window.MFE_CONFIG = config;
    import('./bootstrap');
  })
  .catch((err) => {
    console.error('MFE Initialization Error:', err);
    document.body.innerHTML = `<div style="color:red;padding:20px;">Critical initialization error!</div>`;
  });
