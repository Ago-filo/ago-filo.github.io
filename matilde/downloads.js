document.querySelectorAll('[data-open]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.open).showModal();
  });
});

document.querySelectorAll('.download-dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (
      event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom
    )) {
      dialog.close();
    }
  });
});
