(function () {
  'use strict';
  document.addEventListener('click', function (event) {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-print]')) {
      window.print();
      return;
    }
    const button = event.target.closest('[data-share]');
    if (!button) return;
    const url = encodeURIComponent(document.querySelector('link[rel="canonical"]').href);
    const text = encodeURIComponent(document.title);
    const destinations = {
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + url,
      twitter: 'https://twitter.com/intent/tweet?url=' + url + '&text=' + text,
      linkedin: 'https://www.linkedin.com/shareArticle?mini=true&url=' + url + '&title=' + text,
      whatsapp: 'https://api.whatsapp.com/send?text=' + text + '%20' + url
    };
    const destination = destinations[button.dataset.share];
    if (!destination) {
      console.error('[share] Unsupported network', button.dataset.share);
      return;
    }
    window.open(destination, '_blank', 'noopener,noreferrer,width=600,height=500');
  });
})();
