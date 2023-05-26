import React from 'react';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import ReactDOM from 'react-dom/client';

import '../index.scss';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Container>
      <Row>
        <Col>
          <h1>Unlock</h1>
        </Col>
      </Row>
    </Container>
  </React.StrictMode>,
);
