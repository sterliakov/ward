import React from 'react';
import Container from 'react-bootstrap/Container';
import ReactDOM from 'react-dom/client';

import '../index.scss';
import PopupForm from './popupForm';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Container className="h-100">
      <PopupForm />
    </Container>
  </React.StrictMode>,
);
