export default function () {
  if (typeof window.browser === 'undefined') window.browser = window.chrome;
  const chrome = window.browser;

  const container = document.head || document.documentElement;
  const scriptElement = document.createElement('script');
  scriptElement.src = chrome.runtime.getURL('static/js/injected.js');
  scriptElement.type = 'text/javascript';
  container.insertBefore(scriptElement, container.children[0]);
  scriptElement.remove();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type.endsWith('-result')) {
      console.warn('Result received (content-script)', msg);
      document.dispatchEvent(new CustomEvent(msg.type, {detail: msg}));
    }
  });

  document.addEventListener(
    'bg-proxy',
    (e) => {
      console.log('Got proxy ev', e);
      chrome.runtime.sendMessage(
        e.detail,
        (msg) => {
          document.dispatchEvent(new CustomEvent(msg.type, {detail: msg}));
        },
      );
    },
  );
}
