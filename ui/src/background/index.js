if (typeof window.browser === 'undefined') window.browser = window.chrome;
const chrome = window.browser;

function respond(sendResponse, msg) {
  sendResponse(msg);
  chrome.tabs.query(
    {active: true},
    (tabs) => {
      tabs.forEach((tab) => chrome.tabs.sendMessage(tab.id, msg));
    },
  );
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    respond(sendResponse, {type: 'sign-result', request});
    break;
  case 'getKey': {
    console.log('Got getKey message', request);
    new Promise((resolve) =>
      chrome.storage.sync.get(request.key, (res) => resolve(res)),
    ).then((result) => {
      respond(sendResponse, {type: 'getKey-result', result});
      console.log('getKey response', result);
    });
    break;
  }
  case 'setKey': {
    new Promise((resolve) =>
      chrome.storage.sync.set(
        {[request.key]: request.value},
        (res) => resolve(res),
      ),
    ).then((result) => {
      respond(sendResponse, {type: 'setKey-result', result});
    });
    break;
  }
  }
  return true;
});
