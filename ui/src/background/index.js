if (typeof window.browser === 'undefined') window.browser = window.chrome;
const chrome = window.browser;

function respond(msg) {
  chrome.tabs.query(
    {active: true},
    (tabs) => {
      tabs.forEach((tab) => chrome.tabs.sendMessage(tab.id, msg));
    },
  );
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log('Got any message', request);
  switch (request.type) {
  case 'sign': {
    const url = new URL(chrome.extension.getURL('sign.html'));
    url.searchParams.set('tx', JSON.stringify(request.tx));
    url.searchParams.set('signMode', request.signMode);
    url.searchParams.set('who', request.signer);
    chrome.tabs.create(
      {
        url: url.toString(),
        active: false,
      },
      function (tab) {
        // After the tab has been created, open a window to inject the tab
        chrome.windows.create({
          tabId: tab.id,
          type: 'popup',
          focused: true,
          height: 600,
          width: 400,
        });
      },
    );
    break;
  }
  case 'signDeliver':
    respond({type: 'sign-result', request});
    break;
  case 'getKey': {
    const result = await new Promise((resolve) =>
      chrome.storage.sync.get(request.key, (res) => resolve(res)),
    );
    respond({type: 'getKey-result', result});
    break;
  }
  case 'setKey': {
    const result = await new Promise((resolve) =>
      chrome.storage.sync.set(
        {[request.key]: request.value},
        (res) => resolve(res),
      ),
    );
    respond({type: 'setKey-result', result});
    break;
  }
  }
});
